"""Breast ultrasound classifier (normal / benign / malignant) on BUSI.

Dataset: Al-Dhabyani W, Gomaa M, Khaled H, Fahmy A. Dataset of breast
ultrasound images. Data in Brief 28 (2020) 104863. doi:10.1016/j.dib.2019.104863
780 images from 600 women aged 25-75 (Baheya Hospital, Cairo, 2018).

Known problem: Pawłowska et al. (Data in Brief 2023, PMC10293973) found 235
duplicate images in BUSI, including 8 that appear in BOTH the benign and the
malignant folders. Random splits therefore leak test images into training.

Protocol (why our numbers can be trusted):
  * segmentation masks are excluded; only the ultrasound images are used
  * duplicates are found two ways — a pixel hash and pretrained-feature cosine
    similarity — and grouped so a group never straddles train and test
  * groups containing BOTH benign and malignant labels are removed (label conflict)
  * 5-fold stratified, grouped cross-validation; the regularisation strength is
    chosen by an inner grouped CV, so the test fold is never seen
  * model = frozen ImageNet EfficientNet-B0 + logistic regression ("linear probe")
  * the deployed model is fold 1's; its demo images come from its own test fold

Usage: python train_busi.py --data /path/to/Dataset_BUSI_with_GT --out ../app [--compare]
"""
import argparse
import random
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.linear_model import LogisticRegressionCV
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import StandardScaler

import common as C

CLASSES = ["normal", "benign", "malignant"]
MALIGNANT = 2
COMPARE = {"ConvNeXt-Tiny (ImageNet)": "convnext_tiny.fb_in1k",
           "DINOv2 ViT-S/14 (self-supervised)": "vit_small_patch14_dinov2.lvd142m"}


def load(data_dir):
    images, labels, names = [], [], []
    for k, c in enumerate(CLASSES):
        for p in sorted((Path(data_dir) / c).glob("*.png")):
            if "_mask" in p.name:
                continue
            im = Image.open(p).convert("RGB")
            # Shrink once (max side 288) to fit an 8 GB laptop; demo images are
            # saved from these same pixels so browser and Python see the same input.
            im.thumbnail((288, 288), Image.LANCZOS)
            images.append(im)
            labels.append(k)
            names.append(f"{c}/{p.name}")
    return images, np.array(labels), names


def fit_probe(F, Ff, y, groups, idx, seed):
    """Logistic regression on frozen features; flipped copies augment training."""
    X = np.concatenate([F[idx], Ff[idx]])
    yy = np.concatenate([y[idx], y[idx]])
    gg = np.concatenate([groups[idx], groups[idx]])
    scaler = StandardScaler().fit(X)
    inner = list(StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=seed)
                 .split(X, yy, gg))
    lr = LogisticRegressionCV(Cs=np.logspace(-4, 0, 9), cv=inner, scoring="neg_log_loss",
                              class_weight="balanced", max_iter=3000)
    lr.fit(scaler.transform(X), yy)
    return scaler, lr


def cross_validate(F, Ff, y, groups, folds, seed, log):
    outer = StratifiedGroupKFold(n_splits=folds, shuffle=True, random_state=seed)
    oof = np.zeros((len(y), len(CLASSES)))
    fold_metrics, models = [], []
    for fold, (tr, te) in enumerate(outer.split(F, y, groups)):
        assert not set(groups[tr]) & set(groups[te])
        scaler, lr = fit_probe(F, Ff, y, groups, tr, seed + fold)
        p = lr.predict_proba(scaler.transform(F[te]))
        oof[te] = p
        m = C.metrics(p, y[te], CLASSES, positive=[MALIGNANT])
        m.update(fold=fold + 1, n_train=int(len(tr)), chosen_C=float(lr.C_[0]))
        fold_metrics.append(m)
        models.append((scaler, lr, te, p))
        log(f"  fold {fold + 1}: train {len(tr)} test {len(te)}  acc {m['accuracy']:.3f}  "
            f"bal-acc {m['balanced_accuracy']:.3f}  macro-AUC {m['macro_auc_ovr']:.3f}  "
            f"malignant AUC {m['cancer_vs_not']['auc']:.3f}  sens {m['cancer_vs_not']['sensitivity']:.3f}  "
            f"spec {m['cancer_vs_not']['specificity']:.3f}")

    def ms(key, sub=None):
        v = [f[key][sub] if sub else f[key] for f in fold_metrics]
        return {"mean": float(np.mean(v)), "std": float(np.std(v)), "per_fold": v}

    cv = {"accuracy": ms("accuracy"), "balanced_accuracy": ms("balanced_accuracy"),
          "macro_auc_ovr": ms("macro_auc_ovr"), "malignant_auc": ms("cancer_vs_not", "auc"),
          "malignant_sensitivity": ms("cancer_vs_not", "sensitivity"),
          "malignant_specificity": ms("cancer_vs_not", "specificity")}
    return cv, oof, fold_metrics, models


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True, help="app folder (models/ and samples/ are written)")
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--compare", action="store_true", help="also cross-validate other backbones")
    args = ap.parse_args()

    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(exist_ok=True)
    log_f = open(results_dir / "busi_train_log.txt", "w")

    def log(*a):
        s = " ".join(str(x) for x in a)
        print(s, flush=True)
        log_f.write(s + "\n")
        log_f.flush()

    np.random.seed(args.seed)
    dev = C.device()
    images, y, names = load(args.data)
    log(f"Loaded {len(images)} images:", {c: int((y == k).sum()) for k, c in enumerate(CLASSES)})

    backbone = C.make_backbone("efficientnet_b0.ra_in1k")
    log("Extracting EfficientNet-B0 features (original + mirrored)...")
    F = C.extract(backbone, images, dev, log=log)
    Ff = C.extract(backbone, images, dev, flip=True, log=log)

    # ---------------------------------------------------- duplicates & conflicts
    Fa = (F + Ff) / 2
    center = Fa.mean(0)
    thr, calib = C.calibrate_threshold(backbone, images, center, dev, log=log)
    sim_pairs = C.similarity_pairs(Fa, thr, center)
    hashes = np.stack([C.dhash(im) for im in images])
    hash_pairs = [(i, j) for i in range(len(images))
                  for j in np.nonzero((hashes[i + 1:] != hashes[i]).sum(1) <= 10)[0] + i + 1]
    groups = C.union_find_groups(len(images), sim_pairs + hash_pairs)
    n_dup_imgs = int(sum(c for c in np.unique(groups, return_counts=True)[1] if c > 1))
    log(f"Duplicate search: {len(hash_pairs)} hash pairs, {len(sim_pairs)} feature pairs -> "
        f"{len(set(groups))} groups; {n_dup_imgs} images have at least one near-duplicate")

    conflict = [g for g in set(groups) if len(set(y[groups == g])) > 1]
    drop = np.isin(groups, conflict)
    conflict_list = [[names[i] for i in np.nonzero(groups == g)[0]] for g in conflict]
    log(f"Label conflicts: {len(conflict)} groups ({int(drop.sum())} images) carry different labels "
        f"-> removed. Examples: {conflict_list[:5]}")
    keep = ~drop
    images = [im for im, k in zip(images, keep) if k]
    names = [n for n, k in zip(names, keep) if k]
    y, groups, F, Ff = y[keep], groups[keep], F[keep], Ff[keep]
    log(f"Clean set: {len(y)} images", {c: int((y == k).sum()) for k, c in enumerate(CLASSES)})

    # ---------------------------------------------------- cross-validation
    log("\nEfficientNet-B0 linear probe, 5-fold grouped CV:")
    cv, oof, fold_metrics, models = cross_validate(F, Ff, y, groups, args.folds, args.seed, log)
    pooled = C.metrics(oof, y, CLASSES, positive=[MALIGNANT])
    pooled["malignant_auc_95ci"] = C.bootstrap_ci(
        oof, y, lambda p, t: roc_auc_score(t == MALIGNANT, p[:, MALIGNANT]))
    for k, v in cv.items():
        log(f"  {k:24s} {v['mean']:.3f} ± {v['std']:.3f}")
    log(f"  pooled malignant AUC 95% CI {pooled['malignant_auc_95ci']}")

    comparison = {"EfficientNet-B0 (ImageNet) — deployed": {k: {"mean": v["mean"], "std": v["std"]}
                                                           for k, v in cv.items()}}
    if args.compare:
        for label, arch in COMPARE.items():
            log(f"\n{label} linear probe:")
            kw = {"img_size": C.IMG} if "dinov2" in arch else {}
            import timm
            bb = timm.create_model(arch, pretrained=True, num_classes=0, **kw).eval()
            Fc = C.extract(bb, images, dev, log=lambda *a: None)
            Ffc = C.extract(bb, images, dev, flip=True, log=lambda *a: None)
            cvc, _, _, _ = cross_validate(Fc, Ffc, y, groups, args.folds, args.seed, log)
            comparison[label] = {k: {"mean": v["mean"], "std": v["std"]} for k, v in cvc.items()}
            log("  " + "  ".join(f"{k} {v['mean']:.3f}" for k, v in cvc.items()))
            del bb

    summary = {
        "dataset": "BUSI (Al-Dhabyani et al., Data in Brief 2020)",
        "classes": CLASSES,
        "n_images_raw": 780,
        "duplicate_threshold_calibration": calib,
        "n_label_conflict_groups": len(conflict), "label_conflicts": conflict_list,
        "n_images_clean": int(len(y)), "n_groups": int(len(set(groups))),
        "protocol": f"{args.folds}-fold stratified grouped CV; frozen EfficientNet-B0 (ImageNet) "
                    "global-pooled features + L2 logistic regression (C by inner grouped CV, "
                    "balanced class weights, mirrored copies as training augmentation); 224x224",
        "cv": cv, "backbone_comparison": comparison,
        "pooled_out_of_fold": pooled, "folds": fold_metrics,
    }
    C.save_json(summary, results_dir / "busi_metrics.json")

    # ---------------------------------------------------- export fold 1
    scaler, lr, te, p = models[0]
    out = Path(args.out)
    (out / "models").mkdir(parents=True, exist_ok=True)
    rng = random.Random(args.seed)
    check = [images[i] for i in rng.sample(list(te), 20)]
    head, diff = C.export_onnx(backbone, scaler, lr, out / "models" / "busi_effnet_b0.onnx", check, log)
    fm = fold_metrics[0]
    C.save_json({
        "classes": CLASSES,
        "input": {"size": C.IMG, "mean": C.MEAN, "std": C.STD, "resize": "stretch to 224x224"},
        "classifier": head,
        "onnx_parity_max_abs_diff": diff,
        "test_metrics": {k: fm[k] for k in ("n", "accuracy", "balanced_accuracy", "macro_auc_ovr",
                                            "cancer_vs_not", "confusion_matrix", "per_class_recall")},
        "cv_summary": {k: {"mean": v["mean"], "std": v["std"]} for k, v in cv.items()},
        "pooled_malignant_auc_95ci": pooled["malignant_auc_95ci"],
        "n_images_clean": int(len(y)), "n_label_conflict_images_removed": int(drop.sum()),
        "backbone_comparison": comparison,
    }, out / "models" / "busi_model.json")

    # Demo images: 2 random per class from the deployed model's own test fold.
    sdir = out / "samples"
    shutil.rmtree(sdir, ignore_errors=True)
    sdir.mkdir()
    samples, te_list = [], list(te)
    for k, c in enumerate(CLASSES):
        for j, i in enumerate(rng.sample([i for i in te_list if y[i] == k], 2)):
            fn = f"{c}_{j + 1}.png"
            images[i].save(sdir / fn)
            samples.append({"file": f"samples/{fn}", "truth": c, "source": f"BUSI {names[i]}",
                            "python_probs": [round(float(v), 4) for v in p[te_list.index(i)]]})
    C.save_json(samples, sdir / "samples.json")
    log(f"Exported model + {len(samples)} held-out demo images to {out}")


if __name__ == "__main__":
    main()

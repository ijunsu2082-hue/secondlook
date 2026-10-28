"""Shared training utilities: near-duplicate grouping, frozen-backbone feature
extraction ("linear probe"), metrics, and ONNX export with Class Activation Maps.

Why a linear probe: an ImageNet-pretrained CNN is frozen and only a logistic
regression is trained on its pooled features. This needs one forward pass per
image (no back-propagation), so it trains on an 8 GB laptop in minutes, and
because the head is linear on globally-pooled features, the browser can still
draw an exact Class Activation Map (Zhou et al., CVPR 2016).
"""
import json
from pathlib import Path

import numpy as np
import timm
import torch
import torch.nn as nn
from PIL import Image, ImageOps
from sklearn.metrics import (accuracy_score, balanced_accuracy_score,
                             confusion_matrix, roc_auc_score)
from torchvision import transforms

MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)
IMG = 224

# Evaluation preprocessing matches the browser exactly: stretch to 224x224.
eval_tf = transforms.Compose([
    transforms.Resize((IMG, IMG)),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])


def device():
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


# ---------------------------------------------------------------- duplicates
def dhash(img, size=16):
    """Difference hash: robust fingerprint for spotting near-identical images."""
    g = img.convert("L").resize((size + 1, size), Image.BILINEAR)
    a = np.asarray(g, dtype=np.int16)
    return (a[:, 1:] > a[:, :-1]).flatten()


def union_find_groups(n, pairs):
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for a, b in pairs:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra
    return np.array([find(i) for i in range(n)])


def duplicate_groups(images, max_hamming=10):
    """Images whose hashes differ in at most `max_hamming` of 256 bits share a
    group, so near-duplicates never straddle train and test."""
    hashes = np.stack([dhash(im) for im in images])
    pairs = []
    for i in range(len(images)):
        d = (hashes[i + 1:] != hashes[i]).sum(axis=1)
        pairs += [(i, i + 1 + j) for j in np.nonzero(d <= max_hamming)[0]]
    return union_find_groups(len(images), pairs)


# ---------------------------------------------------------------- features
def make_backbone(arch="efficientnet_b0"):
    m = timm.create_model(arch, pretrained=True, num_classes=0)
    return m.eval()


@torch.no_grad()
def extract(backbone, images, dev, bs=16, flip=False, log=print):
    """Global-average-pooled features (N x C). flip=True mirrors each image."""
    backbone.to(dev)
    out = []
    for s in range(0, len(images), bs):
        batch = [ImageOps.mirror(im) if flip else im for im in images[s:s + bs]]
        x = torch.stack([eval_tf(im) for im in batch]).to(dev)
        out.append(backbone(x).cpu().numpy())  # num_classes=0 -> pooled features
        if (s // bs) % 50 == 0:
            log(f"    features {min(s + bs, len(images))}/{len(images)}")
    return np.concatenate(out).astype(np.float32)


def similarity_pairs(feats, threshold, center):
    """Pairs of images whose centred, flip-averaged feature vectors have cosine
    similarity >= threshold. Catches crops, shifts and re-saves that a pixel
    hash misses."""
    f = feats - center
    f = f / np.linalg.norm(f, axis=1, keepdims=True)
    pairs = []
    for s in range(0, len(f), 512):
        sim = f[s:s + 512] @ f.T
        for i, j in zip(*np.nonzero(sim >= threshold)):
            if s + i < j:
                pairs.append((int(s + i), int(j)))
    return pairs


def augment_like_keras(img, rng):
    """Mild random augmentation (rotation +-10 deg, shift/zoom 10%, flip,
    brightness), used only to calibrate the duplicate threshold."""
    w, h = img.size
    im = img.rotate(rng.uniform(-10, 10), resample=Image.BILINEAR,
                    translate=(rng.uniform(-.1, .1) * w, rng.uniform(-.1, .1) * h))
    z = rng.uniform(0.9, 1.0)
    cw, ch = int(w * z), int(h * z)
    x0, y0 = rng.integers(0, w - cw + 1), rng.integers(0, h - ch + 1)
    im = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((w, h), Image.BILINEAR)
    if rng.random() < 0.5:
        im = ImageOps.mirror(im)
    from PIL import ImageEnhance
    return ImageEnhance.Brightness(im).enhance(rng.uniform(0.8, 1.2))


def calibrate_threshold(backbone, images, center, dev, n=150, seed=0, log=print):
    """Pick a cosine threshold that almost never joins two DIFFERENT images
    (99.9th percentile of all different-image pairs in a random sample), then
    report how many augmented copies of the same image it still catches."""
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(images), min(n, len(images)), replace=False)
    base = [images[i] for i in idx]
    aug = [augment_like_keras(im, rng) for im in base]

    def unit(f):
        f = f - center
        return f / np.linalg.norm(f, axis=1, keepdims=True)

    nb = unit(flip_avg_features(backbone, base, dev))
    na = unit(flip_avg_features(backbone, aug, dev))
    same = (nb * na).sum(1)
    sim = nb @ nb.T
    other = sim[np.triu_indices(len(nb), 1)]
    thr = float(max(np.percentile(other, 99.9), 0.80))
    stats = {"threshold": thr, "different_pairs_p99_9": float(np.percentile(other, 99.9)),
             "different_pairs_median": float(np.median(other)),
             "augmented_copies_caught": float((same >= thr).mean()),
             "augmented_self_median": float(np.median(same))}
    log(f"  duplicate threshold {thr:.3f}: different-image pairs median {stats['different_pairs_median']:.3f}; "
        f"catches {stats['augmented_copies_caught'] * 100:.0f}% of synthetic augmented copies "
        f"(median self-similarity {stats['augmented_self_median']:.3f})")
    return thr, stats


def flip_avg_features(backbone, images, dev):
    return (extract(backbone, images, dev, log=lambda *a: None) +
            extract(backbone, images, dev, flip=True, log=lambda *a: None)) / 2


# ---------------------------------------------------------------- metrics
def metrics(probs, y, class_names, positive=None):
    """positive: class indices that count as 'cancer' for the binary view."""
    pred = probs.argmax(1)
    k = len(class_names)
    out = {
        "n": int(len(y)),
        "accuracy": float(accuracy_score(y, pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y, pred)),
        "confusion_matrix": confusion_matrix(y, pred, labels=list(range(k))).tolist(),
        "per_class_recall": {},
    }
    if len(set(y.tolist())) == k and k > 2:
        out["macro_auc_ovr"] = float(roc_auc_score(y, probs, multi_class="ovr", average="macro"))
    for c in range(k):
        m = y == c
        if m.any():
            out["per_class_recall"][class_names[c]] = float((pred[m] == c).mean())
    if positive:
        yb = np.isin(y, positive)
        pb = np.isin(pred, positive)
        score = probs[:, positive].sum(1)
        out["cancer_vs_not"] = {
            "auc": float(roc_auc_score(yb, score)) if 0 < yb.sum() < len(yb) else None,
            "sensitivity": float(pb[yb].mean()) if yb.any() else None,
            "specificity": float((~pb[~yb]).mean()) if (~yb).any() else None,
        }
    return out


def bootstrap_ci(probs, y, fn, n=1000, seed=0):
    rng = np.random.default_rng(seed)
    vals = []
    for _ in range(n):
        idx = rng.integers(0, len(y), len(y))
        try:
            vals.append(fn(probs[idx], y[idx]))
        except ValueError:
            continue
    return [float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))]


# ---------------------------------------------------------------- export
class ProbeModel(nn.Module):
    """Frozen backbone + logistic-regression head folded into one linear layer.
    Outputs class probabilities AND the last convolutional feature map, so the
    browser computes CAM = sum_c W[class, c] * features[c]."""

    def __init__(self, backbone, scaler, lr):
        super().__init__()
        self.backbone = backbone
        w = lr.coef_ / scaler.scale_                      # (K, C)
        b = lr.intercept_ - (w * scaler.mean_).sum(1)     # (K,)
        self.fc = nn.Linear(w.shape[1], w.shape[0])
        self.fc.weight.data = torch.tensor(w, dtype=torch.float32)
        self.fc.bias.data = torch.tensor(b, dtype=torch.float32)

    def forward(self, x):
        f = self.backbone.forward_features(x)
        return torch.softmax(self.fc(f.mean(dim=(2, 3))), 1), f


def export_onnx(backbone, scaler, lr, path, check_images, log=print):
    """Export and prove the ONNX graph reproduces scikit-learn's probabilities."""
    import onnxruntime as ort
    model = ProbeModel(backbone.cpu().eval(), scaler, lr).eval()
    torch.onnx.export(model, torch.randn(1, 3, IMG, IMG), str(path), input_names=["input"],
                      output_names=["probs", "features"], opset_version=17,
                      do_constant_folding=True, dynamo=False)
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    feats = extract(backbone, check_images, torch.device("cpu"), log=lambda *a: None)
    ref = lr.predict_proba(scaler.transform(feats))
    got = np.concatenate([sess.run(None, {"input": eval_tf(im).unsqueeze(0).numpy()})[0]
                          for im in check_images])
    worst = float(np.abs(ref - got).max())
    log(f"ONNX parity: max |sklearn - onnx| prob diff = {worst:.2e} over {len(check_images)} images")
    assert worst < 1e-3, "ONNX export does not match the trained model"
    return {"weight": model.fc.weight.detach().numpy().round(7).tolist(),
            "bias": model.fc.bias.detach().numpy().round(7).tolist()}, worst


def save_json(obj, path):
    Path(path).write_text(json.dumps(obj, indent=1))

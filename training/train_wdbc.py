"""Biopsy cell-measurement model on the Wisconsin Diagnostic Breast Cancer data.

Dataset: Wolberg WH, Street WN, Mangasarian OL. Breast Cancer Wisconsin
(Diagnostic). UCI Machine Learning Repository, 1995. doi:10.24432/C5DW2B
569 fine-needle-aspirate (FNA) samples, 212 malignant / 357 benign, 30 features
= mean, standard error and "worst" (mean of the 3 largest) of 10 nucleus
measurements. Bundled with scikit-learn (no download).

We compare four standard models with repeated stratified 10-fold CV, then deploy
logistic regression: it is within noise of the best and every prediction can be
explained exactly as a sum of per-feature contributions.

Usage: python train_wdbc.py --out ../app
"""
import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression, LogisticRegressionCV
from sklearn.metrics import make_scorer, recall_score, roc_auc_score, accuracy_score
from sklearn.model_selection import RepeatedStratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

SEED = 42


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    d = load_breast_cancer()
    X = d.data
    y = (d.target == 0).astype(int)  # scikit-learn codes malignant as 0; we use 1 = malignant
    names = list(d.feature_names)
    assert y.sum() == 212 and len(y) == 569

    models = {
        "Logistic regression": make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=5000)),
        "SVM (RBF kernel)": make_pipeline(StandardScaler(), SVC(C=3, probability=True, random_state=SEED)),
        "Random forest": RandomForestClassifier(n_estimators=500, random_state=SEED),
        "Gradient boosting": GradientBoostingClassifier(random_state=SEED),
    }
    scoring = {"accuracy": "accuracy", "roc_auc": "roc_auc",
               "sensitivity": make_scorer(recall_score, pos_label=1),
               "specificity": make_scorer(recall_score, pos_label=0)}
    cv = RepeatedStratifiedKFold(n_splits=10, n_repeats=5, random_state=SEED)
    comparison = {}
    for name, m in models.items():
        r = cross_validate(m, X, y, cv=cv, scoring=scoring)
        comparison[name] = {k: {"mean": float(r[f"test_{k}"].mean()), "std": float(r[f"test_{k}"].std())}
                            for k in scoring}
        print(f"{name:22s} " + "  ".join(f"{k} {v['mean']:.3f}±{v['std']:.3f}"
                                          for k, v in comparison[name].items()))

    # Deployed model: C chosen by inner CV on an 80% split; 20% kept for an honest test.
    Xtr, Xte, ytr, yte, itr, ite = train_test_split(X, y, np.arange(len(y)), test_size=0.2,
                                                    stratify=y, random_state=SEED)
    scaler = StandardScaler().fit(Xtr)
    lr = LogisticRegressionCV(Cs=np.logspace(-2, 2, 17), cv=10, scoring="roc_auc",
                              max_iter=5000).fit(scaler.transform(Xtr), ytr)
    p = lr.predict_proba(scaler.transform(Xte))[:, 1]
    pred = (p >= 0.5).astype(int)
    test = {"n": int(len(yte)), "accuracy": float(accuracy_score(yte, pred)),
            "auc": float(roc_auc_score(yte, p)),
            "sensitivity": float(pred[yte == 1].mean()), "specificity": float(1 - pred[yte == 0].mean()),
            "chosen_C": float(lr.C_[0])}
    print("Deployed LR test:", test)

    # Re-implement the prediction the way the browser will, to prove parity.
    z = ((Xte - scaler.mean_) / scaler.scale_) @ lr.coef_[0] + lr.intercept_[0]
    assert np.allclose(1 / (1 + np.exp(-z)), p, atol=1e-9)

    # Example cases from the held-out 20%: 3 benign + 3 malignant, seeded.
    rng = np.random.default_rng(SEED)
    examples = []
    for label in (0, 1):
        for j in rng.choice(np.nonzero(yte == label)[0], 3, replace=False):
            examples.append({"id": f"WDBC-{int(ite[j])}", "truth": "malignant" if label else "benign",
                             "values": [round(float(v), 5) for v in Xte[j]],
                             "python_prob_malignant": round(float(p[j]), 6)})

    out = Path(args.out) / "models"
    out.mkdir(parents=True, exist_ok=True)
    (out / "wdbc_model.json").write_text(json.dumps({
        "features": names, "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
        "coef": lr.coef_[0].tolist(), "intercept": float(lr.intercept_[0]),
        "min": X.min(0).tolist(), "max": X.max(0).tolist(), "median": np.median(X, 0).tolist(),
        "test_metrics": test, "examples": examples}, indent=1))
    res = Path(__file__).parent / "results"
    res.mkdir(exist_ok=True)
    (res / "wdbc_metrics.json").write_text(json.dumps(
        {"dataset": "Breast Cancer Wisconsin (Diagnostic), UCI, 569 samples",
         "cv": "5 x repeated stratified 10-fold", "comparison": comparison, "deployed_test": test},
        indent=1))


if __name__ == "__main__":
    main()

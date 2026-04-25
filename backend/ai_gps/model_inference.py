from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


@dataclass(frozen=True)
class ModelPrediction:
    team: str
    player: str
    minute: int
    fatigue_score: float
    risk_level: str
    confidence: float


def load_model_bundle(path: str | Path) -> dict[str, Any]:
    bundle = joblib.load(path)
    required = {"classifier", "regressor", "feature_columns"}
    missing = required.difference(bundle)
    if missing:
        raise ValueError(f"Model bundle is missing keys: {sorted(missing)}")
    return bundle


def predict_features(
    features: pd.DataFrame,
    model_path: str | Path = "models/fatigue_model.joblib",
) -> list[ModelPrediction]:
    bundle = load_model_bundle(model_path)
    classifier = bundle["classifier"]
    regressor = bundle["regressor"]
    feature_columns: list[str] = bundle["feature_columns"]

    missing = [column for column in feature_columns if column not in features.columns]
    if missing:
        raise ValueError(f"Feature input is missing columns: {missing}")

    clean = features.copy()
    clean = clean.dropna(subset=feature_columns)
    if "team" not in clean.columns:
        clean["team"] = "unknown"
    if "player" not in clean.columns:
        clean["player"] = "unknown"
    if "minute" not in clean.columns:
        clean["minute"] = -1

    x = clean[feature_columns]
    risk_levels = classifier.predict(x)
    probabilities = classifier.predict_proba(x)
    scores = regressor.predict(x)

    predictions: list[ModelPrediction] = []
    for idx, (_, row) in enumerate(clean.iterrows()):
        predictions.append(
            ModelPrediction(
                team=str(row["team"]),
                player=str(row["player"]),
                minute=int(row["minute"]),
                fatigue_score=round(float(scores[idx]), 1),
                risk_level=str(risk_levels[idx]),
                confidence=round(float(probabilities[idx].max()), 3),
            )
        )
    return predictions


def predictions_to_alerts(
    predictions: list[ModelPrediction],
    min_confidence: float = 0.55,
    include_low: bool = False,
) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    severity_map = {"low": "scazut", "medium": "mediu", "high": "ridicat"}

    for prediction in predictions:
        if prediction.confidence < min_confidence:
            continue
        if prediction.risk_level == "low" and not include_low:
            continue

        alerts.append(
            {
                "minute": prediction.minute,
                "team": prediction.team,
                "player": prediction.player,
                "category": "physical_model",
                "severity": severity_map.get(prediction.risk_level, prediction.risk_level),
                "risk_level": prediction.risk_level,
                "fatigue_score": prediction.fatigue_score,
                "confidence": prediction.confidence,
                "title": f"{prediction.player}: risc fizic {severity_map.get(prediction.risk_level, prediction.risk_level)}",
                "evidence": (
                    f"Modelul estimeaza fatigue_score={prediction.fatigue_score:.1f}/100 "
                    f"cu incredere {prediction.confidence:.2f}."
                ),
                "suggestion": _suggestion_for_risk(prediction.risk_level),
            }
        )
    return alerts


def _suggestion_for_risk(risk_level: str) -> str:
    if risk_level == "high":
        return "Verificati imediat jucatorul si pregatiti schimbare sau ajustare de rol."
    if risk_level == "medium":
        return "Monitorizati urmatoarele 3-5 minute si reduceti expunerea la sprinturi repetate."
    return "Continuati monitorizarea; nu este necesara interventie imediata."


def render_prediction_payload(
    predictions: list[ModelPrediction],
    alerts: list[dict[str, Any]],
    source: str,
) -> str:
    payload = {
        "source": source,
        "predictions_count": len(predictions),
        "alerts_count": len(alerts),
        "predictions": [prediction.__dict__ for prediction in predictions],
        "alerts": alerts,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)

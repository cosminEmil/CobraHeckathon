from pydantic import BaseModel
from typing import List, Dict, Any

class MatchStatsInput(BaseModel):
    stats: Dict[str, float]

class AnomalyInput(BaseModel):
    players: List[Dict[str, Any]]

class FeatureImpact(BaseModel):
    feature: str
    impact: float

class DiagnosticResponse(BaseModel):
    win_probability: float
    top_strengths: List[FeatureImpact]
    top_weaknesses: List[FeatureImpact]
    tactical_advice: str

class AnomalyResult(BaseModel):
    playerId: str
    is_anomaly: bool

class AnomalyResponse(BaseModel):
    anomalies: List[AnomalyResult]

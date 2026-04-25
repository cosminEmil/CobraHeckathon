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


class MatchData(BaseModel):
    id: str
    label: str
    opponent: str
    score: str
    date: str
    possession: float
    shots: int
    shotsOT: int
    passes: int
    passAcc: float
    corners: int
    fouls: int
    yellowCards: int
    redCards: int
    distanceCovered: float
    topSpeed: float


class MatchListResponse(BaseModel):
    matches: List[MatchData]


class PlayerInsightResponse(BaseModel):
    squad: List[Dict[str, Any]]
    top_strengths: List[FeatureImpact]
    top_weaknesses: List[FeatureImpact]


class MatchInsightResponse(BaseModel):
    top_strengths: List[FeatureImpact]
    top_weaknesses: List[FeatureImpact]


class MatchPlayerStats(BaseModel):
    player_id: int
    name: str
    pos: str
    goals: float
    assists: float
    passes: float
    passes_final_third: float
    minutes_on_field: float


class MatchPlayersResponse(BaseModel):
    players: List[MatchPlayerStats]

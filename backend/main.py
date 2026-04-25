from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    MatchStatsInput,
    AnomalyInput,
    DiagnosticResponse,
    AnomalyResponse,
    MatchListResponse,
    PlayerInsightResponse,
    MatchInsightResponse,
    MatchPlayersResponse,
)
from ml_engine import get_ml_engine
from llm_coach import generate_tactical_advice
from data_service import (
    load_ucluj_matches,
    get_player_insights,
    get_match_insights,
    get_match_stats_for_model,
    get_match_player_stats,
    init_database,
)

app = FastAPI(title="Rețeta Victoriei - Digital Coach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def load_models():
    get_ml_engine()
    init_database()

@app.post("/api/v1/diagnostics", response_model=DiagnosticResponse)
def run_diagnostics(input_data: MatchStatsInput):
    engine = get_ml_engine()
    
    try:
        win_prob, top_strengths, top_weaknesses = engine.analyze_match(input_data.stats)
        
        tactical_advice = "No major weaknesses detected! Keep it up."
        if top_weaknesses:
            worst = top_weaknesses[0]
            tactical_advice = generate_tactical_advice(worst["feature"], worst["impact"])

        return DiagnosticResponse(
            win_probability=win_prob,
            top_strengths=top_strengths,
            top_weaknesses=top_weaknesses,
            tactical_advice=tactical_advice
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/anomalies", response_model=AnomalyResponse)
def find_anomalies(input_data: AnomalyInput):
    engine = get_ml_engine()
    
    try:
        results = engine.detect_anomalies(input_data.players)
        return AnomalyResponse(anomalies=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/matches/ucluj", response_model=MatchListResponse)
def get_ucluj_matches():
    try:
        return MatchListResponse(matches=load_ucluj_matches())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/players/overall-insights", response_model=PlayerInsightResponse)
def get_overall_player_insights():
    try:
        payload = get_player_insights()
        return PlayerInsightResponse(
            squad=payload["squad"],
            top_strengths=payload["top_strengths"],
            top_weaknesses=payload["top_weaknesses"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/matches/ucluj/{match_id}/insights", response_model=MatchInsightResponse)
def get_single_match_insights(match_id: str):
    try:
        payload = get_match_insights(match_id)
        return MatchInsightResponse(
            top_strengths=payload["top_strengths"],
            top_weaknesses=payload["top_weaknesses"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/diagnostics/by-match/{match_id}", response_model=DiagnosticResponse)
def run_diagnostics_from_db(match_id: str):
    engine = get_ml_engine()
    stats = get_match_stats_for_model(match_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Match not found in DB")

    try:
        win_prob, top_strengths, top_weaknesses = engine.analyze_match(stats)
        tactical_advice = "No major weaknesses detected! Keep it up."
        if top_weaknesses:
            worst = top_weaknesses[0]
            tactical_advice = generate_tactical_advice(worst["feature"], worst["impact"])
        return DiagnosticResponse(
            win_probability=win_prob,
            top_strengths=top_strengths,
            top_weaknesses=top_weaknesses,
            tactical_advice=tactical_advice,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/matches/ucluj/{match_id}/players", response_model=MatchPlayersResponse)
def get_single_match_players(match_id: str):
    try:
        return MatchPlayersResponse(players=get_match_player_stats(match_id))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/admin/reload-dataset")
def reload_dataset_into_db():
    try:
        stats = init_database()
        return {"status": "ok", "ingested": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

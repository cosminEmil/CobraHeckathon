from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

try:
    from .schemas import MatchStatsInput, AnomalyInput, DiagnosticResponse, AnomalyResponse
    from .ml_engine import get_ml_engine
    from .llm_coach import generate_tactical_advice
except ImportError:
    from schemas import MatchStatsInput, AnomalyInput, DiagnosticResponse, AnomalyResponse
    from ml_engine import get_ml_engine
    from llm_coach import generate_tactical_advice

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
    # Keep UI endpoints populated even after backend restarts.
    try:
        from .data_service import init_database
    except ImportError:
        from data_service import init_database

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
            tactical_advice=tactical_advice,
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


# ─── Date / SQLite endpoints ──────────────────────────────────────────────────


@app.get("/api/v1/matches/ucluj")
def get_ucluj_matches():
    """Returnează toate meciurile Universității Cluj din baza de date."""
    try:
        from .data_service import load_ucluj_matches
    except ImportError:
        from data_service import load_ucluj_matches

    try:
        matches = load_ucluj_matches()
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/players/overall-insights")
def get_overall_player_insights():
    """Returnează statisticile agregate ale jucătorilor Universității Cluj."""
    try:
        from .data_service import get_player_insights
    except ImportError:
        from data_service import get_player_insights

    try:
        insights = get_player_insights()
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/matches/{match_id}/insights")
def get_match_insights(match_id: str):
    """Returnează punctele forte/slabe ale echipei într-un meci specific."""
    try:
        from .data_service import get_match_insights
    except ImportError:
        from data_service import get_match_insights

    try:
        insights = get_match_insights(match_id)
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/matches/{match_id}/players")
def get_match_players(match_id: str):
    """Returnează statisticile jucătorilor Universității Cluj dintr-un meci."""
    try:
        from .data_service import get_match_player_stats
    except ImportError:
        from data_service import get_match_player_stats

    try:
        players = get_match_player_stats(match_id)
        return {"players": players}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/matches/{match_id}/model-stats")
def get_match_model_stats(match_id: str):
    """Returnează statisticile unui meci formatate pentru modelul ML."""
    try:
        from .data_service import get_match_stats_for_model
    except ImportError:
        from data_service import get_match_stats_for_model

    try:
        stats = get_match_stats_for_model(match_id)
        if not stats:
            raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found")
        return stats
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/db/init")
def init_db():
    """Inițializează/re-populează baza de date SQLite din fișierele JSON."""
    try:
        from .data_service import init_database
    except ImportError:
        from data_service import init_database

    try:
        result = init_database()
        return {
            "status": "ok",
            "matches_inserted": result["matches"],
            "player_stats_inserted": result["player_stats"],
            "ucluj_team_id": result["ucluj_team_id"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

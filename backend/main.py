import os
import shutil
import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    from .schemas import MatchStatsInput, AnomalyInput, DiagnosticResponse, AnomalyResponse
    from .ml_engine import get_ml_engine
    from .llm_coach import generate_tactical_advice, generate_match_summary
    from .data_service import (
        get_match_insights as load_match_insights,
        get_match_player_stats,
        get_match_stats_for_model,
        get_player_insights,
        init_database,
        load_ucluj_matches,
    )
    from .ai_gps.alerts import detect_physical_alerts, detect_tactical_alerts
    from .ai_gps.coach_filter import fallback_coach_feed, filter_with_gemini
    from .ai_gps.features import PlayerWindow, build_player_windows
    from .ai_gps.metrica import read_events_csv, read_tracking_csv
    from .ai_gps.model_inference import predict_features, predictions_to_alerts
except ImportError:
    from schemas import MatchStatsInput, AnomalyInput, DiagnosticResponse, AnomalyResponse
    from ml_engine import get_ml_engine
    from llm_coach import generate_tactical_advice, generate_match_summary
    from data_service import (
        get_match_insights as load_match_insights,
        get_match_player_stats,
        get_match_stats_for_model,
        get_player_insights,
        init_database,
        load_ucluj_matches,
    )
    from ai_gps.alerts import detect_physical_alerts, detect_tactical_alerts
    from ai_gps.coach_filter import fallback_coach_feed, filter_with_gemini
    from ai_gps.features import PlayerWindow, build_player_windows
    from ai_gps.metrica import read_events_csv, read_tracking_csv
    from ai_gps.model_inference import predict_features, predictions_to_alerts


app = FastAPI(title="Rețeta Victoriei API")

BASE_DIR = Path(__file__).resolve().parent
GPS_MODEL_PATH = Path(os.getenv("GPS_MODEL_PATH", BASE_DIR / "models" / "fatigue_model.joblib"))

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
        tactical_advice = "Nu au fost detectate slăbiciuni majore. Mențineți structura și ritmul actual."
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
        # Map incoming stats to the names expected by the model (total_ prefix)
        mapped_players = []
        for p in input_data.players:
            mapped_p = {}
            for key, value in p.items():
                if key == "playerId":
                    mapped_p[key] = value
                    continue
                # Map 'goals' to 'total_goals', etc.
                mapped_p[f"total_{key}"] = value
                # Also keep the original just in case
                mapped_p[key] = value
            mapped_players.append(mapped_p)
            
        results = engine.detect_anomalies(mapped_players)
        return AnomalyResponse(anomalies=results)
    except Exception as e:
        print(f"Anomaly Detection Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "gps_model_exists": GPS_MODEL_PATH.exists(),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")),
    }


@app.get("/api/v1/matches/ucluj")
def list_ucluj_matches():
    try:
        return {"matches": load_ucluj_matches()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/players/overall-insights")
def player_overall_insights():
    try:
        return get_player_insights()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/matches/ucluj/{match_id}/players")
@app.get("/api/v1/matches/{match_id}/players")
def list_match_players(match_id: str):
    try:
        return {"players": get_match_player_stats(match_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/matches/ucluj/{match_id}/insights")
@app.get("/api/v1/matches/{match_id}/insights")
def match_insights(match_id: str):
    try:
        insights = load_match_insights(match_id)
        
        # 1. Add AI Summary (Gemini)
        if insights.get("top_strengths") or insights.get("top_weaknesses"):
            insights["ai_summary"] = generate_match_summary(
                insights["top_strengths"], 
                insights["top_weaknesses"]
            )
            
        # 2. Add AI Win Probability (Random Forest)
        try:
            # Use absolute import to avoid issues with uvicorn reload
            try:
                from data_service import get_match_stats_for_model
            except ImportError:
                from .data_service import get_match_stats_for_model
                
            ai_stats = get_match_stats_for_model(match_id)
            if ai_stats:
                engine = get_ml_engine()
                win_prob, _, _ = engine.analyze_match(ai_stats)
                insights["ai_win_probability"] = win_prob
        except Exception as ai_err:
            print(f"AI Prediction Error: {ai_err}")
            # Don't fail the whole request if AI fails
            insights["ai_win_probability"] = 0.5 
            
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/matches/{match_id}/model-stats")
def match_model_stats(match_id: str):
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


@app.post("/api/v1/gps/analyze")
async def analyze_gps_match(
    tracking_home: UploadFile = File(...),
    tracking_away: UploadFile = File(...),
    events: UploadFile = File(...),
    team: str = Form("Home"),
    report_time: float = Form(2700.0),
    max_alerts: int = Form(3),
    use_gemini: bool = Form(True),
) -> dict[str, Any]:
    if team not in {"Home", "Away"}:
        raise HTTPException(status_code=400, detail="team must be 'Home' or 'Away'")
    if report_time <= 0:
        raise HTTPException(status_code=400, detail="report_time must be positive")
    if max_alerts < 1 or max_alerts > 10:
        raise HTTPException(status_code=400, detail="max_alerts must be between 1 and 10")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        paths = {
            "home": tmp / "tracking_home.csv",
            "away": tmp / "tracking_away.csv",
            "events": tmp / "events.csv",
        }
        await _save_upload(tracking_home, paths["home"])
        await _save_upload(tracking_away, paths["away"])
        await _save_upload(events, paths["events"])

        try:
            return _run_gps_analysis(
                paths=paths,
                team=team,
                report_time=report_time,
                max_alerts=max_alerts,
                use_gemini=use_gemini,
            )
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not analyze uploaded GPS files: {exc}") from exc


async def _save_upload(upload: UploadFile, destination: Path) -> None:
    with destination.open("wb") as handle:
        shutil.copyfileobj(upload.file, handle)
    await upload.close()


def _run_gps_analysis(
    paths: dict[str, Path],
    team: str,
    report_time: float,
    max_alerts: int,
    use_gemini: bool,
) -> dict[str, Any]:
    team_key = team.lower()
    opponent_team = "Away" if team == "Home" else "Home"
    opponent_key = opponent_team.lower()

    event_rows = read_events_csv(paths["events"])
    tracking = read_tracking_csv(paths[team_key], team)
    opponent_tracking = read_tracking_csv(paths[opponent_key], opponent_team)
    windows = build_player_windows(tracking, until_s=report_time)

    physical_alerts = [
        asdict(alert)
        for alert in detect_physical_alerts(windows, report_time, max_alerts=8)
    ]
    tactical_alerts = [
        asdict(alert)
        for alert in detect_tactical_alerts(event_rows, opponent_tracking, team, report_time)
    ]
    model_predictions = _predict_latest_gps_windows(windows, report_time)
    model_alerts = predictions_to_alerts(model_predictions, min_confidence=0.55)

    raw_alerts = [*model_alerts, *physical_alerts, *tactical_alerts]
    payload = {
        "match_minute": int(report_time // 60),
        "team": team,
        "max_alerts": max_alerts,
        "model_predictions": [prediction.__dict__ for prediction in model_predictions],
        "raw_alerts": raw_alerts,
    }
    coach_feed = (
        filter_with_gemini(payload, max_alerts=max_alerts)
        if use_gemini
        else fallback_coach_feed(raw_alerts, max_alerts=max_alerts)
    )

    return {
        "team": team,
        "report_time": report_time,
        "minute": int(report_time // 60),
        "counts": {
            "model_predictions": len(model_predictions),
            "raw_alerts": len(raw_alerts),
            "coach_alerts": len(coach_feed.get("coach_alerts", [])),
        },
        "model_predictions": [prediction.__dict__ for prediction in model_predictions],
        "raw_alerts": raw_alerts,
        "coach_feed": coach_feed,
    }


def _predict_latest_gps_windows(windows: list[PlayerWindow], report_time: float):
    if not GPS_MODEL_PATH.exists():
        return []

    latest_by_player: dict[str, PlayerWindow] = {}
    for window in sorted(windows, key=lambda item: item.end_s):
        if window.end_s <= report_time:
            latest_by_player[window.player] = window

    rows = []
    for window in latest_by_player.values():
        rows.append(
            {
                "team": window.team,
                "player": window.player,
                "minute": window.minute,
                "distance_per_min": window.distance_per_min,
                "hsr_per_min": window.hsr_per_min,
                "sprint_m": window.sprint_m,
                "max_speed_mps": window.max_speed_mps,
                "accel_load": window.accel_load,
                "hard_decelerations": window.hard_decelerations,
                "availability": window.availability,
            }
        )

    if not rows:
        return []
    return predict_features(pd.DataFrame(rows), model_path=GPS_MODEL_PATH)

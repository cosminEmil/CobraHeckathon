from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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

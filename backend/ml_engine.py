import os
import joblib
import pandas as pd
import shap

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

class MLEngine:
    def __init__(self):
        print("Loading ML models from:", MODELS_DIR)
        self.winning_model = joblib.load(os.path.join(MODELS_DIR, "u_cluj_winning_model.pkl"))
        self.anomaly_model = joblib.load(os.path.join(MODELS_DIR, "u_cluj_anomaly_model.pkl"))
        self.anomaly_features = joblib.load(os.path.join(MODELS_DIR, "u_cluj_anomaly_features.pkl"))
        
        self.explainer = shap.TreeExplainer(self.winning_model)
        print("Models loaded successfully.")

    def analyze_match(self, stats_dict: dict):
        df = pd.DataFrame([stats_dict])
        
        if hasattr(self.winning_model, 'feature_names_in_'):
            expected_features = self.winning_model.feature_names_in_
            inference_df = pd.DataFrame(index=df.index, columns=expected_features)
            for col in expected_features:
                inference_df[col] = df[col] if col in df.columns else 0
            inference_df.fillna(0, inplace=True)
            df = inference_df
            
        proba = self.winning_model.predict_proba(df)[0]
        win_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])
        
        shap_values = self.explainer.shap_values(df)
        
        # Explainer output shape differs between library versions.
        if isinstance(shap_values, list):
            class_1_shap = shap_values[1][0]
        elif len(shap_values.shape) == 3:
            class_1_shap = shap_values[0, :, 1]
        else:
            class_1_shap = shap_values[0]

        feature_names = df.columns
        impacts = list(zip(feature_names, class_1_shap))
        
        impacts_sorted = sorted(impacts, key=lambda x: x[1], reverse=True)
        
        top_strengths = [{"feature": f, "impact": float(v)} for f, v in impacts_sorted[:3] if v > 0]
        
        top_weaknesses_raw = sorted([x for x in impacts_sorted if x[1] < 0], key=lambda x: x[1]) 
        top_weaknesses = [{"feature": f, "impact": float(v)} for f, v in top_weaknesses_raw[:3]]
        
        return win_prob, top_strengths, top_weaknesses

    def detect_anomalies(self, players_list: list):
        if not players_list:
            return []
            
        df = pd.DataFrame(players_list)
        player_ids = df.get('PlayerId', df.get('playerId', range(len(df))))
        
        # Align with the expected features
        inference_df = pd.DataFrame(index=df.index, columns=self.anomaly_features)
        for col in self.anomaly_features:
            inference_df[col] = df[col] if col in df.columns else 0

        inference_df.fillna(0, inplace=True)
        
        preds = self.anomaly_model.predict(inference_df)
        
        results = [{"playerId": str(pid), "is_anomaly": bool(pred == -1)} for pid, pred in zip(player_ids, preds)]
        return results

ml_engine_instance = None

def get_ml_engine():
    global ml_engine_instance
    if ml_engine_instance is None:
        ml_engine_instance = MLEngine()
    return ml_engine_instance

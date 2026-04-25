import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

# The client will automatically pick up the GEMINI_API_KEY from the environment or .env file
try:
    client = genai.Client()
except Exception as e:
    client = None

def generate_tactical_advice(weakness_feature: str, impact_score: float) -> str:
    if not client:
        return "Could not initialize Gemini. Please ensure you have added your GEMINI_API_KEY to a .env file."
        
    prompt = f"""You are an elite tactical coaching AI for the football team Universitatea Cluj (U Cluj). 
Our Machine Learning architecture just generated diagnostics for their latest match.
The model identified that their biggest mathematical weakness in this match was '{weakness_feature}' (which had a negative mathematical impact score of {impact_score:.4f} on our chances of winning).
Based on this metric, please provide exactly 2 sentences of tactical advice on how the team can improve this specific weakness in the next match. Do not include any filler text.
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        return f"Gemini API Error: {str(e)}"

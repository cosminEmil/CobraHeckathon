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
        return "Gemini nu a putut fi inițializat. Verifică dacă GEMINI_API_KEY este setată în fișierul .env."
        
    prompt = f"""Ești un antrenor secund de elită pentru echipa de fotbal Universitatea Cluj.
Arhitectura noastră de machine learning a generat diagnostice pentru ultimul meci.
Modelul a identificat că cea mai mare slăbiciune matematică din acest meci a fost „{weakness_feature}”, cu impact negativ {impact_score:.4f} asupra șanselor de victorie.
Pe baza acestei metrici, oferă exact 2 propoziții de sfat tactic concret pentru îmbunătățirea acestei slăbiciuni în următorul meci.
Răspunde exclusiv în limba română, fără text introductiv și fără explicații extra.
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        return f"Eroare API Gemini: {str(e)}"

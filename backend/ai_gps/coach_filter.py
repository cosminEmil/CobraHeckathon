from __future__ import annotations

import json
import os
import re
from typing import Any


SEVERITY_RANK = {"ridicat": 0, "high": 0, "mediu": 1, "medium": 1, "scazut": 2, "low": 2}

COACH_PERSONAS = [
    {
        "tone": "optimist",
        "coach": "Mihai",
        "personality": "calm, constructiv, caută oportunități și păstrează încrederea echipei",
    },
    {
        "tone": "mixt",
        "coach": "Andrei",
        "personality": "echilibrat, pragmatic, combină riscurile cu soluții imediate",
    },
    {
        "tone": "pesimist",
        "coach": "Sorin",
        "personality": "precaut, defensiv, anticipează cel mai rău scenariu și cere măsuri rapide",
    },
]


def fallback_coach_feed(raw_alerts: list[dict[str, Any]], max_alerts: int = 3) -> dict[str, Any]:
    sorted_alerts = sorted(
        raw_alerts,
        key=lambda alert: (
            SEVERITY_RANK.get(str(alert.get("severity", "")).lower(), 3),
            -float(alert.get("fatigue_score", 0.0) or 0.0),
            int(alert.get("minute", 0) or 0),
        ),
    )
    coach_alerts = []
    for priority, alert in enumerate(sorted_alerts[:max_alerts], start=1):
        coach_alerts.append(
            {
                "priority": priority,
                "minute": alert.get("minute"),
                "category": alert.get("category"),
                "severity": alert.get("severity"),
                "player": alert.get("player"),
                "message": alert.get("title") or alert.get("message"),
                "evidence": alert.get("evidence"),
                "suggestion": alert.get("suggestion"),
            }
        )

    return {
        "source": "fallback",
        "coach_alerts": coach_alerts,
        "coach_views": _build_fallback_coach_views(coach_alerts),
        "summary": "Cele mai importante alerte au fost selectate automat dupa severitate si scor.",
    }


def filter_with_gemini(payload: dict[str, Any], max_alerts: int = 3) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return fallback_coach_feed(payload.get("raw_alerts", []), max_alerts=max_alerts)

    try:
        from google import genai
    except ImportError:
        return fallback_coach_feed(payload.get("raw_alerts", []), max_alerts=max_alerts)

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    prompt = _build_prompt(payload, max_alerts=max_alerts)
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=model, contents=prompt)
    except Exception:
        parsed = fallback_coach_feed(payload.get("raw_alerts", []), max_alerts=max_alerts)
        parsed["source"] = "fallback_after_gemini_error"
        return parsed

    text = getattr(response, "text", "") or ""

    try:
        parsed = _parse_json_response(text)
    except ValueError:
        parsed = fallback_coach_feed(payload.get("raw_alerts", []), max_alerts=max_alerts)
        parsed["source"] = "fallback_after_gemini_parse_error"
        return parsed

    parsed["source"] = "gemini"
    if "coach_views" not in parsed:
        parsed["coach_views"] = _build_fallback_coach_views(parsed.get("coach_alerts", []))
    if "coach_alerts" not in parsed:
        parsed["coach_alerts"] = _flatten_coach_views(parsed.get("coach_views", []), max_alerts=max_alerts)
    return parsed


def _build_prompt(payload: dict[str, Any], max_alerts: int) -> str:
    return f"""
Ești un sistem AI de suport pentru banca tehnică a unei echipe de fotbal.

Primești predicții compacte ale modelului și alerte fizice/tactice brute.
Trebuie să construiești trei perspective de antrenor secund:
1. optimist: constructiv, caută oportunități și formulează soluții încurajatoare;
2. mixt: echilibrat, pragmatic, arată și riscul și acțiunea recomandată;
3. pesimist: precaut, defensiv, evidențiază riscul maxim și cere intervenție rapidă.

Pentru fiecare perspectivă selectează maximum {max_alerts} alerte.
Prioritizează alertele urgente, acționabile și susținute de date.
Comasează alertele duplicate despre același jucător sau aceeași zonă tactică.
Nu inventa date, valori, jucători sau minute.
Răspunde exclusiv în limba română.
Returnează doar JSON valid, fără Markdown.

Forma JSON obligatorie:
{{
  "coach_views": [
    {{
      "tone": "optimist",
      "coach": "Mihai",
      "personality": "calm, constructiv, caută oportunități",
      "alerts": [
        {{
          "priority": 1,
          "minute": 45,
          "category": "physical|tactical",
          "severity": "ridicat|mediu|scazut",
          "player": "Player8 sau null",
          "message": "mesaj scurt pentru antrenor",
          "evidence": "dovadă scurtă susținută de date",
          "suggestion": "acțiune specifică"
        }}
      ]
    }},
    {{
      "tone": "mixt",
      "coach": "Andrei",
      "personality": "echilibrat, pragmatic",
      "alerts": []
    }},
    {{
      "tone": "pesimist",
      "coach": "Sorin",
      "personality": "precaut, defensiv, orientat pe risc",
      "alerts": []
    }}
  ],
  "coach_alerts": [
    {{
      "priority": 1,
      "minute": 45,
      "category": "physical|tactical",
      "severity": "ridicat|mediu|scazut",
      "player": "Player8 sau null",
      "message": "mesaj scurt pentru antrenor",
      "evidence": "dovadă scurtă susținută de date",
      "suggestion": "acțiune specifică"
    }}
  ],
  "summary": "rezumat live scurt în română"
}}

JSON de intrare:
{json.dumps(payload, ensure_ascii=False)}
""".strip()


def _build_fallback_coach_views(alerts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    variants = []
    prefixes = {
        "optimist": "Oportunitate",
        "mixt": "Observație",
        "pesimist": "Risc",
    }
    for persona in COACH_PERSONAS:
        tone = persona["tone"]
        tone_alerts = []
        for alert in alerts:
            copied = dict(alert)
            copied["message"] = f"{prefixes[tone]}: {copied.get('message') or 'alertă importantă'}"
            if tone == "optimist":
                copied["suggestion"] = copied.get("suggestion") or "Folosiți momentul pentru a ajusta rolul fără panică."
            elif tone == "pesimist":
                copied["suggestion"] = copied.get("suggestion") or "Pregătiți imediat o soluție de rezervă dacă riscul crește."
            tone_alerts.append(copied)
        variants.append({**persona, "alerts": tone_alerts})
    return variants


def _flatten_coach_views(views: list[dict[str, Any]], max_alerts: int) -> list[dict[str, Any]]:
    for view in views:
        alerts = view.get("alerts")
        if isinstance(alerts, list) and alerts:
            return alerts[:max_alerts]
    return []


def _parse_json_response(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Gemini response did not contain a JSON object")
    return json.loads(cleaned[start : end + 1])

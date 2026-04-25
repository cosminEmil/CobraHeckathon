from __future__ import annotations

import json
import os
import re
from typing import Any


SEVERITY_RANK = {"ridicat": 0, "high": 0, "mediu": 1, "medium": 1, "scazut": 2, "low": 2}


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
    return parsed


def _build_prompt(payload: dict[str, Any], max_alerts: int) -> str:
    return f"""
You are an assistant coach AI for a football team.

You receive compact model predictions and raw physical/tactical alerts.
Select maximum {max_alerts} alerts for the coach.
Prioritize urgent, actionable, data-supported alerts.
Merge duplicate alerts about the same player or tactical zone.
Do not invent data.
Return only valid JSON, with no Markdown.

Required JSON shape:
{{
  "coach_alerts": [
    {{
      "priority": 1,
      "minute": 45,
      "category": "physical|tactical",
      "severity": "ridicat|mediu|scazut",
      "player": "Player8 or null",
      "message": "short coach-facing message",
      "evidence": "short data-backed evidence",
      "suggestion": "specific action"
    }}
  ],
  "summary": "one short halftime/live summary"
}}

Input JSON:
{json.dumps(payload, ensure_ascii=False)}
""".strip()


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

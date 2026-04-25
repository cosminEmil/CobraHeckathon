from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass

from .features import PlayerWindow, latest_windows_by_player, player_baselines
from .metrica import Event, PITCH_LENGTH_M, PITCH_WIDTH_M, TrackingData


@dataclass(frozen=True)
class Alert:
    minute: int
    category: str
    severity: str
    title: str
    evidence: str
    suggestion: str


def detect_physical_alerts(
    windows: list[PlayerWindow],
    report_time_s: float,
    max_alerts: int = 8,
) -> list[Alert]:
    baselines = player_baselines(windows, before_s=max(report_time_s - 300.0, 0.0))
    latest = latest_windows_by_player(windows, at_s=report_time_s)
    alerts: list[tuple[float, Alert]] = []

    for player, current in latest.items():
        if current.availability < 0.65 or current.end_s < 900.0:
            continue
        baseline = baselines.get(player, {})
        base_hsr = baseline.get("hsr_per_min", 0.0)
        base_distance = baseline.get("distance_per_min", 0.0)
        if base_hsr >= 8.0 and current.hsr_per_min < base_hsr * 0.45:
            drop = 100.0 * (1.0 - current.hsr_per_min / base_hsr)
            score = drop + max(0.0, current.accel_load - baseline.get("accel_load", 0.0)) * 0.08
            severity = "ridicat" if drop >= 70.0 else "mediu"
            alerts.append(
                (
                    score,
                    Alert(
                        minute=current.minute,
                        category="fizic",
                        severity=severity,
                        title=f"{player}: scadere brusca de HSR",
                        evidence=(
                            f"HSR recent {current.hsr_per_min:.1f} m/min vs baseline "
                            f"{base_hsr:.1f} m/min (-{drop:.0f}%). Distanta totala "
                            f"{current.distance_per_min:.1f} m/min."
                        ),
                        suggestion=(
                            "Verificati verbal jucatorul si pregatiti inlocuire la pauza "
                            "daca scaderea continua in urmatoarele 3-5 minute."
                        ),
                    ),
                )
            )
        elif base_distance >= 65.0 and current.distance_per_min < base_distance * 0.62:
            drop = 100.0 * (1.0 - current.distance_per_min / base_distance)
            alerts.append(
                (
                    drop,
                    Alert(
                        minute=current.minute,
                        category="fizic",
                        severity="mediu",
                        title=f"{player}: volum de alergare sub normal",
                        evidence=(
                            f"Distanta recenta {current.distance_per_min:.1f} m/min vs "
                            f"baseline {base_distance:.1f} m/min (-{drop:.0f}%)."
                        ),
                        suggestion="Cereti staffului sa coreleze cu ritm cardiac/RPE si rol tactic.",
                    ),
                )
            )

        if current.hard_decelerations >= 8 and current.max_speed_mps >= 7.0:
            alerts.append(
                (
                    float(current.hard_decelerations),
                    Alert(
                        minute=current.minute,
                        category="fizic",
                        severity="mediu",
                        title=f"{player}: multe franari intense",
                        evidence=(
                            f"{current.hard_decelerations} decelerari >3 m/s2 in ultimele "
                            f"{(current.end_s - current.start_s) / 60:.0f} minute; "
                            f"viteza maxima {current.max_speed_mps:.1f} m/s."
                        ),
                        suggestion=(
                            "Reduceti expunerea la dueluri si sprinturi repetate sau pregatiti "
                            "o schimbare de rol."
                        ),
                    ),
                )
            )

    return [alert for _, alert in sorted(alerts, key=lambda item: item[0], reverse=True)[:max_alerts]]


def _event_y(event: Event) -> float | None:
    return event.end_y if event.end_y is not None else event.start_y


def _event_x(event: Event) -> float | None:
    return event.end_x if event.end_x is not None else event.start_x


def _nearest_opponent_distance(
    tracking: TrackingData,
    time_s: float,
    lane_y_m: float,
    event_x_m: float,
) -> float | None:
    idx = tracking.nearest_index(time_s)
    distances: list[float] = []
    for player in tracking.player_ids:
        point = tracking.positions[player][idx]
        if point is None:
            continue
        x_m, y_m = point
        if abs(x_m - event_x_m) <= 28.0:
            distances.append(math.hypot(x_m - event_x_m, y_m - lane_y_m))
    return min(distances) if distances else None


def detect_tactical_alerts(
    events: list[Event],
    opponent_tracking: TrackingData,
    monitored_team: str,
    report_time_s: float,
) -> list[Alert]:
    opponent_team = "Away" if monitored_team == "Home" else "Home"
    lane_stats = {
        "stang/Y mic": {"count": 0, "open_count": 0, "latest": 0.0, "max_gap": 0.0},
        "drept/Y mare": {"count": 0, "open_count": 0, "latest": 0.0, "max_gap": 0.0},
    }
    transition_count = 0

    for event in events:
        if event.start_time > report_time_s:
            continue
        turnover = event.team == opponent_team and event.type in {"BALL LOST", "CHALLENGE"}
        recovery = event.team == monitored_team and event.type == "RECOVERY"
        if not turnover and not recovery:
            continue
        x_norm = _event_x(event)
        y_norm = _event_y(event)
        if x_norm is None or y_norm is None:
            continue
        transition_count += 1
        if 0.22 < y_norm < 0.78:
            continue

        lane_name = "stang/Y mic" if y_norm <= 0.22 else "drept/Y mare"
        lane_stats[lane_name]["count"] += 1
        lane_stats[lane_name]["latest"] = max(lane_stats[lane_name]["latest"], event.start_time)
        lane_y_m = 0.12 * PITCH_WIDTH_M if y_norm <= 0.22 else 0.88 * PITCH_WIDTH_M
        event_x_m = x_norm * PITCH_LENGTH_M
        nearest = _nearest_opponent_distance(opponent_tracking, event.start_time, lane_y_m, event_x_m)
        if nearest is not None and nearest >= 13.0:
            lane_stats[lane_name]["open_count"] += 1
            lane_stats[lane_name]["max_gap"] = max(lane_stats[lane_name]["max_gap"], nearest)

    alerts: list[Alert] = []
    for lane_name, stats in lane_stats.items():
        if stats["count"] >= 8 or stats["open_count"] >= 3:
            open_text = (
                f"{int(stats['open_count'])} cu distanta mare fata de cel mai apropiat adversar; "
                if stats["open_count"]
                else ""
            )
            gap_text = (
                f"cea mai mare distanta masurata {stats['max_gap']:.1f} m."
                if stats["max_gap"] > 0.0
                else "nu a existat un gap mare masurat, dar frecventa pe culoar este ridicata."
            )
            alerts.append(
                Alert(
                    minute=int(stats["latest"] // 60),
                    category="tactic",
                    severity="mediu" if stats["count"] < 14 else "ridicat",
                    title=f"Spatiu repetat pe flancul {lane_name} la tranzitie",
                    evidence=(
                        f"{int(stats['count'])} tranzitii/pierderi pe culoar; "
                        f"{open_text}{gap_text}"
                    ),
                    suggestion=(
                        "La recuperare, cautati rapid pasa lunga/diagonala in acel culoar; "
                        "extrema trebuie sa plece imediat in spatele fundasului lateral."
                    ),
                )
            )

    if transition_count >= 12:
        alerts.append(
            Alert(
                minute=int(report_time_s // 60),
                category="tactic",
                severity="scazut",
                title="Ritm mare de schimbari de posesie",
                evidence=f"{transition_count} recuperari/pierderi relevante inainte de minutul {int(report_time_s // 60)}.",
                suggestion="Pregatiti mesaj scurt la pauza: prima pasa dupa recuperare trebuie simplificata.",
            )
        )
    return sorted(alerts, key=lambda alert: {"ridicat": 0, "mediu": 1, "scazut": 2}[alert.severity])


def render_text_report(
    game: int,
    team: str,
    report_time_s: float,
    physical_alerts: list[Alert],
    tactical_alerts: list[Alert],
) -> str:
    minute = int(report_time_s // 60)
    lines = [
        f"AI-GPS raport live | Sample Game {game} | echipa monitorizata: {team} | minutul {minute}",
        "",
        "Alerte fizice",
    ]
    if physical_alerts:
        for alert in physical_alerts:
            lines.extend(
                [
                    f"- Min {alert.minute}: [{alert.severity}] {alert.title}",
                    f"  Dovezi: {alert.evidence}",
                    f"  Sugestie: {alert.suggestion}",
                ]
            )
    else:
        lines.append("- Nu exista alerte fizice majore la acest moment.")

    lines.extend(["", "Alerte tactice"])
    if tactical_alerts:
        for alert in tactical_alerts:
            lines.extend(
                [
                    f"- Min {alert.minute}: [{alert.severity}] {alert.title}",
                    f"  Dovezi: {alert.evidence}",
                    f"  Sugestie: {alert.suggestion}",
                ]
            )
    else:
        lines.append("- Nu exista pattern tactic suficient de repetat.")
    return "\n".join(lines)


def render_json_report(
    game: int,
    team: str,
    report_time_s: float,
    physical_alerts: list[Alert],
    tactical_alerts: list[Alert],
) -> str:
    payload = {
        "game": game,
        "team": team,
        "report_time_s": report_time_s,
        "minute": int(report_time_s // 60),
        "alerts": [asdict(alert) for alert in [*physical_alerts, *tactical_alerts]],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)

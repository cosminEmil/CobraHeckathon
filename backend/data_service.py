import collections
import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

TEAM_NAME = "Universitatea Cluj"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = Path(BASE_DIR).resolve()
PROJECT_ROOT = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")

DB_PATH = os.getenv("APP_DB_PATH", str(BACKEND_DIR / "data" / "ucluj.sqlite3"))


def _safe_float(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _is_dataset_dir(path: str) -> bool:
    if not path or not os.path.isdir(path):
        return False
    try:
        files = os.listdir(path)
    except OSError:
        return False
    return "players (1).json" in files and any(file.endswith("_players_stats.json") for file in files)


def _dataset_dir() -> str:
    env_path = os.getenv("DATASET_DIR")
    if env_path:
        env_dataset_dir = str(Path(env_path).expanduser())
        if _is_dataset_dir(env_dataset_dir):
            return env_dataset_dir

    repo_root = PROJECT_ROOT
    uhack_root = repo_root.parent
    candidates = [
        str(repo_root / "Date - meciuri"),
        str(repo_root / "data" / "Date - meciuri"),
        str(uhack_root / "Date - meciuri"),
    ]
    candidates.extend(str(path) for path in repo_root.glob("Date - meciuri*/Date - meciuri"))
    candidates.extend(str(path) for path in uhack_root.glob("Date - meciuri*/Date - meciuri"))

    for candidate in candidates:
        if _is_dataset_dir(candidate):
            return candidate
    return str(repo_root / "data" / "Date - meciuri")


def _connect_db() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _list_match_files(dataset_dir: str) -> List[str]:
    if not os.path.isdir(dataset_dir):
        return []
    return [
        os.path.join(dataset_dir, file_name)
        for file_name in os.listdir(dataset_dir)
        if file_name.endswith("_players_stats.json")
    ]


def _parse_match_filename(file_name: str) -> Optional[Tuple[str, str, str]]:
    base_name = file_name.replace("_players_stats.json", "")
    match = re.match(r"^(.*?) - (.*?), (\d+-\d+)(?:_\d+)?$", base_name)
    if not match:
        return None
    team_a, team_b, score = match.groups()
    return team_a.strip(), team_b.strip(), score.strip()


def _match_slug_from_filename(file_name: str) -> str:
    return os.path.splitext(file_name)[0].replace(" ", "-").replace(",", "").lower()


def _load_players_map(dataset_dir: str) -> Dict[int, Dict[str, str]]:
    players_path = os.path.join(dataset_dir, "players (1).json")
    if not os.path.isfile(players_path):
        return {}
    try:
        with open(players_path, "r", encoding="utf-8") as file:
            payload = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}

    role_map = {"GK": "GK", "DEF": "DEF", "MID": "MID", "FWD": "ATT", "ATT": "ATT", "STR": "ATT"}
    result: Dict[int, Dict[str, str]] = {}
    for player in payload.get("players", []):
        wy_id = player.get("wyId")
        if wy_id is None:
            continue
        code2 = ((player.get("role") or {}).get("code2") or "").upper()
        result[int(wy_id)] = {
            "name": player.get("shortName") or f"Player {wy_id}",
            "pos": role_map.get(code2, "MID"),
            "current_team_id": player.get("currentTeamId"),
        }
    return result


def _infer_ucluj_team_id(files: List[str], players_map: Dict[int, Dict[str, str]]) -> Optional[int]:
    team_counts: Dict[int, int] = collections.Counter()
    for file_path in files:
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                payload = json.load(file)
        except (OSError, json.JSONDecodeError):
            continue
        for player in payload.get("players", []):
            player_id = int(player.get("playerId", 0))
            if player_id <= 0:
                continue
            current_team_id = players_map.get(player_id, {}).get("current_team_id")
            if current_team_id is not None:
                team_counts[int(current_team_id)] += 1
    return team_counts.most_common(1)[0][0] if team_counts else None


def _infer_ucj_players(players: List[Dict[str, object]], players_map: Dict[int, Dict[str, str]], ucluj_team_id: Optional[int]) -> List[Dict[str, object]]:
    if ucluj_team_id is not None:
        filtered = []
        for player in players:
            player_id = int(player.get("playerId", 0))
            if player_id <= 0:
                continue
            player_info = players_map.get(player_id, {})
            if player_info.get("current_team_id") == ucluj_team_id:
                filtered.append(player)
        if filtered:
            return filtered
    return []


def _build_match_ui_payload(file_name: str, ucj_players: List[Dict[str, object]], team_a: str, team_b: str, score: str) -> Dict[str, object]:
    totals = [player.get("total", {}) for player in ucj_players]

    def sum_stats(key: str) -> float:
        return sum(_safe_float(total.get(key)) for total in totals)

    total_passes = sum_stats("passes")
    successful_passes = sum_stats("successfulPasses")
    shots = sum_stats("shots")
    shots_on_target = sum_stats("shotsOnTarget")
    corners = sum_stats("corners")
    fouls = sum_stats("fouls")

    home_is_ucj = team_a == TEAM_NAME
    ucj_goals, opp_goals = score.split("-")
    if not home_is_ucj:
        ucj_goals, opp_goals = opp_goals, ucj_goals
    opponent = team_b if home_is_ucj else team_a

    pass_acc = round((successful_passes / total_passes) * 100, 1) if total_passes > 0 else 0
    return {
        "id": _match_slug_from_filename(file_name),
        "label": f"{opponent} {ucj_goals}-{opp_goals}",
        "opponent": opponent,
        "score": f"{ucj_goals}-{opp_goals}",
        "date": "Din dataset",
        "possession": 0,
        "shots": round(shots),
        "shotsOT": round(shots_on_target),
        "passes": round(total_passes),
        "passAcc": pass_acc,
        "corners": round(corners),
        "fouls": round(fouls),
        "yellowCards": round(sum_stats("yellowCards")),
        "redCards": round(sum_stats("redCards")),
        "distanceCovered": 0,
        "topSpeed": 0,
    }


def init_database() -> Dict[str, int]:
    dataset_dir = _dataset_dir()
    players_map = _load_players_map(dataset_dir)

    ucluj_files = []
    for file_path in _list_match_files(dataset_dir):
        parsed = _parse_match_filename(os.path.basename(file_path))
        if parsed and TEAM_NAME in parsed[:2]:
            ucluj_files.append(file_path)
    ucluj_team_id = _infer_ucluj_team_id(ucluj_files, players_map)

    conn = _connect_db()
    cur = conn.cursor()
    cur.executescript(
        """
        DROP TABLE IF EXISTS player_match_stats;
        DROP TABLE IF EXISTS matches;
        DROP TABLE IF EXISTS players;

        CREATE TABLE IF NOT EXISTS players (
            player_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            pos TEXT NOT NULL DEFAULT 'MID'
        );

        CREATE TABLE IF NOT EXISTS matches (
            id TEXT PRIMARY KEY,
            source_file TEXT NOT NULL,
            team_a TEXT NOT NULL,
            team_b TEXT NOT NULL,
            opponent TEXT NOT NULL,
            score TEXT NOT NULL,
            date TEXT NOT NULL,
            label TEXT NOT NULL,
            possession REAL NOT NULL,
            shots INTEGER NOT NULL,
            shots_ot INTEGER NOT NULL,
            passes INTEGER NOT NULL,
            pass_acc REAL NOT NULL,
            corners INTEGER NOT NULL,
            fouls INTEGER NOT NULL,
            yellow_cards INTEGER NOT NULL,
            red_cards INTEGER NOT NULL,
            distance_covered REAL NOT NULL,
            top_speed REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS player_match_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id TEXT NOT NULL,
            player_id INTEGER NOT NULL,
            is_ucluj_player INTEGER NOT NULL DEFAULT 0,
            goals REAL NOT NULL DEFAULT 0,
            assists REAL NOT NULL DEFAULT 0,
            passes REAL NOT NULL DEFAULT 0,
            successful_passes REAL NOT NULL DEFAULT 0,
            duels REAL NOT NULL DEFAULT 0,
            duels_won REAL NOT NULL DEFAULT 0,
            dangerous_own_half_losses REAL NOT NULL DEFAULT 0,
            losses REAL NOT NULL DEFAULT 0,
            fouls REAL NOT NULL DEFAULT 0,
            yellow_cards REAL NOT NULL DEFAULT 0,
            red_cards REAL NOT NULL DEFAULT 0,
            shots REAL NOT NULL DEFAULT 0,
            shots_on_target REAL NOT NULL DEFAULT 0,
            passes_final_third REAL NOT NULL DEFAULT 0,
            minutes_on_field REAL NOT NULL DEFAULT 0,
            FOREIGN KEY(match_id) REFERENCES matches(id),
            FOREIGN KEY(player_id) REFERENCES players(player_id)
        );

        CREATE INDEX IF NOT EXISTS idx_player_match_stats_match ON player_match_stats(match_id);
        CREATE INDEX IF NOT EXISTS idx_player_match_stats_player ON player_match_stats(player_id);
        """
    )

    for player_id, info in players_map.items():
        cur.execute(
            "INSERT INTO players (player_id, name, pos) VALUES (?, ?, ?)",
            (player_id, info["name"], info["pos"]),
        )

    matches_inserted = 0
    stats_inserted = 0
    for file_path in ucluj_files:
        file_name = os.path.basename(file_path)
        parsed = _parse_match_filename(file_name)
        if not parsed:
            continue
        team_a, team_b, score = parsed
        if TEAM_NAME not in (team_a, team_b):
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                payload = json.load(file)
        except (OSError, json.JSONDecodeError):
            continue

        players = payload.get("players", [])
        if not players:
            continue
        ucj_players = _infer_ucj_players(players, players_map, ucluj_team_id)
        if not ucj_players:
            continue
        ucj_ids = {int(player.get("playerId", 0)) for player in ucj_players}
        match_payload = _build_match_ui_payload(file_name, ucj_players, team_a, team_b, score)
        match_id = match_payload["id"]

        cur.execute(
            """
            INSERT INTO matches (
                id, source_file, team_a, team_b, opponent, score, date, label,
                possession, shots, shots_ot, passes, pass_acc, corners, fouls,
                yellow_cards, red_cards, distance_covered, top_speed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                match_id,
                file_name,
                team_a,
                team_b,
                match_payload["opponent"],
                match_payload["score"],
                match_payload["date"],
                match_payload["label"],
                match_payload["possession"],
                match_payload["shots"],
                match_payload["shotsOT"],
                match_payload["passes"],
                match_payload["passAcc"],
                match_payload["corners"],
                match_payload["fouls"],
                match_payload["yellowCards"],
                match_payload["redCards"],
                match_payload["distanceCovered"],
                match_payload["topSpeed"],
            ),
        )
        matches_inserted += 1

        for player in players:
            player_id = int(player.get("playerId", 0))
            if player_id <= 0:
                continue
            if player_id not in players_map:
                cur.execute(
                    "INSERT OR IGNORE INTO players (player_id, name, pos) VALUES (?, ?, ?)",
                    (player_id, f"Player {player_id}", "MID"),
                )
            total = player.get("total", {})
            cur.execute(
                """
                INSERT INTO player_match_stats (
                    match_id, player_id, is_ucluj_player, goals, assists, passes,
                    successful_passes, duels, duels_won, dangerous_own_half_losses,
                    losses, fouls, yellow_cards, red_cards, shots, shots_on_target, passes_final_third, minutes_on_field
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    match_id,
                    player_id,
                    1 if player_id in ucj_ids else 0,
                    _safe_float(total.get("goals")),
                    _safe_float(total.get("assists")),
                    _safe_float(total.get("passes")),
                    _safe_float(total.get("successfulPasses")),
                    _safe_float(total.get("duels")),
                    _safe_float(total.get("duelsWon")),
                    _safe_float(total.get("dangerousOwnHalfLosses")),
                    _safe_float(total.get("losses")),
                    _safe_float(total.get("fouls")),
                    _safe_float(total.get("yellowCards")),
                    _safe_float(total.get("redCards")),
                    _safe_float(total.get("shots")),
                    _safe_float(total.get("shotsOnTarget")),
                    _safe_float(total.get("successfulPassesToFinalThird")),
                    _safe_float(total.get("minutesOnField")),
                ),
            )
            stats_inserted += 1

    conn.commit()
    conn.close()
    return {"matches": matches_inserted, "player_stats": stats_inserted, "ucluj_team_id": int(ucluj_team_id or 0)}


def load_ucluj_matches() -> List[Dict[str, object]]:
    conn = _connect_db()
    rows = conn.execute(
        """
        SELECT id, label, opponent, score, date, shots, shots_ot, passes,
               pass_acc, corners, fouls, yellow_cards, red_cards
        FROM matches
        ORDER BY id DESC
        """
    ).fetchall()
    conn.close()
    return [
        {
            "id": row["id"],
            "label": row["label"],
            "opponent": row["opponent"],
            "score": row["score"],
            "date": row["date"],
            "shots": row["shots"],
            "shotsOT": row["shots_ot"],
            "passes": row["passes"],
            "passAcc": row["pass_acc"],
            "corners": row["corners"],
            "fouls": row["fouls"],
            "yellowCards": row["yellow_cards"],
            "redCards": row["red_cards"],
        }
        for row in rows
    ]


def _strength_score(row: sqlite3.Row) -> float:
    passes = _safe_float(row["passes"])
    successful_passes = _safe_float(row["successful_passes"])
    duels = _safe_float(row["duels"])
    pass_acc = successful_passes / passes if passes > 0 else 0
    duel_eff = _safe_float(row["duels_won"]) / duels if duels > 0 else 0
    return (
        _safe_float(row["goals"]) * 10
        + _safe_float(row["assists"]) * 8
        + successful_passes * 0.07
        + pass_acc * 40
        + duel_eff * 25
        - _safe_float(row["losses"]) * 0.15
    )


def _weakness_score(row: sqlite3.Row) -> float:
    pass_miss = max(_safe_float(row["passes"]) - _safe_float(row["successful_passes"]), 0)
    return (
        _safe_float(row["dangerous_own_half_losses"]) * 3
        + _safe_float(row["losses"]) * 0.6
        + pass_miss * 0.08
        + _safe_float(row["fouls"]) * 0.5
        + _safe_float(row["yellow_cards"]) * 1.8
        + _safe_float(row["red_cards"]) * 4
    )


def get_player_insights() -> Dict[str, object]:
    conn = _connect_db()
    rows = conn.execute(
        """
        SELECT p.player_id, p.name, p.pos,
               COUNT(s.id) AS matches,
               SUM(s.goals) AS goals,
               SUM(s.assists) AS assists,
               SUM(s.passes) AS passes,
               SUM(s.successful_passes) AS successful_passes,
               SUM(s.duels) AS duels,
               SUM(s.duels_won) AS duels_won,
               SUM(s.dangerous_own_half_losses) AS dangerous_own_half_losses,
               SUM(s.losses) AS losses,
               SUM(s.fouls) AS fouls,
               SUM(s.yellow_cards) AS yellow_cards,
               SUM(s.red_cards) AS red_cards
        FROM player_match_stats s
        JOIN players p ON p.player_id = s.player_id
        WHERE s.is_ucluj_player = 1
        GROUP BY p.player_id, p.name, p.pos
        """
    ).fetchall()
    conn.close()

    if not rows:
        return {"squad": [], "top_strengths": [], "top_weaknesses": []}

    by_strength = sorted(rows, key=_strength_score, reverse=True)
    by_weakness = sorted(rows, key=_weakness_score, reverse=True)

    squad = [
        {
            "id": row["player_id"],
            "number": index + 1,
            "name": row["name"],
            "pos": row["pos"],
            "age": 0,
            "goals": round(_safe_float(row["goals"])),
            "assists": round(_safe_float(row["assists"])),
            "passes": round(_safe_float(row["passes"])),
            "matches": max(int(_safe_float(row["matches"])), 1),
        }
        for index, row in enumerate(by_strength[:24])
    ]

    top_strengths = [
        {"feature": f"{row['name']} - aport ofensiv si constructie", "impact": round(_strength_score(row), 3)}
        for row in by_strength[:3]
    ]
    top_weaknesses = [
        {"feature": f"{row['name']} - pierderi/risc defensiv", "impact": round(-_weakness_score(row), 3)}
        for row in by_weakness[:3]
    ]
    return {"squad": squad, "top_strengths": top_strengths, "top_weaknesses": top_weaknesses}


def get_match_insights(match_id: str) -> Dict[str, List[Dict[str, object]]]:
    conn = _connect_db()
    rows = conn.execute(
        """
        SELECT p.name,
               s.goals, s.assists, s.passes, s.successful_passes,
               s.duels, s.duels_won, s.dangerous_own_half_losses,
               s.losses, s.fouls, s.yellow_cards, s.red_cards,
               s.shots, s.shots_on_target, s.passes_final_third
        FROM player_match_stats s
        JOIN players p ON p.player_id = s.player_id
        WHERE s.match_id = ? AND s.is_ucluj_player = 1
        """,
        (match_id,),
    ).fetchall()
    conn.close()

    if not rows:
        return {"top_strengths": [], "top_weaknesses": []}

    strengths: List[Dict[str, object]] = []
    weaknesses: List[Dict[str, object]] = []

    for row in rows:
        name = row["name"]
        goals = _safe_float(row["goals"])
        assists = _safe_float(row["assists"])
        shots_ot = _safe_float(row["shots_on_target"])
        passes = _safe_float(row["passes"])
        successful_passes = _safe_float(row["successful_passes"])
        passes_final_third = _safe_float(row["passes_final_third"])
        duels = _safe_float(row["duels"])
        duels_won = _safe_float(row["duels_won"])
        losses = _safe_float(row["losses"])
        dangerous_losses = _safe_float(row["dangerous_own_half_losses"])
        fouls = _safe_float(row["fouls"])
        yellow_cards = _safe_float(row["yellow_cards"])
        red_cards = _safe_float(row["red_cards"])

        if goals or assists or shots_ot:
            score = goals * 10 + assists * 8 + shots_ot * 2
            strengths.append({
                "feature": f"{name} - contribuție ofensivă",
                "impact": round(score, 3),
                "evidence": f"{int(goals)} goluri, {int(assists)} pase decisive, {int(shots_ot)} șuturi pe poartă",
            })

        if passes >= 10 and successful_passes:
            pass_acc = successful_passes / passes
            strengths.append({
                "feature": f"{name} - siguranță la pasă",
                "impact": round(pass_acc * 100, 3),
                "evidence": f"{int(successful_passes)}/{int(passes)} pase reușite ({pass_acc * 100:.1f}%)",
            })

        if duels >= 5 and duels_won:
            duel_rate = duels_won / duels
            strengths.append({
                "feature": f"{name} - dueluri câștigate",
                "impact": round(duel_rate * 100, 3),
                "evidence": f"{int(duels_won)}/{int(duels)} dueluri câștigate ({duel_rate * 100:.1f}%)",
            })

        if passes_final_third:
            strengths.append({
                "feature": f"{name} - progresie spre treimea adversă",
                "impact": round(passes_final_third, 3),
                "evidence": f"{int(passes_final_third)} pase reușite spre treimea adversă",
            })

        if dangerous_losses:
            weaknesses.append({
                "feature": f"{name} - pierderi periculoase",
                "impact": round(dangerous_losses, 3),
                "evidence": f"{int(dangerous_losses)} pierderi în propria jumătate",
            })

        if losses:
            weaknesses.append({
                "feature": f"{name} - pierderi de posesie",
                "impact": round(losses, 3),
                "evidence": f"{int(losses)} pierderi totale",
            })

        missed_passes = max(passes - successful_passes, 0)
        if passes >= 10 and missed_passes:
            weaknesses.append({
                "feature": f"{name} - pase nereușite",
                "impact": round(missed_passes, 3),
                "evidence": f"{int(missed_passes)} pase nereușite din {int(passes)}",
            })

        discipline_score = fouls + yellow_cards * 2 + red_cards * 4
        if discipline_score:
            weaknesses.append({
                "feature": f"{name} - risc disciplinar",
                "impact": round(discipline_score, 3),
                "evidence": f"{int(fouls)} faulturi, {int(yellow_cards)} galbene, {int(red_cards)} roșii",
            })

    top_strengths = sorted(strengths, key=lambda item: float(item["impact"]), reverse=True)[:5]
    top_weaknesses = sorted(weaknesses, key=lambda item: float(item["impact"]), reverse=True)[:5]
    return {"top_strengths": top_strengths, "top_weaknesses": top_weaknesses}


def get_match_stats_for_model(match_id: str) -> Optional[Dict[str, float]]:
    conn = _connect_db()
    # Aggregate all player stats for U Cluj in this match
    row = conn.execute(
        """
        SELECT 
            SUM(goals) as total_goals,
            SUM(assists) as total_assists,
            SUM(passes) as total_passes,
            SUM(successful_passes) as total_successfulPasses,
            SUM(duels) as total_duels,
            SUM(duels_won) as total_duels_won,
            SUM(dangerous_own_half_losses) as total_dangerous_losses,
            SUM(losses) as total_losses,
            SUM(fouls) as total_fouls,
            SUM(yellow_cards) as total_yellow_cards,
            SUM(red_cards) as total_red_cards,
            SUM(shots) as total_shots,
            SUM(shots_on_target) as total_shots_ot,
            SUM(passes_final_third) as total_passes_f3,
            COUNT(player_id) as player_count
        FROM player_match_stats
        WHERE match_id = ? AND is_ucluj_player = 1
        """,
        (match_id,),
    ).fetchone()
    conn.close()

    if not row or row["player_count"] == 0:
        return None

    p_count = float(row["player_count"])
    
    # Map to the features expected by the model
    stats = {
        "total_goals": _safe_float(row["total_goals"]),
        "total_assists": _safe_float(row["total_assists"]),
        "total_shots": _safe_float(row["total_shots"]),
        "total_shotsOnTarget": _safe_float(row["total_shots_ot"]),
        "total_passes": _safe_float(row["total_passes"]),
        "total_successfulPasses": _safe_float(row["total_successfulPasses"]),
        "total_duels": _safe_float(row["total_duels"]),
        "total_duelsWon": _safe_float(row["total_duels_won"]),
        "total_fouls": _safe_float(row["total_fouls"]),
        "total_yellowCards": _safe_float(row["total_yellow_cards"]),
        "total_redCards": _safe_float(row["total_red_cards"]),
        "total_losses": _safe_float(row["total_losses"]),
        "total_dangerousOwnHalfLosses": _safe_float(row["total_dangerous_losses"]),
        "total_passesToFinalThird": _safe_float(row["total_passes_f3"]),
        
        # Averages
        "avg_goals": _safe_float(row["total_goals"]) / p_count,
        "avg_shots": _safe_float(row["total_shots"]) / p_count,
        "avg_passes": _safe_float(row["total_passes"]) / p_count,
        "avg_duels": _safe_float(row["total_duels"]) / p_count,
        
        # Percentages
        "percent_shotsOnTarget": (_safe_float(row["total_shots_ot"]) / max(1, _safe_float(row["total_shots"]))) * 100,
        "percent_successfulPasses": (_safe_float(row["total_successfulPasses"]) / max(1, _safe_float(row["total_passes"]))) * 100,
        "percent_duelsWon": (_safe_float(row["total_duels_won"]) / max(1, _safe_float(row["total_duels"]))) * 100,
    }
    return stats


def get_match_player_stats(match_id: str) -> List[Dict[str, object]]:
    conn = _connect_db()
    rows = conn.execute(
        """
        SELECT p.player_id, p.name, p.pos,
               s.goals, s.assists, s.passes, s.successful_passes, s.duels, s.duels_won,
               s.dangerous_own_half_losses, s.losses, s.fouls, s.yellow_cards, s.red_cards,
               s.shots, s.shots_on_target, s.passes_final_third, s.minutes_on_field
        FROM player_match_stats s
        JOIN players p ON p.player_id = s.player_id
        WHERE s.match_id = ? AND s.is_ucluj_player = 1
        ORDER BY s.minutes_on_field DESC, s.passes DESC
        """,
        (match_id,),
    ).fetchall()
    conn.close()
    return [
        {
            "player_id": int(row["player_id"]),
            "name": row["name"],
            "pos": row["pos"],
            "goals": _safe_float(row["goals"]),
            "assists": _safe_float(row["assists"]),
            "passes": _safe_float(row["passes"]),
            "successful_passes": _safe_float(row["successful_passes"]),
            "duels": _safe_float(row["duels"]),
            "duels_won": _safe_float(row["duels_won"]),
            "dangerous_own_half_losses": _safe_float(row["dangerous_own_half_losses"]),
            "losses": _safe_float(row["losses"]),
            "fouls": _safe_float(row["fouls"]),
            "yellow_cards": _safe_float(row["yellow_cards"]),
            "red_cards": _safe_float(row["red_cards"]),
            "shots": _safe_float(row["shots"]),
            "shots_on_target": _safe_float(row["shots_on_target"]),
            "passes_final_third": _safe_float(row["passes_final_third"]),
            "minutes_on_field": _safe_float(row["minutes_on_field"]),
        }
        for row in rows
    ]

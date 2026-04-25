from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


PITCH_LENGTH_M = 105.0
PITCH_WIDTH_M = 68.0


@dataclass(frozen=True)
class Event:
    team: str
    type: str
    subtype: str
    period: int
    start_frame: int
    start_time: float
    end_frame: int
    end_time: float
    from_player: str
    to_player: str
    start_x: float | None
    start_y: float | None
    end_x: float | None
    end_y: float | None


@dataclass
class TrackingData:
    team: str
    periods: list[int]
    frames: list[int]
    times: list[float]
    positions: dict[str, list[tuple[float, float] | None]]

    @property
    def player_ids(self) -> list[str]:
        return [name for name in self.positions if name != "Ball"]

    def nearest_index(self, time_s: float) -> int:
        if not self.times:
            raise ValueError("tracking file has no samples")
        lo = 0
        hi = len(self.times) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if self.times[mid] < time_s:
                lo = mid + 1
            else:
                hi = mid
        if lo > 0 and abs(self.times[lo - 1] - time_s) < abs(self.times[lo] - time_s):
            return lo - 1
        return lo


def _float_or_none(value: str) -> float | None:
    text = value.strip()
    if not text or text.lower() == "nan":
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if math.isnan(number):
        return None
    return number


def _int_or_zero(value: str) -> int:
    try:
        return int(float(value))
    except ValueError:
        return 0


def _discover_entities(column_row: list[str]) -> list[tuple[str, int, int]]:
    entities: list[tuple[str, int, int]] = []
    col = 3
    while col < len(column_row):
        label = column_row[col].strip()
        if label:
            entities.append((label, col, col + 1))
        col += 2
    return entities


def read_tracking_csv(path: str | Path, team: str) -> TrackingData:
    """Read a Metrica tracking CSV and convert normalized XY to meters."""
    periods: list[int] = []
    frames: list[int] = []
    times: list[float] = []
    positions: dict[str, list[tuple[float, float] | None]] = {}

    with Path(path).open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle)
        next(reader)
        next(reader)
        column_row = next(reader)
        entities = _discover_entities(column_row)
        positions = {entity: [] for entity, _, _ in entities}

        for row in reader:
            if len(row) < 3:
                continue
            periods.append(_int_or_zero(row[0]))
            frames.append(_int_or_zero(row[1]))
            times.append(float(row[2]))
            for entity, x_col, y_col in entities:
                x = _float_or_none(row[x_col]) if x_col < len(row) else None
                y = _float_or_none(row[y_col]) if y_col < len(row) else None
                if x is None or y is None:
                    positions[entity].append(None)
                else:
                    positions[entity].append((x * PITCH_LENGTH_M, y * PITCH_WIDTH_M))

    return TrackingData(team=team, periods=periods, frames=frames, times=times, positions=positions)


def read_events_csv(path: str | Path) -> list[Event]:
    events: list[Event] = []
    with Path(path).open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            events.append(
                Event(
                    team=row["Team"].strip(),
                    type=row["Type"].strip(),
                    subtype=row["Subtype"].strip(),
                    period=_int_or_zero(row["Period"]),
                    start_frame=_int_or_zero(row["Start Frame"]),
                    start_time=float(row["Start Time [s]"] or 0.0),
                    end_frame=_int_or_zero(row["End Frame"]),
                    end_time=float(row["End Time [s]"] or 0.0),
                    from_player=row["From"].strip(),
                    to_player=row["To"].strip(),
                    start_x=_float_or_none(row["Start X"]),
                    start_y=_float_or_none(row["Start Y"]),
                    end_x=_float_or_none(row["End X"]),
                    end_y=_float_or_none(row["End Y"]),
                )
            )
    return events


def resolve_game_paths(data_root: str | Path, game: int) -> dict[str, Path]:
    root = Path(data_root)
    game_dir = root / f"Sample_Game_{game}"
    if not game_dir.exists():
        raise FileNotFoundError(f"Cannot find {game_dir}")
    return {
        "events": game_dir / f"Sample_Game_{game}_RawEventsData.csv",
        "home": game_dir / f"Sample_Game_{game}_RawTrackingData_Home_Team.csv",
        "away": game_dir / f"Sample_Game_{game}_RawTrackingData_Away_Team.csv",
    }


def iter_supported_games(data_root: str | Path) -> Iterable[int]:
    root = Path(data_root)
    for game_dir in sorted(root.glob("Sample_Game_*")):
        suffix = game_dir.name.rsplit("_", 1)[-1]
        if suffix.isdigit() and (game_dir / f"Sample_Game_{suffix}_RawEventsData.csv").exists():
            yield int(suffix)

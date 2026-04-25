from __future__ import annotations

import csv
import math
import statistics
from dataclasses import dataclass
from pathlib import Path

from .metrica import TrackingData


HSR_THRESHOLD_MPS = 5.5
SPRINT_THRESHOLD_MPS = 7.0
HARD_ACCEL_MPS2 = 3.0
MAX_REALISTIC_SPEED_MPS = 12.0


@dataclass(frozen=True)
class PlayerWindow:
    team: str
    player: str
    start_s: float
    end_s: float
    distance_m: float
    hsr_m: float
    sprint_m: float
    max_speed_mps: float
    accel_load: float
    hard_decelerations: int
    availability: float

    @property
    def minute(self) -> int:
        return int(self.end_s // 60)

    @property
    def distance_per_min(self) -> float:
        duration_min = max((self.end_s - self.start_s) / 60.0, 0.001)
        return self.distance_m / duration_min

    @property
    def hsr_per_min(self) -> float:
        duration_min = max((self.end_s - self.start_s) / 60.0, 0.001)
        return self.hsr_m / duration_min


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    return statistics.median(values)


def _segment_metrics(
    times: list[float],
    periods: list[int],
    points: list[tuple[float, float] | None],
) -> list[tuple[float, float, float, float]]:
    segments: list[tuple[float, float, float, float]] = []
    previous_speed = 0.0
    for idx in range(1, len(times)):
        if periods[idx] != periods[idx - 1]:
            previous_speed = 0.0
            continue
        start = points[idx - 1]
        end = points[idx]
        dt = times[idx] - times[idx - 1]
        if start is None or end is None or dt <= 0.0 or dt > 1.0:
            previous_speed = 0.0
            continue
        distance = math.dist(start, end)
        speed = distance / dt
        if speed > MAX_REALISTIC_SPEED_MPS:
            previous_speed = 0.0
            continue
        accel = (speed - previous_speed) / dt if previous_speed else 0.0
        segments.append((times[idx], distance, speed, accel))
        previous_speed = speed
    return segments


def _count_hard_decelerations(selected: list[tuple[float, float, float, float]]) -> int:
    count = 0
    last_event_s = -999.0
    for time_s, _, speed, accel in selected:
        if accel <= -HARD_ACCEL_MPS2 and speed >= 3.0 and time_s - last_event_s >= 1.0:
            count += 1
            last_event_s = time_s
    return count


def build_player_windows(
    tracking: TrackingData,
    window_s: float = 300.0,
    step_s: float = 60.0,
    until_s: float | None = None,
) -> list[PlayerWindow]:
    if not tracking.times:
        return []

    last_time = tracking.times[-1] if until_s is None else min(until_s, tracking.times[-1])
    first_end = min(max(window_s, tracking.times[0] + window_s), last_time)
    window_ends: list[float] = []
    current = first_end
    while current <= last_time:
        window_ends.append(current)
        current += step_s

    windows: list[PlayerWindow] = []
    for player in tracking.player_ids:
        points = tracking.positions[player]
        segments = _segment_metrics(tracking.times, tracking.periods, points)
        sample_times = [
            tracking.times[idx]
            for idx, point in enumerate(points)
            if point is not None and tracking.times[idx] <= last_time
        ]
        for end_s in window_ends:
            start_s = end_s - window_s
            selected = [segment for segment in segments if start_s < segment[0] <= end_s]
            if not selected:
                continue
            distance = sum(item[1] for item in selected)
            hsr = sum(item[1] for item in selected if item[2] >= HSR_THRESHOLD_MPS)
            sprint = sum(item[1] for item in selected if item[2] >= SPRINT_THRESHOLD_MPS)
            max_speed = max(item[2] for item in selected)
            accel_load = sum(abs(item[3]) * 0.04 for item in selected)
            hard_decels = _count_hard_decelerations(selected)
            available_samples = sum(1 for time_s in sample_times if start_s < time_s <= end_s)
            expected_samples = max(int(window_s / 0.04), 1)
            windows.append(
                PlayerWindow(
                    team=tracking.team,
                    player=player,
                    start_s=start_s,
                    end_s=end_s,
                    distance_m=distance,
                    hsr_m=hsr,
                    sprint_m=sprint,
                    max_speed_mps=max_speed,
                    accel_load=accel_load,
                    hard_decelerations=hard_decels,
                    availability=min(available_samples / expected_samples, 1.0),
                )
            )
    return windows


def player_baselines(windows: list[PlayerWindow], before_s: float) -> dict[str, dict[str, float]]:
    grouped: dict[str, list[PlayerWindow]] = {}
    for window in windows:
        if window.end_s < before_s:
            grouped.setdefault(window.player, []).append(window)

    baselines: dict[str, dict[str, float]] = {}
    for player, player_windows in grouped.items():
        usable = [window for window in player_windows if window.availability >= 0.65]
        baselines[player] = {
            "distance_per_min": _median([window.distance_per_min for window in usable]),
            "hsr_per_min": _median([window.hsr_per_min for window in usable]),
            "accel_load": _median([window.accel_load for window in usable]),
            "max_speed_mps": _median([window.max_speed_mps for window in usable]),
        }
    return baselines


def latest_windows_by_player(windows: list[PlayerWindow], at_s: float) -> dict[str, PlayerWindow]:
    latest: dict[str, PlayerWindow] = {}
    for window in sorted(windows, key=lambda item: item.end_s):
        if window.end_s <= at_s:
            latest[window.player] = window
    return latest


def export_windows_csv(windows: list[PlayerWindow], path: str | Path) -> None:
    fieldnames = [
        "team",
        "player",
        "start_s",
        "end_s",
        "minute",
        "distance_m",
        "distance_per_min",
        "hsr_m",
        "hsr_per_min",
        "sprint_m",
        "max_speed_mps",
        "accel_load",
        "hard_decelerations",
        "availability",
    ]
    with Path(path).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for window in windows:
            writer.writerow(
                {
                    "team": window.team,
                    "player": window.player,
                    "start_s": f"{window.start_s:.2f}",
                    "end_s": f"{window.end_s:.2f}",
                    "minute": window.minute,
                    "distance_m": f"{window.distance_m:.1f}",
                    "distance_per_min": f"{window.distance_per_min:.1f}",
                    "hsr_m": f"{window.hsr_m:.1f}",
                    "hsr_per_min": f"{window.hsr_per_min:.1f}",
                    "sprint_m": f"{window.sprint_m:.1f}",
                    "max_speed_mps": f"{window.max_speed_mps:.2f}",
                    "accel_load": f"{window.accel_load:.1f}",
                    "hard_decelerations": window.hard_decelerations,
                    "availability": f"{window.availability:.2f}",
                }
            )

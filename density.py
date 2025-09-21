# density.py
from typing import List, Tuple

def calculate_density(detections_in_lanes, lane_capacity: int = 10) -> Tuple[List[float], List[int]]:
    densities = []
    counts = []
    for lane_dets in detections_in_lanes:
        count = len(lane_dets)
        counts.append(count)
        d = (count / lane_capacity) * 100 if lane_capacity > 0 else 0.0
        densities.append(round(min(d, 100.0), 1))
    return densities, counts

# detection.py
import random
from typing import List, Tuple

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

def load_model(path="yolov8n.pt"):
    if YOLO is None:
        return None
    try:
        m = YOLO(path)
        return m
    except Exception:
        return None

def run_yolo_detection(frame, model, rois, conf_threshold=0.3):
    if model is None:
        raise RuntimeError("YOLO model not available")
    results = model(frame, conf=conf_threshold, verbose=False)
    if not results:
        return [[] for _ in rois]
    res0 = results[0]
    detections_in_lanes = [[] for _ in rois]
    if getattr(res0, "boxes", None) is None:
        return detections_in_lanes
    for b in res0.boxes:
        xy = b.xyxy[0].tolist()
        x1, y1, x2, y2 = map(int, xy[:4])
        conf = float(b.conf[0]) if getattr(b, "conf", None) else 0.0
        cls = int(b.cls[0]) if getattr(b, "cls", None) else -1
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        for i, (rx, ry, rw, rh) in enumerate(rois):
            if rx <= cx <= rx + rw and ry <= cy <= ry + rh:
                detections_in_lanes[i].append({"bbox": (x1, y1, x2, y2), "conf": conf, "cls": cls})
                break
    return detections_in_lanes

def run_mock_detection_from_counts(counts: List[int], rois) -> List[List[dict]]:
    lanes = [[] for _ in rois]
    for i, c in enumerate(counts):
        for _ in range(c):
            lanes[i].append({"bbox": (0, 0, 1, 1), "conf": round(random.uniform(0.6, 0.99), 2), "cls": 0})
    return lanes
print("detection.py loaded")


import cv2
import numpy as np


LANE_ROIS = [
    (50, 250, 120, 200),
    (200, 250, 120, 200),
    (350, 250, 120, 200),
    (500, 250, 120, 200),
]

VEHICLE_CLASSES = ['car', 'truck', 'bus', 'motorcycle']

def get_vehicle_class_indices(model_names):
    return [i for i, name in model_names.items() if name in VEHICLE_CLASSES]

def draw_rois(frame, rois):
    for i, (x, y, w, h) in enumerate(rois):

        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 255), 2) # Cyan color, thickness 2

        cv2.putText(frame, f"Lane {i+1}", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    return frame

def is_within_roi(bbox_center, roi):

    x_center, y_center = bbox_center
    x, y, w, h = roi
    return x < x_center < x + w and y < y_center < y + h

def draw_detections(frame, detections, rois, model_names):
    detections_in_lanes = [[] for _ in range(len(rois))]


    if detections is None or len(detections) == 0:
        return frame, detections_in_lanes

    for det in detections:
        x1, y1, x2, y2 = map(int, det[:4])
        conf = float(det[4])
        cls_idx = int(det[5])
        class_name = model_names.get(cls_idx, 'Unknown')

        cx = int((x1 + x2) / 2)
        cy = int((y1 + y2) / 2)
        bbox_center = (cx, cy)
        bbox = (x1, y1, x2, y2)


        lane_index = -1
        for i, roi in enumerate(rois):
            if is_within_roi(bbox_center, roi):
                lane_index = i

                detections_in_lanes[i].append({'bbox': bbox, 'class_name': class_name, 'conf': conf})
                break


        color = (0, 255, 0) if lane_index != -1 else (0, 0, 255)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)


        label = f"{class_name} {conf:.2f}"
        cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    return frame, detections_in_lanes


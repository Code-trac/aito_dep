# opencv.py
import cv2

def get_video_capture(source=0):
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video source {source}")
    return cap

def read_frame(cap):
    ret, frame = cap.read()
    if not ret:
        raise RuntimeError("Failed to read frame from camera")
    return frame

def release_capture(cap):
    cap.release()
    cv2.destroyAllWindows()

# backend.py
import os, time, threading, uuid, hashlib, json, math, random
from functools import wraps
from typing import Optional
from flask import Flask, jsonify, request
import pandas as pd
import numpy as np

from detection import load_model, run_yolo_detection, run_mock_detection_from_counts
from density import calculate_density
from decision import DecisionManager, MIN_GREEN, MAX_GREEN

ROIS = [(50,250,120,200),(200,250,120,200),(350,250,120,200),(500,250,120,200)]
LANE_CAPACITY = 10
YOLO_TRIGGER_BEFORE = 10
HISTORY_PATH = "history.csv"
USERS_PATH = "users.csv"
OVERRIDES_PATH = "overrides.csv"
ALERTS_PATH = "alerts.json"
MAX_GREEN_STREAK_SECONDS = 30*60
PORT = 5000

app = Flask(__name__, static_folder="static", template_folder="templates")
from flask_cors import CORS
CORS(app,
     supports_credentials=True,
     resources={r"/*": {"origins": "*"}},
     expose_headers=["Authorization"])

latest = {
    "densities": [0.0]*len(ROIS),
    "counts": [0]*len(ROIS),
    "timers": [MIN_GREEN]*len(ROIS),
    "next_lane": 0,
    "signal_timer": MIN_GREEN,
    "mode": "mock",
    "error": None,
    "timestamp": time.time()
}

state = {
    "controller": {"type": "auto"},
    "streak_seconds": [0]*len(ROIS),
    "alerts": [],
    "smoothed_densities": None,
    "rain": False,
    "peak": False
}

MOCK_MODE = True

def _ensure_users():
    if not os.path.exists(USERS_PATH):
        pd.DataFrame(columns=["username", "pw_hash", "role"]).to_csv(USERS_PATH, index=False)

def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def create_user(username, password, role="user"):
    _ensure_users()
    df = pd.read_csv(USERS_PATH)
    if username in df['username'].values:
        return False
    new_row = {"username": username, "pw_hash": hash_pw(password), "role": role}
    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    df.to_csv(USERS_PATH, index=False)
    return True

SESSIONS = {}
def login_user(username,password):
    _ensure_users()
    df = pd.read_csv(USERS_PATH)
    row = df[df['username']==username]
    if row.empty: return None
    if row.iloc[0]['pw_hash'] != hash_pw(password): return None
    token = str(uuid.uuid4())
    SESSIONS[token] = {"username":username,"role":row.iloc[0]['role'],"ts":time.time()}
    return token

def get_session(token):
    return SESSIONS.get(token)

# tolerant auth header handling
def get_token_from_request():
    auth = request.headers.get("Authorization")
    if auth:
        if isinstance(auth, str) and auth.lower().startswith("bearer "):
            return auth.split(None, 1)[1]
        return auth
    custom = request.headers.get("Traffic-Token")
    if custom:
        return custom
    qp = request.args.get("token")
    if qp:
        return qp
    return None

def require_token(f):
    @wraps(f)
    def inner(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({"error":"unauthenticated"}), 401
        s = get_session(token)
        if not s:
            return jsonify({"error":"invalid_token"}), 401
        request.session = s
        return f(*args, **kwargs)
    return inner

def official_required(f):
    @wraps(f)
    @require_token
    def inner(*args, **kwargs):
        if request.session["role"] != "official":
            return jsonify({"error":"forbidden"}), 403
        return f(*args, **kwargs)
    return inner

# ---------- persistence helpers ----------
def ensure_file(path, columns):
    if not os.path.exists(path):
        df = pd.DataFrame(columns=columns)
        df.to_csv(path, index=False)

def append_history_row(counts):
    cols = [f"lane{i+1}" for i in range(len(counts))]
    ensure_file(HISTORY_PATH, cols + ["ts"])
    row = {c: int(v) for c,v in zip(cols, counts)}
    row["ts"] = time.time()
    df = pd.DataFrame([row])
    df.to_csv(HISTORY_PATH, mode="a", header=False, index=False)

def log_override(username, lane, duration, reason="manual"):
    ensure_file(OVERRIDES_PATH, ["ts","user","lane","duration","reason"])
    row = {"ts": time.time(), "user": username, "lane": int(lane), "duration": float(duration), "reason": reason}
    df = pd.DataFrame([row])
    df.to_csv(OVERRIDES_PATH, mode="a", header=False, index=False)

def save_alerts():
    with open(ALERTS_PATH, "w") as f:
        json.dump(state["alerts"], f)

def load_alerts():
    if os.path.exists(ALERTS_PATH):
        try:
            with open(ALERTS_PATH, "r") as f:
                state["alerts"] = json.load(f)
        except Exception:
            state["alerts"] = []


dm = DecisionManager(num_lanes=len(ROIS))
dm.init_agent()

MODEL = None
try:
    MODEL = load_model()
except Exception:
    MODEL = None

# ---------- Mock generator (enhanced) ----------
class MockGen:
    def __init__(self, rows=None, max_random=8, seed=None):
        self.rows = [list(r) for r in (rows or [])]
        self.i = 0
        self.max_random = int(max_random)
        self._rand = random.Random(seed)
    def next(self):
        if self.rows:
            out = self.rows[self.i % len(self.rows)]
            self.i += 1
            return list(out)
        return [self._rand.randint(0, self.max_random) for _ in ROIS]
    def current(self):
        if not self.rows:
            return None
        idx = (self.i - 1) % len(self.rows)
        return list(self.rows[idx])
    def peek(self, offset=0):
        if not self.rows:
            return None
        idx = (self.i + offset) % len(self.rows)
        return list(self.rows[idx])
    def reset(self):
        self.i = 0
    def set_rows(self, rows):
        self.rows = [list(r) for r in rows]
        self.reset()
    def load_csv(self, path, lane_cols=None):
        if not os.path.exists(path):
            raise FileNotFoundError(path)
        df = pd.read_csv(path)
        if lane_cols:
            cols = lane_cols
        else:
            cols = [c for c in df.columns if str(c).lower().startswith("lane")]
            if not cols:
                cols = [c for c in df.select_dtypes(include=[np.number]).columns]
        rows = []
        for _, r in df.iterrows():
            rows.append([int(r[c]) for c in cols])
        self.set_rows(rows)
    def set_max_random(self, m):
        self.max_random = int(m)

mock_gen = MockGen(seed=42)

# ---------- Background processing loop ----------
_stop = threading.Event()

def normal_pdf(x, mu, sigma):
    if sigma <= 0: sigma = 1e-6
    return (1.0 / (sigma * math.sqrt(2*math.pi))) * math.exp(-0.5 * ((x-mu)/sigma)**2)

def normal_cdf(x, mu, sigma):
    if sigma <= 0: sigma = 1e-6
    return 0.5 * (1 + math.erf((x-mu)/(sigma*math.sqrt(2))))

def processing_loop(mock_mode_flag=True, video_source=0):
    global latest, MODEL, dm
    try:
        MODEL = load_model()
    except Exception:
        MODEL = None
    cap = None
    # do not set mock_mode once here; read MOCK_MODE each loop
    if not MOCK_MODE:
        try:
            from opencv import get_video_capture
            cap = get_video_capture(video_source)
        except Exception as e:
            latest["error"] = f"camera_open_err:{e}"
            # fallback to mock mode if camera open fails
    current_green = 0
    # initial snapshot
    initial_counts = mock_gen.next() if MOCK_MODE else [0]*len(ROIS)
    detections0 = run_mock_detection_from_counts(initial_counts, ROIS) if MOCK_MODE else [[] for _ in ROIS]
    densities0, counts0 = calculate_density(detections0, lane_capacity=LANE_CAPACITY)
    _, duration0, timers0 = dm.get_next_signal_state(densities0, current_green, rain=state["rain"], peak=state["peak"], prefer_rl=False)
    latest.update({"densities": densities0, "counts": counts0, "timers": timers0,
                   "next_lane": current_green, "signal_timer": duration0, "mode": "mock" if MOCK_MODE else "camera",
                   "error": None, "timestamp": time.time()})
    signal_timer = duration0
    next_densities = None
    next_counts = None
    yolo_triggered = False
    load_alerts()

    while not _stop.is_set():
        time.sleep(1.0)
        signal_timer -= 1.0

        # read runtime mode each loop
        mock_mode = MOCK_MODE

        # trigger detection only when timer <= YOLO_TRIGGER_BEFORE and not already taken
        if signal_timer <= YOLO_TRIGGER_BEFORE and not yolo_triggered:
            try:
                if mock_mode:
                    next_counts = mock_gen.next()
                    detections_next = run_mock_detection_from_counts(next_counts, ROIS)
                else:
                    from opencv import read_frame
                    if cap is None:
                        cap = None
                        try:
                            from opencv import get_video_capture
                            cap = get_video_capture(video_source)
                        except Exception as e:
                            latest["error"] = f"camera_open_err:{e}"
                            mock_mode = True
                    frame = read_frame(cap) if cap is not None else None
                    detections_next = run_yolo_detection(frame, MODEL, ROIS) if frame is not None else []
                next_densities, next_counts = calculate_density(detections_next, lane_capacity=LANE_CAPACITY)
                yolo_triggered = True
            except Exception as e:
                next_densities, next_counts = None, None
                latest["error"] = f"detection_error:{str(e)}"

        controller = state.get("controller", {"type":"auto"})
        if controller.get("type") == "manual":
            controller["remaining"] = max(0, controller.get("remaining", 0) - 1)
            latest.update({"mode": "manual", "next_lane": controller["lane"], "signal_timer": controller["remaining"]})
            if controller["remaining"] <= 0:
                state["controller"] = {"type": "auto"}
            continue

        if signal_timer <= 0:
            if next_densities is not None:
                chosen_lane, chosen_dur, timers = dm.get_next_signal_state(next_densities, current_green,
                                                                           rain=state["rain"], peak=state["peak"],
                                                                           prefer_rl=False)
                current_green = chosen_lane
                signal_timer = chosen_dur
                latest.update({"densities": next_densities, "counts": next_counts, "timers": timers,
                               "next_lane": current_green, "signal_timer": signal_timer,
                               "mode": "mock" if mock_mode else "camera", "error": None,
                               "timestamp": time.time()})
                append_history_row(next_counts)
            else:
                next_idx = (current_green + 1) % len(ROIS)
                fallback_t = dm.last_timers[next_idx] if getattr(dm, "last_timers", None) else MIN_GREEN
                current_green = next_idx
                signal_timer = int(round(fallback_t))
                latest.update({"densities": dm.last_timers if getattr(dm, "last_timers", None) else [0]*len(ROIS),
                               "counts": dm.last_timers if getattr(dm, "last_timers", None) else [0]*len(ROIS),
                               "timers": dm.last_timers if getattr(dm, "last_timers", None) else [0]*len(ROIS),
                               "next_lane": current_green, "signal_timer": signal_timer,
                               "mode": "fallback", "error": "detection_failed", "timestamp": time.time()})
            yolo_triggered = False
            next_densities, next_counts = None, None

            timers_now = latest.get("timers", [0]*len(ROIS))
            for i, t in enumerate(timers_now):
                if t >= MAX_GREEN:
                    state["streak_seconds"][i] += signal_timer if signal_timer>0 else 0
                else:
                    state["streak_seconds"][i] = 0
                if state["streak_seconds"][i] >= MAX_GREEN_STREAK_SECONDS:
                    existing = [a for a in state["alerts"] if a.get("lane")==i and not a.get("ack", False)]
                    if not existing:
                        alert = {"lane": i, "msg": f"Lane {i+1} at MAX_GREEN for prolonged period", "ts": time.time(), "ack": False}
                        state["alerts"].append(alert)
                        save_alerts()
            continue

        latest["signal_timer"] = signal_timer
        latest["timestamp"] = time.time()

# ---------- Prediction helper ----------
def predict_next_hour_from_history(lane_idx: int, minutes: int = 60):
    if not os.path.exists(HISTORY_PATH):
        return {"error":"no_history"}
    df = pd.read_csv(HISTORY_PATH)
    col = f"lane{lane_idx+1}"
    if col not in df.columns or df[col].dropna().size < 2:
        return {"error":"insufficient_history"}
    vals = df[col].dropna().values
    mu = float(np.mean(vals))
    sigma = float(np.std(vals)) if np.std(vals) > 0 else 1.0
    x = np.linspace(max(0, mu-4*sigma), mu+4*sigma, 200)
    pdf = [normal_pdf(xx, mu, sigma) for xx in x]
    cdf = [normal_cdf(xx, mu, sigma) for xx in x]
    return {"x": list(map(float,x)), "pdf": list(map(float,pdf)), "cdf": list(map(float,cdf)), "mu": mu, "sigma": sigma}

# ---------- Endpoints ----------
@app.route("/auth/signup", methods=["POST"])
def signup():
    body = request.json or {}
    username = body.get("username"); pw = body.get("password")
    if not username or not pw:
        return jsonify({"error":"bad_params"}), 400
    ok = create_user(username,pw,role="user")
    if not ok:
        return jsonify({"error":"exists"}), 400
    return jsonify({"status":"ok"})

@app.route("/auth/login", methods=["POST"])
def login():
    body = request.json or {}
    t = login_user(body.get("username"), body.get("password"))
    if not t:
        return jsonify({"error":"invalid"}), 401
    s = get_session(t)
    return jsonify({"token": t, "role": s["role"]})

@app.route("/admin/enroll_official", methods=["POST"])
def enroll_official():
    body = request.json or {}
    admin_key = body.get("admin_key")
    if admin_key != "letmein":
        return jsonify({"error":"forbidden"}), 403
    name = body.get("username"); pw = body.get("password")
    if not name or not pw:
        return jsonify({"error":"bad_params"}), 400
    ok = create_user(name, pw, role="official")
    return jsonify({"ok": ok})

@app.route("/api/traffic_data")
def api_traffic():
    return jsonify(latest)

@app.route("/api/mock_rows", methods=["POST"])
@require_token
def api_set_mock_rows():
    body = request.json or {}
    rows = body.get("rows")
    if not rows or not isinstance(rows, list):
        return jsonify({"error":"send {'rows': [[c1,c2,...],[...], ...] }"}), 400
    try:
        mock_gen.set_rows(rows)
        return jsonify({"ok": True, "rows_loaded": len(rows)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/set_mode", methods=["POST"])
@require_token
def api_set_mode():
    global MOCK_MODE
    body = request.json or {}
    mm = body.get("mock", None)
    if mm is None:
        return jsonify({"error":"send {'mock': true/false}"}), 400
    MOCK_MODE = bool(mm)
    latest["mode"] = "mock" if MOCK_MODE else "camera"
    print("MOCK_MODE set to", MOCK_MODE)
    return jsonify({"status":"ok","mock":MOCK_MODE})

@app.route("/api/emergency", methods=["POST"])
@require_token
def api_emergency():
    body = request.json or {}
    on = bool(body.get("on", True))
    lane = body.get("lane", None)
    if on:
        latest["emergency"] = True
        latest["emergency_lane"] = int(lane) if lane is not None else None
        lane_idx = latest.get("emergency_lane", None)
        if lane_idx is None:
            lane_idx = 0
        state["controller"] = {"type":"manual", "official":"system", "lane": int(lane_idx), "remaining": 20}
        return jsonify({"ok":True, "lane": lane_idx})
    else:
        latest["emergency"] = False
        latest["emergency_lane"] = None
        if state.get("controller", {}).get("official") == "system":
            state["controller"] = {"type":"auto"}
        return jsonify({"ok":True})

@app.route("/api/pedestrian", methods=["POST"])
@require_token
def api_pedestrian():
    body = request.json or {}
    lane = int(body.get("lane", 0))
    state["ped_request"] = {"lane": lane, "requested_at": time.time()}
    return jsonify({"ok":True, "lane": lane})

@app.route("/official/status")
@official_required
def official_status():
    resp = latest.copy()
    resp["controller"] = state.get("controller", {"type":"auto"})
    resp["alerts"] = [a for a in state.get("alerts", [])]
    return jsonify(resp)

@app.route("/official/prediction")
@official_required
def official_prediction():
    lane = int(request.args.get("lane", 0))
    res = predict_next_hour_from_history(lane)
    return jsonify(res)

@app.route("/official/takeover", methods=["POST"])
@official_required
def official_takeover():
    body = request.json or {}
    lane = int(body.get("lane", 0))
    duration = int(body.get("duration", MIN_GREEN))
    state["controller"] = {"type":"manual", "official": request.session["username"], "lane": lane, "remaining": duration}
    log_override(request.session["username"], lane, duration, reason="manual_takeover")
    return jsonify({"ok":True, "lane": lane, "duration": duration})

@app.route("/official/release", methods=["POST"])
@official_required
def official_release():
    state["controller"] = {"type":"auto"}
    return jsonify({"ok":True})

@app.route("/alerts")
@official_required
def get_alerts():
    return jsonify(state.get("alerts", []))

@app.route("/alerts/ack", methods=["POST"])
@official_required
def ack_alert():
    body = request.json or {}
    idx = body.get("lane")
    if idx is None:
        return jsonify({"error":"lane required"}), 400
    for a in state["alerts"]:
        if a.get("lane") == int(idx):
            a["ack"] = True
    save_alerts()
    return jsonify({"ok":True})

@app.route("/api/train_rl", methods=["POST"])
@official_required
def api_train_rl():
    body = request.json or {}
    iters = int(body.get("iters", 1000))
    dm.train_agent_from_buffer(iterations=iters)
    return jsonify({"status":"trained", "iters": iters, "buffer_size": len(dm.agent.buffer) if dm.agent else 0})

@app.route("/api/agent_stats")
@official_required
def api_agent_stats():
    if dm.agent is None:
        return jsonify({"agent": None})
    return jsonify({"eps": dm.agent.eps, "buffer_len": len(dm.agent.buffer)})

@app.route("/api/logs")
@official_required
def api_logs():
    overrides = []
    if os.path.exists(OVERRIDES_PATH):
        overrides = pd.read_csv(OVERRIDES_PATH).to_dict(orient="records")
    return jsonify({"overrides": overrides})

@app.route("/camera/preview")
@official_required
def camera_preview():
    return jsonify({"url": "/static/preview.jpg"})

@app.route("/user/status")
@require_token
def user_status():
    resp = {"latest": latest.copy()}
    mus = []
    if os.path.exists(HISTORY_PATH):
        df = pd.read_csv(HISTORY_PATH)
        for i in range(len(ROIS)):
            col = f"lane{i+1}"
            if col in df.columns and df[col].size>0:
                mus.append(float(np.mean(df[col].dropna().values)))
            else:
                mus.append(None)
    resp["predicted_mu"] = mus
    return jsonify(resp)

@app.route("/")
def index():
    return app.send_static_file("index.html")

# ---------- start background thread ----------
if __name__ == "__main__":
    t = threading.Thread(target=processing_loop, kwargs={"mock_mode_flag": True}, daemon=True)
    t.start()
    try:
        app.run(host="0.0.0.0", port=PORT, debug=False)
    finally:
        _stop.set()

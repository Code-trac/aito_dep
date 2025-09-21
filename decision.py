# decision.py
import random, json
from collections import defaultdict, deque
from typing import List, Optional, Tuple

MIN_GREEN = 10.0
MAX_GREEN = 50.0
ZERO_DENSITY_THRESHOLD = 0.1
ALPHA_RAIN = 0.25
ALPHA_PEAK = 0.10

RL_DENSITY_BINS = [0, 20, 40, 60, 80, 100]
RL_ACTION_MULTS = [0.75, 1.0, 1.25, 1.5]
RL_ALPHA = 0.2
RL_GAMMA = 0.95
RL_EPS = 0.2
RL_BUFFER_SIZE = 20000

def env_multiplier(rain: bool = False, peak: bool = False) -> float:
    m = 1.0
    if rain: m += ALPHA_RAIN
    if peak: m += ALPHA_PEAK
    return m

def base_timer_from_density(d_pct: float) -> float:
    if d_pct <= 0.0: return 0.0
    frac = max(0.0, min(1.0, d_pct / 100.0))
    return MIN_GREEN + frac * (MAX_GREEN - MIN_GREEN)

class MultiplierAgent:
    def __init__(self, num_lanes: int, alpha=RL_ALPHA, gamma=RL_GAMMA, eps=RL_EPS):
        self.num_lanes = int(num_lanes)
        self.alpha = alpha; self.gamma = gamma; self.eps = eps
        self.Q = defaultdict(lambda: [0.0 for _ in RL_ACTION_MULTS])
        self.buffer = deque(maxlen=RL_BUFFER_SIZE)
    def _discretize(self, densities: List[float]) -> Tuple[int, ...]:
        key = []
        for d in densities:
            dd = max(0.0, min(100.0, d))
            idx = 0
            while idx + 1 < len(RL_DENSITY_BINS) and dd > RL_DENSITY_BINS[idx+1]:
                idx += 1
            key.append(int(idx))
        return tuple(key)
    def choose_multiplier_idx(self, densities: List[float]) -> int:
        key = self._discretize(densities)
        if random.random() < self.eps:
            return random.randrange(len(RL_ACTION_MULTS))
        qvals = self.Q[key]
        best = int(max(range(len(qvals)), key=lambda i: qvals[i]))
        return best
    def learn_step(self, s, a_idx, r, s2):
        k = self._discretize(s); k2 = self._discretize(s2)
        old = self.Q[k][a_idx]; nxt = max(self.Q[k2]) if k2 in self.Q else 0.0
        target = r + self.gamma * nxt
        self.Q[k][a_idx] = old + self.alpha * (target - old)
    def store(self, s, a_idx, r, s2):
        self.buffer.append((s, a_idx, r, s2))
    def set_eps(self, eps: float): self.eps = float(eps)
    def save(self, path: str):
        dump = {"num_lanes": self.num_lanes, "alpha": self.alpha, "gamma": self.gamma, "eps": self.eps,
                "q": {json.dumps(k): v for k, v in self.Q.items()}}
        with open(path, "w") as f: json.dump(dump, f)
    def load(self, path: str):
        with open(path, "r") as f:
            data = json.load(f)
        self.num_lanes = int(data.get("num_lanes", self.num_lanes))
        self.alpha = data.get("alpha", self.alpha); self.gamma = data.get("gamma", self.gamma)
        self.eps = data.get("eps", self.eps)
        q = data.get("q", {})
        for kjson, v in q.items():
            key = tuple(json.loads(kjson)); self.Q[key] = v

class DecisionManager:
    def __init__(self, num_lanes: int):
        self.num_lanes = int(num_lanes)
        self.last_timers = [MIN_GREEN] * self.num_lanes
        self.agent: Optional[MultiplierAgent] = None
    def init_agent(self, **kwargs):
        self.agent = MultiplierAgent(num_lanes=self.num_lanes, **kwargs); return self.agent
    def compute_rule_timers(self, densities: List[float], rain: bool=False, peak: bool=False) -> List[float]:
        mult = env_multiplier(rain, peak); timers = []
        for d in densities:
            base = base_timer_from_density(d); final = base * mult
            timers.append(0.0 if d <= ZERO_DENSITY_THRESHOLD else float(max(0.0, min(MAX_GREEN, final))))
        return timers
    def _next_nonempty_in_order(self, current_idx: int, densities: List[float]):
        for offset in range(1, self.num_lanes + 1):
            idx = (current_idx + offset) % self.num_lanes
            if densities[idx] > ZERO_DENSITY_THRESHOLD: return idx
        return None
    def get_next_signal_state(self, densities: Optional[List[float]], current_green_idx: int,
                              rain: bool=False, peak: bool=False, prefer_rl: bool=False) -> Tuple[int, int, List[float]]:
        if densities is None or len(densities) != self.num_lanes:
            next_idx = (current_green_idx + 1) % self.num_lanes
            return next_idx, int(round(self.last_timers[next_idx])), list(self.last_timers)
        timers = self.compute_rule_timers(densities, rain=rain, peak=peak)
        next_idx = self._next_nonempty_in_order(current_green_idx, densities)
        if next_idx is None:
            next_idx = (current_green_idx + 1) % self.num_lanes
            self.last_timers = [MIN_GREEN if d > ZERO_DENSITY_THRESHOLD else 0.0 for d in densities]
            return next_idx, int(round(MIN_GREEN)), self.last_timers
        if prefer_rl and self.agent is not None:
            mult_idx = self.agent.choose_multiplier_idx(densities)
            chosen_mult = RL_ACTION_MULTS[mult_idx]
            timers_rl = timers.copy()
            timers_rl[next_idx] = float(max(0.0, min(MAX_GREEN, timers_rl[next_idx] * chosen_mult)))
            reward = -sum(densities)
            self.agent.store(densities, mult_idx, reward, densities)
            self.last_timers = timers_rl
            return int(next_idx), int(round(timers_rl[next_idx])), timers_rl
        # always store rule decision for RL buffer if agent exists
        if self.agent is not None:
            try:
                mult_idx_rule = RL_ACTION_MULTS.index(1.0)
            except ValueError:
                mult_idx_rule = 1
            reward = -sum(densities)
            self.agent.store(densities, mult_idx_rule, reward, densities)
        self.last_timers = timers
        duration = float(max(MIN_GREEN, min(MAX_GREEN, timers[next_idx])))
        return int(next_idx), int(round(duration)), timers
    def train_agent_from_buffer(self, iterations: int = 1000):
        if self.agent is None: return
        import random
        for _ in range(iterations):
            if not self.agent.buffer: break
            s, a_idx, r, s2 = random.choice(list(self.agent.buffer))
            self.agent.learn_step(s, a_idx, r, s2)

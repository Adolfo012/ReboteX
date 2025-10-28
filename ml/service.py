import os
import math
from typing import List, Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import joblib

# ===== Model Loading =====
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'favorite_dt.pkl')
_model = None
if os.path.exists(MODEL_PATH):
    try:
        _model = joblib.load(MODEL_PATH)
    except Exception as e:
        print(f"[ML] Warning: can't load model: {e}")
        _model = None
else:
    print("[ML] No trained model found; service will use heuristic fallback.")

# ===== Data Schemas =====
class EquipoFeatures(BaseModel):
    equipo_id: int
    nombre: str | None = None
    pj: float | int | None = 0
    pg: float | int | None = 0
    pp: float | int | None = 0
    pf: float | int | None = 0
    pc: float | int | None = 0
    diff: float | int | None = 0
    pa: float | int | None = 0
    pt: float | int | None = 0
    pd: float | int | None = 0
    tl: float | int | None = 0
    win_rate: float | None = 0.0
    pf_pg: float | None = 0.0
    pc_pg: float | None = 0.0
    diff_pg: float | None = 0.0

class PredictPayload(BaseModel):
    equipos: List[EquipoFeatures]
    contexto: Dict[str, Any] | None = None

class PredictResponse(BaseModel):
    favorito_id: int
    favorito_nombre: str | None
    prob: float
    source: str

# ===== App =====
app = FastAPI(title="ReboteX ML Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Utils =====
def _compose_pair_features(equipo_a: EquipoFeatures, equipo_b: EquipoFeatures):
    """Create pairwise features for model inference: A and B concatenated."""
    def safe_num(v):
        try:
            return float(v or 0)
        except Exception:
            return 0.0
    def wr_safe(x: EquipoFeatures):
        # Prefer provided win_rate; fallback to Laplace smoothing from pj/pg if missing
        if x.win_rate is not None and float(x.win_rate) != 0.0:
            return safe_num(x.win_rate)
        pj = safe_num(x.pj)
        pg = safe_num(x.pg)
        return ((pg + 1.0) / (pj + 2.0)) if pj > 0 else 0.5
    a = equipo_a
    b = equipo_b
    vec = [
        wr_safe(a), safe_num(a.pf_pg), safe_num(a.pc_pg), safe_num(a.diff_pg),
        safe_num(a.pa), safe_num(a.pt), safe_num(a.pd), safe_num(a.tl),
        wr_safe(b), safe_num(b.pf_pg), safe_num(b.pc_pg), safe_num(b.diff_pg),
        safe_num(b.pa), safe_num(b.pt), safe_num(b.pd), safe_num(b.tl),
    ]
    return vec


def _heuristic_prob(equipo_a: EquipoFeatures, equipo_b: EquipoFeatures):
    """Fallback probability using a small-data friendly weighted comparison and logistic."""
    def score(x: EquipoFeatures) -> float:
        pj = float(x.pj or 0)
        pg = float(x.pg or 0)
        wr = float(x.win_rate) if (x.win_rate is not None) else ( (pg + 1.0) / (pj + 2.0) if pj > 0 else 0.5 )
        diff_pg = float(x.diff_pg or 0)
        pf_pg = float(x.pf_pg or 0)
        pa_pg = (float(x.pa or 0) / pj) if pj > 0 else float(x.pa or 0)
        pa_scaled = math.log(1 + pa_pg) / 8.0
        # Weights favor early reliable signals
        return 0.5 * wr + 0.3 * diff_pg + 0.15 * pf_pg + 0.05 * pa_scaled
    s_a = score(equipo_a)
    s_b = score(equipo_b)
    # logistic of score difference
    prob_a = 1.0 / (1.0 + math.exp(-(s_a - s_b)))
    return prob_a

# Clip probability to avoid extremes; enforce [10%, 90%] by default
def _clip_prob(p: float, lo: float = 0.10, hi: float = 0.90) -> float:
    try:
        x = float(p)
        if x < lo: return lo
        if x > hi: return hi
        return x
    except Exception:
        return 0.5

# Small-sample adjustments: shrink towards 0.5 and apply dynamic caps
def _wr_safe(x: EquipoFeatures) -> float:
    try:
        if x.win_rate is not None and float(x.win_rate) != 0.0:
            return float(x.win_rate)
    except Exception:
        pass
    pj = float(x.pj or 0)
    pg = float(x.pg or 0)
    return ((pg + 1.0) / (pj + 2.0)) if pj > 0 else 0.5

def _cap_for(min_pj: int) -> float:
    # Symmetric cap around 0.5: hi is returned, lo = 1 - hi
    if min_pj <= 1:
        return 0.55
    if min_pj == 2:
        return 0.60
    if min_pj == 3:
        return 0.65
    if min_pj == 4:
        return 0.70
    if min_pj == 5:
        return 0.75
    if min_pj <= 7:
        return 0.80
    if min_pj <= 9:
        return 0.85
    return 0.90

def _shrink_factor(min_pj: int) -> float:
    # Amount to keep of deviation from 0.5; stronger shrink with fewer matches
    if min_pj <= 1:
        return 0.25
    if min_pj == 2:
        return 0.35
    if min_pj == 3:
        return 0.50
    if min_pj == 4:
        return 0.60
    if min_pj == 5:
        return 0.70
    if min_pj == 6:
        return 0.80
    if min_pj <= 8:
        return 0.90
    if min_pj <= 10:
        return 0.95
    return 1.00

def _apply_small_sample_adjustments(prob_raw: float, a: EquipoFeatures, b: EquipoFeatures) -> float:
    try:
        min_pj = int(min(int(a.pj or 0), int(b.pj or 0)))
    except Exception:
        min_pj = 0
    alpha = _shrink_factor(min_pj)
    cap_hi = _cap_for(min_pj)
    # shrink towards 0.5
    p_shrunk = 0.5 + (float(prob_raw) - 0.5) * alpha
    # parity-based extra shrink: if teams look very similar on reliable features
    try:
        dw = abs(_wr_safe(a) - _wr_safe(b))
        dd = abs(float(a.diff_pg or 0) - float(b.diff_pg or 0))
        dpf = abs(float(a.pf_pg or 0) - float(b.pf_pg or 0))
        is_parity = (dw < 0.08) and (dd < 2.0) and (dpf < 2.0)
    except Exception:
        is_parity = False
    if is_parity:
        p_shrunk = 0.5 + (p_shrunk - 0.5) * 0.7
    # final symmetric clip
    lo = 1.0 - cap_hi
    hi = cap_hi
    return _clip_prob(p_shrunk, lo=lo, hi=hi)

# ===== Routes =====
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}

@app.post("/predict_favorite", response_model=PredictResponse)
def predict_favorite(payload: PredictPayload):
    equipos = payload.equipos
    if not equipos or len(equipos) < 2:
        return PredictResponse(favorito_id=0, favorito_nombre=None, prob=0.5, source="invalid")

    equipo_a = equipos[0]
    equipo_b = equipos[1]

    if _model is not None:
        try:
            X = [_compose_pair_features(equipo_a, equipo_b)]
            proba = _model.predict_proba(X)[0]
            # Assume class 1 means equipo A wins
            prob_a = float(proba[1]) if len(proba) > 1 else float(proba[0])
            favorito_id = equipo_a.equipo_id if prob_a >= 0.5 else equipo_b.equipo_id
            favorito_nombre = equipo_a.nombre if prob_a >= 0.5 else equipo_b.nombre
            prob_raw = prob_a if prob_a >= 0.5 else (1.0 - prob_a)
            prob = _apply_small_sample_adjustments(prob_raw, equipo_a, equipo_b)
            return PredictResponse(favorito_id=favorito_id, favorito_nombre=favorito_nombre, prob=prob, source="model")
        except Exception as e:
            print(f"[ML] Model inference error: {e}")
            # fallthrough to heuristic

    # Heuristic fallback
    prob_a = _heuristic_prob(equipo_a, equipo_b)
    favorito_id = equipo_a.equipo_id if prob_a >= 0.5 else equipo_b.equipo_id
    favorito_nombre = equipo_a.nombre if prob_a >= 0.5 else equipo_b.nombre
    prob_raw = prob_a if prob_a >= 0.5 else (1.0 - prob_a)
    prob = _apply_small_sample_adjustments(prob_raw, equipo_a, equipo_b)
    return PredictResponse(favorito_id=favorito_id, favorito_nombre=favorito_nombre, prob=prob, source="heuristic")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
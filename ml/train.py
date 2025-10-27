import os
import math
import psycopg2
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, brier_score_loss
import joblib

# Read DB credentials (reuse backend .env if present)
DB_URL = os.environ.get('DATABASE_URL') or os.environ.get('SUPABASE_DB_URL')
DB_HOST = os.environ.get('DB_HOST')
DB_PORT = int(os.environ.get('DB_PORT', '5432'))
DB_NAME = os.environ.get('DB_NAME')
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'favorite_dt.pkl')

os.makedirs(MODEL_DIR, exist_ok=True)


def get_conn():
    if DB_URL:
        return psycopg2.connect(DB_URL)
    elif DB_HOST and DB_NAME and DB_USER:
        return psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD)
    else:
        raise RuntimeError('Database configuration missing. Set DATABASE_URL or individual DB_* vars.')


def fetch_matches(conn):
    # Use finalized matches; rely on non-null results to avoid time-based states.
    sql = '''
    SELECT 
        p.id,
        p.torneo_id,
        p.local_id,
        p.visitante_id,
        COALESCE(p.resultado_local, 0) AS rl,
        COALESCE(p.resultado_visitante, 0) AS rv
    FROM partidos p
    WHERE (p.resultado_local IS NOT NULL OR p.resultado_visitante IS NOT NULL)
    '''
    return pd.read_sql(sql, conn)


def fetch_team_aggs(conn, torneo_id: int, equipo_id: int):
    agg_general = pd.read_sql(
        '''
        SELECT 
          COUNT(*) FILTER (WHERE (COALESCE(p.resultado_local,0)<>0 OR COALESCE(p.resultado_visitante,0)<>0)) AS pj,
          SUM(CASE WHEN p.local_id=%(eq)s THEN COALESCE(p.resultado_local,0) ELSE COALESCE(p.resultado_visitante,0) END) AS pf,
          SUM(CASE WHEN p.local_id=%(eq)s THEN COALESCE(p.resultado_visitante,0) ELSE COALESCE(p.resultado_local,0) END) AS pc,
          SUM(CASE WHEN (p.local_id=%(eq)s AND COALESCE(p.resultado_local,0) > COALESCE(p.resultado_visitante,0)) OR (p.visitante_id=%(eq)s AND COALESCE(p.resultado_visitante,0) > COALESCE(p.resultado_local,0)) THEN 1 ELSE 0 END) AS pg,
          SUM(CASE WHEN (p.local_id=%(eq)s AND COALESCE(p.resultado_local,0) < COALESCE(p.resultado_visitante,0)) OR (p.visitante_id=%(eq)s AND COALESCE(p.resultado_visitante,0) < COALESCE(p.resultado_local,0)) THEN 1 ELSE 0 END) AS pp
        FROM partidos p
        WHERE p.torneo_id=%(tid)s AND (p.local_id=%(eq)s OR p.visitante_id=%(eq)s)
        ''', {'tid': torneo_id, 'eq': equipo_id}, conn
    )
    agg_players = pd.read_sql(
        '''
        SELECT 
          COALESCE(SUM(pj.puntos_triple),0) AS pt,
          COALESCE(SUM(pj.puntos_doble),0) AS pd,
          COALESCE(SUM(pj.tiros_libre),0) AS tl
        FROM partido_jugadores pj
        JOIN partidos p ON p.id = pj.partido_id
        WHERE p.torneo_id=%(tid)s AND pj.equipo_id=%(eq)s
        ''', {'tid': torneo_id, 'eq': equipo_id}, conn
    )
    g = agg_general.iloc[0]
    s = agg_players.iloc[0]
    pj = float(g['pj'] or 0)
    pg = float(g['pg'] or 0)
    pp = float(g['pp'] or 0)
    pf = float(g['pf'] or 0)
    pc = float(g['pc'] or 0)
    pt = float(s['pt'] or 0)
    pdv = float(s['pd'] or 0)  # pd is column name; rename to avoid clash
    tl = float(s['tl'] or 0)
    pa = pt*3 + pdv*2 + tl
    # Laplace smoothing for early rounds to avoid 0/1 extremes
    win_rate = ((pg + 1.0) / (pj + 2.0)) if pj > 0 else 0.5
    pf_pg = (pf/pj) if pj>0 else 0.0
    pc_pg = (pc/pj) if pj>0 else 0.0
    diff_pg = ((pf-pc)/pj) if pj>0 else 0.0
    return {
        'pj': pj,'pg': pg,'pp': pp,'pf': pf,'pc': pc,'diff': (pf-pc),
        'pa': pa,'pt': pt,'pd': pdv,'tl': tl,
        'win_rate': win_rate,'pf_pg': pf_pg,'pc_pg': pc_pg,'diff_pg': diff_pg
    }


def build_dataset(conn):
    matches = fetch_matches(conn)
    rows = []
    for _, m in matches.iterrows():
        # Skip ties (rare)
        if m['rl'] == m['rv']:
            continue
        a = fetch_team_aggs(conn, int(m['torneo_id']), int(m['local_id']))
        b = fetch_team_aggs(conn, int(m['torneo_id']), int(m['visitante_id']))
        label = 1 if m['rl'] > m['rv'] else 0
        vec = [
            a['win_rate'], a['pf_pg'], a['pc_pg'], a['diff_pg'], a['pa'], a['pt'], a['pd'], a['tl'],
            b['win_rate'], b['pf_pg'], b['pc_pg'], b['diff_pg'], b['pa'], b['pt'], b['pd'], b['tl'],
            label
        ]
        rows.append(vec)
    cols = [
        'a_win_rate','a_pf_pg','a_pc_pg','a_diff_pg','a_pa','a_pt','a_pd','a_tl',
        'b_win_rate','b_pf_pg','b_pc_pg','b_diff_pg','b_pa','b_pt','b_pd','b_tl','label'
    ]
    df = pd.DataFrame(rows, columns=cols)
    return df


def train():
    try:
        conn = get_conn()
    except Exception as e:
        print(f"[train] DB connect error: {e}")
        return False
    try:
        df = build_dataset(conn)
        n_samples = df.shape[0]
        if n_samples < 8:
            print('[train] Muy pocos partidos (<8). Omitiendo entrenamiento y usando heurística.')
            return False
        X = df.drop(columns=['label']).values
        y = df['label'].values
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42, stratify=y if len(np.unique(y)) > 1 else None
        )
        # Hyperparams adaptados a pocos datos
        if n_samples <= 60:
            clf = DecisionTreeClassifier(
                max_depth=3, min_samples_leaf=4, min_samples_split=8,
                class_weight='balanced', random_state=42
            )
        elif n_samples <= 150:
            clf = DecisionTreeClassifier(
                max_depth=5, min_samples_leaf=5, class_weight='balanced', random_state=42
            )
        else:
            clf = DecisionTreeClassifier(max_depth=8, random_state=42)
        clf.fit(X_train, y_train)
        # Calibración de probabilidades para estabilidad con pocos datos
        # Usar 'prefit' si el set de entrenamiento es muy pequeño
        min_class = np.min(np.bincount(y_train)) if len(np.unique(y_train)) > 1 else len(y_train)
        small_train = min_class < 3 or len(y_train) < 24
        if small_train:
            calibrator = CalibratedClassifierCV(clf, method='sigmoid', cv='prefit')
            calibrator.fit(X_train, y_train)
        else:
            calibrator = CalibratedClassifierCV(base_estimator=clf, method='sigmoid', cv=3)
            calibrator.fit(X_train, y_train)
        y_pred = calibrator.predict(X_test)
        y_proba = calibrator.predict_proba(X_test)[:, 1]
        acc = accuracy_score(y_test, y_pred)
        try:
            brier = brier_score_loss(y_test, y_proba)
            print(f"[train] Acc: {acc:.3f} | Brier: {brier:.3f} | n={n_samples}")
        except Exception:
            print(f"[train] Acc: {acc:.3f} | n={n_samples}")
        joblib.dump(calibrator, MODEL_PATH)
        print(f"[train] Modelo calibrado guardado en {MODEL_PATH}")
        return True
    except Exception as e:
        print(f"[train] Error: {e}")
        return False
    finally:
        conn.close()


if __name__ == '__main__':
    ok = train()
    if not ok:
        print('[train] Training did not produce a model; service will use heuristic fallback.')
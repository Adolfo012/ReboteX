(function(){
  const API_URL = window.API_URL || window.REBOTE_BACKEND_URL || '';

  function getAuthToken(){
    try{ return localStorage.getItem('authToken') || ''; } catch{ return ''; }
  }
  function getCurrentUserId(){
    try{
      const ud = localStorage.getItem('userData');
      if(!ud) return null;
      const u = JSON.parse(ud);
      return u?.id || (u?.user && u.user.id) || null;
    }catch(_){ return null; }
  }
  function getEquipoId(){
    const p = new URLSearchParams(window.location.search);
    return p.get('id');
  }

  async function fetchEquipo(equipoId){
    try{
      const res = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}`);
      if(!res.ok) return null;
      const j = await res.json();
      return j?.equipo || null;
    }catch(_){ return null; }
  }

  async function tienePartidosProgramados(equipoId){
    try{
      const torRes = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}/torneos`);
      if(!torRes.ok) return { blocked:false, matches:0 };
      const tjson = await torRes.json();
      const torneos = tjson.torneos || [];
      if(!torneos.length) return { blocked:false, matches:0 };
      let count = 0;
      for(const t of torneos){
        const pRes = await fetch(`${API_URL}/api/torneos/${encodeURIComponent(t.id)}/partidos`);
        if(!pRes.ok) continue;
        const pjson = await pRes.json();
        const partidos = pjson.partidos || [];
        for(const p of partidos){
          const inv = String(p.local_id)===String(equipoId) || String(p.visitante_id)===String(equipoId);
          if(inv && p.fecha!=null && p.hora!=null){ count++; }
        }
        if(count>0) break;
      }
      return { blocked: count>0, matches: count };
    }catch(_){ return { blocked:false, matches:0 }; }
  }

  function ensureBlockedModal(){
    if(document.getElementById('deleteEquipoBlockedModal')) return;
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.id = 'deleteEquipoBlockedModal';
    o.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-icon"><i class="fas fa-shield-alt"></i></div>
          <h3 class="modal-title">Acción no permitida</h3>
        </div>
        <div class="modal-body">
          <p>El equipo se encuentra actualmente con <strong>partidos pendientes</strong>, no puede ser eliminado.</p>
          <p class="modal-warning">Primero finaliza o desprograma los partidos para poder eliminarlo.</p>
        </div>
        <div class="modal-actions">
          <button class="modal-btn confirm-btn" id="blockedOkBtn">
            <i class="fas fa-check"></i>
            Entendido
          </button>
        </div>
      </div>`;
    document.body.appendChild(o);
    o.addEventListener('click', (e)=>{ if(e.target===o) o.classList.remove('show'); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') o.classList.remove('show'); });
    o.querySelector('#blockedOkBtn')?.addEventListener('click', ()=> o.classList.remove('show'));
  }
  function showBlockedModal(){ ensureBlockedModal(); document.getElementById('deleteEquipoBlockedModal')?.classList.add('show'); }

  function ensureConfirmModal(){
    if(document.getElementById('deleteEquipoConfirmModal')) return;
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.id = 'deleteEquipoConfirmModal';
    o.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-icon"><i class="fas fa-users-slash"></i></div>
          <h3 class="modal-title">Eliminar equipo</h3>
        </div>
        <div class="modal-body">
          <p id="deleteEquipoConfirmText">¿Estás seguro de eliminar el equipo?</p>
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel-btn" id="delEquipoCancelBtn">
            <i class="fas fa-times"></i>
            Cancelar
          </button>
          <button class="modal-btn confirm-btn" id="delEquipoConfirmBtn">
            <i class="fas fa-check"></i>
            Eliminar
          </button>
        </div>
      </div>`;
    document.body.appendChild(o);
    o.addEventListener('click', (e)=>{ if(e.target===o) o.classList.remove('show'); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') o.classList.remove('show'); });
    o.querySelector('#delEquipoCancelBtn')?.addEventListener('click', ()=> o.classList.remove('show'));
  }
  function showConfirmModal(onConfirm, equipoNombre){
    ensureConfirmModal();
    const o = document.getElementById('deleteEquipoConfirmModal');
    if(!o) return;
    const esc = (s)=> String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
    const t = o.querySelector('#deleteEquipoConfirmText');
    if(t){
      const name = esc(equipoNombre||'');
      t.innerHTML = `¿Estás seguro de eliminar el equipo <strong>«${name}»</strong>? Esta acción es irreversible.`;
    }
    o.classList.add('show');
    o.querySelector('#delEquipoConfirmBtn')?.addEventListener('click', ()=> onConfirm?.(), { once:true });
  }

  async function eliminarEquipo(equipoId){
    const token = getAuthToken();
    const o = document.getElementById('deleteEquipoConfirmModal');
    const REMOTE = 'https://rebotex-backend.onrender.com';
    const bases = API_URL && API_URL !== REMOTE ? [API_URL, REMOTE] : [REMOTE];

    let lastErr = null;
    for(const base of bases){
      const url = `${base}/api/equipos/${encodeURIComponent(equipoId)}`;
      try{
        const res = await fetch(url, { method:'DELETE', headers: { ...(token?{ 'Authorization': `Bearer ${token}` }: {}) } });
        const ct = res.headers.get('content-type')||'';
        const payload = ct.includes('application/json') ? await res.json() : await res.text();
        if(!res.ok){
          const bodyMsg = payload?.error || (typeof payload==='string' ? payload : '');
          // Si es un 404 con "Cannot DELETE" (servidor estático/local incorrecto), intentar siguiente base
          if(res.status === 404 && typeof payload === 'string' && bodyMsg.includes('Cannot DELETE')){
            lastErr = new Error(bodyMsg);
            continue;
          }
          throw new Error(bodyMsg || `No se pudo eliminar el equipo (HTTP ${res.status})`);
        }
        // Éxito en esta base
        o?.classList.remove('show');
        if(typeof window.showFxToast==='function'){
          window.showFxToast('Equipo eliminado', 'Redirigiendo al dashboard...', 2500);
        }
        setTimeout(()=>{ window.location.href = '../client/dashboard.html'; }, 1200);
        return;
      }catch(err){
        lastErr = err;
        // Intentar siguiente base si la actual falló por red/endpoint
        continue;
      }
    }
    alert((lastErr && lastErr.message) || 'Error al eliminar equipo');
    o?.classList.remove('show');
  }

  async function setupEliminarEquipo(){
    const btn = document.getElementById('btnEliminarEquipo');
    if(!btn) return;
    const equipoId = getEquipoId();
    if(!equipoId){ btn.style.display='none'; return; }

    const equipo = await fetchEquipo(equipoId);
    const userId = getCurrentUserId();
    const creatorId = equipo?.creador_id;
    if(!userId || String(userId)!==String(creatorId)){
      btn.style.display='none';
      return;
    }

    btn.addEventListener('click', async ()=>{
      const guard = await tienePartidosProgramados(equipoId);
      if(guard.blocked){ showBlockedModal(); return; }
      showConfirmModal(()=> eliminarEquipo(equipoId), equipo?.nombre);
    });
  }

  document.addEventListener('DOMContentLoaded', setupEliminarEquipo);
})();
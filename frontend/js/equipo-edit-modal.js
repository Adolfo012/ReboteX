// equipo-edit-modal.js - Modal de edición para equipos (nombre y agregar jugadores)
(function(){
  // Resolver backend igual que en equipo-show.js
  function getQueryParam(name){
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }
  const API_URL = (() => {
    const qp = getQueryParam('backend');
    const cfg = (typeof window.getBackendUrl === 'function')
      ? window.getBackendUrl()
      : (window.REBOTE_BACKEND_URL || null);
    return qp || cfg || 'https://rebotex-backend.onrender.com';
  })();

  function getEquipoId() {
    const url = new URL(window.location.href);
    return url.searchParams.get('id');
  }

  function getAuthToken() {
    try {
      const t = localStorage.getItem('authToken');
      if (t) return t;
      const userData = localStorage.getItem('userData');
      if (userData) {
        const u = JSON.parse(userData);
        if (u && u.token) return u.token;
      }
    } catch(_){}
    return '';
  }

  function abrirModalEquipo() {
    const modal = document.getElementById('equipoEditModal');
    if (!modal) return;
    const nombreActual = (document.getElementById('equipo-nombre')?.textContent || '').trim();
    const nombreInput = document.getElementById('editEquipoNombre');
    if (nombreInput) nombreInput.value = nombreActual;
    modal.classList.add('show');
  }

  function cerrarModalEquipo() {
    const modal = document.getElementById('equipoEditModal');
    if (modal) modal.classList.remove('show');
  }

  async function guardarNombreEquipo() {
    const equipoId = getEquipoId();
    const nombreInput = document.getElementById('editEquipoNombre');
    const nombre = (nombreInput?.value || '').trim();
    if (!equipoId || !nombre) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ nombre })
      });
      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof payload === 'string' && payload.trim().startsWith('<')
          ? `Respuesta no-JSON del backend (${res.status}). Revisa autenticación y URL del backend.`
          : (payload?.error || 'No se pudo actualizar equipo');
        throw new Error(msg);
      }
      // Refrescar nombre en la vista
      const nombreEl = document.getElementById('equipo-nombre');
      if (nombreEl) nombreEl.textContent = payload?.equipo?.nombre || nombre;
      alert('Equipo actualizado correctamente');
      cerrarModalEquipo();
    } catch (err) {
      console.error('Error actualizando equipo:', err);
      alert(err.message || 'Error al actualizar equipo');
    }
  }

  async function agregarJugadorModal() {
    const equipoId = getEquipoId();
    const input = document.getElementById('nuevoJugadorNombreModal');
    const feedback = document.getElementById('jugadorModalFeedback');
    const nombre = (input?.value || '').trim();
    if (!equipoId || !nombre) return;
    feedback.textContent = '';
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}/jugadores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ nombre })
      });
      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = typeof payload === 'string' && payload.trim().startsWith('<')
          ? `Respuesta no-JSON del backend (${res.status}). Revisa autenticación y URL del backend.`
          : (payload?.error || 'No se pudo agregar jugador');
        throw new Error(msg);
      }
      feedback.textContent = 'Jugador agregado';
      input.value = '';
      // Refrescar lista de jugadores en la vista principal
      try {
        const resJug = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}/jugadores`);
        const jData = await resJug.json();
        const jugadores = jData.jugadores || [];
        const ul = document.getElementById('jugadores-list');
        const empty = document.getElementById('jugadores-empty');
        if (ul) {
          ul.innerHTML = '';
          if (!jugadores.length) {
            if (empty) empty.style.display = 'block';
          } else {
            if (empty) empty.style.display = 'none';
            jugadores.forEach(j => {
              const li = document.createElement('li');
              const name = document.createElement('span');
              name.className = 'name';
              name.textContent = j.nombre;
              const btn = document.createElement('button');
              btn.textContent = 'Eliminar';
              btn.addEventListener('click', async () => {
                // reutilizar endpoint de eliminación
                try {
                  const tkn = getAuthToken();
                  const del = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}/jugadores/${encodeURIComponent(j.id)}`, {
                    method: 'DELETE',
                    headers: { ...(tkn ? { 'Authorization': `Bearer ${tkn}` } : {}) }
                  });
                  const jr = await del.json().catch(()=>({}));
                  if (!del.ok) throw new Error(jr?.error || 'No se pudo eliminar jugador');
                  li.remove();
                } catch (e) {
                  alert(e.message || 'Error al eliminar jugador');
                }
              });
              li.appendChild(name);
              li.appendChild(btn);
              ul.appendChild(li);
            });
          }
        }
      } catch(_){}
    } catch (err) {
      console.error('Error agregando jugador:', err);
      feedback.textContent = err.message || 'Error agregando jugador';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btnEditarEquipo');
    const btnCancel = document.getElementById('btnCancelarEditarEquipo');
    const btnSave = document.getElementById('btnGuardarEquipo');
    const btnAddPlayer = document.getElementById('btnAgregarJugadorModal');
    const overlay = document.getElementById('equipoEditModal');
    if (btnOpen) btnOpen.addEventListener('click', abrirModalEquipo);
    if (btnCancel) btnCancel.addEventListener('click', cerrarModalEquipo);
    if (btnSave) btnSave.addEventListener('click', guardarNombreEquipo);
    if (btnAddPlayer) btnAddPlayer.addEventListener('click', agregarJugadorModal);
    if (overlay) overlay.addEventListener('click', (e)=>{ if (e.target === overlay) cerrarModalEquipo(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModalEquipo(); });
  });
})();
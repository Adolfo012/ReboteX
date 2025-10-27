// equipo-show.js - Vista moderna con CRUD de jugadores
(() => {
  function getQueryParam(name) {
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

  function getAuthToken() {
    try { return localStorage.getItem('authToken') || ''; } catch { return ''; }
  }

  function getCurrentUserId() {
    try {
      const ud = localStorage.getItem('userData');
      if (!ud) return null;
      const u = JSON.parse(ud);
      return u?.id || (u?.user && u.user.id) || null;
    } catch(_) { return null; }
  }

  async function loadSlidebar() {
    try {
      const el = document.getElementById('slidebar');
      if (!el) return;
      const res = await fetch('../client/slidebar.html');
      if (!res.ok) return;
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const sidebar = doc.querySelector('.sidebar');
      el.innerHTML = sidebar ? sidebar.outerHTML : html;
    } catch {}
  }

  async function cargarEquipo(equipoId) {
    try {
      const res = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}`);
      if (!res.ok) throw new Error('No se pudo obtener el equipo');
      const data = await res.json();
      const e = data.equipo || {};
      window._equipoData = e;
      document.getElementById('equipo-nombre').textContent = e.nombre || '—';
      const repNombre = `${e.capitan_nombre||''} ${e.capitan_apellido||''}`.trim();
      document.getElementById('equipo-representante').textContent = repNombre || '—';
      document.getElementById('equipo-deporte').textContent = e.deporte || '—';
      const uidEl = document.getElementById('equipo-uid');
      if (uidEl) uidEl.textContent = (e.equipo_uid != null && e.equipo_uid !== '') ? String(e.equipo_uid) : '—';
      const linkEditar = document.getElementById('link-editar');
      if (linkEditar) linkEditar.href = `../Equipos/edit.html?id=${encodeURIComponent(equipoId)}`;
    } catch (err) {
      document.getElementById('equipo-nombre').textContent = 'Equipo no encontrado';
      const fb = document.getElementById('jugadores-feedback');
      if (fb) fb.textContent = `No se pudo cargar el equipo (API: ${API_URL}). Usa ?id=<ID> y asegúrate de apuntar al backend correcto.`;
    }
  }

  function renderJugadores(jugadores, equipoId) {
    const ul = document.getElementById('jugadores-list');
    const emptyMsg = document.getElementById('jugadores-empty');
    ul.innerHTML = '';
    if (!jugadores || jugadores.length === 0) {
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';
    jugadores.forEach(j => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = j.nombre;
      const btn = document.createElement('button');
      btn.textContent = 'Eliminar';
      btn.addEventListener('click', () => eliminarJugador(equipoId, j.id));
      li.appendChild(name);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  async function cargarJugadores(equipoId) {
    try {
      const res = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}/jugadores`);
      if (!res.ok) throw new Error('No se pudieron obtener jugadores');
      const data = await res.json();
      renderJugadores(data.jugadores || [], equipoId);
    } catch {
      renderJugadores([], equipoId);
    }
  }

  function renderTorneos(torneos) {
    const tbody = document.getElementById('torneos-tbody');
    const tableScroll = document.getElementById('torneos-table-scroll');
    const emptyMsg = document.getElementById('torneos-empty');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!torneos || torneos.length === 0) {
      if (tableScroll) tableScroll.style.display = 'none';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }
    if (tableScroll) tableScroll.style.display = '';
    if (emptyMsg) emptyMsg.style.display = 'none';

    torneos.forEach(t => {
      const tr = document.createElement('tr');
      const tdNombre = document.createElement('td');
      const tdP = document.createElement('td'); // Partidos jugados
      const tdV = document.createElement('td'); // Victorias
      const tdD = document.createElement('td'); // Derrotas

      tdNombre.textContent = t.nombre || '—';
      // Stats por torneo para este equipo: usamos valores si existen, si no "—"
      const partidos = t.partidos_jugados ?? t.P ?? '—';
      const victorias = t.partidos_ganados ?? t.V ?? '—';
      const derrotas = t.partidos_perdidos ?? t.D ?? '—';

      tdP.textContent = partidos;
      tdV.textContent = victorias;
      tdD.textContent = derrotas;

      tr.appendChild(tdNombre);
      tr.appendChild(tdP);
      tr.appendChild(tdV);
      tr.appendChild(tdD);

      tr.addEventListener('click', () => {
        if (t.id) {
          window.location.href = `../torneo/show.html?id=${encodeURIComponent(t.id)}`;
        }
      });

      tbody.appendChild(tr);
    });
  }

  async function cargarTorneos(equipoId) {
    try {
      const res = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}/torneos`);
      if (!res.ok) throw new Error('No se pudieron obtener torneos');
      const data = await res.json();
      renderTorneos(data.torneos || []);
    } catch {
      renderTorneos([]);
    }
  }

  async function agregarJugador(equipoId, nombre) {
    const feedback = document.getElementById('jugadores-feedback');
    if (feedback) feedback.textContent = '';
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo agregar jugador');
      feedback.textContent = 'Jugador agregado';
      await cargarJugadores(equipoId);
    } catch (err) {
      feedback.textContent = err.message || 'Error agregando jugador';
    }
  }

  // Modal de confirmación reutilizando el estilo del modal de cerrar sesión
  function ensureDeleteJugadorModal() {
    if (document.getElementById('deleteJugadorModal')) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'deleteJugadorModal';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-icon"><i class="fas fa-user-minus"></i></div>
          <h3 class="modal-title">Confirmar eliminación</h3>
        </div>
        <div class="modal-body">
          <p>¿Seguro que deseas eliminar este jugador?</p>
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel-btn" id="delJugadorCancelBtn">
            <i class="fas fa-times"></i>
            Cancelar
          </button>
          <button class="modal-btn confirm-btn" id="delJugadorConfirmBtn">
            <i class="fas fa-check"></i>
            Confirmar
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector('#delJugadorCancelBtn');
    cancelBtn?.addEventListener('click', () => {
      overlay.classList.remove('show');
    });

    // Cerrar modal al hacer clic fuera del contenido
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
    });

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      const current = document.getElementById('deleteJugadorModal');
      if (e.key === 'Escape') current?.classList.remove('show');
    });
  }

  function showDeleteJugadorModal(onConfirm) {
    ensureDeleteJugadorModal();
    const overlay = document.getElementById('deleteJugadorModal');
    if (!overlay) return;
    overlay.classList.add('show');
    const confirmBtn = overlay.querySelector('#delJugadorConfirmBtn');
    if (confirmBtn) {
      // Evitar múltiples listeners: usar { once: true }
      confirmBtn.addEventListener('click', () => {
        onConfirm?.();
      }, { once: true });
    }
  }

  async function eliminarJugador(equipoId, jugadorId) {
    showDeleteJugadorModal(async () => {
      const feedback = document.getElementById('jugadores-feedback');
      if (feedback) feedback.textContent = '';
      const overlay = document.getElementById('deleteJugadorModal');
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/api/equipos/${encodeURIComponent(equipoId)}/jugadores/${encodeURIComponent(jugadorId)}`, {
          method: 'DELETE',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        const ct = res.headers.get('content-type') || '';
        const payload = ct.includes('application/json') ? await res.json() : await res.text();
        if (!res.ok) {
          const msg = typeof payload === 'string' && payload.trim().startsWith('<')
            ? `Respuesta no-JSON del backend (${res.status}). Revisa autenticación y URL del backend.`
            : (payload?.error || 'No se pudo eliminar jugador');
          throw new Error(msg);
        }
        // Éxito: cerrar modal y mostrar toast reutilizando estilos de auth.js
        overlay?.classList.remove('show');
        if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
        if (typeof showLogoutToast === 'function') {
          showLogoutToast('Jugador eliminado', '');
        } else {
          // Fallback si no está disponible el toast
          if (feedback) feedback.textContent = 'Jugador eliminado';
          else alert('Jugador eliminado');
        }
        await cargarJugadores(equipoId);
      } catch (err) {
        const msg = err.message || 'Error eliminando jugador';
        if (feedback) feedback.textContent = msg;
        else alert(msg);
        // En caso de error, mantener o cerrar el modal según preferencia; cerramos.
        overlay?.classList.remove('show');
      }
    });
  }

  function setupCopyUid() {
    const btn = document.getElementById('copy-uid-btn');
    const uidEl = document.getElementById('equipo-uid');
    if (!btn || !uidEl) return;
    btn.addEventListener('click', async () => {
      const uid = (uidEl.textContent || '').trim();
      if (!uid || uid === '—') return;
      try {
        await navigator.clipboard.writeText(uid);
        btn.classList.add('copied');
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fas fa-check';
        setTimeout(() => {
          btn.classList.remove('copied');
          if (icon) icon.className = 'fas fa-copy';
        }, 1200);
      } catch (_) {
        // Fallback para navegadores sin Clipboard API
        try {
          const temp = document.createElement('input');
          temp.value = uid;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          document.body.removeChild(temp);
          btn.classList.add('copied');
          const icon = btn.querySelector('i');
          if (icon) icon.className = 'fas fa-check';
          setTimeout(() => {
            btn.classList.remove('copied');
            if (icon) icon.className = 'fas fa-copy';
          }, 1200);
        } catch (e) {}
      }
    });
  }

  function setupFormulario(equipoId) {
    const form = document.getElementById('form-agregar-jugador');
    const input = document.getElementById('nuevo-jugador-nombre');
    if (!form || !input) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = (input.value || '').trim();
      if (!nombre) return;
      agregarJugador(equipoId, nombre);
      input.value = '';
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // En esta vista usamos el header común; no cargamos el slidebar.
    const equipoId = getQueryParam('id');
    if (!equipoId) {
      document.getElementById('equipo-nombre').textContent = 'ID de equipo no proporcionado';
      return;
    }
    await cargarEquipo(equipoId);
    setupCopyUid();
    await cargarJugadores(equipoId);
    await cargarTorneos(equipoId);
    setupFormulario(equipoId);
  });
})();
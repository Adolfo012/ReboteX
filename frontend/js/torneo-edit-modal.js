// torneo-edit-modal.js - Lógica del modal futurista de edición en torneo/show.html

// Base de backend
const EDIT_API_URL = window.REBOTE_BACKEND_URL || 'https://rebotex-backend.onrender.com';

function obtenerIdTorneoEdit() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

function abrirEditar() {
  const modal = document.getElementById('editModal');
  if (!modal) return;
  const d = window._torneoData || {};
  const nombre = document.getElementById('editNombre');
  const ubicacion = document.getElementById('editUbicacion');
  const descripcion = document.getElementById('editDescripcion');
  const inicio = document.getElementById('editFechaInicio');
  const fin = document.getElementById('editFechaFin');

  if (nombre) nombre.value = d?.nombre || '';
  if (ubicacion) ubicacion.value = d?.ubicacion || '';
  if (descripcion) descripcion.value = d?.descripcion || '';
  if (inicio) inicio.value = d?.fecha_inicio ? (new Date(d.fecha_inicio)).toISOString().slice(0, 10) : '';
  if (fin) fin.value = d?.fecha_fin ? (new Date(d.fecha_fin)).toISOString().slice(0, 10) : '';

  modal.classList.add('show');
}

function cerrarEditar() {
  const modal = document.getElementById('editModal');
  if (modal) modal.classList.remove('show');
}

async function guardarCambiosTorneo() {
  const torneoId = (window._torneoData && window._torneoData.id) || obtenerIdTorneoEdit();
  if (!torneoId) {
    if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
    if (typeof showFxToast === 'function') {
      showFxToast('Error', 'No se pudo determinar el torneo a editar', 3000);
    } else {
      console.warn('No se pudo determinar el torneo a editar');
    }
    return;
  }
  const nombre = document.getElementById('editNombre')?.value?.trim();
  const descripcion = document.getElementById('editDescripcion')?.value?.trim() || null;
  const ubicacion = document.getElementById('editUbicacion')?.value?.trim() || null;
  const fecha_inicio = document.getElementById('editFechaInicio')?.value || null;
  const fecha_fin = document.getElementById('editFechaFin')?.value || null;

  if (!nombre) {
    if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
    if (typeof showFxToast === 'function') {
      showFxToast('Campo requerido', 'El nombre del torneo es obligatorio', 3000);
    } else {
      console.warn('El nombre es obligatorio');
    }
    return;
  }

  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  try {
    const res = await fetch(`${EDIT_API_URL}/api/torneos/${torneoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ nombre, descripcion, ubicacion, fecha_inicio, fecha_fin })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);

    // Actualizar estado local y UI
    window._torneoData = { id: torneoId, nombre, descripcion, ubicacion, fecha_inicio, fecha_fin };
    const tituloElement = document.getElementById('torneo-titulo');
    if (tituloElement) tituloElement.textContent = nombre;
    const inicioEl = document.getElementById('torneo-fecha-inicio');
    if (inicioEl) inicioEl.textContent = fecha_inicio || '';
    const finEl = document.getElementById('torneo-fecha-fin');
    if (finEl) finEl.textContent = fecha_fin || '';
    if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
    if (typeof showLogoutToast === 'function') {
      showLogoutToast('Torneo actualizado', 'Cambios guardados');
    } else if (typeof showFxToast === 'function') {
      showFxToast('Torneo actualizado', 'Cambios guardados', 2500);
    }
    cerrarEditar();
  } catch (err) {
    console.error('Error guardando cambios:', err);
    if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
    if (typeof showFxToast === 'function') {
      showFxToast('Error al actualizar', err?.message ? String(err.message) : 'Intenta nuevamente más tarde', 3000);
    } else {
      console.warn(`No se pudo actualizar el torneo: ${err?.message || err}`);
    }
  }
}

async function invitarEquipoAlTorneo() {
  const torneoId = (window._torneoData && window._torneoData.id) || obtenerIdTorneoEdit();
  const raw = (document.getElementById('inviteEquipoId')?.value || '').trim();
  const feedback = document.getElementById('inviteFeedback');
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');

  if (!torneoId || !raw) {
    if (feedback) feedback.textContent = 'Debes indicar el ID o UID del equipo.';
    return;
  }
  try {
    let payload = { torneo_id: Number(torneoId) };
    if (/^\d{12}$/.test(raw)) {
      payload.equipo_uid = raw; // UID de 12 dígitos
    } else if (/^\d+$/.test(raw)) {
      payload.equipo_id = Number(raw);
    } else {
      if (feedback) feedback.textContent = 'Formato inválido: ingresa solo dígitos (ID o UID).';
      return;
    }
    const res = await fetch(`${EDIT_API_URL}/api/notificaciones/invitar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);
    if (feedback) feedback.textContent = 'Invitación enviada correctamente.';
    const input = document.getElementById('inviteEquipoId');
    if (input) input.value = '';
  } catch (err) {
    console.error('Error al invitar equipo:', err);
    if (feedback) feedback.textContent = `Error al invitar: ${err.message}`;
  }
}

// Wiring de eventos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  const btnAbrirEditar = document.getElementById('btnAbrirEditar');
  const btnCancelarEditar = document.getElementById('btnCancelarEditar');
  const btnGuardarCambios = document.getElementById('btnGuardarCambios');
  const btnInvitarEquipo = document.getElementById('btnInvitarEquipo');

  if (btnAbrirEditar) btnAbrirEditar.addEventListener('click', abrirEditar);
  if (btnCancelarEditar) btnCancelarEditar.addEventListener('click', cerrarEditar);
  if (btnGuardarCambios) btnGuardarCambios.addEventListener('click', guardarCambiosTorneo);
  if (btnInvitarEquipo) btnInvitarEquipo.addEventListener('click', invitarEquipoAlTorneo);

  // Cerrar modal al hacer clic fuera
  document.addEventListener('click', function(event) {
    const editModal = document.getElementById('editModal');
    if (editModal && event.target === editModal) {
      cerrarEditar();
    }
  });
  // Escape
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      cerrarEditar();
    }
  });
});
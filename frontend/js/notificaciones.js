// notificaciones.js - Cargar y gestionar notificaciones (invitaciones/solicitudes)

// Evita conflicto con API_URL de otros módulos (dashboard.js)
const NOTIS_API_URL = (typeof API_URL !== 'undefined')
  ? API_URL
  : (window.REBOTE_BACKEND_URL || 'https://rebotex-backend.onrender.com');

// Obtener token de autenticación desde localStorage
function getAuthToken() {
  try {
    // Preferir 'authToken' guardado por login.js
    const t = localStorage.getItem('authToken');
    if (t) return t;
    // Fallback: algunos módulos guardan token dentro de userData
    const userData = localStorage.getItem('userData');
    if (userData) {
      const u = JSON.parse(userData);
      if (u && u.token) return u.token;
    }
  } catch (_) {}
  return '';
}

function getCurrentUser() {
  try {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (_) {
    return null;
  }
}

function renderEmpty(container, message = 'No hay elementos pendientes') {
  container.classList.add('empty');
  container.innerHTML = `<div>${message}</div>`;
}

function renderItems(container, items, type) {
  container.classList.remove('empty');
  if (!items || items.length === 0) {
    renderEmpty(container, 'Nada por aquí por ahora');
    return;
  }

  container.innerHTML = items.map(item => {
    const message = type === 'capitan'
      ? `Se te ha invitado a ti y a tu equipo "${item.equipo_nombre}" al torneo "${item.torneo_nombre}"`
      : `El equipo "${item.equipo_nombre}" solicita unirse al torneo "${item.torneo_nombre}"`;

    const meta = type === 'capitan'
      ? `Organizador: ${item.organizador_nombre || 'N/D'}`
      : `Capitán: ${item.capitan_nombre || 'N/D'}`;

    return `
      <article class="notif-card" data-id="${item.id}">
        <div>
          <div class="message">${message}</div>
          <div class="meta">${meta}</div>
        </div>
        <div class="notif-actions">
          <button class="btn btn-accept" data-action="aceptar">Aceptar</button>
          <button class="btn btn-reject" data-action="rechazar">Rechazar</button>
        </div>
      </article>
    `;
  }).join('');
}

async function cargarNotificaciones() {
  const usuario = getCurrentUser();
  const token = getAuthToken();
  const capitanContainer = document.getElementById('notis-capitan');
  const organizadorContainer = document.getElementById('notis-organizador');

  if (!usuario || !token) {
    renderEmpty(capitanContainer, 'Debes iniciar sesión para ver notificaciones');
    renderEmpty(organizadorContainer, 'Debes iniciar sesión para ver notificaciones');
    return;
  }

  try {
    const res = await fetch(`${NOTIS_API_URL}/api/notificaciones`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    // Filtro defensivo: evitar duplicados si el backend devuelve el mismo registro en ambos paneles
    const invitaciones = Array.isArray(raw.invitaciones_capitan) ? raw.invitaciones_capitan : [];
    const solicitudes = Array.isArray(raw.solicitudes_organizador) ? raw.solicitudes_organizador : [];

    const invitacionIds = new Set(invitaciones.map(i => String(i.id)));
    const solicitudesSinDuplicar = solicitudes.filter(s => !invitacionIds.has(String(s.id)));

    // Si viene el campo 'origen', reforzamos el filtro por tipo
    const invitacionesFinal = invitaciones.filter(i => !i.origen || i.origen === 'invitacion');
    const solicitudesFinal = solicitudesSinDuplicar.filter(s => !s.origen || s.origen === 'solicitud');

    renderItems(capitanContainer, invitacionesFinal, 'capitan');
    renderItems(organizadorContainer, solicitudesFinal, 'organizador');

    // Attach action listeners
    attachActionHandlers(capitanContainer);
    attachActionHandlers(organizadorContainer);

    // Actualizar burbuja del header si está disponible
    const totalCount = (invitacionesFinal?.length || 0) + (solicitudesFinal?.length || 0);
    if (typeof window.updateNotificationBadge === 'function') {
      window.updateNotificationBadge(totalCount);
    }
  } catch (err) {
    console.error('Error cargando notificaciones', err);
    renderEmpty(capitanContainer, 'Error al cargar notificaciones');
    renderEmpty(organizadorContainer, 'Error al cargar notificaciones');
  }
}

function attachActionHandlers(container) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const card = btn.closest('.notif-card');
    const id = card?.getAttribute('data-id');
    if (!id) return;

    btn.disabled = true;
    try {
      const token = getAuthToken();
      const res = await fetch(`${NOTIS_API_URL}/api/notificaciones/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Remove the card on success
      card.remove();
      // If container now empty, render empty state
      if (!container.querySelector('.notif-card')) {
        renderEmpty(container, 'Nada por aquí por ahora');
      }

      // Recalcular y actualizar burbuja del header
      try {
        const totalRemaining = (document.querySelectorAll('#notis-capitan .notif-card').length)
          + (document.querySelectorAll('#notis-organizador .notif-card').length);
        if (typeof window.updateNotificationBadge === 'function') {
          window.updateNotificationBadge(totalRemaining);
        }
      } catch(_){}
    } catch (err) {
      console.error('Acción de notificación falló', err);
      btn.disabled = false;
      btn.textContent = 'Reintentar';
    }
  });
}

document.addEventListener('DOMContentLoaded', cargarNotificaciones);
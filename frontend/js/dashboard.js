document.addEventListener('DOMContentLoaded', function() {
    // Inicializar la aplicación
    initializeApp();
});

function initializeApp() {
    // Cargar datos del usuario
    cargarUsuario();

    // Mostrar placeholders de carga inicial para evitar contenedores vacíos
    const torneosWrapper = document.querySelector('#torneos-swiper .swiper-wrapper');
    if (torneosWrapper) {
        torneosWrapper.innerHTML = '<div class="swiper-slide"><div class="loading-card">Cargando torneos…</div></div>';
    }
    const equiposWrapper = document.querySelector('#equipos-swiper .swiper-wrapper');
    if (equiposWrapper) {
        equiposWrapper.innerHTML = '<div class="swiper-slide"><div class="loading-card">Cargando equipos…</div></div>';
    }

    // Cargar torneos y equipos
    cargarTorneos();
    cargarEquipos();
    
    // Inicializar eventos de navegación
    initializeNavigation();

    // Próximos partidos (solo si la vista los contiene)
    try {
      const matchesContainer = document.querySelector('.matches-container');
      if (matchesContainer) {
        cargarProximosPartidos();
      }
    } catch (_) {}
}

function initializeNavigation() {
    // Agregar eventos a los enlaces de navegación
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const action = this.textContent.trim();
            
            switch(action) {
                case 'Crear Torneo':
                    window.location.href = '../torneo/create.html';
                    break;
                case 'Crear Equipo':
                    window.location.href = '../Equipos/create.html';
                    break;
                case 'Notificaciones':
                    // Implementar notificaciones
                    console.log('Notificaciones');
                    break;
                case 'Perfil':
                    // Implementar perfil
                    console.log('Perfil');
                    break;
                case 'Sobre Nosotros':
                    // Implementar sobre nosotros
                    console.log('Sobre Nosotros');
                    break;
            }
        });
    });
} 

// 🔥 FUNCIONALIDAD PARA CARGAR TORNEOS DINÁMICAMENTE 🔥

// Configuración del backend (soporta ?backend=, getBackendUrl y fallback remoto)
function getQueryParam(name) {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  } catch (_) { return null; }
}

const API_URL = (() => {
  const qp = getQueryParam('backend');
  const cfg = (typeof window.getBackendUrl === 'function')
    ? window.getBackendUrl()
    : (window.REBOTE_BACKEND_URL || null);
  return qp || cfg || 'https://rebotex-backend.onrender.com';
})();

// ====== Notificaciones: burbuja de conteo en el botón del header ======
function ensureNavBadgeStyles() {
  if (document.getElementById('nav-badge-styles')) return;
  const style = document.createElement('style');
  style.id = 'nav-badge-styles';
  style.textContent = `
    .header-nav .nav-btn { position: relative; }
    .header-nav .nav-btn .notif-badge {
      position: absolute;
      top: -6px;
      right: -8px;
      background: #ff3b3b;
      color: #ffffff;
      border-radius: 999px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      font-size: 12px;
      line-height: 18px;
      text-align: center;
      box-shadow: 0 6px 16px rgba(255, 59, 59, 0.35);
      border: 2px solid rgba(255, 255, 255, 0.1);
      display: none;
      z-index: 2;
    }
    .header-nav .nav-btn .notif-badge.show { display: inline-block; }
  `;
  document.head.appendChild(style);
}

function getAuthTokenForBadge() {
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

function findNotificacionesLink() {
  // Buscar el enlace al módulo de Notificaciones por href o por icono
  const byHref = document.querySelector('.header-nav a[href*="Notificaciones/Notis.html"]');
  if (byHref) return byHref;
  // Fallback: primer nav-btn con icono campana
  const byIcon = Array.from(document.querySelectorAll('.header-nav .nav-btn')).find(a => a.querySelector('.fa-bell'));
  return byIcon || null;
}

async function fetchNotificationCount() {
  const token = getAuthTokenForBadge();
  if (!token) return 0;
  try {
    const res = await fetch(`${API_URL}/api/notificaciones`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const invitaciones = Array.isArray(data.invitaciones_capitan) ? data.invitaciones_capitan.length : 0;
    const solicitudes = Array.isArray(data.solicitudes_organizador) ? data.solicitudes_organizador.length : 0;
    return invitaciones + solicitudes;
  } catch(_) {
    return 0;
  }
}

async function updateNotificationBadge(countOverride) {
  ensureNavBadgeStyles();
  const link = findNotificacionesLink();
  if (!link) return;
  let badge = link.querySelector('.notif-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'notif-badge';
    link.appendChild(badge);
  }

  const count = typeof countOverride === 'number' ? countOverride : await fetchNotificationCount();
  const clamped = Math.max(0, Math.min(99, count));
  if (clamped > 0) {
    badge.textContent = String(clamped);
    badge.classList.add('show');
  } else {
    badge.textContent = '';
    badge.classList.remove('show');
  }
}

// Exponer para que otras páginas puedan forzar actualización
window.updateNotificationBadge = updateNotificationBadge;

document.addEventListener('DOMContentLoaded', () => {
  // Actualizar al cargar y cada 60s
  updateNotificationBadge();
  try {
    if (!window.__notifBadgeInterval) {
      window.__notifBadgeInterval = setInterval(() => updateNotificationBadge(), 60000);
    }
  } catch(_){}
});

// ---- Cache de Equipos (para pintar inmediatamente al recargar) ----
const EQUIPOS_CACHE_KEY = 'rebotex_equipos_cache';
const EQUIPOS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
let equiposSwiperInstance = null;

function setEquiposCache(userId, equipos) {
    try {
        const payload = {
            userId,
            ts: Date.now(),
            equipos: (equipos || []).map(eq => ({
                id: eq.id,
                nombre: eq.nombre,
                capitan_nombre: eq.capitan_nombre,
                jugadores_count: eq.jugadores_count || 0,
                torneos_count: eq.torneos_count || 0
            }))
        };
        localStorage.setItem(EQUIPOS_CACHE_KEY, JSON.stringify(payload));
    } catch (_) {}
}

function getEquiposCache(userId) {
    try {
        const raw = localStorage.getItem(EQUIPOS_CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.userId !== userId) return null;
        if ((Date.now() - (data.ts || 0)) > EQUIPOS_CACHE_TTL_MS) return null;
        return Array.isArray(data.equipos) ? data.equipos : null;
    } catch (_) { return null; }
}

// Función para obtener el usuario actual del localStorage
function getCurrentUser() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        return JSON.parse(userData);
    }
    return null;
}

// Helper para obtener token desde almacenamiento (fallback si userData.token no está)
function getAuthToken() {
  try {
    const t = localStorage.getItem('authToken');
    if (t) return t;
    const userData = localStorage.getItem('userData');
    if (userData) {
      const u = JSON.parse(userData);
      if (u && u.token) return u.token;
    }
  } catch (_){}
  return '';
}

// Función para cargar información del usuario
function cargarUsuario() {
    const usuario = getCurrentUser();
    
    if (usuario) {
        // Actualizar el avatar del usuario en la navbar
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) {
            const iniciales = usuario.nombre ? usuario.nombre.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase() : 'U';
            userAvatar.innerHTML = `<span>${iniciales}</span>`;
            userAvatar.title = usuario.nombre || 'Usuario';
        }
    }
}

// Función para crear tarjeta de torneo con nuevo diseño
function createTorneoCard(torneo, tipo = 'organizador') {
    const fechaInicio = torneo.fecha_inicio ? new Date(torneo.fecha_inicio).toLocaleDateString() : 'No definida';
    const fechaFin = torneo.fecha_fin ? new Date(torneo.fecha_fin).toLocaleDateString() : 'No definida';
    const estado = torneo.estado || 'Activo';
    const equiposCount = torneo.equipos_count || 0;
    const statusClass = (estado || '').toLowerCase() === 'activo' ? 'status-active' : 'status-default';
    const uid = torneo.torneo_uid || torneo.uid || '—';
    const modalidad = torneo.modalidad || '—';
    const rolBackend = torneo.rol || (tipo === 'organizador' ? 'Organizador' : 'Capitán');
    const equipoNombre = torneo.equipo_nombre || torneo.equipoNombre || torneo.equipo || '';
    const rolTexto = (rolBackend && rolBackend.toLowerCase() === 'capitán' && equipoNombre)
        ? `Capitán de ${equipoNombre}`
        : rolBackend;

    return `
        <div class="swiper-slide">
            <div class="tournament-card" onclick="navigateToTorneo(${torneo.id})">
                <div class="tournament-header">
                    <h3 class="tournament-title">${torneo.nombre}</h3>
                    <span class="tournament-status ${statusClass}">${estado}</span>
                </div>
                
                <div class="tournament-info">
                    <p><span class="info-label">Modalidad:</span> <span class="info-value">${modalidad}</span></p>
                    <p><span class="info-label">UID:</span> <span class="info-value">${uid}</span></p>
                    <p><span class="info-label">Rol:</span> <span class="info-value">${rolTexto}</span></p>
                    <p><span class="info-label">Fecha de fin:</span> <span class="info-value">${fechaFin}</span></p>
                    <p><span class="info-label"># de equipos:</span> <span class="info-value">${equiposCount}</span></p>
                </div>
                
            </div>
        </div>
    `;
}

// Función para crear tarjeta de equipo con nuevo diseño
function createEquipoCard(equipo) {
    const jugadores = (equipo.jugadores ?? equipo.jugadores_count ?? 0);
    const torneos = (equipo.torneos_count ?? 0);
    return `
        <div class="swiper-slide">
            <div class="team-card" onclick="navigateToEquipo(${equipo.id})">
                <div class="team-header">
                    <div class="team-info">
                        <h3 class="team-title">${equipo.nombre}</h3>
                        <p><span class="team-label">Capitán:</span> <span class="team-value">${equipo.capitan_nombre || 'No asignado'}</span></p>
                    </div>
                </div>
                <div class="team-details">
                    <p><span class="team-label">Jugadores:</span> <span class="team-value">${jugadores}</span></p>
                    <p><span class="team-label">Torneos inscritos:</span> <span class="team-value">${torneos}</span></p>
                </div>
            </div>
        </div>
    `;
}

// Funciones de navegación
function navigateToTorneo(torneoId) {
    window.location.href = `../torneo/show.html?id=${torneoId}`;
}

function navigateToEquipo(equipoId) {
    // Corregido: ruta correcta a la vista del equipo (directorio 'Equipos')
    window.location.href = `../Equipos/show.html?id=${equipoId}`;
}

// ========================
// Próximos partidos (cliente)
// ========================
function parseDateTime(fechaStr, horaStr) {
    try {
        if (!fechaStr || !horaStr) return null;
        const hhmm = String(horaStr).slice(0,5); // "HH:mm" de "HH:mm:ss"
        const [y, m, d] = String(fechaStr).split('-').map(n => parseInt(n, 10));
        const [H, M] = hhmm.split(':').map(n => parseInt(n, 10));
        if (!y || !m || !d) return null;
        const dt = new Date(y, (m - 1), d, (H || 0), (M || 0), 0, 0);
        return isNaN(dt.getTime()) ? null : dt;
    } catch(_) { return null; }
}

function formatDateES(fechaStr) {
    try {
        const d = new Date(fechaStr);
        if (isNaN(d.getTime())) return fechaStr || '';
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch(_) { return fechaStr || ''; }
}

function formatTimeHM(horaStr) {
    if (!horaStr) return '';
    const hhmm = String(horaStr).slice(0,5);
    return hhmm;
}

function createMatchCard(partido, torneoNombre) {
    const dt = parseDateTime(partido.fecha, partido.hora);
    const iso = dt ? dt.toISOString() : '';
    const fechaF = formatDateES(partido.fecha);
    const horaF = formatTimeHM(partido.hora);
    const localName = partido.equipo_local || 'Equipo Local';
    const visitanteName = partido.equipo_visitante || 'Equipo Visitante';
    return `
      <div class="match-card" data-datetime="${iso}">
        <div class="match-header">
          <span class="tournament-name">${torneoNombre || 'Torneo'}</span>
          <span class="match-date">${fechaF || ''}</span>
        </div>
        <div class="match-teams">
          <div class="team local">
            <i class='bx bx-home'></i>
            <span>${localName}</span>
          </div>
          <div class="vs">VS</div>
          <div class="team visitante">
            <span>${visitanteName}</span>
            <i class='bx bx-map'></i>
          </div>
        </div>
        <div class="match-time">
          <i class='bx bx-time'></i>
          <span>${horaF || ''}</span>
        </div>
      </div>
    `;
}

async function cargarProximosPartidos() {
    const container = document.querySelector('.matches-container');
    if (!container) return; // Solo corre en client/dashboard

    // Estado inicial
    container.innerHTML = `<div class="loading-card">Cargando próximos partidos…</div>`;

    try {
        const usuario = getCurrentUser();
        if (!usuario) {
            container.innerHTML = `<p class="description">Debes iniciar sesión para ver tus próximos partidos</p>`;
            return;
        }

        // Torneos del usuario (reutilizar caché si existe)
        let torneosData = window.__TORNEOS_USUARIO;
        if (!torneosData) {
            const resTorneos = await fetch(`${API_URL}/api/torneos/user/${usuario.id}`, {
                headers: { 'Authorization': `Bearer ${usuario.token}` }
            });
            const jsonTorneos = await resTorneos.json();
            torneosData = jsonTorneos.torneos || { organizados: [], participando: [] };
            window.__TORNEOS_USUARIO = torneosData;
        }

        const torneoIds = Array.from(new Set([
            ...((torneosData.organizados || []).map(t => t.id)),
            ...((torneosData.participando || []).map(t => t.id))
        ]));

        // Mapa de nombres de torneo por id
        const torneoNameById = new Map();
        (torneosData.organizados || []).forEach(t => { torneoNameById.set(t.id, t.nombre); });
        (torneosData.participando || []).forEach(t => { if (!torneoNameById.has(t.id)) torneoNameById.set(t.id, t.nombre); });

        if (torneoIds.length === 0) {
            container.innerHTML = `<p class="description">Aún no tienes torneos asociados</p>`;
            return;
        }

        // Equipos del usuario (capitán) por torneo
        const equiposFetches = torneoIds.map(id => 
            fetch(`${API_URL}/api/equipos?torneo=${id}`)
              .then(r => r.json().then(json => ({ torneoId: id, equipos: json.equipos || json || [] })))
              .catch(() => ({ torneoId: id, equipos: [] }))
        );
        const equiposResults = await Promise.all(equiposFetches);
        const equipoIds = new Set();
        (equiposResults || []).forEach(({ equipos }) => {
            (equipos || []).forEach(eq => {
                if (eq && String(eq.creador_id) === String(usuario.id)) {
                    equipoIds.add(Number(eq.id));
                }
            });
        });

        if (equipoIds.size === 0) {
            container.innerHTML = `<p class="description">No tienes equipos como capitán con partidos programados</p>`;
            return;
        }

        // Partidos por torneo
        const partidosFetches = torneoIds.map(id => 
            fetch(`${API_URL}/api/torneos/${id}/partidos`)
              .then(r => r.json().then(json => ({ torneoId: id, partidos: json.partidos || [] })))
              .catch(() => ({ torneoId: id, partidos: [] }))
        );
        const partidosResults = await Promise.all(partidosFetches);
        const ahora = Date.now();

        // Fallback por nombre SOLO para equipos del usuario (capitán)
        const equipoNames = new Set();
        (equiposResults || []).forEach(({ equipos }) => {
            (equipos || []).forEach(eq => {
                if (!eq?.nombre) return;
                if (String(eq.creador_id) !== String(usuario.id)) return;
                equipoNames.add(String(eq.nombre).trim().toLowerCase());
            });
        });

        const proximosMap = new Map();
        partidosResults.forEach(({ torneoId, partidos }) => {
            (partidos || []).forEach(p => {
                const dt = parseDateTime(p.fecha, p.hora);
                const esProgramado = !!dt; // requiere fecha+hora válidas
                const esProximo = esProgramado && (String(p.estado) === 'proximos' || dt.getTime() > ahora);
                const involucraPorId = equipoIds.has(Number(p.local_id)) || equipoIds.has(Number(p.visitante_id));
                const localNameNorm = String(p.equipo_local || '').trim().toLowerCase();
                const visNameNorm = String(p.equipo_visitante || '').trim().toLowerCase();
                const involucraPorNombre = equipoNames.has(localNameNorm) || equipoNames.has(visNameNorm);
                const involucra = involucraPorId || involucraPorNombre;
                if (esProximo && involucra) {
                    const key = p.id ? String(p.id) : `${p.local_id}-${p.visitante_id}-${p.fecha}-${p.hora}`;
                    if (!proximosMap.has(key)) {
                        proximosMap.set(key, { partido: p, torneoId, dt });
                    }
                }
            });
        });
        const proximos = Array.from(proximosMap.values());

        // Orden por más próximo (fecha y hora)
        proximos.sort((a,b) => a.dt.getTime() - b.dt.getTime());

        if (proximos.length === 0) {
            container.innerHTML = `<p class="description">No hay partidos próximos programados</p>`;
            return;
        }

        // Render
        const html = proximos.map(({ partido, torneoId, dt }) => {
            const torneoNombre = torneoNameById.get(torneoId) || 'Torneo';
            return createMatchCard(partido, torneoNombre);
        }).join('');
        container.innerHTML = html;

    } catch (error) {
        console.error('❌ Error al cargar próximos partidos:', error);
        container.innerHTML = `<p class="description">No se pudieron cargar los próximos partidos</p>`;
    }
}

// Función para cargar torneos del usuario
async function cargarTorneos() {
    try {
        const usuario = getCurrentUser();
        if (!usuario) {
            console.error('No se pudo obtener el usuario actual');
            const swiperWrapper = document.querySelector('#torneos-swiper .swiper-wrapper');
            swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="loading-card">Debes iniciar sesión para ver tus torneos</div></div>';
            return;
        }
        // 🔥 FETCH AL BACKEND - OBTENER TORNEOS DEL USUARIO 🔥
        const response = await fetch(`${API_URL}/api/torneos/user/${usuario.id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken() || usuario.token || ''}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const { organizados, participando } = data.torneos || { organizados: [], participando: [] };

        // Guardar torneos del usuario para otros módulos (equipos, próximos partidos)
        window.__TORNEOS_USUARIO = { organizados, participando };

        const swiperWrapper = document.querySelector('#torneos-swiper .swiper-wrapper');
        
        // Limpiar el contenedor
        swiperWrapper.innerHTML = '';

        // Unificar y deduplicar por ID (preferimos rol "organizador" si coincide)
        const torneosMap = new Map();
        (organizados || []).forEach(t => {
            if (!t) return;
            torneosMap.set(t.id, { torneo: t, rol: 'organizador' });
        });
        (participando || []).forEach(t => {
            if (!t) return;
            if (!torneosMap.has(t.id)) {
                torneosMap.set(t.id, { torneo: t, rol: 'participante' });
            }
        });

        const torneosUnicos = Array.from(torneosMap.values());
        let totalTorneos = torneosUnicos.length;
        let torneosHTML = '';

        torneosUnicos.forEach(({ torneo, rol }) => {
            torneosHTML += createTorneoCard(torneo, rol);
        });

        if (totalTorneos === 0) {
            swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="loading-card">No tienes torneos registrados</div></div>';
        } else {
            swiperWrapper.innerHTML = torneosHTML;
        }

        // Inicializar Swiper para torneos
        initializeTorneosSwiper(totalTorneos);

        console.log(`✅ Cargados ${organizados.length} torneos organizados y ${participando.length} como capitán`);

    } catch (error) {
        console.error('❌ Error al cargar torneos:', error);
        const swiperWrapper = document.querySelector('#torneos-swiper .swiper-wrapper');
        swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="loading-card">Error al cargar los torneos</div></div>';
    }
}

// Función para cargar equipos del usuario
async function cargarEquipos() {
    try {
        const usuario = getCurrentUser();
        const swiperWrapper = document.querySelector('#equipos-swiper .swiper-wrapper');

        if (!usuario) {
            swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="loading-card">Debes iniciar sesión para ver tus equipos</div></div>';
            return;
        }

        // Pintar inmediatamente desde cache (si existe y es válido)
        const cachedEquipos = getEquiposCache(usuario.id);
        if (cachedEquipos && cachedEquipos.length > 0) {
            let cachedHTML = '';
            cachedEquipos.forEach(equipo => { cachedHTML += createEquipoCard(equipo); });
            swiperWrapper.innerHTML = cachedHTML;
            initializeEquiposSwiper(cachedEquipos.length);
        }

        // Primero intentar endpoint directo: equipos del usuario (creados por él)
        let equipos = [];
        try {
            const resUserEquipos = await fetch(`${API_URL}/api/equipos/usuario/${usuario.id}`, {
                headers: { 'Authorization': `Bearer ${getAuthToken() || usuario.token || ''}` }
            });
            if (resUserEquipos.ok) {
                const jsonUserEquipos = await resUserEquipos.json();
                equipos = (jsonUserEquipos.equipos || []).map(eq => ({
                    id: eq.id,
                    nombre: eq.nombre,
                    deporte: eq.deporte,
                    creador_id: eq.creador_id,
                    equipo_uid: eq.equipo_uid,
                    capitan_nombre: eq.capitan_nombre,
                    capitan_apellido: eq.capitan_apellido,
                    jugadores_count: eq.jugadores_count ?? eq.jugadores ?? 0,
                    torneos_count: eq.torneos_count ?? 0
                }));
            }
        } catch (_) {}

        // Fallback: si no hay endpoint o falla, usar torneos para reunir equipos
        if (!equipos || equipos.length === 0) {
            let torneosData = window.__TORNEOS_USUARIO;
            if (!torneosData) {
                const resTorneos = await fetch(`${API_URL}/api/torneos/user/${usuario.id}`);
                const jsonTorneos = await resTorneos.json();
                torneosData = jsonTorneos.torneos || { organizados: [], participando: [] };
            }

            const torneoIds = [
                ...((torneosData.organizados || []).map(t => t.id)),
                ...((torneosData.participando || []).map(t => t.id))
            ];

            if (torneoIds.length === 0) {
                swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="loading-card">Aún no hay equipos asociados a tus torneos</div></div>';
                initializeEquiposSwiper(0);
                return;
            }

            const fetches = torneoIds.map(id => 
                fetch(`${API_URL}/api/equipos?torneo=${id}`)
                    .then(r => r.json().then(json => ({ torneoId: id, equipos: json.equipos || json || [] })))
                    .catch(() => ({ torneoId: id, equipos: [] }))
            );
            const results = await Promise.all(fetches);
            const allEquipos = results.flatMap(r => r.equipos || []);

            // Mapear conteo de torneos por equipo
            const torneoCounts = new Map();
            results.forEach(({ torneoId, equipos }) => {
                (equipos || []).forEach(eq => {
                    const set = torneoCounts.get(eq.id) || new Set();
                    set.add(torneoId);
                    torneoCounts.set(eq.id, set);
                });
            });

            // Deduplicar por ID y filtrar por creador
            const equiposMap = new Map();
            allEquipos.forEach(eq => {
                if (!eq) return;
                if (eq && String(eq.creador_id) !== String(usuario.id)) return; // asegurar tipo
                if (!equiposMap.has(eq.id)) {
                    const torneos_count = (torneoCounts.get(eq.id) || new Set()).size;
                    equiposMap.set(eq.id, { ...eq, torneos_count });
                }
            });
            equipos = Array.from(equiposMap.values());
        }

        // Actualizar cache con el resultado más reciente (incluyendo vacío)
        setEquiposCache(usuario.id, equipos);

        // Renderizado
        swiperWrapper.innerHTML = '';
        let totalEquipos = 0;
        let equiposHTML = '';

        if (equipos.length > 0) {
            equipos.forEach(equipo => {
                equiposHTML += createEquipoCard(equipo);
                totalEquipos++;
            });
        }

        if (totalEquipos === 0) {
            swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="loading-card">No tienes equipos como capitán todavía</div></div>';
        } else {
            swiperWrapper.innerHTML = equiposHTML;
        }

        initializeEquiposSwiper(totalEquipos);

    } catch (error) {
        console.error('❌ Error al cargar equipos:', error);
        const swiperWrapper = document.querySelector('#equipos-swiper .swiper-wrapper');
        swiperWrapper.innerHTML = '<div class="swiper-slide"><div class="loading-card">Error al cargar los equipos</div></div>';
    }
}

// Función para inicializar Swiper de torneos
function initializeTorneosSwiper(totalItems) {
    const swiper = new Swiper('#torneos-swiper', {
        slidesPerView: 'auto',
        spaceBetween: 20,
        navigation: {
            nextEl: '#torneos-swiper .swiper-button-next',
            prevEl: '#torneos-swiper .swiper-button-prev',
        },
        breakpoints: {
            320: {
                slidesPerView: 1,
                spaceBetween: 10
            },
            768: {
                slidesPerView: 2,
                spaceBetween: 15
            },
            1024: {
                slidesPerView: 3,
                spaceBetween: 20
            },
            1440: {
                slidesPerView: 4,
                spaceBetween: 20
            },
            1920: {
                slidesPerView: 5,
                spaceBetween: 20
            }
        }
    });

    // Ocultar flechas si hay 4 o menos elementos
    const nextBtn = document.querySelector('#torneos-swiper .swiper-button-next');
    const prevBtn = document.querySelector('#torneos-swiper .swiper-button-prev');
    
    if (totalItems <= 4) {
        nextBtn.style.display = 'none';
        prevBtn.style.display = 'none';
    } else {
        nextBtn.style.display = 'flex';
        prevBtn.style.display = 'flex';
    }
}

// Función para inicializar Swiper de equipos
function initializeEquiposSwiper(totalItems) {
    // Evitar instancias duplicadas al re-renderizar
    if (equiposSwiperInstance) {
        try { equiposSwiperInstance.destroy(true, true); } catch (_) {}
        equiposSwiperInstance = null;
    }
    equiposSwiperInstance = new Swiper('#equipos-swiper', {
        slidesPerView: 'auto',
        spaceBetween: 20,
        navigation: {
            nextEl: '#equipos-swiper .swiper-button-next',
            prevEl: '#equipos-swiper .swiper-button-prev',
        },
        breakpoints: {
            320: {
                slidesPerView: 1,
                spaceBetween: 10
            },
            768: {
                slidesPerView: 2,
                spaceBetween: 15
            },
            1024: {
                slidesPerView: 3,
                spaceBetween: 20
            },
            1440: {
                slidesPerView: 4,
                spaceBetween: 20
            },
            1920: {
                slidesPerView: 5,
                spaceBetween: 20
            }
        }
    });

    // Ocultar flechas si hay 5 o menos elementos
    const nextBtn = document.querySelector('#equipos-swiper .swiper-button-next');
    const prevBtn = document.querySelector('#equipos-swiper .swiper-button-prev');
    
    // Mostrar navegación si hay más de 4 equipos
    if (totalItems <= 4) {
        nextBtn.style.display = 'none';
        prevBtn.style.display = 'none';
    } else {
        nextBtn.style.display = 'flex';
        prevBtn.style.display = 'flex';
    }
}

// Nota: cargarTorneos se llama desde initializeApp() al cargar la página

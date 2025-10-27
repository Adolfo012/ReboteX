// show-torneo.js - Cargar información dinámica del torneo
// Confirmación estilizada para eliminar equipo (usa clases de modal existentes)
let _delEqHandler = null;
function ensureDeleteEquipoModal(){
  if(document.getElementById('deleteEquipoModal'))return;
  const o=document.createElement('div');
  o.className='modal-overlay';
  o.id='deleteEquipoModal';
  o.innerHTML=`<div class="modal-content"><div class="modal-header"><div class="modal-icon"><i class="fas fa-users-slash"></i></div><h3 class="modal-title">Eliminar equipo del torneo</h3></div><div class="modal-body"><p>¿Seguro que deseas eliminar al siguiente equipo del torneo?</p><p class="modal-warning">Nombre: <span id="deleteEquipoName">—</span></p></div><div class="modal-actions"><button class="modal-btn cancel-btn" id="deleteEquipoCancelBtn"><i class="fas fa-times"></i>Cancelar</button><button class="modal-btn confirm-btn" id="deleteEquipoConfirmBtn"><i class="fas fa-check"></i>Confirmar</button></div></div>`;
  document.body.appendChild(o);
  o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')o.classList.remove('show');});
  o.querySelector('#deleteEquipoCancelBtn')?.addEventListener('click',()=>o.classList.remove('show'));
  o.querySelector('#deleteEquipoConfirmBtn')?.addEventListener('click',async()=>{try{if(typeof _delEqHandler==='function')await _delEqHandler();}finally{_delEqHandler=null;o.classList.remove('show');}});
}
function showDeleteEquipoModal(nombre,onConfirm){
  const o=document.getElementById('deleteEquipoModal');
  if(!o)return; (o.querySelector('#deleteEquipoName')||{}).textContent=nombre; _delEqHandler=onConfirm; o.classList.add('show');
}

// Función para obtener el ID del torneo desde la URL
function obtenerIdTorneo() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}
// Función para obtener el UID del torneo desde la URL (fallback)
function obtenerUidTorneo() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('uid');
}

// Base de backend (rename para evitar colisión con dashboard.js)
const API_BASE = window.REBOTE_BACKEND_URL || 'https://rebotex-backend.onrender.com';

// (Deprecated) La versión original de mostrarInformacionTorneo fue reemplazada por una con fallback.
// Fallback: si el rol tarda en determinarse, mostrar nav de participante
setTimeout(() => {
  const nav = document.querySelector('.futuristic-header .header-nav');
  if (nav && nav.classList.contains('nav-guard')) {
    nav.innerHTML = `
      <a href="../client/dashboard.html" class="nav-btn">
        <i class="fas fa-home"></i><span>Inicio</span>
      </a>
      <a href="../torneo/create.html" class="nav-btn">
        <i class="fas fa-trophy"></i><span>Crear Torneo</span>
      </a>
      <a href="../Equipos/create.html" class="nav-btn">
        <i class="fas fa-users"></i><span>Crear Equipo</span>
      </a>
      <a href="../Notificaciones/Notis.html" class="nav-btn">
        <i class="fas fa-bell"></i><span>Notificaciones</span>
      </a>
      <a href="#" class="nav-btn">
        <i class="fas fa-user"></i><span>Perfil</span>
      </a>
      <a href="../client/Nosotros.html" class="nav-btn">
        <i class="fas fa-info-circle"></i><span>Sobre Nosotros</span>
      </a>
      <button class="nav-btn logout-btn" onclick="cerrarSesion()">
        <i class="fas fa-sign-out-alt"></i><span>Cerrar Sesión</span>
      </button>`;
    nav.classList.remove('nav-guard');
    nav.classList.add('nav-ready');
  }
}, 1200);

// Helper: fetch con fallback (intenta backend configurado y luego el remoto)
async function fetchJson(path) {
    const primaryBase = (typeof window.getBackendUrl === 'function')
        ? window.getBackendUrl()
        : (window.REBOTE_BACKEND_URL || 'https://rebotex-backend.onrender.com');
    const remoteBase = 'https://rebotex-backend.onrender.com';
    const bases = primaryBase && primaryBase !== remoteBase ? [primaryBase, remoteBase] : [remoteBase];

    let lastErr = null;
    for (const base of bases) {
        const url = `${base}${path}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Error ${res.status} al solicitar ${url}`);
            return await res.json();
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error('No se pudo obtener datos del backend');
}
// Resolver ID del torneo desde su UID consultando torneos públicos
async function resolverIdPorUid(uid) {
    if (!uid) return null;
    try {
        const data = await fetchJson(`/api/torneos`);
        const lista = data?.torneos || data || [];
        const hit = lista.find(t => String(t.torneo_uid) === String(uid));
        return hit ? hit.id : null;
    } catch (e) {
        console.error('Fallo al resolver ID por UID:', e);
        return null;
    }
}

// Función para cargar equipos
async function cargarEquipos(torneoId) {
    // Evitar borrar la lista si el ID no está disponible (p.ej., URL con UID)
    if (!torneoId) {
        console.warn('cargarEquipos: torneoId inválido, se omite refresco');
        return;
    }
    try {
        let data;
        try {
            data = await fetchJson(`/api/equipos?torneo=${torneoId}`);
        } catch (errPrimario) {
            // Intento con la nueva ruta pública del backend remoto
            try {
                data = await fetchJson(`/api/torneos/${torneoId}/equipos`);
            } catch (errAlterno) {
                throw errAlterno;
            }
        }
        const equipos = data.equipos || [];
        // Guardar equipos para verificación de participación (capitán u organizador)
        window._lastEquipos = equipos;
        
        console.log('Equipos cargados:', equipos); // Debug
        
        // Actualizar contador de equipos
        const equiposCountElement = document.getElementById('torneo-equipos');
        if (equiposCountElement) {
            equiposCountElement.textContent = equipos.length;
        }
        // Persistir cantidad para PDF
        if (window._torneoInfo) {
            window._torneoInfo.equipos = equipos.length;
        }
        
        // Mostrar lista de equipos
        const equiposLista = document.getElementById('equipos-lista');
        if (equiposLista && equipos.length > 0) {
            const isOrganizer = Boolean(window._isTournamentOrganizer);
            equiposLista.innerHTML = equipos.map(equipo => `
                <div class="team-card" data-equipo-id="${equipo.id}">
                    <div class="team-avatar">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="team-info">
                        <h3 class="team-name">${equipo.nombre}</h3>
                        <p class="team-members">${equipo.jugadores || 0} jugadores</p>
                    </div>
                    <div class="team-stats">
                        <div class="stat">
                            <i class="fas fa-trophy"></i>
                            <span>0</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-star"></i>
                            <span>0</span>
                        </div>
                        ${isOrganizer ? `<button class="team-delete-btn" title="Eliminar equipo" aria-label="Eliminar equipo" data-equipo-id="${equipo.id}"><i class="fas fa-times"></i></button>` : ''}
                    </div>
                </div>
            `).join('');
        } else if (equiposLista) {
            equiposLista.innerHTML = '<p style="text-align: center; color: #cccccc;">No hay equipos registrados</p>';
        }
        
    } catch (error) {
        console.error('Error al cargar equipos:', error);
        const equiposCountElement = document.getElementById('torneo-equipos');
        if (equiposCountElement) equiposCountElement.textContent = '0';
        const equiposLista = document.getElementById('equipos-lista');
        if (equiposLista) equiposLista.innerHTML = '<p style="text-align: center; color: #cccccc;">No se pudieron cargar equipos desde el backend en línea.</p>';
    }
}

// Función para cargar partidos
async function cargarPartidos(torneoId) {
    try {
        let data;
        try {
            data = await fetchJson(`/api/partidos?torneo=${torneoId}`);
        } catch (_err) {
            // Fallback a nueva ruta en torneos
            data = await fetchJson(`/api/torneos/${torneoId}/partidos`).catch(() => ({ partidos: [] }));
        }
        const partidos = (data?.partidos ?? data) || [];
        // Guardar en memoria para filtros por pestaña
        window._partidosData = partidos;
        // Rellenar selector de jornada con datos actuales
        populateJornadaSelector(partidos);
        
        // Actualizar contador de partidos
        const partidosCountElement = document.getElementById('torneo-partidos');
        if (partidosCountElement) {
            partidosCountElement.textContent = partidos.length;
        }
        // Persistir cantidad para PDF
        if (window._torneoInfo) {
            window._torneoInfo.partidos = partidos.length;
        }
        
        // Render según pestaña activa
        renderPartidosPorTab();

    } catch (error) {
        console.error('Error al cargar partidos:', error);
        const partidosCountElement = document.getElementById('torneo-partidos');
        if (partidosCountElement) partidosCountElement.textContent = '0';
        const partidosLista = document.getElementById('partidos-lista');
        if (partidosLista) partidosLista.innerHTML = '<p style="text-align: center; color: #cccccc;">No se pudieron cargar partidos desde el backend en línea.</p>';
    }
}

// Mapear estado del backend a clases/UI del frontend
function mapBackendEstadoToUi(estado) {
    switch (estado) {
        case 'finalizados': return 'completed';
        case 'proximos': return 'upcoming';
        case 'partidos': return 'unscheduled';
        default: return null;
    }
}

// Función para obtener el estado del partido (preferir backend)
function obtenerEstadoPartido(partido) {
    if (partido && partido.estado) {
        const mapped = mapBackendEstadoToUi(partido.estado);
        if (mapped) return mapped;
    }
    // Fallback: inferencia local si el backend no provee estado
    const rl = (partido.resultado_local ?? partido.puntos_local);
    const rv = (partido.resultado_visitante ?? partido.puntos_visitante);
    const tieneResultado = rl !== null && rl !== undefined && rv !== null && rv !== undefined;
    if (tieneResultado) return 'completed';
    if (!partido.fecha || !partido.hora) return 'unscheduled';
    // Si hay fecha/hora pero no marcador, lo consideramos 'upcoming'
    return 'upcoming';
}

// Función para obtener el texto del estado
function obtenerTextoEstado(partido) {
    if (partido && partido.estado) {
        if (partido.estado === 'finalizados') return '';
        if (partido.estado === 'proximos') return 'Próximo';
        if (partido.estado === 'partidos') return 'Sin programar';
    }
    const rl = (partido.resultado_local ?? partido.puntos_local);
    const rv = (partido.resultado_visitante ?? partido.puntos_visitante);
    const tieneResultado = rl !== null && rl !== undefined && rv !== null && rv !== undefined;
    if (tieneResultado) return '';
    return (partido.fecha && partido.hora) ? 'Próximo' : 'Sin programar';
}

// Render auxiliar según pestaña activa
function renderPartidosLista(partidos) {
    const cont = document.getElementById('partidos-lista');
    if (!cont) return;
    if (!partidos || partidos.length === 0) {
        cont.innerHTML = '<p style="text-align: center; color: #cccccc;">No hay partidos programados</p>';
        return;
    }
    const isOrganizer = Boolean(window._isTournamentOrganizer);
    cont.innerHTML = partidos.map(partido => {
        const scoreLocal = (partido.resultado_local ?? partido.puntos_local ?? 0);
        const scoreVisitante = (partido.resultado_visitante ?? partido.puntos_visitante ?? 0);
        const estado = obtenerEstadoPartido(partido);
        const textoEstado = obtenerTextoEstado(partido);
        return `
        <div class="match-card" data-partido-id="${partido.id}" data-estado="${estado}" data-local-id="${partido.local_id}" data-visitante-id="${partido.visitante_id}" data-local-name="${partido.equipo_local || 'Equipo Local'}" data-visitante-name="${partido.equipo_visitante || 'Equipo Visitante'}" data-rl="${(partido.resultado_local ?? partido.puntos_local ?? '')}" data-rv="${(partido.resultado_visitante ?? partido.puntos_visitante ?? '')}" data-fecha="${partido.fecha || ''}" data-hora="${partido.hora || ''}">
            <div class="match-status">
                <div class="status-indicator ${estado}"></div>
                <span class="status-text">${textoEstado}</span>
                <div class="match-jornada">Jornada ${partido.num_jornada ?? '—'}</div>
                ${isOrganizer ? `
                <button class="schedule-btn top" data-partido-id="${partido.id}">
                    ${estado === 'unscheduled' ? 'Programar' : 'Editar'}
                </button>` : ''}
            </div>
            <div class="match-teams">
                <div class="team local">
                    <div class="team-logo"><i class="fas fa-users"></i></div>
                    <div class="team-name">${partido.equipo_local || 'Equipo Local'}</div>
                    <div class="team-score">${scoreLocal}</div>
                </div>
                <div class="vs-divider">vs</div>
                <div class="team visitor">
                    <div class="team-score">${scoreVisitante}</div>
                    <div class="team-name">${partido.equipo_visitante || 'Equipo Visitante'}</div>
                    <div class="team-logo"><i class="fas fa-users"></i></div>
                </div>
            </div>
            <div class="match-info">
                <div class="match-time"><i class="fas fa-clock"></i>${formatearHora12(partido.hora) || 'Por definir'}</div>
                ${(estado !== 'completed' && Number(scoreLocal) === 0 && Number(scoreVisitante) === 0) ? '<div class="match-favorite"><i class="fas fa-star"></i> Equipo favorito a ganar</div>' : ''}
                <div class="match-date">${formatearFecha(partido.fecha) || 'Fecha por definir'}</div>
            </div>
        </div>
    `;}).join('');

    // Wire acciones de programación (organizador)
    if (isOrganizer) {
        cont.querySelectorAll('.schedule-btn').forEach(btn => {
            btn.addEventListener('click', async (ev) => {
                const card = ev.currentTarget.closest('.match-card');
                const pid = card?.getAttribute('data-partido-id');
                const estado = card?.getAttribute('data-estado');
                if (estado === 'unscheduled') {
                    const currentFecha = card?.querySelector('.match-date')?.textContent || '';
                    const currentHora = card?.querySelector('.match-time')?.textContent?.replace(/^[^0-9]*/,'') || '';
                    showScheduleModal({ partidoId: pid, fecha: normalizeFecha(currentFecha), hora: normalizeHora(currentHora) });
                } else {
                    showEditMatchModal({
                        partidoId: pid,
                        localId: Number(card?.getAttribute('data-local-id') || 0),
                        visitanteId: Number(card?.getAttribute('data-visitante-id') || 0),
                        fecha: card?.getAttribute('data-fecha') || '',
                        hora: card?.getAttribute('data-hora') || '',
                        rl: card?.getAttribute('data-rl') || '',
                        rv: card?.getAttribute('data-rv') || '',
                        localName: card?.getAttribute('data-local-name') || card?.querySelector('.team.local .team-name')?.textContent || 'Local',
                        visitanteName: card?.getAttribute('data-visitante-name') || card?.querySelector('.team.visitor .team-name')?.textContent || 'Visitante'
                    });
                }
            });
        });
    }

    // Actualizar favorito con ML/heurística si aplica
    cont.querySelectorAll('.match-card').forEach(async (card) => {
        const estado = card.getAttribute('data-estado');
        const rl = Number(card.getAttribute('data-rl') || 0);
        const rv = Number(card.getAttribute('data-rv') || 0);
        const tieneScore = Number.isFinite(rl) && Number.isFinite(rv) && (rl !== 0 || rv !== 0);
        if (estado === 'completed' || tieneScore) return;
        const favEl = card.querySelector('.match-favorite');
        if (!favEl) return;
        const pid = card.getAttribute('data-partido-id');
        try {
            favEl.innerHTML = '<i class="fas fa-star"></i> Calculando favorito…';
            const resp = await fetchJson(`/api/partidos/${pid}/favorito`);
            const nombre = resp?.favorito_nombre || 'Equipo favorito a ganar';
            const prob = typeof resp?.prob === 'number' ? Math.round(resp.prob * 100) : null;
            const pct = (prob !== null) ? ` (${prob}%)` : '';
            favEl.innerHTML = `<i class=\"fas fa-star\"></i> ${nombre}${pct}`;
            // Tooltip enriquecido y dinámico con datos de equipos y jugadores
            const src = resp?.source || 'heuristic';
            const e = resp?.explain || {};
            const favId = Number(resp?.favorito_id || 0);
            const num = (v, d=1) => { const x = Number(v); return Number.isFinite(x) ? x.toFixed(d) : '—'; };
            const localName = card.getAttribute('data-local-name') || 'Local';
            const visitName = card.getAttribute('data-visitante-name') || 'Visitante';
            const fechaRaw = card.getAttribute('data-fecha') || '';
            const horaRaw = card.getAttribute('data-hora') || '';
            const fechaStr = formatearFecha(fechaRaw) || 'Fecha por definir';
            const horaStr = formatearHora12(horaRaw) || 'Por definir';

            async function getPlayersMapForTorneo() {
              try {
                const tid = (window._torneoInfo && window._torneoInfo.id) || obtenerIdTorneo();
                if (!tid) return {};
                if (window._torneoPlayersCache && window._torneoPlayersCache.tid === String(tid)) {
                  return window._torneoPlayersCache.map;
                }
                const data = await fetchJson(`/api/torneos/${tid}/jugadores`);
                const arr = Array.isArray(data?.jugadores) ? data.jugadores : [];
                const map = {};
                for (const r of arr) {
                  const team = r.equipo_nombre;
                  if (!map[team]) map[team] = [];
                  map[team].push({ nombre: r.jugador_nombre, tp: Number(r.tp||0), pt: Number(r.pt||0), pd: Number(r.pd||0), tl: Number(r.tl||0) });
                }
                for (const k of Object.keys(map)) map[k].sort((a,b) => (b.tp - a.tp));
                window._torneoPlayersCache = { tid: String(tid), map };
                return map;
              } catch (_) { return {}; }
            }

            function computeStyleFromMetrics(m) {
              if (!m) return null;
              const pa = Number(m.pa || 0);
              const pt = Number(m.pt || 0);
              const pd = Number(m.pd || 0);
              const tl = Number(m.tl || 0);
              if (!Number.isFinite(pa) || pa <= 0) return null;
              const pct3 = Math.max(0, Math.min(100, (pt*3/pa)*100));
              const pct2 = Math.max(0, Math.min(100, (pd*2/pa)*100));
              const pct1 = Math.max(0, Math.min(100, (tl/pa)*100));
              return { pct3, pct2, pct1 };
            }

            function computeStyleFromPlayers(teamName, playersMap) {
              const list = playersMap[teamName] || [];
              if (!list.length) return null;
              let sumPT = 0, sumPD = 0, sumTL = 0;
              for (const p of list) {
                sumPT += Number(p.pt||0);
                sumPD += Number(p.pd||0);
                sumTL += Number(p.tl||0);
              }
              const pa = sumPT*3 + sumPD*2 + sumTL;
              if (!Number.isFinite(pa) || pa <= 0) return null;
              const pct3 = Math.max(0, Math.min(100, (sumPT*3/pa)*100));
              const pct2 = Math.max(0, Math.min(100, (sumPD*2/pa)*100));
              const pct1 = Math.max(0, Math.min(100, (sumTL/pa)*100));
              return { pct3, pct2, pct1 };
            }

            async function buildRichTooltip() {
              let fav = null, opp = null, fm = null, om = null;
              if (e.method === 'heuristic' && e.equipo_a && e.equipo_b) {
                const a = e.equipo_a, b = e.equipo_b;
                fav = (a.id && a.id === favId) ? a : ((b.id && b.id === favId) ? b : null);
                opp = fav === a ? b : (fav === b ? a : null);
                fm = fav; om = opp;
              } else if (e.method === 'model' && Array.isArray(e.equipos)) {
                const a = e.equipos.find(t => Number(t.id) === favId);
                const b = e.equipos.find(t => Number(t.id) !== favId);
                fav = a || null; opp = b || null;
                fm = fav?.metrics || null; om = opp?.metrics || null;
              }

              const parts = [];
              const header = `Partido: ${localName} vs ${visitName} • ${fechaStr} ${horaStr}`;
              const favLabel = `${nombre}${(prob !== null ? ` (${prob}%)` : '')}`;
              parts.push(`${header} • Favorito: ${favLabel}`);

              if (fav && opp) {
                const pgFav = Number(fm?.pg ?? fav.pg ?? 0);
                const ppFav = Number(fm?.pp ?? fav.pp ?? 0);
                const streakFav = Number(fav.streak_wins || 0);
                const pgOpp = Number(om?.pg ?? opp.pg ?? 0);
                const ppOpp = Number(om?.pp ?? opp.pp ?? 0);
                if ((pgFav || ppFav) || (pgOpp || ppOpp)) {
                  const streakTxt = streakFav > 0 ? `, racha ${streakFav}` : '';
                  parts.push(`Forma: ${fav.nombre} ${pgFav}-${ppFav}${streakTxt}; ${opp.nombre} ${pgOpp}-${ppOpp}`);
                }

                const pfFav = Number(fm?.pf_pg ?? fav.pf_pg ?? 0);
                const diffFav = Number(fm?.diff_pg ?? fav.diff_pg ?? 0);
                const pcFav = pfFav - diffFav;
                const pfOpp = Number(om?.pf_pg ?? opp.pf_pg ?? 0);
                const diffOpp = Number(om?.diff_pg ?? opp.diff_pg ?? 0);
                const pcOpp = pfOpp - diffOpp;
                if ((pfFav || pcFav || pfOpp || pcOpp)) {
                  parts.push(`Promedios: ${fav.nombre} PF ${num(pfFav)} / PC ${num(pcFav)}; ${opp.nombre} PF ${num(pfOpp)} / PC ${num(pcOpp)}`);
                }

                let styleFav = computeStyleFromMetrics(fm);
                let styleOpp = computeStyleFromMetrics(om);
                if (!styleFav || !styleOpp) {
                  const map = await getPlayersMapForTorneo();
                  styleFav = styleFav || computeStyleFromPlayers(fav.nombre, map);
                  styleOpp = styleOpp || computeStyleFromPlayers(opp.nombre, map);
                }
                if (styleFav && styleOpp) {
                  parts.push(`Estilo: ${fav.nombre} 3P ${num(styleFav.pct3,0)}% • 2P ${num(styleFav.pct2,0)}% • TL ${num(styleFav.pct1,0)}%; ${opp.nombre} 3P ${num(styleOpp.pct3,0)}% • 2P ${num(styleOpp.pct2,0)}% • TL ${num(styleOpp.pct1,0)}%`);
                }

                const map2 = await getPlayersMapForTorneo();
                const topsFav = (map2[fav.nombre] || []).slice(0,2);
                const topsOpp = (map2[opp.nombre] || []).slice(0,2);
                if (topsFav.length || topsOpp.length) {
                  const ftxt = topsFav.length ? `${fav.nombre}: ${topsFav.map(p => `${p.nombre} ${num(p.tp,0)} pts`).join(', ')}` : '';
                  const otxt = topsOpp.length ? `${opp.nombre}: ${topsOpp.map(p => `${p.nombre} ${num(p.tp,0)} pts`).join(', ')}` : '';
                  const joined = [ftxt, otxt].filter(Boolean).join(' | ');
                  if (joined) parts.push(`Destacados: ${joined}`);
                }
              }

              return parts.join(' • ');
            }

            const tooltip = await buildRichTooltip();
            favEl.setAttribute('title', tooltip);
        } catch (e) {
            favEl.innerHTML = '<i class=\"fas fa-star\"></i> Sin datos para predicción';
            favEl.removeAttribute('title');
        }
    });
}

// Utilidades para normalizar fecha/hora desde texto
function normalizeFecha(txt) {
  // espera formato DD/MM/YYYY de formatearFecha; si no, devuelve vacío
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(txt || '');
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`; // YYYY-MM-DD
}
function normalizeHora(txt) {
  const m = /(\d{2}:\d{2})/.exec(txt || '');
  return m ? m[1] : '';
}

// Parsear hora HH:MM a minutos, valores inválidos al final
function parseHoraToMinutes(hora) {
  const m = /^(\d{2}):(\d{2})/.exec(hora || '');
  if (!m) return Number.POSITIVE_INFINITY;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// Rellenar selector de jornada dinámicamente
function populateJornadaSelector(partidos) {
  const sel = document.getElementById('jornada-selector');
  if (!sel) return;
  const prev = sel.value;
  const jornadas = Array.from(new Set(
    (partidos || [])
      .map(p => Number(p.num_jornada))
      .filter(n => Number.isFinite(n) && n > 0)
  )).sort((a, b) => a - b);

  // Limpiar y volver a crear opciones
  sel.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'Todos';
  sel.appendChild(optAll);
  jornadas.forEach(n => {
    const o = document.createElement('option');
    o.value = String(n);
    o.textContent = `Jornada ${n}`;
    sel.appendChild(o);
  });

  // Restaurar selección previa si aún existe
  if (prev && Array.from(sel.options).some(o => o.value === prev)) {
    sel.value = prev;
  }

  // Adjuntar evento una sola vez
  if (!sel.dataset.listenerAttached) {
    sel.addEventListener('change', () => {
      renderPartidosPorTab();
    });
    sel.dataset.listenerAttached = '1';
  }
}

// Aplicar filtro por jornada y orden por jornada, fecha y hora
function filterAndSortByJornada(partidos) {
  const selVal = document.getElementById('jornada-selector')?.value || 'all';
  let filtered = partidos || [];
  if (selVal !== 'all') {
    const j = parseInt(selVal, 10);
    filtered = filtered.filter(p => Number(p.num_jornada) === j);
  }

  // Orden: jornada ASC, fecha ASC, hora ASC
  filtered.sort((a, b) => {
    const ja = Number(a.num_jornada) || 0;
    const jb = Number(b.num_jornada) || 0;
    if (ja !== jb) return ja - jb;

    const da = a.fecha ? new Date(a.fecha) : null;
    const db = b.fecha ? new Date(b.fecha) : null;
    if (da && db) {
      const diff = da.getTime() - db.getTime();
      if (diff !== 0) return diff;
    } else if (da) {
      return -1; // con fecha primero
    } else if (db) {
      return 1; // sin fecha al final
    }

    const ha = parseHoraToMinutes(a.hora);
    const hb = parseHoraToMinutes(b.hora);
    return ha - hb;
  });
  return filtered;
}

// Modal flotante para programar/editar fecha y hora de partido
function ensureScheduleModal() {
  if (document.getElementById('scheduleModal')) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'scheduleModal';
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-icon"><i class="fas fa-calendar-alt"></i></div>
        <h3 class="modal-title">Programar partido</h3>
      </div>
      <div class="modal-body">
        <div class="modal-field">
          <label class="modal-label" for="scheduleDate">Fecha (YYYY-MM-DD)</label>
          <input type="date" id="scheduleDate" class="modal-input" />
        </div>
        <div class="modal-field">
          <label class="modal-label" for="scheduleTime">Hora (HH:MM)</label>
          <input type="time" id="scheduleTime" class="modal-input" />
        </div>
        <div id="scheduleFeedback" class="modal-feedback"></div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn cancel-btn" id="scheduleCancelBtn"><i class="fas fa-times"></i> Cancelar</button>
        <button class="modal-btn confirm-btn" id="scheduleSaveBtn"><i class="fas fa-check"></i> Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#scheduleCancelBtn')?.addEventListener('click', () => overlay.classList.remove('show'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') overlay.classList.remove('show'); });
}

function showScheduleModal({ partidoId, fecha = '', hora = '' }) {
  ensureScheduleModal();
  const overlay = document.getElementById('scheduleModal');
  const dateInput = overlay.querySelector('#scheduleDate');
  const timeInput = overlay.querySelector('#scheduleTime');
  const feedback = overlay.querySelector('#scheduleFeedback');
  dateInput.value = fecha || '';
  timeInput.value = hora || '';
  feedback.textContent = '';
  overlay.classList.add('show');
  const saveBtn = overlay.querySelector('#scheduleSaveBtn');
  // Evitar múltiples bindings
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  const newSave = overlay.querySelector('#scheduleSaveBtn');
  newSave.addEventListener('click', async () => {
    const f = dateInput.value.trim() || null;
    const h = timeInput.value.trim() || null;
    try {
      const base = (typeof window.getBackendUrl === 'function') ? window.getBackendUrl() : (window.REBOTE_BACKEND_URL || 'https://rebotex-backend.onrender.com');
      const url = `${base}/api/partidos/${partidoId}/programar`;
      const tkn = getAuthToken();
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(tkn ? { 'Authorization': `Bearer ${tkn}` } : {}) },
        body: JSON.stringify({ fecha_partido: f, hora_partido: h })
      });
      if (!res.ok) {
        let detail = `Error ${res.status}`;
        try { const j = await res.json(); detail = j.error || j.message || detail; } catch(_){ }
        throw new Error(detail);
      }
      await res.json();
      overlay.classList.remove('show');
      const tid = window._torneoInfo?.id;
      if (tid) {
        await cargarPartidos(tid);
        // Actualizar la Tabla General inmediatamente tras guardar resultados
        await cargarEstadisticas(tid);
      }
      if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
      if (typeof showLogoutToast === 'function') {
        showLogoutToast('Partido programado', 'La lista se actualizó');
      } else if (typeof showFxToast === 'function') {
        showFxToast('Partido programado', 'La lista se actualizó', 2500);
      }
    } catch (e) {
      feedback.textContent = 'Error al programar: ' + (e.message || e);
    }
  });
}

// Modal avanzado para editar partido (programación, marcador y puntos por jugador)
function ensureEditMatchModal() {
  if (document.getElementById('editMatchModal')) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'editMatchModal';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width: 860px;">
      <div class="modal-header">
        <div class="modal-icon"><i class="fas fa-calendar-check"></i></div>
        <h3 class="modal-title">Editar partido</h3>
      </div>
      <div class="modal-body">
        <div class="modal-tabs">
          <button class="tab-btn active" data-tab="prog">Programación</button>
          <button class="tab-btn" data-tab="score">Marcador</button>
          <button class="tab-btn" data-tab="players">Puntos por jugador</button>
        </div>
        <div class="tab-pane" id="tab-prog">
          <div class="modal-field">
            <label class="modal-label" for="editDate">Fecha (YYYY-MM-DD)</label>
            <input type="date" id="editDate" class="modal-input" />
          </div>
          <div class="modal-field">
            <label class="modal-label" for="editTime">Hora (HH:MM)</label>
            <input type="time" id="editTime" class="modal-input" />
          </div>
        </div>
        <div class="tab-pane" id="tab-score" style="display:none;">
          <div class="modal-field">
            <label class="modal-label" for="scoreLocal">Puntos Local</label>
            <input type="number" min="0" id="scoreLocal" class="modal-input" />
          </div>
          <div class="modal-field">
            <label class="modal-label" for="scoreVisitante">Puntos Visitante</label>
            <input type="number" min="0" id="scoreVisitante" class="modal-input" />
          </div>
          <div id="scoreFeedback" class="modal-feedback"></div>
        </div>
        <div class="tab-pane" id="tab-players" style="display:none;">
          <div class="modal-subtitle">Local</div>
          <div class="table-scroll" style="max-height:280px; overflow:auto; border-radius:12px;"><table class="futuristic-table" id="playersLocal"><thead><tr><th>Jugador</th><th>PT</th><th>PD</th><th>TL</th><th>TP</th></tr></thead><tbody></tbody></table></div>
          <div class="modal-subtitle" style="margin-top:12px;">Visitante</div>
          <div class="table-scroll" style="max-height:280px; overflow:auto; border-radius:12px;"><table class="futuristic-table" id="playersVisitante"><thead><tr><th>Jugador</th><th>PT</th><th>PD</th><th>TL</th><th>TP</th></tr></thead><tbody></tbody></table></div>
        </div>
        <div id="editFeedback" class="modal-feedback"></div>
      </div>
      <div class="modal-actions">
        <div id="playersFeedback" class="modal-feedback" aria-live="polite"></div>
        <button class="modal-btn cancel-btn" id="editCancelBtn"><i class="fas fa-times"></i> Cancelar</button>
        <button class="modal-btn confirm-btn" id="editSaveBtn" disabled><i class="fas fa-check"></i> Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  // Inject aesthetic scrollbar styles once
  if (!document.getElementById('players-scroll-style')) {
    const style = document.createElement('style');
    style.id = 'players-scroll-style';
    style.textContent = `
      /* Global scrollbar for page & modal */
      html, body, .modal-content, .modal-body, #tab-players {
        scrollbar-width: thin;
        scrollbar-color: #39c5f1 #121a26;
      }
      html::-webkit-scrollbar, body::-webkit-scrollbar,
      .modal-content::-webkit-scrollbar, .modal-body::-webkit-scrollbar,
      #tab-players::-webkit-scrollbar { width: 12px; height: 12px; }
      html::-webkit-scrollbar-track, body::-webkit-scrollbar-track,
      .modal-content::-webkit-scrollbar-track, .modal-body::-webkit-scrollbar-track,
      #tab-players::-webkit-scrollbar-track {
        background: linear-gradient(180deg, rgba(18,26,38,0.9), rgba(18,26,38,0.6));
        border-radius: 10px;
      }
      html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb,
      .modal-content::-webkit-scrollbar-thumb, .modal-body::-webkit-scrollbar-thumb,
      #tab-players::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #39c5f1, #b53df1);
        border-radius: 10px;
        border: 2px solid rgba(12,18,28,0.8);
      }
      html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover,
      .modal-content::-webkit-scrollbar-thumb:hover, .modal-body::-webkit-scrollbar-thumb:hover,
      #tab-players::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #56d6ff, #cf66ff);
      }

      /* Per-table scroll wrapper */
      .table-scroll { scrollbar-width: thin; scrollbar-color: #39c5f1 #121a26; }
      .table-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
      .table-scroll::-webkit-scrollbar-track {
        background: linear-gradient(180deg, rgba(18,26,38,0.9), rgba(18,26,38,0.6));
        border-radius: 10px;
      }
      .table-scroll::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #39c5f1, #b53df1);
        border-radius: 10px;
        border: 2px solid rgba(12,18,28,0.8);
      }
      .table-scroll::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #56d6ff, #cf66ff); }
    `;
    document.head.appendChild(style);
  }
  overlay.querySelector('#editCancelBtn')?.addEventListener('click', () => overlay.classList.remove('show'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') overlay.classList.remove('show'); });

  // Tabs
  const tabs = overlay.querySelectorAll('.modal-tabs .tab-btn');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.toggle('active', b === btn));
    const tab = btn.getAttribute('data-tab');
    overlay.querySelector('#tab-prog').style.display = (tab === 'prog') ? '' : 'none';
    overlay.querySelector('#tab-score').style.display = (tab === 'score') ? '' : 'none';
    overlay.querySelector('#tab-players').style.display = (tab === 'players') ? '' : 'none';
  }));
}

async function showEditMatchModal({ partidoId, localId, visitanteId, fecha, hora, rl, rv, localName, visitanteName }) {
  ensureEditMatchModal();
  const overlay = document.getElementById('editMatchModal');
  const editDate = overlay.querySelector('#editDate');
  const editTime = overlay.querySelector('#editTime');
  const scoreLocal = overlay.querySelector('#scoreLocal');
  const scoreVisitante = overlay.querySelector('#scoreVisitante');
  const fbMain = overlay.querySelector('#editFeedback');
  const fbPlayers = overlay.querySelector('#playersFeedback');
  const fbScore = overlay.querySelector('#scoreFeedback');
  const saveBtn = overlay.querySelector('#editSaveBtn');
  // Normalizar valores existentes para inputs HTML
  const toDateInputValue = (f) => {
    if (!f) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
    const d = new Date(f);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  };
  const toTimeInputValue = (h) => {
    if (!h) return '';
    const m = /^(\d{2}):(\d{2})/.exec(h);
    return m ? `${m[1]}:${m[2]}` : '';
  };
  editDate.value = toDateInputValue(fecha);
  editTime.value = toTimeInputValue(hora);
  // Usar nullish coalescing para no vaciar cuando es 0
  scoreLocal.value = String(rl ?? '');
  scoreVisitante.value = String(rv ?? '');
  // Fallback: si vinieron vacíos, leer del card visible
  if (!scoreLocal.value || !scoreVisitante.value) {
    try {
      const card = document.querySelector(`.match-card[data-partido-id="${partidoId}"]`);
      const localScoreEl = card?.querySelector('.team.local .team-score');
      const visitScoreEl = card?.querySelector('.team.visitor .team-score');
      const ls = localScoreEl ? localScoreEl.textContent.trim() : '';
      const vs = visitScoreEl ? visitScoreEl.textContent.trim() : '';
      if (!scoreLocal.value && ls) scoreLocal.value = ls;
      if (!scoreVisitante.value && vs) scoreVisitante.value = vs;
    } catch (_) {}
  }
  fbMain.textContent = '';
  fbPlayers.textContent = '';
  fbScore.textContent = '';
  overlay.classList.add('show');

  // Setear nombres reales en pestaña jugadores y asegurar wrapper scroll
  try {
    // Actualizar etiquetas del marcador con el nombre real del equipo
    const lblLocal = overlay.querySelector('label[for="scoreLocal"]');
    const lblVisit = overlay.querySelector('label[for="scoreVisitante"]');
    if (lblLocal) lblLocal.textContent = `Puntos ${localName || 'Local'}`;
    if (lblVisit) lblVisit.textContent = `Puntos ${visitanteName || 'Visitante'}`;
    // Opcional: placeholders coherentes (no requerido, pero útil)
    const inpLocal = overlay.querySelector('#scoreLocal');
    const inpVisit = overlay.querySelector('#scoreVisitante');
    if (inpLocal) inpLocal.placeholder = localName || 'Local';
    if (inpVisit) inpVisit.placeholder = visitanteName || 'Visitante';

    const subs = overlay.querySelectorAll('#tab-players .modal-subtitle');
    if (subs[0]) subs[0].textContent = localName || 'Local';
    if (subs[1]) subs[1].textContent = visitanteName || 'Visitante';
    const ensureWrap = (id) => {
      const tbl = overlay.querySelector('#' + id);
      if (tbl && (!tbl.parentElement || !tbl.parentElement.classList.contains('table-scroll'))){
        const w = document.createElement('div');
        w.className = 'table-scroll';
        w.style.maxHeight = '280px';
        w.style.overflow = 'auto';
        w.style.borderRadius = '12px';
        tbl.parentNode.insertBefore(w, tbl);
        w.appendChild(tbl);
      }
    };
    ensureWrap('playersLocal');
    ensureWrap('playersVisitante');
  } catch(_){}

  const tkn = getAuthToken();
  const base = (typeof window.getBackendUrl === 'function') ? window.getBackendUrl() : (window.REBOTE_BACKEND_URL || 'https://rebotex-backend.onrender.com');

  // Cargar jugadores
  async function cargarJugadoresEquipo(equipoId, tableId) {
    const tbody = overlay.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    try {
      const res = await fetch(`${base}/api/equipos/${equipoId}/jugadores`);
      const data = await res.json();
      const jugadores = data.jugadores || data || [];
      tbody.innerHTML = '';
      jugadores.forEach(j => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-jugador-id', j.id);
        tr.innerHTML = `
          <td>${j.nombre}</td>
          <td><input type="number" min="0" class="modal-input pj-pt" value="0" style="width:80px"/></td>
          <td><input type="number" min="0" class="modal-input pj-pd" value="0" style="width:80px"/></td>
          <td><input type="number" min="0" class="modal-input pj-tl" value="0" style="width:80px"/></td>
          <td class="pj-tp">0</td>`;
        tbody.appendChild(tr);
      });
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5">No se pudieron cargar jugadores</td></tr>';
    }
  }

  await Promise.all([
    cargarJugadoresEquipo(localId, 'playersLocal'),
    cargarJugadoresEquipo(visitanteId, 'playersVisitante')
  ]);

  // Pre-cargar estadísticas si existen
  try {
    const res = await fetch(`${base}/api/partidos/${partidoId}/stats`);
    if (res.ok) {
      const data = await res.json();
      const stats = data.stats || [];
      const mapTeam = { [localId]: 'playersLocal', [visitanteId]: 'playersVisitante' };
      stats.forEach(s => {
        const tableId = mapTeam[s.equipo_id];
        const tbody = overlay.querySelector(`#${tableId} tbody`);
        const row = tbody?.querySelector(`tr[data-jugador-id="${s.jugador_id}"]`);
        if (row) {
          row.querySelector('.pj-pt').value = String(s.puntos_triple || 0);
          row.querySelector('.pj-pd').value = String(s.puntos_doble || 0);
          row.querySelector('.pj-tl').value = String(s.tiros_libre || 0);
          const tp = (s.puntos_triple||0)*3 + (s.puntos_doble||0)*2 + (s.tiros_libre||0);
          row.querySelector('.pj-tp').textContent = String(tp);
        }
      });
    }
  } catch (_) {}

  // Recalcular TP y validaciones en vivo
  function recalcAndValidate() {
    let sumLocal = 0, sumVisit = 0;
    const applyCalc = (tableId, equipo) => {
      overlay.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
        const pt = Number(tr.querySelector('.pj-pt').value || 0);
        const pd = Number(tr.querySelector('.pj-pd').value || 0);
        const tl = Number(tr.querySelector('.pj-tl').value || 0);
        const tp = pt*3 + pd*2 + tl;
        tr.querySelector('.pj-tp').textContent = String(tp);
        if (equipo === 'local') sumLocal += tp; else sumVisit += tp;
      });
    };
    applyCalc('playersLocal', 'local');
    applyCalc('playersVisitante', 'visitante');
    const rlVal = Number(scoreLocal.value || 0);
    const rvVal = Number(scoreVisitante.value || 0);
    const okLocal = sumLocal === rlVal;
    const okVisit = sumVisit === rvVal;
    fbPlayers.textContent = (okLocal && okVisit) ? '' : `Las sumas no cuadran. Local: ${sumLocal}/${rlVal} · Visitante: ${sumVisit}/${rvVal}`;
    // Siempre permitir guardar; solo mostramos advertencia si no cuadran
    const currentSaveBtn = overlay.querySelector('#editSaveBtn');
    if (currentSaveBtn) currentSaveBtn.disabled = false;
  }
  overlay.querySelectorAll('.pj-pt, .pj-pd, .pj-tl').forEach(inp => inp.addEventListener('input', recalcAndValidate));
  scoreLocal.addEventListener('input', recalcAndValidate);
  scoreVisitante.addEventListener('input', recalcAndValidate);
  recalcAndValidate();

  // Guardar
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  const newSave = overlay.querySelector('#editSaveBtn');
  newSave.addEventListener('click', async () => {
    fbMain.textContent = '';
    try {
      // 1) Actualizar programación y marcador
      const res1 = await fetch(`${base}/api/partidos/${partidoId}/editar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(tkn ? { 'Authorization': `Bearer ${tkn}` } : {}) },
        body: JSON.stringify({
          fecha_partido: editDate.value || null,
          hora_partido: editTime.value || null,
          resultado_local: Number(scoreLocal.value || 0),
          resultado_visitante: Number(scoreVisitante.value || 0)
        })
      });
      if (!res1.ok) throw new Error(`Error ${res1.status} al editar partido`);

      // 2) Validar sumas vs marcador y recolectar stats
      let sumLocal = 0, sumVisit = 0;
      const applyCalc = (tableId, equipo) => {
        overlay.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
          const pt = Number(tr.querySelector('.pj-pt').value || 0);
          const pd = Number(tr.querySelector('.pj-pd').value || 0);
          const tl = Number(tr.querySelector('.pj-tl').value || 0);
          const tp = pt*3 + pd*2 + tl;
          if (equipo === 'local') sumLocal += tp; else sumVisit += tp;
        });
      };
      applyCalc('playersLocal', 'local');
      applyCalc('playersVisitante', 'visitante');
      const rlVal = Number(scoreLocal.value || 0);
      const rvVal = Number(scoreVisitante.value || 0);
      const okLocal = sumLocal === rlVal;
      const okVisit = sumVisit === rvVal;

      // 3) Recolectar stats
      const colectar = (tableId, equipoId) => {
        const arr = [];
        overlay.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
          const jugadorId = Number(tr.getAttribute('data-jugador-id'));
          const pt = Number(tr.querySelector('.pj-pt').value || 0);
          const pd = Number(tr.querySelector('.pj-pd').value || 0);
          const tl = Number(tr.querySelector('.pj-tl').value || 0);
          arr.push({ jugador_id: jugadorId, equipo_id: equipoId, puntos_triple: pt, puntos_doble: pd, tiros_libre: tl });
        });
        return arr;
      };
      const statsPayload = [
        ...colectar('playersLocal', localId),
        ...colectar('playersVisitante', visitanteId)
      ];
      if (okLocal && okVisit) {
        const res2 = await fetch(`${base}/api/partidos/${partidoId}/stats`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(tkn ? { 'Authorization': `Bearer ${tkn}` } : {}) },
          body: JSON.stringify({ stats: statsPayload })
        });
        if (!res2.ok) {
          let detail = `Error ${res2.status} al guardar estadísticas`;
          try { const j = await res2.json(); detail = j.error || j.message || detail; } catch(_){ }
          throw new Error(detail);
        }
      } else {
        fbPlayers.textContent = `Se guardó programación y marcador, pero las estadísticas no cuadran (Local: ${sumLocal}/${rlVal}, Visitante: ${sumVisit}/${rvVal}). No se guardaron estadísticas.`;
      }

      overlay.classList.remove('show');
      const tid = window._torneoInfo?.id;
      if (tid) await cargarPartidos(tid);
      if (typeof showFxToast === 'function') {
        const toastMsg = (okLocal && okVisit) ? 'Se guardaron marcador y estadísticas' : 'Se guardó programación y marcador (estadísticas omitidas)';
        showFxToast('Partido actualizado', toastMsg, 2500);
      }
      // Refrescar tabla general tras actualizar resultados
      try { const tid2 = window._torneoInfo?.id; if (tid2) await cargarEstadisticas(tid2); } catch(_) {}
    } catch (e) {
      fbMain.textContent = 'Error: ' + (e.message || e);
    }
  });
}

function renderPartidosPorTab() {
    const partidos = window._partidosData || [];
    const adminActive = !!document.getElementById('partidosTabAdmin')?.classList.contains('active');
    const proxActive = !!document.getElementById('partidosTabProximos')?.classList.contains('active');
    const finActive = !!document.getElementById('partidosTabFinalizados')?.classList.contains('active');
    let toRender = partidos;
    if (proxActive) {
        toRender = partidos.filter(p => (p.estado === 'proximos'));
    } else if (finActive) {
        toRender = partidos.filter(p => (p.estado === 'finalizados'));
    } else if (adminActive) {
        // Mostrar solo sin programar (Partidos) según reglas
        toRender = partidos.filter(p => (p.estado === 'partidos'));
    }
    // Aplicar filtro por jornada y ordenar
    renderPartidosLista(filterAndSortByJornada(toRender));
}

function activarTabsPartidos() {
    const tabAdmin = document.getElementById('partidosTabAdmin');
    const tabProx = document.getElementById('partidosTabProximos');
    const tabFin = document.getElementById('partidosTabFinalizados');
    if (!tabProx || !tabFin) return;
    const setActive = (target) => {
        [tabAdmin, tabProx, tabFin].forEach(b => b && b.classList.toggle('active', b === target));
        renderPartidosPorTab();
    };
    tabProx.addEventListener('click', () => setActive(tabProx));
    tabFin.addEventListener('click', () => setActive(tabFin));
    if (tabAdmin) tabAdmin.addEventListener('click', () => setActive(tabAdmin));

    // Visibilidad según rol
    const isOrg = !!window._isTournamentOrganizer;
    if (tabAdmin && !isOrg) tabAdmin.style.display = 'none';

    // Para Próximos/Finalizados: visible solo si es participante u organizador
    const equiposLista = document.getElementById('equipos-lista');
    let isParticipant = false;
    try {
        const u = localStorage.getItem('userData');
        const uid = u ? JSON.parse(u)?.id : null;
        isParticipant = isOrg;
        const equipos = (window._lastEquipos || []);
        if (uid && equipos.length > 0) {
            isParticipant = isParticipant || equipos.some(e => String(e.creador_id) === String(uid));
        }
    } catch (_) {}
    if (!isParticipant) {
        tabProx.style.display = 'none';
        tabFin.style.display = 'none';
    }
}

// Función para cargar estadísticas
async function cargarEstadisticas(torneoId) {
    try {
        const equiposData = await (async () => {
            try {
                return await fetchJson(`/api/equipos?torneo=${torneoId}`);
            } catch (_) {
                return await fetchJson(`/api/torneos/${torneoId}/equipos`).catch(() => ({ equipos: [] }));
            }
        })();
        // La API devuelve { partidos: [...] }. Aseguramos que sea arreglo.
        const partidosResp = await fetchJson(`/api/partidos?torneo=${torneoId}`).catch(() => ({ partidos: [] }));
        const partidos = Array.isArray(partidosResp)
            ? partidosResp
            : (partidosResp.partidos || []);
        let equipos = equiposData.equipos || equiposData || [];
        // Fallback: si no se pudo obtener equipos aquí, usa los cargados previamente
        if (!Array.isArray(equipos) || equipos.length === 0) {
            const prev = window._lastEquipos;
            if (Array.isArray(prev) && prev.length > 0) equipos = prev;
        }
        // Construir mapa de enfrentamientos directos (head-to-head) con victorias
        const h2h = new Map(); // key: "minId|maxId" -> { [idA]: wins, [idB]: wins }
        const pairKey = (a, b) => {
          const A = Number(a || 0), B = Number(b || 0);
          return (A < B) ? `${A}|${B}` : `${B}|${A}`;
        };
        (Array.isArray(partidos) ? partidos : []).forEach(p => {
          const rlRaw = (p.resultado_local ?? p.puntos_local ?? null);
          const rvRaw = (p.resultado_visitante ?? p.puntos_visitante ?? null);
          const rl = rlRaw !== null ? Number(rlRaw) : null;
          const rv = rvRaw !== null ? Number(rvRaw) : null;
          const tieneResultados = rl !== null && rv !== null;
          const esCeroCero = tieneResultados && rl === 0 && rv === 0;
          if (!tieneResultados || esCeroCero) return;
          let ganadorId = null;
          if (rl > rv) ganadorId = Number(p.local_id || 0);
          else if (rv > rl) ganadorId = Number(p.visitante_id || 0);
          else ganadorId = null; // empate: no cuenta para h2h
          if (!ganadorId) return;
          const k = pairKey(p.local_id, p.visitante_id);
          const curr = h2h.get(k) || {};
          curr[ganadorId] = (curr[ganadorId] || 0) + 1;
          h2h.set(k, curr);
        });

        // Calcular estadísticas por equipo
        const estadisticas = (Array.isArray(equipos) ? equipos : []).map(equipo => {
            const eqId = Number(equipo.id || equipo.equipo_id || equipo.eid || 0);
            const eqName = equipo.nombre || equipo.equipo_nombre;
            const partidosEquipo = partidos.filter(p => {
                // Preferir comparación por ID si viene en payload; si no, comparar por nombre
                const localId = Number(p.local_id || 0);
                const visitId = Number(p.visitante_id || 0);
                const byId = eqId && (localId === eqId || visitId === eqId);
                const byName = !eqId && (p.equipo_local === eqName || p.equipo_visitante === eqName);
                return byId || byName;
            });

            let victorias = 0;
            let derrotas = 0;
            let puntosFavor = 0;
            let puntosContra = 0;
            let partidosJugados = 0;

            partidosEquipo.forEach(partido => {
                // Considerar partido jugado solo si hay resultados y NO es 0-0
                // El backend expone resultado_* como puntos_* en algunos endpoints: unificar lectura
                const rlRaw = (partido.resultado_local ?? partido.puntos_local ?? null);
                const rvRaw = (partido.resultado_visitante ?? partido.puntos_visitante ?? null);
                const rl = rlRaw !== null ? Number(rlRaw) : null;
                const rv = rvRaw !== null ? Number(rvRaw) : null;
                const tieneResultados = rl !== null && rv !== null;
                const esCeroCero = tieneResultados && rl === 0 && rv === 0;
                const jugado = tieneResultados && !esCeroCero;
                if (jugado) {
                    partidosJugados++;
                    const esLocal = eqId ? (Number(partido.local_id) === eqId) : (partido.equipo_local === eqName);
                    const pf = esLocal ? (rl || 0) : (rv || 0);
                    const pc = esLocal ? (rv || 0) : (rl || 0);

                    puntosFavor += Number(pf) || 0;
                    puntosContra += Number(pc) || 0;
                    // Contabilizar resultado: victoria o derrota; empates (pf===pc) no suman a D
                    if (pf > pc) {
                        victorias++;
                    } else if (pf < pc) {
                        derrotas++;
                    }
                }
            });

            return {
                nombre: equipo.nombre,
                equipoId: eqId,
                partidos: partidosJugados,
                victorias,
                derrotas,
                puntosFavor,
                puntosContra,
                diferencia: puntosFavor - puntosContra,
                puntos: victorias * 3 // 3 puntos por victoria (tabla)
            };
        });
        // Desempatador head-to-head y orden multi-criterio
        const compareH2H = (aId, bId) => {
          if (!aId || !bId) return 0;
          const k = pairKey(aId, bId);
          const rec = h2h.get(k);
          if (!rec) return 0;
          const aw = rec[aId] || 0;
          const bw = rec[bId] || 0;
          if (aw > bw) return -1; // a arriba
          if (bw > aw) return 1;  // b arriba
          return 0;
        };
        const stableRand = (tid, key) => {
          const s = String(tid) + ':' + String(key ?? '');
          let h = 0;
          for (let i = 0; i < s.length; i++) {
            h = (h * 31 + s.charCodeAt(i)) >>> 0;
          }
          return h;
        };
        estadisticas.sort((a, b) => {
          // 1) Victorias desc
          if (a.victorias !== b.victorias) return b.victorias - a.victorias;
          // 2) Derrotas asc
          if (a.derrotas !== b.derrotas) return a.derrotas - b.derrotas;
          // 3) Puntos a favor desc
          if (a.puntosFavor !== b.puntosFavor) return b.puntosFavor - a.puntosFavor;
          // 4) Head-to-head si existe
          const h = compareH2H(a.equipoId, b.equipoId);
          if (h !== 0) return h;
          // 5) Puntos en contra asc
          if (a.puntosContra !== b.puntosContra) return a.puntosContra - b.puntosContra;
          // 6) Aleatorio estable
          const ra = stableRand(torneoId, a.equipoId || a.nombre);
          const rb = stableRand(torneoId, b.equipoId || b.nombre);
          return ra - rb;
        });

        // Determinar criterio de desempate por fila para tooltip
        const getTieReason = (idx) => {
          const curr = estadisticas[idx];
          const prev = idx > 0 ? estadisticas[idx - 1] : null;
          const next = idx < (estadisticas.length - 1) ? estadisticas[idx + 1] : null;
          const neighborSameWins = (prev && prev.victorias === curr.victorias) ? prev : ((next && next.victorias === curr.victorias) ? next : null);
          if (!neighborSameWins) return 'Orden por victorias';
          const n = neighborSameWins;
          if (curr.derrotas !== n.derrotas) return 'Desempate por derrotas (menos mejor)';
          if (curr.puntosFavor !== n.puntosFavor) return 'Desempate por puntos a favor';
          const h = compareH2H(curr.equipoId, n.equipoId);
          if (h !== 0) return 'Desempate por enfrentamiento directo';
          if (curr.puntosContra !== n.puntosContra) return 'Desempate por puntos en contra (menos mejor)';
          return 'Empate total; orden aleatorio estable';
        };
        estadisticas.forEach((s, i) => { s.tieReason = getTieReason(i); });

        // Guardar globalmente para exportación
        window._estadisticasTorneo = estadisticas;
        
        // Mostrar tabla de estadísticas
        const estadisticasTabla = document.getElementById('estadisticas-tabla');
        if (estadisticasTabla) {
            if (estadisticas.length > 0) {
                estadisticasTabla.innerHTML = estadisticas.map(stat => `
                    <tr title="${stat.tieReason}">
                        <td>${stat.nombre} <span class="tie-tip" title="${stat.tieReason}"><i class="fas fa-info-circle" style="margin-left:6px; color:#9aa7b0;"></i></span></td>
                        <td>${stat.partidos}</td>
                        <td>${stat.victorias}</td>
                        <td>${stat.derrotas}</td>
                        <td>${stat.puntosFavor}</td>
                        <td>${stat.puntosContra}</td>
                        <td>${stat.diferencia}</td>
                    </tr>
                `).join('');
            } else {
                estadisticasTabla.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay estadísticas disponibles</td></tr>';
            }
        }
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// Exportar estadísticas a CSV
function descargarEstadisticasCSV() {
    const rows = window._estadisticasTorneo || [];
    if (!rows || rows.length === 0) {
        alert('No hay estadísticas para exportar.');
        return;
    }
    const headers = ['Equipo','P','V','D','PA','PC','DP'];
    const csvLines = [headers.join(',')].concat(
        rows.map(r => [
            r.nombre,
            r.partidos,
            r.victorias,
            r.derrotas,
            r.puntosFavor,
            r.puntosContra,
            r.diferencia
        ].join(','))
    );
    const csvContent = '\ufeff' + csvLines.join('\n'); // BOM para UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const torneoId = obtenerIdTorneo() || 'sin_id';
    a.href = url;
    a.download = `estadisticas_torneo_${torneoId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Exportar estadísticas a PDF con jsPDF + AutoTable
function exportarEstadisticasPDF() {
    const rows = window._estadisticasTorneo || [];
    if (!rows || rows.length === 0) {
        alert('No hay estadísticas para exportar.');
        return;
    }

    // Validar disponibilidad de jsPDF
    if (!window.jspdf || !window.jspdf.jsPDF || !window.jsPDF && !window.jspdf.jsPDF) {
        alert('No se encontraron las librerías de PDF. Verifica tu conexión a Internet.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const marginLeft = 40;
    let y = 40;

    // Encabezado
    const info = window._torneoInfo || {};
    doc.setFontSize(16);
    doc.setTextColor(30);
    doc.text(`Estadísticas del Torneo`, marginLeft, y);
    y += 22;

    doc.setFontSize(12);
    doc.setTextColor(60);
    doc.text(`Nombre del torneo: ${info.nombre || '—'}`, marginLeft, y); y += 18;
    doc.text(`Fecha de inicio: ${info.fecha_inicio ? formatearFecha(info.fecha_inicio) : '—'}`, marginLeft, y); y += 18;
    doc.text(`Fecha de fin: ${info.fecha_fin ? formatearFecha(info.fecha_fin) : '—'}`, marginLeft, y); y += 18;
    doc.text(`Equipos: ${info.equipos ?? '—'}    Partidos: ${info.partidos ?? '—'}`, marginLeft, y); y += 18;
    doc.text(`Fecha de descarga: ${new Date().toLocaleString('es-ES')}`, marginLeft, y); y += 24;

    // Tabla de puntos
    const head = [['Equipo','PJ','V','D','PA','PC','DP']];
    const body = rows.map(r => [
        r.nombre,
        String(r.partidos),
        String(r.victorias),
        String(r.derrotas),
        String(r.puntosFavor),
        String(r.puntosContra),
        String(r.diferencia)
    ]);

    doc.autoTable({
        startY: y,
        head,
        body,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [40, 60, 140], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: marginLeft, right: 40 },
        didDrawPage: (data) => {
            // Footer en cada página
            doc.setFontSize(10);
            doc.setTextColor(120);
            const footer = '© 2025 ReboteX. Todos los derechos reservados.';
            doc.text(
                footer,
                data.settings.margin.left,
                doc.internal.pageSize.height - 20
            );
        }
    });

    const torneoId = obtenerIdTorneo() || 'sin_id';
    doc.save(`estadisticas_torneo_${torneoId}.pdf`);
}

// Función para formatear fechas
function formatearFecha(fecha) {
    if (!fecha) return null;
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Formatear hora a 12 horas sin segundos (ej: 9:20 AM)
function formatearHora12(hora) {
    if (!hora) return null;
    const m = /^(\d{2}):(\d{2})(?::\d{2})?/.exec(hora);
    if (!m) return hora;
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${min} ${ampm}`;
}

// Funciones para la navegación y eliminación
function confirmarEliminacion() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.add('show');
    }
}

function cancelarEliminacion() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

async function eliminarTorneo() {
    const torneoId = obtenerIdTorneo();
    
    if (!torneoId) {
        if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
        if (typeof showFxToast === 'function') {
            showFxToast('Error', 'No se pudo identificar el torneo a eliminar', 3000);
        } else {
            console.warn('No se pudo identificar el torneo a eliminar');
        }
        return;
    }
    
    try {
        const tkn = getAuthToken();
        const res = await fetch(`${API_BASE}/api/torneos/${torneoId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(tkn ? { 'Authorization': `Bearer ${tkn}` } : {})
            }
        });
        
        if (res.ok) {
            // Cerrar el modal de confirmación antes de mostrar el toast
            try { cancelarEliminacion(); } catch(_) {}
            // Usar notificación personalizada en vez de alert()
            if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
            if (typeof showLogoutToast === 'function') {
                showLogoutToast('Torneo eliminado', 'Redirigiendo al dashboard…');
            } else if (typeof showFxToast === 'function') {
                showFxToast('Torneo eliminado', 'Redirigiendo al dashboard…', 2500);
            }
            // Redirigir al dashboard con un pequeño delay para que se vea el toast
            setTimeout(() => {
                window.location.href = '../client/dashboard.html';
            }, 1200);
        } else {
            const ct = res.headers.get('content-type') || '';
            let payload;
            try {
                payload = ct.includes('application/json') ? await res.json() : await res.text();
            } catch (_) {
                payload = null;
            }
            const msg = (payload && typeof payload === 'object' ? payload.error || payload.message : '')
                        || (typeof payload === 'string' ? payload : '');
            if (res.status === 401) {
                if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
                if (typeof showFxToast === 'function') {
                    showFxToast('Autenticación requerida', msg || 'Inicia sesión como organizador.', 3000);
                } else {
                    console.warn(msg || 'No estás autenticado. Inicia sesión como organizador.');
                }
            } else if (res.status === 403) {
                if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
                if (typeof showFxToast === 'function') {
                    showFxToast('No autorizado', msg || 'No puedes eliminar este torneo.', 3000);
                } else {
                    console.warn(msg || 'No autorizado para eliminar este torneo.');
                }
            } else if (res.status === 404 && typeof payload === 'string' && msg.includes('Cannot DELETE')) {
                if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
                if (typeof showFxToast === 'function') {
                    showFxToast('Operación no disponible', 'Esta API no implementa eliminar torneos.', 3000);
                } else {
                    console.warn('La API de esta instancia no implementa eliminación de torneos (404).');
                }
            } else if (res.status === 404) {
                if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
                if (typeof showFxToast === 'function') {
                    showFxToast('No encontrado', msg || 'Torneo no encontrado.', 3000);
                } else {
                    console.warn(msg || 'Torneo no encontrado.');
                }
            } else {
                if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
                if (typeof showFxToast === 'function') {
                    showFxToast('Error al eliminar', msg || `HTTP ${res.status}`, 3000);
                } else {
                    console.warn(msg || `Error al eliminar el torneo (HTTP ${res.status})`);
                }
            }
        }
    } catch (error) {
        console.error('Error al eliminar el torneo:', error);
        if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
        if (typeof showFxToast === 'function') {
            showFxToast('Error de conexión', 'Verifica tu red o la URL del backend.', 3000);
        } else {
            console.warn('No se pudo conectar con el servidor. Verifica tu red o la URL del backend.');
        }
    }
    
    // Cerrar el modal
    cancelarEliminacion();
}

// Usar la versión global en auth.js para confirmación estilizada
// function cerrarSesion() {} // Eliminado para evitar conflictos

// Cerrar modal al hacer clic fuera de él
document.addEventListener('click', function(event) {
    const modal = document.getElementById('deleteModal');
    if (modal && event.target === modal) {
        cancelarEliminacion();
    }
});

// Cerrar modal con la tecla Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cancelarEliminacion();
    }
});

// Funcionalidad para las pestañas
document.addEventListener('DOMContentLoaded', function() {
    // Manejar clics en pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Remover clase active de todas las pestañas del mismo grupo
            const parent = this.closest('.card-tabs');
            parent.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
            
            // Agregar clase active a la pestaña clickeada
            this.classList.add('active');
            
            // Aquí puedes agregar lógica específica para cada pestaña
            console.log('Pestaña seleccionada:', this.textContent);
        });
    });
    
    // Inicializar torneo
    const torneoId = obtenerIdTorneo();
    
    if (torneoId) {
        mostrarInformacionTorneo(torneoId);
    } else {
        console.error('No se encontró ID de torneo en la URL');
        const tituloElement = document.getElementById('torneo-titulo');
        if (tituloElement) {
            tituloElement.textContent = 'ID de torneo no válido';
        }
    }
    const refreshBtn = document.getElementById('refreshEquiposBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const id = (window._torneoInfo && window._torneoInfo.id) || obtenerIdTorneo();
            if (!id) return;
            try {
                refreshBtn.disabled = true;
                await cargarEquipos(id);
                await cargarEstadisticas(id);
            } finally {
                refreshBtn.disabled = false;
            }
        });
    }
    // Delegación de clic para eliminar equipo del torneo
    const equiposLista = document.getElementById('equipos-lista');
    if (equiposLista) {
        equiposLista.addEventListener('click', async (ev) => {
            const btn = ev.target.closest('.team-delete-btn');
            if (!btn) return;
            const equipoId = btn.getAttribute('data-equipo-id');
            const torneoActualId = obtenerIdTorneo();
            if (!equipoId || !torneoActualId) return;

            const nombreEquipo = btn.closest('.team-card')?.querySelector('.team-name')?.textContent || 'este equipo';
            ensureDeleteEquipoModal();
            showDeleteEquipoModal(nombreEquipo, async () => {
                try {
                    await eliminarEquipoDelTorneo(torneoActualId, equipoId);
                    const card = btn.closest('.team-card');
                    card?.remove();
                    const equiposCountElement = document.getElementById('torneo-equipos');
                    if (equiposCountElement) {
                        const actual = parseInt(equiposCountElement.textContent || '0', 10);
                        equiposCountElement.textContent = String(Math.max(0, actual - 1));
                    }
                } catch (err) {
                    console.error(err);
                    alert(err?.message || 'No se pudo eliminar el equipo del torneo');
                }
            });
        });
    }
});
// Auto-refresco cuando la ventana recupera el foco
window.addEventListener('focus', () => {
    const id = (window._torneoInfo && window._torneoInfo.id) || obtenerIdTorneo();
    if (id) {
        cargarEquipos(id).catch(() => {});
    }
});
    // Botón de descarga de estadísticas
    const downloadBtn = document.getElementById('downloadStatsBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', exportarEstadisticasPDF);
    }

// Eliminar equipo del torneo mediante API protegida
async function eliminarEquipoDelTorneo(torneoId, equipoId) {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No estás autenticado. Inicia sesión para gestionar el torneo.');
    }
    const res = await fetch(`${API_BASE}/api/torneos/${torneoId}/equipos/${equipoId}`, {
        method: 'DELETE',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(payload?.error || `Error ${res.status} al eliminar equipo`);
    }
    return payload;
}

// ====== Override: mostrarInformacionTorneo con fallback robusto al backend remoto ======
// Esta versión intenta primero el backend configurado y, si falla, consulta el remoto en Render.
// Además, limpia los campos para evitar que queden en estado "Cargando..." en errores.
function mostrarInformacionTorneo(id) {
    (async () => {
        try {
            const primaryBase = (typeof window.getBackendUrl === 'function')
                ? window.getBackendUrl()
                : (window.REBOTE_BACKEND_URL || 'https://rebotex-backend.onrender.com');
            const remoteBase = 'https://rebotex-backend.onrender.com';
            const bases = primaryBase && primaryBase !== remoteBase ? [primaryBase, remoteBase] : [remoteBase];

            let data = null;
            let lastErr = null;
            for (const base of bases) {
                try {
                    const res = await fetch(`${base}/api/torneos/${id}`);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    data = await res.json();
                    break;
                } catch (e) {
                    lastErr = e;
                }
            }
            if (!data) throw lastErr || new Error('No se pudo obtener el torneo');

            const torneo = data.torneo || data;
            const tituloElement = document.getElementById('torneo-titulo');
            if (tituloElement) tituloElement.textContent = torneo.nombre || 'Torneo sin nombre';

            // Mostrar descripción del torneo en el subtítulo del héroe
            const subtitleEl = document.querySelector('.hero-title-sub');
            if (subtitleEl) subtitleEl.textContent = torneo.descripcion || '—';

            const infoElements = {
                'torneo-fecha-inicio': formatearFecha(torneo.fecha_inicio) || 'No especificada',
                'torneo-fecha-fin': formatearFecha(torneo.fecha_fin) || 'No especificada',
                'torneo-uid': torneo.torneo_uid || torneo.uid || 'No asignado'
            };
            Object.entries(infoElements).forEach(([fid, value]) => {
                const el = document.getElementById(fid);
                if (el) el.textContent = value;
            });

            // Persistir información base del torneo para PDF y permisos
            window._torneoInfo = {
                id,
                nombre: torneo.nombre || 'Torneo sin nombre',
                fecha_inicio: torneo.fecha_inicio || null,
                fecha_fin: torneo.fecha_fin || null,
                equipos: 0,
                partidos: 0
            };
            window._torneoData = torneo;
            try {
                const u = localStorage.getItem('userData');
                const uid = u ? JSON.parse(u)?.id : null;
                window._isTournamentOrganizer = uid != null && String(uid) === String(torneo.organizador_id);
            } catch (_) {
                window._isTournamentOrganizer = false;
            }
            // Ajustar el header según el rol
            configurarHeaderPorRol();

            // Cargar módulos dependientes
            await cargarEquipos(id);
            // Configurar tabs de Partidos según permisos y datos
            activarTabsPartidos();
            // Inicializar toggle de modo (si existe en HTML) y valor desde DB
            const modoToggle = document.getElementById('modo-ida-vuelta-toggle');
            const generarBtn = document.getElementById('generarPartidosBtn');
            if (modoToggle) {
                const isOrg = !!window._isTournamentOrganizer;
                // Ocultar si no es organizador
                if (!isOrg) {
                    const label = modoToggle.closest('label');
                    if (label) label.style.display = 'none';
                    if (generarBtn) generarBtn.style.display = 'none';
                }
                const actual = (window._torneoData?.modo_partidos) || 'solo';
                modoToggle.checked = actual === 'ida_vuelta';
                modoToggle.addEventListener('change', async (ev) => {
                    const nuevoModo = ev.currentTarget.checked ? 'ida_vuelta' : 'solo';
                    const base = (typeof window.getBackendUrl === 'function') ? window.getBackendUrl() : (window.REBOTE_BACKEND_URL || 'https://rebotex-backend.onrender.com');
                    const url = `${base}/api/torneos/${id}/modo-partidos`;
                    try {
                        const tkn = getAuthToken();
                        if (!tkn) throw new Error('401: Inicia sesión como organizador');
                        const res = await fetch(url, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
                            body: JSON.stringify({ modo_partidos: nuevoModo })
                        });
                        if (!res.ok) {
                            // Intentar obtener detalle del backend para mensajes más claros
                            let detail = `Error ${res.status}`;
                            try {
                                const j = await res.json();
                                detail = j.error || j.message || detail;
                            } catch(_) { }
                            throw new Error(detail);
                        }
                        const data = await res.json();
                        window._torneoData.modo_partidos = nuevoModo;
                        // Refrescar partidos tras cambio de modo
                        await cargarPartidos(id);
                        // Si activamos ida/vuelta y el backend generó la segunda vuelta, mostrar aviso
                        if (nuevoModo === 'ida_vuelta') {
                            const gen = (data && data.generar) ? data.generar : {};
                            if (!gen.blocked) {
                                if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
                                if (typeof showLogoutToast === 'function') {
                                  showLogoutToast('Partidos generados', 'Ve a la pestaña "Partidos" para programarlos');
                                } else if (typeof showFxToast === 'function') {
                                  showFxToast('Partidos generados', 'Ve a la pestaña "Partidos" para programarlos', 3000);
                                }
                            }
                        }
                    } catch (e) {
                        alert('Error al actualizar modo de partidos: ' + (e.message || e));
                        // revert toggle
                        ev.currentTarget.checked = !ev.currentTarget.checked;
                    }
                });
            }
            if (generarBtn) {
                generarBtn.addEventListener('click', async () => {
                    const base = (typeof window.getBackendUrl === 'function') ? window.getBackendUrl() : (window.REBOTE_BACKEND_URL || 'https://rebotex-backend.onrender.com');
                    const url = `${base}/api/torneos/${id}/partidos/generar`;
                    try {
                        const tkn = getAuthToken();
                        if (!tkn) throw new Error('401: Inicia sesión como organizador');
                        const res = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` }
                        });
                        if (!res.ok) throw new Error(`Error ${res.status}`);
                        await res.json();
                        await cargarPartidos(id);
                        if (typeof ensureAuthStyles === 'function') ensureAuthStyles();
                        if (typeof showLogoutToast === 'function') {
                          showLogoutToast('Partidos generados', 'Ve a la pestaña "Partidos" para programarlos');
                        } else {
                          showFxToast('Partidos generados', 'Ve a la pestaña "Partidos" para programarlos', 3000);
                        }
                    } catch (e) {
                        alert('Error al generar partidos: ' + (e.message || e));
                    }
                });
            }
            await cargarPartidos(id);
            await cargarEstadisticas(id);
        } catch (error) {
            console.error('Error al cargar la información del torneo (fallback):', error);
            const tituloElement = document.getElementById('torneo-titulo');
            if (tituloElement) tituloElement.textContent = 'Error al cargar torneo';
            ['torneo-fecha-inicio','torneo-fecha-fin','torneo-uid'].forEach(fid => {
                const el = document.getElementById(fid);
                if (el) el.textContent = '—';
            });
            const subtitleEl = document.querySelector('.hero-title-sub');
            if (subtitleEl) subtitleEl.textContent = '—';
        }
    })();
}

// Inicialización inmediata: si el script se carga al final del body, el DOM ya está listo.
// Esto evita depender exclusivamente de DOMContentLoaded en entornos donde eventos se pierden.
(function initTorneoView(){
  try {
    let torneoId = obtenerIdTorneo();
    const torneoUid = obtenerUidTorneo();
    const iniciar = (id) => {
      mostrarInformacionTorneo(id);
      // Salvaguarda: si pasados 5s sigue mostrando "Cargando...", mostrar mensaje claro
      setTimeout(() => {
        const tituloEl = document.getElementById('torneo-titulo');
        if (tituloEl && /cargando\.?/i.test(tituloEl.textContent || '')) {
          tituloEl.textContent = 'No se pudo cargar datos del torneo';
          ['torneo-fecha-inicio','torneo-fecha-fin','torneo-uid','torneo-equipos','torneo-partidos'].forEach(fid => {
            const el = document.getElementById(fid);
            if (el && /cargando/i.test(el.textContent || '')) el.textContent = '—';
          });
        }
      }, 5000);
    };

    if (torneoId) {
      iniciar(torneoId);
    } else if (torneoUid) {
      (async () => {
        const resolved = await resolverIdPorUid(torneoUid);
        if (resolved) {
          torneoId = resolved;
          iniciar(torneoId);
        } else {
          const tituloElement = document.getElementById('torneo-titulo');
          if (tituloElement) tituloElement.textContent = 'ID/UID de torneo no válido';
        }
      })();
    } else {
      const tituloElement = document.getElementById('torneo-titulo');
      if (tituloElement) tituloElement.textContent = 'ID/UID de torneo no válido';
    }
  } catch(e) {
    console.error('Init torneo/show.html falló:', e);
  }
})();
// ====== Helpers de autenticación y toast con diseño futurista ======
function getAuthToken() {
  try {
    const t = localStorage.getItem('authToken');
    if (t) return t;
    const ud = localStorage.getItem('userData');
    if (ud) {
      const u = JSON.parse(ud);
      if (u && u.token) return u.token;
    }
    const legacy = localStorage.getItem('token');
    if (legacy) return legacy;
  } catch(_) {}
  return '';
}

function ensureFxToastStyles() {
  if (document.getElementById('fx-toast-styles')) return;
  const style = document.createElement('style');
  style.id = 'fx-toast-styles';
  style.textContent = `
    .fx-toast { position: fixed; top: 20px; right: 20px; z-index: 3000;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #ffffff; border: 2px solid #00d4ff; border-radius: 12px;
      padding: 12px 16px; box-shadow: 0 12px 30px rgba(0, 212, 255, 0.25);
      display: flex; align-items: center; gap: 10px; opacity: 0;
      transform: translateY(-10px); transition: opacity .25s ease, transform .25s ease;
      font-family: 'Exo 2', 'Rajdhani', sans-serif; }
    .fx-toast.show { opacity: 1; transform: translateY(0); }
    .fx-toast .toast-icon { width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #00d4ff, #00ffa3);
      display: flex; align-items: center; justify-content: center; color: #0b0f1f;
      box-shadow: 0 6px 16px rgba(0, 212, 255, 0.35); flex-shrink: 0; }
    .fx-toast .toast-content { display: flex; flex-direction: column; }
    .fx-toast .toast-title { font-weight: 600; margin: 0; font-size: 0.95rem; }
    .fx-toast .toast-message { margin: 2px 0 0; font-size: 0.85rem; color: #b8c6db; }
  `;
  document.head.appendChild(style);
}

function showFxToast(title, message, durationMs = 3000) {
  ensureFxToastStyles();
  const existing = document.getElementById('fxToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'fxToast';
  toast.className = 'fx-toast';
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas fa-check"></i></div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.remove(); }, durationMs);
}

// Renderizar el header de navegación según el rol del usuario
function configurarHeaderPorRol() {
  try {
    const nav = document.querySelector('.futuristic-header .header-nav');
    if (!nav) return;
    const isOrg = !!window._isTournamentOrganizer;
    if (isOrg) {
      // Organizador: conservar el header actual (con Editar/Eliminar)
      const editBtn = document.getElementById('btnAbrirEditar');
      const deleteBtn = nav.querySelector('.delete-btn');
      if (editBtn) editBtn.style.display = '';
      if (deleteBtn) deleteBtn.style.display = '';
      nav.classList.remove('nav-guard');
      nav.classList.add('nav-ready');
      return;
    }
    // Participante: usar el header de dashboard (imagen 2)
    nav.innerHTML = `
      <a href="../client/dashboard.html" class="nav-btn">
        <i class="fas fa-home"></i><span>Inicio</span>
      </a>
      <a href="../torneo/create.html" class="nav-btn">
        <i class="fas fa-trophy"></i><span>Crear Torneo</span>
      </a>
      <a href="../Equipos/create.html" class="nav-btn">
        <i class="fas fa-users"></i><span>Crear Equipo</span>
      </a>
      <a href="../Notificaciones/Notis.html" class="nav-btn">
        <i class="fas fa-bell"></i><span>Notificaciones</span>
      </a>
      <a href="#" class="nav-btn">
        <i class="fas fa-user"></i><span>Perfil</span>
      </a>
      <a href="../client/Nosotros.html" class="nav-btn">
        <i class="fas fa-info-circle"></i><span>Sobre Nosotros</span>
      </a>
      <button class="nav-btn logout-btn" onclick="cerrarSesion()">
        <i class="fas fa-sign-out-alt"></i><span>Cerrar Sesión</span>
      </button>
    `;
    nav.classList.remove('nav-guard');
    nav.classList.add('nav-ready');
  } catch (_) {
    // Evitar romper la página si algo falla
  }
}
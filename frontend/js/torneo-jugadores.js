// torneo-jugadores.js - Pestaña de Jugadores agregada a la tarjeta "Equipos"
// Reutiliza helpers definidos en show-torneo.js: fetchJson, obtenerIdTorneo

// Render de tabla de jugadores del torneo
function renderJugadoresTable(jugadores) {
  const tbody = document.getElementById('jugadores-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!Array.isArray(jugadores) || jugadores.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'No hay jugadores registrados en este torneo';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // Orden solicitado:
  // 1) Total de puntos (TP) DESC
  // 2) Puntos triples (PT) DESC
  // 3) Puntos dobles (PD) DESC
  // 4) Tiros libres (TL) DESC
  // 5) Aleatorio si todos los criterios anteriores están empatados
  const toNum = (v) => Number(v ?? 0);
  const totalPts = (j) => toNum(j.tp ?? (toNum(j.pt) * 3 + toNum(j.pd) * 2 + toNum(j.tl)));
  const sorted = [...jugadores]
    .map(j => ({ ...j, __tb: Math.random() }))
    .sort((a, b) => {
      const c1 = totalPts(b) - totalPts(a);
      if (c1) return c1;
      const c2 = toNum(b.pt) - toNum(a.pt);
      if (c2) return c2;
      const c3 = toNum(b.pd) - toNum(a.pd);
      if (c3) return c3;
      const c4 = toNum(b.tl) - toNum(a.tl);
      if (c4) return c4;
      return b.__tb - a.__tb; // aleatorio
    });

  sorted.forEach(j => {
    const tr = document.createElement('tr');
    const cells = [
      j.jugador_nombre || '—',
      j.equipo_nombre || '—',
      String(j.tp ?? 0),
      String(j.pt ?? 0),
      String(j.pd ?? 0),
      String(j.tl ?? 0)
    ];
    cells.forEach(text => { const td = document.createElement('td'); td.textContent = text; tr.appendChild(td); });
    tbody.appendChild(tr);
  });
}

// Cargar jugadores del torneo desde la tabla torneo_jugadores (con stats)
async function cargarJugadoresTorneo(torneoId) {
  if (!torneoId) return;
  try {
    const data = await fetchJson(`/api/torneos/${torneoId}/jugadores`);
    const jugadores = data?.jugadores || data || [];
    renderJugadoresTable(jugadores);
  } catch (error) {
    console.error('Error al cargar jugadores del torneo:', error);
    renderJugadoresTable([]);
  }
}

// Tabs de Equipos: Lista <-> Jugadores
function activarTabsEquipos() {
  const tabLista = document.getElementById('equiposTabLista');
  const tabJug = document.getElementById('equiposTabJugadores');
  const contLista = document.getElementById('equipos-lista');
  const contJug = document.getElementById('equipos-jugadores');
  if (!tabLista || !tabJug || !contLista || !contJug) return;

  const setActive = (isJug) => {
    tabLista.classList.toggle('active', !isJug);
    tabJug.classList.toggle('active', isJug);
    contLista.style.display = isJug ? 'none' : '';
    contJug.style.display = isJug ? '' : 'none';
    if (isJug) {
      const id = (window._torneoInfo && window._torneoInfo.id) || obtenerIdTorneo();
      if (id) cargarJugadoresTorneo(id);
    }
  };

  tabLista.addEventListener('click', () => setActive(false));
  tabJug.addEventListener('click', () => setActive(true));
}

// Inicializar cuando el DOM esté listo y también por si el script se carga al final
(() => {
  try {
    activarTabsEquipos();
    const refreshBtn = document.getElementById('refreshEquiposBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const id = (window._torneoInfo && window._torneoInfo.id) || obtenerIdTorneo();
        if (!id) return;
        const jugActive = !!document.getElementById('equiposTabJugadores')?.classList.contains('active');
        if (jugActive) await cargarJugadoresTorneo(id);
      });
    }
  } catch (e) {
    console.error('Init torneo-jugadores falló:', e);
  }
})();
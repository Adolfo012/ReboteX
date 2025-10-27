// Encabezado flotante por overlay para la tabla general (robusto y desacoplado)
// Se inicializa automáticamente cuando el DOM está listo y al cambiar el contenido
// de '#estadisticas-tabla'. No depende de llamadas internas en show-torneo.js.

(function(){
  function setupStickyHeaderGeneral() {
    const cont = document.getElementById('tabla-general-scroll');
    if (!cont) return;
    const table = cont.querySelector('.futuristic-table');
    if (!table) return;
    const thead = table.querySelector('thead');
    if (!thead) return;
    const ths = Array.from(thead.querySelectorAll('th'));
    if (ths.length === 0) return;

    // Eliminar overlay anterior si existe
    const prev = cont.querySelector('.sticky-table-header');
    if (prev) try { prev.remove(); } catch(_) {}

    // Calcular anchos actuales de columnas
    const widths = ths.map(th => {
      const rect = th.getBoundingClientRect();
      return Math.max(40, Math.round(rect.width));
    });

    // Construir overlay
    const header = document.createElement('div');
    header.className = 'sticky-table-header';
    header.style.gridTemplateColumns = widths.map(w => `${w}px`).join(' ');
    ths.forEach(th => {
      const cell = document.createElement('div');
      cell.className = 'sticky-cell';
      cell.textContent = (th.textContent || '').trim();
      header.appendChild(cell);
    });

    // Insertar como primer hijo del contenedor de scroll
    cont.insertBefore(header, table);

    // Actualizar el overlay cuando cambien tamaños (resize/zoom)
    const refresh = () => {
      const w = ths.map(th => Math.max(40, Math.round(th.getBoundingClientRect().width)));
      header.style.gridTemplateColumns = w.map(x => `${x}px`).join(' ');
    };
    try {
      const ro = new ResizeObserver(refresh);
      ro.observe(table);
      window.addEventListener('resize', refresh);
    } catch(_) {
      window.addEventListener('resize', refresh);
    }
  }

  function scheduleSetup() {
    // Pequeño defer para asegurar layout final antes de medir anchos
    setTimeout(setupStickyHeaderGeneral, 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const cont = document.getElementById('tabla-general-scroll');
    if (!cont) return;
    const tbody = document.getElementById('estadisticas-tabla');

    scheduleSetup();

    // Reaplicar cuando cambie el contenido de la tabla
    if (tbody && window.MutationObserver) {
      try {
        const mo = new MutationObserver(() => scheduleSetup());
        mo.observe(tbody, { childList: true });
        cont.__stickyHeaderObserver = mo;
      } catch(_) {}
    }
  });
})();
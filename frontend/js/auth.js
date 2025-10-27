// auth.js - Confirmación personalizada de cierre de sesión
// Reutiliza estilos de modal definidos en dashboard-torneo.css

function cerrarSesion() {
  ensureLogoutModal();
  const overlay = document.getElementById('logoutModal');
  if (overlay) overlay.classList.add('show');
}

function ensureLogoutModal() {
  if (document.getElementById('logoutModal')) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'logoutModal';
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-icon"><i class="fas fa-sign-out-alt"></i></div>
        <h3 class="modal-title">Confirmar Cierre de Sesión</h3>
      </div>
      <div class="modal-body">
        <p>¿Deseas cerrar tu sesión y salir de ReboteX?</p>
        <p class="modal-warning">Se limpiarán tus credenciales locales.</p>
      </div>
      <div class="modal-actions">
        <button class="modal-btn cancel-btn" id="logoutCancelBtn">
          <i class="fas fa-times"></i>
          Cancelar
        </button>
        <button class="modal-btn confirm-btn" id="logoutConfirmBtn">
          <i class="fas fa-check"></i>
          Cerrar Sesión
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const cancelBtn = overlay.querySelector('#logoutCancelBtn');
  const confirmBtn = overlay.querySelector('#logoutConfirmBtn');

  cancelBtn?.addEventListener('click', () => {
    overlay.classList.remove('show');
  });
  confirmBtn?.addEventListener('click', () => {
    performLogout();
  });

  // Cerrar modal al hacer clic fuera del contenido
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('show');
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.classList.remove('show');
  });
}

function performLogout() {
  try {
    ['token', 'userId', 'userEmail', 'authToken', 'userData'].forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
    try { sessionStorage.clear(); } catch (_) {}
  } finally {
    // Cerrar el modal si está abierto
    const overlay = document.getElementById('logoutModal');
    overlay?.classList.remove('show');

    // Mostrar toast de confirmación y redirigir
    ensureAuthStyles();
    showLogoutToast('Sesión cerrada', 'Redirigiendo al login…');
    setTimeout(() => {
      window.location.href = '/frontend/login/login.html';
    }, 1200);
  }
}

function ensureAuthStyles() {
  if (document.getElementById('auth-js-styles')) return;
  const style = document.createElement('style');
  style.id = 'auth-js-styles';
  style.textContent = `
    .logout-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #ffffff;
      border: 2px solid #00d4ff;
      border-radius: 12px;
      padding: 12px 16px;
      box-shadow: 0 12px 30px rgba(0, 212, 255, 0.25);
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 3000;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      font-family: 'Exo 2', 'Rajdhani', sans-serif;
    }
    .logout-toast.show { opacity: 1; transform: translateY(0); }
    .logout-toast .toast-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00d4ff, #00ffa3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0b0f1f;
      box-shadow: 0 6px 16px rgba(0, 212, 255, 0.35);
      flex-shrink: 0;
    }
    .logout-toast .toast-content { display: flex; flex-direction: column; }
    .logout-toast .toast-title { font-weight: 600; margin: 0; font-size: 0.95rem; }
    .logout-toast .toast-message { margin: 2px 0 0; font-size: 0.85rem; color: #b8c6db; }
  `;
  document.head.appendChild(style);
}

function showLogoutToast(title = 'Sesión cerrada', message = 'Redirigiendo…') {
  // Evitar múltiples toasts simultáneos
  const existing = document.getElementById('logoutToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'logoutToast';
  toast.className = 'logout-toast';
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas fa-check"></i></div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  // Remover el toast si el usuario se queda en la página
  setTimeout(() => { toast.remove(); }, 4000);
}
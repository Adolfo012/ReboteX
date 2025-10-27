// create-equipo.js - Manejo del formulario de creación de equipos

(function(){
  const form = document.getElementById('equipoForm');
  const nameInput = document.getElementById('team-name');

  function showMessage(message, type = 'info') {
    const existing = document.querySelector('.form-message');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = `form-message ${type}`;
    div.textContent = message;
    div.style.cssText = `
      padding: 12px; margin: 10px 0; border-radius: 4px; font-weight: 500; text-align: center;
      ${type === 'success' ? 'background-color:#d4edda;color:#155724;border:1px solid #c3e6cb;' : ''}
      ${type === 'error' ? 'background-color:#f8d7da;color:#721c24;border:1px solid #f5c6cb;' : ''}
      ${type === 'info' ? 'background-color:#d1ecf1;color:#0c5460;border:1px solid #bee5eb;' : ''}
    `;
    form.parentNode.insertBefore(div, form);
    if (type !== 'success') setTimeout(() => div.remove(), 5000);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const nombre = (nameInput?.value || '').trim();
    if (!nombre) {
      showMessage('Por favor, escribe el nombre del equipo.', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      showMessage('No hay sesión activa. Inicia sesión nuevamente.', 'error');
      setTimeout(() => { window.location.href = '../login/login.html'; }, 1500);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    try {
      // Preferir backend remoto configurado (mismo usado por login)
      const BASE = (window.REBOTE_BACKEND_URL || window.API_URL || 'https://rebotex-backend.onrender.com');
      const resp = await fetch(`${BASE}/api/equipos/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nombre, deporte: 'Baloncesto' })
      });

      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = result.error || result.message || result.detail || `Error ${resp.status} al crear el equipo.`;
        showMessage(msg, 'error');
        return;
      }

      showMessage('¡Equipo creado exitosamente!', 'success');
      form.reset();
      setTimeout(() => { window.location.href = '../client/dashboard.html'; }, 1500);
    } catch (err) {
      console.error('Error creando equipo:', err);
      showMessage('Error de red. Intenta más tarde.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (form) form.addEventListener('submit', handleSubmit);
  });
})();
// config.js - Configuración global del backend
// Establece la URL base del backend desplegado en Render.
// Permite override si window.REBOTE_BACKEND_URL ya fue definido antes.
(function(){
  // Entorno local por defecto
  var LOCAL_URL = 'http://localhost:3001';
  var RENDER_URL = 'https://rebotex-backend.onrender.com';

  var storedUrl = (window.localStorage && window.localStorage.getItem && window.localStorage.getItem('REBOTE_BACKEND_URL')) || null;
  var storedEnv = (window.localStorage && window.localStorage.getItem && window.localStorage.getItem('REBOTE_ENV')) || null;
  var useRenderFlag = (window.localStorage && window.localStorage.getItem && window.localStorage.getItem('USE_RENDER')) || null;

  var defaultUrl;
  // Detectar si estamos en producción (Netlify u otro host no local)
  var host = (window && window.location && window.location.hostname) ? window.location.hostname : '';
  var isLocalHost = /^(localhost|127\.|\[?::1\]?|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1]))$/.test(host);

  var isStoredLocal = /localhost|\[?::1\]?|127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])/.test(String(storedUrl || ''));
  if (storedUrl && !(isStoredLocal && !isLocalHost)) {
    // Respetar URL guardada excepto si es local y estamos en host no local
    defaultUrl = storedUrl;
  } else if (storedEnv === 'render' || useRenderFlag === 'true') {
    defaultUrl = RENDER_URL;
  } else {
    // Si no estamos en host local, usar Render por defecto
    defaultUrl = isLocalHost ? LOCAL_URL : RENDER_URL;
  }

  if (!window.REBOTE_BACKEND_URL) {
    window.REBOTE_BACKEND_URL = defaultUrl;
  }
  if (!window.API_URL) {
    window.API_URL = window.REBOTE_BACKEND_URL;
  }

  // Helpers para alternar rápidamente
  window.setBackendEnv = function(env) {
    var target = (env === 'render') ? RENDER_URL : LOCAL_URL;
    try {
      window.localStorage && window.localStorage.setItem && window.localStorage.setItem('REBOTE_ENV', env === 'render' ? 'render' : 'local');
      window.localStorage && window.localStorage.removeItem && window.localStorage.removeItem('REBOTE_BACKEND_URL');
    } catch(_){}
    window.REBOTE_BACKEND_URL = target;
    window.API_URL = target;
    return target;
  };

  window.setBackendUrl = function(url) {
    try {
      window.localStorage && window.localStorage.setItem && window.localStorage.setItem('REBOTE_BACKEND_URL', url);
    } catch(_){}
    window.REBOTE_BACKEND_URL = url;
    window.API_URL = url;
    return url;
  };

  window.getBackendUrl = function(){
    return window.API_URL || window.REBOTE_BACKEND_URL;
  };
})();

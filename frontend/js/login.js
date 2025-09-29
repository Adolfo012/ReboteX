// login.js

const BACKEND_URL = window.REBOTE_BACKEND_URL || "http://localhost:3000";
const form = document.querySelector("form");
const emailInput = form.email;
const passwordInput = form.password;
const submitBtn = document.querySelector(".login-button");
const errorMsg = document.querySelector(".credential-h4");

// Función para validar que los campos no estén vacíos
function validateFields() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!email || !password) {
    submitBtn.disabled = true;
    return false;
  }
  
  submitBtn.disabled = false;
  return true;
}

// Función para mostrar mensajes de error
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.color = "#ff6b6b";
  errorMsg.style.display = "block";
}

// Función para limpiar mensajes de error
function clearError() {
  errorMsg.textContent = "";
  errorMsg.style.display = "none";
}

// Validar campos en tiempo real
emailInput.addEventListener("input", validateFields);
passwordInput.addEventListener("input", validateFields);

// Funcionalidad del botón de mostrar/ocultar contraseña
const togglePasswordBtn = document.getElementById("togglePassword");
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    
    // Cambiar iconos
    const hideIcon = togglePasswordBtn.querySelector(".icon-hide");
    const showIcon = togglePasswordBtn.querySelector(".icon-show");
    
    if (type === "password") {
      hideIcon.style.display = "block";
      showIcon.style.display = "none";
    } else {
      hideIcon.style.display = "none";
      showIcon.style.display = "block";
    }
  });
}

// Manejar el envío del formulario
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Validar campos antes de enviar
  if (!validateFields()) {
    showError("Por favor, completa todos los campos");
    return;
  }
  
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  // Limpiar errores previos
  clearError();
  
  // Deshabilitar botón durante la petición
  submitBtn.disabled = true;
  submitBtn.textContent = "Iniciando sesión...";
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        correo: email,
        pass: password
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Manejar errores del servidor
      showError(data.error || "Error al iniciar sesión");
      return;
    }
    
    // Login exitoso
    if (data.token && data.user) {
      // Guardar token y información del usuario en localStorage
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userData", JSON.stringify(data.user));
      
      // Mostrar mensaje de éxito
      errorMsg.style.color = "#4CAF50";
      errorMsg.textContent = "¡Inicio de sesión exitoso!";
      errorMsg.style.display = "block";
      
      // Redirigir al dashboard después de un breve delay
      setTimeout(() => {
        window.location.href = "../client/dashboard.html";
      }, 1500);
    } else {
      showError("Error: No se recibió token de autenticación");
    }
    
  } catch (error) {
    console.error("Error de red:", error);
    showError("Error de red. Intenta más tarde.");
  } finally {
    // Restaurar botón
    submitBtn.disabled = false;
    submitBtn.textContent = "Iniciar Sesión";
    
    // Re-validar campos para mantener el estado correcto del botón
    validateFields();
  }
});

// Validación inicial al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  validateFields();
});
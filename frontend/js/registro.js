// registro.js

const BACKEND_URL = window.REBOTE_BACKEND_URL || "http://localhost:3000";
const form = document.getElementById("register-form");
const passwordInput = form.password;
const confirmInput = form.confirmpassword;
const submitBtn = document.getElementById("register-submit");
const errorMsg = document.getElementById("password-error");

function validatePasswords() {
  const pass = passwordInput.value;
  const confirm = confirmInput.value;
  if (!pass || !confirm) {
    submitBtn.disabled = true;
    errorMsg.style.display = "none";
    return false;
  }
  if (pass !== confirm) {
    submitBtn.disabled = true;
    errorMsg.style.display = "inline";
    return false;
  }
  errorMsg.style.display = "none";
  submitBtn.disabled = false;
  return true;
}

passwordInput.addEventListener("input", validatePasswords);
confirmInput.addEventListener("input", validatePasswords);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pass = form.password.value;
  const confirm = form.confirmpassword.value;
  if (pass !== confirm) {
    validatePasswords();
    alert("Las contraseñas no coinciden");
    return;
  }
  const nombre = form.name.value.trim();
  const apellidop = form.fsurname.value.trim();
  const apellidom = form.msurname.value.trim();
  const correo = form.email.value.trim();
  const payload = {
    nombre,
    apellidop,
    apellidom,
    correo,
    pass,
    // Campos adicionales del esquema
    fecha_nacimiento: form.birthdate.value || null,
    genero: form.gender.value || null,
    apodo: form.nickname.value.trim() || null,
  };
  try {
    const resp = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      alert(data.error || "Error al registrar usuario");
      return;
    }
    alert("Registro exitoso");
    window.location.href = "./login.html";
  } catch (err) {
    console.error(err);
    alert("Error de red. Intenta más tarde.");
  }
});
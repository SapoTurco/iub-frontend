/* ============================================================
   LOGIN.JS — Inicio de sesión
   Usa API directamente (sin token aún), así que no depende
   de apiFetch. Guarda token, rol y nombre en localStorage.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  if (localStorage.getItem("token")) {
    window.location.href = "../html/app.html";
    return;
  }

  const form     = document.getElementById("formLogin");
  const btnLogin = form.querySelector(".btn-login");
  const errorMsg = form.querySelector(".error-msg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usuario    = document.getElementById("usuario").value.trim();
    const contrasena = document.getElementById("contrasena").value.trim();

    errorMsg.style.display = "none";
    errorMsg.textContent   = "";

    if (!usuario || !contrasena) {
      mostrarError("Por favor completa todos los campos.");
      return;
    }

    btnLogin.disabled    = true;
    btnLogin.textContent = "Verificando...";

    try {
      const res = await fetch(`${API}/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usuario, clave: contrasena })
      });

      const data = await res.json();

      if (!res.ok) {
        mostrarError(data.detail || "Credenciales incorrectas.");
        return;
      }

      localStorage.setItem("token",  data.token);
      localStorage.setItem("rol",    data.rol);
      localStorage.setItem("nombre", data.nombre);

      window.location.href = "../html/app.html";

    } catch {
      mostrarError("No se pudo conectar con el servidor. Verifica que el backend esté activo.");
    } finally {
      btnLogin.disabled    = false;
      btnLogin.textContent = "Ingresar";
    }
  });

  function mostrarError(msg) {
    errorMsg.textContent   = msg;
    errorMsg.style.display = "block";
  }

});
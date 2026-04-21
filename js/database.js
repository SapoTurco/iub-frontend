/* ============================================================
   DATABASE.JS
   Configuración central de la API, helpers de fetch,
   y utilidades compartidas por todas las páginas.
   ============================================================ */

const API = "http://localhost:8000";

/**
 * Hace una petición autenticada a la API.
 * Si el token expiró o no existe, redirige al login.
 */
async function apiFetch(endpoint, method = "GET", body = null) {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "../html/index.html";
    return;
  }

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    }
  };

  if (body) options.body = JSON.stringify(body);

  const res = await fetch(API + endpoint, options);

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "../html/index.html";
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
    throw new Error(err.detail || "Error en la petición");
  }

  return res.json();
}

/** Formatea una fecha de MariaDB ("YYYY-MM-DD HH:MM:SS") de forma legible. */
function formatFecha(fechaStr, opciones = { dateStyle: "short", timeStyle: "short" }) {
  if (!fechaStr) return "—";
  const d = new Date(fechaStr.replace(" ", "T"));
  return isNaN(d) ? "—" : d.toLocaleString("es-CO", opciones);
}

/** Genera las iniciales de un paciente (nombre + apellido). */
function iniciales(nombre, apellido) {
  return `${(nombre || " ")[0]}${(apellido || " ")[0]}`.toUpperCase();
}

/**
 * Renderiza una lista buscable de pacientes en un contenedor dado.
 * Reutilizada por CamasManager y ReportesManager.
 *
 * @param {HTMLElement} contenedor  - El div donde se insertan los ítems
 * @param {Array}       lista       - Pacientes a mostrar
 * @param {Function}    onSeleccionar - Callback(paciente) al elegir uno
 */
function renderListaPacientes(contenedor, lista, onSeleccionar) {
  if (!contenedor) return;
  contenedor.innerHTML = "";

  if (lista.length === 0) {
    contenedor.innerHTML = `<div class="lista-paciente-vacio">Sin resultados</div>`;
    contenedor.style.display = "block";
    return;
  }

  lista.forEach(p => {
    const ini  = iniciales(p.nombre, p.apellido);
    const item = document.createElement("div");
    item.className = "lista-paciente-item";
    item.innerHTML = `
      <div class="lpi-avatar">${ini}</div>
      <div class="lpi-info">
        <span class="lpi-nombre">${p.nombre} ${p.apellido}</span>
        <span class="lpi-sub">Doc: ${p.documento} · ${p.diagnostico || "Sin diagnóstico"}</span>
      </div>
      <span class="lpi-check" style="display:none">✔</span>
    `;

    item.addEventListener("click", () => {
      contenedor.querySelectorAll(".lista-paciente-item").forEach(el => {
        el.classList.remove("activo");
        el.querySelector(".lpi-check").style.display = "none";
      });
      item.classList.add("activo");
      item.querySelector(".lpi-check").style.display = "flex";
      contenedor.style.display = "none";
      onSeleccionar(p, ini);
    });

    contenedor.appendChild(item);
  });

  contenedor.style.display = "block";
}

// ── Inicialización global al cargar el DOM ────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Nombre en topbar — igual en todas las páginas
  const spanNombre = document.getElementById("topbar-nombre");
  if (spanNombre) spanNombre.textContent = localStorage.getItem("nombre") || "Usuario";

  // Cerrar sesión
  const btnLogout = document.querySelector(".sidebar-footer");
  if (btnLogout) btnLogout.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "../html/index.html";
  });
});
/* ============================================================
   SIDEBAR.JS
   Genera el menú de navegación dinámicamente según el rol.
   Debe incluirse DESPUÉS de database.js en cada página.
   ============================================================ */

(function buildSidebar() {
  const rol     = localStorage.getItem("rol") || "";
  const paginaActual = window.location.pathname.split("/").pop(); // ej: "app.html"

  // Definir ítems por rol
  const itemsComunes = [
    { href: "app.html",       icon: "../img/dashboard.svg", label: "Dashboard"  },
    { href: "camas.html",     icon: "../img/camas.svg",     label: "Camas"      },
    { href: "pacientes.html", icon: "../img/pacientes.svg", label: "Pacientes"  },
    { href: "reportes.html",  icon: "../img/reportes.svg",  label: "Reportes"   },
  ];

  const itemsAdmin = [
    ...itemsComunes,
    { href: "usuarios.html",  icon: "../img/usuarios.svg",   label: "Usuarios"   },
  ];

  const menuPorRol = {
    ADMIN:      itemsAdmin,
    ENFERMERIA: itemsComunes,
    MEDICO:     itemsComunes,
  };

  const items = menuPorRol[rol] || itemsComunes;

  const nav = document.getElementById("sidebar-nav");
  if (!nav) return;

  nav.innerHTML = items.map(item => {
    const activo = paginaActual === item.href ? " active" : "";
    return `
      <a href="${item.href}" class="nav-item${activo}">
        <img src="${item.icon}" alt="${item.label}" class="nav-icon" />
        ${item.label}
      </a>`;
  }).join("");
})();
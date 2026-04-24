/* ============================================================
   PACIENTES.JS — Gestión de pacientes con POO
   ============================================================ */

class PacientesManager {

  constructor() {
    this.pacientes       = [];
    this.camas           = [];
    this.movimientos     = [];
    this.terminoBusqueda = "";
    this.rol             = localStorage.getItem("rol") || "";
    this.puedeCrear      = ["ADMIN", "ENFERMERIA"].includes(this.rol);
  }

  init() {
    if (!localStorage.getItem("token")) {
      window.location.href = "../html/index.html";
      return;
    }

    const btnNuevo = document.getElementById("btn-nuevo-paciente");
    if (!this.puedeCrear) {
      btnNuevo.style.display = "none";
    } else {
      btnNuevo.addEventListener("click", () => this.abrirModalNuevoPaciente());
    }

    document.getElementById("input-buscar").addEventListener("input", e => {
      this.terminoBusqueda = e.target.value.toLowerCase().trim();
      this.renderTabla();
    });

    document.getElementById("btn-cerrar-modal").addEventListener("click",  () => this.cerrarModal());
    document.getElementById("btn-cancelar-modal").addEventListener("click", () => this.cerrarModal());

    this.cargarDatos();
    setInterval(() => this.cargarDatos(), 30000);
  }

  async cargarDatos() {
    try {
      const [pacientes, camas, movimientos] = await Promise.all([
        apiFetch("/pacientes"),
        apiFetch("/camas"),
        apiFetch("/movimientos")
      ]);
      this.pacientes   = pacientes;
      this.camas       = camas;
      this.movimientos = movimientos;
      this.renderTabla();
    } catch (err) {
      console.error("Error cargando datos:", err.message);
    }
  }

  /* Cama activa de un paciente */
  _camaDelPaciente(pacienteId) {
    return this.camas.find(c => c.estado === "OCUPADO" && c.paciente_id === pacienteId) || null;
  }

  /* Pacientes filtrados por búsqueda */
  _pacientesFiltrados() {
    if (!this.terminoBusqueda) return this.pacientes;
    return this.pacientes.filter(p =>
      `${p.nombre} ${p.apellido} ${p.documento}`.toLowerCase().includes(this.terminoBusqueda)
    );
  }

  renderTabla() {
    const tbody = document.getElementById("tabla-body");
    const lista = this._pacientesFiltrados();

    if (lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="pac-cargando">
            No se encontraron pacientes${this.terminoBusqueda ? ` para "${this.terminoBusqueda}"` : ""}.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = "";
    lista.forEach((p, i) => {
      const cama = this._camaDelPaciente(p.id);
      const badgeHtml = cama
        ? `<span class="badge-cama ocupado">🛏 ${cama.codigo}</span>`
        : `<span class="badge-cama sin-cama">Sin cama</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><span class="pac-nombre-completo">${p.nombre} ${p.apellido}</span></td>
        <td><span class="pac-doc">${p.documento}</span></td>
        <td>${p.diagnostico || "—"}</td>
        <td>${badgeHtml}</td>
        <td><button class="btn-ver-pac" data-id="${p.id}">Ver detalle</button></td>
      `;
      tr.querySelector(".btn-ver-pac").addEventListener("click", () => this.abrirModalDetalle(p));
      tbody.appendChild(tr);
    });
  }

  /* ── Modal detalle con acciones ADMIN ───────────────────── */
  abrirModalDetalle(p) {
    const cama = this._camaDelPaciente(p.id);
    const estadoCama = cama
      ? `<span class="badge-cama ocupado">Internado — ${cama.codigo}</span>`
      : `<span class="badge-cama sin-cama">Sin cama asignada</span>`;

    const movsPaciente = this.movimientos.filter(m => m.paciente === p.nombre).slice(0, 6);
    const historialHtml = movsPaciente.length > 0
      ? movsPaciente.map(m => {
          const clase = m.tipo === "INGRESO" ? "ingreso" : "alta";
          return `
            <div class="pac-historial-item ${clase}">
              <span class="pac-historial-tipo">${m.tipo}</span>
              <div class="pac-historial-info">
                <span class="pac-historial-cama">Cama ${m.cama}</span>
                <span class="pac-historial-fecha">${formatFecha(m.fecha)}</span>
              </div>
            </div>`;
        }).join("")
      : `<div class="pac-sin-historial">Sin movimientos registrados</div>`;

    document.getElementById("modal-titulo").textContent = `Paciente — ${p.nombre} ${p.apellido}`;
    document.getElementById("modal-cuerpo").innerHTML = `
      <div class="pac-detalle-card">
        <div class="pac-detalle-fila"><span>Nombre</span><span>${p.nombre} ${p.apellido}</span></div>
        <div class="pac-detalle-fila"><span>Documento</span><span>${p.documento}</span></div>
        <div class="pac-detalle-fila"><span>Estado</span><span>${estadoCama}</span></div>
        <div>
          <span style="font-size:12px;color:#888;font-weight:600;">Diagnóstico</span>
          <div class="pac-detalle-diagnostico">${p.diagnostico || "No registrado"}</div>
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">
          Historial reciente
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">${historialHtml}</div>
      </div>

      ${this.rol === "ADMIN" ? `
        <div class="pac-detalle-acciones">
          <button class="pac-btn-ver"      id="btn-detalle-editar">✏️ Editar</button>
          <button class="pac-btn-eliminar" id="btn-detalle-eliminar">🗑 Eliminar</button>
        </div>` : ""}
    `;

    /* Oculta el botón "Confirmar" genérico — las acciones van por los botones propios */
    document.getElementById("btn-confirmar").style.display = "none";

    if (this.rol === "ADMIN") {
      document.getElementById("btn-detalle-editar").addEventListener("click", () => {
        this.cerrarModal();
        this.abrirModalEditar(p);
      });
      document.getElementById("btn-detalle-eliminar").addEventListener("click", () => {
        this.cerrarModal();
        this.confirmarEliminar(p);
      });
    }

    this.abrirModal();
  }

  /* ── Formulario compartido crear / editar ───────────────── */
  _formPaciente(p = {}) {
    return `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label>Nombre</label>
          <input type="text" id="pac-nombre" value="${p.nombre || ""}"
            placeholder="Ej: Juan" maxlength="60"
            oninput="this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '')" />
        </div>
        <div>
          <label>Apellido</label>
          <input type="text" id="pac-apellido" value="${p.apellido || ""}"
            placeholder="Ej: García" maxlength="60"
            oninput="this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '')" />
        </div>
        <div>
          <label>Documento</label>
          <input type="text" id="pac-documento" value="${p.documento || ""}"
            placeholder="Ej: 12345678" maxlength="20" />
        </div>
        <div>
          <label>Diagnóstico</label>
          <textarea id="pac-diagnostico" rows="3"
            placeholder="Descripción del diagnóstico…" maxlength="300">${p.diagnostico || ""}</textarea>
        </div>
        <span class="modal-error" id="modal-error" style="display:none;"></span>
      </div>`;
  }

  _leerForm() {
    const nombre      = document.getElementById("pac-nombre")?.value.trim();
    const apellido    = document.getElementById("pac-apellido")?.value.trim();
    const documento   = document.getElementById("pac-documento")?.value.trim();
    const diagnostico = document.getElementById("pac-diagnostico")?.value.trim();

    const errorEl = document.getElementById("modal-error");

    if (!nombre || !apellido || !documento) {
      errorEl.textContent   = "Nombre, apellido y documento son obligatorios.";
      errorEl.style.display = "block";
      return null;
    }

    // Validación: nombre y apellido solo pueden contener letras y espacios
    if (/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/.test(nombre)) {
      errorEl.textContent   = "El nombre solo puede contener letras.";
      errorEl.style.display = "block";
      return null;
    }

    if (/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/.test(apellido)) {
      errorEl.textContent   = "El apellido solo puede contener letras.";
      errorEl.style.display = "block";
      return null;
    }

    return { nombre, apellido, documento, diagnostico };
  }

  /* ── Nuevo paciente ─────────────────────────────────────── */
  abrirModalNuevoPaciente() {
    document.getElementById("modal-titulo").textContent = "Nuevo paciente";
    document.getElementById("modal-cuerpo").innerHTML  = this._formPaciente();

    const btn = document.getElementById("btn-confirmar");
    btn.style.display = "";
    btn.textContent   = "Crear paciente";
    btn.className     = "modal-btn-confirmar";
    btn.onclick = async () => {
      const datos = this._leerForm();
      if (!datos) return;
      try {
        await apiFetch("/pacientes", "POST", datos);
        this.cerrarModal();
        await this.cargarDatos();
      } catch (err) {
        const errorEl = document.getElementById("modal-error");
        errorEl.textContent   = err.message;
        errorEl.style.display = "block";
      }
    };

    this.abrirModal();
  }

  /* ── Editar paciente (solo ADMIN) ───────────────────────── */
  abrirModalEditar(p) {
    document.getElementById("modal-titulo").textContent = "Editar paciente";
    document.getElementById("modal-cuerpo").innerHTML  = this._formPaciente(p);

    const btn = document.getElementById("btn-confirmar");
    btn.style.display  = "";
    btn.style.background = "";
    btn.textContent    = "Guardar cambios";
    btn.className      = "modal-btn-confirmar";
    btn.onclick = async () => {
      const datos = this._leerForm();
      if (!datos) return;
      try {
        await apiFetch(`/pacientes/${p.id}`, "PUT", datos);
        this.cerrarModal();
        await this.cargarDatos();
      } catch (err) {
        const errorEl = document.getElementById("modal-error");
        errorEl.textContent   = err.message;
        errorEl.style.display = "block";
      }
    };

    this.abrirModal();
  }

  /* ── Eliminar paciente (solo ADMIN) ─────────────────────── */
  confirmarEliminar(p) {
    document.getElementById("modal-titulo").textContent = "Eliminar paciente";
    document.getElementById("modal-cuerpo").innerHTML = `
      <p style="margin:0 0 8px;">
        ¿Estás seguro de eliminar a <strong>${p.nombre} ${p.apellido}</strong>?
      </p>
      <p style="color:#e05252;font-size:.9rem;">Esta acción no se puede deshacer.</p>
    `;

    const btn = document.getElementById("btn-confirmar");
    btn.style.display    = "";
    btn.style.background = "#e05252";
    btn.textContent      = "Eliminar";
    btn.onclick = async () => {
      try {
        await apiFetch(`/pacientes/${p.id}`, "DELETE");
        this.cerrarModal();
        await this.cargarDatos();
      } catch (err) {
        alert("Error: " + err.message);
      }
    };

    this.abrirModal();
  }

  abrirModal()  { document.getElementById("modal-overlay").classList.remove("oculto"); }
  cerrarModal() {
    document.getElementById("modal-overlay").classList.add("oculto");
    const btn = document.getElementById("btn-confirmar");
    if (btn) {
      btn.style.display    = "";
      btn.style.background = "";
      btn.textContent      = "Confirmar";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PacientesManager().init();
});

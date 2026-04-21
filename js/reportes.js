/* ============================================================
   REPORTES.JS — Reportes clínicos con POO
   ============================================================ */

class ReportesManager {

  constructor() {
    this.reportes        = [];
    this.pacientes       = [];
    this.puedeCrear      = ["ADMIN", "MEDICO"].includes(localStorage.getItem("rol"));
    this.terminoBusqueda = "";
    this.filtroTipo      = "";

    this.LABEL_TIPO = {
      MEDICO:      "Médico",
      OBSERVACION: "Observación",
      INGRESO:     "Ingreso",
      ALTA:        "Alta"
    };

    this._pacientesReporte = [];
    this._pacienteReporte  = null;
  }

  init() {
    if (!localStorage.getItem("token")) {
      window.location.href = "../html/index.html";
      return;
    }

    const btnNuevo = document.getElementById("btn-nuevo-reporte");
    if (!this.puedeCrear) {
      btnNuevo.style.display = "none";
    } else {
      btnNuevo.addEventListener("click", () => this.abrirModalNuevoReporte());
    }

    document.getElementById("input-buscar").addEventListener("input", e => {
      this.terminoBusqueda = e.target.value.toLowerCase().trim();
      this.renderTabla();
    });

    document.getElementById("select-tipo-filtro").addEventListener("change", e => {
      this.filtroTipo = e.target.value;
      this.renderTabla();
    });

    document.getElementById("btn-cerrar-modal").addEventListener("click",  () => this.cerrarModal());
    document.getElementById("btn-cancelar-modal").addEventListener("click", () => this.cerrarModal());

    this.cargarDatos();
    setInterval(() => this.cargarDatos(), 30000);
  }

  async cargarDatos() {
    try {
      const [reportes, pacientes] = await Promise.all([
        apiFetch("/reportes"),
        apiFetch("/pacientes")
      ]);
      this.reportes  = reportes;
      this.pacientes = pacientes;
      this.renderTabla();
    } catch (err) {
      console.error("Error cargando reportes:", err.message);
    }
  }

  _reportesFiltrados() {
    return this.reportes.filter(r => {
      const nombre = `${r.paciente.nombre} ${r.paciente.apellido}`.toLowerCase();
      return (!this.terminoBusqueda || nombre.includes(this.terminoBusqueda))
          && (!this.filtroTipo      || r.tipo === this.filtroTipo);
    });
  }

  renderTabla() {
    const tbody = document.getElementById("tabla-body");
    const lista = this._reportesFiltrados();

    if (lista.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="rep-cargando">
            No se encontraron reportes${this.terminoBusqueda || this.filtroTipo ? " con los filtros aplicados" : ""}.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = "";
    lista.forEach((r, i) => {
      const fecha    = formatFecha(r.fecha);
      const rolBadge = ["ADMIN", "MEDICO"].includes(r.rol_autor)
        ? `<span class="rep-rol-badge ${r.rol_autor}">${r.rol_autor}</span>` : "";
      const preview  = r.contenido.length > 60 ? r.contenido.substring(0, 60) + "…" : r.contenido;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><span class="badge-tipo ${r.tipo}">${this.LABEL_TIPO[r.tipo] || r.tipo}</span></td>
        <td>
          <span class="rep-paciente-nombre">${r.paciente.nombre} ${r.paciente.apellido}</span><br>
          <span class="rep-paciente-doc">${r.paciente.documento}</span>
        </td>
        <td><span class="rep-contenido-preview">${preview}</span></td>
        <td><span class="rep-autor">${r.autor}</span>${rolBadge}</td>
        <td><span class="rep-fecha">${fecha}</span></td>
        <td><button class="btn-ver-rep">Ver</button></td>
      `;
      tr.querySelector(".btn-ver-rep").addEventListener("click", () => this.abrirModalDetalle(r));
      tbody.appendChild(tr);
    });
  }

  abrirModalDetalle(r) {
    const rolBadge = ["ADMIN", "MEDICO"].includes(r.rol_autor)
      ? `<span class="rep-rol-badge ${r.rol_autor}">${r.rol_autor}</span>` : "";

    document.getElementById("modal-titulo").textContent = `Reporte — ${this.LABEL_TIPO[r.tipo] || r.tipo}`;
    document.getElementById("modal-cuerpo").innerHTML = `
      <div class="rep-detalle-header">
        <span class="badge-tipo ${r.tipo}" style="font-size:13px;padding:5px 14px;">
          ${this.LABEL_TIPO[r.tipo] || r.tipo}
        </span>
        <div class="rep-detalle-info">
          <span class="rep-detalle-paciente">${r.paciente.nombre} ${r.paciente.apellido}</span>
          <span class="rep-detalle-meta">Doc: ${r.paciente.documento}</span>
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">
          Contenido del reporte
        </div>
        <div class="rep-detalle-contenido">${r.contenido}</div>
      </div>
      <div>
        <div class="rep-detalle-fila"><span>Autor</span><span>${r.autor} ${rolBadge}</span></div>
        <div class="rep-detalle-fila">
          <span>Fecha</span>
          <span>${formatFecha(r.fecha, { dateStyle: "long", timeStyle: "short" })}</span>
        </div>
      </div>
    `;

    document.getElementById("btn-confirmar").style.display = "none";
    this.abrirModal();
  }

  abrirModalNuevoReporte() {
    this._pacientesReporte = [...this.pacientes].sort((a, b) => b.id - a.id);
    this._pacienteReporte  = null;

    document.getElementById("modal-titulo").textContent = "Nuevo reporte clínico";
    document.getElementById("modal-cuerpo").innerHTML = `
      <div class="buscador-paciente-wrap">
        <label>Buscar paciente</label>
        <input type="text" id="rep-input-buscar"
          placeholder="Escribe nombre, apellido o documento..." autocomplete="off" />
        <div id="rep-lista-pacientes" class="lista-pacientes" style="display:none"></div>
        <div id="rep-paciente-elegido" class="paciente-elegido oculto-elegido"></div>
      </div>
      <div>
        <label>Tipo de reporte</label>
        <select id="rep-tipo">
          <option value="">— Selecciona el tipo —</option>
          <option value="MEDICO">Médico / Evolución</option>
          <option value="OBSERVACION">Observación general</option>
          <option value="INGRESO">Ingreso</option>
          <option value="ALTA">Alta</option>
        </select>
      </div>
      <div>
        <label>Contenido</label>
        <textarea id="rep-contenido" rows="5"
          placeholder="Describe el estado del paciente, indicaciones, observaciones…"
          maxlength="2000"></textarea>
      </div>
      <span class="modal-error" id="modal-error"></span>
    `;

    const listaEl = document.getElementById("rep-lista-pacientes");
    const inputEl = document.getElementById("rep-input-buscar");

    const onSel = (p, ini) => {
      this._pacienteReporte = p;
      inputEl.value = `${p.nombre} ${p.apellido}`;
      inputEl.blur();
      listaEl.style.display = "none";

      const elegido = document.getElementById("rep-paciente-elegido");
      elegido.innerHTML = `
        <div class="lpi-avatar lpi-avatar-sm">${ini}</div>
        <div class="elegido-info">
          <b>${p.nombre} ${p.apellido}</b>
          <span>Doc: ${p.documento} · ${p.diagnostico || ""}</span>
        </div>
        <button class="elegido-clear" id="rep-btn-limpiar">✕</button>
      `;
      elegido.classList.remove("oculto-elegido");
      document.getElementById("rep-btn-limpiar").addEventListener("click", () => {
        this._pacienteReporte = null;
        elegido.classList.add("oculto-elegido");
        inputEl.value = ""; inputEl.focus();
        renderListaPacientes(listaEl, this._pacientesReporte, onSel);
      });
    };

    inputEl.addEventListener("focus", () => {
      if (!this._pacienteReporte)
        renderListaPacientes(listaEl, this._pacientesReporte, onSel);
    });

    inputEl.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        this._pacienteReporte = null;
        document.getElementById("rep-paciente-elegido").classList.add("oculto-elegido");
        renderListaPacientes(listaEl, this._pacientesReporte, onSel);
        return;
      }
      renderListaPacientes(
        listaEl,
        this._pacientesReporte.filter(p =>
          `${p.nombre} ${p.apellido} ${p.documento}`.toLowerCase().includes(q)
        ),
        onSel
      );
    });

    document.addEventListener("click", function cerrar(e) {
      const wrap = document.querySelector(".buscador-paciente-wrap");
      if (wrap && !wrap.contains(e.target)) {
        listaEl.style.display = "none";
        document.removeEventListener("click", cerrar);
      }
    });

    const btn = document.getElementById("btn-confirmar");
    btn.style.display = "";
    btn.textContent   = "Guardar reporte";
    btn.className     = "modal-btn-confirmar";
    btn.onclick = async () => {
      const paciente_id = this._pacienteReporte?.id || null;
      const tipo        = document.getElementById("rep-tipo").value.trim();
      const contenido   = document.getElementById("rep-contenido").value.trim();
      const errorEl     = document.getElementById("modal-error");
      errorEl.style.display = "none";

      if (!paciente_id) { errorEl.textContent = "Debes seleccionar un paciente de la lista."; errorEl.style.display = "block"; return; }
      if (!tipo)        { errorEl.textContent = "Debes seleccionar el tipo de reporte.";       errorEl.style.display = "block"; return; }
      if (!contenido)   { errorEl.textContent = "El contenido no puede estar vacío.";           errorEl.style.display = "block"; return; }

      try {
        await apiFetch("/reportes", "POST", { tipo, contenido, paciente_id });
        this.cerrarModal();
        await this.cargarDatos();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
      }
    };

    this.abrirModal();
  }

  abrirModal()  { document.getElementById("modal-overlay").classList.remove("oculto"); }
  cerrarModal() {
    document.getElementById("modal-overlay").classList.add("oculto");
    const btn = document.getElementById("btn-confirmar");
    if (btn) btn.style.display = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ReportesManager().init();
});
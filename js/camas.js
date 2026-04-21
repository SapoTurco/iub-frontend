/* ============================================================
   CAMAS.JS — Gestión de camas con POO
   - DISPONIBLE  → asignar paciente (INGRESO)
   - OCUPADO     → dar de alta
   - MANTENIMIENTO → finalizar mantenimiento
   - Solo ADMIN puede crear camas nuevas
   ============================================================ */

class CamasManager {

  constructor() {
    this.camas     = [];
    this.pacientes = [];
    this.filtro    = "todos";
    this.esAdmin   = localStorage.getItem("rol") === "ADMIN";

    this.ZONAS_ORDEN = ["GENERAL", "UCI", "AISLAMIENTO", "QUIROFANO"];

    this.ETIQUETAS_ZONA = {
      GENERAL:     "Área General",
      UCI:         "UCI — Cuidados Intensivos",
      AISLAMIENTO: "Aislamiento",
      QUIROFANO:   "Quirófano"
    };

    this.CLASE_ESTADO = {
      DISPONIBLE:    "disponible",
      OCUPADO:       "ocupada",
      MANTENIMIENTO: "mantenimiento"
    };

    this.LABEL_ESTADO = {
      DISPONIBLE:    "Disponible",
      OCUPADO:       "Ocupada",
      MANTENIMIENTO: "Mantenimiento"
    };

    // Estado del buscador de pacientes
    this._pacientesAsignar     = [];
    this._pacienteSeleccionado = null;
  }

  init() {
    if (!localStorage.getItem("token")) {
      window.location.href = "../html/index.html";
      return;
    }

    const btnNueva = document.getElementById("btn-nueva-cama");
    if (btnNueva) {
      if (!this.esAdmin) btnNueva.style.display = "none";
      else btnNueva.addEventListener("click", () => this.abrirModalNuevaCama());
    }

    document.querySelectorAll(".filtro").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filtro").forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");
        this.filtro = btn.dataset.filtro;
        this.renderZonas();
      });
    });

    document.getElementById("btn-cerrar-modal").addEventListener("click",  () => this.cerrarModal());
    document.getElementById("btn-cancelar-modal").addEventListener("click", () => this.cerrarModal());

    this.cargarDatos();
    setInterval(() => this.cargarDatos(), 30000);
  }

  async cargarDatos() {
    try {
      const [camas, pacientes] = await Promise.all([
        apiFetch("/camas"),
        apiFetch("/pacientes")
      ]);
      this.camas     = camas;
      this.pacientes = pacientes;
      this.renderZonas();
    } catch (err) {
      console.error("Error cargando datos:", err.message);
    }
  }

  renderZonas() {
    const contenedor = document.getElementById("zonas-contenedor");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const camasFiltradas = this.filtro === "todos"
      ? this.camas
      : this.camas.filter(c => c.estado === this.filtro);

    this.ZONAS_ORDEN.forEach(zona => {
      const camasZona = camasFiltradas.filter(c => c.zona === zona);
      if (camasZona.length === 0) return;

      const disponibles = camasZona.filter(c => c.estado === "DISPONIBLE").length;

      const seccion = document.createElement("div");
      seccion.className = "zona-seccion";
      seccion.innerHTML = `
        <div class="zona-encabezado">
          <span class="zona-nombre">${this.ETIQUETAS_ZONA[zona] || zona}</span>
          <span class="zona-contador">${disponibles} disponibles / ${camasZona.length} total</span>
        </div>
        <div class="zona-tarjetas" id="tarjetas-${zona}"></div>
      `;
      contenedor.appendChild(seccion);

      const grid = seccion.querySelector(`#tarjetas-${zona}`);
      camasZona.forEach(cama => grid.appendChild(this.crearTarjeta(cama)));
    });

    if (contenedor.innerHTML === "") {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:40px;color:#aaa;font-size:14px;">
          No hay camas que coincidan con el filtro seleccionado.
        </div>`;
    }
  }

  crearTarjeta(cama) {
    const clase = this.CLASE_ESTADO[cama.estado] || "disponible";
    const label = this.LABEL_ESTADO[cama.estado] || cama.estado;
    const pacienteAsignado = cama.paciente
      ? `${cama.paciente.nombre} ${cama.paciente.apellido}`
      : (cama.estado === "OCUPADO" ? "Paciente asignado" : "—");

    const div = document.createElement("div");
    div.className = `tarjeta-cama ${clase}`;
    div.innerHTML = `
      <span class="tarjeta-codigo">${cama.codigo}</span>
      <span class="tarjeta-ubicacion">${this.ETIQUETAS_ZONA[cama.zona] || cama.zona}</span>
      <span class="tarjeta-estado-badge">${label}</span>
      <span class="tarjeta-paciente">${pacienteAsignado}</span>
    `;

    div.addEventListener("click", () => {
      if      (cama.estado === "DISPONIBLE")    this.abrirModalAsignar(cama);
      else if (cama.estado === "OCUPADO")       this.abrirModalAlta(cama);
      else if (cama.estado === "MANTENIMIENTO") this.abrirModalSacarMantenimiento(cama);
    });

    return div;
  }

  /* ── Modal: ASIGNAR paciente ─────────────────────────────── */
  abrirModalAsignar(cama) {
    const pacientesOcupados = new Set(
      this.camas.filter(c => c.estado === "OCUPADO" && c.paciente_id).map(c => c.paciente_id)
    );
    this._pacientesAsignar     = this.pacientes.filter(p => !pacientesOcupados.has(p.id)).sort((a, b) => b.id - a.id);
    this._pacienteSeleccionado = null;

    document.getElementById("modal-titulo").textContent = `Asignar paciente — ${cama.codigo}`;
    document.getElementById("modal-cuerpo").innerHTML = `
      <div class="modal-info-cama">
        <div class="modal-cama-icon">🛏️</div>
        <div>
          <div class="modal-cama-codigo">${cama.codigo}</div>
          <div class="modal-cama-zona">${this.ETIQUETAS_ZONA[cama.zona] || cama.zona}</div>
        </div>
        <span class="badge-disponible">Disponible</span>
      </div>
      <div class="buscador-paciente-wrap">
        <label>Buscar paciente</label>
        <input type="text" id="input-buscar-paciente"
          placeholder="Escribe nombre, apellido o documento..." autocomplete="off" />
        <div id="lista-pacientes" class="lista-pacientes" style="display:none"></div>
        <div id="paciente-elegido" class="paciente-elegido oculto-elegido"></div>
      </div>
      <span class="modal-error" id="modal-error"></span>
    `;

    this._bindBuscador(
      "input-buscar-paciente", "lista-pacientes", "paciente-elegido",
      this._pacientesAsignar,
      (p, ini) => {
        this._pacienteSeleccionado = p;
        this._mostrarChip("paciente-elegido", "btn-limpiar-paciente", p, ini, () => {
          this._pacienteSeleccionado = null;
          document.getElementById("input-buscar-paciente").value = "";
          renderListaPacientes(
            document.getElementById("lista-pacientes"),
            this._pacientesAsignar,
            (p2, ini2) => { this._pacienteSeleccionado = p2; this._mostrarChip("paciente-elegido", "btn-limpiar-paciente", p2, ini2, null); }
          );
        });
      }
    );

    // Botón mantenimiento en el pie
    const pie = document.querySelector(".modal-pie");
    const btnMant = document.createElement("button");
    btnMant.id = "btn-mantenimiento";
    btnMant.className = "modal-btn-mantenimiento";
    btnMant.textContent = "Mantenimiento";
    btnMant.onclick = async () => {
      const errorEl = document.getElementById("modal-error");
      errorEl.style.display = "none";
      try {
        await apiFetch(`/camas/${cama.id}?estado=MANTENIMIENTO`, "PUT");
        this.cerrarModal();
        await this.cargarDatos();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
      }
    };
    pie.insertBefore(btnMant, pie.firstChild);

    this._setConfirmar("Asignar", "modal-btn-confirmar", async () => {
      const errorEl = document.getElementById("modal-error");
      errorEl.style.display = "none";
      if (!this._pacienteSeleccionado) {
        errorEl.textContent = "Debes seleccionar un paciente de la lista.";
        errorEl.style.display = "block";
        return;
      }
      try {
        await apiFetch("/asignar", "POST", { paciente_id: this._pacienteSeleccionado.id, cama_id: cama.id });
        this.cerrarModal();
        await this.cargarDatos();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
      }
    });

    this.abrirModal();
  }

  /* ── Modal: ALTA ─────────────────────────────────────────── */
  abrirModalAlta(cama) {
    const pacienteInfo = cama.paciente
      ? `${cama.paciente.nombre} ${cama.paciente.apellido}<br>
         <small>Doc: ${cama.paciente.documento}</small><br>
         <small style="color:#888">${cama.paciente.diagnostico}</small>`
      : "Paciente en esta cama";

    document.getElementById("modal-titulo").textContent = `Alta médica — ${cama.codigo}`;
    document.getElementById("modal-cuerpo").innerHTML = `
      <div class="modal-alta-confirmacion">
        <div class="modal-alta-icono">🏥</div>
        <div class="modal-alta-texto">
          <p>¿Desea dar de alta al paciente asignado a esta cama?</p>
          <div class="modal-paciente-info">${pacienteInfo}</div>
        </div>
      </div>
      <div class="modal-cama-detalle">
        <span>Cama: <b>${cama.codigo}</b></span>
        <span>Zona: <b>${this.ETIQUETAS_ZONA[cama.zona] || cama.zona}</b></span>
      </div>
      <p class="modal-advertencia">⚠ Esta acción liberará la cama y registrará el alta en el sistema.</p>
      <span class="modal-error" id="modal-error"></span>
    `;

    this._setConfirmar("Dar de alta", "modal-btn-confirmar modal-btn-alta", async () => {
      const errorEl = document.getElementById("modal-error");
      errorEl.style.display = "none";
      try {
        await apiFetch("/alta", "POST", { paciente_id: cama.paciente_id || 0, cama_id: cama.id });
        this.cerrarModal();
        await this.cargarDatos();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
      }
    });

    this.abrirModal();
  }

  /* ── Modal: SACAR DE MANTENIMIENTO ──────────────────────── */
  abrirModalSacarMantenimiento(cama) {
    document.getElementById("modal-titulo").textContent = `Mantenimiento — ${cama.codigo}`;
    document.getElementById("modal-cuerpo").innerHTML = `
      <div class="modal-alta-confirmacion" style="background:#fffbea;border-color:#fde68a;">
        <div class="modal-alta-icono">🔧</div>
        <div class="modal-alta-texto">
          <p>¿Desea finalizar el mantenimiento de esta cama?</p>
          <div class="modal-paciente-info" style="color:#92400e;">
            La cama volverá a estar <b>Disponible</b> y podrá asignarse a un paciente.
          </div>
        </div>
      </div>
      <div class="modal-cama-detalle">
        <span>Cama: <b>${cama.codigo}</b></span>
        <span>Zona: <b>${this.ETIQUETAS_ZONA[cama.zona] || cama.zona}</b></span>
      </div>
      <p class="modal-advertencia" style="background:#fef3c7;color:#92400e;">
        ⚠ Esta acción liberará la cama y la dejará disponible para nuevos ingresos.
      </p>
      <span class="modal-error" id="modal-error"></span>
    `;

    this._setConfirmar("Finalizar mantenimiento", "modal-btn-confirmar modal-btn-mantenimiento-fin", async () => {
      const errorEl = document.getElementById("modal-error");
      errorEl.style.display = "none";
      try {
        await apiFetch(`/camas/${cama.id}?estado=DISPONIBLE`, "PUT");
        this.cerrarModal();
        await this.cargarDatos();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
      }
    });

    this.abrirModal();
  }

  /* ── Modal: NUEVA CAMA ───────────────────────────────────── */
  abrirModalNuevaCama() {
    document.getElementById("modal-titulo").textContent = "Nueva cama";
    document.getElementById("modal-cuerpo").innerHTML = `
      <div>
        <label>Código</label>
        <input type="text" id="nueva-codigo" placeholder="Ej: GEN-05" maxlength="20" />
      </div>
      <div>
        <label>Zona</label>
        <select id="nueva-zona">
          <option value="GENERAL">General</option>
          <option value="UCI">UCI</option>
          <option value="AISLAMIENTO">Aislamiento</option>
          <option value="QUIROFANO">Quirófano</option>
        </select>
      </div>
      <span class="modal-error" id="modal-error"></span>
    `;

    this._setConfirmar("Crear cama", "modal-btn-confirmar", async () => {
      const codigo  = document.getElementById("nueva-codigo").value.trim().toUpperCase();
      const zona    = document.getElementById("nueva-zona").value;
      const errorEl = document.getElementById("modal-error");
      errorEl.style.display = "none";
      if (!codigo) {
        errorEl.textContent = "El código es obligatorio.";
        errorEl.style.display = "block";
        return;
      }
      try {
        await apiFetch("/camas", "POST", { codigo, zona });
        this.cerrarModal();
        await this.cargarDatos();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
      }
    });

    this.abrirModal();
  }

  /* ── Helpers privados ────────────────────────────────────── */

  /** Conecta input + lista de búsqueda de pacientes */
  _bindBuscador(inputId, listaId, elegidoId, listaPacientes, onSeleccionar) {
    const inputEl = document.getElementById(inputId);
    const listaEl = document.getElementById(listaId);

    inputEl.addEventListener("focus", () => {
      if (!this._pacienteSeleccionado)
        renderListaPacientes(listaEl, listaPacientes, onSeleccionar);
    });

    inputEl.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        this._pacienteSeleccionado = null;
        document.getElementById(elegidoId).classList.add("oculto-elegido");
        renderListaPacientes(listaEl, listaPacientes, onSeleccionar);
        return;
      }
      renderListaPacientes(
        listaEl,
        listaPacientes.filter(p => `${p.nombre} ${p.apellido} ${p.documento}`.toLowerCase().includes(q)),
        onSeleccionar
      );
    });

    document.addEventListener("click", function cerrar(e) {
      const wrap = document.querySelector(".buscador-paciente-wrap");
      if (wrap && !wrap.contains(e.target)) {
        listaEl.style.display = "none";
        document.removeEventListener("click", cerrar);
      }
    });
  }

  /** Muestra el chip del paciente seleccionado */
  _mostrarChip(elegidoId, btnLimpiarId, p, ini, onLimpiar) {
    const inputId = elegidoId === "paciente-elegido" ? "input-buscar-paciente" : "rep-input-buscar";
    const input = document.getElementById(inputId);
    if (input) { input.value = `${p.nombre} ${p.apellido}`; input.blur(); }

    const elegido = document.getElementById(elegidoId);
    elegido.innerHTML = `
      <div class="lpi-avatar lpi-avatar-sm">${ini}</div>
      <div class="elegido-info">
        <b>${p.nombre} ${p.apellido}</b>
        <span>Doc: ${p.documento} · ${p.diagnostico || ""}</span>
      </div>
      <button class="elegido-clear" id="${btnLimpiarId}">✕</button>
    `;
    elegido.classList.remove("oculto-elegido");

    if (onLimpiar) {
      document.getElementById(btnLimpiarId).addEventListener("click", () => {
        elegido.classList.add("oculto-elegido");
        onLimpiar();
      });
    }
  }

  /** Configura el botón confirmar del modal */
  _setConfirmar(texto, className, handler) {
    const btn = document.getElementById("btn-confirmar");
    btn.style.display = "";
    btn.textContent   = texto;
    btn.className     = className;
    btn.onclick       = handler;
  }

  abrirModal() { document.getElementById("modal-overlay").classList.remove("oculto"); }
  cerrarModal() {
    document.getElementById("modal-overlay").classList.add("oculto");
    const btnConf = document.getElementById("btn-confirmar");
    if (btnConf) { btnConf.style.display = ""; btnConf.className = "modal-btn-confirmar"; }
    const btnMant = document.getElementById("btn-mantenimiento");
    if (btnMant) btnMant.remove();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new CamasManager().init();
});
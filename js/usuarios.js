/* ============================================================
   USUARIOS.JS — Gestión de usuarios (solo ADMIN) con POO
   ============================================================ */

class UsuariosManager {

  constructor() {
    this.usuarios = [];
    this.rol      = localStorage.getItem("rol") || "";
  }

  init() {
    if (!localStorage.getItem("token")) {
      window.location.href = "../html/index.html";
      return;
    }

    if (this.rol !== "ADMIN") {
      document.getElementById("contenido-principal").innerHTML = `
        <div class="acceso-denegado">
          <i class="fa fa-lock"></i>
          <h2>Acceso restringido</h2>
          <p>No tienes permisos para ver esta sección.</p>
        </div>`;
      return;
    }

    this._renderPagina();
    this.cargarUsuarios();
  }

  _renderPagina() {
    document.getElementById("contenido-principal").innerHTML = `
      <div class="pac-cabecera">
        <h2 class="pac-titulo">Listado de usuarios</h2>
        <div class="pac-controles">
          <div class="pac-buscador">
            <i class="fa fa-search pac-buscador-icon"></i>
            <input type="text" id="input-buscar" placeholder="Buscar por nombre, usuario o rol…" />
          </div>
          <button class="btn-nuevo-pac" id="btn-nuevo-usuario">+ Nuevo usuario</button>
        </div>
      </div>
      <div class="pac-tabla-wrap">
        <table class="pac-tabla">
          <thead>
            <tr><th>#</th><th>Nombre completo</th><th>Usuario</th><th>Rol</th><th>Acciones</th></tr>
          </thead>
          <tbody id="tabla-body">
            <tr><td colspan="5" class="pac-cargando">Cargando usuarios…</td></tr>
          </tbody>
        </table>
      </div>`;

    document.getElementById("btn-nuevo-usuario").addEventListener("click", () => this.abrirModalCrear());
    document.getElementById("input-buscar").addEventListener("input", e =>
      this.renderTabla(e.target.value.toLowerCase().trim())
    );
    document.getElementById("btn-cerrar-modal").addEventListener("click",  () => this.cerrarModal());
    document.getElementById("btn-cancelar-modal").addEventListener("click", () => this.cerrarModal());
  }

  async cargarUsuarios() {
    try {
      this.usuarios = await apiFetch("/usuarios");
      this.renderTabla();
    } catch (err) {
      document.getElementById("tabla-body").innerHTML =
        `<tr><td colspan="5" style="text-align:center;color:#e05252;">Error: ${err.message}</td></tr>`;
    }
  }

  renderTabla(termino = "") {
    const tbody = document.getElementById("tabla-body");
    const lista = termino
      ? this.usuarios.filter(u =>
          `${u.nombre} ${u.usuario} ${u.rol}`.toLowerCase().includes(termino))
      : this.usuarios;

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="pac-cargando">Sin resultados</td></tr>`;
      return;
    }

    const LABEL_ROL = { ADMIN: "Administrador", ENFERMERIA: "Enfermería", MEDICO: "Médico" };

    tbody.innerHTML = lista.map((u, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${u.nombre}</td>
        <td><code>${u.usuario}</code></td>
        <td><span class="badge-rol badge-${u.rol}">${LABEL_ROL[u.rol] || u.rol}</span></td>
        <td>
          <button class="pac-btn-ver"     onclick="mgr.abrirModalEditar(${u.id})">Editar</button>
          <button class="pac-btn-eliminar"
                  onclick="mgr.confirmarEliminar(${u.id}, '${u.nombre}')">Eliminar</button>
        </td>
      </tr>`).join("");
  }

  /* ── Formulario compartido crear/editar ──────────────────── */
  _formUsuario(u = {}) {
    return `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <label style="font-size:.85rem;font-weight:600;">Nombre completo
          <input id="f-nombre" type="text" value="${u.nombre || ""}" placeholder="Ej: María López"
            style="margin-top:4px;width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:.9rem;"/>
        </label>
        <label style="font-size:.85rem;font-weight:600;">Usuario (login)
          <input id="f-usuario" type="text" value="${u.usuario || ""}" placeholder="Ej: mlopez"
            style="margin-top:4px;width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:.9rem;"/>
        </label>
        <label style="font-size:.85rem;font-weight:600;">Contraseña ${u.id ? "(dejar vacío = no cambiar)" : ""}
          <input id="f-clave" type="password" placeholder="••••••••"
            style="margin-top:4px;width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:.9rem;"/>
        </label>
        <label style="font-size:.85rem;font-weight:600;">Rol
          <select id="f-rol"
            style="margin-top:4px;width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:.9rem;">
            <option value="ADMIN"      ${u.rol === "ADMIN"      ? "selected" : ""}>Administrador</option>
            <option value="ENFERMERIA" ${u.rol === "ENFERMERIA" ? "selected" : ""}>Enfermería</option>
            <option value="MEDICO"     ${u.rol === "MEDICO"     ? "selected" : ""}>Médico</option>
          </select>
        </label>
      </div>`;
  }

  _leerForm(esEdicion = false) {
    const nombre  = document.getElementById("f-nombre")?.value.trim();
    const usuario = document.getElementById("f-usuario")?.value.trim();
    const clave   = document.getElementById("f-clave")?.value.trim();
    const rol     = document.getElementById("f-rol")?.value;

    // En edición la clave es opcional; en creación es obligatoria
    if (!nombre || !usuario || !rol || (!esEdicion && !clave)) {
      alert("Completa todos los campos obligatorios.");
      return null;
    }
    return { nombre, usuario, clave: clave || "", rol };
  }

  /* ── Modales ─────────────────────────────────────────────── */
  abrirModalCrear() {
    document.getElementById("modal-titulo").textContent = "Nuevo usuario";
    document.getElementById("modal-cuerpo").innerHTML   = this._formUsuario();
    document.getElementById("btn-confirmar").onclick = async () => {
      const datos = this._leerForm(false);
      if (!datos) return;
      try {
        await apiFetch("/usuarios", "POST", datos);
        this.cerrarModal(); await this.cargarUsuarios();
      } catch (err) { alert("Error: " + err.message); }
    };
    this._abrirModal();
  }

  abrirModalEditar(id) {
    const u = this.usuarios.find(x => x.id === id);
    if (!u) return;
    document.getElementById("modal-titulo").textContent = "Editar usuario";
    document.getElementById("modal-cuerpo").innerHTML   = this._formUsuario(u);
    document.getElementById("btn-confirmar").onclick = async () => {
      const datos = this._leerForm(true);
      if (!datos) return;
      try {
        await apiFetch(`/usuarios/${id}`, "PUT", datos);
        this.cerrarModal(); await this.cargarUsuarios();
      } catch (err) { alert("Error: " + err.message); }
    };
    this._abrirModal();
  }

  confirmarEliminar(id, nombre) {
    document.getElementById("modal-titulo").textContent = "Eliminar usuario";
    document.getElementById("modal-cuerpo").innerHTML =
      `<p style="margin:0 0 8px;">¿Estás seguro de eliminar a <strong>${nombre}</strong>?</p>
       <p style="color:#e05252;font-size:.9rem;">Esta acción no se puede deshacer.</p>`;
    const btn = document.getElementById("btn-confirmar");
    btn.style.background = "#e05252";
    btn.textContent      = "Eliminar";
    btn.onclick = async () => {
      try {
        await apiFetch(`/usuarios/${id}`, "DELETE");
        this.cerrarModal(); await this.cargarUsuarios();
      } catch (err) { alert("Error: " + err.message); }
    };
    this._abrirModal();
  }

  _abrirModal() { document.getElementById("modal-overlay").classList.remove("oculto"); }
  cerrarModal() {
    document.getElementById("modal-overlay").classList.add("oculto");
    const btn = document.getElementById("btn-confirmar");
    if (btn) { btn.style.background = ""; btn.textContent = "Confirmar"; }
  }
}

const mgr = new UsuariosManager();
document.addEventListener("DOMContentLoaded", () => mgr.init());
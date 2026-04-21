/* ============================================================
   DASHBOARD.JS — Panel principal con POO
   ============================================================ */

class Dashboard {

  constructor() {
    this.CIRCUNFERENCIA = 2 * Math.PI * 38;
    this.ARCO_UCI       = 157;
    this.INTERVALO_MS   = 30_000;

    this.ZONAS_IDS = {
      GENERAL:     "zona-general",
      UCI:         "zona-uci",
      AISLAMIENTO: "zona-aislamiento",
      QUIROFANO:   "zona-quirofano"
    };

    this.ESTADO_CLASES = {
      DISPONIBLE:    "disponible",
      OCUPADO:       "ocupada",
      MANTENIMIENTO: "mantenimiento"
    };
  }

  async init() {
    if (!localStorage.getItem("token")) {
      window.location.href = "../html/index.html";
      return;
    }
    await this.cargarDashboard();
    setInterval(() => this.cargarDashboard(), this.INTERVALO_MS);
  }

  async cargarDashboard() {
    try {
      const [camas, movimientos] = await Promise.all([
        apiFetch("/camas"),
        apiFetch("/movimientos")
      ]);
      this.renderDonut(camas);
      this.renderUCI(camas);
      this.renderMapaCamas(camas);
      this.renderMovimientos(movimientos);
      this.renderPacientesHoy(movimientos);
    } catch (err) {
      console.error("Error cargando dashboard:", err.message);
    }
  }

  renderDonut(camas) {
    const total         = camas.length;
    const ocupadas      = camas.filter(c => c.estado === "OCUPADO").length;
    const disponibles   = camas.filter(c => c.estado === "DISPONIBLE").length;
    const mantenimiento = camas.filter(c => c.estado === "MANTENIMIENTO").length;

    document.getElementById("donut-total").textContent          = total;
    document.getElementById("pct-ocupadas").textContent         = this._pct(ocupadas, total);
    document.getElementById("pct-disponibles").textContent      = this._pct(disponibles, total);
    document.getElementById("pct-mantenimiento").textContent    = this._pct(mantenimiento, total);
    document.getElementById("num-ocupadas").textContent         = ocupadas;
    document.getElementById("num-disponibles").textContent      = disponibles;
    document.getElementById("num-mantenimiento").textContent    = mantenimiento;

    let offset = 0;
    offset = this._setArco("donut-ocupadas",      ocupadas,      total, offset);
    offset = this._setArco("donut-disponibles",   disponibles,   total, offset);
             this._setArco("donut-mantenimiento", mantenimiento, total, offset);
  }

  renderUCI(camas) {
    const uciCamas = camas.filter(c => c.zona === "UCI");
    const total    = uciCamas.length;
    const ocupadas = uciCamas.filter(c => c.estado === "OCUPADO").length;

    document.getElementById("uci-num").innerHTML =
      `${ocupadas} <small id="uci-total">/ ${total}</small>`;

    const arco = total > 0 ? (ocupadas / total) * this.ARCO_UCI : 0;
    document.getElementById("medidor-arco")
      .setAttribute("stroke-dasharray", `${arco} ${this.ARCO_UCI}`);

    const alerta = document.getElementById("uci-alerta");
    if (total > 0 && ocupadas / total >= 0.8) {
      alerta.style.display = "block";
      alerta.textContent   = "⚠ Alta ocupación";
    } else {
      alerta.style.display = "none";
    }
  }

  renderMapaCamas(camas) {
    Object.values(this.ZONAS_IDS).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });

    camas.forEach(cama => {
      const contenedorId = this.ZONAS_IDS[cama.zona];
      if (!contenedorId) return;
      const contenedor = document.getElementById(contenedorId);
      if (!contenedor) return;

      const div = document.createElement("div");
      div.className = `cama ${this.ESTADO_CLASES[cama.estado] || "disponible"}`;
      div.innerHTML = `<span>${cama.codigo}<br>${cama.estado}</span>`;
      contenedor.appendChild(div);
    });
  }

  renderMovimientos(movimientos) {
    const tbody = document.getElementById("tbody-movimientos");
    if (!tbody) return;

    tbody.innerHTML = "";
    const recientes = movimientos.slice(0, 10);

    if (recientes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;color:#aaa;padding:16px;">
            Sin movimientos registrados
          </td>
        </tr>`;
      return;
    }

    recientes.forEach(mov => {
      const tipoClase = mov.tipo === "INGRESO" ? "ingreso" : "alta";
      const tipoLabel = mov.tipo === "INGRESO" ? "Ingreso"  : "Alta";
      const hora      = mov.fecha
        ? formatFecha(mov.fecha, { hour: "2-digit", minute: "2-digit" })
        : "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${mov.paciente}</td>
        <td><span class="cam-id">${mov.cama}</span></td>
        <td><span class="tag ${tipoClase}">${tipoLabel}</span></td>
        <td>${hora}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderPacientesHoy(movimientos) {
    const hoy = new Date().toISOString().slice(0, 10);

    const cuenta = (tipo) => movimientos.filter(m =>
      m.tipo === tipo && (m.fecha ? m.fecha.startsWith(hoy) : true)
    ).length;

    const elIngresos = document.getElementById("num-ingresos");
    const elAltas    = document.getElementById("num-altas");
    if (elIngresos) elIngresos.textContent = cuenta("INGRESO");
    if (elAltas)    elAltas.textContent    = cuenta("ALTA");
  }

  _pct(valor, total) {
    return total === 0 ? "0%" : Math.round((valor / total) * 100) + "%";
  }

  _setArco(id, valor, total, offset) {
    const arco   = (valor / total) * this.CIRCUNFERENCIA;
    const circle = document.getElementById(id);
    circle.setAttribute("stroke-dasharray",  `${arco} ${this.CIRCUNFERENCIA - arco}`);
    circle.setAttribute("stroke-dashoffset", -offset);
    return offset + arco;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Dashboard().init();
});
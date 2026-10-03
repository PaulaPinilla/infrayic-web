/*
  Logica del Panel Inteligente: escucha los reportes en Firestore en
  tiempo real (cualquier reporte nuevo aparece sin recargar la
  pagina), calcula estadisticas, dibuja los graficos con Chart.js,
  llena la tabla de la cola de priorizacion con estado y
  comentarios, y calcula la prediccion simple de zonas en riesgo.

  La conexion a Firestore (iniciarEscuchaReportes) solo arranca
  despues de que el ingeniero entra con el PIN correcto en
  panel.html — asi no se cargan datos antes de pasar el login.
*/

const ETIQUETAS_TIPO = {
  hueco: "Hueco en la vía",
  anden: "Andén dañado",
  senalizacion: "Señalización",
  otro: "Otro",
};

const ETIQUETAS_PRIORIDAD = {
  alto: "Alta",
  medio: "Media",
  bajo: "Baja",
};

let graficoTipoChart = null;
let graficoPrioridadChart = null;
let reportesActuales = [];

function iniciarEscuchaReportes() {
  db.collection("reportes").onSnapshot((snapshot) => {
    const reportes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderTodo(reportes);
  });
}

function renderTodo(reportes) {
  reportesActuales = reportes;
  renderEstadisticas(reportes);
  renderGraficos(reportes);
  renderTabla(reportes);
  renderZonasRiesgo(reportes);
}

function renderEstadisticas(reportes) {
  const total = reportes.length;
  const altos = reportes.filter((r) => r.prioridad === "alto").length;
  const medios = reportes.filter((r) => r.prioridad === "medio").length;
  const bajos = reportes.filter((r) => r.prioridad === "bajo").length;

  const statsGrid = document.getElementById("statsGrid");
  statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="stat-numero">${total}</div>
      <div class="stat-etiqueta">Reportes totales</div>
    </div>
    <div class="stat-card stat-alto">
      <div class="stat-numero">${altos}</div>
      <div class="stat-etiqueta">Prioridad alta</div>
    </div>
    <div class="stat-card stat-medio">
      <div class="stat-numero">${medios}</div>
      <div class="stat-etiqueta">Prioridad media</div>
    </div>
    <div class="stat-card stat-bajo">
      <div class="stat-numero">${bajos}</div>
      <div class="stat-etiqueta">Prioridad baja</div>
    </div>
  `;
}

function renderGraficos(reportes) {
  const conteoPorTipo = {};
  reportes.forEach((r) => {
    conteoPorTipo[r.tipo] = (conteoPorTipo[r.tipo] || 0) + 1;
  });
  const etiquetasTipo = Object.keys(conteoPorTipo).map((t) => ETIQUETAS_TIPO[t] || t);
  const valoresTipo = Object.values(conteoPorTipo);

  const conteoPorPrioridad = { alto: 0, medio: 0, bajo: 0 };
  reportes.forEach((r) => {
    if (conteoPorPrioridad[r.prioridad] !== undefined) conteoPorPrioridad[r.prioridad]++;
  });

  const ctxTipo = document.getElementById("graficoTipo");
  const ctxPrioridad = document.getElementById("graficoPrioridad");

  if (graficoTipoChart) graficoTipoChart.destroy();
  if (graficoPrioridadChart) graficoPrioridadChart.destroy();

  graficoTipoChart = new Chart(ctxTipo, {
    type: "bar",
    data: {
      labels: etiquetasTipo,
      datasets: [{
        label: "Reportes",
        data: valoresTipo,
        backgroundColor: "#145374",
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  graficoPrioridadChart = new Chart(ctxPrioridad, {
    type: "doughnut",
    data: {
      labels: ["Alta", "Media", "Baja"],
      datasets: [{
        data: [conteoPorPrioridad.alto, conteoPorPrioridad.medio, conteoPorPrioridad.bajo],
        backgroundColor: ["#B3261E", "#B8860B", "#1E8E5A"],
      }],
    },
  });
}

function renderTabla(reportes) {
  const ordenados = [...reportes].sort((a, b) => b.puntaje - a.puntaje);
  const cuerpo = document.getElementById("cuerpoTablaReportes");

  if (ordenados.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="8">Aún no hay reportes guardados. Ve a "Reporta un daño" y envía el primero.</td></tr>';
    return;
  }

  cuerpo.innerHTML = ordenados.map((r) => {
    const numComentarios = (r.comentarios || []).length;
    return `
    <tr>
      <td>${r.zona}</td>
      <td>${ETIQUETAS_TIPO[r.tipo] || r.tipo}</td>
      <td><span class="badge badge-${r.severidad}">${r.severidad}</span></td>
      <td><span class="badge badge-${r.prioridad}">${ETIQUETAS_PRIORIDAD[r.prioridad]}</span></td>
      <td>${r.puntaje}</td>
      <td>${r.fecha ? new Date(r.fecha).toLocaleDateString("es-CO") : ""}</td>
      <td>
        <select class="selector-estado" data-id="${r.id}">
          <option value="Pendiente" ${r.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="En proceso" ${r.estado === "En proceso" ? "selected" : ""}>En proceso</option>
          <option value="Resuelto" ${r.estado === "Resuelto" ? "selected" : ""}>Resuelto</option>
        </select>
      </td>
      <td>
        <button class="boton-secundario boton-comentar" data-id="${r.id}">💬 ${numComentarios}</button>
      </td>
    </tr>
  `;
  }).join("");

  document.querySelectorAll(".selector-estado").forEach((select) => {
    select.addEventListener("change", async (e) => {
      await actualizarEstado(e.target.dataset.id, e.target.value);
    });
  });

  document.querySelectorAll(".boton-comentar").forEach((boton) => {
    boton.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      const reporte = reportesActuales.find((r) => r.id === id);
      const comentariosTexto = (reporte.comentarios || [])
        .map((c) => "- " + new Date(c.fecha).toLocaleDateString("es-CO") + ": " + c.texto)
        .join("\n");
      const nuevo = prompt(
        (comentariosTexto ? "Comentarios anteriores:\n" + comentariosTexto + "\n\n" : "") +
        "Escribe un nuevo comentario de seguimiento:"
      );
      if (nuevo && nuevo.trim()) {
        await agregarComentario(id, nuevo.trim());
      }
    });
  });
}

function renderZonasRiesgo(reportes) {
  const contenedor = document.getElementById("zonasRiesgo");

  if (reportes.length === 0) {
    contenedor.innerHTML = '<p class="nota">Aún no hay suficientes reportes para calcular zonas en riesgo.</p>';
    return;
  }

  const porZona = {};
  reportes.forEach((r) => {
    if (!porZona[r.zona]) porZona[r.zona] = { cantidad: 0, puntajeAcumulado: 0 };
    porZona[r.zona].cantidad++;
    porZona[r.zona].puntajeAcumulado += r.puntaje;
  });

  const zonas = Object.entries(porZona)
    .map(([zona, datos]) => ({ zona, ...datos }))
    .sort((a, b) => b.puntajeAcumulado - a.puntajeAcumulado)
    .slice(0, 5);

  const maxPuntaje = zonas[0].puntajeAcumulado;

  contenedor.innerHTML = zonas.map((z) => {
    let nivel, etiqueta;
    const proporcion = z.puntajeAcumulado / maxPuntaje;
    if (proporcion > 0.66) { nivel = "alto"; etiqueta = "Riesgo alto"; }
    else if (proporcion > 0.33) { nivel = "medio"; etiqueta = "Riesgo medio"; }
    else { nivel = "bajo"; etiqueta = "Riesgo bajo"; }

    return `
      <div class="zona-riesgo">
        <div>
          <div class="nombre">${z.zona}</div>
          <div class="nota">${z.cantidad} reporte(s) acumulado(s) &middot; puntaje total ${z.puntajeAcumulado}</div>
        </div>
        <span class="badge badge-${nivel}">${etiqueta}</span>
      </div>
    `;
  }).join("");
}

document.getElementById("botonLimpiar").addEventListener("click", async () => {
  if (!confirm("¿Seguro que quieres borrar TODOS los reportes de la base de datos? Esta acción no se puede deshacer.")) return;
  const reportes = await obtenerReportes();
  for (const r of reportes) {
    await db.collection("reportes").doc(r.id).delete();
  }
});
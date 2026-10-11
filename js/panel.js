/*
  Logica del Panel Inteligente: escucha los reportes en Firestore en
  tiempo real (cualquier reporte nuevo aparece sin recargar la
  pagina), calcula estadisticas, dibuja los graficos con Chart.js,
  llena la tabla de la cola de priorizacion con foto, autenticidad,
  revision del ingeniero, estado y comentarios, y calcula la
  prediccion simple de zonas en riesgo.

  La conexion a Firestore (iniciarEscuchaReportes) solo arranca
  despues de que el ingeniero entra con el PIN correcto en
  panel.html — asi no se cargan datos antes de pasar el login.

  Los reportes que el ingeniero marca como "Falso" se muestran en la
  tabla (en gris) pero NO cuentan en estadisticas, graficos ni zonas
  de riesgo. Cada decision "Valido" / "Falso" queda guardada: con el
  tiempo forma un conjunto de datos etiquetado por Ingenieria Civil
  para entrenar un modelo propio.
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

const ETIQUETAS_AUTENTICIDAD = {
  verificada: { texto: "Verificada", clase: "bajo" },
  revisar: { texto: "Revisar", clase: "medio" },
  sospechosa: { texto: "Sospechosa", clase: "alto" },
};

const CLASE_REVISION = { "Pendiente": "pendiente", "Válido": "resuelto", "Falso": "alto" };

let graficoTipoChart = null;
let graficoPrioridadChart = null;
let reportesActuales = [];

/* Evita que texto escrito por un ciudadano se ejecute como codigo en el panel */
function esc(texto) {
  return String(texto === undefined || texto === null ? "" : texto)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fotoSegura(r) {
  return typeof r.foto === "string" && r.foto.startsWith("data:image/") ? r.foto : "";
}

function revisionDe(r) {
  return r.revisionIngeniero || "Pendiente";
}

function iniciarEscuchaReportes() {
  db.collection("reportes").onSnapshot((snapshot) => {
    const reportes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderTodo(reportes);
  });
}

function renderTodo(reportes) {
  reportesActuales = reportes;
  const validos = reportes.filter((r) => revisionDe(r) !== "Falso");
  renderEstadisticas(validos, reportes);
  renderGraficos(validos);
  renderTabla(reportes);
  renderZonasRiesgo(validos);
}

function renderEstadisticas(reportes, todos) {
  const total = reportes.length;
  const altos = reportes.filter((r) => r.prioridad === "alto").length;
  const medios = reportes.filter((r) => r.prioridad === "medio").length;
  const bajos = reportes.filter((r) => r.prioridad === "bajo").length;
  const porRevisar = todos.filter((r) => revisionDe(r) === "Pendiente").length;

  const statsGrid = document.getElementById("statsGrid");
  statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="stat-numero">${total}</div>
      <div class="stat-etiqueta">Reportes totales (sin falsos)</div>
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
    <div class="stat-card">
      <div class="stat-numero">${porRevisar}</div>
      <div class="stat-etiqueta">Fotos por revisar</div>
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
    cuerpo.innerHTML = '<tr><td colspan="11">Aún no hay reportes guardados. Ve a "Reporta un daño" y envía el primero.</td></tr>';
    return;
  }

  cuerpo.innerHTML = ordenados.map((r) => {
    const numComentarios = (r.comentarios || []).length;
    const foto = fotoSegura(r);
    const revision = revisionDe(r);
    const aut = r.verificacion && ETIQUETAS_AUTENTICIDAD[r.verificacion.nivel];
    const miniatura = foto
      ? `<img class="miniatura-reporte" src="${foto}" alt="Foto del reporte" data-accion="detalle" data-id="${esc(r.id)}">`
      : '<span class="nota">Sin foto</span>';
    const estiloFila = revision === "Falso" ? ' class="fila-falsa"' : "";
    return `
    <tr${estiloFila}>
      <td>${miniatura}</td>
      <td>${esc(r.zona)}</td>
      <td>${esc(ETIQUETAS_TIPO[r.tipo] || r.tipo)}</td>
      <td><span class="badge badge-${esc(r.severidad)}">${esc(r.severidad)}</span></td>
      <td><span class="badge badge-${esc(r.prioridad)}">${esc(ETIQUETAS_PRIORIDAD[r.prioridad])}</span></td>
      <td>${esc(r.puntaje)}</td>
      <td>${r.fecha ? new Date(r.fecha).toLocaleDateString("es-CO") : ""}</td>
      <td>${aut ? `<span class="badge badge-${aut.clase}">${aut.texto}</span><div class="nota">${esc(r.verificacion.puntaje)}/100</div>` : '<span class="nota">—</span>'}</td>
      <td>
        <span class="badge badge-${CLASE_REVISION[revision] || "pendiente"}">${esc(revision)}</span>
        <div class="botones-revision">
          <button class="boton-secundario" data-accion="revision" data-id="${esc(r.id)}" data-valor="Válido" title="Marcar como válido">Válido</button>
          <button class="boton-secundario" data-accion="revision" data-id="${esc(r.id)}" data-valor="Falso" title="Marcar como falso">Falso</button>
        </div>
      </td>
      <td>
        <select class="selector-estado" data-id="${esc(r.id)}">
          <option value="Pendiente" ${r.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="En proceso" ${r.estado === "En proceso" ? "selected" : ""}>En proceso</option>
          <option value="Resuelto" ${r.estado === "Resuelto" ? "selected" : ""}>Resuelto</option>
        </select>
      </td>
      <td>
        <button class="boton-secundario" data-accion="comentar" data-id="${esc(r.id)}">Comentarios (${numComentarios})</button>
      </td>
    </tr>
  `;
  }).join("");
}

/* Un solo "oyente" para todos los botones de la tabla */
document.getElementById("cuerpoTablaReportes").addEventListener("click", async (e) => {
  const el = e.target.closest("[data-accion]");
  if (!el) return;
  const id = el.dataset.id;
  if (el.dataset.accion === "detalle") abrirDetalle(id);
  if (el.dataset.accion === "revision") await actualizarRevision(id, el.dataset.valor);
  if (el.dataset.accion === "comentar") await comentarReporte(id);
});

document.getElementById("cuerpoTablaReportes").addEventListener("change", async (e) => {
  if (e.target.classList.contains("selector-estado")) {
    await actualizarEstado(e.target.dataset.id, e.target.value);
  }
});

async function comentarReporte(id) {
  const reporte = reportesActuales.find((r) => r.id === id);
  if (!reporte) return;
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
}

/* Decision del ingeniero civil: queda guardada como dato etiquetado */
async function actualizarRevision(id, valor) {
  await db.collection("reportes").doc(id).update({
    revisionIngeniero: valor,
    fechaRevision: new Date().toISOString(),
  });
  cerrarDetalle();
}

/* Ventana con la foto grande, ubicacion y detalle de la verificacion */
function abrirDetalle(id) {
  const r = reportesActuales.find((x) => x.id === id);
  if (!r) return;
  const foto = fotoSegura(r);
  const v = r.verificacion;
  const aut = v && ETIQUETAS_AUTENTICIDAD[v.nivel];
  const mapa = r.gps && typeof r.gps.lat === "number" && typeof r.gps.lon === "number"
    ? `<p><a href="https://www.google.com/maps?q=${r.gps.lat},${r.gps.lon}" target="_blank" rel="noopener">Ver ubicación en el mapa</a></p>`
    : '<p class="nota">Sin coordenadas GPS en este reporte.</p>';
  const senales = v && Array.isArray(v.senales)
    ? '<ul class="desglose">' + v.senales.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>"
    : "";

  document.getElementById("modalCuerpo").innerHTML = `
    ${foto ? `<img class="foto-grande" src="${foto}" alt="Foto del tramo dañado">` : '<p class="nota">Este reporte no tiene foto.</p>'}
    <h3>${esc(ETIQUETAS_TIPO[r.tipo] || r.tipo)} — ${esc(r.zona)}</h3>
    <p>Severidad: <span class="badge badge-${esc(r.severidad)}">${esc(r.severidad)}</span>
       Prioridad: <span class="badge badge-${esc(r.prioridad)}">${esc(ETIQUETAS_PRIORIDAD[r.prioridad])}</span>
       (${esc(r.puntaje)} pts)</p>
    ${aut ? `<p>Autenticidad: <span class="badge badge-${aut.clase}">${aut.texto}</span> <strong>${esc(v.puntaje)}/100</strong></p>` : ""}
    ${senales}
    ${mapa}
    <div class="botones-revision">
      <button class="boton" data-accion="revision" data-id="${esc(r.id)}" data-valor="Válido">Marcar como válido</button>
      <button class="boton-secundario" data-accion="revision" data-id="${esc(r.id)}" data-valor="Falso">Marcar como falso</button>
    </div>
  `;
  document.getElementById("modalDetalle").style.display = "flex";
}

function cerrarDetalle() {
  document.getElementById("modalDetalle").style.display = "none";
}

document.getElementById("modalCerrar").addEventListener("click", cerrarDetalle);
document.getElementById("modalDetalle").addEventListener("click", async (e) => {
  if (e.target.id === "modalDetalle") cerrarDetalle();
  const el = e.target.closest("[data-accion='revision']");
  if (el) await actualizarRevision(el.dataset.id, el.dataset.valor);
});

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
          <div class="nombre">${esc(z.zona)}</div>
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
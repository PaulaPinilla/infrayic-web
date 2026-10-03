const zonaCarga = document.getElementById("zonaCarga");
const entradaArchivo = document.getElementById("entradaArchivo");
const previa = document.getElementById("previa");
const botonAnalizar = document.getElementById("botonAnalizar");
const resultado = document.getElementById("resultado");
const resultadoTitulo = document.getElementById("resultadoTitulo");
const resultadoDescripcion = document.getElementById("resultadoDescripcion");
const resultadoDensidad = document.getElementById("resultadoDensidad");
const botonPriorizar = document.getElementById("botonPriorizar");
const cargandoIA = document.getElementById("cargandoIA");
const resultadoPrioridad = document.getElementById("resultadoPrioridad");
const badgeSobreFoto = document.getElementById("badgeSobreFoto");

zonaCarga.addEventListener("click", () => entradaArchivo.click());

entradaArchivo.addEventListener("change", () => {
  const archivo = entradaArchivo.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = (e) => {
    previa.src = e.target.result;
    previa.style.display = "block";
    previa.className = "";
    badgeSobreFoto.style.display = "none";
    botonAnalizar.disabled = false;
    resultado.style.display = "none";
    document.getElementById("panelPrioridad").style.display = "none";
  };
  lector.readAsDataURL(archivo);
});

let analisisActual = null;

botonAnalizar.addEventListener("click", () => {
  botonAnalizar.disabled = true;
  botonAnalizar.textContent = "Analizando...";

  setTimeout(() => {
    analisisActual = analizarImagen(previa);

    resultadoTitulo.innerHTML =
      '<span class="badge badge-' + analisisActual.nivel + '">' + analisisActual.etiqueta + "</span>";
    resultadoDescripcion.textContent = analisisActual.recomendacion;
    resultadoDensidad.textContent = analisisActual.densidad;

    previa.className = "borde-" + analisisActual.nivel;
    badgeSobreFoto.className = "badge badge-sobre-foto badge-" + analisisActual.nivel;
    badgeSobreFoto.textContent = analisisActual.etiqueta;
    badgeSobreFoto.style.display = "inline-block";

    resultado.style.display = "block";
    document.getElementById("panelPrioridad").style.display = "block";
    resultadoPrioridad.style.display = "none";
    cargandoIA.style.display = "none";
    botonAnalizar.disabled = false;
    botonAnalizar.textContent = "Analizar foto con IA";
    botonPriorizar.textContent = "Analizar con IA y guardar reporte";
    botonPriorizar.disabled = false;
  }, 400);
});

botonPriorizar.addEventListener("click", () => {
  if (!analisisActual) return;

  botonPriorizar.disabled = true;
  resultadoPrioridad.style.display = "none";
  cargandoIA.style.display = "block";

  setTimeout(() => {
    const datos = {
      nivelSeveridad: analisisActual.nivel,
      tipo: document.getElementById("campoTipo").value,
      zona: document.getElementById("campoZona").value || "Sin especificar",
      cercaColegioHospital: document.getElementById("campoColegioHospital").checked,
      diasSinSolucion: Number(document.getElementById("campoDias").value) || 0,
    };

    const prioridad = calcularPrioridad(datos);

    document.getElementById("prioridadTitulo").innerHTML =
      '<span class="badge badge-' + prioridad.nivel + '">' + prioridad.etiqueta + "</span>";
    document.getElementById("prioridadDescripcion").textContent =
      "Puntaje de prioridad calculado por la IA: " + prioridad.puntaje + " puntos";
    document.getElementById("prioridadDesglose").innerHTML =
      prioridad.desglose.map((linea) => "<li>" + linea + "</li>").join("");

    guardarReporte({
      tipo: datos.tipo,
      zona: datos.zona,
      severidad: analisisActual.nivel,
      prioridad: prioridad.nivel,
      puntaje: prioridad.puntaje,
      fecha: new Date().toISOString(),
    });

    cargandoIA.style.display = "none";
    resultadoPrioridad.style.display = "block";
    botonPriorizar.disabled = false;
    botonPriorizar.textContent = "Reporte guardado ✓ (puedes analizar otro)";
  }, 900);
});
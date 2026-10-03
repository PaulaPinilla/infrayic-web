/*
  Modulo "priorizador": el segundo cerebro de BogoVial.

  Toma el nivel de severidad (ya calculado por analizarImagen en
  analizador.js) y los datos del lugar, y calcula un puntaje de
  prioridad para decidir que reporte debe atenderse primero.

  El sistema ya NO le pide a la persona que calcule nada: ella solo
  cuenta hechos del lugar (tipo de dano, ubicacion, si hay un
  colegio/hospital cerca, dias sin solucion). El propio algoritmo:
    - cuenta cuantos reportes previos hay en esa misma zona
      (contarReportesSimilares), y
    - estima cuantas personas se ven afectadas segun el tipo de dano
      (inferirPersonasAfectadas).

  Los reportes se guardan en Firebase Firestore (base de datos real
  en la nube), visible para todo el equipo.
*/

function inferirPersonasAfectadas(tipo) {
  const mapa = {
    anden: "muchas",
    hueco: "moderadas",
    senalizacion: "pocas",
    otro: "moderadas",
  };
  return mapa[tipo] || "moderadas";
}

async function contarReportesSimilares(zona) {
  const zonaNormalizada = (zona || "").trim().toLowerCase();
  if (!zonaNormalizada) return 0;
  const reportes = await obtenerReportes();
  return reportes.filter(
    (r) => (r.zona || "").trim().toLowerCase() === zonaNormalizada
  ).length;
}

async function calcularPrioridad(datos) {
  const personasAfectadas = inferirPersonasAfectadas(datos.tipo);
  const reportesSimilares = await contarReportesSimilares(datos.zona);

  const puntosSeveridad = { bajo: 10, medio: 20, alto: 30 }[datos.nivelSeveridad] || 0;
  const puntosColegioHospital = datos.cercaColegioHospital ? 25 : 0;
  const puntosReportes = Math.min(reportesSimilares, 10) * 4;
  const puntosDias = Math.min(datos.diasSinSolucion, 90) * 0.3;
  const puntosPersonas = { pocas: 0, moderadas: 10, muchas: 20 }[personasAfectadas] || 0;

  const puntaje = Math.round(
    puntosSeveridad + puntosColegioHospital + puntosReportes + puntosDias + puntosPersonas
  );

  let nivel, etiqueta;
  if (puntaje < 40) {
    nivel = "bajo";
    etiqueta = "Prioridad baja";
  } else if (puntaje < 80) {
    nivel = "medio";
    etiqueta = "Prioridad media";
  } else {
    nivel = "alto";
    etiqueta = "Prioridad alta";
  }

  const ETIQUETAS_PERSONAS = { pocas: "pocas", moderadas: "moderadas", muchas: "muchas" };

  const desglose = [
    "Severidad del daño (detectada en la foto): " + puntosSeveridad + " pts",
    "Cercanía a colegio/hospital: " + puntosColegioHospital + " pts",
    "Reportes previos detectados en esta zona (" + reportesSimilares + "): " + puntosReportes + " pts",
    "Días sin solución: " + puntosDias.toFixed(1) + " pts",
    "Personas afectadas estimadas por el tipo de daño (" + ETIQUETAS_PERSONAS[personasAfectadas] + "): " + puntosPersonas + " pts",
  ];

  return {
    puntaje, nivel, etiqueta, desglose, reportesSimilares, personasAfectadas,
    puntosSeveridad, puntosColegioHospital, puntosReportes, puntosDias, puntosPersonas,
  };
}

/* Traduce el resultado numérico a un párrafo en lenguaje sencillo,
   para que un ciudadano sin conocimientos técnicos entienda por qué
   su reporte quedó en ese nivel de prioridad. */
function explicarPrioridad(prioridad, datos) {
  const frasesNivel = {
    bajo: "una prioridad baja",
    medio: "una prioridad media",
    alto: "una prioridad alta",
  };

  let texto = "La foto mostró un daño de severidad \"" + datos.nivelSeveridad + "\", ";
  texto += "pero la prioridad final no depende solo de la foto: el sistema también revisa ";
  texto += "qué tan cerca está de un colegio u hospital, cuántos reportes parecidos ya hay en esa zona, ";
  texto += "cuántos días lleva sin solución, y a cuántas personas afecta ese tipo de daño. ";
  texto += "Sumando todo eso, este reporte quedó en " + frasesNivel[prioridad.nivel] + " ";
  texto += "(" + prioridad.puntaje + " de 105 puntos posibles).";

  if (prioridad.nivel !== "alto") {
    const faltan = [];
    if (!datos.cercaColegioHospital) faltan.push("estar cerca de un colegio u hospital");
    if (prioridad.reportesSimilares < 3) faltan.push("tener varios reportes repetidos en la misma zona");
    if (datos.diasSinSolucion < 60) faltan.push("llevar más tiempo sin solución");
    if (faltan.length > 0) {
      texto += " Para llegar a prioridad alta normalmente hace falta, además de un daño severo, " +
        "algo como " + faltan.join(" o ") + ".";
    }
  }

  return texto;
}

/* Base de datos real en la nube (Firebase Firestore). Cada reporte
   queda guardado en la colección "reportes", visible para todo el
   equipo desde cualquier computador, con estado y comentarios de
   seguimiento. */

async function guardarReporte(reporte) {
  await db.collection("reportes").add({
    ...reporte,
    estado: "Pendiente",
    comentarios: [],
  });
}

async function obtenerReportes() {
  try {
    const snapshot = await db.collection("reportes").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error("Error leyendo reportes de Firestore:", e);
    return [];
  }
}

async function actualizarEstado(idReporte, nuevoEstado) {
  await db.collection("reportes").doc(idReporte).update({ estado: nuevoEstado });
}

async function agregarComentario(idReporte, texto) {
  const referencia = db.collection("reportes").doc(idReporte);
  const snap = await referencia.get();
  const comentariosActuales = (snap.data() && snap.data().comentarios) || [];
  comentariosActuales.push({
    texto,
    fecha: new Date().toISOString(),
  });
  await referencia.update({ comentarios: comentariosActuales });
}
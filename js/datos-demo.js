/*
  Datos históricos de ejemplo para el sector piloto (Calle 48 con
  Carrera 16, Chapinero). Sirven para que el Panel Inteligente tenga
  información con la que mostrar estadísticas y predicciones, incluso
  antes de recibir reportes reales desde "Reporta un daño".

  En producción estos datos vendrían de la base de datos real de
  BogoVial, acumulados reporte a reporte.
*/

const REPORTES_DEMO = [
  { tipo: "hueco", zona: "Calle 48 # 16-20", severidad: "alto", prioridad: "alto", puntaje: 91, fecha: "2026-08-02T09:00:00.000Z" },
  { tipo: "hueco", zona: "Calle 48 # 16-20", severidad: "alto", prioridad: "alto", puntaje: 87, fecha: "2026-08-10T09:00:00.000Z" },
  { tipo: "anden", zona: "Carrera 16 # 47-30", severidad: "medio", prioridad: "medio", puntaje: 58, fecha: "2026-08-05T09:00:00.000Z" },
  { tipo: "senalizacion", zona: "Calle 48 con Carrera 16", severidad: "bajo", prioridad: "bajo", puntaje: 22, fecha: "2026-08-01T09:00:00.000Z" },
  { tipo: "hueco", zona: "Carrera 16 # 46-10", severidad: "medio", prioridad: "medio", puntaje: 62, fecha: "2026-08-12T09:00:00.000Z" },
  { tipo: "anden", zona: "Calle 48 # 16-20", severidad: "alto", prioridad: "alto", puntaje: 95, fecha: "2026-08-15T09:00:00.000Z" },
  { tipo: "hueco", zona: "Carrera 16 # 47-30", severidad: "medio", prioridad: "medio", puntaje: 55, fecha: "2026-08-18T09:00:00.000Z" },
  { tipo: "senalizacion", zona: "Carrera 16 # 46-10", severidad: "bajo", prioridad: "bajo", puntaje: 18, fecha: "2026-08-03T09:00:00.000Z" },
  { tipo: "hueco", zona: "Calle 48 # 16-20", severidad: "alto", prioridad: "alto", puntaje: 99, fecha: "2026-08-20T09:00:00.000Z" },
  { tipo: "anden", zona: "Calle 49 # 15-40", severidad: "bajo", prioridad: "bajo", puntaje: 25, fecha: "2026-08-07T09:00:00.000Z" },
  { tipo: "hueco", zona: "Carrera 16 # 47-30", severidad: "alto", prioridad: "alto", puntaje: 84, fecha: "2026-08-22T09:00:00.000Z" },
  { tipo: "otro", zona: "Calle 49 # 15-40", severidad: "medio", prioridad: "medio", puntaje: 47, fecha: "2026-08-09T09:00:00.000Z" },
];

function cargarDatosDemo() {
  localStorage.setItem("bogovial_reportes", JSON.stringify(REPORTES_DEMO));
}
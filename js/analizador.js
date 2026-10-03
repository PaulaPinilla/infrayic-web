/*
  Prototipo del algoritmo de analisis de severidad para BogoVial.

  Que hace realmente:
  Este NO es un modelo de red neuronal entrenado (eso requeriria miles de
  fotos de huecos/andenes etiquetadas, que el proyecto academico no tiene).
  Es un algoritmo de procesamiento de imagenes que corre 100% en el
  navegador del ciudadano (sin servidor, sin enviar la foto a ningun lado):

  1. Dibuja la foto en un <canvas> oculto.
  2. La convierte a escala de grises.
  3. Aplica el operador de Sobel (deteccion de bordes) para encontrar
     cambios bruscos de contraste: grietas, bordes de huecos y texturas
     irregulares generan muchos bordes; una superficie lisa genera pocos.
  4. Calcula la "densidad de bordes" (porcentaje de pixeles que son borde).
  5. Clasifica esa densidad en Bajo / Medio / Alto segun unos umbrales.

  Esto sirve como prueba de concepto funcional del flujo "sube la foto,
  el sistema te dice el nivel de severidad". El siguiente paso real del
  proyecto (fuera del alcance academico actual) seria reemplazar este
  algoritmo por un modelo de vision por computador (ej. una red
  convolucional) entrenado con fotos reales de las vias de Bogota.
*/

function analizarImagen(imgElement) {
  const ancho = 300;
  const alto = Math.round((imgElement.naturalHeight / imgElement.naturalWidth) * ancho) || 300;

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgElement, 0, 0, ancho, alto);

  const datos = ctx.getImageData(0, 0, ancho, alto);
  const gris = aEscalaDeGrises(datos, ancho, alto);
  const bordes = sobel(gris, ancho, alto);

  let pixelesBorde = 0;
  const umbralBorde = 90;
  for (let i = 0; i < bordes.length; i++) {
    if (bordes[i] > umbralBorde) pixelesBorde++;
  }
  const densidad = pixelesBorde / bordes.length;

  let nivel, etiqueta, recomendacion;
  if (densidad < 0.07) {
    nivel = "bajo";
    etiqueta = "Severidad baja";
    recomendacion = "Deterioro leve. Se programa para mantenimiento rutinario, sin prioridad urgente.";
  } else if (densidad < 0.16) {
    nivel = "medio";
    etiqueta = "Severidad media";
    recomendacion = "Deterioro moderado. Se agenda intervención en el corto plazo según disponibilidad de cuadrillas.";
  } else {
    nivel = "alto";
    etiqueta = "Severidad alta";
    recomendacion = "Deterioro considerable o posible riesgo para peatones/vehículos. Se escala a Ingeniería Civil para priorización inmediata.";
  }

  return {
    nivel,
    etiqueta,
    recomendacion,
    densidad: (densidad * 100).toFixed(1),
  };
}

function aEscalaDeGrises(datosImagen, ancho, alto) {
  const out = new Uint8ClampedArray(ancho * alto);
  const d = datosImagen.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    out[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return out;
}

function sobel(gris, ancho, alto) {
  const out = new Uint8ClampedArray(ancho * alto);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      let sx = 0, sy = 0, k = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const val = gris[(y + j) * ancho + (x + i)];
          sx += val * gx[k];
          sy += val * gy[k];
          k++;
        }
      }
      const mag = Math.sqrt(sx * sx + sy * sy);
      out[y * ancho + x] = mag > 255 ? 255 : mag;
    }
  }
  return out;
}
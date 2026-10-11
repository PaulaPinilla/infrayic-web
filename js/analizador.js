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
    recomendacion = "Deterioro moderado. Se agenda intervencion en el corto plazo segun disponibilidad de cuadrillas.";
  } else {
    nivel = "alto";
    etiqueta = "Severidad alta";
    recomendacion = "Deterioro considerable o posible riesgo para peatones/vehiculos. Se escala a Ingenieria Civil para priorizacion inmediata.";
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

/* ------------------------------------------------------------------
   FILTRO DE RELEVANCIA: "esta foto es de un dano en la via?"

   Antes de calcular la severidad, el sitio revisa que la imagen sea
   plausiblemente del espacio publico (pavimento, anden, senalizacion).
   Si es una mascota, una persona, comida o un paisaje, se rechaza y no
   se analiza ni se guarda. Usa dos capas:

   1. Capa de color (siempre funciona, sin internet extra): mide cuanto
      de la imagen es "color de via" (grises de asfalto y concreto,
      tierra) y cuanto es verde/cielo. Sirve para descartar fotos de
      cielo, vegetacion o colores vivos. NO basta para una mascota sobre
      pasto apagado (sus colores parecen grises), por eso existe la capa 2.
   2. Capa de reconocimiento (MobileNet, de TensorFlow.js): una red
      neuronal ya entrenada con 1.000 categorias generales que reconoce
      animales, comida, plantas y personas. Se descarga en segundo plano
      la primera vez (unos 17 MB, luego queda guardada en el navegador). Si
      no se puede cargar, la foto NO se acepta: es preferible pedir que se
      intente de nuevo a dejar pasar una imagen que no es de la via.

   Importante: esto es un FILTRO de relevancia, no el modelo de dano.
   Las dos capas son prototipo y pueden fallar con fotos ambiguas; por
   eso el ingeniero siempre revisa cada reporte en el panel.
------------------------------------------------------------------- */

function evaluarPixeles(datos, total) {
  let vial = 0, verde = 0, cielo = 0, vivo = 0;
  for (let i = 0; i < datos.length; i += 4) {
    const r = datos[i], g = datos[i + 1], b = datos[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const v = max / 255;
    const s = max === 0 ? 0 : (max - min) / max;
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    if (s < 0.22) vial++;                                   // gris: asfalto, concreto
    else if (h >= 15 && h <= 50 && s < 0.55 && v < 0.85) vial++; // tierra, arena, adoquin
    if (h >= 65 && h <= 170 && s > 0.22 && v > 0.15) verde++;
    if (h >= 180 && h <= 260 && s > 0.25) cielo++;
    if (s > 0.55 && v > 0.35) vivo++;
  }
  return { vial: vial / total, verde: verde / total, cielo: cielo / total, vivo: vivo / total };
}

function filtroPorColor(imgElement) {
  const ancho = 120;
  const alto = Math.round((imgElement.naturalHeight / imgElement.naturalWidth) * ancho) || 120;
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgElement, 0, 0, ancho, alto);
  const m = evaluarPixeles(ctx.getImageData(0, 0, ancho, alto).data, ancho * alto);
  const valida = m.vial >= 0.35 && m.verde <= 0.30 && m.cielo <= 0.45 && m.vivo <= 0.40;
  return { valida, metricas: m };
}

/* Categorias de MobileNet (ImageNet) que nunca son un dano vial:
   0-397 animales, 924-969 comida, 981-983 personas, 984-993 plantas y hongos. */
function esCategoriaNoVial(indice) {
  return (indice >= 0 && indice <= 397) || (indice >= 924 && indice <= 969) ||
         (indice >= 981 && indice <= 993);
}

let promesaModeloVista = null;
function cargarModeloVista() {
  if (promesaModeloVista) return promesaModeloVista;
  const cargarScript = (src) => new Promise((ok, fallo) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => fallo(new Error("No se pudo cargar " + src));
    document.head.appendChild(s);
  });
  promesaModeloVista = (async () => {
    await cargarScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
    await cargarScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js");
    return await mobilenet.load();
  })().catch((e) => {
    console.warn("Reconocedor de imagenes no disponible:", e);
    promesaModeloVista = null; // permite reintentar en la siguiente foto
    return null;
  });
  return promesaModeloVista;
}

/* Suma la probabilidad que la red le da a TODAS las categorias que no son
   un dano vial (animales, comida, personas, plantas). Si la suma es alta,
   la foto se rechaza. */
async function filtroPorModelo(imgElement) {
  const modelo = await Promise.race([cargarModeloVista(), new Promise((ok) => setTimeout(() => ok(null), 45000))]);
  if (!modelo) return { disponible: false, valida: false };
  const logits = modelo.infer(imgElement, false);
  const probs = tf.softmax(logits);
  const arr = Array.from(await probs.data());
  logits.dispose(); probs.dispose();
  let noVial = 0;
  for (let i = 0; i < arr.length; i++) if (esCategoriaNoVial(i)) noVial += arr[i];
  try {
    const top = await modelo.classify(imgElement, 3);
    console.log("Reconocedor:", top.map((t) => t.className + " " + Math.round(t.probability * 100) + " %").join(" | "), "| no vial:", Math.round(noVial * 100) + " %");
  } catch (e) {}
  return { disponible: true, valida: noVial < 0.5, noVial };
}

async function esFotoDeVia(imgElement) {
  const color = filtroPorColor(imgElement);
  if (!color.valida) {
    const m = color.metricas;
    return { valida: false, motivo: "La imagen no tiene los colores de una vía o un andén (colores de vía: " + Math.round(m.vial * 100) + " %, vegetación: " + Math.round(m.verde * 100) + " %, tonos vivos: " + Math.round(m.vivo * 100) + " %)." };
  }
  let modelo;
  try { modelo = await filtroPorModelo(imgElement); } catch (e) { console.warn(e); modelo = { disponible: false, valida: false }; }
  if (!modelo.disponible) {
    return { valida: false, motivo: "No se pudo cargar el verificador de imágenes. Revisa tu conexión a internet y vuelve a subir la foto." };
  }
  if (!modelo.valida) {
    return { valida: false, motivo: "La imagen parece mostrar un animal, una persona, comida o plantas (" + Math.round(modelo.noVial * 100) + " % de coincidencia), no un daño en el espacio público." };
  }
  return { valida: true, motivo: "", usoModelo: true };
}

// Empieza a descargar el modelo en segundo plano apenas carga la pagina.
if (typeof window !== "undefined") window.addEventListener("load", () => setTimeout(cargarModeloVista, 1500));
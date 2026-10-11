/*
  Verificador de autenticidad de fotos (se ejecuta en el navegador).

  No "adivina" con una IA entrenada: revisa evidencias concretas que dejan
  las fotos reales y que NO tienen las imagenes bajadas de internet o
  generadas con IA:
    1. Metadatos de camara (marca, modelo, fecha de toma, GPS).
    2. Marcas de generadores de IA escritas dentro del archivo.
    3. Ubicacion del reportante (cerca del sector piloto).
    4. Imagen repetida (huella visual igual a un reporte anterior).
  El resultado es un INDICIO para el ingeniero civil, que decide al final.
*/

const SECTOR_PILOTO = { lat: 4.636234, lon: -74.068619, radioMetros: 500 };

const MARCAS_IA = [
  "trainedalgorithmicmedia", "midjourney", "dall-e", "dall\u00b7e", "stable diffusion",
  "stablediffusion", "adobe firefly", "firefly", "comfyui", "leonardo.ai", "openai",
  "synthid", "generative ai", "ai generated", "ai-generated",
];

/* ---------- Metadatos EXIF (solo JPEG) ---------- */

function leerExif(buffer) {
  const v = new DataView(buffer);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
  let off = 2;
  while (off + 4 < v.byteLength) {
    const marcador = v.getUint16(off);
    if (marcador === 0xFFE1) {
      if (v.getUint32(off + 4) === 0x45786966) return leerTiff(v, off + 10);
      off += 2 + v.getUint16(off + 2);
    } else if ((marcador & 0xFF00) === 0xFF00 && marcador !== 0xFFDA) {
      off += 2 + v.getUint16(off + 2);
    } else {
      break;
    }
  }
  return null;
}

function leerTiff(v, t) {
  const little = v.getUint16(t) === 0x4949;
  const ifd0 = leerIfd(v, t, v.getUint32(t + 4, little), little);
  const resultado = {
    marca: ifd0[0x010F] || "",
    modelo: ifd0[0x0110] || "",
    software: ifd0[0x0131] || "",
    fechaToma: "",
    gps: null,
  };
  if (ifd0[0x8769]) {
    const exifIfd = leerIfd(v, t, ifd0[0x8769], little);
    resultado.fechaToma = exifIfd[0x9003] || exifIfd[0x9004] || "";
  }
  if (ifd0[0x8825]) {
    const g = leerIfd(v, t, ifd0[0x8825], little);
    if (g[2] && g[4]) {
      let lat = g[2][0] + g[2][1] / 60 + g[2][2] / 3600;
      let lon = g[4][0] + g[4][1] / 60 + g[4][2] / 3600;
      if (g[1] === "S") lat = -lat;
      if (g[3] === "W") lon = -lon;
      resultado.gps = { lat, lon };
    }
  }
  return resultado;
}

function leerIfd(v, t, offset, little) {
  const mapa = {};
  let p = t + offset;
  if (p + 2 > v.byteLength) return mapa;
  const n = v.getUint16(p, little);
  p += 2;
  for (let i = 0; i < n; i++, p += 12) {
    if (p + 12 > v.byteLength) break;
    const tag = v.getUint16(p, little);
    const tipo = v.getUint16(p + 2, little);
    const cuenta = v.getUint32(p + 4, little);
    const tam = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 }[tipo] || 1;
    const dir = tam * cuenta <= 4 ? p + 8 : t + v.getUint32(p + 8, little);
    if (dir + tam * cuenta > v.byteLength) continue;
    if (tipo === 2) {
      let s = "";
      for (let k = 0; k < cuenta - 1; k++) s += String.fromCharCode(v.getUint8(dir + k));
      mapa[tag] = s.trim();
    } else if (tipo === 3) {
      mapa[tag] = v.getUint16(dir, little);
    } else if (tipo === 4) {
      mapa[tag] = v.getUint32(dir, little);
    } else if (tipo === 5) {
      const lista = [];
      for (let k = 0; k < cuenta; k++) {
        const num = v.getUint32(dir + k * 8, little);
        const den = v.getUint32(dir + k * 8 + 4, little);
        lista.push(den ? num / den : 0);
      }
      mapa[tag] = lista;
    } else if (tipo === 1) {
      mapa[tag] = String.fromCharCode(v.getUint8(dir));
    }
  }
  return mapa;
}

/* ---------- Utilidades ---------- */

function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function obtenerUbicacion() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

/* Huella visual de 64 bits (dHash): dos fotos casi iguales dan huellas casi iguales */
function huellaVisual(imgElement) {
  const c = document.createElement("canvas");
  c.width = 9; c.height = 8;
  const ctx = c.getContext("2d");
  ctx.drawImage(imgElement, 0, 0, 9, 8);
  const d = ctx.getImageData(0, 0, 9, 8).data;
  const gris = (x, y) => { const i = (y * 9 + x) * 4; return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; };
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gris(x, y) > gris(x + 1, y) ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

function distanciaHuellas(a, b) {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { dist += x & 1; x >>= 1; }
  }
  return dist;
}

/* Foto reducida (max 900 px) para guardarla en la base de datos y mostrarla al ingeniero */
function comprimirImagen(imgElement, maxLado = 900, calidad = 0.7) {
  const escala = Math.min(1, maxLado / Math.max(imgElement.naturalWidth, imgElement.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(imgElement.naturalWidth * escala);
  c.height = Math.round(imgElement.naturalHeight * escala);
  c.getContext("2d").drawImage(imgElement, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", calidad);
}

/* ---------- Verificacion principal ---------- */

async function verificarImagen(archivo, imgElement, ubicacionReportante, huellasPrevias) {
  const buffer = await archivo.arrayBuffer();
  const exif = leerExif(buffer);
  const textoCrudo = new TextDecoder("latin1").decode(buffer.slice(0, 300000)).toLowerCase();

  let puntaje = 0;
  const senales = [];

  const marcaIA = MARCAS_IA.find((m) => textoCrudo.includes(m));
  if (marcaIA) {
    puntaje -= 60;
    senales.push({ ok: false, texto: "El archivo contiene una marca de generador de IA (\"" + marcaIA + "\")." });
  }

  if (exif && (exif.marca || exif.modelo)) {
    puntaje += 30;
    senales.push({ ok: true, texto: "Metadatos de camara: " + (exif.marca + " " + exif.modelo).trim() + "." });
  } else {
    senales.push({ ok: false, texto: "Sin metadatos de camara (suele pasar con imagenes de internet, capturas o fotos reenviadas por chat)." });
  }

  if (exif && exif.fechaToma) {
    const m = exif.fechaToma.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      const fecha = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      const dias = (Date.now() - fecha.getTime()) / 86400000;
      if (dias >= -1 && dias <= 3) {
        puntaje += 20;
        senales.push({ ok: true, texto: "Fecha de toma reciente: " + fecha.toLocaleString("es-CO") + "." });
      } else {
        puntaje += 5;
        senales.push({ ok: false, texto: "La foto se tomo el " + fecha.toLocaleDateString("es-CO") + " (no es reciente)." });
      }
    }
  }

  const enSector = (p) => distanciaMetros(p.lat, p.lon, SECTOR_PILOTO.lat, SECTOR_PILOTO.lon) <= SECTOR_PILOTO.radioMetros;
  if (exif && exif.gps) {
    if (enSector(exif.gps)) {
      puntaje += 20;
      senales.push({ ok: true, texto: "El GPS de la foto esta dentro del sector piloto." });
    } else {
      puntaje -= 15;
      senales.push({ ok: false, texto: "El GPS de la foto esta fuera del sector piloto." });
    }
  } else if (ubicacionReportante) {
    if (enSector(ubicacionReportante)) {
      puntaje += 15;
      senales.push({ ok: true, texto: "El reportante esta en el sector piloto al enviar el reporte." });
    } else {
      senales.push({ ok: false, texto: "El reportante esta fuera del sector piloto." });
    }
  } else {
    senales.push({ ok: false, texto: "No se pudo comprobar la ubicacion (permiso de ubicacion no concedido)." });
  }

  const huella = huellaVisual(imgElement);
  const duplicado = (huellasPrevias || []).some((h) => h && distanciaHuellas(huella, h) <= 6);
  if (duplicado) {
    puntaje -= 60;
    senales.push({ ok: false, texto: "Esta imagen ya fue enviada en otro reporte." });
  }

  puntaje = Math.max(0, Math.min(100, puntaje));
  const nivel = puntaje >= 50 ? "verificada" : puntaje >= 20 ? "revisar" : "sospechosa";

  return {
    puntaje,
    nivel,
    senales,
    duplicado,
    huella,
    gps: exif && exif.gps ? exif.gps : ubicacionReportante || null,
    fotoComprimida: comprimirImagen(imgElement),
  };
}

const ETIQUETAS_VERIFICACION = {
  verificada: { texto: "Foto verificada", clase: "bajo" },
  revisar: { texto: "Requiere revision del ingeniero", clase: "medio" },
  sospechosa: { texto: "Foto sospechosa", clase: "alto" },
};
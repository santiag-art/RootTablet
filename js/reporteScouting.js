// Reporte de scouting por rival: una hoja A4 en PDF para imprimir antes del partido.
// Junta TODOS los partidos guardados en la tablet contra ese equipo: cómo nos ha ido, cómo rinde Roots contra él y cómo
// anota él (motivos, mapa de calor de sus ataques y trayectorias). Se dibuja en un canvas (fondo blanco, para ahorrar tinta
// y que se lea también en blanco y negro: cada zona lleva su número) y de ahí sale el PDF, sin librerías ni internet.
//
// `datosScouting` es puro (se prueba aparte); `dibujarScouting` solo dibuja lo que ese objeto trae.
import { contar, eventosDelAlcance } from './estadisticas.js';
import { FUNDAMENTOS } from './reglas/anotacion.js';
import { MAPA_CALOR, MOTIVOS_RIVAL, ZONAS_CAIDA, centrosDeZonas, crucesOrdenados, frasesDelRival } from './puntosRival.js';
import { setsDelPartido } from './historialRival.js';
import { fechaCorta } from './resumen.js';
import { aBlob, alturaParrafo, cargarLogo, construirPdfDeJpeg, descargarBlob, parrafo, rectRedondeado, textoAjustado } from './resumenCompartir.js';

// Con menos puntos con detalle que esto, el reporte avisa que es solo una referencia.
export const MIN_PUNTOS_CON_DETALLE = 10;
const MIN_JUGADAS_FUNDAMENTO = 5; // para opinar del rendimiento de un fundamento contra este rival
const MAX_PARTIDOS_EN_HOJA = 6;
const MAX_RECOMENDACIONES = 5;

const pct = (x) => `${Math.round(x * 100)}%`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const nombreFundamento = (f) => f.toLowerCase();

// Marcadores de un partido desde nuestro lado: "25-20 · 18-25" (nuestros puntos primero).
export function marcadoresPropios(est) {
  return est.sets.map((s) => (est.ladoPropio === 'local' ? `${s.puntosLocal}-${s.puntosVisitante}` : `${s.puntosVisitante}-${s.puntosLocal}`));
}

function resultadoDe(est) {
  const { ganados, perdidos } = setsDelPartido(est);
  if (ganados + perdidos === 0) return null;
  return ganados > perdidos ? 'G' : perdidos > ganados ? 'P' : 'E';
}

// Cuántos puntos hacemos y recibimos en promedio por set.
function puntosPorSet(partidos) {
  let propios = 0;
  let rival = 0;
  let sets = 0;
  for (const { est } of partidos) {
    for (const s of est.sets) {
      propios += est.ladoPropio === 'local' ? s.puntosLocal : s.puntosVisitante;
      rival += est.ladoPropio === 'local' ? s.puntosVisitante : s.puntosLocal;
      sets += 1;
    }
  }
  return sets ? { sets, propios: propios / sets, rival: rival / sets } : null;
}

// Cómo rinde Roots (todas las jugadoras) contra este rival, por fundamento, con los partidos juntos.
function rendimientoContra(partidos) {
  const eventos = partidos.flatMap(({ est }) => eventosDelAlcance(est, 'todo'));
  return FUNDAMENTOS.map((fundamento) => ({ fundamento, ...contar(eventos.filter((e) => e.fundamento === fundamento)) }))
    .filter((f) => f.total >= MIN_JUGADAS_FUNDAMENTO)
    .map(({ fundamento, total, efectividad, error }) => ({ fundamento, total, efectividad, errores: error }));
}

// Qué conviene trabajar antes del partido, SOLO con lo que dicen los datos (si no hay datos, no hay recomendación).
export function recomendaciones(rival, rendimiento) {
  const r = rival.resumen;
  const lista = [];
  if (r.conDetalle >= 8) {
    const total = r.conDetalle;
    const motivo = (id) => r.motivos[id] ?? 0;
    const ataques = r.ataques;
    const [zonaDestino, nDestino] = Object.entries(ataques.hacia).sort((a, b) => b[1] - a[1])[0];
    if (ataques.conDestino >= 5 && nDestino / ataques.conDestino >= 0.3) {
      lista.push(`Reforzar la defensa en la zona ${zonaDestino} de nuestra cancha: ahí cae el ${pct(nDestino / ataques.conDestino)} de sus ataques (${nDestino} de ${ataques.conDestino}).`);
    }
    const [zonaOrigen, nOrigen] = Object.entries(ataques.desde).sort((a, b) => b[1] - a[1])[0];
    if (ataques.conOrigen >= 5 && nOrigen / ataques.conOrigen >= 0.35) {
      lista.push(`Preparar el bloqueo para su zona ${zonaOrigen}: ataca desde ahí el ${pct(nOrigen / ataques.conOrigen)} de las veces (${nOrigen} de ${ataques.conOrigen}).`);
    }
    const cruce = crucesOrdenados(r, 1)[0];
    if (cruce && cruce.n >= 3) lista.push(`Su trayectoria más repetida va de su zona ${cruce.desde} a nuestra zona ${cruce.hacia} (${plural(cruce.n, 'vez', 'veces')}).`);
    if (motivo('saque') / total >= 0.2) lista.push(`Su saque directo nos hace daño (${motivo('saque')} de ${total} puntos): cuidar la recepción y a quién le sacan.`);
    if (motivo('error') / total >= 0.35) lista.push(`El ${pct(motivo('error') / total)} de sus puntos son errores nuestros: jugar más seguro, sin arriesgar de más.`);
    if (motivo('bloqueo') / total >= 0.2) lista.push(`Nos bloquean bastante (${motivo('bloqueo')} de ${total} puntos): variar la dirección y la altura del ataque.`);
  }
  for (const f of rendimiento) {
    if (f.total >= 10 && f.efectividad != null && f.efectividad < 0.4) {
      lista.push(`Contra este rival nuestra ${nombreFundamento(f.fundamento)} rinde ${pct(f.efectividad)} en ${f.total} jugadas: trabajarla antes del partido.`);
    }
  }
  return lista.slice(0, MAX_RECOMENDACIONES);
}

// Todo lo que lleva la hoja. `rival` es un renglón de rivalesConHistorial (historialRival.js).
export function datosScouting(rival, { equipo = 'Roots', fecha = new Date() } = {}) {
  const r = rival.resumen;
  const partidos = rival.partidos.filter((p) => p.est);
  const recientes = partidos.slice(0, MAX_PARTIDOS_EN_HOJA).map((p) => ({
    fecha: fechaCorta(String(p.fecha ?? '').slice(0, 10)),
    resultado: resultadoDe(p.est),
    sets: marcadoresPropios(p.est),
  }));
  const rendimiento = rendimientoContra(partidos);
  const motivos = MOTIVOS_RIVAL.map((m) => ({ id: m.id, texto: m.texto, n: r.motivos[m.id], pct: r.conDetalle ? r.motivos[m.id] / r.conDetalle : 0 }));
  return {
    equipo,
    rival: rival.nombre,
    generado: fecha,
    partidos: partidos.length,
    ganados: rival.ganados,
    perdidos: rival.perdidos,
    empatados: rival.empatados,
    recientes,
    partidosOcultos: Math.max(0, partidos.length - MAX_PARTIDOS_EN_HOJA),
    puntosPorSet: puntosPorSet(partidos),
    rendimiento,
    puntosRival: { total: r.total, conDetalle: r.conDetalle, sinDetalle: r.sinDetalle },
    motivos,
    mapa: { desde: r.ataques.desde, hacia: r.ataques.hacia, conOrigen: r.ataques.conOrigen, conDestino: r.ataques.conDestino, total: r.ataques.total, cruces: crucesOrdenados(r, 4) },
    frases: frasesDelRival(r, rival.nombre),
    recomendaciones: recomendaciones(rival, rendimiento),
    hayDetalle: r.conDetalle > 0,
    pocosDatos: r.conDetalle > 0 && r.conDetalle < MIN_PUNTOS_CON_DETALLE,
  };
}

// ───────────── Dibujo (hoja A4 a 150 puntos por pulgada) ─────────────
const NAVY = '#050e2d';
const ARENA = '#05b2c4';
const GRIS = '#4b5563';
const GRIS_CLARO = '#d1d5db';
const VERDE = '#047857';
const ROJO = '#b91c1c';
const AMARILLO = '#b45309';
const FUENTE = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const NARANJA_RGB = '245,158,11';
const VERDE_RGB = '12,164,164';
const W = 1240;
const H = 1754;
const M = 60;

const titulo = (ctx, texto, x, y) => {
  ctx.fillStyle = ARENA;
  ctx.textAlign = 'left';
  ctx.font = `bold 22px ${FUENTE}`;
  ctx.fillText(texto.toUpperCase(), x, y);
  ctx.fillStyle = GRIS_CLARO;
  ctx.fillRect(x, y + 10, 520, 2);
};

function mapaDeCalor(ctx, datos, x0, y0, ancho) {
  const g = MAPA_CALOR;
  const f = ancho / g.ancho;
  const { desde, hacia, conOrigen, conDestino } = datos.mapa;
  const rival = centrosDeZonas(g.filasRival);
  const nuestra = centrosDeZonas(g.filasNuestra);
  const maxDesde = Math.max(1, ...Object.values(desde));
  const maxHacia = Math.max(1, ...Object.values(hacia));
  const px = (v) => x0 + v * f;
  const py = (v) => y0 + v * f;
  const celdas = (mapa, conteos, max, total, rgb) => {
    for (const z of ZONAS_CAIDA) {
      const { x, y } = mapa.get(z);
      const n = conteos[z] ?? 0;
      const alfa = n > 0 ? 0.2 + 0.7 * (n / max) : 0.05;
      ctx.fillStyle = `rgba(${rgb},${alfa.toFixed(2)})`;
      ctx.strokeStyle = `rgba(${rgb},0.8)`;
      ctx.lineWidth = 2;
      rectRedondeado(ctx, px(x + 2), py(y + 2), (g.anchoZona - 4) * f, (g.altoZona - 4) * f, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = GRIS;
      ctx.textAlign = 'left';
      ctx.font = `bold 20px ${FUENTE}`;
      ctx.fillText(String(z), px(x + 10), py(y + 22));
      if (n > 0) {
        ctx.fillStyle = NAVY;
        ctx.textAlign = 'center';
        ctx.font = `bold 44px ${FUENTE}`;
        ctx.fillText(String(n), px(x + g.anchoZona / 2), py(y + g.altoZona / 2 + 8));
        ctx.font = `bold 20px ${FUENTE}`;
        ctx.fillText(pct(n / total), px(x + g.anchoZona / 2), py(y + g.altoZona / 2 + 32));
      }
    }
  };
  celdas(rival, desde, maxDesde, Math.max(1, conOrigen), NARANJA_RGB);
  ctx.fillStyle = NAVY;
  rectRedondeado(ctx, px(g.x0), py(g.red.y), g.anchoZona * 3 * f, g.red.alto * f, 6);
  ctx.fill();
  celdas(nuestra, hacia, maxHacia, Math.max(1, conDestino), VERDE_RGB);
  // Trayectorias: de la zona del rival (abajo de su zona) a la de nuestra cancha (arriba de la nuestra).
  const maxCruce = Math.max(1, ...datos.mapa.cruces.map((c) => c.n));
  for (const c of datos.mapa.cruces) {
    const a = rival.get(c.desde);
    const b = nuestra.get(c.hacia);
    const ax = px(a.x + g.anchoZona / 2);
    const ay = py(a.y + g.altoZona - 8);
    const bx = px(b.x + g.anchoZona / 2);
    const by = py(b.y + 18);
    ctx.strokeStyle = 'rgba(5,14,45,0.85)';
    ctx.fillStyle = 'rgba(5,14,45,0.85)';
    ctx.lineWidth = 3 + (c.n / maxCruce) * 5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const ang = Math.atan2(by - ay, bx - ax);
    const punta = 22;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - punta * Math.cos(ang - 0.45), by - punta * Math.sin(ang - 0.45));
    ctx.lineTo(bx - punta * Math.cos(ang + 0.45), by - punta * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  }
  return g.alto * f;
}

// Dibuja la hoja y devuelve el canvas (A4: 1240 x 1754).
export function dibujarScouting(datos, logo = null, crearCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })) {
  const lienzo = crearCanvas(W, H);
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Cabecera
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, 190);
  let xTexto = M;
  if (logo) {
    const alto = 110;
    const ancho = (logo.width / logo.height) * alto || alto;
    ctx.drawImage(logo, M, 40, ancho, alto);
    xTexto = M + ancho + 30;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = ARENA;
  ctx.font = `bold 24px ${FUENTE}`;
  ctx.fillText('REPORTE DE SCOUTING', xTexto, 62);
  textoAjustado(ctx, datos.rival.toUpperCase(), xTexto, 118, W - xTexto - M, { tam: 54, color: '#ffffff' });
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `24px ${FUENTE}`;
  const record = [`${plural(datos.partidos, 'partido', 'partidos')}`, `${datos.ganados} ${datos.ganados === 1 ? 'ganado' : 'ganados'}`, `${datos.perdidos} ${datos.perdidos === 1 ? 'perdido' : 'perdidos'}`];
  if (datos.empatados) record.push(`${datos.empatados} ${datos.empatados === 1 ? 'empatado' : 'empatados'}`);
  ctx.fillText(`${datos.equipo} vs ${datos.rival} · ${record.join(' · ')}`, xTexto, 160);

  // Columna izquierda: partidos recientes y rendimiento
  const xI = M;
  const anchoI = 520;
  let yI = 245;
  titulo(ctx, 'Partidos recientes', xI, yI);
  yI += 52;
  if (datos.recientes.length === 0) {
    ctx.fillStyle = GRIS;
    ctx.font = `22px ${FUENTE}`;
    ctx.fillText('Todavía no hay partidos guardados.', xI, yI);
    yI += 40;
  }
  for (const p of datos.recientes) {
    const color = p.resultado === 'G' ? VERDE : p.resultado === 'P' ? ROJO : GRIS;
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'left';
    ctx.font = `bold 24px ${FUENTE}`;
    ctx.fillText(p.fecha || 'Sin fecha', xI, yI);
    ctx.fillStyle = color;
    rectRedondeado(ctx, xI + 190, yI - 28, 40, 38, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText(p.resultado ?? '–', xI + 210, yI);
    ctx.fillStyle = GRIS;
    ctx.textAlign = 'left';
    textoAjustado(ctx, p.sets.length ? p.sets.join('  ·  ') : 'sin sets guardados', xI + 250, yI, anchoI - 250, { tam: 22, peso: 'normal', color: GRIS });
    yI += 46;
  }
  if (datos.partidosOcultos > 0) {
    ctx.fillStyle = GRIS;
    ctx.textAlign = 'left';
    ctx.font = `italic 20px ${FUENTE}`;
    ctx.fillText(`y ${plural(datos.partidosOcultos, 'partido más anterior', 'partidos más anteriores')}`, xI, yI);
    yI += 36;
  }
  if (datos.puntosPorSet) {
    yI += 6;
    ctx.fillStyle = NAVY;
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText(`Promedio por set: ${datos.puntosPorSet.propios.toFixed(1)} nuestros · ${datos.puntosPorSet.rival.toFixed(1)} del rival`, xI, yI);
    yI += 30;
  }

  yI += 50;
  titulo(ctx, 'Nuestro rendimiento contra ellos', xI, yI);
  yI += 50;
  if (datos.rendimiento.length === 0) {
    ctx.fillStyle = GRIS;
    ctx.font = `22px ${FUENTE}`;
    ctx.textAlign = 'left';
    yI += parrafo(ctx, 'Todavía no hay suficientes jugadas anotadas contra este rival (se necesitan 5 por fundamento).', xI, yI, anchoI, 30);
  }
  for (const f of datos.rendimiento) {
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'left';
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText(f.fundamento, xI, yI);
    const xBarra = xI + 170;
    const anchoBarra = anchoI - 170 - 130;
    ctx.fillStyle = '#e5e7eb';
    rectRedondeado(ctx, xBarra, yI - 22, anchoBarra, 26, 8);
    ctx.fill();
    const relleno = Math.max(0, Math.min(1, f.efectividad ?? 0));
    ctx.fillStyle = relleno >= 0.6 ? VERDE : relleno >= 0.4 ? AMARILLO : ROJO;
    if (relleno > 0) {
      rectRedondeado(ctx, xBarra, yI - 22, Math.max(16, anchoBarra * relleno), 26, 8);
      ctx.fill();
    }
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'right';
    ctx.font = `bold 22px ${FUENTE}`;
    ctx.fillText(`${pct(f.efectividad ?? 0)}`, xI + anchoI, yI);
    ctx.fillStyle = GRIS;
    ctx.font = `18px ${FUENTE}`;
    ctx.fillText(`${f.total} jug.`, xI + anchoI, yI + 22);
    yI += 56;
  }
  if (datos.rendimiento.length) {
    ctx.fillStyle = GRIS;
    ctx.textAlign = 'left';
    ctx.font = `italic 18px ${FUENTE}`;
    ctx.fillText('Efectividad = jugadas buenas (++ y +) sobre el total.', xI, yI - 10);
  }

  // Columna derecha: mapa de calor
  const xD = 640;
  const anchoD = 540;
  titulo(ctx, 'Cómo ataca (mapa de calor)', xD, 245);
  ctx.fillStyle = AMARILLO;
  ctx.textAlign = 'left';
  ctx.font = `bold 19px ${FUENTE}`;
  ctx.fillText('CANCHA DEL RIVAL · de dónde ataca', xD + 10, 300);
  const altoMapa = datos.mapa.total > 0 ? mapaDeCalor(ctx, datos, xD + 30, 316, anchoD - 60) : 0;
  let yMapa = 316 + altoMapa;
  if (datos.mapa.total === 0) {
    ctx.fillStyle = GRIS;
    ctx.font = `22px ${FUENTE}`;
    yMapa += parrafo(ctx, 'Todavía no hay ataques del rival con zonas anotadas. Al sumarle un punto al rival en la tablet, elige "Ataque" y toca las zonas.', xD, 340, anchoD, 30);
  } else {
    ctx.fillStyle = VERDE;
    ctx.textAlign = 'left';
    ctx.font = `bold 19px ${FUENTE}`;
    ctx.fillText('NUESTRA CANCHA · dónde cae la pelota', xD + 10, yMapa + 28);
    yMapa += 40;
    ctx.fillStyle = GRIS;
    ctx.font = `18px ${FUENTE}`;
    yMapa += parrafo(ctx, `${datos.mapa.total} ataques: ${datos.mapa.conOrigen} con zona de salida y ${datos.mapa.conDestino} con zona de caída. Las flechas son las trayectorias que más se repiten. Cada equipo con su numeración, por eso su zona 4 queda a la derecha.`, xD, yMapa + 18, anchoD, 25) + 18;
  }

  // Parte baja: cómo anota y qué hacer
  const yBase = Math.max(yI, yMapa) + 40;
  titulo(ctx, `Cómo anota ${datos.rival}`.slice(0, 40), xI, yBase);
  let yA = yBase + 50;
  if (!datos.hayDetalle) {
    ctx.fillStyle = GRIS;
    ctx.textAlign = 'left';
    ctx.font = `22px ${FUENTE}`;
    yA += parrafo(ctx, 'Todavía no hay detalle de cómo anota este rival. Activa "Preguntar cómo anota el rival" en el menú ⋮ del partido y elige el motivo de cada punto.', xI, yA, anchoI, 30);
  } else {
    for (const m of datos.motivos) {
      ctx.fillStyle = NAVY;
      ctx.textAlign = 'left';
      ctx.font = `bold 22px ${FUENTE}`;
      ctx.fillText(m.texto, xI, yA);
      const xBarra = xI + 190;
      const anchoBarra = anchoI - 190 - 90;
      ctx.fillStyle = '#e5e7eb';
      rectRedondeado(ctx, xBarra, yA - 22, anchoBarra, 26, 8);
      ctx.fill();
      if (m.n > 0) {
        ctx.fillStyle = NAVY;
        rectRedondeado(ctx, xBarra, yA - 22, Math.max(16, anchoBarra * m.pct), 26, 8);
        ctx.fill();
      }
      ctx.fillStyle = NAVY;
      ctx.textAlign = 'right';
      ctx.fillText(`${m.n}`, xI + anchoI, yA);
      yA += 46;
    }
    ctx.fillStyle = GRIS;
    ctx.textAlign = 'left';
    ctx.font = `italic 18px ${FUENTE}`;
    const sin = datos.puntosRival.sinDetalle;
    ctx.fillText(`${datos.puntosRival.conDetalle} de ${datos.puntosRival.total} puntos del rival con detalle${sin ? ` (${sin} sin detalle)` : ''}.`, xI, yA - 10);
  }

  titulo(ctx, 'Para el partido', xD, yBase);
  let yP = yBase + 52;
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'left';
  ctx.font = `22px ${FUENTE}`;
  const puntos = [...datos.frases.slice(0, 1), ...datos.recomendaciones];
  if (puntos.length === 0) {
    ctx.fillStyle = GRIS;
    yP += parrafo(ctx, datos.hayDetalle ? 'Con lo anotado hasta ahora no se ve nada que destacar.' : 'Sin datos suficientes todavía para recomendar algo.', xD, yP, anchoD, 30);
  }
  for (const p of puntos) {
    const alto = alturaParrafo(ctx, p, anchoD - 34, 30);
    if (yP + alto > H - 110) break; // nunca se sale de la hoja
    ctx.fillStyle = ARENA;
    ctx.fillRect(xD, yP - 16, 14, 14);
    ctx.fillStyle = NAVY;
    parrafo(ctx, p, xD + 34, yP, anchoD - 34, 30);
    yP += alto + 14;
  }

  // Pie
  ctx.fillStyle = GRIS_CLARO;
  ctx.fillRect(M, H - 90, W - 2 * M, 2);
  ctx.fillStyle = GRIS;
  ctx.textAlign = 'left';
  ctx.font = `18px ${FUENTE}`;
  const aviso = datos.pocosDatos
    ? `Ojo: solo ${datos.puntosRival.conDetalle} puntos del rival con detalle (con ${MIN_PUNTOS_CON_DETALLE} o más es más confiable). Tómalo como referencia.`
    : 'Hecho con los partidos guardados en la tablet. Zonas: delanteras 4-3-2 y zagueras 5-6-1, mirando hacia la red.';
  parrafo(ctx, aviso, M, H - 55, W - 2 * M - 360, 24); // deja libre el lado derecho para la fecha
  ctx.textAlign = 'right';
  const f = datos.generado;
  ctx.fillText(`Roots · ${f.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}`, W - M, H - 55);
  return lienzo;
}

// ───────────── Salida: PDF ─────────────
function sanear(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

export function nombreBaseScouting(datos) {
  const f = datos.generado;
  const dos = (n) => String(n).padStart(2, '0');
  return `scouting-${sanear(datos.rival) || 'rival'}-${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
}

export async function prepararScouting(rival, opciones = {}) {
  const datos = datosScouting(rival, opciones);
  const logo = await cargarLogo();
  return { datos, canvas: dibujarScouting(datos, logo), nombre: nombreBaseScouting(datos) };
}

// A4 de verdad: 210 mm de ancho y 297 mm de alto (el lienzo tiene esa proporción).
export async function blobPdfScouting(reporte) {
  const jpeg = new Uint8Array(await (await aBlob(reporte.canvas, 'image/jpeg', 0.93)).arrayBuffer());
  return new Blob([construirPdfDeJpeg(jpeg, reporte.canvas.width, reporte.canvas.height, 210)], { type: 'application/pdf' });
}

export async function descargarScoutingPdf(reporte) {
  descargarBlob(await blobPdfScouting(reporte), `${reporte.nombre}.pdf`);
}

// Abre el menú de compartir del sistema (WhatsApp, correo, impresión de la tablet…) con el PDF.
export async function compartirScouting(reporte) {
  const archivo = new File([await blobPdfScouting(reporte)], `${reporte.nombre}.pdf`, { type: 'application/pdf' });
  await navigator.share({ files: [archivo], title: `Scouting de ${reporte.datos.rival}` });
}

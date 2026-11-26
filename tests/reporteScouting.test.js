import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/motor.js';
import { rivalesConHistorial } from '../js/historialRival.js';
import { normalizarNombre } from '../js/nuevoPartido.js';
import { MIN_PUNTOS_CON_DETALLE, blobPdfScouting, datosScouting, dibujarScouting, marcadoresPropios, nombreBaseScouting, recomendaciones } from '../js/reporteScouting.js';
import { crearContexto, estadoNuevo } from './ayuda.js';

const L = 'local';
const V = 'visitante';
const FECHA = new Date('2026-11-25T12:00:00');

// Partido ya jugado contra `rival`: `detalles` son los puntos del rival del primer set; `jugadas` son [jugadorId, fundamento, calificacion].
function partido({ id, rival = 'Águilas', ladoPropio = L, fecha = '2026-11-10', sets = [[25, 20]], detalles = [], jugadas = [] }) {
  const local = ladoPropio === L ? 'Roots' : rival;
  const visitante = ladoPropio === L ? rival : 'Roots';
  const est = estadoNuevo({ id, equipoLocal: local, equipoVisitante: visitante });
  const ctx = crearContexto();
  est.ladoPropio = ladoPropio;
  M.cambiarModoLibero(est, 'ninguno');
  [1, 2, 3, 4, 5, 6].forEach((j) => M.toggleJugador(est, ctx, j));
  M.confirmarPlantilla(est, ctx);
  M.elegirSaque(est, ladoPropio);
  const otro = ladoPropio === L ? V : L;
  detalles.forEach((d) => { M.sumarPunto(est, ctx, otro); M.detallarPuntoRival(est, d); });
  jugadas.forEach(([jid, fundamento, calificacion]) => M.registrarJugada(est, ctx, jid, fundamento, calificacion));
  const puntosSeq = [...est.actual.puntosSeq];
  const puntosInfo = [...est.actual.puntosInfo];
  const eventos = [...est.actual.eventos];
  est.sets = sets.map(([propios, contrario], i) => ({
    numeroSet: i + 1,
    puntosLocal: ladoPropio === L ? propios : contrario,
    puntosVisitante: ladoPropio === L ? contrario : propios,
    titulares: [], sustituciones: [],
    eventos: i === 0 ? eventos : [], puntosSeq: i === 0 ? puntosSeq : [], puntosInfo: i === 0 ? puntosInfo : [],
  }));
  est.actual = M.nuevoSetEnCurso();
  return { id, torneoId: 1, equipoLocal: local, equipoVisitante: visitante, fecha, hora: '09:00:00', est };
}

const rivalDe = (partidos, nombre = 'Águilas') => rivalesConHistorial(partidos, normalizarNombre).find((r) => r.nombre === nombre);
const ataque = (desde, hacia) => ({ motivo: 'ataque', desde, hacia });
const repetir = (n, x) => Array.from({ length: n }, () => ({ ...x }));
const rep = (n, c) => Array(n).fill(c);
const jugadasDe = (id, fundamento, califs) => califs.map((c) => [id, fundamento, c]);

// ───────────── datosScouting ─────────────

test('marcadoresPropios: nuestros puntos primero, seamos local o visitante', () => {
  assert.deepEqual(marcadoresPropios(partido({ id: 1, sets: [[25, 20], [18, 25]] }).est), ['25-20', '18-25']);
  assert.deepEqual(marcadoresPropios(partido({ id: 2, ladoPropio: V, sets: [[25, 20], [18, 25]] }).est), ['25-20', '18-25']);
});

test('récord, partidos recientes (más nuevo primero) y promedio por set', () => {
  const partidos = [
    partido({ id: 1, fecha: '2026-10-01', sets: [[25, 20], [25, 22]] }),
    partido({ id: 2, fecha: '2026-11-10', sets: [[20, 25], [18, 25]] }),
  ];
  const d = datosScouting(rivalDe(partidos), { fecha: FECHA });
  assert.equal(d.rival, 'Águilas');
  assert.equal(d.partidos, 2);
  assert.deepEqual([d.ganados, d.perdidos, d.empatados], [1, 1, 0]);
  assert.deepEqual(d.recientes.map((r) => r.resultado), ['P', 'G']); // el del 10 de noviembre primero
  assert.deepEqual(d.recientes[0].sets, ['20-25', '18-25']);
  assert.equal(d.puntosPorSet.sets, 4);
  assert.equal(d.puntosPorSet.propios, (25 + 25 + 20 + 18) / 4);
  assert.equal(d.puntosPorSet.rival, (20 + 22 + 25 + 25) / 4);
});

test('en la hoja caben 6 partidos: el resto se cuenta aparte', () => {
  const partidos = Array.from({ length: 8 }, (_, i) => partido({ id: i + 1, fecha: `2026-0${i + 1}-05` }));
  const d = datosScouting(rivalDe(partidos), { fecha: FECHA });
  assert.equal(d.recientes.length, 6);
  assert.equal(d.partidosOcultos, 2);
  assert.equal(d.partidos, 8);
});

test('rendimiento contra el rival: solo fundamentos con 5 jugadas o más', () => {
  const p = partido({ id: 1, jugadas: [...jugadasDe(2, 'Ataque', ['positivo', 'positivo', 'doble_positivo', 'negativo', 'error']), ...jugadasDe(3, 'Saque', ['positivo', 'error'])] });
  const d = datosScouting(rivalDe([p]), { fecha: FECHA });
  assert.deepEqual(d.rendimiento.map((f) => f.fundamento), ['Ataque']);
  assert.equal(d.rendimiento[0].total, 5);
  assert.equal(d.rendimiento[0].efectividad, 0.6);
  assert.equal(d.rendimiento[0].errores, 1);
});

test('cómo anota: motivos con porcentaje, mapa de calor y trayectorias', () => {
  const detalles = [...repetir(4, ataque(4, 1)), ataque(3, 6), { motivo: 'saque' }, { motivo: 'saque' }, { motivo: 'error' }, { motivo: 'bloqueo' }];
  const d = datosScouting(rivalDe([partido({ id: 1, detalles })]), { fecha: FECHA });
  assert.deepEqual(d.puntosRival, { total: 9, conDetalle: 9, sinDetalle: 0 });
  assert.deepEqual(d.motivos.map((m) => [m.id, m.n]), [['ataque', 5], ['saque', 2], ['bloqueo', 1], ['error', 1]]);
  assert.equal(d.motivos[0].pct, 5 / 9);
  assert.equal(d.mapa.desde[4], 4);
  assert.equal(d.mapa.hacia[1], 4);
  assert.equal(d.mapa.conOrigen, 5);
  assert.deepEqual(d.mapa.cruces[0], { desde: 4, hacia: 1, n: 4 });
  assert.equal(d.hayDetalle, true);
  assert.equal(d.pocosDatos, true); // 9 puntos con detalle: todavía son pocos
});

test('con 10 puntos con detalle o más ya no avisa que son pocos datos', () => {
  const d = datosScouting(rivalDe([partido({ id: 1, detalles: repetir(MIN_PUNTOS_CON_DETALLE, { motivo: 'saque' }) })]), { fecha: FECHA });
  assert.equal(d.pocosDatos, false);
});

test('sin detalle del rival: no inventa nada y lo dice', () => {
  const d = datosScouting(rivalDe([partido({ id: 1 })]), { fecha: FECHA });
  assert.equal(d.hayDetalle, false);
  assert.equal(d.pocosDatos, false);
  assert.equal(d.mapa.total, 0);
  assert.deepEqual(d.frases, []);
  assert.deepEqual(d.recomendaciones, []);
});

test('junta los partidos contra el mismo rival aunque el nombre cambie de tildes y mayúsculas', () => {
  const partidos = [partido({ id: 1, rival: 'Águilas', detalles: repetir(5, ataque(4, 1)) }), partido({ id: 2, rival: 'AGUILAS', fecha: '2026-11-20', detalles: repetir(5, ataque(4, 1)) })];
  const d = datosScouting(rivalesConHistorial(partidos, normalizarNombre)[0], { fecha: FECHA });
  assert.equal(d.partidos, 2);
  assert.equal(d.mapa.desde[4], 10);
});

// ───────────── recomendaciones ─────────────

const recosDe = (partidos) => { const r = rivalDe(partidos); return recomendaciones(r, datosScouting(r, { fecha: FECHA }).rendimiento); };

test('recomendaciones: con menos de 8 puntos con detalle no recomienda nada', () => {
  assert.deepEqual(recosDe([partido({ id: 1, detalles: repetir(7, ataque(4, 1)) })]), []);
});

test('recomendaciones: zona de caída, zona de salida y trayectoria repetidas', () => {
  const detalles = [...repetir(6, ataque(4, 1)), ataque(3, 6), ataque(2, 5), { motivo: 'saque' }];
  const reco = recosDe([partido({ id: 1, detalles })]);
  assert.match(reco[0], /Reforzar la defensa en la zona 1 de nuestra cancha: ahí cae el 75% de sus ataques \(6 de 8\)/);
  assert.match(reco[1], /Preparar el bloqueo para su zona 4: ataca desde ahí el 75% de las veces \(6 de 8\)/);
  assert.match(reco[2], /trayectoria más repetida va de su zona 4 a nuestra zona 1 \(6 veces\)/);
});

test('recomendaciones: saque directo, errores nuestros y bloqueo, solo si pesan', () => {
  const pocos = recosDe([partido({ id: 1, detalles: [...repetir(8, { motivo: 'ataque' }), { motivo: 'saque' }] })]);
  assert.equal(pocos.length, 0); // 1 de 9 saques directos, sin errores ni bloqueos: nada que destacar
  const detalles = [...repetir(3, { motivo: 'saque' }), ...repetir(4, { motivo: 'error' }), ...repetir(3, { motivo: 'bloqueo' }), { motivo: 'ataque' }];
  const reco = recosDe([partido({ id: 1, detalles })]).join(' | ');
  assert.match(reco, /saque directo nos hace daño \(3 de 11 puntos\)/);
  assert.match(reco, /El 36% de sus puntos son errores nuestros/);
  assert.match(reco, /Nos bloquean bastante \(3 de 11 puntos\)/);
});

test('recomendaciones: un fundamento nuestro por debajo del 40 % con 10 jugadas o más', () => {
  const jugadas = jugadasDe(2, 'Recepción', [...rep(3, 'positivo'), ...rep(7, 'negativo')]); // 30 %
  const reco = recosDe([partido({ id: 1, jugadas })]);
  assert.deepEqual(reco, ['Contra este rival nuestra recepción rinde 30% en 10 jugadas: trabajarla antes del partido.']);
  assert.deepEqual(recosDe([partido({ id: 2, jugadas: jugadasDe(2, 'Recepción', [...rep(3, 'positivo'), ...rep(2, 'negativo')]) })]), []); // solo 5 jugadas: no opina
});

test('recomendaciones: máximo 5', () => {
  const detalles = [...repetir(5, ataque(4, 1)), ...repetir(3, { motivo: 'saque' }), ...repetir(4, { motivo: 'error' }), ...repetir(3, { motivo: 'bloqueo' })];
  const jugadas = jugadasDe(2, 'Recepción', [...rep(3, 'positivo'), ...rep(7, 'negativo')]);
  assert.equal(recosDe([partido({ id: 1, detalles, jugadas })]).length, 5);
});

// ───────────── Dibujo y PDF ─────────────

// Canvas falso: guarda todo lo que se escribe y se pinta.
function canvasFalso(ancho, alto) {
  const textos = [];
  let rellenos = 0;
  const ctx = {
    font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: 'left',
    measureText: (t) => ({ width: String(t).length * (parseInt(ctx.font.match(/(\d+)px/)?.[1] ?? '10', 10) * 0.5) }),
    fillText: (t, x, y) => textos.push({ t: String(t), x, y }),
    fillRect: () => { rellenos += 1; }, fill: () => { rellenos += 1; }, stroke() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, save() {}, restore() {}, drawImage() {},
  };
  return { width: ancho, height: alto, getContext: () => ctx, textos, rellenos: () => rellenos };
}

test('la hoja es A4 (1240 x 1754) y lleva rival, récord, mapa y recomendaciones', () => {
  const detalles = [...repetir(6, ataque(4, 1)), ataque(3, 6), ataque(2, 5), { motivo: 'saque' }, { motivo: 'error' }];
  const d = datosScouting(rivalDe([partido({ id: 1, detalles, sets: [[25, 20], [22, 25]] })]), { fecha: FECHA });
  let lienzo;
  const canvas = dibujarScouting(d, null, (w, h) => (lienzo = canvasFalso(w, h)));
  assert.equal(canvas.width, 1240);
  assert.equal(canvas.height, 1754);
  assert.ok(Math.abs(1754 / 1240 - 297 / 210) < 0.001); // proporción A4
  const escrito = lienzo.textos.map((x) => x.t).join('\n');
  assert.match(escrito, /ÁGUILAS/);
  assert.match(escrito, /Roots vs Águilas · 1 partido · 0 ganados · 0 perdidos · 1 empatado/);
  assert.match(escrito, /Promedio por set: 23\.5 nuestros · 22\.5 del rival/);
  assert.match(escrito, /CANCHA DEL RIVAL/);
  assert.match(escrito, /NUESTRA CANCHA/);
  assert.match(escrito, /Reforzar la defensa en la zona 1/);
  assert.match(escrito, /25-20/);
  assert.match(escrito, /Ojo: solo 10 puntos del rival con detalle|Hecho con los partidos guardados/);
  assert.ok(lienzo.textos.every((x) => x.y > 0 && x.y < 1754), 'nada se dibuja fuera de la hoja');
});

test('la hoja sin ningún dato sale igual y explica qué falta', () => {
  const d = datosScouting(rivalDe([partido({ id: 1, sets: [] })]), { fecha: FECHA });
  let lienzo;
  dibujarScouting(d, null, (w, h) => (lienzo = canvasFalso(w, h)));
  const escrito = lienzo.textos.map((x) => x.t).join(' ');
  assert.match(escrito, /Todavía no hay ataques del rival con zonas anotadas/);
  assert.match(escrito, /Todavía no hay detalle de cómo anota este rival/);
  assert.match(escrito, /Sin datos suficientes todavía para recomendar algo/);
});

test('el nombre del archivo lleva el rival y la fecha, sin tildes ni espacios', () => {
  const d = datosScouting(rivalDe([partido({ id: 1, rival: 'Águilas del Norte' })], 'Águilas del Norte'), { fecha: new Date('2026-11-25T12:00:00') });
  assert.equal(nombreBaseScouting(d), 'scouting-aguilas-del-norte-2026-11-25');
});

test('el PDF es una página A4 válida', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const { construirPdfDeJpeg } = await import('../js/resumenCompartir.js');
  const pdf = new TextDecoder('latin1').decode(construirPdfDeJpeg(jpeg, 1240, 1754, 210));
  assert.match(pdf, /^%PDF-1\.4/);
  const [, ancho, alto] = pdf.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/).map(Number);
  assert.equal(ancho, 595.28); // A4: 210 mm
  assert.ok(Math.abs(alto - 841.89) < 0.5, `alto ${alto}`); // A4: 297 mm (la hoja se redondea a píxeles)
  assert.equal(typeof blobPdfScouting, 'function');
});

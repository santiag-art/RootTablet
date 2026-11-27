import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/motor.js';
import {
  MIN_ACCIONES, actuacionesDeRegistros, categoriasPresentes, filtrarActuaciones, fundamentosConJugadas, generosPresentes, gruposPresentes, metricasDeGrupo,
  rankingDeGrupo, resumirConteos, svgEvolucion, tendenciaDeJugadora, textoCalidad, textoCambio, torneosOrdenados, totalesDeGrupo, unidadesDeEvolucion, METRICAS,
} from '../js/ranking.js';
import { crearContexto, estadoNuevo, JUGADORAS } from './ayuda.js';

const jugadoras = new Map(JUGADORAS.map((j) => [j.id, { ...j }]));

// Un partido guardado: Roots local, plantilla 1-6 + líbero 7, `posiciones` cambia la posición de alguien en ese partido,
// `jugadas` = [[jugadora, fundamento, calificacion, cuántas veces], ...] y `sets` = [[nuestros, rival], ...].
function partido({ id, torneoId = 1, fecha, hora = '09:00:00', rival = 'Rival', posiciones = {}, jugadas = [], sets = [[25, 20]] }) {
  const est = estadoNuevo({ id, torneoId, equipoLocal: 'Roots', equipoVisitante: rival, fecha });
  const ctx = crearContexto();
  M.cambiarModoLibero(est, 'uno');
  [1, 2, 3, 4, 5, 6].forEach((j) => M.toggleJugador(est, ctx, j, { posicion: posiciones[j] ?? null }));
  M.elegirLibero(est, ctx, 7, 'unico');
  M.confirmarPlantilla(est, ctx);
  M.elegirSaque(est, 'local');
  for (const [j, f, c, veces = 1] of jugadas) for (let i = 0; i < veces; i += 1) M.registrarJugada(est, ctx, j, f, c);
  if (sets.length) {
    est.sets = sets.map(([propios, otro], i) => ({ numeroSet: i + 1, puntosLocal: propios, puntosVisitante: otro, titulares: est.actual.titulares, sustituciones: [], eventos: i === 0 ? est.actual.eventos : [], puntosSeq: [], puntosInfo: [] }));
    est.actual = M.nuevoSetEnCurso();
  }
  return { id, torneoId, equipoLocal: 'Roots', equipoVisitante: rival, fecha, hora, est };
}

const torneosMapa = new Map([
  [1, { id: 1, nombre: 'Copa Pereira', genero: 'femenino', fechaInicio: '2026-03-01' }],
  [2, { id: 2, nombre: 'Liga <Cafetera>', genero: 'femenino', fechaInicio: '2026-06-01' }],
]);

test('resumirConteos: efectividad, eficiencia y calidad como en Roots', () => {
  const f = resumirConteos({ doble_positivo: 2, positivo: 3, negativo: 1, error: 1 });
  assert.deepEqual([f.acciones, f.efectividadPct, f.directosPct, f.eficienciaPct, f.calidadMedia], [7, 71, 29, 14, 1.86]);
  const sin = resumirConteos();
  assert.deepEqual([sin.acciones, sin.efectividadPct, sin.eficienciaPct, sin.calidadMedia], [0, null, null, null]);
  assert.equal(textoCalidad(1.86), '1,86');
  assert.equal(textoCambio(5), '▲5');
  assert.equal(textoCambio(-3), '▼3');
  assert.equal(textoCambio(0), '');
  assert.equal(textoCambio(-0.5, true), '▼0,50');
});

test('actuaciones: la posición del partido manda y cada posición solo cuenta sus fundamentos', () => {
  const regs = [
    partido({ id: 1, fecha: '2026-03-02', jugadas: [[2, 'Ataque', 'doble_positivo', 3], [2, 'Recepción', 'positivo', 2], [7, 'Recepción', 'doble_positivo', 4], [7, 'Defensa', 'error']] }),
    partido({ id: 2, fecha: '2026-03-03', posiciones: { 2: 'Central' }, jugadas: [[2, 'Bloqueo', 'doble_positivo', 2]] }),
  ];
  // Una jugada que no corresponde a la posición (llegó de un archivo viejo o de una ficha cambiada) no cuenta: al líbero no se le cuenta un ataque.
  regs[0].est.sets[0].eventos.push({ id: 99, jugadorId: 7, fundamento: 'Ataque', calificacion: 'doble_positivo' });
  const acts = actuacionesDeRegistros(regs, jugadoras);
  const de = (partidoId, jugadorId) => acts.find((a) => a.partidoId === partidoId && a.jugadorId === jugadorId);
  assert.equal(de(1, 2).grupo, 'atacante');
  assert.equal(de(2, 2).grupo, 'central'); // la misma jugadora, otra posición ese día
  assert.equal(de(1, 7).grupo, 'libero');
  assert.equal(de(1, 7).conteos.Ataque, undefined);
  assert.equal(de(1, 7).conteos.Recepción.doble_positivo, 4);
  assert.deepEqual(gruposPresentes(acts).map((g) => [g.clave, g.jugadoras]), [['atacante', 1], ['libero', 1], ['central', 1]]);
});

test('ranking: ordena por efectividad, deja aparte a quien tiene pocas jugadas y muestra la tendencia', () => {
  const regs = [
    // Torneo 1: Bea (2) 4 de 5 en ataque; Eli (5) 2 de 5
    partido({ id: 1, torneoId: 1, fecha: '2026-03-02', jugadas: [[2, 'Ataque', 'doble_positivo', 2], [2, 'Ataque', 'positivo', 2], [2, 'Ataque', 'error'], [5, 'Ataque', 'positivo', 2], [5, 'Ataque', 'error', 3], [3, 'Ataque', 'doble_positivo', 3]] }),
    // Torneo 2: Bea mejora a 5 de 5; Eli empeora a 1 de 5
    partido({ id: 2, torneoId: 2, fecha: '2026-06-02', jugadas: [[2, 'Ataque', 'doble_positivo', 5], [5, 'Ataque', 'positivo'], [5, 'Ataque', 'error', 4]] }),
  ];
  const acts = actuacionesDeRegistros(regs, jugadoras);
  const orden = torneosOrdenados(regs, torneosMapa).map((t) => t.id);
  assert.deepEqual(orden, [1, 2]);

  const todo = rankingDeGrupo(acts, 'atacante', METRICAS.Ataque, { ordenTorneos: orden });
  assert.deepEqual(todo.ranking.map((r) => r.jugadorId), [2, 5]); // Bea 9 de 10 (90 %), Eli 3 de 10 (30 %)
  assert.equal(todo.ranking[0].f.efectividadPct, 90);
  assert.equal(todo.ranking[0].partidos, 2);
  assert.equal(todo.pocas.length, 0);
  assert.equal(todo.ranking[0].tendencia.diferencia, 20); // 80 % → 100 %
  assert.equal(todo.ranking[1].tendencia.diferencia, -20); // Eli: 2 de 5 (40 %) → 1 de 5 (20 %)
  assert.equal(todo.ranking[0].tendencia.previoId, 1);

  // Un torneo elegido: el ranking sale solo de ese torneo y la tendencia compara con el anterior; en el primero no hay con qué.
  const dos = rankingDeGrupo(acts, 'atacante', METRICAS.Ataque, { torneoId: 2, ordenTorneos: orden });
  assert.deepEqual(dos.ranking.map((r) => r.f.efectividadPct), [100, 20]);
  assert.equal(dos.ranking[0].tendencia.diferencia, 20);
  const uno = rankingDeGrupo(acts, 'atacante', METRICAS.Ataque, { torneoId: 1, ordenTorneos: orden });
  assert.equal(uno.ranking[0].tendencia, null);

  // Eficiencia: (directos − errores) ÷ jugadas
  const efi = rankingDeGrupo(acts, 'atacante', METRICAS.AtaqueEficiencia, { ordenTorneos: orden });
  assert.deepEqual(efi.ranking.map((r) => [r.jugadorId, r.f.eficienciaPct]), [[2, 60], [5, -70]]);

  // La central (3) solo tiene 3 ataques: no entra al ranking, queda «con pocas jugadas».
  const cen = rankingDeGrupo(acts, 'central', METRICAS.Ataque, { ordenTorneos: orden });
  assert.deepEqual([cen.ranking.length, cen.pocas.map((r) => r.jugadorId)], [0, [3]]);
  assert.equal(MIN_ACCIONES, 5);
});

test('ranking de saques directos: por cantidad, y sin directos quedan aparte', () => {
  const regs = [partido({ id: 1, fecha: '2026-03-02', jugadas: [[2, 'Saque', 'doble_positivo', 2], [2, 'Saque', 'error', 3], [5, 'Saque', 'doble_positivo', 4], [1, 'Saque', 'positivo', 5]] })];
  const acts = actuacionesDeRegistros(regs, jugadoras);
  const r = rankingDeGrupo(acts, 'atacante', METRICAS.Saque);
  assert.deepEqual(r.ranking.map((x) => [x.jugadorId, x.f.directos]), [[5, 4], [2, 2]]);
  const col = rankingDeGrupo(acts, 'colocacion', METRICAS.Saque);
  assert.deepEqual([col.ranking.length, col.pocas.map((x) => x.jugadorId)], [0, [1]]);
});

test('calidad de recepción en la escala 0–3 y recepción + defensa del líbero', () => {
  const regs = [partido({ id: 1, fecha: '2026-03-02', jugadas: [[7, 'Recepción', 'doble_positivo', 3], [7, 'Recepción', 'negativo', 2], [7, 'Defensa', 'error', 2], [2, 'Recepción', 'positivo', 5]] })];
  const acts = actuacionesDeRegistros(regs, jugadoras);
  const lib = rankingDeGrupo(acts, 'libero', METRICAS.RecepcionCalidad);
  assert.equal(lib.ranking[0].f.calidadMedia, 2.2); // (3+3+3+1+1) / 5
  const comb = rankingDeGrupo(acts, 'libero', METRICAS.RecepcionDefensa);
  assert.equal(comb.ranking[0].f.acciones, 7); // 5 recepciones + 2 defensas
  assert.equal(comb.ranking[0].f.efectividadPct, 43);
  assert.deepEqual(metricasDeGrupo('libero').map((m) => m.key), ['RecepcionDefensa', 'RecepcionCalidad', 'Recepción', 'Defensa']);
  assert.deepEqual(metricasDeGrupo('atacante').map((m) => m.key), ['Bloqueo', 'AtaqueEficiencia', 'Ataque', 'RecepcionCalidad', 'Recepción', 'Defensa', 'Saque']);
  assert.equal(totalesDeGrupo(acts, 'libero').length, 2);
});

test('filtros: género y categoría', () => {
  const con = new Map([...jugadoras].map(([id, j]) => [id, { ...j, categoria: id === 5 ? 'mini' : 'libre', genero: id === 4 ? 'masculino' : 'femenino' }]));
  const regs = [partido({ id: 1, fecha: '2026-03-02', jugadas: [[2, 'Ataque', 'positivo'], [5, 'Ataque', 'positivo'], [4, 'Ataque', 'positivo']] })];
  const acts = actuacionesDeRegistros(regs, con);
  assert.deepEqual(generosPresentes(acts, con), ['femenino', 'masculino']);
  assert.deepEqual(categoriasPresentes(acts, con, ['mini', 'infantil', 'libre']), ['mini', 'libre']);
  assert.deepEqual(filtrarActuaciones(acts, con, { genero: 'femenino', categoria: 'mini' }).map((a) => a.jugadorId), [5]);
  assert.equal(filtrarActuaciones(acts, con, {}).length, 3);
});

test('evolución del equipo: por torneo con ganados, perdidos y sets, y por partido en orden', () => {
  const regs = [
    partido({ id: 1, torneoId: 1, fecha: '2026-03-02', rival: 'Halcones', sets: [[25, 20], [25, 18]], jugadas: [[2, 'Ataque', 'positivo', 4], [2, 'Ataque', 'error', 1], [7, 'Recepción', 'doble_positivo', 3]] }),
    partido({ id: 2, torneoId: 1, fecha: '2026-03-03', rival: 'Titanes', sets: [[20, 25], [18, 25]], jugadas: [[2, 'Ataque', 'error', 2]] }),
    partido({ id: 3, torneoId: 2, fecha: '2026-06-02', rival: 'Halcones', sets: [[25, 10], [25, 10]], jugadas: [[2, 'Ataque', 'doble_positivo', 5]] }),
    partido({ id: 4, torneoId: 2, fecha: '2026-06-03', rival: 'Sin jugadas', sets: [[25, 10]] }),
  ];
  const acts = actuacionesDeRegistros(regs, jugadoras);
  const torneos = torneosOrdenados(regs, torneosMapa);
  const porTorneo = unidadesDeEvolucion(acts, { modo: 'torneo', torneos });
  assert.deepEqual(porTorneo.map((u) => u.etiqueta), ['Copa Pereira', 'Liga <Cafetera>']);
  assert.deepEqual(porTorneo[0].resumen, { ganados: 1, perdidos: 1, setsGanados: 2, setsPerdidos: 2 });
  assert.equal(porTorneo[0].detalle, '1G-1P');
  assert.equal(porTorneo[0].fundamentos.Ataque.efectividadPct, 57); // 4 de 7
  assert.equal(porTorneo[1].fundamentos.Ataque.efectividadPct, 100);
  assert.equal(porTorneo[1].partidos, 1); // el partido sin jugadas no cuenta
  assert.deepEqual(fundamentosConJugadas(porTorneo), ['Ataque', 'Recepción']);

  const porPartido = unidadesDeEvolucion(acts, { modo: 'partido', torneos });
  assert.deepEqual(porPartido.map((u) => [u.etiqueta, u.detalle, u.resultado]), [['2026-03-02', 'vs Halcones', 'ganado'], ['2026-03-03', 'vs Titanes', 'perdido'], ['2026-06-02', 'vs Halcones', 'ganado']]);

  // De una sola jugadora: sin ganados/perdidos, y solo sus jugadas.
  const bea = unidadesDeEvolucion(acts, { modo: 'torneo', torneos, jugadorId: 2 });
  assert.equal(bea[0].resumen, null);
  assert.equal(bea[0].detalle, '2 partidos');
  assert.deepEqual(fundamentosConJugadas(bea), ['Ataque']);
  assert.equal(unidadesDeEvolucion(acts, { modo: 'torneo', torneos, jugadorId: 99 }).length, 0);
});

test('tendencia: necesita dos torneos con jugadas suficientes', () => {
  const regs = [
    partido({ id: 1, torneoId: 1, fecha: '2026-03-02', jugadas: [[2, 'Ataque', 'positivo', 2]] }), // 2 jugadas: no alcanza
    partido({ id: 2, torneoId: 2, fecha: '2026-06-02', jugadas: [[2, 'Ataque', 'positivo', 6]] }),
  ];
  const acts = actuacionesDeRegistros(regs, jugadoras);
  assert.equal(tendenciaDeJugadora(acts, METRICAS.Ataque, [1, 2]), null);
});

test('gráfica: escapa los nombres, corta la línea donde no hay dato y dibuja un punto suelto', () => {
  const svg = svgEvolucion({ etiquetas: ['Liga <Cafetera>', 'B', 'C'], series: [{ clase: 'ev-s0', valores: [10, null, 90] }, { clase: 'ev-s1', valores: [50, 60, 70] }] });
  assert.match(svg, /^<svg /);
  assert.doesNotMatch(svg, /<Cafetera>|<script/);
  assert.match(svg, /Liga &lt;Cafetera&gt;/);
  assert.equal((svg.match(/<polyline/g) ?? []).length, 1); // la serie con hueco no dibuja línea: son dos puntos sueltos
  assert.equal((svg.match(/<circle/g) ?? []).length, 5);
  const uno = svgEvolucion({ etiquetas: ['Único'], series: [{ clase: 'ev-s0', valores: [40] }] });
  assert.equal((uno.match(/<polyline/g) ?? []).length, 0);
  assert.equal((uno.match(/<circle/g) ?? []).length, 1);
  assert.equal(svgEvolucion({ etiquetas: [], series: [] }), '');
  // con muchas unidades no rotula todas
  const muchas = svgEvolucion({ etiquetas: Array.from({ length: 20 }, (_, i) => `T${i}`), series: [{ clase: 'ev-s0', valores: Array(20).fill(50) }] });
  assert.ok((muchas.match(/text-anchor="middle"/g) ?? []).length <= 9);
  assert.match(muchas, /T19/);
});

// ── MVP del torneo (js/mvp.js) ──
import { mvpDeActuaciones, puntosDeImpactoDeConteos } from '../js/mvp.js';
import { puntosDeImpacto } from '../js/resumenCompartir.js';

test('MVP del torneo: suma los puntos de impacto de todos los partidos y el tope de colocación va partido a partido', () => {
  const act = (partidoId, jugadorId, grupo, conteos, torneoId = 1) => ({ partidoId, torneoId, fecha: '', hora: '', jugadorId, grupo, conteos });
  const d = (n) => ({ doble_positivo: n, positivo: 0, negativo: 0, error: 0 });
  const acts = [
    act(1, 1, 'ataque', { Ataque: d(5) }),
    act(2, 1, 'ataque', { Ataque: d(4) }),
    act(1, 2, 'colocacion', { Colocación: d(12) }),
    act(2, 2, 'colocacion', { Colocación: d(12) }),
    act(1, 3, 'libero', { Recepción: d(7) }), // 7 jugadas: no llega al mínimo de la líbero (8)
    act(3, 1, 'ataque', { Ataque: d(9) }, 2), // otro torneo
  ];
  const t1 = mvpDeActuaciones(acts, { torneoId: 1 });
  assert.deepEqual(t1.map((f) => [f.jugadorId, f.puntos, f.partidos, f.puesto]), [[1, 9, 2, 1], [2, 5, 2, 2]]);
  assert.equal(t1[0].promedio, 4.5);
  assert.equal(t1[0].mejorPartido.partidoId, 1);
  assert.equal(mvpDeActuaciones(acts, { torneoId: null })[0].puntos, 18); // todos los torneos
  assert.deepEqual(mvpDeActuaciones(acts, { torneoId: 1, grupo: 'colocacion' }).map((f) => f.jugadorId), [2]);
});

test('MVP del torneo usa la misma fórmula que el MVP de un partido', () => {
  const jugadas = [
    ...Array(3).fill({ fundamento: 'Ataque', calificacion: 'doble_positivo' }),
    ...Array(4).fill({ fundamento: 'Recepción', calificacion: 'doble_positivo' }),
    ...Array(2).fill({ fundamento: 'Defensa', calificacion: 'positivo' }),
    { fundamento: 'Saque', calificacion: 'error' },
    ...Array(14).fill({ fundamento: 'Colocación', calificacion: 'doble_positivo' }),
  ];
  const conteos = {};
  for (const e of jugadas) (conteos[e.fundamento] ??= { doble_positivo: 0, positivo: 0, negativo: 0, error: 0 })[e.calificacion] += 1;
  assert.equal(puntosDeImpactoDeConteos(conteos).puntos, puntosDeImpacto(jugadas).puntos);
  assert.equal(puntosDeImpactoDeConteos(conteos, { directo: 2 }).puntos, puntosDeImpactoDeConteos(conteos).puntos + 3);
});

test('MVP por posición: la armadora y la líbero tienen su propio premio, con los fundamentos de su posición', () => {
  const act = (partidoId, jugadorId, grupo, conteos) => ({ partidoId, torneoId: 1, fecha: '', hora: '', jugadorId, grupo, conteos });
  const d = (n) => ({ doble_positivo: n, positivo: 0, negativo: 0, error: 0 });
  const acts = [act(1, 1, 'colocacion', { Colocación: d(8) }), act(1, 2, 'libero', { Recepción: d(9) }), act(1, 3, 'atacante', { Ataque: d(6) })];
  assert.deepEqual(mvpDeActuaciones(acts, { grupo: 'colocacion' }).map((f) => [f.jugadorId, f.puntos]), [[1, 2]]);
  assert.deepEqual(mvpDeActuaciones(acts, { grupo: 'libero' }).map((f) => [f.jugadorId, f.puntos]), [[2, 2.97]]);
  assert.deepEqual(mvpDeActuaciones(acts).map((f) => f.jugadorId), [3, 2, 1]); // sin filtro compiten todas
});

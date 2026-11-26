import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/motor.js';
import { archivarPartidos, filasDeHistorial, historialParaRanking, resumenParaArchivo } from '../js/historial.js';
import { actuacionesDeRegistros, rankingDeGrupo, torneosOrdenados, unidadesDeEvolucion, METRICAS } from '../js/ranking.js';
import { construirCopia, restaurarCopia } from '../js/copia.js';
import { crearAlmacen, crearRespaldoMemoria } from '../js/store.js';
import { crearContexto, estadoNuevo, JUGADORAS } from './ayuda.js';

const jugadoras = new Map(JUGADORAS.map((j) => [j.id, j]));

function partido(id, torneoId, fecha, ataques) {
  const est = estadoNuevo({ id, torneoId, equipoLocal: 'Roots', equipoVisitante: 'Halcones', fecha });
  const ctx = crearContexto();
  M.cambiarModoLibero(est, 'ninguno');
  [1, 2, 3, 4, 5, 6].forEach((j) => M.toggleJugador(est, ctx, j));
  M.confirmarPlantilla(est, ctx);
  M.elegirSaque(est, 'local');
  ataques.forEach((c) => M.registrarJugada(est, ctx, 2, 'Ataque', c));
  est.sets = [{ numeroSet: 1, puntosLocal: 25, puntosVisitante: 20, titulares: [], sustituciones: [], eventos: est.actual.eventos, puntosSeq: [], puntosInfo: [] }];
  est.actual = M.nuevoSetEnCurso();
  return { id, torneoId, equipoLocal: 'Roots', equipoVisitante: 'Halcones', fecha, hora: '09:00:00', est };
}
const torneos = new Map([[1, { id: 1, nombre: 'Copa', fechaInicio: '2026-03-01' }], [2, { id: 2, nombre: 'Liga', fechaInicio: '2026-06-01' }]]);

test('el resumen archivado conserva marcador, rival y jugadas; un partido vacío no se archiva', () => {
  const r = partido(1, 1, '2026-03-02', ['positivo', 'positivo', 'error', 'doble_positivo', 'positivo']);
  const f = resumenParaArchivo(r, jugadoras);
  assert.equal(f.clave, 'historial-1');
  assert.deepEqual([f.rival, f.sets], ['Halcones', [[25, 20]]]);
  assert.equal(f.actuaciones[0].conteos.Ataque.positivo, 3);
  const vacio = { id: 2, torneoId: 1, equipoLocal: 'Roots', equipoVisitante: 'X', est: estadoNuevo({ id: 2 }) };
  assert.equal(resumenParaArchivo(vacio, jugadoras), null);
});

test('al quitar un partido exportado, el ranking y la evolución siguen contándolo', async () => {
  const viejo = partido(1, 1, '2026-03-02', ['positivo', 'positivo', 'positivo', 'positivo', 'error']); // 80 %
  const nuevo = partido(2, 2, '2026-06-02', ['positivo', 'error', 'error', 'error', 'error']); // 20 %
  const almacen = crearAlmacen(crearRespaldoMemoria());
  await archivarPartidos(almacen, [viejo], jugadoras); // se exportó y se quitó de la tablet
  await almacen.pendientes();
  const archivo = historialParaRanking(filasDeHistorial(await almacen.todos('meta')), new Set([2]));
  const registros = [nuevo, ...archivo.registros];
  const acts = [...actuacionesDeRegistros([nuevo], jugadoras), ...archivo.actuaciones];
  const orden = torneosOrdenados(registros, torneos);
  assert.deepEqual(orden.map((t) => t.nombre), ['Copa', 'Liga']);
  const r = rankingDeGrupo(acts, 'atacante', METRICAS.Ataque, { ordenTorneos: orden.map((t) => t.id) });
  assert.equal(r.ranking[0].f.acciones, 10);
  assert.equal(r.ranking[0].tendencia.diferencia, -60); // 80 % → 20 %
  const u = unidadesDeEvolucion(acts, { modo: 'torneo', torneos: orden });
  assert.deepEqual(u.map((x) => x.detalle), ['1G-0P', '1G-0P']); // el marcador archivado también cuenta
  assert.equal(unidadesDeEvolucion(acts, { modo: 'partido', torneos: orden })[0].detalle, 'vs Halcones');
});

test('si el partido vuelve a la tablet, no se cuenta dos veces', () => {
  const f = resumenParaArchivo(partido(1, 1, '2026-03-02', ['positivo']), jugadoras);
  assert.equal(historialParaRanking([f], new Set([1])).actuaciones.length, 0);
  assert.equal(historialParaRanking([f], new Set()).actuaciones.length, 1);
});

test('el historial viaja en la copia de seguridad y se restaura', async () => {
  const a = crearAlmacen(crearRespaldoMemoria());
  await archivarPartidos(a, [partido(1, 1, '2026-03-02', ['positivo'])], jugadoras);
  await a.pendientes();
  const copia = await construirCopia(a);
  assert.equal(copia.historial.length, 1);
  const b = crearAlmacen(crearRespaldoMemoria());
  await restaurarCopia(b, JSON.parse(JSON.stringify(copia)));
  assert.equal(filasDeHistorial(await b.todos('meta')).length, 1);
});

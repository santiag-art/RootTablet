import test from 'node:test';
import assert from 'node:assert/strict';
import { leerResultadosExportados, marcarResultadosExportados, pendientesDeCierre, textoFalta } from '../js/recordatorio.js';
import { crearAlmacen, crearRespaldoMemoria } from '../js/store.js';
import { estadoNuevo } from './ayuda.js';

const set = (n) => ({ numeroSet: n, puntosLocal: 25, puntosVisitante: 20, titulares: [], sustituciones: [], eventos: [], puntosSeq: [], puntosInfo: [] });
function reg(id, { sets = 2, actualizadoEn = '2026-11-25T10:00:00.000Z', finalizado = false } = {}) {
  const est = estadoNuevo({ id, formatoSets: 'mejor_de_3' });
  est.sets = Array.from({ length: sets }, (_, i) => set(i + 1));
  est.finalizado = finalizado;
  est.actualizadoEn = actualizadoEn;
  return { id, est };
}

test('solo cuentan los partidos terminados con sets guardados', () => {
  const regs = [reg(1), reg(2, { sets: 1 }), reg(3, { sets: 1, finalizado: true }), reg(4, { sets: 0, finalizado: true })];
  assert.deepEqual(pendientesDeCierre(regs).map((p) => p.registro.id), [1, 3]); // el 2 sigue en juego; el 4 no tiene sets
});

test('falta lo que no salió, y lo que cambió después de salir', () => {
  const r = reg(1, { actualizadoEn: '2026-11-25T10:00:00.000Z' });
  const bien = { ultimaCopia: '2026-11-25T11:00:00.000Z', resultadosEn: new Map([[1, '2026-11-25T11:00:00.000Z']]) };
  assert.deepEqual(pendientesDeCierre([r], bien), []);
  assert.deepEqual(pendientesDeCierre([r], { ...bien, ultimaCopia: null }).map((p) => [p.sinResultados, p.sinCopia]), [[false, true]]);
  assert.deepEqual(pendientesDeCierre([r], { ...bien, resultadosEn: new Map() }).map((p) => [p.sinResultados, p.sinCopia]), [[true, false]]);
  r.est.actualizadoEn = '2026-11-25T12:00:00.000Z'; // se corrigió algo después
  assert.deepEqual(pendientesDeCierre([r], bien).map((p) => [p.sinResultados, p.sinCopia]), [[true, true]]);
});

test('textos de lo que falta', () => {
  assert.equal(textoFalta({ sinResultados: true, sinCopia: true }), 'exportar los resultados y guardar la copia');
  assert.equal(textoFalta({ sinResultados: true, sinCopia: false }), 'exportar los resultados');
  assert.equal(textoFalta({ sinResultados: false, sinCopia: true }), 'guardar la copia');
});

test('las exportaciones se guardan en la tabla meta y se vuelven a leer', async () => {
  const almacen = crearAlmacen(crearRespaldoMemoria());
  await almacen.guardar('meta', { clave: 'ultimaCopia', fecha: 'x' });
  await marcarResultadosExportados(almacen, [7, 9], '2026-11-25T11:00:00.000Z');
  await almacen.pendientes();
  const mapa = leerResultadosExportados(await almacen.todos('meta'));
  assert.deepEqual([...mapa], [[7, '2026-11-25T11:00:00.000Z'], [9, '2026-11-25T11:00:00.000Z']]);
});

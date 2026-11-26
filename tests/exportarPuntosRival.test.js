import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/motor.js';
import { construirResultados, puntosRivalDeSet, resultadoDePartido } from '../js/exportar.js';
import { crearContexto, estadoNuevo } from './ayuda.js';

const L = 'local'; // Roots
const V = 'visitante'; // rival

function partidoListo() {
  const est = estadoNuevo();
  const ctx = crearContexto();
  M.cambiarModoLibero(est, 'ninguno');
  [1, 2, 3, 4, 5, 6].forEach((id) => M.toggleJugador(est, ctx, id));
  M.confirmarPlantilla(est, ctx);
  M.elegirSaque(est, L);
  return { est, ctx };
}

const registroDe = (est) => ({ id: 10, torneoId: 1, equipoLocal: 'Roots', equipoVisitante: 'Rivales', fecha: '2026-11-22', hora: '09:00:00', est });

// Puntos del set, en este orden: L, V(ataque 4→1), V(sin detalle), L, V(saque), V(error), V(ataque sin zonas), V(bloqueo)
function jugarSet(est, ctx) {
  M.sumarPunto(est, ctx, L); // 1
  M.sumarPunto(est, ctx, V); // 2
  M.detallarPuntoRival(est, { motivo: 'ataque', desde: 4, hacia: 1 });
  M.sumarPunto(est, ctx, V); // 3 (sin detalle)
  M.sumarPunto(est, ctx, L); // 4
  M.sumarPunto(est, ctx, V); // 5
  M.detallarPuntoRival(est, { motivo: 'saque' });
  M.sumarPunto(est, ctx, V); // 6
  M.detallarPuntoRival(est, { motivo: 'error' });
  M.sumarPunto(est, ctx, V); // 7
  M.detallarPuntoRival(est, { motivo: 'ataque' });
  M.sumarPunto(est, ctx, V); // 8
  M.detallarPuntoRival(est, { motivo: 'bloqueo' });
}

test('exportar: cada set lleva cómo anotó el rival, con el lugar del punto dentro del set', () => {
  const { est, ctx } = partidoListo();
  jugarSet(est, ctx);
  while (est.actual.puntosLocal < 25) M.sumarPunto(est, ctx, L);
  M.guardarSet(est, ctx, est.actual.puntosLocal, est.actual.puntosVisitante);
  const p = resultadoDePartido(registroDe(est));
  assert.deepEqual(p.sets[0].puntosRival, [
    { orden: 2, motivo: 'ataque', desde: 4, hacia: 1 },
    { orden: 5, motivo: 'saque' },
    { orden: 6, motivo: 'error' },
    { orden: 7, motivo: 'ataque' },
    { orden: 8, motivo: 'bloqueo' },
  ]);
  // el orden apunta al punto correcto: el del lugar 2 fue del rival
  assert.equal(est.sets[0].puntosSeq[2 - 1], V);
  assert.equal(p.puntosRivalSinSet, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
});

test('exportar: un set sin ningún detalle viaja como siempre, sin el campo', () => {
  const { est, ctx } = partidoListo();
  M.sumarPunto(est, ctx, V);
  while (est.actual.puntosLocal < 25) M.sumarPunto(est, ctx, L);
  M.guardarSet(est, ctx, est.actual.puntosLocal, est.actual.puntosVisitante);
  const p = resultadoDePartido(registroDe(est));
  assert.equal('puntosRival' in p.sets[0], false);
});

test('exportar: lo del set que no se cerró viaja aparte y no se pierde', () => {
  const { est, ctx } = partidoListo();
  setCerrado(est, ctx);
  M.confirmarPlantilla(est, ctx);
  M.sumarPunto(est, ctx, V);
  M.detallarPuntoRival(est, { motivo: 'ataque', desde: 2, hacia: 5 });
  const p = resultadoDePartido(registroDe(est));
  assert.deepEqual(p.puntosRivalSinSet, [{ orden: 1, motivo: 'ataque', desde: 2, hacia: 5 }]);
  assert.equal('puntosRival' in p.sets[0], false);
});

function setCerrado(est, ctx) {
  while (est.actual.puntosLocal < 25) M.sumarPunto(est, ctx, L);
  M.guardarSet(est, ctx, est.actual.puntosLocal, est.actual.puntosVisitante);
}

test('puntosRivalDeSet: ignora detalles dañados y sets de versiones anteriores sin puntosInfo', () => {
  assert.deepEqual(puntosRivalDeSet({}), []);
  assert.deepEqual(puntosRivalDeSet(null), []);
  const set = {
    puntosSeq: [V, V, V, L],
    puntosInfo: [{ detalle: { motivo: 'inventado' } }, { detalle: { motivo: 'saque', desde: 4 } }, {}, { detalle: { motivo: 'ataque' } }],
  };
  assert.deepEqual(puntosRivalDeSet(set), [{ orden: 2, motivo: 'saque' }, { orden: 4, motivo: 'ataque' }]);
});

test('construirResultados lleva el detalle de varios sets y mantiene el resto del archivo', () => {
  const { est, ctx } = partidoListo();
  jugarSet(est, ctx);
  setCerrado(est, ctx);
  M.confirmarPlantilla(est, ctx);
  M.sumarPunto(est, ctx, V);
  M.detallarPuntoRival(est, { motivo: 'bloqueo' });
  setCerrado(est, ctx);
  const res = construirResultados({ registros: [registroDe(est)], ids: [10], ahora: new Date('2026-11-22T15:30:00Z') });
  const sets = res.partidos[0].sets;
  assert.equal(sets.length, 2);
  assert.equal(sets[0].puntosRival.length, 5);
  assert.deepEqual(sets[1].puntosRival, [{ orden: 1, motivo: 'bloqueo' }]);
  assert.equal(res.aplicacion, 'roots-tablet-resultados');
  assert.equal(res.version, 1); // el formato sigue siendo la versión 1: Roots viejo lo ignora sin problema
});

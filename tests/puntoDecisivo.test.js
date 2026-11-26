import test from 'node:test';
import assert from 'node:assert/strict';
import { guardarVibracionActivada, patronDeVibracion, puntoDecisivo, vibracionActivada, vibrar } from '../js/puntoDecisivo.js';

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

// Mejor de 3 (2 sets para ganar) salvo que se diga otra cosa.
const sit = (numeroSet, puntosLocal, puntosVisitante, { setsLocal = 0, setsVisitante = 0, totalSets = 3 } = {}) =>
  puntoDecisivo({ numeroSet, totalSets, setsParaGanar: totalSets === 5 ? 3 : 2, puntosLocal, puntosVisitante, setsLocal, setsVisitante });

test('punto de set: llega al mínimo con un punto más y saca 2 de diferencia', () => {
  assert.deepEqual(sit(1, 24, 20), { tipo: 'set', lado: 'local' });
  assert.deepEqual(sit(1, 20, 24), { tipo: 'set', lado: 'visitante' });
  assert.deepEqual(sit(1, 24, 23), { tipo: 'set', lado: 'local' }); // 25-23 cierra
});

test('en 24-24 no hay punto de set, pero en 25-24 sí (hay que sacar 2)', () => {
  assert.equal(sit(1, 24, 24).tipo, null);
  assert.deepEqual(sit(1, 25, 24), { tipo: 'set', lado: 'local' });
  assert.deepEqual(sit(1, 24, 25), { tipo: 'set', lado: 'visitante' });
  assert.equal(sit(1, 25, 25).tipo, null);
  assert.deepEqual(sit(1, 29, 28), { tipo: 'set', lado: 'local' }); // se alargó
});

test('lejos del final no hay punto de set', () => {
  assert.equal(sit(1, 0, 0).tipo, null);
  assert.equal(sit(1, 20, 18).tipo, null);
  assert.equal(sit(1, 23, 20).tipo, null); // 24-20 todavía no cierra
});

test('set decisivo: se juega a 15', () => {
  assert.deepEqual(sit(3, 14, 10, { setsLocal: 1, setsVisitante: 1 }), { tipo: 'partido', lado: 'local' });
  assert.equal(sit(3, 14, 14, { setsLocal: 1, setsVisitante: 1 }).tipo, null);
  assert.deepEqual(sit(3, 15, 14, { setsLocal: 1, setsVisitante: 1 }), { tipo: 'partido', lado: 'local' });
  assert.deepEqual(sit(5, 9, 14, { totalSets: 5, setsLocal: 2, setsVisitante: 2 }), { tipo: 'partido', lado: 'visitante' });
});

test('punto de partido solo si ese set le da el último set que necesita', () => {
  // Mejor de 3: con 1-0 arriba, el punto de set del que va ganando es de partido; el del rival (que tiene 0) es solo de set.
  assert.deepEqual(sit(2, 24, 20, { setsLocal: 1, setsVisitante: 0 }), { tipo: 'partido', lado: 'local' });
  assert.deepEqual(sit(2, 20, 24, { setsLocal: 1, setsVisitante: 0 }), { tipo: 'set', lado: 'visitante' });
  assert.deepEqual(sit(1, 24, 20, { setsLocal: 0, setsVisitante: 0 }), { tipo: 'set', lado: 'local' });
  // Mejor de 5: hace falta llegar a 3 sets.
  assert.deepEqual(sit(4, 24, 10, { totalSets: 5, setsLocal: 2, setsVisitante: 1 }), { tipo: 'partido', lado: 'local' });
  assert.deepEqual(sit(3, 24, 10, { totalSets: 5, setsLocal: 1, setsVisitante: 1 }), { tipo: 'set', lado: 'local' });
  assert.deepEqual(sit(4, 10, 24, { totalSets: 5, setsLocal: 2, setsVisitante: 1 }), { tipo: 'set', lado: 'visitante' });
});

test('un marcador de set ya terminado se marca como cerrado', () => {
  assert.deepEqual(sit(1, 25, 20), { tipo: 'cerrado', lado: null });
  assert.deepEqual(sit(1, 26, 24), { tipo: 'cerrado', lado: null });
  assert.deepEqual(sit(3, 15, 13, { setsLocal: 1, setsVisitante: 1 }), { tipo: 'cerrado', lado: null });
});

test('datos raros no rompen nada', () => {
  assert.equal(sit(0, 24, 20).tipo, null);
  assert.equal(sit(4, 24, 20).tipo, null); // set 4 de un mejor de 3
  assert.equal(puntoDecisivo({ numeroSet: 1, totalSets: 3, setsParaGanar: 2, puntosLocal: -1, puntosVisitante: 0 }).tipo, null);
  assert.equal(puntoDecisivo({ numeroSet: 1, totalSets: 3, setsParaGanar: 2, puntosLocal: '24', puntosVisitante: 20 }).tipo, null);
  assert.equal(puntoDecisivo({}).tipo, null);
});

test('el patrón de vibración crece con la importancia del punto', () => {
  const total = (p) => p.reduce((a, b) => a + b, 0);
  assert.deepEqual(patronDeVibracion(null), [25]);
  assert.deepEqual(patronDeVibracion({ tipo: null }), [25]);
  const [normal, cerrado, set, partido] = [{ tipo: null }, { tipo: 'cerrado' }, { tipo: 'set' }, { tipo: 'partido' }].map(patronDeVibracion);
  assert.ok(total(normal) < total(cerrado) && total(cerrado) < total(set) && total(set) < total(partido));
  assert.ok(partido.every((n) => n > 0 && n <= 400), 'ninguna vibración dura demasiado');
});

test('la vibración viene activada y se puede apagar', () => {
  const m = memoria();
  assert.equal(vibracionActivada(m), true);
  guardarVibracionActivada(false, m);
  assert.equal(vibracionActivada(m), false);
  guardarVibracionActivada(true, m);
  assert.equal(vibracionActivada(m), true);
  assert.equal(vibracionActivada({ getItem: () => '{roto' }), true);
  assert.equal(vibracionActivada(undefined), true);
});

test('vibrar usa navigator.vibrate y no falla si no existe', () => {
  const llamadas = [];
  assert.equal(vibrar([25], { vibrate: (p) => (llamadas.push(p), true) }), true);
  assert.deepEqual(llamadas, [[25]]);
  assert.equal(vibrar([25], {}), false);
  assert.equal(vibrar([25], undefined), false);
  assert.equal(vibrar([25], { vibrate: () => { throw new Error('no'); } }), false);
});

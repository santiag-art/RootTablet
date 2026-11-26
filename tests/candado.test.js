import test from 'node:test';
import assert from 'node:assert/strict';
import { MS_MANTENER, desbloquea, fraccionMantenida } from '../js/candado.js';

test('el candado pide mantener el dedo el tiempo completo', () => {
  assert.equal(fraccionMantenida(1000, 1000), 0);
  assert.equal(fraccionMantenida(1000, 1000 + MS_MANTENER / 2), 0.5);
  assert.equal(desbloquea(1000, 1000 + MS_MANTENER - 1), false);
  assert.equal(desbloquea(1000, 1000 + MS_MANTENER), true);
});

test('el candado no se rompe con datos raros', () => {
  assert.equal(fraccionMantenida(null, 5), 0);
  assert.equal(fraccionMantenida(10, 5), 0);
  assert.equal(fraccionMantenida(0, 99999), 1);
  assert.equal(desbloquea(0, 5, 0), false);
});

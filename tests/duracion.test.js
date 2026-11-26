import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SET_SEG, duracionDePartido, duracionDeSet, formatoDuracion, formatoReloj, segundosDesde, segundosEntre } from '../js/duracion.js';
import { guardarSet, nuevoEstadoPartido, reabrirUltimoSet, sumarPunto, deshacerUltimaAccion, elegirFormato } from '../js/motor.js';
import { resultadoDePartido } from '../js/exportar.js';

const t = (min, seg = 0) => new Date(Date.UTC(2026, 10, 25, 20, min, seg)).toISOString();

test('segundosEntre y los límites', () => {
  assert.equal(segundosEntre(t(0), t(25, 30)), 1530);
  assert.equal(segundosEntre(t(10), t(5)), null);
  assert.equal(segundosEntre(null, t(5)), null);
  assert.equal(segundosEntre('no es fecha', t(5)), null);
  assert.equal(segundosEntre(t(0), t(0, 0)), 0);
  assert.equal(segundosEntre(t(0), new Date(Date.parse(t(0)) + (MAX_SET_SEG + 1) * 1000).toISOString()), null);
});

test('duración del set y del partido (con descansos entre sets)', () => {
  const sets = [{ inicioEn: t(0), finEn: t(24), duracionSeg: 1440 }, { inicioEn: t(28), finEn: t(52) }, { inicioEn: null, finEn: null }];
  assert.equal(duracionDeSet(sets[0]), 1440);
  assert.equal(duracionDeSet(sets[1]), 1440);
  assert.equal(duracionDeSet(sets[2]), null);
  assert.equal(duracionDePartido(sets), 52 * 60);
  assert.equal(duracionDePartido([{ inicioEn: null }]), null);
  assert.equal(duracionDePartido([]), null);
});

test('formatos de tiempo', () => {
  assert.equal(formatoReloj(754), '12:34');
  assert.equal(formatoReloj(3725), '1:02:05');
  assert.equal(formatoReloj(null), '—');
  assert.equal(formatoDuracion(40), '40 s');
  assert.equal(formatoDuracion(1500), '25 min');
  assert.equal(formatoDuracion(3725), '1 h 2 min');
  assert.equal(formatoDuracion(7200), '2 h');
  assert.equal(segundosDesde(t(0), new Date(t(1, 30))), 90);
  assert.equal(segundosDesde(t(5), new Date(t(1))), 0);
});

// Un partido con reloj controlado.
function partidoConReloj() {
  const reg = { id: 1, torneoId: 1, equipoLocal: 'Roots', equipoVisitante: 'Águilas', fecha: '2026-11-25', hora: '10:00' };
  const est = nuevoEstadoPartido(reg);
  reg.est = est;
  let ahora = new Date(t(0));
  const ctx = { jugadores: [], lesiones: new Map(), ahora: () => ahora, avisar: () => {} };
  return { reg, est, ctx, en: (min, seg = 0) => { ahora = new Date(t(min, seg)); } };
}

test('el motor marca el reloj del set con el primer y el último punto', () => {
  const { est, ctx, en } = partidoConReloj();
  elegirFormato(est, 'mejor_de_3');
  en(1); sumarPunto(est, ctx, 'local');
  en(2); sumarPunto(est, ctx, 'visitante');
  en(10, 30); sumarPunto(est, ctx, 'local');
  assert.equal(est.actual.relojInicio, t(1));
  assert.equal(est.actual.relojFin, t(10, 30));
});

test('al quitar el primer punto el reloj vuelve a empezar con el siguiente', () => {
  const { est, ctx, en } = partidoConReloj();
  elegirFormato(est, 'mejor_de_3');
  en(1); sumarPunto(est, ctx, 'local');
  deshacerUltimaAccion(est, ctx);
  en(5); sumarPunto(est, ctx, 'visitante');
  assert.equal(est.actual.relojInicio, t(5));
});

test('guardar el set guarda su duración y el archivo de resultados la lleva', () => {
  const { reg, est, ctx, en } = partidoConReloj();
  elegirFormato(est, 'mejor_de_3');
  for (let i = 0; i < 25; i += 1) { en(1 + i); sumarPunto(est, ctx, 'local'); }
  for (let i = 0; i < 20; i += 1) { en(26 + i); sumarPunto(est, ctx, 'visitante'); }
  // el marcador queda 25-20
  guardarSet(est, ctx, 25, 20);
  assert.equal(est.sets[0].duracionSeg, 44 * 60);
  const res = resultadoDePartido(reg);
  assert.equal(res.sets[0].duracionSeg, 44 * 60);
  assert.equal(res.duracionSeg, 44 * 60);
});

test('un set cargado sin puntos no trae duración y el archivo sigue igual de siempre', () => {
  const { reg, est, ctx } = partidoConReloj();
  elegirFormato(est, 'mejor_de_3');
  guardarSet(est, ctx, 25, 20);
  assert.equal(est.sets[0].duracionSeg, null);
  const res = resultadoDePartido(reg);
  assert.equal('duracionSeg' in res, false);
  assert.equal('duracionSeg' in res.sets[0], false);
});

test('al reabrir el último set vuelve su reloj', () => {
  const { est, ctx, en } = partidoConReloj();
  elegirFormato(est, 'mejor_de_3');
  for (let i = 0; i < 25; i += 1) { en(1 + i); sumarPunto(est, ctx, 'local'); }
  guardarSet(est, ctx, 25, 0);
  reabrirUltimoSet(est, ctx);
  assert.equal(est.actual.relojInicio, t(1));
  assert.equal(est.actual.relojFin, t(25));
});

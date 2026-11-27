import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../js/motor.js';
import { PESOS_MVP_POR_DEFECTO, mvpDeActuaciones, puntosDeImpactoDeConteos } from '../js/mvp.js';
import { CAMPOS_PESO, CLAVE_PESOS_MVP, frasesDeFormula, guardarPesosMvp, leerNumero, leerPesosMvp, normalizarPesos, sonLosPorDefecto, validarPesos } from '../js/pesosMvp.js';
import { EXPLICACION_MVP, datosDeRegistro, explicacionMvp, puntosDeImpacto } from '../js/resumenCompartir.js';
import { construirCopia, leerCopia, restaurarCopia } from '../js/copia.js';
import { crearAlmacen, crearRespaldoMemoria } from '../js/store.js';
import { crearContexto, JUGADORAS } from './ayuda.js';

const nuevo = () => crearAlmacen(crearRespaldoMemoria());
const TORNEO = { id: 1, nombre: 'Copa Roots', genero: 'femenino', categoria: 'menores' };
const textosDeValores = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v).replace('.', ',')]));

test('leerNumero entiende coma y punto, y rechaza lo que no es número', () => {
  assert.equal(leerNumero('0,5'), 0.5);
  assert.equal(leerNumero(' 2.25 '), 2.25);
  assert.equal(leerNumero(3), 3);
  for (const malo of ['', 'abc', '-1', '1,2,3', null, undefined, NaN, '1e3']) assert.equal(leerNumero(malo), null);
});

test('validarPesos: con los valores de siempre no hay errores y el resultado es el mismo', () => {
  const { pesos, errores } = validarPesos(textosDeValores(PESOS_MVP_POR_DEFECTO));
  assert.deepEqual(errores, []);
  assert.deepEqual(pesos, { ...PESOS_MVP_POR_DEFECTO });
  assert.equal(sonLosPorDefecto(pesos), true);
});

test('validarPesos: avisa qué campo está mal (vacío, texto o fuera de rango) y deja el valor de siempre', () => {
  const base = textosDeValores(PESOS_MVP_POR_DEFECTO);
  const { pesos, errores } = validarPesos({ ...base, directo: '', error: '9', topeColocacion: 'mucho', colocacionPerfecta: '0,5' });
  assert.deepEqual(errores.map((e) => e.clave).sort(), ['directo', 'error', 'topeColocacion']);
  assert.match(errores.find((e) => e.clave === 'error').mensaje, /entre 0 y 5/);
  assert.equal(pesos.directo, PESOS_MVP_POR_DEFECTO.directo);
  assert.equal(pesos.colocacionPerfecta, 0.5);
  assert.equal(sonLosPorDefecto(pesos), false);
});

test('todos los campos tienen límites razonables y el valor de siempre cabe en ellos', () => {
  assert.deepEqual(CAMPOS_PESO.map((c) => c.clave).sort(), Object.keys(PESOS_MVP_POR_DEFECTO).sort());
  for (const c of CAMPOS_PESO) {
    assert.ok(c.min <= PESOS_MVP_POR_DEFECTO[c.clave] && PESOS_MVP_POR_DEFECTO[c.clave] <= c.max, c.clave);
    assert.ok(c.paso > 0 && c.paso <= c.max, c.clave);
  }
});

test('lo guardado se lee igual; si son los de siempre no deja fila; un dato dañado vuelve al de siempre', async () => {
  const a = nuevo();
  assert.deepEqual(leerPesosMvp(await a.todos('meta')), { ...PESOS_MVP_POR_DEFECTO });
  const guardados = await guardarPesosMvp(a, { ...PESOS_MVP_POR_DEFECTO, directo: 2, error: 0.5 });
  assert.equal(guardados.directo, 2);
  const filas = await a.todos('meta');
  assert.equal(filas.filter((f) => f.clave === CLAVE_PESOS_MVP).length, 1);
  assert.deepEqual(leerPesosMvp(filas), guardados);
  await guardarPesosMvp(a, PESOS_MVP_POR_DEFECTO);
  assert.equal((await a.todos('meta')).some((f) => f.clave === CLAVE_PESOS_MVP), false);
  assert.deepEqual(leerPesosMvp([{ clave: CLAVE_PESOS_MVP, pesos: { directo: 'x', error: -4, topeColocacion: 99 } }]), { ...PESOS_MVP_POR_DEFECTO });
  assert.deepEqual(normalizarPesos(null), { ...PESOS_MVP_POR_DEFECTO });
});

test('puntosDeImpacto de un partido usa los pesos que se le pasan; sin pesos, los de siempre', () => {
  const jugadas = [
    ...Array(3).fill({ fundamento: 'Ataque', calificacion: 'doble_positivo' }),
    ...Array(2).fill({ fundamento: 'Recepción', calificacion: 'doble_positivo' }),
    { fundamento: 'Defensa', calificacion: 'positivo' },
    { fundamento: 'Ataque', calificacion: 'error' },
  ];
  assert.equal(puntosDeImpacto(jugadas).puntos, 2.76); // 3 + 0,66 + 0,1 − 1
  assert.equal(puntosDeImpacto(jugadas, PESOS_MVP_POR_DEFECTO).puntos, 2.76);
  // directo vale 2, el error resta 0,5: 6 + 0,66 + 0,1 − 0,5
  assert.equal(puntosDeImpacto(jugadas, { ...PESOS_MVP_POR_DEFECTO, directo: 2, error: 0.5 }).puntos, 6.26);
  assert.match(puntosDeImpacto(jugadas, { ...PESOS_MVP_POR_DEFECTO, directo: 2 }).detalle, /ataque: 3 puntos directos/);
});

test('subir el tope y el valor de la colocación cambia lo que suma la armadora', () => {
  const jugadas = Array(20).fill({ fundamento: 'Colocación', calificacion: 'doble_positivo' });
  assert.equal(puntosDeImpacto(jugadas).puntos, 2.5);
  assert.equal(puntosDeImpacto(jugadas, { ...PESOS_MVP_POR_DEFECTO, topeColocacion: 4 }).puntos, 4);
  assert.equal(puntosDeImpacto(jugadas, { ...PESOS_MVP_POR_DEFECTO, colocacionPerfecta: 0.1 }).puntos, 2);
  // con colocación en 0 no hay división entre cero y no suma nada
  const cero = puntosDeImpacto(jugadas, { ...PESOS_MVP_POR_DEFECTO, colocacionPerfecta: 0 });
  assert.equal(cero.puntos, 0);
  assert.equal(cero.detalle, '');
});

test('MVP del torneo: los pesos cambian el orden y el partido a partido usa el mismo tope', () => {
  const act = (partidoId, jugadorId, grupo, conteos) => ({ partidoId, torneoId: 1, fecha: '', hora: '', jugadorId, grupo, conteos });
  const d = (n) => ({ doble_positivo: n, positivo: 0, negativo: 0, error: 0 });
  const acts = [act(1, 1, 'ataque', { Ataque: d(4) }), act(1, 2, 'colocacion', { Colocación: d(12) })];
  assert.deepEqual(mvpDeActuaciones(acts, { torneoId: 1 }).map((f) => f.jugadorId), [1, 2]); // 4 contra 2,5
  const mas = { ...PESOS_MVP_POR_DEFECTO, topeColocacion: 6, colocacionPerfecta: 0.5 }; // la armadora suma 6
  assert.deepEqual(mvpDeActuaciones(acts, { torneoId: 1, pesos: mas }).map((f) => [f.jugadorId, f.puntos]), [[2, 6], [1, 4]]);
  assert.equal(puntosDeImpactoDeConteos({ Ataque: d(3) }, { directo: 1.5 }).puntos, 4.5); // pesos que faltan: los de siempre
});

test('el resumen del partido ordena a las mejores con los pesos vigentes', () => {
  const est = m.nuevoEstadoPartido({ id: 1, equipoLocal: 'Roots', equipoVisitante: 'Rivales' });
  est.ladoPropio = 'local';
  m.elegirFormato(est, 'mejor_de_3');
  const ctx = crearContexto();
  [1, 2, 3, 4, 5, 6].forEach((id) => m.toggleJugador(est, ctx, id));
  m.confirmarPlantilla(est, ctx);
  m.elegirSaque(est, 'local');
  for (let i = 0; i < 3; i += 1) m.registrarJugada(est, ctx, 2, 'Ataque', 'doble_positivo'); // Bea: 3 puntos directos
  for (let i = 0; i < 10; i += 1) m.registrarJugada(est, ctx, 1, 'Colocación', 'doble_positivo'); // Ana: 10 perfectas
  m.guardarSet(est, ctx, 25, 20);
  const registro = { id: 1, torneoId: 1, equipoLocal: 'Roots', equipoVisitante: 'Rivales', fecha: '2026-11-22', hora: '09:00', est };
  const siempre = datosDeRegistro({ registro, torneo: TORNEO, jugadores: JUGADORAS });
  assert.equal(siempre.destacadas[0].puntos, 3);
  assert.equal(siempre.destacadas[1].puntos, 2.5);
  const armadora = datosDeRegistro({ registro, torneo: TORNEO, jugadores: JUGADORAS, pesos: { ...PESOS_MVP_POR_DEFECTO, topeColocacion: 5, colocacionPerfecta: 0.5 } });
  assert.equal(armadora.destacadas[0].nombre, 'Ana Colocadora');
  assert.equal(armadora.destacadas[0].puntos, 5);
  assert.equal(armadora.destacadas[0].mvp, true);
});

test('la explicación para la entrenadora sale con los pesos vigentes (y con los de siempre es la de siempre)', () => {
  assert.deepEqual(EXPLICACION_MVP, explicacionMvp());
  assert.equal(EXPLICACION_MVP[1], '+1 por punto directo de ataque, saque o bloqueo · +0,33 por recepción o defensa perfecta · +0,1 por recepción o defensa positiva.');
  assert.equal(EXPLICACION_MVP[2], '+0,25 por colocación perfecta, hasta 2,5 puntos por partido (para no ganar solo por tocar más el balón).');
  assert.equal(EXPLICACION_MVP[3], '−1 por cada error, en cualquier fundamento.');
  const f = frasesDeFormula({ ...PESOS_MVP_POR_DEFECTO, directo: 1.5, error: 0.5, topeColocacion: 4 });
  assert.match(f.directos, /^\+1,5 por punto directo/);
  assert.match(f.colocacion, /hasta 4 puntos/);
  assert.match(f.errores, /^−0,5 por cada error/);
});

test('la copia de seguridad guarda y restaura los pesos; sin cambios no agrega nada', async () => {
  const origen = nuevo();
  const sinCambios = await construirCopia(origen, { ahora: new Date('2026-11-22T12:00:00Z') });
  assert.equal('pesosMvp' in sinCambios, false);
  await guardarPesosMvp(origen, { ...PESOS_MVP_POR_DEFECTO, directo: 2 });
  const copia = leerCopia(JSON.stringify(await construirCopia(origen, { ahora: new Date('2026-11-22T12:00:00Z') })));
  assert.equal(copia.pesosMvp.directo, 2);
  const destino = nuevo();
  await restaurarCopia(destino, copia);
  assert.equal(leerPesosMvp(await destino.todos('meta')).directo, 2);
  // restaurar una copia sin pesos deja los de siempre (restaurar reemplaza todo)
  await restaurarCopia(destino, leerCopia(JSON.stringify(sinCambios)));
  assert.deepEqual(leerPesosMvp(await destino.todos('meta')), { ...PESOS_MVP_POR_DEFECTO });
});

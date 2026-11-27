import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/motor.js';
import { planDeRetiro, posicionDeEntrada, marcasDeLesion } from '../js/lesionEnPartido.js';
import { combinarDisponibilidad } from '../js/reglas/disponibilidad.js';
import { resultadoDePartido } from '../js/exportar.js';
import { crearContexto, estadoNuevo, partidoDePrueba } from './ayuda.js';

// Jugadoras de tests/ayuda.js: 1 Colocación, 2 Atacante, 3 Central, 4 Opuesta, 5 Atacante, 6 Central, 7 y 8 líberos de ficha,
// 9 Atacante, 10 Central, 11 Colocación y 12 Atacante en la banca.
function partido({ modoLibero = 'ninguno', lesiones = new Map() } = {}) {
  const est = estadoNuevo();
  const ctx = crearContexto({ lesiones });
  M.cambiarModoLibero(est, modoLibero);
  [1, 2, 3, 4, 5, 6].forEach((id) => M.toggleJugador(est, ctx, id));
  if (modoLibero === 'uno') M.elegirLibero(est, ctx, 7, 'unico');
  if (modoLibero === 'dos') { M.elegirLibero(est, ctx, 7, 'recepcion'); M.elegirLibero(est, ctx, 8, 'defensa'); }
  M.confirmarPlantilla(est, ctx);
  M.elegirSaque(est, 'local');
  return { est, ctx };
}
const marca = { zona: 'Rodilla', disponibilidad: 'no_apta' };

test('marcarLesion: guarda zona, cómo queda, set y marcador del momento', () => {
  const { est, ctx } = partido();
  est.actual.puntosLocal = 12;
  est.actual.puntosVisitante = 9;
  const m = M.marcarLesion(est, ctx, 2, marca);
  assert.equal(est.lesiones.length, 1);
  assert.deepEqual([m.jugadorId, m.zona, m.disponibilidad, m.numeroSet, m.puntosLocal, m.puntosVisitante], [2, 'Rodilla', 'no_apta', 1, 12, 9]);
});

test('marcarLesion: pide zona y disponibilidad válidas, y una jugadora del torneo', () => {
  const { est, ctx } = partido();
  assert.throws(() => M.marcarLesion(est, ctx, 2, { zona: 'Nariz', disponibilidad: 'no_apta' }), /zona/);
  assert.throws(() => M.marcarLesion(est, ctx, 2, { zona: 'Rodilla', disponibilidad: 'apta' }), /limitada o no apta/);
  assert.throws(() => M.marcarLesion(est, ctx, 99, marca), /plantilla de este torneo/);
  assert.equal(est.lesiones.length, 0);
});

test('marcarLesion: marcar otra vez a la misma jugadora actualiza su marca (una por partido)', () => {
  const { est, ctx } = partido();
  M.marcarLesion(est, ctx, 2, { zona: 'Tobillo', disponibilidad: 'limitada' });
  M.marcarLesion(est, ctx, 2, marca);
  assert.equal(est.lesiones.length, 1);
  assert.equal(est.lesiones[0].zona, 'Rodilla');
});

test('deshacer: quita la marca; si había una anterior, la devuelve', () => {
  const { est, ctx } = partido();
  M.marcarLesion(est, ctx, 2, { zona: 'Tobillo', disponibilidad: 'limitada' });
  M.marcarLesion(est, ctx, 2, marca);
  assert.equal(M.deshacerUltimaAccion(est).tipo, 'lesion');
  assert.deepEqual(est.lesiones.map((l) => [l.zona, l.disponibilidad]), [['Tobillo', 'limitada']]);
  M.deshacerUltimaAccion(est);
  assert.deepEqual(est.lesiones, []);
});

test('quitarMarcaLesion: borra la marca de esa jugadora', () => {
  const { est, ctx } = partido();
  M.marcarLesion(est, ctx, 2, marca);
  M.marcarLesion(est, ctx, 3, marca);
  M.quitarMarcaLesion(est, 2);
  assert.deepEqual(est.lesiones.map((l) => l.jugadorId), [3]);
});

test('planDeRetiro: jugadora de campo -> cambio normal con quién entra, sin las no aptas', () => {
  const lesiones = new Map([[12, { disponibilidad: 'no_apta', zonas: ['Pie'] }]]);
  const { est, ctx } = partido({ lesiones });
  const plan = planDeRetiro(est, ctx, 2);
  assert.equal(plan.tipo, 'campo');
  assert.equal(plan.modo, 'normal');
  assert.ok(plan.opciones.length > 0);
  assert.ok(!plan.opciones.some((o) => o.entraId === 12), 'la no apta no se propone');
  assert.equal(plan.opciones[0].entraId, 9, 'la de su misma posición (Atacante) va primero');
});

// Con un líbero (7), la banca son 8, 9, 10, 11 y 12: cinco cambios las dejan a todas habiendo entrado una vez.
function partidoConBancaGastada() {
  const p = partido({ modoLibero: 'uno' });
  [[3, 8], [4, 9], [5, 10], [6, 11], [1, 12]].forEach(([sale, entra]) => M.ejecutarSustitucion(p.est, p.ctx, sale, entra));
  return p;
}

test('planDeRetiro: si ninguna suplente puede entrar normalmente, ofrece el cambio excepcional (regla 15.7)', () => {
  const { est, ctx } = partidoConBancaGastada();
  assert.equal(M.derivados(est, ctx).sustitucionesUsadas, 5);
  const plan = planDeRetiro(est, ctx, 2);
  assert.equal(plan.tipo, 'campo');
  assert.equal(plan.modo, 'excepcional');
  assert.ok(plan.opciones.length > 0);
});

test('cambio excepcional por lesión: no cuenta dentro de los 6 y ella no vuelve a entrar', () => {
  const { est, ctx } = partidoConBancaGastada();
  const entra = planDeRetiro(est, ctx, 2).opciones[0].entraId;
  M.ejecutarSustitucion(est, ctx, 2, entra, { excepcional: true, posicion: 'Atacante' });
  const d = M.derivados(est, ctx);
  assert.equal(d.sustitucionesUsadas, 5, 'sigue en 5: el excepcional no cuenta');
  assert.ok(d.salieronExcepcionalIds.has(2));
  assert.ok(M.errorDeCambioNormal(est, ctx, entra, 2), 'ella no puede volver a entrar');
});

test('planDeRetiro: con cambios normales posibles propone el normal y NO el excepcional', () => {
  const { est, ctx } = partido();
  assert.equal(planDeRetiro(est, ctx, 2).modo, 'normal');
});

test('planDeRetiro: líbero sin otro líbero -> designar nuevo; con otro líbero -> seguir con él', () => {
  const uno = partido({ modoLibero: 'uno' });
  const p1 = planDeRetiro(uno.est, uno.ctx, 7);
  assert.equal(p1.tipo, 'libero');
  assert.deepEqual(p1.otrosLiberos, []);
  const dos = partido({ modoLibero: 'dos' });
  const p2 = planDeRetiro(dos.est, dos.ctx, 7);
  assert.deepEqual(p2.otrosLiberos, [8]);
  assert.equal(p2.enCancha, false);
});

test('planDeRetiro: quien está en la banca o fuera por el líbero solo queda marcada', () => {
  const { est, ctx } = partido({ modoLibero: 'uno' });
  assert.equal(planDeRetiro(est, ctx, 10).tipo, 'fuera');
  // la central 3 está en P3? la zaguera entra la líbero por una zaguera: P1 = id 1, P5 = id 5, P6 = id 6 (slots 0, 4, 5)
  est.actual.puntosLocal = 1;
  M.elegirSaque(est, 'visitante');
  M.entrarLibero(est, ctx, 7, est.actual.slots[5]);
  const reemplazada = M.derivados(est, ctx).reemplazados.get(7);
  const plan = planDeRetiro(est, ctx, reemplazada);
  assert.equal(plan.tipo, 'fuera_por_libero');
  assert.equal(plan.liberoId, 7);
});

test('posicionDeEntrada: la que ya tenía en el partido o la de su ficha (un solo toque)', () => {
  const { est, ctx } = partido();
  const d = M.derivados(est, ctx);
  assert.equal(posicionDeEntrada(est, d, 10), 'Central');
  est.posiciones[10] = 'Ataque opuesto';
  assert.equal(posicionDeEntrada(est, d, 10), 'Ataque opuesto');
});

test('combinarDisponibilidad: gana la peor y se juntan las zonas, sin tocar lo de Roots', () => {
  const roots = new Map([[2, { disponibilidad: 'limitada', zonas: ['Hombro'] }]]);
  const unido = combinarDisponibilidad(roots, [{ jugadorId: 2, zona: 'Rodilla', disponibilidad: 'no_apta' }, { jugadorId: 5, zona: 'Pie', disponibilidad: 'limitada' }]);
  assert.deepEqual(unido.get(2), { disponibilidad: 'no_apta', zonas: ['Hombro', 'Rodilla'] });
  assert.deepEqual(unido.get(5), { disponibilidad: 'limitada', zonas: ['Pie'] });
  assert.deepEqual(roots.get(2), { disponibilidad: 'limitada', zonas: ['Hombro'] });
});

test('marcasDeLesion: junta las de varios partidos (los viejos sin el campo no fallan)', () => {
  const a = { est: { lesiones: [{ jugadorId: 2, zona: 'Pie', disponibilidad: 'limitada' }] } };
  const viejo = { est: {} };
  assert.deepEqual(marcasDeLesion([a, viejo]), [{ jugadorId: 2, zona: 'Pie', disponibilidad: 'limitada' }]);
});

test('exportar: la lesión viaja con zona, cómo quedó y el momento; sin lesiones no aparece el campo', () => {
  const { est, ctx } = partido();
  const registro = { id: 10, torneoId: 1, equipoLocal: 'Roots', equipoVisitante: 'Rivales', fecha: '2026-11-22', hora: '09:00:00', est };
  est.sets.push({ numeroSet: 1, puntosLocal: 25, puntosVisitante: 20, titulares: [], sustituciones: [], eventos: [], tiemposMuertos: { local: 0, visitante: 0 } });
  assert.equal('lesiones' in resultadoDePartido(registro), false);
  M.marcarLesion(est, ctx, 2, marca);
  const r = resultadoDePartido(registro);
  assert.equal(r.lesiones.length, 1);
  assert.deepEqual([r.lesiones[0].jugadorId, r.lesiones[0].zona, r.lesiones[0].disponibilidad, r.lesiones[0].numeroSet], [2, 'Rodilla', 'no_apta', 2]);
});

test('un partido guardado antes de existir las lesiones sigue funcionando', () => {
  const est = estadoNuevo();
  delete est.lesiones;
  const ctx = crearContexto();
  [1, 2, 3, 4, 5, 6].forEach((id) => M.toggleJugador(est, ctx, id));
  M.marcarLesion(est, ctx, 2, marca);
  assert.equal(est.lesiones.length, 1);
  assert.equal(partidoDePrueba().id, 10);
});

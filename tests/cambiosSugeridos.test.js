import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/motor.js';
import { UMBRALES_CAMBIO, cambiosSugeridos, evaluarJugadora, opcionesParaSalir, textoDeSugerencia } from '../js/cambiosSugeridos.js';
import { crearContexto, estadoNuevo } from './ayuda.js';

// Jugadoras de tests/ayuda.js: 1 Colocación, 2 Atacante, 3 Central, 4 Opuesta, 5 Atacante, 6 Central, 7 y 8 líberos de ficha,
// 9 Atacante, 10 Central, 11 Colocación y 12 Atacante en la banca.
function partido({ modoLibero = 'ninguno', lesiones = new Map() } = {}) {
  const est = estadoNuevo();
  const ctx = crearContexto({ lesiones });
  M.cambiarModoLibero(est, modoLibero);
  [1, 2, 3, 4, 5, 6].forEach((id) => M.toggleJugador(est, ctx, id));
  if (modoLibero === 'uno') M.elegirLibero(est, ctx, 7, 'unico');
  M.confirmarPlantilla(est, ctx);
  M.elegirSaque(est, 'local');
  return { est, ctx, d: () => M.derivados(est, ctx) };
}

let siguiente = 1000;
// Anota jugadas directamente (también de quien está en la banca, para armar historiales).
function jugadas(est, jugadorId, fundamento, calificaciones, set = est.actual) {
  for (const calificacion of calificaciones) set.eventos.push({ id: siguiente++, jugadorId, fundamento, calificacion, enConjunto: false, paseRecibido: null });
}
const rep = (n, c) => Array(n).fill(c);
const sugeridasPor = (est, ctx) => cambiosSugeridos(est, ctx, M.derivados(est, ctx));

// ───────────── evaluarJugadora (puro) ─────────────

const ev = (jugadorId, fundamento, calificaciones) => calificaciones.map((calificacion) => ({ jugadorId, fundamento, calificacion }));

test('evaluarJugadora: con pocas jugadas no opina', () => {
  const pocas = ev(2, 'Ataque', ['error', 'positivo', 'error', 'negativo']); // 4 jugadas, sin racha de errores
  assert.deepEqual(evaluarJugadora(2, { eventosSet: pocas, eventosPartido: pocas }), { gravedad: 0, motivos: [] });
  // en cambio, una racha de errores seguidos sí cuenta aunque sean pocas jugadas (es lo mismo que avisa la barra de alertas)
  const racha = evaluarJugadora(2, { eventosSet: ev(2, 'Ataque', rep(4, 'error')), eventosPartido: [] });
  assert.equal(racha.gravedad, 2);
  assert.equal(racha.motivos[0].texto, '4 errores de ataque seguidos');
});

test('evaluarJugadora: ataque flojo suma 1; muy flojo suma 2', () => {
  const flojo = evaluarJugadora(2, { eventosSet: ev(2, 'Ataque', ['positivo', ...rep(4, 'negativo')]), eventosPartido: [] }); // 1 de 5 = 20 %
  assert.equal(flojo.gravedad, 1);
  assert.match(flojo.motivos[0].texto, /Ataque en este set: 1 de 5 bien \(20%\)/);
  const muyFlojo = evaluarJugadora(2, { eventosSet: ev(2, 'Ataque', ['positivo', ...rep(7, 'negativo')]), eventosPartido: [] }); // 1 de 8 = 12 %
  assert.equal(muyFlojo.gravedad, 2);
});

test('evaluarJugadora: un ataque con buen porcentaje no suma, aunque tenga un error', () => {
  const r = evaluarJugadora(2, { eventosSet: ev(2, 'Ataque', ['doble_positivo', 'positivo', 'positivo', 'positivo', 'error']), eventosPartido: [] });
  assert.equal(r.gravedad, 0);
});

test('evaluarJugadora: muchos errores en el ataque suman aunque el porcentaje no sea tan bajo', () => {
  const jugadas10 = ev(2, 'Ataque', [...rep(4, 'positivo'), ...rep(3, 'error'), ...rep(3, 'negativo')]); // 4 de 10 = 40 %, 3 errores
  const r = evaluarJugadora(2, { eventosSet: jugadas10, eventosPartido: [] });
  assert.equal(r.gravedad, 1);
  assert.match(r.motivos[0].texto, /3 errores/);
});

test('evaluarJugadora: recepción floja suma; saque con muchos errores suma', () => {
  const rec = evaluarJugadora(3, { eventosSet: ev(3, 'Recepción', [...rep(2, 'positivo'), ...rep(3, 'negativo')]), eventosPartido: [] }); // 40 % = baja
  assert.equal(rec.gravedad, 1);
  const saque = evaluarJugadora(3, { eventosSet: ev(3, 'Saque', ['positivo', 'error', 'error', 'negativo']), eventosPartido: [] }); // 2 de 4 errores = 50 %
  assert.equal(saque.gravedad, 1);
  assert.match(saque.motivos[0].texto, /Saque en este set: 2 errores en 4 saques/);
});

test('evaluarJugadora: errores seguidos y porcentaje del mismo fundamento no suman dos veces', () => {
  const tres = ev(2, 'Saque', rep(3, 'error')); // 3 saques, todos error: tasa 100 % y 3 seguidos (urgente)
  const r = evaluarJugadora(2, { eventosSet: tres, eventosPartido: tres });
  assert.equal(r.gravedad, 2);
  assert.equal(r.motivos.length, 1);
});

test('evaluarJugadora: en todo el partido pide el doble de jugadas', () => {
  const diez = ev(2, 'Ataque', ['positivo', 'positivo', ...rep(8, 'negativo')]); // 20 %
  assert.equal(evaluarJugadora(2, { eventosSet: [], eventosPartido: diez.slice(0, 9) }).gravedad, 0); // 9 < 10
  const r = evaluarJugadora(2, { eventosSet: [], eventosPartido: diez });
  assert.equal(r.gravedad, 1);
  assert.match(r.motivos[0].texto, /en el partido/);
});

test('evaluarJugadora: solo mira a la jugadora pedida', () => {
  const mezcla = [...ev(2, 'Ataque', rep(8, 'error')), ...ev(5, 'Ataque', rep(8, 'positivo'))];
  assert.equal(evaluarJugadora(5, { eventosSet: mezcla, eventosPartido: mezcla }).gravedad, 0);
  assert.ok(evaluarJugadora(2, { eventosSet: mezcla, eventosPartido: mezcla }).gravedad >= 2);
});

// ───────────── cambiosSugeridos ─────────────

function conBeaMal(p) {
  // Jugadora 2 (Atacante en P2): ataque 1 de 8 y recepción 0 de 5 → gravedad 4 (urgente).
  jugadas(p.est, 2, 'Ataque', ['positivo', ...rep(7, 'negativo')]);
  jugadas(p.est, 2, 'Recepción', rep(5, 'negativo'));
}

test('sugiere el cambio de quien va mal, la más grave primero, con motivos', () => {
  const p = partido();
  conBeaMal(p);
  jugadas(p.est, 5, 'Ataque', ['positivo', ...rep(4, 'negativo')]); // la 5 solo va "floja" (gravedad 1): no se sugiere
  const s = sugeridasPor(p.est, p.ctx);
  assert.equal(s.length, 1);
  assert.equal(s[0].saleId, 2);
  assert.equal(s[0].nivel, 'urgente');
  assert.equal(s[0].gravedad, 4);
  assert.deepEqual(s[0].motivos.map((m) => m.fundamento), ['Ataque', 'Recepción']);
});

test('una sola cosa floja no dispara el aviso (gravedad mínima)', () => {
  const p = partido();
  jugadas(p.est, 2, 'Ataque', ['positivo', ...rep(4, 'negativo')]); // 1 de 5 = 20 %: gravedad 1
  assert.deepEqual(sugeridasPor(p.est, p.ctx), []);
  assert.equal(UMBRALES_CAMBIO.gravedadMinima, 2);
});

test('nadie va mal → no hay sugerencias', () => {
  const p = partido();
  [1, 2, 3, 4, 5, 6].forEach((id) => jugadas(p.est, id, 'Ataque', rep(6, 'positivo')));
  assert.deepEqual(sugeridasPor(p.est, p.ctx), []);
});

test('solo sugiere con la plantilla confirmada y la cancha completa', () => {
  const est = estadoNuevo();
  const ctx = crearContexto();
  M.cambiarModoLibero(est, 'ninguno');
  [1, 2, 3, 4, 5].forEach((id) => M.toggleJugador(est, ctx, id));
  jugadas(est, 2, 'Ataque', ['positivo', ...rep(7, 'negativo')]);
  jugadas(est, 2, 'Recepción', rep(5, 'negativo'));
  assert.deepEqual(sugeridasPor(est, ctx), []);
});

test('quién propone primero: la que juega de lo mismo y viene mejor; luego las de otra posición', () => {
  const p = partido();
  conBeaMal(p);
  jugadas(p.est, 12, 'Ataque', rep(4, 'positivo')); // Atacante que viene al 100 %
  const [s] = sugeridasPor(p.est, p.ctx);
  assert.deepEqual(s.opciones.map((o) => o.entraId), [12, 9, 10]); // 12 (viene bien) > 9 (descansada) > 10 (otra posición); las líberos de ficha (7, 8) quedan al final
  assert.equal(s.opciones[0].mismaPosicion, true);
  assert.match(s.opciones[0].notas.join(' | '), /juega de Atacante como Bea/);
  assert.match(s.opciones[0].notas.join(' | '), /viene 100% en 4 jugadas/);
  assert.ok(s.opciones[1].notas.includes('descansada'));
});

test('quien ya iba mal en el partido baja en la lista', () => {
  const p = partido();
  conBeaMal(p);
  jugadas(p.est, 9, 'Ataque', ['positivo', ...rep(7, 'negativo')]); // la 9, Atacante, ya iba mal
  const todas = opcionesParaSalir(p.est, p.ctx, p.d(), 2);
  const orden = todas.map((o) => o.entraId);
  assert.ok(orden.indexOf(12) < orden.indexOf(9));
  assert.ok(orden.indexOf(9) > orden.indexOf(10)); // aun siendo de la misma posición, queda detrás de la central descansada
  assert.match(todas.find((o) => o.entraId === 9).notas.join(' | '), /ya iba mal/);
});

test('las no aptas no se proponen', () => {
  const p = partido({ lesiones: new Map([[12, { disponibilidad: 'no_apta' }]]) });
  conBeaMal(p);
  const ids = opcionesParaSalir(p.est, p.ctx, p.d(), 2).map((o) => o.entraId);
  assert.ok(!ids.includes(12));
  assert.ok(ids.includes(9));
});

test('las limitadas se proponen con aviso y detrás de una igual sin limitación', () => {
  const p = partido({ lesiones: new Map([[9, { disponibilidad: 'limitada' }]]) });
  const todas = opcionesParaSalir(p.est, p.ctx, p.d(), 2); // 9 y 12 son Atacantes
  const ids = todas.map((o) => o.entraId);
  assert.ok(ids.indexOf(12) < ids.indexOf(9));
  const nueve = todas.find((o) => o.entraId === 9);
  assert.equal(nueve.limitada, true);
  assert.match(nueve.notas.join(' | '), /disponibilidad limitada/);
});

test('las líberos de ficha que no juegan de líbero quedan al final', () => {
  const p = partido();
  const ids = opcionesParaSalir(p.est, p.ctx, p.d(), 2).map((o) => o.entraId);
  assert.deepEqual(ids.slice(-2).sort(), [7, 8]);
});

test('respeta el reingreso: una suplente solo puede ser reemplazada por la titular a la que sustituyó', () => {
  const p = partido();
  M.ejecutarSustitucion(p.est, p.ctx, 2, 9); // entra la 9 por la 2
  jugadas(p.est, 9, 'Ataque', ['positivo', ...rep(7, 'negativo')]);
  jugadas(p.est, 9, 'Recepción', rep(5, 'negativo'));
  const [s] = sugeridasPor(p.est, p.ctx);
  assert.equal(s.saleId, 9);
  assert.deepEqual(s.opciones.map((o) => o.entraId), [2]); // solo puede volver la 2: ninguna otra de la banca puede entrar por ella
});

test('si nadie puede entrar legalmente, no se sugiere nada', () => {
  const p = partido();
  [[2, 9], [3, 10], [4, 11], [5, 12], [6, 7], [1, 8]].forEach(([sale, entra]) => M.ejecutarSustitucion(p.est, p.ctx, sale, entra)); // 6 cambios
  jugadas(p.est, 9, 'Ataque', ['positivo', ...rep(7, 'negativo')]);
  jugadas(p.est, 9, 'Recepción', rep(5, 'negativo'));
  assert.deepEqual(sugeridasPor(p.est, p.ctx), []);
});

test('la líbero no se sugiere para salir aunque vaya mal', () => {
  const p = partido({ modoLibero: 'uno' });
  M.entrarLibero(p.est, p.ctx, 7, 6); // la líbero entra por la 6 (P6)
  jugadas(p.est, 7, 'Recepción', rep(8, 'error'));
  assert.deepEqual(sugeridasPor(p.est, p.ctx), []);
});

test('máximo de sugerencias a la vez, de la más grave a la menos', () => {
  const p = partido();
  [2, 3, 4].forEach((id) => jugadas(p.est, id, 'Ataque', ['positivo', ...rep(7, 'negativo')]));
  jugadas(p.est, 3, 'Recepción', rep(5, 'negativo')); // la 3 es la más grave
  const s = sugeridasPor(p.est, p.ctx);
  assert.equal(s.length, UMBRALES_CAMBIO.maximoSugerencias);
  assert.equal(s[0].saleId, 3);
});

test('la clave cambia si empeora (para que el aviso cerrado vuelva a salir)', () => {
  const p = partido();
  jugadas(p.est, 2, 'Ataque', ['positivo', ...rep(7, 'negativo')]); // gravedad 2
  const antes = sugeridasPor(p.est, p.ctx)[0].clave;
  jugadas(p.est, 2, 'Recepción', rep(5, 'negativo')); // gravedad 4
  assert.notEqual(sugeridasPor(p.est, p.ctx)[0].clave, antes);
});

test('opcionesParaSalir también sirve cuando nadie va mal (para ordenar la lista de "¿quién entra?")', () => {
  const p = partido();
  const o = opcionesParaSalir(p.est, p.ctx, p.d(), 3); // sale la 3 (Central)
  assert.equal(o[0].entraId, 10); // la otra central, descansada y de la misma posición
  assert.equal(o.length, 6); // las seis de la banca (7 a 12) pueden entrar
});

// ───────────── textoDeSugerencia ─────────────

test('el texto del aviso nombra a quien sale, por qué y a quien propone', () => {
  const p = partido();
  conBeaMal(p);
  const [s] = sugeridasPor(p.est, p.ctx);
  const d = p.d();
  const { titulo, detalle } = textoDeSugerencia(s, (id) => d.nombre(id).split(' ')[0]);
  assert.equal(titulo, 'Bea no va bien: ');
  assert.match(detalle, /Ataque en este set: 1 de 8 bien \(13%\)/);
  assert.match(detalle, /Recepción en este set: 0 de 5 bien \(0%\)/);
  assert.match(detalle, /Podría entrar /);
});

// ───────────── errorDeCambioNormal = ejecutarSustitucion ─────────────
// Las sugerencias solo valen si "puede entrar" dice lo mismo que el cambio de verdad: se comprueba con todas las parejas.

function parejasIguales(est, ctx) {
  const d = M.derivados(est, ctx);
  const todas = ctx.jugadores.map((j) => j.id);
  let comprobadas = 0;
  for (const sale of todas) {
    for (const entra of todas) {
      const error = M.errorDeCambioNormal(est, ctx, sale, entra);
      const copia = structuredClone(est);
      let fallo = null;
      try {
        M.ejecutarSustitucion(copia, ctx, sale, entra);
      } catch (err) {
        if (!(err instanceof M.ErrorRegla)) throw err;
        fallo = err.message;
      }
      assert.equal(error === null, fallo === null, `sale ${sale} entra ${entra}: errorDeCambioNormal=${error} · ejecutarSustitucion=${fallo}`);
      if (error !== null) assert.equal(error, fallo, `sale ${sale} entra ${entra}`);
      comprobadas += 1;
    }
  }
  assert.ok(comprobadas > 100);
  return d;
}

test('errorDeCambioNormal coincide con ejecutarSustitucion para todas las parejas: al inicio', () => {
  const p = partido();
  parejasIguales(p.est, p.ctx);
});

test('errorDeCambioNormal coincide con ejecutarSustitucion: con un cambio hecho y con líbero', () => {
  const p = partido({ modoLibero: 'uno' });
  M.ejecutarSustitucion(p.est, p.ctx, 2, 9);
  M.entrarLibero(p.est, p.ctx, 7, 6);
  parejasIguales(p.est, p.ctx);
});

test('errorDeCambioNormal coincide con ejecutarSustitucion: con los 6 cambios usados y uno excepcional', () => {
  const p = partido();
  [[2, 9], [3, 10], [4, 11], [5, 12], [6, 7], [1, 8]].forEach(([sale, entra]) => M.ejecutarSustitucion(p.est, p.ctx, sale, entra));
  parejasIguales(p.est, p.ctx);
  M.ejecutarSustitucion(p.est, p.ctx, 9, 2, { excepcional: true }); // con el máximo agotado, solo cabe el excepcional
  parejasIguales(p.est, p.ctx);
});

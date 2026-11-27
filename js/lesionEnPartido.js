// Retiro de una jugadora por lesión en pleno partido: qué hay que hacer según dónde esté ella en ese momento.
// Es una AYUDA: solo calcula el plan y quién podría entrar (con la lógica de cambios sugeridos); nunca hace el cambio sola.
// Funciones puras (sin pantalla).
//
// Tipos de plan:
//   'campo'            está en cancha y no es líbero: se propone quién entra.
//                        modo 'normal'     -> cuenta como sustitución (regla 15.6).
//                        modo 'excepcional' -> no hay sustitución normal legal; cambio excepcional (regla 15.7).
//   'libero'           es líbero (regla 19.4): si queda otro líbero se sigue con él; si no, se designa uno nuevo.
//   'fuera_por_libero' está en la cancha "escondida" tras el líbero que la reemplazó.
//   'fuera'            está en la banca (o no está en cancha): solo queda la marca.
import { derivados } from './motor.js';
import { opcionesParaSalir } from './cambiosSugeridos.js';
import { posicionEstandar, tienePosicionElegida } from './posicionPartido.js';

export function planDeRetiro(est, ctx, jugadorId, { maximoOpciones = Infinity } = {}) {
  const act = est.actual;
  const d = derivados(est, ctx);
  if (!act.plantillaConfirmada) return { tipo: 'fuera', d };

  if (d.esLiberoId(jugadorId)) {
    const otrosLiberos = d.idsLibero.filter((l) => l !== jugadorId && !d.inhabilitadosLibero.has(l));
    return { tipo: 'libero', enCancha: act.slots.includes(jugadorId), otrosLiberos, reemplazaA: d.reemplazados.get(jugadorId) ?? null, d };
  }
  const liberoQueLaReemplaza = [...d.reemplazados].find(([, jugadora]) => jugadora === jugadorId)?.[0] ?? null;
  if (liberoQueLaReemplaza != null) return { tipo: 'fuera_por_libero', liberoId: liberoQueLaReemplaza, d };
  if (!act.slots.includes(jugadorId)) return { tipo: 'fuera', d };

  let modo = 'normal';
  let opciones = opcionesParaSalir(est, ctx, d, jugadorId, { max: maximoOpciones });
  if (opciones.length === 0) {
    modo = 'excepcional';
    opciones = opcionesParaSalir(est, ctx, d, jugadorId, { max: maximoOpciones, excepcional: true });
  }
  return { tipo: 'campo', modo, opciones, usados: d.sustitucionesUsadas, d };
}

// Con qué posición entra quien sube a cancha para que el cambio sea de UN toque: la que ya tenía en el partido o la de su ficha.
// Devuelve null si no hay ninguna reconocible (entonces la pantalla pregunta, como en un cambio normal).
export function posicionDeEntrada(est, d, entraId) {
  const jugadora = d.jugadoresPorId.get(entraId);
  return posicionConocida(est, jugadora);
}

function posicionConocida(est, jugadora) {
  if (!jugadora) return null;
  if (tienePosicionElegida(est, jugadora.id)) return posicionEstandar(est.posiciones[jugadora.id]);
  return posicionEstandar(jugadora.posicion);
}

// Marcas de lesión de varios partidos de la tablet (para unirlas con lo que dice Roots).
export function marcasDeLesion(registros) {
  return registros.flatMap((r) => r.est?.lesiones ?? []).map((l) => ({ jugadorId: l.jugadorId, zona: l.zona, disponibilidad: l.disponibilidad }));
}

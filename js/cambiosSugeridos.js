// Cambios sugeridos: mira cómo va jugando cada jugadora en cancha y, si alguna va mal, propone quién podría entrar.
// Es una AYUDA para la entrenadora: nunca hace el cambio sola. Funciones puras (sin pantalla).
//
// Cómo decide quién "va mal": para cada fundamento (ataque, recepción, saque) mira las jugadas de la jugadora en el set
// en juego y, si no alcanzan, en todo el partido (donde pide el doble de jugadas). Cada fundamento que va mal suma 1
// punto de gravedad (2 si va muy mal o lleva una racha de errores seguida). Solo se sugiere con gravedad 2 o más, para
// no avisar por una sola mala racha. Los umbrales están aquí arriba para cambiarlos fácil.
//
// Cómo elige a quién proponer: solo entre las que PUEDEN entrar según las reglas (misma comprobación que el cambio de
// verdad: máximo de cambios, reingreso de titulares y suplentes, líbero y cambios excepcionales). Pesan, en este orden:
// que jueguen de lo mismo que la que sale, cómo vienen jugando en el partido, que no hayan jugado todavía (descansadas),
// y le restan las que Roots marca con disponibilidad limitada y las líberos de ficha. Las "no aptas" no se proponen.
import { contar, eventosDelAlcance } from './estadisticas.js';
import { erroresSeguidosPorJugadora, UMBRALES_ERRORES } from './rachas.js';
import { MAX_SUSTITUCIONES, errorDeCambioExcepcional, errorDeCambioNormal } from './motor.js';
import { clavePosicion } from './reglas/fundamentosPosicion.js';

export const UMBRALES_CAMBIO = {
  // minimo: jugadas que hacen falta en el set para opinar (en todo el partido se piden `factorPartido` veces más).
  ataque: { minimo: 5, efectividadBaja: 0.3, efectividadMuyBaja: 0.15, erroresAtencion: 3, erroresUrgente: 4 },
  recepcion: { minimo: 5, efectividadBaja: 0.4, efectividadMuyBaja: 0.25, erroresAtencion: 3, erroresUrgente: 4 },
  // En el saque no cuenta la efectividad (un saque "positivo" no es el objetivo) sino qué parte de los saques fueron error.
  saque: { minimo: 3, tasaErroresAtencion: 0.4, tasaErroresUrgente: 0.6, erroresMinimos: 2 },
  factorPartido: 2,
  gravedadMinima: 2, // con menos que esto no se avisa
  gravedadUrgente: 3,
  maximoSugerencias: 2, // cuántas sugerencias se ven a la vez
  maximoOpciones: 3, // cuántas jugadoras se proponen por cada una que sale
};

const FUNDAMENTOS_EVALUADOS = ['Ataque', 'Recepción', 'Saque'];
const CLAVE_UMBRAL = { Ataque: 'ataque', Recepción: 'recepcion', Saque: 'saque' };
const pct = (x) => `${Math.round(x * 100)}%`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Evalúa un fundamento sobre un conjunto de jugadas de UNA jugadora. Devuelve { peso, texto } o null si va bien o son pocas.
function evaluarFundamento(fundamento, jugadas, { minimo, donde }) {
  const u = UMBRALES_CAMBIO[CLAVE_UMBRAL[fundamento]];
  const c = contar(jugadas);
  if (c.total < minimo) return null;
  const buenas = c.doble_positivo + c.positivo;
  if (fundamento === 'Saque') {
    const tasa = c.error / c.total;
    if (c.error < u.erroresMinimos) return null;
    const peso = tasa >= u.tasaErroresUrgente ? 2 : tasa >= u.tasaErroresAtencion ? 1 : 0;
    return peso ? { peso, texto: `Saque ${donde}: ${plural(c.error, 'error', 'errores')} en ${c.total} saques` } : null;
  }
  const pesoEfectividad = c.efectividad <= u.efectividadMuyBaja ? 2 : c.efectividad <= u.efectividadBaja ? 1 : 0;
  const pesoErrores = c.error >= u.erroresUrgente ? 2 : c.error >= u.erroresAtencion ? 1 : 0;
  const peso = Math.max(pesoEfectividad, pesoErrores);
  if (!peso) return null;
  const nombre = fundamento === 'Ataque' ? 'Ataque' : 'Recepción';
  return { peso, texto: `${nombre} ${donde}: ${buenas} de ${c.total} bien (${pct(c.efectividad)})${c.error ? `, ${plural(c.error, 'error', 'errores')}` : ''}` };
}

// Todo lo que va mal en una jugadora: { gravedad, motivos: [{ fundamento, peso, texto }] }.
// `eventosSet` y `eventosPartido` son las jugadas de todo el equipo (se filtran por jugadora aquí).
export function evaluarJugadora(jugadorId, { eventosSet, eventosPartido }) {
  const delSet = eventosSet.filter((e) => e.jugadorId === jugadorId);
  const delPartido = eventosPartido.filter((e) => e.jugadorId === jugadorId);
  const motivos = [];
  for (const fundamento of FUNDAMENTOS_EVALUADOS) {
    const minimo = UMBRALES_CAMBIO[CLAVE_UMBRAL[fundamento]].minimo;
    const candidatos = [
      evaluarFundamento(fundamento, delSet.filter((e) => e.fundamento === fundamento), { minimo, donde: 'en este set' }),
      evaluarFundamento(fundamento, delPartido.filter((e) => e.fundamento === fundamento), { minimo: minimo * UMBRALES_CAMBIO.factorPartido, donde: 'en el partido' }),
    ];
    // Errores seguidos (lo mismo que avisa la barra de alertas) en el set en juego.
    const regla = UMBRALES_ERRORES.find((r) => r.fundamento === fundamento);
    const seguidos = erroresSeguidosPorJugadora(delSet, fundamento).get(jugadorId) ?? 0;
    if (regla && seguidos >= regla.atencion) {
      candidatos.push({ peso: seguidos >= regla.urgente ? 2 : 1, texto: `${seguidos} ${regla.plural} seguidos` });
    }
    // Un solo motivo por fundamento (el más grave; a igualdad, el del set): así un mismo problema no suma dos veces.
    const mejor = candidatos.filter(Boolean).sort((a, b) => b.peso - a.peso)[0];
    if (mejor) motivos.push({ fundamento, ...mejor });
  }
  return { gravedad: motivos.reduce((n, m) => n + m.peso, 0), motivos };
}

// ¿Ha jugado algo en este partido? (titular de algún set, entró por un cambio, o tiene jugadas anotadas)
function haJugado(est, jugadorId) {
  const sets = [...est.sets, est.actual];
  return sets.some((s) => s.titulares.some((t) => t.jugadorId === jugadorId) || s.sustituciones.some((x) => x.jugadorEntraId === jugadorId) || s.eventos.some((e) => e.jugadorId === jugadorId));
}

// Jugadoras que pueden entrar por `saleId`, de la mejor a la peor opción. Cada una trae las notas que explican por qué.
//   { entraId, puntaje, mismaPosicion, limitada, notas: [texto] }
export function opcionesParaSalir(est, ctx, d, saleId, { max = Infinity, excepcional = false } = {}) {
  const eventosPartido = eventosDelAlcance(est, 'todo');
  const eventosSet = eventosDelAlcance(est, 'actual');
  const claveSale = clavePosicion(d.posicionDe(saleId));
  const nombreSale = d.nombre(saleId).split(' ')[0];
  const opciones = [];
  for (const j of d.jugadoresBanca) {
    if (ctx.lesiones?.get(j.id)?.disponibilidad === 'no_apta') continue;
    // `excepcional`: las que pueden entrar por el cambio excepcional de la regla 15.7 (lesión), cuando no hay un cambio normal legal.
    if ((excepcional ? errorDeCambioExcepcional(est, ctx, saleId, j.id) : errorDeCambioNormal(est, ctx, saleId, j.id)) !== null) continue;
    let puntaje = 0;
    const notas = [];
    const posicion = d.posicionDe(j.id);
    const mismaPosicion = Boolean(claveSale) && clavePosicion(posicion) === claveSale;
    if (mismaPosicion) {
      puntaje += 3;
      notas.push(`juega de ${posicion} como ${nombreSale}`);
    } else if (posicion) {
      // Una líbero de ficha que no es la líbero del partido casi nunca es la opción para reemplazar a una jugadora de campo.
      if (clavePosicion(posicion) === 'libero') puntaje -= 3;
    }
    const propias = eventosPartido.filter((e) => e.jugadorId === j.id);
    const { gravedad } = evaluarJugadora(j.id, { eventosSet, eventosPartido });
    if (propias.length >= 3) {
      const c = contar(propias);
      puntaje += (c.efectividad - 0.5) * 2;
      notas.push(`viene ${pct(c.efectividad)} en ${propias.length} jugadas`);
    }
    if (gravedad > 0) {
      puntaje -= gravedad;
      notas.push('ya iba mal en el partido');
    }
    if (!haJugado(est, j.id)) {
      puntaje += 0.5;
      notas.push('descansada');
    }
    const limitada = ctx.lesiones?.get(j.id)?.disponibilidad === 'limitada';
    if (limitada) {
      puntaje -= 2;
      notas.push('ojo: disponibilidad limitada');
    }
    opciones.push({ entraId: j.id, puntaje, mismaPosicion, limitada, notas });
  }
  opciones.sort((a, b) => b.puntaje - a.puntaje || (d.jugadoresPorId.get(a.entraId)?.numero ?? 999) - (d.jugadoresPorId.get(b.entraId)?.numero ?? 999));
  return opciones.slice(0, max);
}

// Sugerencias de cambio para el set en juego, las más graves primero:
//   { clave, saleId, nivel: 'atencion' | 'urgente', gravedad, motivos, opciones }
// Vacío si no se puede cambiar (plantilla sin confirmar, cancha incompleta, ya se usaron los 6 cambios) o nadie va mal.
export function cambiosSugeridos(est, ctx, d) {
  const act = est.actual;
  if (!act.plantillaConfirmada || d.enCancha.length < 6 || d.sustitucionesUsadas >= MAX_SUSTITUCIONES) return [];
  const eventosPartido = eventosDelAlcance(est, 'todo');
  const eventosSet = eventosDelAlcance(est, 'actual');
  const sugerencias = [];
  for (const saleId of d.enCancha) {
    if (d.esLiberoId(saleId)) continue;
    const { gravedad, motivos } = evaluarJugadora(saleId, { eventosSet, eventosPartido });
    if (gravedad < UMBRALES_CAMBIO.gravedadMinima) continue;
    const opciones = opcionesParaSalir(est, ctx, d, saleId, { max: UMBRALES_CAMBIO.maximoOpciones });
    if (opciones.length === 0) continue; // nadie puede entrar legalmente por ella: no hay nada que sugerir
    sugerencias.push({
      clave: `cambio:${saleId}:${gravedad}`,
      saleId,
      nivel: gravedad >= UMBRALES_CAMBIO.gravedadUrgente ? 'urgente' : 'atencion',
      gravedad,
      motivos,
      opciones,
    });
  }
  return sugerencias
    .sort((a, b) => b.gravedad - a.gravedad || (d.jugadoresPorId.get(a.saleId)?.numero ?? 999) - (d.jugadoresPorId.get(b.saleId)?.numero ?? 999))
    .slice(0, UMBRALES_CAMBIO.maximoSugerencias);
}

// Texto del aviso: { titulo, detalle } para una sugerencia, con nombres cortos.
export function textoDeSugerencia(s, nombreDe) {
  const primera = s.opciones[0];
  const motivos = s.motivos.map((m) => m.texto).join(' · ');
  const entra = `${nombreDe(primera.entraId)}${primera.notas.length ? ` (${primera.notas.join(', ')})` : ''}`;
  return {
    titulo: `${nombreDe(s.saleId)} no va bien: `,
    detalle: `${motivos}. Podría entrar ${entra}.`,
  };
}

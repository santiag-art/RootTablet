// MVP del torneo: suma los puntos de impacto de TODOS los partidos de una jugadora (el MVP de un partido, el de
// «Mejores jugadoras» del resumen, solo mira un partido). Es la misma fórmula de `puntosDeImpacto` en
// js/resumenCompartir.js, aplicada a las «actuaciones» del ranking (una jugadora en un partido, con la posición que
// jugó y sus jugadas por fundamento), así cuenta también lo archivado de partidos que ya se exportaron y quitaron.
// Funciones puras: no tocan la pantalla ni el almacenamiento.
//
// El tope de colocación (2,5 puntos) se aplica partido a partido, no sobre el total: si no, la armadora lo perdería
// después del primer partido. Un partido solo suma si la jugadora tuvo al menos 3 jugadas (8 si jugó de líbero),
// igual que en el MVP de cada partido, para que una jugada suelta no cambie el premio.

export const PESOS_MVP_POR_DEFECTO = Object.freeze({
  directo: 1, // punto directo de ataque, saque o bloqueo
  recepcionDefensaPerfecta: 0.33,
  recepcionDefensaPositiva: 0.1,
  colocacionPerfecta: 0.25,
  topeColocacion: 2.5, // por partido
  error: 1, // se resta por cada error, en cualquier fundamento
});
export const MIN_JUGADAS_MVP = 3;
export const MIN_JUGADAS_MVP_LIBERO = 8;

const DIRECTOS = ['Ataque', 'Saque', 'Bloqueo'];
const REC_DEF = ['Recepción', 'Defensa'];
const redondear2 = (n) => Math.round(n * 100) / 100;

// Puntos de impacto de UNA actuación. `conteos`: { fundamento: { doble_positivo, positivo, negativo, error } }.
export function puntosDeImpactoDeConteos(conteos, pesos = PESOS_MVP_POR_DEFECTO) {
  const p = { ...PESOS_MVP_POR_DEFECTO, ...pesos };
  let directos = 0;
  let perfectas = 0;
  let positivas = 0;
  let colocacionPerfectas = 0;
  let errores = 0;
  let jugadas = 0;
  for (const [fundamento, c] of Object.entries(conteos ?? {})) {
    errores += c.error;
    jugadas += c.doble_positivo + c.positivo + c.negativo + c.error;
    if (fundamento === 'Colocación') colocacionPerfectas += c.doble_positivo;
    else if (DIRECTOS.includes(fundamento)) directos += c.doble_positivo;
    else if (REC_DEF.includes(fundamento)) {
      perfectas += c.doble_positivo;
      positivas += c.positivo;
    }
  }
  const bonusColocacion = Math.min(p.topeColocacion, colocacionPerfectas * p.colocacionPerfecta);
  const puntos = redondear2(directos * p.directo + perfectas * p.recepcionDefensaPerfecta + positivas * p.recepcionDefensaPositiva + bonusColocacion - errores * p.error);
  return { puntos, directos, perfectas, errores, jugadas };
}

// El MVP de un torneo (o de todos, con `torneoId` null), opcionalmente de una sola posición (`grupo`).
// Devuelve TODAS las jugadoras con partidos válidos, ordenadas: la primera es la MVP.
// Cada fila: { jugadorId, partidos, puntos, promedio, directos, errores, mejorPartido: { partidoId, puntos }, puesto }.
export function mvpDeActuaciones(acts, { torneoId = null, grupo = null, pesos = PESOS_MVP_POR_DEFECTO } = {}) {
  const porJugadora = new Map();
  for (const a of acts) {
    if (torneoId != null && a.torneoId !== torneoId) continue;
    if (grupo != null && a.grupo !== grupo) continue;
    const minimo = a.grupo === 'libero' ? MIN_JUGADAS_MVP_LIBERO : MIN_JUGADAS_MVP;
    const r = puntosDeImpactoDeConteos(a.conteos, pesos);
    if (r.jugadas < minimo) continue;
    const fila = porJugadora.get(a.jugadorId) ?? { jugadorId: a.jugadorId, partidos: 0, puntos: 0, directos: 0, errores: 0, mejorPartido: null, posiciones: new Set() };
    fila.partidos += 1;
    fila.puntos += r.puntos;
    fila.directos += r.directos;
    fila.errores += r.errores;
    fila.posiciones.add(a.grupo);
    if (!fila.mejorPartido || r.puntos > fila.mejorPartido.puntos) fila.mejorPartido = { partidoId: a.partidoId, puntos: r.puntos };
    porJugadora.set(a.jugadorId, fila);
  }
  return [...porJugadora.values()]
    .map((f) => ({ ...f, puntos: redondear2(f.puntos), promedio: redondear2(f.puntos / f.partidos), posiciones: [...f.posiciones] }))
    .sort((a, b) => b.puntos - a.puntos || a.errores - b.errores || b.partidos - a.partidos || a.jugadorId - b.jugadorId)
    .map((f, i) => ({ ...f, puesto: i + 1 }));
}

const coma = (n) => String(n).replace('.', ',');
export const textoPuntos = (n) => coma(n);
export const textoPromedio = (n) => `${coma(n)} por partido`;

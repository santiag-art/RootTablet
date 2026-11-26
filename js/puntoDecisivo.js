// Punto de set y punto de partido: ¿qué equipo cierra el set (o el partido) si anota el próximo punto?
// Son funciones puras (sin pantalla). Se apoyan en las mismas reglas del marcador que usa Roots: 25 puntos (15 en el set
// decisivo) y 2 de diferencia, así que 24-24 no es punto de set pero 25-24 sí.
import { errorMarcadorSet } from './reglas/reglasSet.js';

const CLAVE_VIBRACION = 'roots-vibracion';

const esNatural = (n) => Number.isInteger(n) && n >= 0;

// Devuelve { tipo, lado }:
//   tipo 'partido' → quien anote el próximo punto gana el partido     tipo 'set' → gana el set
//   tipo 'cerrado' → el marcador ya es de un set terminado (falta guardarlo)     tipo null → nada especial
export function puntoDecisivo({ numeroSet, totalSets, setsParaGanar, puntosLocal, puntosVisitante, setsLocal = 0, setsVisitante = 0 }) {
  const ninguno = { tipo: null, lado: null };
  if (![numeroSet, totalSets, setsParaGanar, puntosLocal, puntosVisitante, setsLocal, setsVisitante].every(esNatural)) return ninguno;
  if (numeroSet < 1 || numeroSet > totalSets) return ninguno;
  if (!errorMarcadorSet({ numeroSet, totalSets, puntosLocal, puntosVisitante })) return { tipo: 'cerrado', lado: null };
  const minimo = numeroSet === totalSets ? 15 : 25;
  const lados = [
    { lado: 'local', puntos: puntosLocal, rival: puntosVisitante, sets: setsLocal },
    { lado: 'visitante', puntos: puntosVisitante, rival: puntosLocal, sets: setsVisitante },
  ];
  for (const { lado, puntos, rival, sets } of lados) {
    // Con un punto más, ¿llega al mínimo y le saca 2 al rival?
    if (puntos + 1 >= minimo && puntos + 1 - rival >= 2) return { tipo: sets + 1 >= setsParaGanar ? 'partido' : 'set', lado };
  }
  return ninguno;
}

// Lo mismo, leyendo los datos derivados que ya arma la pantalla del partido.
export function puntoDecisivoDelPartido(d, act) {
  return puntoDecisivo({
    numeroSet: d.numeroSetActual,
    totalSets: d.totalSets,
    setsParaGanar: d.setsParaGanar,
    puntosLocal: act.puntosLocal,
    puntosVisitante: act.puntosVisitante,
    setsLocal: d.setsLocal,
    setsVisitante: d.setsVisitante,
  });
}

export const TEXTO_DECISIVO = { set: 'PUNTO DE SET', partido: 'PUNTO DE PARTIDO' };

// ─────────────── Vibración al sumar un punto ───────────────
// Se puede apagar desde el menú del partido. Viene activada.
export function vibracionActivada(almacen = globalThis.localStorage) {
  try {
    return JSON.parse(almacen.getItem(CLAVE_VIBRACION) ?? '{}').activa !== false;
  } catch {
    return true;
  }
}

export function guardarVibracionActivada(activa, almacen = globalThis.localStorage) {
  try {
    almacen.setItem(CLAVE_VIBRACION, JSON.stringify({ activa: activa !== false }));
  } catch {
    /* sin almacenamiento local: vale solo para esta sesión */
  }
}

// Patrón (milisegundos de vibración y pausa) según cómo quedó el marcador después del punto.
// Punto normal: un toque corto. Set cerrado: doble. Punto de set: triple. Punto de partido: el más largo.
export function patronDeVibracion(situacion) {
  switch (situacion?.tipo) {
    case 'partido':
      return [160, 70, 160, 70, 320];
    case 'set':
      return [90, 60, 90, 60, 90];
    case 'cerrado':
      return [70, 50, 70];
    default:
      return [25];
  }
}

export function vibrar(patron, nav = globalThis.navigator) {
  try {
    return Boolean(nav?.vibrate?.(patron));
  } catch {
    return false; // sin vibración (iPad, escritorio...)
  }
}

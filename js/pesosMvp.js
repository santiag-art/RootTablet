// Pesos de la fórmula del MVP que la entrenadora puede cambiar desde Ajustes → «Puntos del MVP», sin tocar código.
// Los valores por defecto son los de siempre (`PESOS_MVP_POR_DEFECTO` en js/mvp.js). Lo que se cambia queda en la tabla `meta`
// (clave `pesos-mvp`), viaja en la copia de seguridad y vale para TODOS los partidos: el MVP de cada partido y el del torneo se recalculan.
// El mínimo de jugadas para entrar (3, o 8 la líbero) no se cambia aquí. Funciones puras salvo las que reciben el almacén.
import { PESOS_MVP_POR_DEFECTO, textoPuntos } from './mvp.js';

export const CLAVE_PESOS_MVP = 'pesos-mvp'; // en la tabla meta: { clave: 'pesos-mvp', pesos: {...} }

// Lo que se puede cambiar, en el orden en que sale en pantalla. `paso` = lo que suman los botones − y +.
export const CAMPOS_PESO = Object.freeze([
  { clave: 'directo', etiqueta: 'Punto directo', ayuda: 'Ataque, saque o bloqueo que gana el punto', min: 0, max: 5, paso: 0.25 },
  { clave: 'recepcionDefensaPerfecta', etiqueta: 'Recepción o defensa perfecta', ayuda: 'Calificación doble positivo', min: 0, max: 2, paso: 0.05 },
  { clave: 'recepcionDefensaPositiva', etiqueta: 'Recepción o defensa positiva', ayuda: 'Calificación positivo', min: 0, max: 1, paso: 0.05 },
  { clave: 'colocacionPerfecta', etiqueta: 'Colocación perfecta', ayuda: 'Cada colocación con pase perfecto', min: 0, max: 2, paso: 0.05 },
  { clave: 'topeColocacion', etiqueta: 'Tope de colocación por partido', ayuda: 'Lo máximo que suma la colocación en un partido', min: 0, max: 20, paso: 0.5 },
  { clave: 'error', etiqueta: 'Resta por cada error', ayuda: 'En cualquier fundamento', min: 0, max: 5, paso: 0.25 },
]);

const redondear2 = (n) => Math.round(n * 100) / 100;

// Texto escrito por la persona («0,5» o «0.5») -> número, o null si no se entiende.
export function leerNumero(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  const t = String(texto ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Revisa lo que escribió la persona. Devuelve { pesos, errores: [{ clave, mensaje }] }; lo inválido queda con el valor por defecto en `pesos`.
export function validarPesos(entrada) {
  const pesos = { ...PESOS_MVP_POR_DEFECTO };
  const errores = [];
  for (const c of CAMPOS_PESO) {
    const n = leerNumero(entrada?.[c.clave]);
    if (n == null) errores.push({ clave: c.clave, mensaje: `«${c.etiqueta}»: escribe un número.` });
    else if (n < c.min || n > c.max) errores.push({ clave: c.clave, mensaje: `«${c.etiqueta}»: debe estar entre ${textoPuntos(c.min)} y ${textoPuntos(c.max)}.` });
    else pesos[c.clave] = redondear2(n);
  }
  return { pesos, errores };
}

// Para leer lo guardado: cualquier valor dañado vuelve al de siempre, sin avisos.
export function normalizarPesos(entrada) {
  return validarPesos(entrada).pesos;
}

export function sonLosPorDefecto(pesos) {
  return CAMPOS_PESO.every((c) => redondear2(pesos?.[c.clave] ?? PESOS_MVP_POR_DEFECTO[c.clave]) === PESOS_MVP_POR_DEFECTO[c.clave]);
}

// Lo guardado en la tabla meta (todas sus filas) -> pesos vigentes.
export function leerPesosMvp(filasMeta) {
  const fila = (filasMeta ?? []).find((f) => f?.clave === CLAVE_PESOS_MVP);
  return fila?.pesos ? normalizarPesos(fila.pesos) : { ...PESOS_MVP_POR_DEFECTO };
}

// Guarda los pesos (si son los de siempre, borra la fila). Devuelve los pesos ya normalizados.
export async function guardarPesosMvp(almacen, pesos) {
  const normales = normalizarPesos(pesos);
  if (sonLosPorDefecto(normales)) await almacen.borrar('meta', CLAVE_PESOS_MVP);
  else await almacen.guardar('meta', { clave: CLAVE_PESOS_MVP, pesos: normales });
  await almacen.pendientes();
  return normales;
}

// Frases para la entrenadora (resumen del partido y ranking del torneo), con los pesos vigentes.
export function frasesDeFormula(pesos = PESOS_MVP_POR_DEFECTO) {
  const p = normalizarPesos(pesos);
  const t = textoPuntos;
  return {
    directos: `+${t(p.directo)} por punto directo de ataque, saque o bloqueo · +${t(p.recepcionDefensaPerfecta)} por recepción o defensa perfecta · +${t(p.recepcionDefensaPositiva)} por recepción o defensa positiva.`,
    colocacion: `+${t(p.colocacionPerfecta)} por colocación perfecta, hasta ${t(p.topeColocacion)} puntos por partido (para no ganar solo por tocar más el balón).`,
    errores: `−${t(p.error)} por cada error, en cualquier fundamento.`,
  };
}

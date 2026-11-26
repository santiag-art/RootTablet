// Recordatorio de cierre: un partido terminado debe salir de la tablet de dos formas, los resultados para Roots y la copia de
// seguridad. Aquí se calcula qué falta de cada partido terminado. Funciones puras (sin pantalla).
import { estaTerminado } from './motor.js';

export const PREFIJO_RESULTADOS = 'resultados-'; // en la tabla meta: { clave: 'resultados-<id>', fecha } = cuándo se exportó ese partido

// Un partido terminado con al menos un set guardado, al que le falta exportar los resultados (nunca se exportó, o cambió
// después de exportarlo) o la copia de seguridad (nunca se hizo, o cambió después de la última).
// `resultadosEn`: Map id → fecha ISO de la última exportación de resultados de ese partido.
export function pendientesDeCierre(partidos, { ultimaCopia = null, resultadosEn = new Map() } = {}) {
  const salida = [];
  for (const registro of partidos) {
    const est = registro.est;
    if (!est || !estaTerminado(est) || est.sets.length === 0) continue;
    const cambio = est.actualizadoEn ?? '';
    const exportado = resultadosEn.get(registro.id);
    const sinResultados = !exportado || cambio > exportado;
    const sinCopia = !ultimaCopia || cambio > ultimaCopia;
    if (sinResultados || sinCopia) salida.push({ registro, sinResultados, sinCopia });
  }
  return salida;
}

// «Falta exportar los resultados y guardar la copia.» según lo que falte de verdad.
export function textoFalta({ sinResultados, sinCopia }) {
  if (sinResultados && sinCopia) return 'exportar los resultados y guardar la copia';
  return sinResultados ? 'exportar los resultados' : 'guardar la copia';
}

export async function marcarResultadosExportados(almacen, ids, fechaISO) {
  for (const id of ids) await almacen.guardar('meta', { clave: `${PREFIJO_RESULTADOS}${id}`, fecha: fechaISO });
}

export function leerResultadosExportados(filasMeta) {
  return new Map(filasMeta.filter((f) => String(f.clave).startsWith(PREFIJO_RESULTADOS)).map((f) => [Number(String(f.clave).slice(PREFIJO_RESULTADOS.length)), f.fecha]));
}

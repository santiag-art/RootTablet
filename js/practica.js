// Modo práctica: una base de datos APARTE (con partidos de ejemplo) para ensayar sin tocar los datos reales.
// Lo de práctica nunca se mezcla con la tablet de verdad: tiene su propio almacén y no sale en resultados ni copias.
import { aplicarImportacion, leerArchivoRoots } from './importar.js';

export const NOMBRE_BD_PRACTICA = 'roots-tablet-practica';
export const ARCHIVO_MUESTRA = 'data/muestra-practica.json';

export async function cargarMuestra(buscar = globalThis.fetch) {
  const r = await buscar(ARCHIVO_MUESTRA);
  if (!r.ok) throw new Error('No encontré los datos de ejemplo.');
  return r.text();
}

// Si el almacén de práctica está vacío, le carga los partidos de ejemplo. Devuelve si cargó algo.
export async function prepararPractica(almacen, textoMuestra) {
  if ((await almacen.todos('partidos')).length > 0) return false;
  await aplicarImportacion(almacen, leerArchivoRoots(textoMuestra), { nombreArchivo: 'muestra-practica.json' });
  await almacen.pendientes();
  return true;
}

// Borra todo lo de práctica y vuelve a dejar los partidos de ejemplo como nuevos.
export async function reiniciarPractica(almacen, textoMuestra) {
  await almacen.vaciar();
  await almacen.pendientes();
  return prepararPractica(almacen, textoMuestra);
}

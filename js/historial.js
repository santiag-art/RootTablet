// Historial de jugadoras que se conserva aunque el partido se quite de la tablet. Al exportar y quitar un partido, antes de
// borrarlo se guarda un resumen compacto (quién jugó, de qué posición y sus jugadas por fundamento, más el marcador y el rival).
// Así el ranking y la evolución por torneo siguen acumulando. Funciones puras salvo `archivarPartidos`.
// Roots ya recibe las jugadas completas en el archivo de resultados: este resumen NO viaja a Roots (no se cuenta dos veces).
import { actuacionesDeRegistros } from './ranking.js';
import { rivalDeRegistro } from './puntosRival.js';

export const PREFIJO_HISTORIAL = 'historial-'; // en la tabla meta: { clave: 'historial-<id>', ... }

// El resumen de un partido para guardar. null si no tiene nada que conservar (sin jugadas ni sets).
export function resumenParaArchivo(registro, jugadoresPorId) {
  if (!registro?.est) return null;
  const actuaciones = actuacionesDeRegistros([registro], jugadoresPorId);
  const lado = registro.est.ladoPropio === 'visitante' ? 'visitante' : 'local';
  const sets = registro.est.sets.map((s) => [lado === 'local' ? s.puntosLocal : s.puntosVisitante, lado === 'local' ? s.puntosVisitante : s.puntosLocal]);
  if (!actuaciones.length && !sets.length) return null;
  return {
    clave: `${PREFIJO_HISTORIAL}${registro.id}`,
    partidoId: registro.id,
    torneoId: registro.torneoId,
    fecha: registro.fecha ?? '',
    hora: registro.hora ?? '',
    rival: String(rivalDeRegistro(registro) ?? '').trim(),
    sets,
    actuaciones,
    archivadoEn: new Date().toISOString(),
  };
}

export async function archivarPartidos(almacen, registros, jugadoresPorId) {
  const filas = registros.map((r) => resumenParaArchivo(r, jugadoresPorId)).filter(Boolean);
  await almacen.guardarVarios('meta', filas);
  return filas;
}

export const filasDeHistorial = (filasMeta) => filasMeta.filter((f) => String(f.clave).startsWith(PREFIJO_HISTORIAL));

// De las filas archivadas a lo que usa el ranking: registros mínimos (solo marcador y rival, sin jugadas) y sus actuaciones.
// Si el partido volvió a la tablet (se importó de nuevo desde Roots), manda el de la tablet y el archivado se ignora.
export function historialParaRanking(filas, idsEnTablet = new Set()) {
  const vigentes = filas.filter((f) => !idsEnTablet.has(f.partidoId));
  return {
    registros: vigentes.map((f) => ({
      id: f.partidoId,
      torneoId: f.torneoId,
      fecha: f.fecha,
      hora: f.hora,
      equipoLocal: 'Roots',
      equipoVisitante: f.rival,
      archivado: true,
      est: { ladoPropio: 'local', sets: f.sets.map(([propios, rival], i) => ({ numeroSet: i + 1, puntosLocal: propios, puntosVisitante: rival })), actual: { eventos: [] }, posiciones: {} },
    })),
    actuaciones: vigentes.flatMap((f) => f.actuaciones),
  };
}

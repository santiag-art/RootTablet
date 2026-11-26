// Estado compartido de la app: lo que hay guardado en la tablet, en memoria para dibujar rápido.
import { borrarEspejo, guardarEspejo } from './borrador.js';
import { disponibilidadPorJugador } from './reglas/disponibilidad.js';
import { archivarPartidos, filasDeHistorial } from './historial.js';
import { leerResultadosExportados } from './recordatorio.js';

export const VERSION = '1.29.0'; // debe coincidir con VERSION de sw.js (roots-tablet-v + este número); tests/pwa.test.js lo verifica

export const app = {
  version: VERSION,
  almacen: null,
  practica: false, // true = modo práctica: otro almacén, con datos de ejemplo; nada de aquí sale de la tablet
  almacenReal: null, // el almacén de verdad, guardado mientras se practica
  almacenPractica: null,
  alFallarAlmacen: () => {},
  torneos: new Map(),
  jugadores: new Map(),
  lesiones: new Map(), // jugadorId -> { disponibilidad, zonas }
  partidos: new Map(),
  ultimaCopia: null, // fecha ISO de la última copia de seguridad
  ultimoBorrador: null, // fecha ISO del último borrador exportado
  historial: [], // resúmenes de partidos ya exportados y quitados de la tablet (alimentan el ranking)
  resultadosEn: new Map(), // id de partido -> fecha ISO en que se exportaron sus resultados para Roots
  guardado: { estado: 'ok', hora: null }, // estado de la última escritura: 'ok' | 'error'
  alCambiarGuardado: () => {}, // la pantalla lo usa para actualizar el indicador "Guardado"
  persistente: null, // ¿el navegador prometió no borrar los datos?
  instalar: null, // evento "beforeinstallprompt" guardado para el botón Instalar
  actualizacion: null, // service worker nuevo esperando
  renderizar: () => {},
};

export async function cargarDatos() {
  const a = app.almacen;
  const [torneos, jugadores, lesiones, partidos] = await Promise.all([a.todos('torneos'), a.todos('jugadores'), a.todos('lesiones'), a.todos('partidos')]);
  app.torneos = new Map(torneos.map((t) => [t.id, t]));
  app.jugadores = new Map(jugadores.map((j) => [j.id, j]));
  app.lesiones = disponibilidadPorJugador(lesiones.flatMap((f) => f.lesiones.map((l) => ({ ...l, jugadorId: f.jugadorId }))));
  app.partidos = new Map(partidos.map((p) => [p.id, p]));
  app.ultimaCopia = (await a.uno('meta', 'ultimaCopia'))?.fecha ?? null;
  app.ultimoBorrador = (await a.uno('meta', 'ultimoBorrador'))?.fecha ?? null;
  const filasMeta = await a.todos('meta');
  app.resultadosEn = leerResultadosExportados(filasMeta);
  app.historial = filasDeHistorial(filasMeta);
}

// Guarda el partido en el almacén de la tablet y, además, en el espejo (segundo seguro). Se llama en cada jugada.
export function guardarPartido(registro) {
  registro.est.actualizadoEn = new Date().toISOString();
  app.partidos.set(registro.id, registro);
  espejar(registro);
  const guardado = app.almacen.guardar('partidos', registro);
  guardado.then(
    () => {
      app.guardado = { estado: 'ok', hora: new Date() };
      app.alCambiarGuardado();
    },
    () => {
      app.guardado = { estado: 'error', hora: app.guardado.hora };
      app.alCambiarGuardado();
    }
  );
  return guardado;
}

// Vuelve a escribir el partido tal como está (sin cambiar su fecha de modificación). Sirve al cerrar la app.
export function reforzarGuardado(registro) {
  espejar(registro);
  return app.almacen.guardar('partidos', registro).catch(() => {});
}

function espejar(registro) {
  if (app.practica) return; // el espejo es solo de la tablet de verdad
  guardarEspejo(registro, { torneos: [...app.torneos.values()], jugadores: [...app.jugadores.values()], versionApp: app.version });
}

// `archivar`: antes de borrar, guarda lo que cuenta para el ranking (solo al exportar y quitar, no al borrar a mano).
export async function borrarPartidos(ids, { archivar = false } = {}) {
  if (archivar) {
    const filas = await archivarPartidos(app.almacen, ids.map((id) => app.partidos.get(id)).filter(Boolean), app.jugadores);
    const claves = new Set(filas.map((f) => f.clave));
    app.historial = [...app.historial.filter((f) => !claves.has(f.clave)), ...filas];
  }
  ids.forEach((id) => app.partidos.delete(id));
  if (!app.practica) borrarEspejo(ids);
  await app.almacen.borrarVarios('partidos', ids);
}

// Jugadores del género del torneo, por número de camiseta.
export function jugadoresDeTorneo(torneoId) {
  const torneo = app.torneos.get(torneoId);
  return [...app.jugadores.values()]
    .filter((j) => j.genero === torneo?.genero)
    .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nombre.localeCompare(b.nombre));
}

export function irA(ruta) {
  if (location.hash === ruta) app.renderizar();
  else location.hash = ruta;
}

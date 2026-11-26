// Mini cancha de la pestaña Acciones: quién está en cada zona ahora y quién saca. Solo se mira, no se toca nada.
// Se actualiza sola porque se vuelve a dibujar con cada cambio del partido (rotación, cambio, entrada de líbero).
import { FILAS_CANCHA } from '../reglas/rotaciones.js';
import { h, icono } from './dom.js';
import { circuloJugador, circuloVacio } from './piezas.js';

const CLAVE = 'roots-mini-cancha-oculta';
const leerOculta = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; } };
const guardarOculta = (v) => { try { localStorage.setItem(CLAVE, v ? '1' : '0'); } catch { /* sin almacenamiento: queda solo en esta sesión */ } };
let oculta = leerOculta();

// `elegidaId`: la jugadora seleccionada en Acciones, que se resalta también en la cancha.
export function miniCancha(V, elegidaId = null) {
  const { d, est } = V;
  const act = est.actual;
  if (oculta) {
    return h('button', { class: 'mini-cancha-pill', 'aria-label': 'Mostrar la mini cancha', onclick: () => { oculta = false; guardarOculta(false); V.pintar(); } }, icono('rotar', { tam: 18 }), ' Cancha');
  }
  const sacamos = act.saca === 'local';
  const casilla = (p) => {
    const id = act.slots[p - 1];
    const quien = id == null ? 'vacía' : d.nombre(id);
    return h(
      'div',
      { class: `mc-casilla ${id != null && id === elegidaId ? 'elegida' : ''}`, 'data-pos': String(p), title: `P${p}: ${quien}`, 'aria-label': `P${p}: ${quien}${p === 1 && sacamos ? ', saca' : ''}` },
      h('span', { class: 'mc-pos' }, `P${p}`),
      id == null ? circuloVacio('') : circuloJugador(V, id, { activo: false, etiquetaLibero: false }),
      p === 1 && sacamos ? h('span', { class: 'mc-saque', title: 'Saca' }, 'S') : null
    );
  };
  return h(
    'div',
    { class: 'mini-cancha', role: 'group', 'aria-label': 'Posiciones en la cancha' },
    h('button', { class: 'mc-ocultar', 'aria-label': 'Ocultar la mini cancha', onclick: () => { oculta = true; guardarOculta(true); V.pintar(); } }, icono('cerrar', { tam: 14, grueso: 3 })),
    h('div', { class: 'mc-red' }, 'Red'),
    FILAS_CANCHA.map((f) => h('div', { class: 'mc-fila' }, f.posiciones.map(casilla)))
  );
}

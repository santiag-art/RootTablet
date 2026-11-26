// Reloj del partido en la barra: cuánto lleva el set y cuánto lleva el partido (ver js/duracion.js).
// Un solo temporizador actualiza todos los relojes que estén en pantalla y se apaga cuando no queda ninguno.
import { duracionDePartido, formatoDuracion, formatoReloj, segundosDesde } from '../duracion.js';
import { estaTerminado } from '../motor.js';
import { h } from './dom.js';

const relojes = new Map(); // elemento -> función que lo pinta
let temporizador = null;

function tic() {
  for (const [el, pintar] of relojes) {
    if (!el.isConnected) relojes.delete(el);
    else pintar(el);
  }
  if (relojes.size === 0) {
    clearInterval(temporizador);
    temporizador = null;
  }
}

// Lo que se muestra según cómo va el partido: { set, partido } en juego, { total } al terminar, o null sin puntos.
export function datosDelReloj(est, ahora = new Date()) {
  const act = est.actual;
  if (estaTerminado(est)) {
    const total = duracionDePartido(est.sets);
    return total == null ? null : { total };
  }
  if (act.puntosLocal + act.puntosVisitante === 0 || !act.relojInicio) {
    // Entre sets: el reloj del partido sigue contando desde el primer punto.
    const inicio = est.sets.find((s) => s.inicioEn)?.inicioEn;
    return inicio ? { partido: segundosDesde(inicio, ahora) } : null;
  }
  const inicioPartido = est.sets.find((s) => s.inicioEn)?.inicioEn ?? act.relojInicio;
  return { set: segundosDesde(act.relojInicio, ahora), partido: segundosDesde(inicioPartido, ahora) };
}

// forma 'centro': dos líneas (Set / Partido) en el marcador; forma 'linea': una sola, para pantallas angostas.
export function relojPartido(reg, forma) {
  const pintar = (el) => {
    const d = datosDelReloj(reg.est);
    el.hidden = d == null;
    if (!d) return;
    el.replaceChildren();
    if (forma === 'centro') {
      if (d.total != null) el.append(h('span', {}, 'Duración'), h('b', {}, formatoDuracion(d.total)));
      else {
        if (d.set != null) el.append(h('span', {}, 'Set ', h('b', {}, formatoReloj(d.set))));
        if (d.set != null && d.partido != null) el.append(h('i', { 'aria-hidden': 'true' }, ' · '));
        if (d.partido != null) el.append(h('span', {}, 'Partido ', h('b', {}, formatoReloj(d.partido))));
      }
    } else {
      el.append(d.total != null ? `⏱ ${formatoDuracion(d.total)}` : `⏱ ${[d.set, d.partido].filter((x) => x != null).map(formatoReloj).join(' · ')}`);
    }
  };
  const el = h('div', { class: `reloj-partido reloj-${forma}`, title: 'Tiempo del set y del partido', role: 'timer', 'aria-label': 'Tiempo del set y del partido' });
  pintar(el);
  if (!estaTerminado(reg.est)) {
    relojes.set(el, pintar);
    if (!temporizador) temporizador = setInterval(tic, 1000);
  }
  return el;
}

// Capa del candado de toques (ver js/candado.js). Vive en el <body>, así sigue ahí aunque la pantalla se redibuje.
import { MS_MANTENER } from '../candado.js';
import { h, icono } from './dom.js';

let capa = null;
let alDesbloquear = null;

export function estaBloqueado() {
  return capa != null;
}

export function desbloquear() {
  if (!capa) return;
  capa.remove();
  capa = null;
  window.removeEventListener('hashchange', desbloquear);
  const fn = alDesbloquear;
  alDesbloquear = null;
  fn?.();
}

// resumen: { titulo, local, visitante, puntosLocal, puntosVisitante, set, setsLocal, setsVisitante }
export function bloquearToques(resumen, { alAbrir = null } = {}) {
  if (capa) return;
  alDesbloquear = alAbrir;
  let temporizador = null;
  const boton = h('button', { class: 'candado-boton', 'aria-label': 'Mantén pulsado para desbloquear' }, icono('candado', { tam: 34 }), h('span', {}, 'Mantén pulsado para desbloquear'), h('i', { class: 'candado-barra' }));
  const empezar = () => {
    if (temporizador) return;
    boton.classList.add('mantiene');
    temporizador = setTimeout(desbloquear, MS_MANTENER);
  };
  const soltar = () => {
    clearTimeout(temporizador);
    temporizador = null;
    boton.classList.remove('mantiene');
  };
  boton.addEventListener('pointerdown', (e) => { e.preventDefault(); empezar(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) boton.addEventListener(ev, soltar);
  boton.addEventListener('contextmenu', (e) => e.preventDefault());
  boton.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); empezar(); } });
  boton.addEventListener('keyup', soltar);

  const lado = (nombre, puntos, sets) => h('div', { class: 'candado-eq' }, h('strong', {}, nombre), h('b', {}, puntos), h('small', {}, `${sets} ${sets === 1 ? 'set' : 'sets'}`));
  capa = h(
    'div',
    { class: 'candado-capa', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pantalla bloqueada' },
    h('div', { class: 'candado-info' }, h('p', { class: 'candado-titulo' }, 'Pantalla bloqueada'), h('p', { class: 'candado-sub' }, `${resumen.titulo} · Set ${resumen.set}`)),
    h('div', { class: 'candado-marcador' }, lado(resumen.local, resumen.puntosLocal, resumen.setsLocal), h('span', { class: 'candado-guion' }, '–'), lado(resumen.visitante, resumen.puntosVisitante, resumen.setsVisitante)),
    boton
  );
  // Todo toque fuera del botón se ignora.
  for (const ev of ['click', 'pointerdown', 'touchstart']) capa.addEventListener(ev, (e) => { if (!boton.contains(e.target)) e.stopPropagation(); });
  document.body.append(capa);
  window.addEventListener('hashchange', desbloquear);
  boton.focus();
}

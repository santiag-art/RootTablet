// Ayuda: el manual de usuario dentro de la app. Arriba, el PDF completo (con capturas); abajo, la guía corta por secciones.
import { ARCHIVO_MANUAL, SECCIONES, VERSION_MANUAL } from '../ayudaContenido.js';
import { abrirVentana } from './aviso.js';
import { h, icono } from './dom.js';

function bloque(b) {
  if (b.p) return h('p', { class: 'ayuda-p' }, b.p);
  if (b.pasos) return h('ol', { class: 'ayuda-pasos' }, b.pasos.map((t) => h('li', {}, t)));
  if (b.lista) return h('ul', { class: 'ayuda-lista' }, b.lista.map((t) => h('li', {}, t)));
  if (b.consejo) return h('div', { class: 'ayuda-recuadro ayuda-consejo' }, h('strong', {}, 'Consejo: '), b.consejo);
  if (b.alerta) return h('div', { class: 'ayuda-recuadro ayuda-alerta' }, h('strong', {}, 'Ojo: '), b.alerta);
  if (b.tabla) return h('dl', { class: 'ayuda-tabla' }, b.tabla.map(([a, d]) => [h('dt', {}, a), h('dd', {}, d)]));
  return null;
}

export function abrirAyuda() {
  const secciones = SECCIONES.map((s, i) =>
    h('details', { class: 'ayuda-seccion', 'data-seccion': s.id }, h('summary', {}, h('span', { class: 'ayuda-num' }, String(i + 1)), h('span', { class: 'ayuda-tit' }, h('strong', {}, s.titulo), h('small', {}, s.sub))), h('div', { class: 'ayuda-cuerpo' }, s.bloques.map(bloque)))
  );
  const contenido = h(
    'div',
    { class: 'ayuda' },
    h(
      'a',
      { class: 'btn btn-primario btn-ancho btn-grande', href: ARCHIVO_MANUAL, target: '_blank', rel: 'noopener', 'data-manual-pdf': '' },
      icono('documento', { tam: 20 }),
      ` Abrir el manual completo (PDF, v${VERSION_MANUAL})`
    ),
    h('p', { class: 'nota' }, 'El PDF trae las capturas y funciona sin internet. Aquí abajo está la guía corta, con lo más nuevo de la app.'),
    h('div', { class: 'ayuda-secciones' }, secciones)
  );
  return abrirVentana({ titulo: 'Ayuda', subtitulo: 'Cómo usar Roots Tablet en un día de partido', ancho: 'grande', contenido, acciones: [{ texto: 'Cerrar', tipo: 'primario' }] });
}

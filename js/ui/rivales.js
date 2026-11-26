// Pantallas de rivales: la lista de equipos contra los que ya se jugó y el historial de cada uno (partidos, cómo anota,
// mapa de calor de sus ataques con todos los partidos juntos).
import { app, irA } from '../contexto.js';
import { rivalesConHistorial } from '../historialRival.js';
import { normalizarNombre } from '../nuevoPartido.js';
import { fechaCorta, horaCorta, textoDeSets } from '../resumen.js';
import { compartirScouting, descargarScoutingPdf, prepararScouting } from '../reporteScouting.js';
import { puedeCompartirArchivos } from '../resumenCompartir.js';
import { toast } from './aviso.js';
import { h, icono } from './dom.js';
import { bloqueDetalleRival } from './puntoRival.js';

export const rutaDeRival = (clave) => `#/rival/${encodeURIComponent(clave)}`;
const todos = () => rivalesConHistorial([...app.partidos.values()], normalizarNombre);

const textoRecord = (r) => {
  if (r.ganados + r.perdidos + r.empatados === 0) return 'sin sets guardados todavía';
  const partes = [`${r.ganados} ${r.ganados === 1 ? 'ganado' : 'ganados'}`, `${r.perdidos} ${r.perdidos === 1 ? 'perdido' : 'perdidos'}`];
  if (r.empatados) partes.push(`${r.empatados} ${r.empatados === 1 ? 'empatado' : 'empatados'}`);
  return partes.join(' · ');
};

function cabecera(titulo, subtitulo, atras) {
  return h('header', { class: 'inicio-cabeza' }, h('button', { class: 'btn-icono', 'aria-label': 'Volver', onclick: () => irA(atras) }, icono('atras')), h('div', { class: 'inicio-titulo' }, h('h1', {}, titulo), h('p', {}, subtitulo)));
}

export function vistaRivales() {
  const lista = todos();
  const cuerpo = lista.length
    ? h(
        'div',
        { class: 'lista-opciones', 'data-lista-rivales': '' },
        lista.map((r) =>
          h(
            'button',
            { class: 'opcion', 'data-rival': r.clave, onclick: () => irA(rutaDeRival(r.clave)) },
            h('span', { class: 'datos' }, h('strong', {}, r.nombre), h('small', {}, `${r.partidos.length} ${r.partidos.length === 1 ? 'partido' : 'partidos'} · ${textoRecord(r)}`), h('small', {}, r.resumen.conDetalle > 0 ? `${r.resumen.conDetalle} de ${r.resumen.total} puntos del rival con detalle` : 'Sin detalle de cómo anota todavía'))
          )
        )
      )
    : h('div', { class: 'vacio' }, h('h2', {}, 'Todavía no hay rivales'), h('p', { class: 'nota' }, 'Cuando importes o crees un partido, el rival aparecerá aquí con su historial.'));
  return h('div', { class: 'inicio' }, cabecera('Rivales', 'Historial y cómo anota cada equipo', '#/'), h('main', { class: 'inicio-cuerpo' }, cuerpo));
}

// Reporte de scouting en PDF (una hoja A4 para imprimir antes del partido). Se recuerda solo mientras se mira ese rival.
const VISTA = { clave: null, ocupado: null, vistaPrevia: null };

function tarjetaScouting(r) {
  if (VISTA.clave !== r.clave) Object.assign(VISTA, { clave: r.clave, ocupado: null, vistaPrevia: null });
  const puedeCompartir = puedeCompartirArchivos();
  const ejecutar = async (accion, trabajo, avisoOk) => {
    if (VISTA.ocupado) return;
    const clave = r.clave;
    VISTA.ocupado = accion;
    app.renderizar();
    try {
      const reporte = await prepararScouting(r);
      await trabajo(reporte);
      if (avisoOk) toast(avisoOk, 'ok', 4000);
    } catch (err) {
      if (err?.name !== 'AbortError') toast(err?.message || 'No se pudo generar el reporte.', 'error'); // AbortError = cerró el menú de compartir
    } finally {
      if (VISTA.clave === clave) VISTA.ocupado = null;
      app.renderizar();
    }
  };
  const vista = () =>
    VISTA.vistaPrevia
      ? (() => { VISTA.vistaPrevia = null; app.renderizar(); })()
      : ejecutar('vista', async (rep) => { VISTA.vistaPrevia = rep.canvas.toDataURL('image/png'); });
  const texto = (accion, normal, ocupado) => (VISTA.ocupado === accion ? ocupado : normal);
  const bloqueo = Boolean(VISTA.ocupado);
  return h(
    'div',
    { class: 'tarjeta tarjeta-scouting', 'data-tarjeta-scouting': '' },
    h('div', { class: 'titulo-grupo' }, 'Reporte de scouting'),
    h('p', { class: 'nota' }, `Una hoja A4 con cómo les ha ido contra ${r.nombre}, cómo rinde Roots, el mapa de calor de sus ataques y qué trabajar antes del partido. Para imprimir.`),
    h(
      'div',
      { class: 'resumen-compartir-botones', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn-primario', 'data-scouting-pdf': '', disabled: bloqueo, onclick: () => ejecutar('pdf', descargarScoutingPdf, 'PDF descargado. Ábrelo para imprimirlo.') }, texto('pdf', 'Descargar PDF', 'Generando…')),
      puedeCompartir ? h('button', { class: 'btn', disabled: bloqueo, onclick: () => ejecutar('compartir', compartirScouting) }, texto('compartir', 'Compartir o imprimir…', 'Abriendo…')) : null,
      h('button', { class: 'btn btn-fantasma', disabled: bloqueo, onclick: vista }, texto('vista', VISTA.vistaPrevia ? 'Ocultar vista previa' : 'Ver vista previa', 'Generando…'))
    ),
    VISTA.vistaPrevia ? h('img', { class: 'resumen-vista-previa', 'data-vista-scouting': '', src: VISTA.vistaPrevia, alt: `Vista previa del reporte de scouting de ${r.nombre}`, style: { display: 'block', width: '100%', maxWidth: '520px', margin: '14px auto 0', borderRadius: '14px', border: '1px solid var(--borde, #cbd5e1)' } }) : null
  );
}

export function vistaRival(clave) {
  const r = todos().find((x) => x.clave === clave);
  if (!r) {
    return h('div', { class: 'inicio' }, cabecera('Rival', 'No se encontró', '#/rivales'), h('main', { class: 'inicio-cuerpo' }, h('div', { class: 'vacio' }, h('h2', {}, 'Ese rival ya no está en la tablet'), h('p', { class: 'nota' }, 'Sus partidos se quitaron o se exportaron.'))));
  }
  const partidos = r.partidos.map((p) =>
    h(
      'button',
      { class: 'opcion', 'data-partido': String(p.id), onclick: () => irA(`#/partido/${p.id}`) },
      h('span', { class: 'datos' }, h('strong', {}, `${p.equipoLocal} vs ${p.equipoVisitante}`), h('small', {}, `${fechaCorta(p.fecha)} ${horaCorta(p.hora)} · ${textoDeSets(p.est)}`))
    )
  );
  return h(
    'div',
    { class: 'inicio' },
    cabecera(r.nombre, `${r.partidos.length} ${r.partidos.length === 1 ? 'partido' : 'partidos'} · ${textoRecord(r)}`, '#/rivales'),
    h(
      'main',
      { class: 'inicio-cuerpo', 'data-scroll': 'rival' },
      tarjetaScouting(r),
      h('div', { class: 'tarjeta tarjeta-rival', 'data-tarjeta-rival': '' }, h('div', { class: 'titulo-grupo' }, `Cómo anota ${r.nombre} (todos los partidos)`), r.resumen.total > 0 ? bloqueDetalleRival(r.resumen, r.nombre) : h('p', { class: 'nota' }, 'Todavía no hay puntos del rival anotados.')),
      h('div', { class: 'titulo-grupo' }, 'Partidos'),
      h('div', { class: 'lista-opciones' }, partidos)
    )
  );
}

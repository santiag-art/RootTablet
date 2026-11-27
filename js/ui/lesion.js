// Retiro por lesión en el momento: un botón que marca a la jugadora limitada o no apta y propone quién entra.
// Pregunta la zona y cómo queda; la marca se guarda en el partido y viaja a Roots con los resultados (donde ya está el
// control de lesiones). Después sigue el plan que dice lesionEnPartido.js: cambio normal o excepcional con quién entra
// sugerida (misma lógica de cambios sugeridos), o la regla 19.4 si era la líbero. Quien decide siempre es la entrenadora.
import { app } from '../contexto.js';
import { derivados, ejecutarSustitucion, entrarLibero, marcarLesion, MAX_SUSTITUCIONES, quitarMarcaLesion, salirLibero } from '../motor.js';
import { planDeRetiro, posicionDeEntrada } from '../lesionEnPartido.js';
import { ZONAS_LESION } from '../reglas/disponibilidad.js';
import { abrirVentana, toast } from './aviso.js';
import { h, nombreCorto, rellenar } from './dom.js';
import { abrirNuevoLibero } from './plantilla.js';
import { opcionJugador, circuloJugador } from './piezas.js';
import { preguntarPosicion } from './preguntarPosicion.js';

const COMO_QUEDA = [
  ['limitada', 'Limitada', 'Puede seguir con cuidado. Queda marcada para revisarla en Roots.'],
  ['no_apta', 'No apta', 'No debe seguir jugando. Queda marcada para revisarla en Roots.'],
];

// Paso 1: zona y cómo queda. `jugadorId` es una jugadora que está en cancha (o un líbero).
export function abrirLesion(V, jugadorId) {
  if (V.bloqueado) return V.avisoBloqueado();
  const { d, est } = V;
  const previa = (est.lesiones ?? []).find((l) => l.jugadorId === jugadorId) ?? null;
  let zona = previa?.zona ?? null;
  let disponibilidad = previa?.disponibilidad ?? null;
  const cuerpo = h('div', { class: 'lesion-form' });

  const pintar = (cerrar) =>
    rellenar(
      cuerpo,
      previa ? h('p', { class: 'nota' }, `Ya tiene una marca en este partido (${previa.zona}, ${previa.disponibilidad === 'no_apta' ? 'no apta' : 'limitada'}). Si la cambias, se actualiza.`) : null,
      h('div', { class: 'titulo-grupo' }, '¿Dónde se lesionó?'),
      h('div', { class: 'chips-categoria lesion-zonas', style: { flexWrap: 'wrap' } }, ZONAS_LESION.map((z) => h('button', { class: `chip ${zona === z ? 'activo' : ''}`, 'data-zona': z, 'aria-pressed': String(zona === z), onclick: () => { zona = z; pintar(cerrar); } }, z))),
      h('div', { class: 'titulo-grupo' }, '¿Cómo queda?'),
      h(
        'div',
        { class: 'lista-opciones' },
        COMO_QUEDA.map(([valor, titulo, sub]) => h('button', { class: `opcion ${disponibilidad === valor ? 'principal' : ''}`, 'data-disponibilidad': valor, 'aria-pressed': String(disponibilidad === valor), onclick: () => { disponibilidad = valor; pintar(cerrar); } }, h('span', { class: 'datos' }, h('strong', {}, titulo), h('small', {}, sub))))
      ),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' } },
        previa ? h('button', { class: 'btn btn-fantasma', 'data-quitar-marca': '', onclick: () => { quitarMarcaLesion(est, jugadorId); V.aplicar(() => null); cerrar(); toast(`Se quitó la marca de ${nombreCorto(d.nombre(jugadorId))}.`, 'ok'); } }, 'Quitar la marca') : null,
        h('button', { class: 'btn btn-primario btn-grande', style: { flex: '1' }, 'data-lesion-confirmar': '', disabled: !zona || !disponibilidad, onclick: () => { if (V.aplicar((e, c) => marcarLesion(e, c, jugadorId, { zona, disponibilidad }))) { cerrar(); seguirConElRetiro(V, jugadorId, disponibilidad); } } }, 'Marcar y ver quién entra')
      )
    );

  abrirVentana({ titulo: `Lesión · ${d.nombre(jugadorId)}`, subtitulo: 'Se guarda en el partido y viaja a Roots al exportar', ancho: 'media', contenido: (cerrar) => { pintar(cerrar); return cuerpo; } });
}

// Paso 2: según dónde esté ella, quién entra (o la regla del líbero). Se calcula de nuevo con la marca ya puesta.
function seguirConElRetiro(V, jugadorId, disponibilidad) {
  const est = V.est;
  const ctx = { ...V.ctx, lesiones: app.lesiones };
  const plan = planDeRetiro(est, ctx, jugadorId);
  const d = plan.d;
  const V2 = { ...V, d, ctx };
  const nombre = nombreCorto(d.nombre(jugadorId));

  if (plan.tipo === 'fuera') return toast(`${nombre} quedó marcada. No está en cancha, así que no hace falta cambio.`, 'ok', 4500);
  if (plan.tipo === 'fuera_por_libero') return toast(`${nombre} quedó marcada. Ahora la reemplaza ${nombreCorto(d.nombre(plan.liberoId))}: cuando la líbero salga, haz el cambio por ella.`, 'info', 7000);
  if (plan.tipo === 'libero') return retiroDeLibero(V2, jugadorId, plan);

  // En cancha: quién entra.
  if (plan.opciones.length === 0) {
    return toast(`${nombre} quedó marcada, pero según las reglas nadie puede entrar por ella ahora (${plan.usados}/${MAX_SUSTITUCIONES} cambios en el set).`, 'error', 9000);
  }
  const excepcional = plan.modo === 'excepcional';
  const sub = excepcional
    ? 'Cambio excepcional por lesión (regla 15.7): no cuenta dentro de los 6 y ella no vuelve a entrar en el partido.'
    : `Cuenta como cambio (${plan.usados + 1}/${MAX_SUSTITUCIONES} en este set).`;
  const hacerCambio = async (entraId, cerrar) => {
    let posicion = posicionDeEntrada(est, d, entraId);
    if (!posicion) {
      posicion = await preguntarPosicion(V2, entraId, { texto: `Entra ${d.nombre(entraId)} por ${d.nombre(jugadorId)}.` });
      if (!posicion) return;
    }
    if (V.aplicar((e, c) => ejecutarSustitucion(e, c, jugadorId, entraId, { excepcional, posicion }))) {
      cerrar();
      toast(`Entra ${nombreCorto(d.nombre(entraId))} por ${nombre}.`, 'ok');
    }
  };
  abrirVentana({
    titulo: `Sale ${d.nombre(jugadorId)}`,
    subtitulo: `¿Quién entra? ${sub}`,
    ancho: 'media',
    contenido: (cerrar) =>
      h(
        'div',
        { class: 'lista-opciones', 'data-retiro-lesion': '' },
        plan.opciones.map((o, i) => {
          const pos = posicionDeEntrada(est, d, o.entraId);
          const nota = [i === 0 ? 'Sugerida' : '', pos ? `entra de ${pos}` : '', o.notas.join(', ')].filter(Boolean).join(' · ');
          return opcionJugador(V2, o.entraId, { nota, principal: i === 0, onclick: () => hacerCambio(o.entraId, cerrar) });
        })
      ),
    acciones: [{ texto: disponibilidad === 'limitada' ? 'Sigue en cancha' : 'Decidir después' }],
  });
}

// Regla 19.4: si queda otro líbero se sigue con él; si no, se designa uno nuevo para el resto del partido.
function retiroDeLibero(V, liberoId, plan) {
  const { d } = V;
  const nombre = nombreCorto(d.nombre(liberoId));
  if (plan.otrosLiberos.length === 0) {
    toast(`${nombre} quedó marcada. No queda otro líbero: elige quién será líbero el resto del partido (regla 19.4).`, 'info', 6000);
    return abrirNuevoLibero(V, liberoId);
  }
  if (!plan.enCancha) return toast(`${nombre} quedó marcada. Sigues con ${plan.otrosLiberos.map((l) => nombreCorto(d.nombre(l))).join(' y ')} (regla 19.4.3).`, 'ok', 5000);
  // Está en cancha y hay otro líbero: sale ella y entra el otro (o vuelve quien había reemplazado).
  abrirVentana({
    titulo: `Sale ${d.nombre(liberoId)}`,
    subtitulo: 'Ella no puede seguir (regla 19.4). ¿Cómo sigue la cancha?',
    ancho: 'media',
    contenido: (cerrar) =>
      h(
        'div',
        { class: 'lista-opciones' },
        plan.otrosLiberos.map((l) => h('button', { class: 'opcion principal', onclick: () => { if (V.aplicar((e, c) => entrarLibero(e, c, l, liberoId))) cerrar(); } }, circuloJugador(V, l), h('span', { class: 'datos' }, h('strong', {}, `Entra ${nombreCorto(d.nombre(l))} por ${nombre}`), h('small', {}, 'No cuenta como cambio'))))
          .concat(plan.reemplazaA != null ? [h('button', { class: 'opcion', onclick: () => { if (V.aplicar((e, c) => salirLibero(e, c, liberoId, { exento: true }))) cerrar(); } }, h('span', { class: 'datos' }, h('strong', {}, `Sale ${nombre}`), h('small', {}, `Vuelve ${nombreCorto(d.nombre(plan.reemplazaA))}`)))] : [])
      ),
    acciones: [{ texto: 'Decidir después' }],
  });
}

// Desde el menú del partido: elegir a quién (cancha y líberos).
export function abrirElegirLesionada(V) {
  if (V.bloqueado) return V.avisoBloqueado();
  const { d, est } = V;
  const ids = [...new Set([...est.actual.slots.filter((id) => id != null), ...d.idsLibero, ...d.reemplazados.values()])];
  if (ids.length === 0) return toast('Primero arma y confirma la plantilla.', 'info');
  abrirVentana({
    titulo: '¿Quién se lesionó?',
    subtitulo: 'Elige a la jugadora que está en cancha',
    ancho: 'media',
    contenido: (cerrar) => h('div', { class: 'lista-opciones' }, ids.map((id) => opcionJugador(V, id, { nota: est.actual.slots.includes(id) ? `En P${est.actual.slots.indexOf(id) + 1}` : d.reemplazadosIds.has(id) ? 'Fuera por el líbero' : 'Líbero en banca', onclick: () => { cerrar(); abrirLesion(V, id); } }))),
  });
}

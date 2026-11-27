// Pantalla de ranking: las jugadoras ordenadas por posición y fundamento, con la tendencia respecto al torneo anterior,
// y la evolución por torneo (o por partido) del equipo y de cada jugadora. Es el Ranking y la Evolución de Roots, hechos
// con lo que hay anotado en la tablet (sin internet). Los cálculos viven en js/ranking.js.
import { app, irA } from '../contexto.js';
import {
  MIN_ACCIONES, SERIES_EQUIPO, actuacionesDeRegistros, categoriasPresentes, diferenciaPuntos, fechaMuyCorta, filtrarActuaciones, fundamentosConJugadas, generosPresentes, gruposPresentes,
  metricasDeGrupo, rankingDeGrupo, svgEvolucion, textoCalidad, textoCambio, textoPct, torneosOrdenados, totalesDeGrupo, unidadesDeEvolucion,
} from '../ranking.js';
import { CATEGORIA_LABEL, CATEGORIAS } from '../reglas/catalogos.js';
import { FUNDAMENTOS } from '../reglas/anotacion.js';
import { nombreDeGrupo } from '../estadisticas.js';
import { mvpDeActuaciones, textoPuntos } from '../mvp.js';
import { frasesDeFormula } from '../pesosMvp.js';
import { historialParaRanking } from '../historial.js';
import { abrirVentana } from './aviso.js';
import { h, icono, rellenar } from './dom.js';

export const RUTA_RANKING = '#/ranking';
const GENERO_TEXTO = { femenino: 'Femenino', masculino: 'Masculino' };

// Lo elegido se recuerda mientras la app está abierta (al volver de un partido sigue igual).
const E = { vista: 'ranking', grupo: null, metrica: null, torneo: null, genero: null, categoria: 'todas', filtrosAbiertos: false, mvpGrupo: null };

// Lo de la tablet más lo archivado de los partidos que ya se exportaron y se quitaron.
function datos() {
  const registros = [...app.partidos.values()];
  const archivo = historialParaRanking(app.historial, new Set(app.partidos.keys()));
  return { todas: [...actuacionesDeRegistros(registros, app.jugadores), ...archivo.actuaciones], torneos: torneosOrdenados([...registros, ...archivo.registros], app.torneos), archivados: archivo.registros.length };
}

const chip = (texto, activo, onclick, extra = {}) => h('button', { class: 'chip', type: 'button', 'aria-pressed': activo ? 'true' : 'false', onclick, ...extra }, texto);
const claveSerie = (f) => `ev-s${FUNDAMENTOS.indexOf(f)}`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function cabecera(subtitulo) {
  return h('header', { class: 'inicio-cabeza' }, h('button', { class: 'btn-icono', 'aria-label': 'Volver', onclick: () => irA('#/') }, icono('atras')), h('div', { class: 'inicio-titulo' }, h('h1', {}, 'Ranking', app.practica ? h('span', { class: 'chip-practica' }, 'PRÁCTICA') : null), h('p', {}, subtitulo)));
}

function vacio() {
  return h('div', { class: 'vacio', 'data-ranking-vacio': '' }, h('h2', {}, 'Todavía no hay jugadas anotadas'), h('p', { class: 'nota' }, 'El ranking se arma con las jugadas que anotas en la pestaña Acciones de cada partido. Anota algunas y vuelve aquí.'));
}

// ─────────────── Evolución (equipo o una jugadora) ───────────────
// Gráfica de líneas de la efectividad por torneo o por partido, y una tabla con el cambio frente al anterior (▲ / ▼ en puntos).
function bloqueEvolucion({ acts, torneos, jugadorId = null }) {
  const estado = { modo: 'torneo', visibles: null };
  const porTorneo = unidadesDeEvolucion(acts, { modo: 'torneo', torneos, jugadorId });
  const disponibles = jugadorId == null ? SERIES_EQUIPO : fundamentosConJugadas(porTorneo);
  // De una jugadora se dibujan de entrada sus 3 fundamentos con más jugadas; el resto se prende con un toque.
  const masJugados = [...disponibles].sort((a, b) => porTorneo.reduce((s, u) => s + u.fundamentos[b].acciones, 0) - porTorneo.reduce((s, u) => s + u.fundamentos[a].acciones, 0));
  estado.visibles = new Set(jugadorId == null ? disponibles : masJugados.slice(0, 3));
  const raiz = h('div', { class: 'evolucion', 'data-evolucion': '' });

  const celdaSerie = (f, u, previo) => {
    const x = u.fundamentos[f];
    if (f === 'Saque') return h('td', {}, x.acciones ? String(x.directos) : '–', h('small', { class: 'rk-sub' }, x.acciones ? `${textoPct(x.directosPct)} de ${x.acciones}` : 'sin saques'));
    const cambio = previo ? diferenciaPuntos(previo.fundamentos[f].efectividadPct, x.efectividadPct) : null;
    return h('td', {}, textoPct(x.efectividadPct), cambio ? h('span', { class: `rk-cambio ${cambio > 0 ? 'sube' : 'baja'}` }, textoCambio(cambio)) : null, h('small', { class: 'rk-sub' }, x.acciones ? `${x.acciones} jugadas` : 'sin jugadas'));
  };

  const pintar = () => {
    const unidades = unidadesDeEvolucion(acts, { modo: estado.modo, torneos, jugadorId });
    const series = disponibles.filter((f) => estado.visibles.has(f));
    const porPartido = estado.modo === 'partido';
    const alternar = (f) => {
      if (estado.visibles.has(f)) estado.visibles.delete(f);
      else estado.visibles.add(f);
      pintar();
    };
    const grafica = h('div', { class: 'ls-grafica' });
    grafica.innerHTML = svgEvolucion({
      etiquetas: unidades.map((u) => (porPartido ? fechaMuyCorta(u.fecha) : u.etiqueta)),
      series: series.map((f) => ({ clase: claveSerie(f), valores: unidades.map((u) => u.fundamentos[f].efectividadPct) })),
      descripcion: `Efectividad por ${porPartido ? 'partido' : 'torneo'}`,
    });
    const cabezaPrimera = porPartido ? 'Partido' : 'Torneo';
    const cabezaSegunda = jugadorId == null ? (porPartido ? 'Resultado' : 'Partidos') : 'Jugó';
    const segunda = (u) => {
      if (jugadorId != null) return h('td', {}, String(u.partidos), h('small', { class: 'rk-sub' }, u.partidos === 1 ? 'partido' : 'partidos'));
      if (porPartido) return h('td', {}, u.resultado === 'ganado' ? 'Ganado' : u.resultado === 'perdido' ? 'Perdido' : '–');
      return h('td', {}, `${u.resumen.ganados}G · ${u.resumen.perdidos}P`, h('small', { class: 'rk-sub' }, `sets ${u.resumen.setsGanados}-${u.resumen.setsPerdidos}`));
    };
    rellenar(
      raiz,
      h(
        'div',
        { class: 'rk-controles' },
        h('div', { class: 'segmentos' }, [['torneo', 'Por torneo'], ['partido', 'Por partido']].map(([v, t]) => h('button', { type: 'button', 'data-modo-evolucion': v, 'aria-pressed': estado.modo === v ? 'true' : 'false', onclick: () => { estado.modo = v; pintar(); } }, t))),
        h('div', { class: 'rk-chips' }, disponibles.map((f) => h('button', { class: 'chip chip-serie', type: 'button', 'aria-pressed': estado.visibles.has(f) ? 'true' : 'false', onclick: () => alternar(f) }, h('span', { class: `ev-dot ${claveSerie(f)}` }), f === 'Saque' ? 'Saque' : f)))
      ),
      unidades.length === 0
        ? h('p', { class: 'nota rk-vacio' }, 'Aún no hay partidos con jugadas anotadas para ver la evolución.')
        : [
            h('div', { class: 'tarjeta' }, h('div', { class: 'titulo-grupo' }, `Efectividad por ${porPartido ? 'partido' : 'torneo'}`), unidades.length < 2 ? h('p', { class: 'nota' }, 'Con un solo punto aún no se ve una línea; aparecerá al anotar el siguiente.') : null, series.length ? grafica : h('p', { class: 'nota' }, 'Toca un fundamento de arriba para verlo en la gráfica.')),
            h(
              'div',
              { class: 'tarjeta rk-tabla', 'data-scroll': `evolucion-${jugadorId ?? 'equipo'}` },
              h('table', { class: 'tabla-stats' }, h('thead', {}, h('tr', {}, [cabezaPrimera, cabezaSegunda, ...series.map((f) => (f === 'Saque' ? 'Saques directos' : f))].map((t) => h('th', {}, t)))), h('tbody', {}, unidades.map((u, i) => h('tr', {}, h('td', {}, h('strong', {}, porPartido ? fechaMuyCorta(u.fecha) : u.etiqueta), h('small', { class: 'rk-sub' }, porPartido ? u.detalle : fechaMuyCorta(u.fecha))), segunda(u), series.map((f) => celdaSerie(f, u, unidades[i - 1]))))))
            ),
            h('p', { class: 'nota' }, '▲ / ▼ comparan con el torneo anterior (o el partido anterior), en puntos porcentuales de efectividad. Efectividad = jugadas positivas (doble positivo + positivo) sobre el total. En Saque se cuentan los saques directos (doble positivo).'),
          ]
    );
  };
  pintar();
  return raiz;
}

// ─────────────── Una jugadora ───────────────
function posicionesJugadas(delJugador) {
  const partidos = new Map();
  for (const a of delJugador) {
    if (!partidos.has(a.grupo)) partidos.set(a.grupo, new Set());
    partidos.get(a.grupo).add(a.partidoId);
  }
  return [...partidos].map(([g, ids]) => `${nombreDeGrupo(g)} (${ids.size} ${ids.size === 1 ? 'partido' : 'partidos'})`).join(' · ');
}

function abrirEvolucionJugadora(jugadorId) {
  const { todas, torneos } = datos();
  const delJugador = todas.filter((a) => a.jugadorId === jugadorId);
  const j = app.jugadores.get(jugadorId);
  return abrirVentana({
    titulo: j?.nombre ?? 'Jugadora sin registrar',
    subtitulo: [j?.numero != null ? `#${j.numero}` : null, posicionesJugadas(delJugador)].filter(Boolean).join(' · '),
    ancho: 'grande',
    contenido: h('div', { class: 'ranking-jugadora', 'data-evolucion-jugadora': String(jugadorId) }, bloqueEvolucion({ acts: delJugador, torneos, jugadorId }), h('p', { class: 'nota' }, 'Incluye todos los partidos en que se le anotaron jugadas, también los que jugó de otra posición.')),
    acciones: [{ texto: 'Cerrar', tipo: 'primario' }],
  });
}

// ─────────────── Ranking de una posición ───────────────
function tarjetaResumen({ fundamento, metrica, total }) {
  const saque = fundamento === 'Saque';
  const valor = saque ? String(total.directos) : textoPct(total.efectividadPct);
  const extra = fundamento === 'Ataque' ? ` · eficiencia ${textoPct(total.eficienciaPct)}` : fundamento === 'Recepción' ? ` · calidad ${textoCalidad(total.calidadMedia)} de 3` : '';
  const detalle = saque ? `${textoPct(total.directosPct)} de ${total.acciones} ${metrica.unidad} · ${plural(total.errores, 'error', 'errores')}` : `${total.positivas} de ${total.acciones} ${metrica.unidad} · ${total.directos} ${metrica.directos.toLowerCase()}${extra}`;
  return h('div', { class: 'tarjeta rk-dato' }, h('small', {}, metrica.titulo), h('strong', { class: `rk-dato-valor ${claveSerie(fundamento)}` }, valor), h('small', {}, total.acciones ? detalle : 'Sin jugadas todavía'));
}

function filaRanking({ puesto, fila, metrica, maximo, nombresTorneo }) {
  const j = app.jugadores.get(fila.jugadorId);
  const f = fila.f;
  const principal = { directos: f.directos, eficiencia: f.eficienciaPct, calidad: f.calidadMedia }[metrica.orden] ?? f.efectividadPct;
  const ancho = metrica.orden === 'directos' ? (maximo > 0 ? (f.directos / maximo) * 100 : 0) : metrica.orden === 'calidad' ? ((principal ?? 0) / 3) * 100 : Math.max(principal ?? 0, 0);
  const valor = metrica.orden === 'directos' ? String(principal) : metrica.orden === 'calidad' ? textoCalidad(principal) : textoPct(principal);
  const detalle =
    metrica.orden === 'directos' ? `${textoPct(f.directosPct)} de sus saques` : metrica.orden === 'eficiencia' ? `${plural(f.directos, 'punto', 'puntos')} · ${plural(f.errores, 'error', 'errores')}` : metrica.orden === 'calidad' ? `de 3 · ${textoPct(f.directosPct)} perfectas` : `${f.directos} ${metrica.directos.toLowerCase()}`;
  const t = fila.tendencia;
  const cambio = t && t.diferencia !== 0 ? h('span', { class: `rk-cambio ${t.diferencia > 0 ? 'sube' : 'baja'}`, 'aria-label': `${t.diferencia > 0 ? 'Subió' : 'Bajó'} ${Math.abs(t.diferencia)} puntos frente a ${nombresTorneo.get(t.previoId) ?? 'el torneo anterior'}` }, textoCambio(t.diferencia, t.calidad)) : null;
  return h(
    'button',
    { class: `opcion fila-ranking ${puesto ? '' : 'sin-puesto'}`, type: 'button', 'data-jugadora': String(fila.jugadorId), onclick: () => abrirEvolucionJugadora(fila.jugadorId) },
    h('span', { class: `rk-puesto ${puesto ? `p${puesto}` : 'sin'}` }, puesto ?? '·'),
    h('span', { class: 'datos' }, h('strong', {}, j?.nombre ?? 'Jugadora sin registrar'), h('small', {}, [j?.numero != null ? `#${j.numero}` : null, `${f.acciones} ${f.acciones === 1 ? 'jugada' : 'jugadas'}`, `${fila.partidos} ${fila.partidos === 1 ? 'partido' : 'partidos'}`].filter(Boolean).join(' · '))),
    h('span', { class: 'rk-barra', 'aria-hidden': 'true' }, h('span', { style: { width: `${Math.max(ancho, 2)}%` } })),
    h('span', { class: 'rk-valor' }, h('span', { class: 'rk-valor-fila' }, h('strong', {}, valor), cambio), h('small', {}, detalle))
  );
}

function vistaDeRanking({ acts, actsVista, torneosConJugadas, filtrosGenerales }) {
  const grupos = gruposPresentes(actsVista);
  const grupo = grupos.find((g) => g.clave === E.grupo) ?? grupos[0];
  const tarjetaFiltros = (...nodos) => h('div', { class: 'tarjeta rk-filtros' }, nodos, filtrosGenerales);
  if (!grupo) return [tarjetaFiltros(), h('div', { class: 'tarjeta' }, h('p', { class: 'nota' }, 'Con estos filtros no hay jugadoras con jugadas.'))];
  const metricas = metricasDeGrupo(grupo.clave);
  const metrica = metricas.find((m) => m.key === E.metrica) ?? metricas[0];
  const ordenTorneos = torneosConJugadas.map((t) => t.id);
  const nombresTorneo = new Map(torneosConJugadas.map((t) => [t.id, t.nombre]));
  const { ranking, pocas } = rankingDeGrupo(acts, grupo.clave, metrica, { torneoId: E.torneo, ordenTorneos });
  const maximo = ranking.reduce((m, r) => Math.max(m, r.f.directos), 0);
  const filas = [...ranking.map((fila, i) => filaRanking({ puesto: i + 1, fila, metrica, maximo, nombresTorneo })), ...(pocas.length ? [h('p', { class: 'titulo-grupo rk-aparte' }, metrica.orden === 'directos' ? 'Aún sin saques directos' : `Con pocas jugadas (menos de ${MIN_ACCIONES}): todavía no cuentan para el ranking`), ...pocas.map((fila) => filaRanking({ puesto: null, fila, metrica, maximo, nombresTorneo }))] : [])];
  return [
    tarjetaFiltros(
      h('div', { class: 'titulo-grupo' }, 'Posición'),
      h('div', { class: 'rk-chips' }, grupos.map((g) => chip(`${g.nombre} · ${g.jugadoras}`, g.clave === grupo.clave, () => { E.grupo = g.clave; E.metrica = null; app.renderizar(); }, { 'data-grupo': g.clave }))),
      h('div', { class: 'titulo-grupo' }, 'Fundamento'),
      h('div', { class: 'rk-chips rk-metricas' }, metricas.map((m) => chip(m.label, m.key === metrica.key, () => { E.metrica = m.key; app.renderizar(); }, { 'data-metrica': m.key })))
    ),
    ranking.length === 0 && pocas.length === 0
      ? h('div', { class: 'tarjeta' }, h('p', { class: 'nota' }, `Aún no hay jugadas de ${metrica.label.toLowerCase()} con estos filtros.`))
      : h('div', { class: 'lista-opciones rk-lista', 'data-lista-ranking': '' }, h('div', { class: 'titulo-grupo rk-titulo' }, metrica.titulo), ranking.length === 0 ? h('p', { class: 'nota' }, 'Todavía nadie alcanza el mínimo para entrar al ranking.') : null, filas),
    h('div', { class: 'titulo-grupo rk-titulo' }, `Resumen de ${grupo.nombre.toLowerCase()}${E.torneo == null ? '' : ` · ${nombresTorneo.get(E.torneo) ?? ''}`}`),
    h('div', { class: 'rk-resumen' }, totalesDeGrupo(actsVista, grupo.clave).map(tarjetaResumen)),
    h('p', { class: 'nota' }, 'Cada posición se compara solo con jugadoras de su misma posición, con los fundamentos que le tocan; la posición es la que jugó en cada partido. Toca a una jugadora para ver su evolución. ▲ / ▼ son los puntos que subió o bajó frente al torneo anterior (el último con datos, o el que elegiste). Eficiencia = (puntos directos − errores) entre las jugadas; puede ser negativa. Calidad de recepción: doble positivo = 3, positivo = 2, negativo = 1, error = 0, y se promedia. Un saque directo es un saque con doble positivo.'),
  ];
}

// ─────────────── MVP del torneo ───────────────
// Suma los puntos de impacto de todos los partidos del torneo elegido (o de todos). Ver js/mvp.js.
function filaMvp({ fila, maximo }) {
  const j = app.jugadores.get(fila.jugadorId);
  const ancho = maximo > 0 ? (Math.max(fila.puntos, 0) / maximo) * 100 : 0;
  const posiciones = fila.posiciones.map(nombreDeGrupo).join(' / ');
  return h(
    'button',
    { class: 'opcion fila-ranking', type: 'button', 'data-jugadora': String(fila.jugadorId), 'data-mvp-fila': '', onclick: () => abrirEvolucionJugadora(fila.jugadorId) },
    h('span', { class: `rk-puesto ${fila.puesto <= 3 ? `p${fila.puesto}` : 'sin'}` }, fila.puesto),
    h('span', { class: 'datos' }, h('strong', {}, j?.nombre ?? 'Jugadora sin registrar'), h('small', {}, [j?.numero != null ? `#${j.numero}` : null, posiciones, plural(fila.partidos, 'partido', 'partidos')].filter(Boolean).join(' · '))),
    h('span', { class: 'rk-barra', 'aria-hidden': 'true' }, h('span', { style: { width: `${Math.max(ancho, 2)}%` } })),
    h('span', { class: 'rk-valor' }, h('span', { class: 'rk-valor-fila' }, h('strong', {}, textoPuntos(fila.puntos))), h('small', {}, `${textoPuntos(fila.promedio)} por partido · ${plural(fila.directos, 'directo', 'directos')} · ${plural(fila.errores, 'error', 'errores')}`))
  );
}

function vistaDeMvp({ acts, torneosConJugadas, filtrosGenerales }) {
  const nombre = E.torneo == null ? 'todos los torneos' : (torneosConJugadas.find((t) => t.id === E.torneo)?.nombre ?? 'el torneo');
  const actsMvp = E.torneo == null ? acts : acts.filter((a) => a.torneoId === E.torneo);
  const grupos = gruposPresentes(actsMvp);
  if (E.mvpGrupo != null && !grupos.some((g) => g.clave === E.mvpGrupo)) E.mvpGrupo = null;
  const tabla = mvpDeActuaciones(acts, { torneoId: E.torneo, grupo: E.mvpGrupo, pesos: app.pesosMvp });
  const premio = E.mvpGrupo == null ? 'MVP' : `MVP ${nombreDeGrupo(E.mvpGrupo)}`;
  const maximo = tabla.reduce((m, f) => Math.max(m, f.puntos), 0);
  const mvp = tabla[0];
  const j = mvp ? app.jugadores.get(mvp.jugadorId) : null;
  return [
    h('div', { class: 'tarjeta rk-filtros' }, h('div', { class: 'titulo-grupo' }, 'Premio por posición'), h('div', { class: 'rk-chips' }, chip('Todas', E.mvpGrupo == null, () => { E.mvpGrupo = null; app.renderizar(); }, { 'data-mvp-grupo': 'todas' }), grupos.map((g) => chip(`MVP ${g.nombre}`, E.mvpGrupo === g.clave, () => { E.mvpGrupo = g.clave; app.renderizar(); }, { 'data-mvp-grupo': g.clave }))), filtrosGenerales),
    mvp && mvp.puntos > 0
      ? h('div', { class: 'tarjeta rk-dato', 'data-mvp-torneo': '' }, h('small', {}, E.torneo == null ? `${premio} de todos los torneos juntos` : `${premio} del torneo · ${nombre}`), h('strong', { class: 'rk-dato-valor' }, j?.nombre ?? 'Jugadora sin registrar'), h('small', {}, `${textoPuntos(mvp.puntos)} puntos de impacto en ${plural(mvp.partidos, 'partido', 'partidos')} (${textoPuntos(mvp.promedio)} por partido)`))
      : null,
    tabla.length === 0
      ? h('div', { class: 'tarjeta' }, h('p', { class: 'nota' }, `Todavía no hay jugadoras con partidos suficientes en ${nombre}: se necesitan al menos 3 jugadas en un partido (8 la líbero).`))
      : h('div', { class: 'lista-opciones rk-lista', 'data-lista-mvp': '' }, h('div', { class: 'titulo-grupo rk-titulo' }, 'Puntos de impacto sumados'), tabla.map((fila) => filaMvp({ fila, maximo }))),
    h('p', { class: 'nota' }, `Cada partido suma sus puntos de impacto. ${frasesDeFormula(app.pesosMvp).directos} ${frasesDeFormula(app.pesosMvp).colocacion} ${frasesDeFormula(app.pesosMvp).errores} Los puntos se cambian en Ajustes → Puntos del MVP. El MVP del torneo es quien más suma entre todos sus partidos. Con «Premio por posición» cada una compite solo con las de la posición que jugó (armadora, líbero, centrales…) y solo le cuentan los fundamentos de esa posición; un partido solo cuenta si tuvo 3 jugadas o más (8 la líbero). Toca a una jugadora para ver su evolución.`),
  ];
}

// ─────────────── Pantalla ───────────────
export function vistaRanking() {
  const { todas, torneos, archivados } = datos();
  const generos = generosPresentes(todas, app.jugadores);
  if (!generos.includes(E.genero)) E.genero = generos.includes('femenino') ? 'femenino' : generos[0] ?? null;
  const delGenero = E.genero ? filtrarActuaciones(todas, app.jugadores, { genero: E.genero }) : todas;
  const categorias = categoriasPresentes(delGenero, app.jugadores, CATEGORIAS.map((c) => c.value));
  if (E.categoria !== 'todas' && !categorias.includes(E.categoria)) E.categoria = 'todas';
  const acts = filtrarActuaciones(delGenero, app.jugadores, { categoria: E.categoria });
  const torneosConJugadas = torneos.filter((t) => acts.some((a) => a.torneoId === t.id));
  if (E.torneo != null && !torneosConJugadas.some((t) => t.id === E.torneo)) E.torneo = null;
  const actsVista = E.torneo == null ? acts : acts.filter((a) => a.torneoId === E.torneo);

  const cuerpo = [];
  if (!todas.length) {
    cuerpo.push(vacio());
  } else {
    cuerpo.push(h('div', { class: 'segmentos rk-vistas' }, [['ranking', 'Ranking'], ['mvp', 'MVP del torneo'], ['equipo', 'Evolución del equipo']].map(([v, t]) => h('button', { type: 'button', 'data-vista-ranking': v, 'aria-pressed': E.vista === v ? 'true' : 'false', onclick: () => { E.vista = v; if (v === 'mvp' && E.torneo == null && torneosConJugadas.length) E.torneo = torneosConJugadas[torneosConJugadas.length - 1].id; app.renderizar(); } }, t))));
    const generales = [];
    if (generos.length > 1) generales.push(h('div', { class: 'segmentos rk-genero' }, generos.map((g) => h('button', { type: 'button', 'data-genero': g, 'aria-pressed': E.genero === g ? 'true' : 'false', onclick: () => { E.genero = g; app.renderizar(); } }, GENERO_TEXTO[g]))));
    const nodosTorneo = (E.vista === 'ranking' || E.vista === 'mvp') && torneosConJugadas.length > 0 ? [h('div', { class: 'titulo-grupo' }, 'Torneo'), h('div', { class: 'rk-chips' }, chip('Todos los torneos', E.torneo == null, () => { E.torneo = null; app.renderizar(); }, { 'data-torneo': 'todos' }), torneosConJugadas.map((t) => chip(t.nombre, E.torneo === t.id, () => { E.torneo = t.id; app.renderizar(); }, { 'data-torneo': String(t.id) })))] : [];
    const nodosCategoria = categorias.length > 1 ? [h('div', { class: 'titulo-grupo' }, 'Categoría'), h('div', { class: 'rk-chips' }, chip('Todas', E.categoria === 'todas', () => { E.categoria = 'todas'; app.renderizar(); }), categorias.map((c) => chip(CATEGORIA_LABEL[c] ?? c, E.categoria === c, () => { E.categoria = c; app.renderizar(); }, { 'data-categoria': c })))] : [];
    // En el ranking, torneo y categoría van en un desplegable que dice lo elegido: así la lista queda a la vista sin bajar.
    const resumenFiltros = [E.torneo == null ? 'Todos los torneos' : (torneosConJugadas.find((t) => t.id === E.torneo)?.nombre ?? ''), categorias.length > 1 ? (E.categoria === 'todas' ? 'Todas las categorías' : (CATEGORIA_LABEL[E.categoria] ?? E.categoria)) : null].filter(Boolean).join(' · ');
    const masFiltros = nodosTorneo.length + nodosCategoria.length ? h('details', { class: 'rk-mas', 'data-mas-filtros': '', open: E.filtrosAbiertos, ontoggle: (e) => { E.filtrosAbiertos = e.target.open; } }, h('summary', {}, h('span', { class: 'rk-mas-titulo' }, 'Torneo y categoría'), h('span', { class: 'rk-mas-valor' }, resumenFiltros)), h('div', { class: 'rk-mas-cuerpo' }, nodosTorneo, nodosCategoria)) : null;
    cuerpo.push(...generales);
    if (acts.length === 0) {
      cuerpo.push(...(masFiltros ? [h('div', { class: 'tarjeta rk-filtros' }, masFiltros)] : nodosCategoria.length ? [h('div', { class: 'tarjeta rk-filtros' }, nodosCategoria)] : []), h('div', { class: 'tarjeta' }, h('p', { class: 'nota' }, 'Con estos filtros no hay jugadas.')));
    } else if (E.vista === 'ranking') {
      cuerpo.push(...vistaDeRanking({ acts, actsVista, torneosConJugadas, filtrosGenerales: masFiltros }));
    } else if (E.vista === 'mvp') {
      cuerpo.push(...vistaDeMvp({ acts, torneosConJugadas, filtrosGenerales: masFiltros }));
    } else {
      if (nodosCategoria.length) cuerpo.push(h('div', { class: 'tarjeta rk-filtros' }, nodosCategoria));
      cuerpo.push(bloqueEvolucion({ acts, torneos }));
    }
  }
  const subtitulo = E.vista === 'equipo' && todas.length ? 'Cómo va el equipo de un torneo a otro' : E.vista === 'mvp' && todas.length ? 'Quién más aportó en el torneo' : 'Jugadoras por posición y su evolución por torneo';
  if (todas.length && archivados) cuerpo.push(h('p', { class: 'nota', 'data-nota-archivo': '' }, `Incluye ${archivados} ${archivados === 1 ? 'partido' : 'partidos'} que ya exportaste y quitaste de la tablet: su resumen se conserva para el ranking.`));
  return h('div', { class: 'inicio ranking', 'data-pantalla': 'ranking' }, cabecera(subtitulo), h('main', { class: 'inicio-cuerpo', 'data-scroll': 'ranking' }, cuerpo));
}

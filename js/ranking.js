// Ranking de jugadoras dentro de la tablet y su evolución por torneo (o por partido). Es el mismo ranking de Roots
// (Comparativas → Ranking y Evolución), calculado con lo que hay anotado en este aparato. Funciones puras: no tocan la
// pantalla ni el almacenamiento.
//
// Reglas (las mismas de Roots):
//  - Cada posición se compara solo con jugadoras de su misma posición, y a cada una solo le cuentan los fundamentos de esa
//    posición (al líbero no se le cuenta un ataque). La posición es la que jugó en ese partido (la de su ficha si no eligió otra),
//    así que una jugadora que jugó de dos posiciones aparece en las dos, cada una con sus partidos.
//  - Efectividad = (doble positivo + positivo) ÷ jugadas. Saque directo = saque con doble positivo.
//  - Eficiencia = (doble positivo − errores) ÷ jugadas; puede ser negativa. En ataque es la eficiencia clásica del voleibol.
//  - Calidad media (escala 0–3): doble positivo = 3, positivo = 2, negativo = 1, error = 0.
import { eventosDelAlcance, grupoDeJugadora, idsLiberos, nombreDeGrupo } from './estadisticas.js';
import { resultadoDelPartido, setsDelPartido } from './historialRival.js';
import { rivalDeRegistro } from './puntosRival.js';
import { FUNDAMENTOS } from './reglas/anotacion.js';
import { FUNDAMENTOS_POR_POSICION, ORDEN_POSICIONES } from './reglas/fundamentosPosicion.js';

// Con menos jugadas que esto un porcentaje engaña (1 de 1 = 100 %): no entra al ranking, queda aparte «con pocas jugadas».
export const MIN_ACCIONES = 5;
// Fundamentos que se dibujan en la evolución de todo el equipo (como en Roots).
export const SERIES_EQUIPO = ['Ataque', 'Recepción', 'Saque'];

const CALIFICACIONES = ['doble_positivo', 'positivo', 'negativo', 'error'];
const vacio = () => ({ doble_positivo: 0, positivo: 0, negativo: 0, error: 0 });

function sumarConteos(a, b) {
  return { doble_positivo: a.doble_positivo + b.doble_positivo, positivo: a.positivo + b.positivo, negativo: a.negativo + b.negativo, error: a.error + b.error };
}

// De los conteos crudos de un fundamento a las cifras que se muestran. Sin jugadas, los porcentajes son null.
export function resumirConteos(t = vacio()) {
  const acciones = t.doble_positivo + t.positivo + t.negativo + t.error;
  const positivas = t.doble_positivo + t.positivo;
  const pct = (n) => (acciones > 0 ? Math.round((n / acciones) * 100) : null);
  return {
    ...t,
    acciones,
    positivas,
    directos: t.doble_positivo,
    errores: t.error,
    efectividadPct: pct(positivas),
    directosPct: pct(t.doble_positivo),
    eficienciaPct: pct(t.doble_positivo - t.error),
    calidadMedia: acciones > 0 ? Math.round(((3 * t.doble_positivo + 2 * t.positivo + t.negativo) / acciones) * 100) / 100 : null,
  };
}

// ─────────────── Métricas: cómo se ordena cada fundamento ───────────────
// `orden`: efectividad | eficiencia | calidad | directos. `fundamentos`: de dónde salen las jugadas de la métrica.
const M = (key, fundamentos, label, titulo, directos, unidad, orden) => ({ key, fundamentos, label, titulo, directos, unidad, orden });
export const METRICAS = {
  AtaqueEficiencia: M('AtaqueEficiencia', ['Ataque'], 'Ataque · eficiencia', 'Eficiencia de ataque: (puntos − errores) entre ataques', 'Puntos directos', 'ataques', 'eficiencia'),
  Ataque: M('Ataque', ['Ataque'], 'Ataque', 'Efectividad de ataque', 'Puntos directos', 'ataques', 'efectividad'),
  RecepcionCalidad: M('RecepcionCalidad', ['Recepción'], 'Recepción · calidad 0–3', 'Calidad de recepción (promedio de 0 a 3)', 'Perfectas', 'recepciones', 'calidad'),
  Recepción: M('Recepción', ['Recepción'], 'Recepción', 'Efectividad de recepción', 'Perfectas', 'recepciones', 'efectividad'),
  Saque: M('Saque', ['Saque'], 'Saques directos', 'Saques directos', 'Directos', 'saques', 'directos'),
  Colocación: M('Colocación', ['Colocación'], 'Colocación', 'Efectividad de colocación', 'Perfectas', 'colocaciones', 'efectividad'),
  Bloqueo: M('Bloqueo', ['Bloqueo'], 'Bloqueo', 'Efectividad de bloqueo', 'Bloqueos directos', 'bloqueos', 'efectividad'),
  Defensa: M('Defensa', ['Defensa'], 'Defensa', 'Efectividad de defensa', 'Perfectas', 'defensas', 'efectividad'),
  RecepcionDefensa: M('RecepcionDefensa', ['Recepción', 'Defensa'], 'Recepción + defensa', 'Efectividad de recepción y defensa', 'Perfectas', 'recepciones y defensas', 'efectividad'),
};

export const fundamentosDeGrupo = (clave) => FUNDAMENTOS_POR_POSICION[clave] ?? FUNDAMENTOS;

// Las métricas de una posición, en el orden en que se ofrecen (la combinada del líbero va primero).
export function metricasDeGrupo(clave) {
  const lista = fundamentosDeGrupo(clave).flatMap((f) => (f === 'Ataque' ? [METRICAS.AtaqueEficiencia, METRICAS.Ataque] : f === 'Recepción' ? [METRICAS.RecepcionCalidad, METRICAS.Recepción] : [METRICAS[f]]));
  return clave === 'libero' ? [METRICAS.RecepcionDefensa, ...lista] : lista;
}

// Suma las jugadas de los fundamentos de una métrica y las resume.
export function resumenDeMetrica(conteos, metrica) {
  return resumirConteos(metrica.fundamentos.reduce((suma, f) => sumarConteos(suma, conteos[f] ?? vacio()), vacio()));
}

// Valor con que se compara una jugadora consigo misma entre torneos (en puntos porcentuales; la calidad, en la escala 0–3).
export function valorDeMetrica(f, metrica) {
  return { directos: f.directosPct, eficiencia: f.eficienciaPct, calidad: f.calidadMedia }[metrica.orden] ?? f.efectividadPct;
}

// ─────────────── De los partidos guardados a «actuaciones» ───────────────
// Una actuación = una jugadora en un partido, con la posición que jugó y sus jugadas por fundamento.
// `jugadoresPorId`: Map id → jugadora (la de la tablet). Cuenta todo lo anotado, también el set en juego.
export function actuacionesDeRegistros(registros, jugadoresPorId) {
  const salida = [];
  for (const r of registros) {
    if (!r?.est) continue;
    const eventos = eventosDelAlcance(r.est, 'todo');
    if (!eventos.length) continue;
    const liberos = idsLiberos(r.est);
    const porJugadora = new Map();
    for (const e of eventos) {
      if (e.jugadorId == null) continue;
      if (!porJugadora.has(e.jugadorId)) porJugadora.set(e.jugadorId, []);
      porJugadora.get(e.jugadorId).push(e);
    }
    for (const [jugadorId, propios] of porJugadora) {
      const grupo = grupoDeJugadora(jugadoresPorId.get(jugadorId), liberos.has(jugadorId), r.est.posiciones?.[jugadorId]);
      const permitidos = fundamentosDeGrupo(grupo);
      const conteos = {};
      let total = 0;
      for (const e of propios) {
        if (!permitidos.includes(e.fundamento) || !CALIFICACIONES.includes(e.calificacion)) continue;
        (conteos[e.fundamento] ??= vacio())[e.calificacion] += 1;
        total += 1;
      }
      if (total) salida.push({ partidoId: r.id, torneoId: r.torneoId, fecha: r.fecha ?? '', hora: r.hora ?? '', jugadorId, grupo, conteos });
    }
  }
  return salida;
}

export function filtrarActuaciones(acts, jugadoresPorId, { genero = 'todos', categoria = 'todas' } = {}) {
  return acts.filter((a) => {
    const j = jugadoresPorId.get(a.jugadorId);
    return (genero === 'todos' || j?.genero === genero) && (categoria === 'todas' || j?.categoria === categoria);
  });
}

// Géneros y categorías que hay entre las jugadoras con jugadas (para ofrecer solo los filtros que sirven).
export function generosPresentes(acts, jugadoresPorId) {
  const presentes = new Set(acts.map((a) => jugadoresPorId.get(a.jugadorId)?.genero).filter(Boolean));
  return ['femenino', 'masculino'].filter((g) => presentes.has(g));
}

export function categoriasPresentes(acts, jugadoresPorId, ordenCategorias = []) {
  const presentes = new Set(acts.map((a) => jugadoresPorId.get(a.jugadorId)?.categoria).filter(Boolean));
  return [...ordenCategorias.filter((c) => presentes.has(c)), ...[...presentes].filter((c) => !ordenCategorias.includes(c)).sort()];
}

// Las posiciones con jugadoras (en el orden de las estadísticas), con cuántas jugadoras tiene cada una.
export function gruposPresentes(acts) {
  const orden = [...ORDEN_POSICIONES, 'otros'];
  const porGrupo = new Map();
  for (const a of acts) {
    if (!porGrupo.has(a.grupo)) porGrupo.set(a.grupo, new Set());
    porGrupo.get(a.grupo).add(a.jugadorId);
  }
  return orden.filter((g) => porGrupo.has(g)).map((clave) => ({ clave, nombre: nombreDeGrupo(clave), jugadoras: porGrupo.get(clave).size, fundamentos: fundamentosDeGrupo(clave) }));
}

const fechaDe = (x) => String(x ?? '').slice(0, 10);
const porFechaHora = (a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`) || a.id - b.id;

// Los torneos que tienen partidos guardados, del más antiguo al más reciente (por su fecha de inicio; si no trae, por su primer partido).
export function torneosOrdenados(registros, torneosPorId) {
  const porTorneo = new Map();
  for (const r of registros) {
    if (!r?.est) continue;
    if (!porTorneo.has(r.torneoId)) porTorneo.set(r.torneoId, []);
    porTorneo.get(r.torneoId).push(r);
  }
  return [...porTorneo]
    .map(([id, partidos]) => {
      partidos.sort(porFechaHora);
      const t = torneosPorId.get(id);
      return { id, nombre: t?.nombre ?? 'Torneo', genero: t?.genero ?? null, categoria: t?.categoria ?? null, fechaInicio: fechaDe(t?.fechaInicio) || fechaDe(partidos[0]?.fecha), partidos };
    })
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio) || a.id - b.id);
}

// ─────────────── Ranking de una posición ───────────────
function sumarPorFundamento(acts) {
  const total = {};
  for (const a of acts) for (const [f, c] of Object.entries(a.conteos)) total[f] = sumarConteos(total[f] ?? vacio(), c);
  return total;
}

// Una tarjeta resumen por cada fundamento de la posición (todas las jugadoras juntas).
export function totalesDeGrupo(acts, grupo) {
  const total = sumarPorFundamento(acts.filter((a) => a.grupo === grupo));
  return fundamentosDeGrupo(grupo).map((fundamento) => ({ fundamento, metrica: METRICAS[fundamento], total: resumirConteos(total[fundamento] ?? vacio()) }));
}

// Cuánto cambió una jugadora entre su último torneo con datos suficientes y el anterior (o, si se elige un torneo, entre ese y el anterior).
// Solo cuentan torneos con MIN_ACCIONES jugadas o más en la métrica. null si no hay con qué comparar.
export function tendenciaDeJugadora(actsDeLaJugadora, metrica, ordenTorneos, torneoId = null) {
  const porTorneo = new Map();
  for (const a of actsDeLaJugadora) {
    const t = porTorneo.get(a.torneoId) ?? [];
    t.push(a);
    porTorneo.set(a.torneoId, t);
  }
  const puntos = ordenTorneos
    .filter((id) => porTorneo.has(id))
    .map((id) => ({ torneoId: id, f: resumenDeMetrica(sumarPorFundamento(porTorneo.get(id)), metrica) }))
    .filter((p) => p.f.acciones >= MIN_ACCIONES);
  const indice = torneoId == null ? puntos.length - 1 : puntos.findIndex((p) => p.torneoId === torneoId);
  if (indice < 1) return null;
  const actual = puntos[indice];
  const previo = puntos[indice - 1];
  const diferencia = Math.round((valorDeMetrica(actual.f, metrica) - valorDeMetrica(previo.f, metrica)) * 100) / 100;
  return { diferencia, actualId: actual.torneoId, previoId: previo.torneoId, calidad: metrica.orden === 'calidad' };
}

// El ranking de una posición para una métrica. `torneoId` (o null = todos los torneos) limita de dónde salen las jugadas.
// Devuelve { ranking, pocas }: las que entran al ranking (con puesto) y las que tienen pocas jugadas (sin puesto).
// Cada fila: { jugadorId, partidos, f (cifras de la métrica), tendencia }.
export function rankingDeGrupo(acts, grupo, metrica, { torneoId = null, ordenTorneos = [] } = {}) {
  const delGrupo = acts.filter((a) => a.grupo === grupo);
  const actuales = torneoId == null ? delGrupo : delGrupo.filter((a) => a.torneoId === torneoId);
  const porJugadora = new Map();
  for (const a of actuales) {
    if (!porJugadora.has(a.jugadorId)) porJugadora.set(a.jugadorId, []);
    porJugadora.get(a.jugadorId).push(a);
  }
  const todasPorJugadora = new Map();
  for (const a of delGrupo) {
    if (!todasPorJugadora.has(a.jugadorId)) todasPorJugadora.set(a.jugadorId, []);
    todasPorJugadora.get(a.jugadorId).push(a);
  }
  const filas = [...porJugadora]
    .map(([jugadorId, lista]) => ({
      jugadorId,
      partidos: new Set(lista.map((a) => a.partidoId)).size,
      f: resumenDeMetrica(sumarPorFundamento(lista), metrica),
      tendencia: tendenciaDeJugadora(todasPorJugadora.get(jugadorId), metrica, ordenTorneos, torneoId),
    }))
    .filter((r) => r.f.acciones > 0);
  const nulo = (x) => x ?? -Infinity;
  if (metrica.orden === 'directos') {
    filas.sort((a, b) => b.f.directos - a.f.directos || nulo(b.f.directosPct) - nulo(a.f.directosPct) || b.f.acciones - a.f.acciones);
    return { ranking: filas.filter((r) => r.f.directos > 0), pocas: filas.filter((r) => r.f.directos === 0) };
  }
  const clave = { eficiencia: 'eficienciaPct', calidad: 'calidadMedia' }[metrica.orden] ?? 'efectividadPct';
  filas.sort((a, b) => nulo(b.f[clave]) - nulo(a.f[clave]) || b.f.acciones - a.f.acciones);
  return { ranking: filas.filter((r) => r.f.acciones >= MIN_ACCIONES), pocas: filas.filter((r) => r.f.acciones < MIN_ACCIONES) };
}

// ─────────────── Evolución ───────────────
// Una unidad por torneo (o por partido) en orden cronológico, con los fundamentos resumidos.
// `acts` ya viene filtrado (género, categoría); con `jugadorId` solo cuenta lo de esa jugadora.
// `torneos`: lo que devuelve torneosOrdenados. En modo 'torneo' del equipo, `resumen` trae los partidos ganados y perdidos y los sets.
export function unidadesDeEvolucion(acts, { modo = 'torneo', torneos, jugadorId = null }) {
  const propias = jugadorId == null ? acts : acts.filter((a) => a.jugadorId === jugadorId);
  const resumirTodos = (lista) => {
    const total = sumarPorFundamento(lista);
    return Object.fromEntries(FUNDAMENTOS.map((f) => [f, resumirConteos(total[f] ?? vacio())]));
  };
  const idsPartido = (lista) => [...new Set(lista.map((a) => a.partidoId))];
  const unidades = [];
  if (modo === 'partido') {
    for (const t of torneos) {
      for (const r of t.partidos) {
        const lista = propias.filter((a) => a.partidoId === r.id);
        if (!lista.length) continue;
        const resultado = resultadoDelPartido(r.est);
        unidades.push({ clave: `p${r.id}`, torneoId: t.id, etiqueta: r.fecha ?? '', fecha: r.fecha ?? '', detalle: `vs ${String(rivalDeRegistro(r)).trim()}`, partidos: 1, resumen: null, resultado, fundamentos: resumirTodos(lista) });
      }
    }
    return unidades.sort((a, b) => String(a.etiqueta).localeCompare(String(b.etiqueta)));
  }
  for (const t of torneos) {
    const lista = propias.filter((a) => a.torneoId === t.id);
    if (!lista.length) continue;
    const jugados = new Set(idsPartido(lista));
    const delTorneo = t.partidos.filter((r) => jugados.has(r.id));
    const resumen = jugadorId == null ? { ganados: 0, perdidos: 0, setsGanados: 0, setsPerdidos: 0 } : null;
    if (resumen) {
      for (const r of delTorneo) {
        const res = resultadoDelPartido(r.est);
        if (res === 'ganado') resumen.ganados += 1;
        else if (res === 'perdido') resumen.perdidos += 1;
        const s = setsDelPartido(r.est);
        resumen.setsGanados += s.ganados;
        resumen.setsPerdidos += s.perdidos;
      }
    }
    unidades.push({ clave: `t${t.id}`, torneoId: t.id, etiqueta: t.nombre, fecha: t.fechaInicio, detalle: resumen ? `${resumen.ganados}G-${resumen.perdidos}P` : `${jugados.size} ${jugados.size === 1 ? 'partido' : 'partidos'}`, partidos: jugados.size, resumen, resultado: null, fundamentos: resumirTodos(lista) });
  }
  return unidades;
}

// Fundamentos con jugadas entre las unidades (en el orden de siempre), para ofrecer solo las series que tienen datos.
export function fundamentosConJugadas(unidades) {
  return FUNDAMENTOS.filter((f) => unidades.some((u) => u.fundamentos[f].acciones > 0));
}

// Cambio en puntos porcentuales entre dos unidades seguidas (null si falta alguno de los dos).
export const diferenciaPuntos = (a, b) => (a == null || b == null ? null : b - a);

// ─────────────── Textos ───────────────
export const textoPct = (v) => (v == null ? '–' : `${v}%`);
export const textoCalidad = (v) => (v == null ? '–' : v.toFixed(2).replace('.', ','));
export function textoCambio(diferencia, calidad = false) {
  if (diferencia == null || diferencia === 0) return '';
  const cifra = calidad ? Math.abs(diferencia).toFixed(2).replace('.', ',') : String(Math.abs(diferencia));
  return `${diferencia > 0 ? '▲' : '▼'}${cifra}`;
}

export function fechaMuyCorta(fecha) {
  const d = new Date(`${fechaDe(fecha)}T00:00`);
  return Number.isNaN(d.getTime()) ? String(fecha ?? '') : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// ─────────────── Gráfica de líneas ───────────────
const num = (x) => Math.round(x * 10) / 10;
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const recortar = (t, max) => (String(t).length > max ? `${String(t).slice(0, max - 1).trimEnd()}…` : String(t));

// etiquetas: una por unidad. series: [{ clase, valores }] con valores de 0 a 100 (null = sin dato: la línea se corta).
// Los textos de las etiquetas vienen de los nombres de torneo, que escribe una persona: aquí se escapan.
export function svgEvolucion({ etiquetas, series, id = 'ev', ancho = 640, alto = 250, descripcion = 'Evolución' }) {
  const n = etiquetas.length;
  if (!n) return '';
  const izq = 44;
  const der = 44;
  const arriba = 14;
  const abajo = 40;
  const w = ancho - izq - der;
  const hh = alto - arriba - abajo;
  const x = (i) => (n === 1 ? izq + w / 2 : izq + (i / (n - 1)) * w);
  const y = (v) => arriba + hh - (Math.max(0, Math.min(100, v)) / 100) * hh;
  const partes = [`<svg class="ls-svg ev-svg" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${escapar(descripcion)}" preserveAspectRatio="xMidYMid meet">`];
  for (const v of [0, 25, 50, 75, 100]) {
    partes.push(`<line class="${v === 0 ? 'ls-cero' : 'ls-rejilla'}" x1="${izq}" x2="${izq + w}" y1="${num(y(v))}" y2="${num(y(v))}"/>`);
    partes.push(`<text class="ls-eje" x="${izq - 6}" y="${num(y(v) + 4)}" text-anchor="end">${v}</text>`);
  }
  const cadaCuanto = Math.ceil(n / 8); // con muchas unidades solo se rotulan algunas, para que no se amontonen
  etiquetas.forEach((e, i) => {
    if (i % cadaCuanto !== 0 && i !== n - 1) return;
    if (i !== n - 1 && n - 1 - i < cadaCuanto && cadaCuanto > 1) return;
    partes.push(`<text class="ls-eje" x="${num(x(i))}" y="${alto - 14}" text-anchor="middle">${escapar(recortar(e, n > 4 ? 11 : 16))}</text>`);
  });
  series.forEach((s) => {
    let tramo = [];
    const cerrar = () => {
      if (tramo.length > 1) partes.push(`<polyline class="ev-linea ${s.clase}" points="${tramo.join(' ')}"/>`);
      tramo = [];
    };
    s.valores.forEach((v, i) => {
      if (v == null) return cerrar();
      tramo.push(`${num(x(i))},${num(y(v))}`);
    });
    cerrar();
    s.valores.forEach((v, i) => {
      if (v != null) partes.push(`<circle class="ev-punto ${s.clase}" cx="${num(x(i))}" cy="${num(y(v))}" r="5.5"/>`);
    });
  });
  partes.push('</svg>');
  return partes.join('');
}

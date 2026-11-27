// Ajustes → «Puntos del MVP»: la entrenadora cambia cuánto vale cada jugada en la fórmula del MVP, sin tocar código.
// Cada valor se cambia con − y + (o escribiéndolo). Guardar recalcula el MVP de todos los partidos; Restablecer vuelve a los de siempre.
import { app } from '../contexto.js';
import { PESOS_MVP_POR_DEFECTO, textoPuntos } from '../mvp.js';
import { CAMPOS_PESO, guardarPesosMvp, leerNumero, sonLosPorDefecto, validarPesos } from '../pesosMvp.js';
import { abrirVentana, toast } from './aviso.js';
import { h, icono } from './dom.js';

const redondear2 = (n) => Math.round(n * 100) / 100;

export function abrirPesosMvp() {
  const valores = {};
  const entradas = {};
  for (const c of CAMPOS_PESO) valores[c.clave] = textoPuntos(app.pesosMvp?.[c.clave] ?? PESOS_MVP_POR_DEFECTO[c.clave]);

  const pintarValor = (c) => {
    const el = entradas[c.clave];
    el.value = valores[c.clave];
    const n = leerNumero(valores[c.clave]);
    el.setAttribute('aria-invalid', String(n == null || n < c.min || n > c.max));
  };
  const mover = (c, signo) => {
    const actual = leerNumero(valores[c.clave]) ?? PESOS_MVP_POR_DEFECTO[c.clave];
    valores[c.clave] = textoPuntos(Math.min(c.max, Math.max(c.min, redondear2(actual + signo * c.paso))));
    pintarValor(c);
  };

  const fila = (c) => {
    const entrada = h('input', {
      class: 'peso-entrada',
      type: 'text',
      inputmode: 'decimal',
      value: valores[c.clave],
      'aria-label': c.etiqueta,
      'data-peso': c.clave,
      oninput: (e) => {
        valores[c.clave] = e.target.value;
        const n = leerNumero(e.target.value);
        e.target.setAttribute('aria-invalid', String(n == null || n < c.min || n > c.max));
      },
    });
    entradas[c.clave] = entrada;
    pintarValor(c);
    return h(
      'div',
      { class: 'peso-fila' },
      h('div', { class: 'peso-texto' }, h('strong', {}, c.etiqueta), h('small', {}, c.ayuda)),
      h(
        'div',
        { class: 'peso-control' },
        h('button', { class: 'peso-boton', type: 'button', 'aria-label': `Bajar ${c.etiqueta}`, 'data-peso-menos': c.clave, onclick: () => mover(c, -1) }, icono('menos', { tam: 20 })),
        entrada,
        h('button', { class: 'peso-boton', type: 'button', 'aria-label': `Subir ${c.etiqueta}`, 'data-peso-mas': c.clave, onclick: () => mover(c, 1) }, icono('mas', { tam: 20 }))
      )
    );
  };

  return abrirVentana({
    titulo: 'Puntos del MVP',
    subtitulo: 'Cuánto vale cada jugada para elegir a la MVP',
    ancho: 'media',
    contenido: () =>
      h(
        'div',
        { class: 'peso-lista' },
        CAMPOS_PESO.map(fila),
        h('p', { class: 'nota' }, 'Vale para el MVP de cada partido y el del torneo, también de los partidos ya jugados: se recalcula al guardar. Para aparecer hay que tener 3 jugadas (8 la líbero).')
      ),
    acciones: [
      {
        texto: 'Volver a los de siempre',
        cerrar: false,
        onclick: () => {
          for (const c of CAMPOS_PESO) {
            valores[c.clave] = textoPuntos(PESOS_MVP_POR_DEFECTO[c.clave]);
            pintarValor(c);
          }
        },
      },
      { texto: 'Cancelar' },
      {
        texto: 'Guardar',
        tipo: 'primario',
        onclick: async () => {
          const { pesos, errores } = validarPesos(valores);
          if (errores.length) {
            toast(errores[0].mensaje, 'error');
            return false;
          }
          try {
            app.pesosMvp = await guardarPesosMvp(app.almacen, pesos);
          } catch {
            toast('No se pudo guardar. Intenta de nuevo.', 'error');
            return false;
          }
          toast(sonLosPorDefecto(app.pesosMvp) ? 'Puntos del MVP como siempre.' : 'Puntos del MVP guardados. El MVP se recalculó.', 'ok');
          app.renderizar();
        },
      },
    ],
  });
}

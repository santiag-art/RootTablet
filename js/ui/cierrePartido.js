// Cierre guiado de un partido: un solo botón saca los resultados para Roots y la copia de seguridad, uno tras otro.
// Cada paso muestra si ya salió; si se cancela uno, el otro no se pierde y se puede seguir desde donde quedó.
import { app } from '../contexto.js';
import { abrirVentana, toast } from './aviso.js';
import { guardarCopiaAhora } from './copiaPantalla.js';
import { h, icono, rellenar } from './dom.js';
import { entregarResultados } from './exportarPantalla.js';

// `registros`: un partido o una lista (el aviso del inicio los cierra juntos).
export function abrirCierrePartido(registros) {
  const regs = [].concat(registros);
  const ids = regs.map((r) => r.id);
  const estado = { resultados: false, copia: false, trabajando: false, nota: '' };
  const cuerpo = h('div', { class: 'cierre' });

  const paso = (clave, titulo, sub, accion) =>
    h(
      'button',
      { class: `opcion cierre-paso ${estado[clave] ? 'hecho' : ''}`, 'data-paso': clave, disabled: estado.trabajando, onclick: () => ejecutar([[clave, accion]]) },
      h('span', { class: 'caja-marca' }, estado[clave] ? icono('ok', { tam: 20, grueso: 3 }) : null),
      h('span', { class: 'datos' }, h('strong', {}, titulo), h('small', {}, estado[clave] ? 'Listo' : sub))
    );

  // En práctica no sale nada de verdad: se ensaya el recorrido y los pasos quedan en Listo.
  const sacarResultados = async () => (app.practica ? true : Boolean(await entregarResultados([...app.partidos.values()], ids)));
  const sacarCopia = async () => (app.practica ? true : guardarCopiaAhora());

  async function ejecutar(pasos) {
    estado.trabajando = true;
    estado.nota = '';
    pintar();
    for (const [clave, accion] of pasos) {
      if (estado[clave]) continue;
      let ok = false;
      try {
        ok = await accion();
      } catch (err) {
        console.error(err);
      }
      estado[clave] = ok;
      if (!ok) {
        estado.nota = clave === 'resultados' ? 'No salieron los resultados. Toca el botón para intentarlo otra vez.' : 'La copia no salió. Toca el botón para intentarlo otra vez.';
        break;
      }
    }
    estado.trabajando = false;
    pintar();
  }

  const todo = () => ejecutar([['resultados', sacarResultados], ['copia', sacarCopia]]);

  function pintar() {
    const listo = estado.resultados && estado.copia;
    const algo = estado.resultados || estado.copia;
    rellenar(
      cuerpo,
      h('p', { class: 'ventana-texto' }, app.practica ? (listo ? 'Práctica: así se verá en un partido real. No se envió nada.' : 'Práctica: ensayas el recorrido, pero no se envía nada de verdad.') : listo ? 'Todo salió de la tablet. Ya puedes cerrar.' : 'Un solo toque: se prepara el archivo para Roots y luego la copia de seguridad. En cada uno eliges cómo sacarlo (Drive, QR, compartir o guardar).'),
      h('div', { class: 'lista-opciones' }, paso('resultados', 'Resultados para Roots', 'Los sets y jugadas de este partido', sacarResultados), paso('copia', 'Copia de seguridad', 'Todo lo que hay en la tablet', sacarCopia)),
      estado.nota ? h('p', { class: 'error-linea' }, estado.nota) : null,
      h(
        'div',
        { class: 'cierre-botones' },
        h('button', { class: 'btn btn-fantasma btn-grande', onclick: () => ventana.cerrar() }, listo ? 'Cerrar' : 'Ahora no'),
        listo ? null : h('button', { class: 'btn btn-primario btn-grande', 'data-cierre-todo': '', disabled: estado.trabajando, onclick: todo }, icono('bajar'), algo ? 'Seguir con lo que falta' : 'Exportar y guardar copia')
      )
    );
  }

  const subtitulo = regs.length === 1 ? `${regs[0].equipoLocal} vs ${regs[0].equipoVisitante}` : `${regs.length} partidos terminados`;
  const ventana = abrirVentana({
    titulo: regs.length === 1 ? 'Partido terminado' : 'Partidos terminados',
    subtitulo,
    ancho: 'chica',
    contenido: cuerpo,
    // Si se cierra sin terminar, no se pierde nada, pero se avisa que quedó pendiente (y el inicio lo sigue recordando).
    alCerrar: () => { if (!app.practica && !(estado.resultados && estado.copia)) toast('Quedó pendiente exportar y guardar la copia. Te lo recuerdo en el inicio.', 'info', 5000); },
  });
  pintar();
  return ventana;
}

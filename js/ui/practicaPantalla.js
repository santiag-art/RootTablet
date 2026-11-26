// Modo práctica: entrar, salir, reiniciar, y la marca que no deja olvidar que estás practicando.
import { app, cargarDatos } from '../contexto.js';
import { NOMBRE_BD_PRACTICA, cargarMuestra, prepararPractica, reiniciarPractica } from '../practica.js';
import { abrirAlmacen } from '../store.js';
import { confirmar, informar, toast } from './aviso.js';
import { reiniciarSeleccion } from './acciones.js';
import { h } from './dom.js';
import { olvidarVistaPartido } from './partido.js';

async function usarAlmacen(almacen, practica) {
  almacen.alFallar = app.alFallarAlmacen;
  app.almacen = almacen;
  app.practica = practica;
  app.guardado = { estado: 'ok', hora: null };
  olvidarVistaPartido();
  reiniciarSeleccion();
  await cargarDatos();
  location.hash = '#/';
  app.renderizar();
}

export async function entrarPractica() {
  if (app.practica) return;
  const ok = await confirmar({
    titulo: 'Entrar al modo práctica',
    texto: 'Se abren partidos de ejemplo para ensayar. Lo que hagas aquí NO toca tus partidos reales y NO sale en resultados ni copias. Mientras practicas, la pantalla tiene un marco naranja.',
    si: 'Entrar a practicar',
  });
  if (!ok) return;
  try {
    const texto = await cargarMuestra();
    app.almacenReal = app.almacenReal ?? app.almacen;
    app.almacenPractica = app.almacenPractica ?? (await abrirAlmacen(NOMBRE_BD_PRACTICA));
    const nuevo = await prepararPractica(app.almacenPractica, texto);
    await usarAlmacen(app.almacenPractica, true);
    toast(nuevo ? 'Modo práctica: partidos de ejemplo cargados.' : 'Modo práctica: seguiste donde lo dejaste.', 'ok');
  } catch (err) {
    console.error(err);
    await informar({ titulo: 'No pude abrir el modo práctica', texto: 'No encontré los datos de ejemplo. Abre la app una vez con internet para que los guarde, o actualiza la app.' });
  }
}

export async function salirPractica() {
  if (!app.practica) return;
  await usarAlmacen(app.almacenReal, false);
  toast('Saliste del modo práctica. Estás en tus datos reales.', 'ok');
}

export async function reiniciarPracticaAhora() {
  if (!app.practica) return;
  const ok = await confirmar({ titulo: 'Reiniciar la práctica', texto: 'Se borra todo lo que anotaste en práctica y los partidos de ejemplo vuelven a quedar nuevos. Tus datos reales no cambian.', si: 'Reiniciar', peligro: true });
  if (!ok) return;
  try {
    await reiniciarPractica(app.almacen, await cargarMuestra());
    await usarAlmacen(app.almacen, true);
    toast('Práctica reiniciada.', 'ok');
  } catch (err) {
    console.error(err);
    toast('No pude reiniciar la práctica.', 'error');
  }
}

// Marco naranja alrededor de toda la pantalla (no se puede tocar ni tapa nada) para no confundir práctica con lo real.
// La etiqueta "PRÁCTICA" y el botón para salir viven en el encabezado del inicio y del partido, no flotando encima de otros botones.
export function pintarMarcaPractica() {
  document.body.classList.toggle('practica', app.practica);
}

export const chipPractica = () => (app.practica ? h('span', { class: 'chip-practica' }, 'PRÁCTICA') : null);

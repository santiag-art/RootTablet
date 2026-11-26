import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerArchivoRoots, aplicarImportacion } from '../js/importar.js';
import { crearAlmacen, crearRespaldoMemoria } from '../js/store.js';
import { prepararPractica, reiniciarPractica, ARCHIVO_MUESTRA } from '../js/practica.js';
import * as M from '../js/motor.js';

const MUESTRA = readFileSync(new URL('../' + ARCHIVO_MUESTRA, import.meta.url), 'utf8');
const nuevo = () => crearAlmacen(crearRespaldoMemoria());

test('los datos de ejemplo que trae la app son válidos', () => {
  assert.equal(leerArchivoRoots(MUESTRA).partidos.length, 3);
});

test('la práctica carga los ejemplos una sola vez y no toca el almacén real', async () => {
  const real = nuevo();
  const practica = nuevo();
  await aplicarImportacion(real, leerArchivoRoots(JSON.stringify({ ...JSON.parse(MUESTRA), idExportacion: 'real-1' })), { nombreArchivo: 'real.json' });
  const antes = JSON.stringify(await real.todos('partidos'));

  assert.equal(await prepararPractica(practica, MUESTRA), true);
  assert.equal((await practica.todos('partidos')).length, 3);
  assert.equal(await prepararPractica(practica, MUESTRA), false); // ya había: no se duplica ni se pisa

  // anotar en práctica no cambia lo real
  const reg = await practica.uno('partidos', 10);
  M.elegirFormato(reg.est, 'mejor_de_3');
  await practica.guardar('partidos', reg);
  await practica.pendientes();
  assert.equal(JSON.stringify(await real.todos('partidos')), antes);
});

test('reiniciar la práctica deja los ejemplos como nuevos', async () => {
  const practica = nuevo();
  await prepararPractica(practica, MUESTRA);
  const reg = await practica.uno('partidos', 10);
  M.elegirFormato(reg.est, 'mejor_de_5');
  await practica.guardar('partidos', reg);
  await practica.pendientes();
  await reiniciarPractica(practica, MUESTRA);
  const otra = await practica.uno('partidos', 10);
  assert.equal(otra.est.formatoSets ?? null, null);
  assert.equal((await practica.todos('partidos')).length, 3);
});

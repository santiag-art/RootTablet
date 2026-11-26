import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARCHIVO_MANUAL, SECCIONES } from '../js/ayudaContenido.js';

const raiz = new URL('..', import.meta.url);
const TIPOS = ['p', 'pasos', 'lista', 'consejo', 'alerta', 'tabla'];

test('la ayuda tiene secciones completas y sin ids repetidos', () => {
  assert.ok(SECCIONES.length >= 11);
  assert.equal(new Set(SECCIONES.map((s) => s.id)).size, SECCIONES.length);
  for (const s of SECCIONES) {
    assert.ok(s.titulo && s.sub && s.bloques.length > 0, `sección ${s.id} incompleta`);
    for (const b of s.bloques) {
      const claves = Object.keys(b).filter((k) => TIPOS.includes(k));
      assert.equal(claves.length, 1, `bloque raro en ${s.id}`);
      const v = b[claves[0]];
      assert.ok(typeof v === 'string' ? v.length > 0 : v.length > 0, `bloque vacío en ${s.id}`);
    }
  }
});

test('la ayuda habla de lo nuevo de la app', () => {
  const texto = JSON.stringify(SECCIONES);
  for (const clave of ['Exportar y guardar copia', 'Modo práctica', 'Quitar la selección|quita la selección']) assert.match(texto, new RegExp(clave, 'i'));
});

test('el manual en PDF viaja con la app y el service worker lo guarda', () => {
  const pdf = readFileSync(new URL(ARCHIVO_MANUAL, raiz));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 100_000);
  assert.ok(readFileSync(new URL('sw.js', raiz), 'utf8').includes(`'${ARCHIVO_MANUAL}'`));
});

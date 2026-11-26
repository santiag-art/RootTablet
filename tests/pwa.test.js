import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
const listar = (dir) => readdirSync(join(raiz, dir)).flatMap((f) => (statSync(join(raiz, dir, f)).isDirectory() ? listar(join(dir, f)) : [join(dir, f)]));

test('el service worker guarda todos los archivos de la app', () => {
  const sw = readFileSync(join(raiz, 'sw.js'), 'utf8');
  const faltan = ['css', 'data', 'icons', 'img', 'js', 'manual'].flatMap(listar).concat(['index.html', 'manifest.webmanifest']).filter((f) => !sw.includes(`'${f}'`));
  assert.deepEqual(faltan, []);
});

// ─────────────── Política de seguridad (CSP) ───────────────
const leerCSP = {
  meta: () => /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(readFileSync(join(raiz, 'index.html'), 'utf8'))?.[1],
  headers: () => /Content-Security-Policy: (.+)/.exec(readFileSync(join(raiz, '_headers'), 'utf8'))?.[1],
  toml: () => /Content-Security-Policy = "([^"]+)"/.exec(readFileSync(join(raiz, 'netlify.toml'), 'utf8'))?.[1],
};
const sinAncestros = (csp) => csp.replace(/; frame-ancestors 'none'$/, '');

test('la política de seguridad existe y es la misma en index.html, _headers y netlify.toml', () => {
  const { meta, headers, toml } = { meta: leerCSP.meta(), headers: leerCSP.headers(), toml: leerCSP.toml() };
  assert.ok(meta && headers && toml, 'falta la CSP en alguno de los tres sitios');
  assert.equal(sinAncestros(headers), meta);
  assert.equal(sinAncestros(toml), meta);
  assert.match(headers, /frame-ancestors 'none'/);
});

test('la política no abre la puerta a código ajeno', () => {
  const csp = leerCSP.meta();
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  const scripts = /script-src ([^;]+)/.exec(csp)[1].split(' ');
  assert.deepEqual(scripts, ["'self'", 'https://accounts.google.com/gsi/client']);
});

test('la app cumple la política: sin scripts ni estilos en línea, sin eval', () => {
  const html = readFileSync(join(raiz, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/i, 'hay un <script> en línea');
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'hay un manejador de eventos en línea');
  assert.doesNotMatch(html, /<style|\sstyle=/i, 'hay estilos en línea');
  const codigo = listar('js').map((f) => [f, readFileSync(join(raiz, f), 'utf8')]);
  for (const [f, texto] of codigo) {
    assert.doesNotMatch(texto, /\beval\(|new Function\(|setAttribute\(\s*['"]style['"]/, `${f} usa eval o estilos en línea`);
  }
});

test('la versión que muestra la app es la misma del service worker', () => {
  const app = /export const VERSION = '([^']+)'/.exec(readFileSync(join(raiz, 'js/contexto.js'), 'utf8'))?.[1];
  const sw = /const VERSION = 'roots-tablet-v([^']+)'/.exec(readFileSync(join(raiz, 'sw.js'), 'utf8'))?.[1];
  assert.ok(app && sw, 'no encontré la versión en contexto.js o en sw.js');
  assert.equal(app, sw);
});

test('el manifiesto es instalable', () => {
  const m = JSON.parse(readFileSync(join(raiz, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
  assert.equal(m.start_url, './');
});

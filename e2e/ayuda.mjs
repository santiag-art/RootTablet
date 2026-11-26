// Ayuda: abre desde el inicio y desde el menú del partido, secciones que se abren y el PDF disponible. Uso: node e2e/ayuda.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { servir } from './servidor.mjs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp';
const { s, puerto } = await servir(RAIZ);
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1180, height: 700 }, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const ok = (c, m) => { console.log(c ? 'ok:' : 'FALLA:', m); if (!c) errs.push(m); };
const vis = '.ventana-fondo:not(.saliendo) ';
await page.goto(`http://127.0.0.1:${puerto}/`);
await page.waitForSelector('.vacio');
await page.click('[data-ayuda]');
await page.waitForSelector(vis + '.ayuda');
ok((await page.locator(vis + '.ayuda-seccion').count()) >= 11, 'la ayuda lista todas las secciones');
const href = await page.locator(vis + '[data-manual-pdf]').getAttribute('href');
const r = await page.request.get(`http://127.0.0.1:${puerto}/${href}`);
ok(r.status() === 200 && /pdf/.test(r.headers()['content-type']) && (await r.body()).subarray(0, 5).toString() === '%PDF-', 'el enlace del manual entrega el PDF');
await page.click(vis + '[data-seccion="jugadas"] summary');
ok(await page.locator(vis + '[data-seccion="jugadas"]').evaluate((d) => d.open), 'una sección se abre al tocarla');
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '/ay1-ayuda.png' });
await page.locator(vis + '.ventana-pie .btn-primario').click();
// el service worker guarda el manual para usarlo sin internet
await page.evaluate(() => navigator.serviceWorker.ready);
let guardado = false;
for (let i = 0; i < 40 && !guardado; i++) {
  guardado = await page.evaluate(async () => Boolean(await caches.match('manual/Manual-Roots-Tablet-v1.0.pdf')));
  if (!guardado) await page.waitForTimeout(250);
}
ok(guardado, 'el manual queda guardado para abrirlo sin internet');
// desde el menú del partido
const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
await ch.setFiles(RAIZ + 'tests/fixtures/muestra-roots.json');
await page.click(vis + '.ventana-pie .btn-primario');
await page.waitForSelector('.partido-tarjeta');
await page.locator('.partido-tarjeta').first().click();
await page.waitForSelector('[aria-label="Menú del partido"]');
await page.click('[aria-label="Menú del partido"]');
await page.click(vis + '>> text=El manual: cómo anotar');
await page.waitForSelector(vis + '.ayuda');
ok(true, 'la Ayuda también está en el menú del partido');
console.log('ERRORES', errs);
await nav.close(); s.close(); process.exit(errs.length ? 1 : 0);

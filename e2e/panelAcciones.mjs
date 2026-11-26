// Panel de Acciones en pantalla corta: se puede subir hasta ver todo, las calificaciones quedan fijas y la X quita la selección.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { servir } from './servidor.mjs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp';
const { s, puerto } = await servir(RAIZ);
const nav = await chromium.launch();
const ALTO = 520;
const page = await (await nav.newContext({ viewport: { width: 1180, height: ALTO }, hasTouch: true })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const ok = (c, m) => { console.log(c ? 'ok:' : 'FALLA:', m); if (!c) errs.push(m); };
const vis = '.ventana-fondo:not(.saliendo) ';
await page.goto(`http://127.0.0.1:${puerto}/`);
await page.waitForSelector('.vacio');
const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
await ch.setFiles(RAIZ + 'tests/fixtures/muestra-roots.json');
await page.click(vis + '.ventana-pie .btn-primario');
await page.waitForTimeout(300);
await page.evaluate(async () => {
  const M = await import('/js/motor.js');
  const r = window.__roots.partidos.get(10);
  const jug = [...window.__roots.jugadores.values()].filter((j) => j.genero === 'femenino');
  const c = { jugadores: jug, lesiones: new Map(), ahora: () => new Date(), avisar() {} };
  M.elegirFormato(r.est, 'mejor_de_3');
  const normales = jug.filter((j) => j.posicion !== 'Líbero').slice(0, 6);
  M.cambiarModoLibero(r.est, 'ninguno');
  normales.forEach((j) => M.toggleJugador(r.est, c, j.id, { posicion: j.posicion }));
  M.confirmarPlantilla(r.est, c);
  await window.__roots.almacen.guardar('partidos', r);
});
await page.goto(`http://127.0.0.1:${puerto}/#/partido/10`);
await page.reload();
await page.waitForSelector('.tabs');
await page.click('.tabs >> text=Acciones');
// elige una jugadora que tenga Colocación (la colocadora)
const n = await page.locator('.jugador-btn').count();
for (let i = 0; i < n; i++) {
  await page.locator('.jugador-btn').nth(i).click();
  if (await page.locator('.btn-fund', { hasText: 'Colocación' }).count()) break;
}
await page.locator('.btn-fund', { hasText: 'Colocación' }).click();
ok((await page.locator('text=¿Cómo llegó el pase?').count()) === 1, 'Colocación muestra la pregunta del pase');
await page.screenshot({ path: SHOTS + '/p1-sin-scroll.png' });
const dentro = async (sel) => page.locator(sel).evaluateAll((els, alto) => els.map((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= alto; }), ALTO);
const scrollA = (y) => page.locator('.partido').evaluate((e, y) => { e.scrollTop = y === 'fin' ? e.scrollHeight : y; }, y);
await scrollA('fin');
await page.waitForTimeout(150);
await page.screenshot({ path: SHOTS + '/p2-con-scroll.png' });
ok((await dentro('.btn-calif')).every(Boolean), 'Colocación: las 4 calificaciones quedan a la vista al final del scroll');
ok((await dentro('.panel-x')).every(Boolean), 'la X queda a la vista (fija arriba)');
ok((await dentro('.segmentos button')).every(Boolean), 'los botones de pase buenos/malos quedan a la vista');
await scrollA(150);
await page.waitForTimeout(100);
ok((await dentro('.btn-calif')).every(Boolean), 'con scroll intermedio las calificaciones siguen a la vista (fijas)');
await scrollA(0);
// Bloqueo con "en conjunto"
await page.locator('.btn-fund', { hasText: 'Bloqueo' }).or(page.locator('.btn-fund', { hasText: 'Defensa' })).first().click();
const bloqueo = await page.locator('.check-grande').count();
if (bloqueo) {
  await scrollA('fin');
  ok((await dentro('.check-grande')).every(Boolean) && (await dentro('.btn-calif')).every(Boolean), 'Bloqueo: la casilla "en conjunto" y las calificaciones quedan a la vista');
  await page.screenshot({ path: SHOTS + '/p3-bloqueo.png' });
}
await scrollA(0);
// X quita la selección
await page.click('.panel-x');
ok((await page.locator('.panel-x').count()) === 0 && (await page.locator('.sin-seleccion').count()) === 1, 'la X quita la selección');
// volver a tocar un fundamento lo apaga
await page.locator('.jugador-btn').first().click();
await page.locator('.btn-fund').first().click();
await page.locator('.btn-fund[aria-pressed="true"]').click();
ok((await page.locator('.btn-fund[aria-pressed="true"]').count()) === 0, 'tocar de nuevo el fundamento lo quita');
// anotar una jugada sigue funcionando
await page.locator('.btn-fund').first().click();
await page.locator('.btn-calif').first().click();
ok((await page.evaluate(() => window.__roots.partidos.get(10).est.actual.eventos.length)) === 1, 'anotar una jugada sigue funcionando');
console.log('ERRORES', errs);
await nav.close(); s.close(); process.exit(errs.length ? 1 : 0);

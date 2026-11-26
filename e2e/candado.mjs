// Candado de toques: bloquea, ignora toques, no desbloquea con un toque corto y sí manteniendo. Uso: SHOTS=carpeta node e2e/candado.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { servir } from './servidor.mjs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp';
const { s, puerto } = await servir(RAIZ);
const nav = await chromium.launch();
const errs = [];
const ok = (c, m) => { console.log(c ? 'ok:' : 'FALLA:', m); if (!c) errs.push(m); };
const vis = '.ventana-fondo:not(.saliendo) ';
for (const [w, h] of [[1280, 800], [800, 1180]]) {
  const page = await (await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => localStorage.setItem('roots-detalle-rival', JSON.stringify({ activo: false })));
  await page.goto(`http://127.0.0.1:${puerto}/`);
  await page.waitForSelector('.vacio');
  const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
  await ch.setFiles(RAIZ + 'tests/fixtures/muestra-roots.json');
  await page.click(vis + '.ventana-pie .btn-primario');
  await page.waitForSelector('.partido-tarjeta');
  await page.locator('.partido-tarjeta').first().click();
  await page.waitForSelector('.barra');
  if (await page.locator('.formato .btn-primario').count()) await page.click('text=Mejor de 3');
  const puntos = () => page.evaluate(() => [...document.querySelectorAll('.marcador-num')].map((e) => e.textContent).join('-'));
  const antes = await puntos();
  ok(await page.locator('.b-candado').isVisible(), `[${w}] el botón del candado está en la barra`);
  const caja = await page.locator('.b-candado').boundingBox();
  ok(caja.width >= 44 && caja.height >= 44, `[${w}] el candado es grande (${caja.width}x${caja.height})`);
  await page.click('.b-candado');
  await page.waitForSelector('.candado-capa');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/candado-${w}.png` });
  // toques sobre donde estaba el + no hacen nada (la capa los recibe)
  await page.mouse.click(300, 130);
  await page.mouse.click(w - 100, 130);
  await page.touchscreen.tap(w / 2, 300);
  ok((await puntos()) === antes, `[${w}] bloqueado: los toques no suman puntos`);
  // toque corto en el botón no desbloquea
  const b = await page.locator('.candado-boton').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.waitForTimeout(300); await page.mouse.up();
  ok((await page.locator('.candado-capa').count()) === 1, `[${w}] un toque corto no desbloquea`);
  // mantener a medias y soltar tampoco
  await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
  await page.waitForTimeout(900);
  ok((await page.locator('.candado-capa').count()) === 1, `[${w}] soltar a medias no desbloquea`);
  // mantener completo
  await page.mouse.down(); await page.waitForTimeout(1700); await page.mouse.up();
  ok((await page.locator('.candado-capa').count()) === 0, `[${w}] manteniendo pulsado se desbloquea`);
  ok((await puntos()) === antes, `[${w}] el marcador sigue igual`);
  await page.click('.btn-punto.mas >> nth=0');
  ok((await puntos()) !== antes, `[${w}] ya se puede anotar de nuevo`);
  // Android atrás: desbloquea sola
  await page.click('.b-candado');
  await page.waitForSelector('.candado-capa');
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(300);
  ok((await page.locator('.candado-capa').count()) === 0, `[${w}] al salir del partido se desbloquea sola`);
}
await nav.close(); s.close();
console.log('ERRORES', errs);
process.exit(errs.length ? 1 : 0);

// Reloj del partido: aparece con el primer punto, cuenta, guarda la duración del set y sale en el Resumen y en el archivo.
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
  const visible = (sel) => page.evaluate((q) => [...document.querySelectorAll(q)].some((e) => e.offsetParent !== null && !e.hidden), sel);
  ok(!(await visible('.reloj-partido')), `[${w}] sin puntos no hay reloj`);
  await page.click('.btn-punto.mas >> nth=0');
  await page.waitForTimeout(2300);
  const txt = await page.evaluate(() => [...document.querySelectorAll('.reloj-partido')].filter((e) => e.offsetParent !== null).map((e) => e.textContent).join(' | '));
  console.log('   reloj:', txt);
  ok(/0[0-9]:0[2-4]/.test(txt), `[${w}] el reloj cuenta en vivo (${txt})`);
  await page.screenshot({ path: `${SHOTS}/reloj-${w}.png` });
  // cierra el set 25-0 y mira el Resumen
  for (let i = 0; i < 24; i += 1) await page.click('.btn-punto.mas >> nth=0');
  await page.click('.b-menu');
  await page.click('text=Terminar set 1');
  await page.waitForTimeout(300);
  await page.click(vis + '.ventana-pie .btn-primario');
  await page.waitForTimeout(500);
  const sets = await page.evaluate(() => window.__roots.partidos.get([...window.__roots.partidos.keys()][0]).est.sets);
  ok(sets.length === 1 && sets[0].duracionSeg >= 2 && sets[0].duracionSeg < 30, `[${w}] el set guardó su duración (${sets[0]?.duracionSeg} s)`);
  await page.click('.tabs button:has-text("Resumen")');
  await page.waitForSelector('.resumen-marcador');
  const det = await page.textContent('.rm-set .rm-det');
  ok(/\d+ s|min/.test(det), `[${w}] el Resumen muestra la duración del set (${det})`);
  ok(await page.locator('[data-duracion]').count() === 1, `[${w}] el Resumen muestra la duración del partido`);
  await page.screenshot({ path: `${SHOTS}/reloj-resumen-${w}.png` });
  const resultado = await page.evaluate(async () => {
    const m = await import('/js/exportar.js');
    return m.resultadoDePartido(window.__roots.partidos.get([...window.__roots.partidos.keys()][0]));
  });
  ok(Number.isInteger(resultado.duracionSeg) && Number.isInteger(resultado.sets[0].duracionSeg), `[${w}] el archivo de resultados lleva la duración`);
}
await nav.close(); s.close();
console.log('ERRORES', errs);
process.exit(errs.length ? 1 : 0);

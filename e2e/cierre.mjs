// Terminar partido guiado: un botón saca resultados + copia. Uso: node e2e/cierre.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFile } from 'node:fs/promises';
import { servir } from './servidor.mjs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp';
const { s, puerto } = await servir(RAIZ);
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: true, acceptDownloads: true })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const ok = (c, m) => { console.log(c ? 'ok:' : 'FALLA:', m); if (!c) errs.push(m); };
const vis = '.ventana-fondo:not(.saliendo) ';
const T = (t) => vis + '>> text=' + t;
await page.goto(`http://127.0.0.1:${puerto}/`);
await page.waitForSelector('.vacio');
const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
await ch.setFiles(RAIZ + 'tests/fixtures/muestra-roots.json');
await page.click(vis + '.ventana-pie .btn-primario');
await page.waitForTimeout(300);
// un set guardado en el partido 10
await page.evaluate(async () => {
  const M = await import('/js/motor.js');
  const r = window.__roots.partidos.get(10);
  const jug = [...window.__roots.jugadores.values()].filter((j) => j.genero === 'femenino');
  const c = { jugadores: jug, lesiones: new Map(), ahora: () => new Date(), avisar() {} };
  M.elegirFormato(r.est, 'mejor_de_3');
  M.guardarSet(r.est, c, 25, 20);
  r.est.actualizadoEn = new Date().toISOString();
  await window.__roots.almacen.guardar('partidos', r);
});
await page.goto(`http://127.0.0.1:${puerto}/#/partido/10`);
await page.reload();
await page.waitForSelector('[aria-label="Menú"], .barra-partido, .btn-icono');
await page.screenshot({ path: SHOTS + '/c0-partido.png' });
// menú → Terminar partido
await page.locator('button[aria-label="Menú del partido"]').first().click();
await page.click(T('Cierra el partido a mano'));
await page.locator(vis + '.ventana-pie .btn-primario').click(); // confirmar
await page.waitForSelector(vis + '.cierre');
await page.waitForTimeout(500);
await page.screenshot({ path: SHOTS + '/c1-cierre.png' });
ok((await page.locator(vis + '.cierre-paso.hecho').count()) === 0, 'al inicio ningún paso está hecho');
// un solo botón: resultados → copia
const [d1] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click(vis + '[data-cierre-todo]'); await page.click(T('Guardar en la tablet')); })()]);
ok(/roots-resultados-/.test(d1.suggestedFilename()), 'primero salen los resultados: ' + d1.suggestedFilename());
const res = JSON.parse(await readFile(await d1.path(), 'utf8'));
ok(res.partidos?.[0]?.id === 10 && res.partidos[0].finalizadoManual === true, 'el archivo trae el partido terminado');
await page.waitForSelector(T('Guardar la copia'));
await page.screenshot({ path: SHOTS + '/c2-copia.png' });
const [d2] = await Promise.all([page.waitForEvent('download'), page.click(T('Guardar en la tablet'))]);
ok(/roots-tablet-copia-/.test(d2.suggestedFilename()), 'luego sale la copia: ' + d2.suggestedFilename());
await page.waitForSelector(vis + '.cierre-paso.hecho >> nth=1');
ok((await page.locator(vis + '.cierre-paso.hecho').count()) === 2, 'los dos pasos quedan en Listo');
ok((await page.locator(vis + '[data-cierre-todo]').count()) === 0, 'ya no hay botón de exportar');
await page.screenshot({ path: SHOTS + '/c3-listo.png' });
await page.locator(T('Cerrar')).last().click();
await page.waitForTimeout(400);
ok(!(await page.$('.banda:has-text("sin copia")')), 'sin aviso de copia pendiente');

// Cancelar a medias: resultados salen, la copia se cancela, se puede seguir
await page.locator('button[aria-label="Menú del partido"]').first().click();
await page.click(T('Resultados para Roots y copia de seguridad'));
await page.waitForSelector(vis + '.cierre');
await Promise.all([page.waitForEvent('download'), (async () => { await page.click(vis + '[data-cierre-todo]'); await page.click(T('Guardar en la tablet')); })()]);
await page.waitForSelector(T('Guardar la copia'));
await page.locator('.ventana-fondo:not(.saliendo) [aria-label="Cerrar"]').last().click(); // cancela la copia (cierra solo la ventana de arriba)
await page.waitForSelector(vis + '.cierre .error-linea');
ok((await page.locator(vis + '.cierre-paso.hecho').count()) === 1, 'cancelar la copia deja solo resultados en Listo');
ok(/Seguir con lo que falta/.test(await page.locator(vis + '[data-cierre-todo]').innerText()), 'el botón ofrece seguir con lo que falta');
await page.waitForTimeout(500);
await page.screenshot({ path: SHOTS + '/c4-a-medias.png' });
const [d3] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click(vis + '[data-cierre-todo]'); await page.click(T('Guardar en la tablet')); })()]);
ok(/copia/.test(d3.suggestedFilename()), 'seguir saca solo la copia, sin repetir resultados');

console.log('ERRORES', errs);
await nav.close(); s.close(); process.exit(errs.length ? 1 : 0);

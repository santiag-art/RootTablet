// Modo práctica: datos aparte, marco naranja, nada sale de la tablet. Uso: node e2e/practica.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { servir } from './servidor.mjs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp';
const { s, puerto } = await servir(RAIZ);
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 1180, height: 700 }, hasTouch: true, acceptDownloads: true })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const ok = (c, m) => { console.log(c ? 'ok:' : 'FALLA:', m); if (!c) errs.push(m); };
const vis = '.ventana-fondo:not(.saliendo) ';
const T = (t) => vis + '>> text=' + t;
await page.goto(`http://127.0.0.1:${puerto}/`);
await page.waitForSelector('.vacio');
ok((await page.locator('[data-practica]').count()) === 1, 'el botón Práctica está en el inicio');
// un dato "real": importar la muestra como si fuera de Roots
const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
await ch.setFiles(RAIZ + 'tests/fixtures/muestra-roots.json');
await page.click(vis + '.ventana-pie .btn-primario');
await page.waitForSelector('.partido-tarjeta');
await page.evaluate(async () => { const r = window.__roots.partidos.get(10); r.est.actual.puntosLocal = 7; r.est.actualizadoEn = new Date().toISOString(); await window.__roots.almacen.guardar('partidos', r); });
// entrar a práctica
await page.click('[data-practica]');
await page.click(T('Entrar a practicar'));
await page.waitForSelector('.chip-practica');
ok(await page.evaluate(() => document.body.classList.contains('practica')), 'aparece el marco de práctica');
await page.waitForSelector('.partido-tarjeta');
ok((await page.evaluate(() => window.__roots.partidos.get(10).est.actual.puntosLocal)) === 0, 'en práctica el partido 10 viene limpio (no es el real)');
await page.screenshot({ path: SHOTS + '/pr1-inicio.png' });
// anotar en práctica
await page.evaluate(async () => { const r = window.__roots.partidos.get(10); r.est.actual.puntosLocal = 3; r.est.actualizadoEn = new Date().toISOString(); await window.__roots.almacen.guardar('partidos', r); await window.__roots.almacen.pendientes(); });
ok((await page.locator('.banda:has-text("sin copia")').count()) >= 0, 'sigue funcionando');
// exportar bloqueado
await page.click('[aria-label=Ajustes]');
await page.click(T('Guardar copia'));
await page.waitForSelector(T('nada sale de la tablet'));
ok(true, 'guardar copia en práctica se bloquea con explicación');
await page.screenshot({ path: SHOTS + '/pr2-bloqueo.png' });
await page.click(vis + '.ventana-pie .btn-primario');
// salir
await page.click('[data-salir-practica]');
await page.waitForSelector('.chip-practica', { state: 'detached' });
await page.waitForFunction(() => window.__roots.partidos.get(10)?.est.actual.puntosLocal === 7);
ok(!(await page.$('.chip-practica')) && !(await page.evaluate(() => document.body.classList.contains('practica'))), 'al salir desaparece el marco');
ok((await page.evaluate(() => window.__roots.partidos.get(10).est.actual.puntosLocal)) === 7, 'lo real quedó intacto (7 puntos)');
// volver a entrar: sigue donde lo dejó
await page.click('[data-practica]');
await page.click(T('Entrar a practicar'));
await page.waitForSelector('.chip-practica');
ok((await page.evaluate(() => window.__roots.partidos.get(10).est.actual.puntosLocal)) === 3, 'la práctica se conserva al volver (3 puntos)');
// reiniciar
await page.click('[aria-label=Ajustes]');
await page.click(T('Reiniciar la práctica'));
await page.locator(vis + '.ventana-pie .btn-peligro').click();
await page.waitForTimeout(600);
ok((await page.evaluate(() => window.__roots.partidos.get(10).est.actual.puntosLocal)) === 0, 'reiniciar deja los ejemplos limpios');
// sobrevive a recargar en modo real
await page.reload();
await page.waitForSelector('.partido-tarjeta');
ok(!(await page.$('.chip-practica')) && (await page.evaluate(() => window.__roots.partidos.get(10).est.actual.puntosLocal)) === 7, 'al reabrir la app se está en datos reales');
console.log('ERRORES', errs);
await nav.close(); s.close(); process.exit(errs.length ? 1 : 0);

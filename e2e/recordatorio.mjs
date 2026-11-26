// Recordatorio de exportar y guardar copia al terminar un partido. Uso: node e2e/recordatorio.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/claude/.npm-global/lib/node_modules/')('playwright');
const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { servir } = await import('./servidor.mjs');
const { s, puerto } = await servir(RAIZ);
const navegador = await chromium.launch();
const page = await (await navegador.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const fallos = [];
const ok = (c, m) => { if (!c) fallos.push(m); console.log(c ? '  ✓' : '  ✗', m); };

await page.goto(`http://127.0.0.1:${puerto}/`);
await page.waitForSelector('.vacio');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
await chooser.setFiles(`${RAIZ}/tests/fixtures/muestra-roots.json`);
await page.waitForSelector('.ventana');
await page.click('.ventana-pie .btn-primario');
await page.waitForSelector('.partido-tarjeta');
ok(await page.locator('[data-recordatorio-cierre]').count() === 0, 'sin partidos terminados no hay recordatorio');

// Un partido que termina 2-0.
await page.evaluate(async () => {
  const { app, guardarPartido } = await import('/js/contexto.js');
  const reg = [...app.partidos.values()].find((p) => p.equipoVisitante === 'Águilas');
  reg.est.formatoSets = 'mejor_de_3';
  const set = (n) => ({ numeroSet: n, puntosLocal: 25, puntosVisitante: 20, titulares: [], sustituciones: [], eventos: [], puntosSeq: [], puntosInfo: [] });
  reg.est.sets = [set(1), set(2)];
  guardarPartido(reg);
  app.renderizar();
});
await page.waitForSelector('[data-recordatorio-cierre]');
ok((await page.locator('[data-recordatorio-cierre]').innerText()).includes('falta exportar los resultados y guardar la copia'), 'el inicio avisa que falta todo');
ok(await page.locator('[data-sin-exportar]').count() === 1, 'la tarjeta del partido dice «Falta exportar»');
await page.screenshot({ path: '/tmp/recordatorio-1-inicio.png' });

// «Ahora no» deja un aviso y el recordatorio sigue
await page.click('[data-recordatorio-boton]');
await page.waitForSelector('[data-cierre-todo]');
await page.click('.cierre-botones .btn-fantasma');
await page.waitForSelector('.toast');
ok((await page.locator('.toast').last().innerText()).includes('Quedó pendiente'), 'al decir «Ahora no» avisa que quedó pendiente');
ok(await page.locator('[data-recordatorio-cierre]').count() === 1, 'el recordatorio sigue en el inicio');

// Dentro del partido terminado también se ve
await page.locator('.partido-tarjeta', { hasText: 'Águilas' }).first().click();
await page.waitForSelector('[data-falta-cierre]');
ok(true, 'el aviso verde del partido dice lo que falta');
await page.screenshot({ path: '/tmp/recordatorio-2-partido.png' });
await page.click('.b-atras');
await page.waitForSelector('.toast');
ok((await page.locator('.toast').last().innerText()).includes('falta'), 'al salir del partido recuerda lo pendiente');

// Ya exportado y con copia: desaparece; si cambia después, vuelve a aparecer.
await page.evaluate(async () => {
  const { app } = await import('/js/contexto.js');
  const reg = [...app.partidos.values()].find((p) => p.equipoVisitante === 'Águilas');
  const ahora = new Date(Date.now() + 5000).toISOString();
  app.resultadosEn.set(reg.id, ahora);
  app.ultimaCopia = ahora;
  app.renderizar();
});
await page.waitForTimeout(200);
ok(await page.locator('[data-recordatorio-cierre]').count() === 0, 'con resultados y copia hechos ya no avisa');
await page.evaluate(async () => {
  const { app, guardarPartido } = await import('/js/contexto.js');
  const reg = [...app.partidos.values()].find((p) => p.equipoVisitante === 'Águilas');
  app.resultadosEn.set(reg.id, new Date(Date.now() - 60000).toISOString());
  app.ultimaCopia = new Date(Date.now() - 60000).toISOString();
  guardarPartido(reg);
  app.renderizar();
});
await page.waitForSelector('[data-recordatorio-cierre]');
ok(true, 'si se corrige algo después de exportar, vuelve a avisar');
ok(errores.length === 0, `sin errores${errores.length ? `: ${errores.join(' | ')}` : ''}`);
await navegador.close();
s.close();
if (fallos.length) { console.log(`\n${fallos.length} fallo(s)`); process.exit(1); }
console.log('\nTodo bien');

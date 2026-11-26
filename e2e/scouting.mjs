// Recorrido: con partidos contra un rival (con detalle de cómo anota), la pantalla del rival ofrece el reporte de scouting:
// vista previa, descarga del PDF (una página A4) y todo sin errores. Deja el PDF y su imagen en SHOTS para revisarlos.
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/claude/.npm-global/lib/node_modules/')('playwright');
import { servir } from './servidor.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp/e2e-scouting';
mkdirSync(SHOTS, { recursive: true });
const { s, puerto } = await servir(RAIZ);
const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 960, height: 700 }, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errores.push('console: ' + m.text()));
const ok = (c, msg) => { if (!c) { errores.push('FALLA: ' + msg); console.log('FALLA:', msg); } else console.log('ok:', msg); };
const pausa = (ms = 250) => page.waitForTimeout(ms);

await page.goto(`http://127.0.0.1:${puerto}/`);
await page.waitForSelector('.vacio');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
await chooser.setFiles(RAIZ + 'tests/fixtures/muestra-roots.json');
await page.waitForSelector('.ventana');
await page.click('.ventana-pie .btn-primario');
await page.waitForSelector('.partido-tarjeta');

// Dos partidos contra Águilas: sets guardados, jugadas y detalle de cómo anota (por el motor, como en un partido real).
await page.evaluate(async () => {
  const m = await import('./js/motor.js');
  const R = window.__roots;
  const jugadoras = [...R.jugadores.values()].filter((j) => j.genero === 'femenino');
  const ctx = { jugadores: jugadoras, lesiones: R.lesiones, ahora: () => new Date(), avisar: () => {} };
  const reg = R.partidos.get(10);
  const est = reg.est;
  est.ladoPropio = 'local';
  m.elegirFormato(est, 'mejor_de_3');
  m.cambiarModoLibero(est, 'ninguno');
  [1, 2, 3, 4, 5, 6].forEach((id) => m.toggleJugador(est, ctx, id));
  m.confirmarPlantilla(est, ctx);
  m.elegirSaque(est, 'local');
  const rivalAnota = (d) => { m.sumarPunto(est, ctx, 'visitante'); m.detallarPuntoRival(est, d); };
  const ataque = (desde, hacia, n = 1) => { for (let i = 0; i < n; i += 1) rivalAnota({ motivo: 'ataque', desde, hacia }); };
  ataque(4, 1, 5); ataque(4, 6, 2); ataque(3, 6, 2); ataque(2, 5, 1); ataque(6, 1, 2);
  for (let i = 0; i < 2; i += 1) rivalAnota({ motivo: 'saque' });
  for (let i = 0; i < 2; i += 1) rivalAnota({ motivo: 'error' });
  rivalAnota({ motivo: 'bloqueo' });
  const califs = (id, f, lista) => lista.forEach((c) => m.registrarJugada(est, ctx, id, f, c));
  califs(2, 'Ataque', ['positivo', 'positivo', 'doble_positivo', 'negativo', 'error', 'positivo', 'negativo']);
  califs(3, 'Recepción', ['positivo', 'negativo', 'negativo', 'error', 'negativo', 'positivo', 'negativo', 'negativo', 'positivo', 'negativo']);
  califs(5, 'Saque', ['positivo', 'error', 'positivo', 'positivo', 'negativo', 'positivo']);
  m.guardarSet(est, ctx, 25, est.actual.puntosVisitante);
  R.renderizar();
});
// Un segundo partido (el 11, donde Roots es visitante de Titanes) para otro rival: no debe mezclarse
await page.evaluate(() => window.location.hash = '#/rivales');
await page.waitForSelector('[data-lista-rivales]');
await pausa(300);
const filas = await page.locator('[data-lista-rivales] [data-rival]').allInnerTexts();
console.log(filas.map((f) => f.replace(/\s+/g, ' ')).join(' || '));
await page.click('[data-lista-rivales] [data-rival]:has-text("guilas")');
await page.waitForSelector('[data-tarjeta-scouting]');
await pausa(300);
await page.screenshot({ path: SHOTS + '/01-pantalla-rival.png' });
ok(/reporte de scouting/i.test(await page.locator('[data-tarjeta-scouting] .titulo-grupo').innerText()), 'la pantalla del rival muestra la tarjeta de scouting');
ok((await page.locator('[data-scouting-pdf]').count()) === 1, 'tiene el botón Descargar PDF');

// Vista previa
await page.click('[data-tarjeta-scouting] button:has-text("Ver vista previa")');
await page.waitForSelector('[data-vista-scouting]');
await pausa(400);
const dim = await page.evaluate(() => { const i = document.querySelector('[data-vista-scouting]'); return [i.naturalWidth, i.naturalHeight]; });
ok(dim[0] === 1240 && dim[1] === 1754, `la vista previa es la hoja A4 (${dim.join('x')})`);
await page.locator('[data-vista-scouting]').scrollIntoViewIfNeeded();
await page.screenshot({ path: SHOTS + '/02-vista-previa.png' });
await page.click('[data-tarjeta-scouting] button:has-text("Ocultar vista previa")');

// Descarga del PDF
const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('[data-scouting-pdf]')]);
const ruta = SHOTS + '/' + descarga.suggestedFilename();
await descarga.saveAs(ruta);
const pdf = readFileSync(ruta);
ok(/^scouting-aguilas-\d{4}-\d{2}-\d{2}\.pdf$/.test(descarga.suggestedFilename()), 'nombre del archivo: ' + descarga.suggestedFilename());
ok(pdf.subarray(0, 5).toString() === '%PDF-', 'es un PDF');
ok(pdf.length > 20000, 'trae la imagen de la hoja (' + pdf.length + ' bytes)');
ok(/\/Count 1/.test(pdf.toString('latin1')), 'una sola página');
await pausa(400);
ok((await page.locator('.aviso-toast, .toast').filter({ hasText: 'PDF descargado' }).count()) >= 0, 'avisa que se descargó');

ok(errores.filter((x) => !x.startsWith('FALLA')).length === 0, 'sin errores en consola: ' + errores.filter((x) => !x.startsWith('FALLA')).join(' | '));
await navegador.close();
s.close();
console.log(errores.some((x) => x.startsWith('FALLA')) ? 'HAY FALLAS' : 'TODO OK');
console.log('PDF:', ruta);
process.exit(errores.length ? 1 : 0);

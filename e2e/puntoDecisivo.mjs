// Punto de set, punto de partido y vibración al sumar punto, en el navegador. Uso: node e2e/puntoDecisivo.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/claude/.npm-global/lib/node_modules/')('playwright');
import { servir } from './servidor.mjs';
import { mkdirSync } from 'node:fs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp/e2e-punto-decisivo';
mkdirSync(SHOTS, { recursive: true });
const { s, puerto } = await servir(RAIZ);
const navegador = await chromium.launch();
const tamanos = [{ width: 960, height: 600 }, { width: 1280, height: 800 }];
const errores = [];
const ok = (c, msg) => { if (!c) { errores.push('FALLA: ' + msg); console.log('FALLA:', msg); } else console.log('ok:', msg); };

for (const viewport of tamanos) {
  console.log(`\n--- pantalla ${viewport.width}x${viewport.height}`);
  const ctx = await navegador.newContext({ viewport, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('roots-detalle-rival', JSON.stringify({ activo: false }));
    window.__vib = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => (window.__vib.push(p), true) });
  });
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errores.push('console: ' + m.text()));
  await page.goto(`http://127.0.0.1:${puerto}/`);
  await page.waitForSelector('.vacio');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
  await chooser.setFiles(RAIZ + 'tests/fixtures/muestra-roots.json');
  await page.waitForSelector('.ventana');
  await page.click('.ventana-pie .btn-primario');
  await page.click('.partido-tarjeta:has-text("Águilas")');
  await page.waitForSelector('.formato');
  await page.click('text=Mejor de 3');
  await page.waitForSelector('.cancha');
  const filas = page.locator('.fila-jugador');
  for (let i = 0; i < 6; i++) { await filas.nth(i).click(); await page.click('[data-pregunta-posicion] .opcion.principal'); }
  await page.click('text=Un líbero');
  await page.click('.cupo button');
  await page.waitForSelector('.ventana .opcion');
  await page.locator('.ventana .opcion').filter({ hasText: /Líbero/ }).first().click();
  await page.click('text=Confirmar plantilla');
  await page.waitForSelector('.rotacion');
  await page.click('.eq-visitante .chip-saque');
  await page.click('.tabs >> text=Acciones');

  const propio = await page.evaluate(() => [...window.__roots.partidos.values()].find((p) => p.est.actual.plantillaConfirmada).est.ladoPropio);
  const L = propio === 'local' ? 'l' : 'v'; // botón de Roots
  const R = propio === 'local' ? 'v' : 'l'; // botón del rival
  const eqPropio = propio === 'local' ? '.eq-local' : '.eq-visitante';
  const eqRival = propio === 'local' ? '.eq-visitante' : '.eq-local';
  const tocar = async (lado, n = 1) => { for (let i = 0; i < n; i++) await page.click(`.puntos-${lado} .btn-punto.mas`); };
  const chip = (eq) => page.locator(`${eq} .chip-decisivo`);
  const vib = () => page.evaluate(() => window.__vib.length);
  const ultimaVib = () => page.evaluate(() => window.__vib.at(-1));

  await tocar(R, 20);
  await tocar(L, 23);
  ok(await page.locator('.chip-decisivo').count() === 0, '23-20: todavía no hay punto de set');
  const altoBase = await page.evaluate(() => document.querySelector('.barra').offsetHeight);
  const antes = await vib();
  ok(antes === 43, `43 puntos = 43 vibraciones (hay ${antes})`);
  ok(JSON.stringify(await ultimaVib()) === '[25]', 'punto normal: vibración corta [25]');

  await tocar(L);
  ok(await chip(eqPropio).count() === 1 && /PUNTO DE SET/.test(await chip(eqPropio).textContent()), '24-20: PUNTO DE SET en Roots');
  ok(await chip(eqRival).count() === 0, 'el rival no tiene etiqueta');
  ok((await chip(eqPropio).getAttribute('class')).includes('nuestro'), 'la etiqueta de Roots es verde (nuestro)');
  ok(JSON.stringify(await ultimaVib()) === '[90,60,90,60,90]', 'punto de set: vibración triple');
  await page.screenshot({ path: `${SHOTS}/${viewport.width}-1-punto-de-set.png` });

  await tocar(R, 3); // 24-23
  ok(await chip(eqPropio).count() === 1, '24-23: sigue el punto de set (25-23 cierra)');
  await tocar(R); // 24-24
  ok(await page.locator('.chip-decisivo').count() === 0, '24-24: ya no hay punto de set (hay que sacar 2)');
  ok(JSON.stringify(await ultimaVib()) === '[25]', '24-24: vibración normal');
  await tocar(R); // 24-25
  ok(await chip(eqRival).count() === 1 && (await chip(eqRival).getAttribute('class')).includes('rival'), '24-25: punto de set del RIVAL, en rojo');
  await page.screenshot({ path: `${SHOTS}/${viewport.width}-2-punto-de-set-rival.png` });
  await tocar(L); // 25-25
  await tocar(L); // 26-25
  ok(await chip(eqPropio).count() === 1, '26-25: punto de set otra vez para Roots');
  await tocar(L); // 27-25 cierra
  ok(await page.locator('.chip-decisivo').count() === 0, '27-25: set cerrado, sin etiqueta');
  ok(await page.locator('.aviso-ok:has-text("Marcador de set completo")').count() === 1, '27-25: sale el aviso de guardar el set');
  ok(JSON.stringify(await ultimaVib()) === '[70,50,70]', 'set cerrado: vibración doble');

  // Punto de partido: se simula que Roots ya ganó el set 1 y el marcador va 24-20 en el set 2.
  await page.evaluate((propio) => {
    const reg = [...window.__roots.partidos.values()].find((p) => p.est.actual.plantillaConfirmada);
    const gana = propio === 'local' ? [25, 20] : [20, 25];
    reg.est.sets.push({ numeroSet: 1, puntosLocal: gana[0], puntosVisitante: gana[1], titulares: [], sustituciones: [], eventos: [], puntosSeq: [], puntosInfo: [], tiemposMuertos: { local: 0, visitante: 0 }, cierre: null });
    reg.est.actual.puntosLocal = propio === 'local' ? 24 : 20;
    reg.est.actual.puntosVisitante = propio === 'local' ? 20 : 24;
    window.__roots.renderizar();
  }, propio);
  ok(await chip(eqPropio).count() === 1 && /PUNTO DE PARTIDO/.test(await chip(eqPropio).textContent()), 'con 1-0 en sets y 24-20: PUNTO DE PARTIDO');
  await page.screenshot({ path: `${SHOTS}/${viewport.width}-3-punto-de-partido.png` });
  const alto = await page.evaluate(() => document.querySelector('.barra').offsetHeight);
  console.log('alto de la barra con la etiqueta:', alto, 'px');
  ok(alto - altoBase <= 52, `la etiqueta suma como mucho una fila a la barra (base ${altoBase}px, ahora ${alto}px)`);
  ok(await page.evaluate(() => { const r = document.querySelector('.chip-decisivo').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), 'la etiqueta cabe en la pantalla (no se corta)');
  ok(await page.evaluate(() => document.querySelector('.chip-decisivo').offsetHeight) <= 48, 'la etiqueta mide lo mismo que los demás chips');
  await tocar(L);
  ok(JSON.stringify(await ultimaVib()) === '[70,50,70]', 'el punto que cierra el set vibra doble');

  // Ajustes: sin vibración y sin avisos.
  const n = await vib();
  await page.evaluate(() => localStorage.setItem('roots-vibracion', JSON.stringify({ activa: false })));
  await tocar(R);
  ok(await vib() === n, 'con la vibración apagada no vibra');
  await page.evaluate(() => { localStorage.setItem('roots-vibracion', '{}'); localStorage.setItem('roots-avisos', JSON.stringify({ activos: false })); });
  await page.evaluate(() => window.__roots.renderizar());
  ok(await page.locator('.chip-decisivo').count() === 0, 'con los avisos apagados no sale la etiqueta');

  // Menú: la opción existe y alterna.
  await page.evaluate(() => localStorage.setItem('roots-avisos', '{}'));
  await page.click('.b-menu');
  await page.waitForSelector('.ventana .opcion');
  ok(await page.locator('.ventana .opcion:has-text("Vibración al sumar punto")').count() === 1, 'el menú tiene "Vibración al sumar punto"');
  await page.locator('.ventana .opcion:has-text("Vibración al sumar punto")').click();
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('roots-vibracion')).activa) === false, 'tocar la opción apaga la vibración');
  await ctx.close();
}
console.log('\nERRORES:', JSON.stringify(errores));
await navegador.close();
s.close();
process.exit(errores.length ? 1 : 0);

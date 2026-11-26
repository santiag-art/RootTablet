// Revisión de diseño: en varios tamaños de pantalla busca desbordes, texto cortado y cosas tapadas por la etiqueta de práctica.
// Uso: SHOTS=carpeta node e2e/revisionDiseno.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { servir } from './servidor.mjs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp';
const { s, puerto } = await servir(RAIZ);
const nav = await chromium.launch();
const TAMANOS = [
  ['tablet-1280x800', 1280, 800],
  ['tablet-corta-1180x600', 1180, 600],
  ['tablet-vertical-800x1180', 800, 1180],
  ['movil-412x860', 412, 860],
];
const problemas = [];
const vis = '.ventana-fondo:not(.saliendo) ';

// Busca en la pantalla visible: desborde horizontal, texto cortado en botones, y elementos pulsables tapados por la etiqueta de práctica.
async function auditar(page, nombre) {
  const r = await page.evaluate(() => {
    const out = [];
    const ancho = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > ancho + 1) out.push(`desborde horizontal de la página (${document.documentElement.scrollWidth} > ${ancho})`);
    const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const raizVisible = document.querySelector('.ventana-fondo:not(.saliendo)') ? '.ventana-fondo:not(.saliendo)' : 'body';
    document.querySelectorAll(`${raizVisible} .btn, ${raizVisible} .opcion, ${raizVisible} summary, ${raizVisible} .btn-fund, ${raizVisible} .btn-calif`).forEach((e) => {
      if (!visible(e)) return;
      // Texto que no cabe en su caja (se corta o se sale)
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') out.push(`texto cortado en «${e.innerText.trim().slice(0, 40)}»`);
      const r = e.getBoundingClientRect();
      if (r.right > ancho + 1 || r.left < -1) out.push(`se sale de la pantalla: «${e.innerText.trim().slice(0, 40)}» (${Math.round(r.left)}..${Math.round(r.right)})`);
    });
    return [...new Set(out)];
  });
  for (const m of r) problemas.push(`[${nombre}] ${m}`);
}

for (const [etq, w, h] of TAMANOS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problemas.push(`[${etq}] error de página: ${e.message}`));
  const foto = async (n) => { await page.waitForTimeout(450); await page.screenshot({ path: `${SHOTS}/${etq}__${n}.png` }); };
  await page.goto(`http://127.0.0.1:${puerto}/`);
  await page.waitForSelector('.vacio');
  await auditar(page, `${etq} inicio vacío`);
  await foto('01-inicio-vacio');
  // Ayuda
  await page.click('[data-ayuda]');
  await page.waitForSelector(vis + '.ayuda');
  await page.click(vis + '[data-seccion="marcador"] summary');
  await auditar(page, `${etq} ayuda`);
  await foto('02-ayuda');
  await page.locator(vis + '.ventana-pie .btn-primario').click();
  await page.waitForTimeout(350);
  // importar muestra
  const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
  await ch.setFiles(RAIZ + 'tests/fixtures/muestra-roots.json');
  await page.click(vis + '.ventana-pie .btn-primario');
  await page.waitForSelector('.partido-tarjeta');
  await auditar(page, `${etq} inicio con partidos`);
  await foto('03-inicio');
  // Ajustes
  await page.click('[aria-label=Ajustes]');
  await page.waitForSelector(vis + '.ventana');
  await auditar(page, `${etq} ajustes`);
  await foto('04-ajustes');
  await page.locator(vis + '[aria-label="Cerrar"]').first().click();
  await page.waitForTimeout(350);
  // Práctica: entrar
  await page.click('[data-practica]');
  await foto('05-confirmar-practica');
  await page.click(vis + '>> text=Entrar a practicar');
  await page.waitForSelector('.chip-practica');
  await page.waitForSelector('.partido-tarjeta');
  await auditar(page, `${etq} inicio en práctica`);
  await foto('06-inicio-practica');
  // partido en práctica con plantilla
  await page.evaluate(async () => {
    const M = await import('/js/motor.js');
    const r = window.__roots.partidos.get(10);
    const jug = [...window.__roots.jugadores.values()].filter((j) => j.genero === 'femenino');
    const c = { jugadores: jug, lesiones: new Map(), ahora: () => new Date(), avisar() {} };
    M.elegirFormato(r.est, 'mejor_de_3');
    M.cambiarModoLibero(r.est, 'ninguno');
    jug.filter((j) => j.posicion !== 'Líbero').slice(0, 6).forEach((j) => M.toggleJugador(r.est, c, j.id, { posicion: j.posicion }));
    M.confirmarPlantilla(r.est, c);
    M.guardarSet(r.est, c, 25, 20);
    await window.__roots.almacen.guardar('partidos', r);
  });
  await page.goto(`http://127.0.0.1:${puerto}/#/partido/10`);
  await page.waitForSelector('.tabs');
  await page.waitForTimeout(300);
  await auditar(page, `${etq} partido plantilla (práctica)`);
  await foto('07-partido-plantilla');
  await page.click('.tabs >> text=Acciones');
  const n = await page.locator('.jugador-btn').count();
  for (let i = 0; i < n; i++) { await page.locator('.jugador-btn').nth(i).click(); if (await page.locator('.btn-fund', { hasText: 'Colocación' }).count()) break; }
  await page.locator('.btn-fund', { hasText: 'Colocación' }).click().catch(() => {});
  await auditar(page, `${etq} acciones con panel`);
  await foto('08-acciones-panel');
  await page.locator('.partido, .acciones').first().evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await auditar(page, `${etq} acciones scroll final`);
  await foto('09-acciones-final');
  // menú del partido + cierre guiado
  await page.click('[aria-label="Menú del partido"]');
  await auditar(page, `${etq} menú del partido`);
  await foto('10-menu-partido');
  await page.click(vis + '>> text=Cierra el partido a mano');
  await page.locator(vis + '.ventana-pie .btn-primario').click();
  await page.waitForSelector(vis + '.cierre');
  await auditar(page, `${etq} cierre guiado`);
  await foto('11-cierre');
  await page.click(vis + '[data-cierre-todo]');
  await page.waitForSelector(vis + '.cierre-paso.hecho >> nth=1');
  await auditar(page, `${etq} cierre guiado listo`);
  await foto('12-cierre-listo');
  await page.locator(vis + '.cierre-botones .btn').click();
  await page.waitForTimeout(400);
  await auditar(page, `${etq} partido terminado (resumen)`);
  await foto('13-partido-terminado');
  // Ayuda dentro del partido, y Ajustes en práctica
  await page.goto(`http://127.0.0.1:${puerto}/#/`);
  await page.waitForSelector('.partido-tarjeta');
  await page.click('[aria-label=Ajustes]');
  await page.waitForSelector(vis + '.ventana');
  await auditar(page, `${etq} ajustes en práctica`);
  await foto('14-ajustes-practica');
  await ctx.close();
}
console.log(problemas.length ? problemas.join('\n') : 'Sin problemas detectados');
await nav.close(); s.close(); process.exit(problemas.length ? 1 : 0);

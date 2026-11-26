// Mini cancha en Acciones: posiciones, saque, rotación, líbero, ocultar. Uso: SHOTS=carpeta node e2e/miniCancha.mjs
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
for (const [w, h] of [[1280, 800], [1180, 600], [800, 1180]]) {
  const page = await (await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => localStorage.setItem('roots-detalle-rival', JSON.stringify({ activo: false })));
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
    M.cambiarModoLibero(r.est, 'uno');
    const normales = jug.filter((j) => j.posicion !== 'Líbero').slice(0, 6);
    normales.forEach((j) => M.toggleJugador(r.est, c, j.id, { posicion: j.posicion }));
    const lib = jug.find((j) => j.posicion === 'Líbero');
    if (lib) M.colocarComoLibero(r.est, c, lib.id, 'unico');
    M.elegirSaque(r.est, 'local');
    M.confirmarPlantilla(r.est, c);
    await window.__roots.almacen.guardar('partidos', r);
  });
  await page.goto(`http://127.0.0.1:${puerto}/#/partido/10`);
  await page.reload();
  await page.waitForSelector('.tabs');
  await page.click('.tabs >> text=Acciones');
  await page.waitForSelector('.mini-cancha');
  // lo que dice la cancha vs lo que dice el motor
  const leer = () => page.evaluate(async () => {
    const r = window.__roots.partidos.get(10);
    const slots = r.est.actual.slots.map((id) => window.__roots.jugadores.get(id)?.nombre ?? null);
    const dom = [1, 2, 3, 4, 5, 6].map((p) => (document.querySelector(`.mc-casilla[data-pos="${p}"]`)?.getAttribute('title') ?? '').replace(/^P\d: /, ''));
    return { slots, dom, saque: document.querySelectorAll('.mc-saque').length, saqueEn: document.querySelector('.mc-saque')?.closest('.mc-casilla')?.dataset.pos };
  });
  let est = await leer();
  ok(JSON.stringify(est.slots) === JSON.stringify(est.dom), `[${w}x${h}] la cancha muestra a cada jugadora en su zona (${est.dom.join(', ')})`);
  ok(est.saque === 1 && est.saqueEn === '1', `[${w}x${h}] el saque marca a quien está en P1`);
  const cajas = await page.evaluate(() => ['.mini-cancha', '.fila-circulos', '.panel-jugada', '.sin-seleccion'].map((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
  const [mc, fila] = cajas;
  ok(mc[0] >= 0 && mc[2] <= w, `[${w}x${h}] la mini cancha cabe en el ancho (${Math.round(mc[0])}-${Math.round(mc[2])})`);
  const solapa = !(mc[2] <= fila[0] || mc[0] >= fila[2] || mc[3] <= fila[1] || mc[1] >= fila[3]);
  ok(!solapa, `[${w}x${h}] no tapa la fila de jugadoras`);
  await page.screenshot({ path: `${SHOTS}/mini-cancha-${w}x${h}.png` });
  // elegir una jugadora la resalta en la cancha
  await page.locator('.jugador-btn').first().click();
  ok((await page.locator('.mc-casilla.elegida').count()) === 1, `[${w}x${h}] la jugadora elegida se resalta en la cancha`);
  await page.locator('.jugador-btn').first().click();
  // pierde el saque y lo recupera: rota y la cancha cambia sola
  await page.evaluate(async () => {
    const M = await import('/js/motor.js');
    const r = window.__roots.partidos.get(10);
    const c = { jugadores: [...window.__roots.jugadores.values()], lesiones: new Map(), ahora: () => new Date(), avisar() {} };
    M.sumarPunto(r.est, c, 'visitante');
    M.sumarPunto(r.est, c, 'local');
    window.__roots.renderizar();
  });
  const antes = est.dom.join('|');
  est = await leer();
  ok(JSON.stringify(est.slots) === JSON.stringify(est.dom) && est.dom.join('|') !== antes, `[${w}x${h}] al rotar la cancha se actualiza sola`);
  // entra la líbero por una zaguera: se ve en la cancha con su color
  const entro = await page.evaluate(async () => {
    const M = await import('/js/motor.js');
    const r = window.__roots.partidos.get(10);
    const c = { jugadores: [...window.__roots.jugadores.values()], lesiones: new Map(), ahora: () => new Date(), avisar() {} };
    const lib = r.est.actual.liberos.unico;
    const sale = r.est.actual.slots[5];
    if (!lib || sale == null) return false;
    M.entrarLibero(r.est, c, lib, sale);
    window.__roots.renderizar();
    return true;
  });
  ok(entro && (await page.locator('.mini-cancha .circulo.lib-unico').count()) === 1, `[${w}x${h}] la líbero entra y sale con su color en la cancha`);
  // ocultar y volver a mostrar
  await page.click('.mc-ocultar');
  ok((await page.locator('.mini-cancha').count()) === 0 && (await page.locator('.mini-cancha-pill').count()) === 1, `[${w}x${h}] se puede ocultar`);
  await page.screenshot({ path: `${SHOTS}/mini-cancha-oculta-${w}x${h}.png` });
  await page.click('.mini-cancha-pill');
  ok((await page.locator('.mini-cancha').count()) === 1, `[${w}x${h}] y volver a mostrar`);
  await page.close();
}
await nav.close(); s.close();
console.log('ERRORES', errs);
process.exit(errs.length ? 1 : 0);

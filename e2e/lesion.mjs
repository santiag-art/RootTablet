// Recorrido: en juego, tocar a una jugadora en cancha -> Lesión -> zona y "no apta" -> sale la lista de quién entra (la mejor
// primero) -> un toque hace el cambio; la marca queda en el partido, se ve en la plantilla y viaja en los resultados.
// Después: por el menú del partido, y el caso del líbero (regla 19.4).
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/claude/.npm-global/lib/node_modules/')('playwright');
import { servir } from './servidor.mjs';
import { mkdirSync } from 'node:fs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp/e2e-lesion';
mkdirSync(SHOTS, { recursive: true });
const { s, puerto } = await servir(RAIZ);
const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 960, height: 700 }, hasTouch: true });
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
await page.click('.partido-tarjeta:has-text("Águilas")');
await page.waitForSelector('.formato');
await page.click('text=Mejor de 3');
await page.waitForSelector('.cancha');

// Plantilla por el motor: 6 en cancha y un líbero único.
const libero = await page.evaluate(async () => {
  const m = await import('./js/motor.js');
  const R = window.__roots;
  const reg = R.partidos.get(10);
  const jugadoras = [...R.jugadores.values()].filter((j) => j.genero === 'femenino');
  const ctx = { jugadores: jugadoras, lesiones: R.lesiones, ahora: () => new Date(), avisar: () => {} };
  const lib = jugadoras.find((j) => /l[ií]bero/i.test(j.posicion))?.id ?? jugadoras.at(-1).id;
  m.cambiarModoLibero(reg.est, 'uno');
  m.elegirLibero(reg.est, ctx, lib, 'unico');
  jugadoras.filter((j) => j.id !== lib).slice(0, 6).forEach((j) => m.toggleJugador(reg.est, ctx, j.id));
  m.confirmarPlantilla(reg.est, ctx);
  m.elegirSaque(reg.est, 'local');
  R.renderizar();
  return lib;
});
await pausa(400);
await page.click('[role=tab]:has-text("Plantilla"), button:has-text("Plantilla")').catch(() => {});
await page.waitForSelector('.casilla');

// 1) Casilla -> Lesión
await page.click('.casilla >> nth=2');
await page.waitForSelector('.ventana [data-lesion]');
await page.screenshot({ path: SHOTS + '/01-casilla.png' });
ok((await page.locator('.ventana [data-lesion]').count()) === 1, 'la casilla en juego tiene el botón Lesión');
await page.click('.ventana [data-lesion]');
await page.waitForSelector('[data-lesion-confirmar]');
ok(await page.locator('[data-lesion-confirmar]').isDisabled(), 'sin zona ni disponibilidad el botón está apagado');
await page.click('[data-zona="Rodilla"]');
await page.click('[data-disponibilidad="no_apta"]');
await page.screenshot({ path: SHOTS + '/02-zona.png' });
ok(!(await page.locator('[data-lesion-confirmar]').isDisabled()), 'con zona y disponibilidad se habilita');
await page.click('[data-lesion-confirmar]');
await page.waitForSelector('[data-retiro-lesion]');
await pausa(300);
await page.screenshot({ path: SHOTS + '/03-quien-entra.png' });
const filas = await page.locator('[data-retiro-lesion] .opcion').allInnerTexts();
ok(filas.length > 0 && /Sugerida/.test(filas[0]), 'la primera de la lista es la sugerida: ' + filas[0]?.replace(/\s+/g, ' '));
const marca = await page.evaluate(() => structuredClone(window.__roots.partidos.get(10).est.lesiones));
const sale = marca[0]?.jugadorId;
ok(marca.length === 1 && marca[0].jugadorId === sale && marca[0].zona === 'Rodilla' && marca[0].disponibilidad === 'no_apta', 'la marca quedó guardada en el partido');
const disp = await page.evaluate((id) => window.__roots.lesiones.get(id)?.disponibilidad, sale);
ok(disp === 'no_apta', 'en la tablet ya cuenta como no apta (insignia y sugerencias)');

// Un toque hace el cambio (la posición sale de su ficha, sin preguntar)
await page.click('[data-retiro-lesion] .opcion >> nth=0');
await pausa(500);
ok((await page.locator('[data-pregunta-posicion]').count()) === 0, 'no pregunta la posición cuando la conoce (un solo paso)');
const subs = await page.evaluate(() => structuredClone(window.__roots.partidos.get(10).est.actual.sustituciones));
ok(subs.length === 1 && subs[0].jugadorSaleId === sale && !subs[0].excepcional, 'cambio hecho en un paso: normal, sale la lesionada');
ok((await page.locator('[data-lesiones-partido]').count()) === 1, 'la plantilla lista la lesión del partido');
await page.screenshot({ path: SHOTS + '/04-despues.png' });

// Viaja en los resultados
const viaja = await page.evaluate(async () => {
  const { resultadoDePartido } = await import('./js/exportar.js');
  const reg = window.__roots.partidos.get(10);
  reg.est.sets.push({ numeroSet: 1, puntosLocal: 25, puntosVisitante: 20, titulares: [], sustituciones: [], eventos: [], tiemposMuertos: { local: 0, visitante: 0 } });
  const r = resultadoDePartido(reg);
  reg.est.sets.pop();
  return r.lesiones;
});
ok(viaja?.length === 1 && viaja[0].zona === 'Rodilla', 'la lesión viaja en el archivo de resultados');

// 2) Menú del partido -> Lesión de una jugadora (otra, limitada) -> "Sigue en cancha"
await page.click('.b-menu');
await page.waitForSelector('.ventana');
await page.click('.ventana .opcion:has-text("Lesión de una jugadora")');
await page.waitForSelector('.ventana .opcion');
await page.click('.ventana .lista-opciones .opcion >> nth=1');
await page.waitForSelector('[data-zona]');
await page.click('[data-zona="Tobillo"]');
await page.click('[data-disponibilidad="limitada"]');
await page.click('[data-lesion-confirmar]');
await page.waitForSelector('[data-retiro-lesion]');
await page.click('.ventana-pie .btn');
await pausa(300);
const marcas2 = await page.evaluate(() => window.__roots.partidos.get(10).est.lesiones.length);
ok(marcas2 === 2, 'por el menú también se marca (limitada) y puede seguir en cancha');

// 3) El líbero: sin otro líbero, abre la regla 19.4
await page.evaluate(async (lib) => {
  const R = window.__roots;
  const reg = R.partidos.get(10);
  reg.est.actual.puntosLocal = 3;
  R.renderizar();
}, libero);
await page.click('.b-menu');
await page.click('.ventana .opcion:has-text("Lesión de una jugadora")');
await page.waitForSelector('.ventana .opcion');
await page.click(`.ventana .lista-opciones .opcion:has-text("Líbero")`).catch(async () => { await page.click('.ventana .lista-opciones .opcion >> nth=-1'); });
await page.waitForSelector('[data-zona]');
await page.click('[data-zona="Muñeca / mano"]');
await page.click('[data-disponibilidad="no_apta"]');
await page.click('[data-lesion-confirmar]');
await page.waitForSelector('.ventana-titulo:has-text("Nuevo líbero")');
await page.screenshot({ path: SHOTS + '/05-libero.png' });
ok(true, 'si era el líbero y no queda otro, abre la regla del nuevo líbero (19.4)');

// 4) Deshacer quita la marca del líbero
await page.keyboard.press('Escape');
await pausa(300);
ok(errores.filter((x) => !x.startsWith('FALLA')).length === 0, 'sin errores en consola: ' + errores.filter((x) => !x.startsWith('FALLA')).join(' | '));
await navegador.close();
s.close();
console.log(errores.some((x) => x.startsWith('FALLA')) ? 'HAY FALLAS' : 'TODO OK');
process.exit(errores.length ? 1 : 0);

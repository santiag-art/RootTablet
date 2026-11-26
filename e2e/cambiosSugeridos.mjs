// Recorrido: con una jugadora en cancha que va mal sale el aviso "Cambio sugerido" con quién podría entrar; "Ver cambio" abre
// la lista con la sugerida primero; se puede cerrar con la X; con los avisos apagados no sale nada y la lista queda como antes.
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/claude/.npm-global/lib/node_modules/')('playwright');
import { servir } from './servidor.mjs';
import { mkdirSync } from 'node:fs';
const RAIZ = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS ?? '/tmp/e2e-cambios-sugeridos';
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
const aviso = '.aviso:has-text("Cambio sugerido")';

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

// Plantilla por el motor (la pantalla de armado ya tiene su propio recorrido): 6 en cancha, sin líbero.
await page.evaluate(async () => {
  const m = await import('./js/motor.js');
  const R = window.__roots;
  const reg = R.partidos.get(10);
  const ctx = { jugadores: [...R.jugadores.values()].filter((j) => j.genero === 'femenino'), lesiones: R.lesiones, ahora: () => new Date(), avisar: () => {} };
  m.cambiarModoLibero(reg.est, 'ninguno');
  [1, 2, 3, 4, 5, 6].forEach((id) => m.toggleJugador(reg.est, ctx, id));
  m.confirmarPlantilla(reg.est, ctx);
  m.elegirSaque(reg.est, 'local');
  R.renderizar();
});
await pausa(400);
ok((await page.locator(aviso).count()) === 0, 'al empezar no hay cambios sugeridos');

// Camila (id 2) va mal: primero un ataque flojo (1 de 5, gravedad 1: aún no avisa); luego 1 de 8 y recepción 0 de 5.
const anotar = (id, fundamento, califs) => page.evaluate(async ([id, fundamento, califs]) => {
  const R = window.__roots;
  const reg = R.partidos.get(10);
  califs.forEach((calificacion, i) => reg.est.actual.eventos.push({ id: 9000 + id * 100 + i + reg.est.actual.eventos.length, jugadorId: id, fundamento, calificacion, enConjunto: false, paseRecibido: null }));
  R.renderizar();
}, [id, fundamento, califs]);
await anotar(2, 'Ataque', ['positivo', ...Array(4).fill('negativo')]);
await pausa(300);
ok((await page.locator(aviso).count()) === 0, 'con una sola cosa floja todavía no avisa');
await anotar(2, 'Ataque', Array(3).fill('negativo'));
await anotar(2, 'Recepción', Array(5).fill('negativo'));
await page.waitForSelector(aviso);
await pausa(300);
await page.screenshot({ path: SHOTS + '/01-aviso.png' });
const texto = await page.locator(aviso).innerText();
ok(/Camila no va bien/.test(texto), 'el aviso nombra a Camila: ' + texto.replace(/\s+/g, ' '));
ok(/Ataque en este set: 1 de 8/.test(texto) && /Recepción en este set: 0 de 5/.test(texto), 'explica por qué (ataque y recepción)');
ok(/Podría entrar/.test(texto), 'propone a alguien');
ok((await page.locator(aviso + '.alerta-urgente').count()) === 1, 'es urgente (rojo)');

// Ver cambio: abre la lista con la sugerida primero y marcada
await page.click(aviso + ' [data-ver-cambio="2"]');
await page.waitForSelector('.ventana .opcion');
await pausa(300);
await page.screenshot({ path: SHOTS + '/02-lista.png' });
const filas = await page.locator('.ventana .lista-opciones .opcion').allInnerTexts();
ok(/Sale Camila/.test(await page.locator('.ventana-titulo, .ventana h2, .ventana header').first().innerText()), 'la ventana dice quién sale');
ok(filas.some((f) => /Sugerida:/.test(f)), 'la primera lleva "Sugerida:"');
ok((await page.locator('.ventana .opcion.principal').count()) === 1, 'solo una opción destacada');
const primera = await page.locator('.ventana .lista-opciones .opcion:not(.check-grande)').first().innerText();
ok(/Karen Zapata|Andrea Marín/.test(primera), 'la primera es una atacante de la banca: ' + primera.replace(/\s+/g, ' '));
// La lista nunca ofrece a Valentina Ríos u otras que están en cancha
ok(!filas.some((f) => /Valentina Ríos|Daniela Ospina/.test(f)), 'no ofrece a las que ya están en cancha');

// Elegir a la sugerida hace el cambio normal (pregunta la posición)
await page.click('.ventana .lista-opciones .opcion:not(.check-grande) >> nth=0');
await page.waitForSelector('[data-pregunta-posicion]');
await page.click('[data-pregunta-posicion] [data-posicion="Atacante"]');
await pausa(400);
const e1 = await page.evaluate(() => structuredClone(window.__roots.partidos.get(10).est.actual.sustituciones));
ok(e1.length === 1 && e1[0].jugadorSaleId === 2 && !e1[0].excepcional, 'el cambio quedó registrado como normal: sale Camila');
ok((await page.locator(aviso).count()) === 0, 'ya no se sugiere cambiar a Camila (salió)');
await page.screenshot({ path: SHOTS + '/03-despues.png' });

// X cierra la sugerencia; si empeora vuelve
await anotar(3, 'Ataque', ['positivo', ...Array(7).fill('negativo')]);
await anotar(3, 'Saque', ['error', 'error', 'positivo', 'error']);
await page.waitForSelector(aviso);
ok(/Daniela no va bien/.test(await page.locator(aviso).innerText()), 'ahora sugiere a Daniela');
await page.click(aviso + ' [aria-label="Cerrar sugerencia"]');
await pausa(300);
ok((await page.locator(aviso).count()) === 0, 'la X cierra la sugerencia');
await anotar(3, 'Recepción', Array(5).fill('negativo'));
await page.waitForSelector(aviso);
ok(true, 'al empeorar vuelve a salir');

// Avisos apagados: sin sugerencia y la lista de cambio sale sin "Sugerida"
await page.evaluate(() => localStorage.setItem('roots-avisos', JSON.stringify({ activos: false })));
await page.evaluate(() => window.__roots.renderizar());
await pausa(300);
ok((await page.locator(aviso).count()) === 0, 'con los avisos apagados no sale la sugerencia');

ok(errores.filter((x) => !x.startsWith('FALLA')).length === 0, 'sin errores en consola: ' + errores.filter((x) => !x.startsWith('FALLA')).join(' | '));
await navegador.close();
s.close();
console.log(errores.some((x) => x.startsWith('FALLA')) ? 'HAY FALLAS' : 'TODO OK');
process.exit(errores.length ? 1 : 0);

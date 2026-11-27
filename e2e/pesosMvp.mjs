// Ajustes → Puntos del MVP: abre la ventana, cambia un valor con + y escribiendo, guarda, recarga y comprueba que se conserva,
// prueba un valor inválido y «Volver a los de siempre». Uso: node e2e/pesosMvp.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/claude/.npm-global/lib/node_modules/')('playwright');
const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { servir } = await import('./servidor.mjs');
const { s, puerto } = await servir(RAIZ);
const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
const fallos = [];
const ok = (cond, msg) => { if (!cond) fallos.push(msg); console.log(cond ? '  ✓' : '  ✗', msg); };
const pesos = () => page.evaluate(async () => (await import('/js/contexto.js')).app.pesosMvp);
const abrirPesos = async () => { await page.click('button[aria-label="Ajustes"]'); await page.click('[data-abrir-pesos-mvp]'); await page.waitForSelector('[data-peso="directo"]'); };

await page.goto(`http://127.0.0.1:${puerto}/`);
await page.waitForSelector('.vacio');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
await chooser.setFiles(`${RAIZ}/tests/fixtures/muestra-roots.json`);
await page.waitForSelector('.ventana');
await page.click('.ventana-pie .btn-primario');
await page.waitForSelector('.partido-tarjeta');

await abrirPesos();
ok(await page.inputValue('[data-peso="directo"]') === '1', 'arranca con el punto directo en 1');
ok(await page.inputValue('[data-peso="recepcionDefensaPerfecta"]') === '0,33', 'la recepción perfecta sale con coma: 0,33');
await page.click('[data-peso-mas="directo"]');
await page.click('[data-peso-mas="directo"]');
ok(await page.inputValue('[data-peso="directo"]') === '1,5', 'dos toques en + suben el punto directo a 1,5');
await page.fill('[data-peso="error"]', '0,5');
await page.click('.ventana-pie .btn-primario');
await page.waitForSelector('.ventana-fondo', { state: 'detached' });
let p = await pesos();
ok(p.directo === 1.5 && p.error === 0.5, 'Guardar aplica los pesos en la app');

await page.reload();
await page.waitForSelector('.partido-tarjeta');
p = await pesos();
ok(p.directo === 1.5 && p.error === 0.5, 'tras recargar se conservan');
await abrirPesos();
ok(await page.inputValue('[data-peso="directo"]') === '1,5', 'al volver a abrir muestra lo guardado');

await page.fill('[data-peso="directo"]', 'abc');
ok(await page.getAttribute('[data-peso="directo"]', 'aria-invalid') === 'true', 'un valor que no es número se marca en rojo');
await page.click('.ventana-pie .btn-primario');
ok(await page.locator('[data-peso="directo"]').count() === 1, 'con un valor inválido la ventana no se cierra');
ok(await page.locator('.toast-error').count() >= 1, 'avisa qué está mal');
ok((await pesos()).directo === 1.5, 'lo inválido no cambia lo guardado');

await page.click('.ventana-pie .btn-fantasma:has-text("Volver a los de siempre")');
ok(await page.inputValue('[data-peso="directo"]') === '1' && await page.inputValue('[data-peso="error"]') === '1', 'Volver a los de siempre restablece los campos');
await page.click('.ventana-pie .btn-primario');
await page.waitForSelector('.ventana-fondo', { state: 'detached' });
p = await pesos();
ok(p.directo === 1 && p.error === 1 && p.topeColocacion === 2.5, 'guardar los de siempre los deja como estaban');
ok(await page.evaluate(async () => !(await (await import('/js/contexto.js')).app.almacen.todos('meta')).some((f) => f.clave === 'pesos-mvp')), 'y no queda nada guardado');

await page.screenshot({ path: '/tmp/pesos-mvp.png' });
ok(errores.length === 0, `sin errores en consola (${errores.join(' | ')})`);
await navegador.close();
s.close();
console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo bien');
process.exit(fallos.length ? 1 : 0);

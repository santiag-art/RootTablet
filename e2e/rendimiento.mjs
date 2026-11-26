// Mide cuánto tarda cada toque en un partido de 5 sets simulado (≈700 jugadas), con la CPU frenada 4x y 6x para parecerse a una tablet. Uso: node e2e/rendimiento.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/claude/.npm-global/lib/node_modules/')('playwright');
const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { servir } = await import('./servidor.mjs');
const { s, puerto } = await servir(RAIZ);
const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('roots-detalle-rival', JSON.stringify({ activo: false })));
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
await page.goto(`http://127.0.0.1:${puerto}/`);
await page.waitForSelector('.vacio');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
await chooser.setFiles(`${RAIZ}/tests/fixtures/muestra-roots.json`);
await page.waitForSelector('.ventana');
await page.click('.ventana-pie .btn-primario');
await page.waitForSelector('.partido-tarjeta');
await page.click('.partido-tarjeta:has-text("Águilas")');
await page.waitForSelector('.formato');
await page.click('text=Mejor de 5');
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
await page.waitForSelector('.fila-circulos');

const cdp = await ctx.newCDPSession(page);

// Un toque en "+" de Roots y espera al siguiente cuadro: lo que la persona siente.
const medirToques = (n) => page.evaluate(async (n) => {
  const mediana = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const p95 = (a) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * 0.95))];
  const tiempos = [];
  for (let i = 0; i < n; i++) {
    const boton = document.querySelector(i % 2 ? '.puntos-l .btn-punto.mas' : '.puntos-v .btn-punto.mas');
    const t0 = performance.now();
    boton.click();
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    tiempos.push(performance.now() - t0);
  }
  return { mediana: +mediana(tiempos).toFixed(1), p95: +p95(tiempos).toFixed(1), max: +Math.max(...tiempos).toFixed(1) };
}, n);

const cambiarTab = async (t) => { await page.click(`.tabs >> text=${t}`); await page.waitForTimeout(300); };

async function medirTodo(etiqueta) {
  const r = {};
  for (const tab of ['Acciones', 'Resumen']) {
    await cambiarTab(tab);
    r[tab] = await medirToques(14);
  }
  // Desglose de un guardado: espejo (localStorage, síncrono) y escritura a IndexedDB.
  r.desglose = await page.evaluate(async () => {
    const c = await import('./js/contexto.js');
    const b = await import('./js/borrador.js');
    const reg = [...c.app.partidos.values()].find((p) => p.est.actual.plantillaConfirmada || p.est.sets.length);
    const t0 = performance.now();
    b.guardarEspejo(reg, { torneos: [...c.app.torneos.values()], jugadores: [...c.app.jugadores.values()], versionApp: c.app.version });
    const espejo = performance.now() - t0;
    const kb = (localStorage.getItem('roots-espejo') ?? '').length / 1024;
    const t1 = performance.now();
    await c.app.almacen.guardar('partidos', reg);
    const idb = performance.now() - t1;
    const t2 = performance.now();
    c.app.renderizar();
    const dibujo = performance.now() - t2;
    return { espejoMs: +espejo.toFixed(1), espejoKB: +kb.toFixed(0), indexedDB_ms: +idb.toFixed(1), dibujarMs: +dibujo.toFixed(1), eventosEnSetActual: reg.est.actual.eventos.length, sets: reg.est.sets.length };
  });
  console.log(`\n== ${etiqueta}`);
  console.log(JSON.stringify(r));
  return r;
}

await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const base = await medirTodo('Partido vacío, CPU 4x más lenta');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

// Simula: un set largo (≈48 puntos y ≈144 jugadas) y copia ese set 4 veces para tener 5 sets.
const info = await page.evaluate(async () => {
  const m = await import('./js/motor.js');
  const c = await import('./js/contexto.js');
  const f = await import('./js/reglas/fundamentosPosicion.js');
  const reg = [...c.app.partidos.values()].find((p) => p.est.actual.plantillaConfirmada);
  const est = reg.est;
  const jugadores = c.jugadoresDeTorneo(reg.torneoId);
  const cx = { jugadores, lesiones: c.app.lesiones, ahora: () => new Date(), avisar: () => {} };
  const nombres = { local: reg.equipoLocal, visitante: reg.equipoVisitante };
  const CAL = ['doble_positivo', 'positivo', 'negativo', 'error'];
  const azar = (a) => a[Math.floor(Math.random() * a.length)];
  let jugadas = 0;
  for (let p = 0; p < 48; p++) {
    for (let k = 0; k < 3; k++) {
      const d = m.derivados(est, cx);
      const ids = [...est.actual.slots.filter((x) => x != null), ...d.idsLibero];
      const id = azar(ids);
      const perm = f.fundamentosPermitidos(d.jugadorEnPartido(id), { esLibero: d.esLiberoId(id) });
      try { m.registrarJugada(est, cx, id, azar(perm), azar(CAL)); jugadas++; } catch { /* regla: se salta */ }
    }
    m.sumarPunto(est, cx, Math.random() < 0.55 ? est.ladoPropio : (est.ladoPropio === 'local' ? 'visitante' : 'local'), nombres);
  }
  const act = est.actual;
  const marcadores = [[25, 20], [22, 25], [25, 23], [20, 25]];
  marcadores.forEach(([a, b], i) => {
    est.sets.push({
      numeroSet: i + 1, puntosLocal: a, puntosVisitante: b,
      titulares: structuredClone(act.titulares), sustituciones: structuredClone(act.sustituciones), eventos: structuredClone(act.eventos),
      puntosSeq: [...act.puntosSeq], puntosInfo: structuredClone(act.puntosInfo), tiemposMuertos: { ...act.tiemposMuertos },
      cierre: { slots: [...act.slots], rotaciones: act.rotaciones, saca: act.saca, primerSaque: act.primerSaque },
    });
  });
  c.guardarPartido(reg);
  c.app.renderizar();
  return { jugadasPorSet: jugadas, sets: est.sets.length, puntosSetActual: act.puntosSeq.length };
});
console.log('\nSimulado:', JSON.stringify(info));
await page.waitForTimeout(500);

await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const norm = await medirTodo('5 sets, CPU normal');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const x4 = await medirTodo('5 sets, CPU 4x más lenta');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
const x6 = await medirTodo('5 sets, CPU 6x más lenta');
console.log('\nerrores de página:', JSON.stringify(errores));
await navegador.close();
s.close();

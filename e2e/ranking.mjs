// Recorrido del Ranking: importa la muestra, siembra partidos con jugadas en 3 torneos femeninos, abre Ranking desde el inicio y
// prueba posiciones, métricas, torneo, evolución del equipo y de una jugadora. Revisa que no haya desbordes en dos tamaños de
// pantalla y deja capturas en /tmp/ranking-*.png. Uso: node e2e/ranking.mjs
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

await page.goto(`http://127.0.0.1:${puerto}/`);
await page.waitForSelector('.vacio');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.vacio .btn-primario')]);
await chooser.setFiles(`${RAIZ}/tests/fixtures/muestra-roots.json`);
await page.waitForSelector('.ventana');
await page.click('.ventana-pie .btn-primario');
await page.waitForSelector('.partido-tarjeta');

// Sin jugadas todavía: el ranking lo explica.
await page.click('[data-ir-ranking]');
await page.waitForSelector('[data-pantalla="ranking"]');
ok(await page.locator('[data-ranking-vacio]').count() === 1, 'sin jugadas muestra el aviso vacío');
await page.click('button[aria-label="Volver"]');

// Siembra: 3 torneos femeninos (mejora de uno a otro) con 2 partidos cada uno.
await page.evaluate(async () => {
  const { app, guardarPartido } = await import('/js/contexto.js');
  const M = await import('/js/motor.js');
  const { FUNDAMENTOS_POR_POSICION, clavePosicion } = await import('/js/reglas/fundamentosPosicion.js');
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  const torneos = [
    { id: 11, nombre: 'Copa Pereira Femenina', genero: 'femenino', categoria: 'libre', fechaInicio: '2026-03-07', fechaFin: '2026-03-08' },
    { id: 12, nombre: 'Liga Cafetera <Sub-17>', genero: 'femenino', categoria: 'libre', fechaInicio: '2026-06-13', fechaFin: '2026-06-14' },
    { id: 13, nombre: 'Torneo Nacional de Voleibol de Colombia', genero: 'femenino', categoria: 'libre', fechaInicio: '2026-09-19', fechaFin: '2026-09-20' },
  ];
  for (const t of torneos) { app.torneos.set(t.id, t); await app.almacen.guardar('torneos', t); }
  const damas = [...app.jugadores.values()].filter((j) => j.genero === 'femenino');
  const probas = [[0.05, 0.3, 0.4, 0.25], [0.12, 0.38, 0.35, 0.15], [0.2, 0.42, 0.28, 0.1]]; // doble positivo, positivo, negativo, error
  const califica = (nivel) => { const p = probas[nivel]; let x = azar(); for (let i = 0; i < 4; i++) { x -= p[i]; if (x <= 0) return ['doble_positivo', 'positivo', 'negativo', 'error'][i]; } return 'error'; };
  let id = 500;
  torneos.forEach((t, nivel) => {
    ['Halcones', 'Titanes'].forEach((rival, k) => {
      id += 1;
      const est = M.nuevoEstadoPartido({ id, torneoId: t.id, equipoLocal: 'Roots', equipoVisitante: rival, fecha: t.fechaInicio.slice(0, 8) + String(Number(t.fechaInicio.slice(8)) + k).padStart(2, '0'), hora: '10:00:00', formatoSets: 'mejor_de_3' });
      const eventos = [];
      const titulares = [];
      damas.forEach((j) => {
        const clave = clavePosicion(j.posicion);
        const esLibero = clave === 'libero';
        if (esLibero) titulares.push({ id: `${id}-${j.id}`, jugadorId: j.id, esLibero: true, tipoLibero: 'unico' });
        const n = esLibero ? 14 : clave === 'central' ? 9 : 12;
        for (const f of FUNDAMENTOS_POR_POSICION[clave]) for (let i = 0; i < Math.round(n / 3) + 1; i++) eventos.push({ id: eventos.length + 1, jugadorId: j.id, fundamento: f, calificacion: califica(Math.min(2, nivel + (j.id % 3 === 0 ? 0 : (azar() > 0.6 ? 1 : 0)))) });
      });
      const ganamos = nivel + k > 1;
      est.sets = [{ numeroSet: 1, puntosLocal: ganamos ? 25 : 19, puntosVisitante: ganamos ? 18 : 25, titulares, sustituciones: [], eventos, puntosSeq: [], puntosInfo: [] }, { numeroSet: 2, puntosLocal: ganamos ? 25 : 21, puntosVisitante: ganamos ? 22 : 25, titulares: [], sustituciones: [], eventos: [], puntosSeq: [], puntosInfo: [] }];
      est.actual = M.nuevoSetEnCurso();
      guardarPartido({ id, torneoId: t.id, equipoLocal: 'Roots', equipoVisitante: rival, fecha: est.fecha ?? t.fechaInicio, hora: '10:00:00', est });
    });
  });
  app.renderizar();
});

console.log('Ranking');
await page.click('[data-ir-ranking]');
await page.waitForSelector('[data-lista-ranking] .fila-ranking');
ok(await page.locator('.fila-ranking').count() >= 3, 'hay filas de ranking');
ok(await page.locator('.rk-puesto.p1').count() === 1, 'hay un primer puesto');
await page.click('[data-mas-filtros] summary');
ok(await page.locator('[data-torneo]').count() === 4, 'chips de torneo: Todos + 3');
await page.click('[data-mas-filtros] summary');
await page.screenshot({ path: '/tmp/ranking-1-ranking.png' });

await page.click('[data-grupo="libero"]');
ok(await page.locator('[data-metrica="RecepcionDefensa"]').count() === 1, 'el líbero tiene recepción + defensa');
await page.click('[data-metrica="RecepcionCalidad"]');
await page.waitForSelector('.fila-ranking');
ok((await page.locator('.rk-valor strong').first().innerText()).includes(','), 'la calidad se muestra con coma');
await page.click('[data-grupo="atacante"]');
await page.click('[data-metrica="AtaqueEficiencia"]');
await page.click('[data-mas-filtros] summary');
await page.click('[data-torneo="13"]');
await page.waitForSelector('.fila-ranking');
ok(await page.locator('.rk-cambio').count() > 0, 'con un torneo elegido salen ▲/▼ frente al anterior');
await page.screenshot({ path: '/tmp/ranking-2-torneo.png' });

// Evolución de una jugadora
await page.click('[data-torneo="todos"]');
await page.locator('.fila-ranking').first().click();
await page.waitForSelector("[data-evolucion-jugadora] svg.ev-svg");
await page.waitForTimeout(450);
ok(await page.locator('[data-evolucion-jugadora] .ev-punto').count() >= 3, 'la gráfica de la jugadora dibuja puntos');
ok(await page.locator('[data-evolucion-jugadora] tbody tr').count() === 3, 'la tabla tiene un renglón por torneo');
ok((await page.locator('.ventana-sub').innerText()).includes('Atacante'), 'el subtítulo dice en qué posición jugó');
await page.screenshot({ path: '/tmp/ranking-3-jugadora.png' });
await page.click('[data-modo-evolucion="partido"]');
ok(await page.locator('[data-evolucion-jugadora] tbody tr').count() === 6, 'por partido: 6 renglones');
await page.click('.ventana .chip-serie >> nth=0');
ok(await page.locator('.chip-serie[aria-pressed="false"]').count() >= 1, 'se puede apagar una serie');
await page.click('.ventana-pie .btn-primario');
await page.waitForTimeout(250);

// Evolución del equipo
await page.click('[data-vista-ranking="equipo"]');
await page.waitForSelector('[data-evolucion] svg.ev-svg');
ok(await page.locator('[data-evolucion] tbody tr').count() === 3, 'equipo: un renglón por torneo');
ok((await page.locator('[data-evolucion] tbody tr').first().innerText()).includes('G'), 'equipo: muestra ganados y perdidos');
ok((await page.locator('svg.ev-svg').innerHTML()).includes('Liga Cafetera &lt;Sub-17&gt;') || (await page.locator('svg.ev-svg').innerHTML()).includes('Liga Cafe'), 'los nombres con < se escapan en la gráfica');
await page.screenshot({ path: '/tmp/ranking-4-equipo.png' });

// Exportar y quitar de la tablet: el historial se conserva y el ranking sigue igual
await page.evaluate(async () => {
  const { app, borrarPartidos } = await import('/js/contexto.js');
  const ids = [...app.partidos.values()].filter((p) => p.torneoId === 11).map((p) => p.id);
  await borrarPartidos(ids, { archivar: true });
  app.renderizar();
});
await page.waitForSelector('[data-vista-ranking]');
await page.click('[data-vista-ranking="equipo"]');
await page.waitForSelector('[data-evolucion] svg.ev-svg');
ok(await page.locator('[data-evolucion] tbody tr').count() === 3, 'tras quitar el primer torneo de la tablet, la evolución sigue mostrando 3 torneos');
await page.click('[data-vista-ranking="ranking"]');
await page.waitForSelector('[data-nota-archivo]');
ok((await page.locator('[data-nota-archivo]').innerText()).includes('2 partidos'), 'avisa cuántos partidos vienen del historial');

// Desbordes en horizontal y en vertical (Lenovo Idea Tab: ~1280×800 en horizontal y ~800×1280 en vertical)
for (const [ancho, alto] of [[1280, 800], [800, 1280], [600, 960]]) {
  await page.setViewportSize({ width: ancho, height: alto });
  for (const vista of ['ranking', 'equipo']) {
    await page.click(`[data-vista-ranking="${vista}"]`);
    await page.waitForTimeout(120);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(desborde <= 1, `${vista} a ${ancho}×${alto} sin desborde horizontal (${desborde}px)`);
  }
  await page.click('[data-vista-ranking="ranking"]');
  await page.screenshot({ path: `/tmp/ranking-5-${ancho}x${alto}.png`, fullPage: true });
}
// Tema claro
await page.setViewportSize({ width: 1280, height: 800 });
await page.evaluate(() => document.documentElement.setAttribute('data-tema', 'claro'));
await page.click('[data-vista-ranking="equipo"]');
await page.screenshot({ path: '/tmp/ranking-6-claro.png' });

ok(errores.length === 0, `sin errores en la consola${errores.length ? `: ${errores.join(' | ')}` : ''}`);
await navegador.close();
s.close();
if (fallos.length) { console.log(`\n${fallos.length} fallo(s)`); process.exit(1); }
console.log('\nTodo bien');

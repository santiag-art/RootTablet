// Service worker de Roots Tablet: guarda la app en el teléfono/tablet para que abra sin internet.
// Al cambiar cualquier archivo de la app, sube VERSION para que los equipos descarguen la versión nueva.
const VERSION = 'roots-tablet-v1.33.0';
// El manual en PDF pesa varios MB: se guarda aparte, sin frenar la instalación de la app.
const MANUAL = 'manual/Manual-Roots-Tablet-v1.0.pdf';
const ARCHIVOS = [
  './',
  'css/app.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'img/cancha-roots.jpg',
  'img/roots-logo.png',
  'js/avisosJuego.js',
  'js/candado.js',
  'js/duracion.js',
  'js/ui/relojPartido.js',
  'js/ui/miniCancha.js',
  'js/ui/candado.js',
  'js/ayudaContenido.js',
  'js/cambiosSugeridos.js',
  'js/lesionEnPartido.js',
  'js/rachas.js',
  'js/puntosRival.js',
  'js/reporteScouting.js',
  'js/puntoDecisivo.js',
  'js/historialRival.js',
  'js/lineaSet.js',
  'js/rendimientoRotacion.js',
  'js/ranking.js',
  'js/mvp.js',
  'js/pesosMvp.js',
  'js/ui/pesosMvp.js',
  'js/historial.js',
  'js/recordatorio.js',
  'js/borrador.js',
  'js/config.js',
  'js/contexto.js',
  'js/cronometro.js',
  'js/drive.js',
  'js/copia.js',
  'js/estadisticas.js',
  'js/exportar.js',
  'js/importar.js',
  'js/main.js',
  'js/marcadorLados.js',
  'js/motor.js',
  'js/nuevoPartido.js',
  'js/posicionPartido.js',
  'js/practica.js',
  'data/muestra-practica.json',
  'js/qr/codigoQR.js',
  'js/qr/marcos.js',
  'js/soltar.js',
  'js/reglas/anotacion.js',
  'js/reglas/catalogos.js',
  'js/reglas/disponibilidad.js',
  'js/reglas/faltaPosicion.js',
  'js/reglas/fundamentosPosicion.js',
  'js/reglas/liberos.js',
  'js/reglas/posiciones.js',
  'js/reglas/reglasSet.js',
  'js/reglas/reglasSustitucion.js',
  'js/reglas/rotaciones.js',
  'js/reglas/voleibol.js',
  'js/resumen.js',
  'js/resumenCompartir.js',
  'js/store.js',
  'js/ui/acciones.js',
  'js/ui/ajustes.js',
  'js/ui/ayuda.js',
  'js/ui/lesion.js',
  'js/ui/aviso.js',
  'js/ui/arrastrar.js',
  'js/ui/borradorPantalla.js',
  'js/ui/cierrePartido.js',
  'js/ui/practicaPantalla.js',
  'js/ui/copiaPantalla.js',
  'js/ui/dom.js',
  'js/ui/driveSesion.js',
  'js/ui/escanerQR.js',
  'js/ui/entregar.js',
  'js/ui/exportarPantalla.js',
  'js/ui/inicio.js',
  'js/ui/mostrarQR.js',
  'js/ui/nuevoPartido.js',
  'js/ui/partido.js',
  'js/ui/piezas.js',
  'js/ui/plantilla.js',
  'js/ui/preguntarPosicion.js',
  'js/ui/puntoRival.js',
  'js/ui/ranking.js',
  'js/ui/rivales.js',
  'js/ui/resumenPartido.js',
  'js/ui/tiempoMuerto.js',
  'js/ui/transferir.js',
  'index.html',
  'manifest.webmanifest',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSION).then((cache) =>
      cache.addAll(ARCHIVOS).then(() => {
        cache.add(MANUAL).catch(() => {}); // si no se alcanza a guardar ahora, se guarda la primera vez que se abra con internet
      })
    )
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((c) => c.startsWith('roots-tablet-') && c !== VERSION).map((c) => caches.delete(c)))).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;
  evento.respondWith(
    caches.match(pedido, { ignoreSearch: true }).then(
      (guardado) =>
        guardado ||
        fetch(pedido)
          .then((respuesta) => {
            if (respuesta.status === 200 && new URL(pedido.url).pathname.endsWith(MANUAL)) {
              const copia = respuesta.clone();
              caches.open(VERSION).then((cache) => cache.put(MANUAL, copia));
            }
            return respuesta;
          })
          .catch(() => (pedido.mode === 'navigate' ? caches.match('index.html') : Response.error()))
    )
  );
});

// Contenido de la Ayuda dentro de la app: es el Manual de usuario de Roots Tablet (v1.0, PDF) en versión corta,
// más lo que se agregó después (cierre guiado, modo práctica, panel de Acciones). Sin dependencias: solo datos.
//
// Bloques: { p } párrafo · { pasos: [..] } lista numerada · { lista: [..] } viñetas · { consejo } recuadro verde ·
// { alerta } recuadro naranja · { tabla: [[a, b], ..] } dos columnas.

export const ARCHIVO_MANUAL = 'manual/Manual-Roots-Tablet-v1.0.pdf';
export const VERSION_MANUAL = '1.0';

export const SECCIONES = [
  {
    id: 'antes',
    titulo: 'Antes de empezar',
    sub: 'Qué es, instalarla y cómo viajan los datos',
    bloques: [
      { p: 'Roots Tablet es la app para anotar partidos en la cancha sin internet y sin el computador. Lee el archivo que exporta Roots, guarda todo en la propia tablet y al final devuelve un archivo de resultados.' },
      { tabla: [['1 · Roots', 'Anotación en vivo → Exportar para tablet.'], ['2 · Tablet', 'Importar archivo (o Recibir).'], ['3 · Tablet', 'Plantilla, marcador y jugadas, set por set.'], ['4 · Roots', 'En la tablet: Resultados → Exportar. En Roots: Respaldo de datos → Importar resultados.']] },
      { pasos: ['Abre el enlace de la app en Chrome, con internet.', 'Toca ⋮ de Chrome → Instalar app (o Añadir a pantalla de inicio). También desde Ajustes → Instalar en la tablet.', 'Ábrela siempre con su icono: funciona sin internet.'] },
      { lista: ['Todo se guarda solo en esta tablet, jugada por jugada. No hace falta pulsar «Guardar».', 'La tablet no se conecta con Roots: los datos viajan en un archivo (WhatsApp, Drive, cable o código QR).', 'No uses Chrome en modo incógnito: ahí no deja guardar y la app lo avisa con una franja roja.'] },
      { consejo: 'En Ajustes → Proteger los datos le pides al navegador que no borre la información de la app aunque falte espacio.' },
    ],
  },
  {
    id: 'llevar',
    titulo: 'Llevar los partidos a la tablet',
    sub: 'Importar, recibir y crear partidos',
    bloques: [
      { p: 'Primero, en Roots (computador): Anotación en vivo → Exportar para tablet. Se descarga el archivo roots-tablet-AAAA-MM-DD.json con los partidos pendientes, torneos, jugadoras y lesiones.' },
      { pasos: ['Pasa el archivo a la tablet (WhatsApp, Drive, correo o cable).', 'En el inicio toca Importar archivo y elígelo.', 'La app dice cuántos partidos y jugadoras trajo. Toca Ver partidos.'] },
      { consejo: 'Importar otra vez el mismo archivo no duplica nada ni borra lo que ya anotaste.' },
      { p: 'Recibir por Drive o código QR (botón Recibir):' },
      { lista: ['Desde Google Drive: baja el archivo de la carpeta «Roots Tablet» de tu Drive. Necesita internet y que la app esté configurada para Drive; si no, dice «Falta configurarlo».', 'Escanear código QR: sin internet. El otro aparato muestra una serie de códigos y la tablet los lee con la cámara, en cualquier orden. Necesita Chrome para Android actualizado.', 'Elegir un archivo: igual que «Importar archivo».'] },
      { p: 'La lista de partidos se agrupa por torneo:' },
      { tabla: [['HOY', 'El partido es hoy.'], ['Sin empezar · En juego · Terminado', 'Estado en la tablet. Debajo sale el marcador de sets.'], ['Roots ya tiene N sets', 'Puedes anotarlo igual: al importar en Roots te preguntará antes de reemplazarlos.'], ['Creado en la tablet', 'Lo creaste con Nuevo partido; solo existe aquí hasta que lo exportes.'], ['🗑 (papelera)', 'Borra ese partido de la tablet (pide confirmación). En Roots no cambia nada.']] },
      { p: 'Nuevo partido (si no alcanzaste a exportarlo):' },
      { pasos: ['Toca Nuevo partido y elige el torneo.', 'Escribe el rival (o tócalo si ya lo tienes). Si se parece a uno que existe, la app pregunta si es el mismo equipo.', 'Elige si Roots es Local o Visitante, la fecha y la hora, y toca Crear partido.'] },
      { alerta: 'Para crear partidos hace falta haber importado un archivo de Roots al menos una vez: de ahí salen los torneos y las jugadoras.' },
    ],
  },
  {
    id: 'preparar',
    titulo: 'Preparar el partido',
    sub: 'Formato, plantilla, posiciones y líberos',
    bloques: [
      { p: 'Toca un partido de la lista. La primera vez pregunta el formato (Mejor de 3 o Mejor de 5) y luego abre la pestaña Plantilla.' },
      { pasos: ['Toca a una jugadora de la lista para ponerla en la primera casilla libre, o arrástrala (desde el agarre ⋮⋮) hasta su posición. Si sueltas sobre una casilla ocupada, se cambian de lugar.', 'Cada vez que una jugadora entra, la app pregunta de qué posición juega hoy. La de su ficha aparece marcada: un toque la elige.', 'Elige el modo de líbero: Sin líbero, Un líbero o Dos líberos (recepción y defensa), y toca el cupo para elegir a quién.', 'Cuando estén las 6 (y el líbero), toca Confirmar plantilla. Desde ahí solo se hacen cambios.'] },
      { lista: ['La posición elegida manda en este partido: define qué fundamentos se le pueden anotar y cómo se agrupa en las estadísticas.', 'En la cancha se ve una etiqueta corta: Ata, Col, Cen, Opu. Antes de confirmar, toca su casilla → Cambiar su posición.', 'Al líbero no se le pregunta la posición. En el set siguiente la posición se conserva.', 'Si pones a alguien que Roots marcó como no apta por lesión, la app te lo advierte antes de confirmar.'] },
      { consejo: 'En cada set nuevo vuelves a la pestaña Plantilla para confirmar (o cambiar) la alineación inicial. La app propone la del set anterior.' },
    ],
  },
  {
    id: 'marcador',
    titulo: 'El marcador',
    sub: 'Puntos, saque, rotación, tiempos muertos y avisos',
    bloques: [
      { lista: ['El + grande suma un punto al equipo; el − lo quita. En el centro: set, sets ganados y formato.', 'Arriba: volver (←), partido y torneo, «Guardado hh:mm», pestañas Plantilla · Acciones · Resumen, Deshacer y menú ⋮.', 'Botones del equipo: Saca/Sacar, TM (tiempos muertos) y, en Roots, «6 cambios» (los que quedan).'] },
      { alerta: 'El marcador solo cambia con + y −. Anotar una jugada en Acciones no suma puntos: solo va a la estadística.' },
      { p: 'Saque y rotación:' },
      { lista: ['Al empezar cada set la app pide «Elige quién saca»: toca Sacar del equipo que saca.', 'Cuando Roots recupera el saque, la app rota sola y avisa quién saca ahora. Si el rival anota mientras sacamos, pasamos a recibir.', 'En Plantilla están Rotar (hacia atrás), Ver rotaciones (las 6) y Verificar formación.'] },
      { p: 'Tiempos muertos: toca TM del equipo que lo pide. Hay 2 por set (los puntos llenos son los usados). Cuenta de 30 s a pantalla completa; suena a los 10 s y al terminar. «Seguir el partido» deja el reloj en una pastilla; «Me equivoqué, devolver» lo anula.' },
      { p: 'Deshacer (naranja, arriba) revierte la última acción y dice cuál es: un punto (con su rotación), una jugada, un cambio o un tiempo muerto. En el set decisivo, a los 8 puntos sale el aviso de cambio de cancha: toca Ya cambiaron.' },
      { tabla: [['Racha del rival', 'A los 3 puntos seguidos (amarillo) y a los 4 (rojo), con los tiempos muertos que te quedan.'], ['Errores seguidos', 'Saque: 2 de la misma jugadora avisan y 3 es rojo. Recepción y ataque: desde 3, y rojo a los 4.'], ['Líbero', 'Puede entrar la líbero (botón Entrar) o La líbero sale si la rotación la lleva adelante.'], ['Set completo', 'El marcador ya cierra el set: botón Terminar set.'], ['Punto de set / de partido', 'Etiqueta junto al nombre del equipo; verde si es de Roots, roja si es del rival.']] },
      { consejo: 'La X cierra un aviso. Todos se apagan en el menú ⋮ → Avisos del partido.' },
      { p: 'Reloj del partido: con el primer punto del set aparece, en el centro del marcador, «Set mm:ss · Partido mm:ss» (en pantalla vertical sale bajo el nombre del partido, con ⏱). Al guardar cada set queda su duración, y al terminar el partido el Resumen dice «Duración del partido» (del primer al último punto, con los descansos entre sets). La duración viaja en el archivo de resultados y Roots la guarda para llevar el registro. Un set cargado a mano, sin puntos, no tiene duración.' },
      { p: 'Candado de toques: el botón del candado (junto al menú ⋮) cubre la pantalla y deja a la vista solo el marcador. Mientras está bloqueada, ningún toque hace nada. Para abrirla, mantén pulsado el botón «Mantén pulsado para desbloquear» (1,5 segundos). Úsalo para guardar la tablet o apoyar la mano sin sumar puntos por error. Si sales del partido con el botón atrás de Android, se desbloquea sola.' },
    ],
  },
  {
    id: 'jugadas',
    titulo: 'Registrar jugadas',
    sub: 'Pestaña Acciones y cómo anota el rival',
    bloques: [
      { pasos: ['Toca el círculo de la jugadora. Van en el orden de la rotación; el líbero aparece aparte, a la derecha. Quien está fuera por el líbero sale en gris.', 'Toca el fundamento. Solo salen los de su posición (al líbero: recepción y defensa).', 'Toca la calificación: doble positivo, positivo, negativo o error. Queda en Últimas jugadas.'] },
      { tabla: [['Recepción', 'Pase perfecto = doble positivo · bueno = positivo · malo = negativo · ace o error = error.'], ['Ataque', 'Punto directo = doble positivo · bloqueado o fuera = error.'], ['Saque', 'Ace = doble positivo · red o fuera = error.'], ['Colocación', 'Opcional: marca antes Pase bueno o Pase malo; luego las cuatro calificaciones.'], ['Bloqueo', 'Punto = doble positivo (marca «Bloqueo en conjunto» si fue doble o triple) · tocado = positivo · error = error.'], ['Defensa', 'Las cuatro calificaciones según qué tan buena fue la acción.']] },
      { consejo: 'Encima de los fundamentos está la mini-estadística de la jugadora: efectividad de ataque y recepción, y saques directos y errores, en el set y en todo el partido.' },
      { p: 'Mini cancha: a la derecha de los círculos hay una cancha pequeña con quién está en cada zona (P1 a P6) ahora mismo; la S amarilla marca quién saca. Se actualiza sola con cada rotación, cambio o entrada de líbero (el líbero sale con su color). Solo se mira: no se toca. La jugadora que elijas se resalta en ella. Con la X de su esquina se oculta (queda un botón «Cancha» para volver a mostrarla); en pantalla vertical queda debajo de los círculos.' },
      { p: 'Si te equivocas de jugadora o de fundamento:' },
      { lista: ['Toca la X de arriba a la derecha del panel: quita la selección.', 'Toca otra vez el fundamento elegido: lo quita.', 'En una pantalla corta, todo sube y baja junto: el nombre con la X y las calificaciones se quedan fijos arriba mientras haces scroll hacia Colocación (pase bueno/malo) o Bloqueo (en conjunto).'] },
      { p: 'Cómo anota el rival: cada vez que le sumas un punto con +, la app pregunta cómo lo consiguió. Un toque basta; Omitir lo deja sin detalle.' },
      { pasos: ['Toca el motivo: Ataque, Saque directo, Bloqueo o Error nuestro. Si no fue ataque, ya queda guardado.', 'Si fue Ataque: toca la zona del rival desde la que atacó (4, 3, 2, 6 o 1).', 'Toca la zona de nuestra cancha donde cayó (1 a 6). Con las dos marcadas se guarda solo; también puedes usar Guardar sin zonas.'] },
      { consejo: 'Para anotar rápido: primero la jugada en Acciones y después el punto en el marcador. Así la recepción queda en la rotación correcta del Rendimiento por rotación. Si no quieres el detalle del rival: menú ⋮ → Detalle de los puntos del rival → Apagado.' },
    ],
  },
  {
    id: 'cambios',
    titulo: 'Cambios y líberos',
    sub: 'Sustituciones, cambio excepcional y nuevo líbero',
    bloques: [
      { p: 'Con la plantilla confirmada, los cambios se hacen desde la pestaña Plantilla, tocando la casilla de quien sale (Hacer un cambio) o arrastrando.' },
      { lista: ['Máximo 6 cambios por set. El botón «6 cambios» muestra los que quedan: naranja con 2 o menos y rojo en 0.', 'También puedes arrastrar a alguien de la banca hasta la casilla de quien sale; pide confirmar.', 'Cambio excepcional (lesión): márcalo arriba de la lista si no hay un cambio legal posible. No cuenta dentro de los 6, pero quien sale no puede volver en el partido.', 'La app vuelve a preguntar la posición de quien entra.'] },
      { p: 'Líberos:' },
      { lista: ['El líbero entra y sale sin contar como cambio. Juega en P1 solo mientras recibimos, y en P5 y P6; nunca en la delantera.', 'En su cupo: Entrar (eliges por quién, solo zagueras) o arrástralo a la casilla. Cuando la rotación lo lleva adelante, sale solo y vuelve quien reemplazó.', 'No puede seguir (nuevo líbero): si el líbero se lesiona, eliges a otra jugadora que será líbero el resto del partido (regla 19.4).'] },
    ],
  },
  {
    id: 'terminar',
    titulo: 'Terminar y corregir',
    sub: 'Menú del partido, cerrar sets y arreglar errores',
    bloques: [
      { lista: ['Terminar set: guarda el marcador y pasa al siguiente.', 'Terminar partido: lo cierra a mano. Ahora abre una ventana con un solo botón, Exportar y guardar copia (ver «Devolver los resultados a Roots»).', 'Corregir sets guardados: cambiar un marcador o reabrir el último set.', 'Nuestro equipo: cuál de los dos es Roots. Formato del partido (solo antes del primer set).', 'Exportar borrador, Invertir el marcador, Marcador sigue el cambio de cancha, Avisos del partido, Detalle de los puntos del rival, Tema claro/oscuro y Volver a la lista.'] },
      { p: 'Terminar un set: cuando el marcador cierra el set aparece el aviso Terminar set (o usa el menú). Ajusta el marcador final con − / + (o −5 / +5) si hace falta y toca Guardar set. La app no deja guardar un marcador imposible. Cuando un equipo gana los sets necesarios, el partido queda decidido y se abre el Resumen.' },
      { p: 'Corregir un error:' },
      { lista: ['Toca un set para corregir su marcador.', 'Reabrir el set si lo guardaste antes de tiempo: vuelve con su rotación y su saque exactos.', 'Si cerraste el partido a mano, el menú ofrece Reabrir partido.'] },
    ],
  },
  {
    id: 'resumen',
    titulo: 'Resumen del partido',
    sub: 'Estadísticas, línea del set, rotaciones y rivales',
    bloques: [
      { p: 'La pestaña Resumen se puede mirar en cualquier momento; al terminar el partido se abre sola. El selector Todo el partido / Set 1 / Set 2… cambia lo que muestran las gráficas y las tablas.' },
      { lista: ['Resumen para compartir (el mismo de Roots): marcador por sets, mejores jugadoras y puntos clave. Descargar PDF, Descargar imagen, Ver vista previa o Compartir… (WhatsApp y demás).', 'Línea del set: diferencia de puntos, punto a punto, desde nuestro lado. Arriba del cero vamos ganando; el tramo rojo es la peor racha del rival. Debajo: mayor ventaja, mayor desventaja y rachas.', 'Equipo por fundamento: jugadas, calificaciones y efectividad (doble positivo + positivo sobre el total).', 'Rendimiento por rotación: R1 es la formación con que empieza el set. Por rotación: puntos ganados-perdidos, saque, side-out y recepción. Marca con ▼ la rotación donde más puntos se pierden y en rojo la que peor recibe.', 'Por jugadora: agrupadas por la posición con que jugaron; toca una para ver sus fundamentos.', 'Cómo anota el rival: barras por motivo, frases como «Ataca más desde la zona 4» y mapa de calor (naranja = de dónde ataca, verde = dónde cae). Todos vs … junta todos los partidos contra ese rival.'] },
      { p: 'Rivales (botón del inicio): la lista de equipos contra los que ya jugaste, con partidos ganados y perdidos (por sets). Al tocar uno ves cómo anota en todos los partidos juntos y la lista de esos partidos.' },
      { alerta: 'Si quitas los partidos de la tablet al exportar, su historial se va con ellos. Guarda antes una copia de seguridad si quieres conservarlo.' },
    ],
  },
  {
    id: 'devolver',
    titulo: 'Devolver los resultados a Roots',
    sub: 'Exportar y enviar el archivo',
    bloques: [
      { p: 'La forma más corta: al terminar el partido, en la ventana Partido terminado toca Exportar y guardar copia. Saca primero los resultados para Roots y luego la copia de seguridad; cada paso queda en «Listo». Si cancelas uno, el botón dice «Seguir con lo que falta» y no repite el que ya salió. No quita nada de la tablet. También está en el aviso verde del partido terminado y en el menú ⋮.' },
      { p: 'Para exportar varios partidos juntos:' },
      { pasos: ['En el inicio toca Resultados. Los partidos terminados vienen marcados; marca o desmarca los que quieras.', 'Toca Exportar. Si algo merece revisión (por ejemplo un set sin terminar, que no se exporta), la app avisa antes.', 'Elige cómo sacar el archivo roots-resultados-AAAA-MM-DD.json.', 'Responde si quieres quitar esos partidos de la tablet. Si no estás segura, déjalos: no se pierde nada.'] },
      { lista: ['Subir a Google Drive: a la carpeta «Roots Tablet - Enviados» (necesita internet y la configuración de Drive).', 'Mostrar código QR: sin internet; el otro aparato lo escanea. Después toca Ya lo recibieron.', 'WhatsApp, correo u otra app, o Guardar en la tablet (queda en Descargas).'] },
      { alerta: 'Si un partido terminado no se ha exportado o no tiene copia, el inicio lo recuerda con una franja naranja y la etiqueta «Falta exportar». Toca Exportar y guardar copia y desaparece. También avisa si corriges algo después de exportar.' },
      { consejo: 'En Roots (computador): Respaldo de datos → Importar resultados de la tablet y elige este archivo. Los partidos creados en la tablet se crean en Roots y no se duplican aunque importes dos veces (Manual de Roots, Sección 13).' },
    ],
  },
  {
    id: 'respaldo',
    titulo: 'Que no se pierda nada',
    sub: 'Guardado, borrador, copia y ajustes',
    bloques: [
      { lista: ['Guardado automático: cada punto y jugada se guarda al instante; la barra dice «Guardado hh:mm». Si la tablet se apaga a mitad de partido, al volver sigue donde estaba. Si algo no se pudo guardar, sale un aviso rojo con Exportar borrador.', 'Borrador (menú ⋮ → Exportar borrador): archivo con todo el partido, también el set en juego. Sirve para seguir en otra tablet con «Importar archivo». No es el archivo para Roots.', 'Copia de seguridad (Ajustes → Guardar copia): todo lo de la tablet en un archivo roots-tablet-copia-….json. Mándala a tu correo o Drive. El inicio avisa si hay partidos sin copia.'] },
      { p: 'Ajustes (botón ⋮ del inicio): Apariencia (Oscuro/Claro), Copia de seguridad (Guardar copia / Restaurar una copia), Modo práctica, Instalación, Almacenamiento (Proteger los datos), Versión y Borrar todos los datos (pide confirmar dos veces).' },
      { alerta: 'Restaurar una copia reemplaza TODO lo que hay en la tablet (antes te ofrece guardar una copia de lo actual). Borrar todos los datos no se puede deshacer.' },
    ],
  },
  {
    id: 'practica',
    titulo: 'Modo práctica',
    sub: 'Ensayar con datos de ejemplo sin ensuciar los reales',
    bloques: [
      { p: 'El botón Práctica del inicio (o Ajustes → Modo práctica) abre partidos de ejemplo en una base de datos aparte. No toca tus partidos reales. Mientras practicas la pantalla tiene un marco naranja, una etiqueta PRÁCTICA junto al título y, en el inicio, el botón naranja Salir de la práctica.' },
      { lista: ['Lo practicado se conserva al salir y volver. Ajustes → Reiniciar la práctica deja los ejemplos como nuevos.', 'Al abrir la app siempre se empieza en los datos reales.', 'En práctica nada sale de la tablet: resultados, copia y borrador no se exportan, para que los datos de ejemplo no lleguen a Roots. El cierre de «Terminar partido» se ensaya con los pasos simulados.'] },
    ],
  },
  {
    id: 'ranking',
    titulo: 'Ranking de jugadoras',
    sub: 'Quién va mejor y cómo evoluciona por torneo',
    bloques: [
      { p: 'En el inicio toca Ranking. Elige la posición (cada una se compara solo con las de su posición) y el fundamento: ataque, recepción, saque, colocación, bloqueo o defensa. Las jugadoras con menos de 5 jugadas quedan aparte, sin puesto.' },
      { lista: ['Torneo y categoría: ábrelo para ver el ranking de un solo torneo o categoría.', '▲ / ▼ junto al valor: cuánto subió o bajó frente al torneo anterior.', 'Toca a una jugadora para ver su evolución por torneo o por partido, con gráfica y tabla.', 'Evolución del equipo: lo mismo con todo el equipo, con partidos ganados y perdidos por torneo.'] },
      { consejo: 'La posición que cuenta es la que jugó en cada partido: si una jugadora jugó de dos posiciones, aparece en las dos.' },
      { p: 'Cuando exportas partidos y los quitas de la tablet, su resumen se guarda y el ranking los sigue contando. Va en la copia de seguridad. En Roots, la ficha de cada jugadora muestra su evolución por torneo, que se acumula con cada archivo de resultados que importas.' },
    ],
  },
  {
    id: 'faq',
    titulo: 'Preguntas frecuentes',
    sub: 'Problemas comunes y glosario',
    bloques: [
      { tabla: [['Me equivoqué en un punto o una jugada.', 'Toca Deshacer arriba: revierte la última acción, incluida la rotación.'], ['Guardé un set antes de tiempo.', 'Menú ⋮ → Corregir sets guardados → Reabrir el set.'], ['Se apagó la tablet en pleno set.', 'Abre la app: el partido sigue donde estaba.'], ['Quiero seguir en otra tablet.', 'Menú ⋮ → Exportar borrador, y en la otra tablet «Importar archivo».'], ['No rota al recuperar el saque.', 'Revisa que esté marcado quién saca y que «Nuestro equipo» sea Roots (menú ⋮).'], ['No aparece una jugadora.', 'Revisa el filtro de categoría. Si no venía en el archivo, vuelve a exportar desde Roots e importa.'], ['No me deja anotar un fundamento.', 'Depende de la posición con que juega hoy. Antes de confirmar, toca su casilla → Cambiar su posición.'], ['Importé el mismo archivo dos veces.', 'No pasa nada: no se duplica ni se borra lo anotado.'], ['Los botones de Drive dicen «Falta configurarlo».', 'Usa el código QR, compartir o guardar en la tablet; Drive lo configura quien publica la app.'], ['Dice que hay una versión nueva.', 'Toca Actualizar en el inicio. Lo anotado no se pierde.']] },
      { p: 'Glosario' },
      { tabla: [['Archivo de tablet', 'roots-tablet-….json: lo que Roots le entrega a la tablet (partidos, torneos, jugadoras y lesiones).'], ['Archivo de resultados', 'roots-resultados-….json: lo anotado (sets guardados, titulares, cambios y jugadas); se importa en Roots.'], ['Borrador', 'roots-borrador-….json: el partido completo con el set en juego. Solo lo lee la tablet.'], ['Copia de seguridad', 'roots-tablet-copia-….json: todo lo que hay en la tablet.'], ['Side-out', 'Punto ganado cuando el rival tenía el saque.'], ['Efectividad', 'Jugadas positivas (doble positivo + positivo) sobre el total.']] },
    ],
  },
];

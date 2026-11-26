// Candado de toques: la pantalla del partido se cubre y solo se abre manteniendo pulsado el botón un rato.
// Sirve para guardar la tablet, apoyar la mano o que alguien la toque sin querer a mitad de partido.
// Aquí solo está la regla (cuánto hay que mantener); la capa que tapa la pantalla está en ui/candado.js.

export const MS_MANTENER = 1500;

// Qué tanto del tiempo requerido lleva mantenido el dedo (0 a 1). Con 1 se desbloquea.
export function fraccionMantenida(inicio, ahora, ms = MS_MANTENER) {
  if (inicio == null || ahora == null || ms <= 0) return 0;
  return Math.min(1, Math.max(0, (ahora - inicio) / ms));
}

export function desbloquea(inicio, ahora, ms = MS_MANTENER) {
  return fraccionMantenida(inicio, ahora, ms) >= 1;
}

// Cuánto dura cada set y el partido. Función pura: solo hace cuentas con fechas (ISO) que guarda el motor.
//
// Cada set lleva `inicioEn` (cuando cayó su primer punto) y `finEn` (cuando cayó el último). La duración de un set es
// la diferencia. La del partido va del primer punto del primer set al último punto del último: incluye los
// descansos entre sets, porque eso es lo que de verdad se demora el partido.
//
// Si la tablet se apaga o se deja quieta mucho rato dentro de un set el reloj no sirve: pasado el máximo se descarta
// (queda "sin dato") en vez de guardar una cifra absurda.

export const MAX_SET_SEG = 3 * 3600;
export const MAX_PARTIDO_SEG = 8 * 3600;

const ms = (iso) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

// Segundos entre dos fechas, o null si falta una, están al revés o pasa del máximo.
export function segundosEntre(inicio, fin, max = MAX_SET_SEG) {
  const a = ms(inicio);
  const b = ms(fin);
  if (a == null || b == null || b < a) return null;
  const s = Math.round((b - a) / 1000);
  return s > max ? null : s;
}

// Duración de un set ya guardado (la de su campo, o calculada con sus fechas).
export function duracionDeSet(set) {
  if (Number.isFinite(set?.duracionSeg) && set.duracionSeg >= 0) return set.duracionSeg;
  return segundosEntre(set?.inicioEn, set?.finEn);
}

// Duración del partido con los sets guardados. null si no hay fechas.
export function duracionDePartido(sets) {
  const conFechas = (sets ?? []).filter((s) => ms(s?.inicioEn) != null && ms(s?.finEn) != null);
  if (conFechas.length === 0) return null;
  return segundosEntre(conFechas[0].inicioEn, conFechas.at(-1).finEn, MAX_PARTIDO_SEG);
}

// Para el reloj en vivo: segundos desde `inicio` hasta `ahora` (sin descartar, solo no negativos).
export function segundosDesde(inicio, ahora = new Date()) {
  const a = ms(inicio);
  if (a == null) return null;
  return Math.max(0, Math.round((ahora.getTime() - a) / 1000));
}

const dos = (n) => String(n).padStart(2, '0');

// 754 → "12:34"; 3725 → "1:02:05".
export function formatoReloj(seg) {
  if (seg == null || !Number.isFinite(seg)) return '—';
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

// 3725 → "1 h 2 min"; 1500 → "25 min"; 40 → "40 s".
export function formatoDuracion(seg) {
  if (seg == null || !Number.isFinite(seg)) return '—';
  if (seg < 60) return `${seg} s`;
  const min = Math.round(seg / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

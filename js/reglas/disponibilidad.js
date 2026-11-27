// Disponibilidad para jugar mientras dura una lesión (copia de frontend/src/utils/notas.js de Roots).
// El archivo que Roots entrega a la tablet trae solo: jugadorId, zona, gravedad y disponibilidad (sin descripciones médicas).
export const DISPONIBILIDADES = [
  { value: 'apta', label: 'Apta para jugar', corto: 'Apta' },
  { value: 'limitada', label: 'Limitada', corto: 'Limitada' },
  { value: 'no_apta', label: 'No apta', corto: 'No apta' },
];

export const DISPONIBILIDAD_POR_VALOR = Object.fromEntries(DISPONIBILIDADES.map((d) => [d.value, d]));

// Lesiones guardadas antes de existir el campo: grave no juega, el resto con limitación.
export function disponibilidadDeLesion(lesion) {
  if (lesion.disponibilidad) return lesion.disponibilidad;
  return lesion.gravedad === 'grave' ? 'no_apta' : 'limitada';
}

// De la lista de lesiones sin recuperar saca, por jugador, la peor disponibilidad y las zonas afectadas.
// Quien no aparece en el mapa está apto sin lesiones.
export function disponibilidadPorJugador(lesionesActivas) {
  const gravedad = { apta: 0, limitada: 1, no_apta: 2 };
  const mapa = new Map();
  lesionesActivas.forEach((l) => {
    const disp = disponibilidadDeLesion(l);
    const actual = mapa.get(l.jugadorId);
    if (!actual) {
      mapa.set(l.jugadorId, { disponibilidad: disp, zonas: [l.zona].filter(Boolean) });
      return;
    }
    if (gravedad[disp] > gravedad[actual.disponibilidad]) actual.disponibilidad = disp;
    if (l.zona && !actual.zonas.includes(l.zona)) actual.zonas.push(l.zona);
  });
  return mapa;
}

// Zonas del cuerpo para marcar una lesión (la misma lista de Roots: frontend/src/utils/notas.js).
export const ZONAS_LESION = ['Cabeza / cuello', 'Hombro', 'Codo', 'Muñeca / mano', 'Espalda', 'Cadera', 'Muslo', 'Rodilla', 'Pantorrilla', 'Tobillo', 'Pie', 'Otra'];

// En pleno partido solo se marca "limitada" o "no apta" (si sigue apta no hay nada que marcar).
export const DISPONIBILIDADES_EN_PARTIDO = ['limitada', 'no_apta'];

// Une lo que Roots dice de cada jugadora con las lesiones marcadas en la tablet (partidos que siguen aquí).
// Gana la peor disponibilidad y se juntan las zonas. `base` no se modifica.
//   base: Map jugadorId -> { disponibilidad, zonas } (de disponibilidadPorJugador)
//   marcas: [{ jugadorId, zona, disponibilidad }]
export function combinarDisponibilidad(base, marcas) {
  const mapa = new Map([...base].map(([id, v]) => [id, { disponibilidad: v.disponibilidad, zonas: [...v.zonas] }]));
  const gravedad = { apta: 0, limitada: 1, no_apta: 2 };
  for (const m of marcas) {
    const actual = mapa.get(m.jugadorId);
    if (!actual) {
      mapa.set(m.jugadorId, { disponibilidad: m.disponibilidad, zonas: [m.zona].filter(Boolean) });
      continue;
    }
    if (gravedad[m.disponibilidad] > gravedad[actual.disponibilidad]) actual.disponibilidad = m.disponibilidad;
    if (m.zona && !actual.zonas.includes(m.zona)) actual.zonas.push(m.zona);
  }
  return mapa;
}

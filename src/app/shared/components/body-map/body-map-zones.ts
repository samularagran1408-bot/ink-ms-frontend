import { BodyState, MUSCLE_MAP } from 'body-muscles';

import { BodyMapData } from '../../../core/models/body-map';

const MUSCLE_IDS = new Set(MUSCLE_MAP.map((muscle) => muscle.id));

const ZONA_A_MUSCULOS: Record<string, string[]> = {
  cabeza: ['head', 'face', 'head-back'],
  cuello: ['neck-left', 'neck-right', 'nape'],
  hombro: [
    'shoulder-front-left',
    'shoulder-front-right',
    'shoulder-side-left',
    'shoulder-side-right',
    'deltoid-rear-left',
    'deltoid-rear-right'
  ],
  hombro_izq: ['shoulder-front-left', 'shoulder-side-left', 'deltoid-rear-left'],
  hombro_der: ['shoulder-front-right', 'shoulder-side-right', 'deltoid-rear-right'],
  pecho: ['chest-upper-left', 'chest-upper-right', 'chest-lower-left', 'chest-lower-right'],
  abdomen: [
    'abs-upper-left',
    'abs-upper-right',
    'abs-lower-left',
    'abs-lower-right',
    'obliques-left',
    'obliques-right'
  ],
  brazo_izq: [
    'biceps-left',
    'triceps-long-left',
    'triceps-lateral-left',
    'forearm-left',
    'forearm-flexors-left',
    'forearm-extensors-left'
  ],
  brazo_der: [
    'biceps-right',
    'triceps-long-right',
    'triceps-lateral-right',
    'forearm-right',
    'forearm-flexors-right',
    'forearm-extensors-right'
  ],
  codo_izq: ['elbow-left'],
  codo_der: ['elbow-right'],
  muneca_izq: ['hand-left', 'hand-back-left'],
  muneca_der: ['hand-right', 'hand-back-right'],
  cadera_izq: ['hip-flexor-left', 'gluteus-medius-left'],
  cadera_der: ['hip-flexor-right', 'gluteus-medius-right'],
  espalda: [
    'traps-upper-left',
    'traps-upper-right',
    'traps-mid-left',
    'traps-mid-right',
    'lats-upper-left',
    'lats-upper-right',
    'lats-mid-left',
    'lats-mid-right',
    'lats-lower-left',
    'lats-lower-right',
    'lower-back-erectors-left',
    'lower-back-erectors-right',
    'lower-back-ql-left',
    'lower-back-ql-right',
    'spine'
  ],
  espalda_alta: [
    'traps-upper-left',
    'traps-upper-right',
    'traps-mid-left',
    'traps-mid-right',
    'lats-upper-left',
    'lats-upper-right'
  ],
  lumbar: [
    'lower-back-erectors-left',
    'lower-back-erectors-right',
    'lower-back-ql-left',
    'lower-back-ql-right',
    'spine',
    'lats-lower-left',
    'lats-lower-right'
  ],
  gluteo_izq: ['gluteus-maximus-left', 'gluteus-medius-left'],
  gluteo_der: ['gluteus-maximus-right', 'gluteus-medius-right'],
  muslo_izq: ['quads-left', 'hamstrings-medial-left', 'hamstrings-lateral-left', 'adductors-left'],
  muslo_der: ['quads-right', 'hamstrings-medial-right', 'hamstrings-lateral-right', 'adductors-right'],
  rodilla_izq: ['knee-left', 'knee-back-left'],
  rodilla_der: ['knee-right', 'knee-back-right'],
  pantorrilla_izq: [
    'calves-gastroc-medial-left',
    'calves-gastroc-lateral-left',
    'calves-soleus-left',
    'tibialis-anterior-left'
  ],
  pantorrilla_der: [
    'calves-gastroc-medial-right',
    'calves-gastroc-lateral-right',
    'calves-soleus-right',
    'tibialis-anterior-right'
  ],
  pie_izq: ['foot-left', 'foot-back-left'],
  pie_der: ['foot-right', 'foot-back-right']
};

const ALIAS: Record<string, string> = {
  hombro_izquierdo: 'hombro_izq',
  hombro_derecho: 'hombro_der',
  brazo_izquierdo: 'brazo_izq',
  brazo_derecho: 'brazo_der',
  codo_izquierdo: 'codo_izq',
  codo_derecho: 'codo_der',
  muneca_izquierda: 'muneca_izq',
  muneca_derecha: 'muneca_der',
  cadera_izquierda: 'cadera_izq',
  cadera_derecha: 'cadera_der',
  gluteo_izquierdo: 'gluteo_izq',
  gluteo_derecho: 'gluteo_der',
  muslo_izquierdo: 'muslo_izq',
  muslo_derecho: 'muslo_der',
  rodilla_izquierda: 'rodilla_izq',
  rodilla_derecha: 'rodilla_der',
  pantorrilla_izquierda: 'pantorrilla_izq',
  pantorrilla_derecha: 'pantorrilla_der',
  pie_izquierdo: 'pie_izq',
  pie_derecho: 'pie_der',
  chest: 'pecho',
  pectoral: 'pecho',
  torso: 'pecho',
  back: 'espalda',
  upper_back: 'espalda_alta',
  lower_back: 'lumbar',
  espalda_baja: 'lumbar',
  lumbar_izq: 'lumbar',
  lumbar_der: 'lumbar'
};

const INTENSIDAD_DOLOR = 9;

function clavesDeZona(zona: string): string[] {
  const cruda = zona.trim().toLowerCase();
  const sinAcentos = cruda.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return [...new Set([
    cruda,
    sinAcentos,
    sinAcentos.replace(/\s+/g, '-'),
    sinAcentos.replace(/[\s-]+/g, '_')
  ])];
}

export function bodyStateDesdeMapa(mapa: BodyMapData | null): BodyState {
  const state: BodyState = {};
  for (const zona of mapa?.zonas_dolor || []) {
    for (const clave of clavesDeZona(zona)) {
      if (MUSCLE_IDS.has(clave)) {
        state[clave] = { intensity: INTENSIDAD_DOLOR, selected: true };
        continue;
      }
      const canonica = ALIAS[clave] || clave;
      for (const muscleId of ZONA_A_MUSCULOS[canonica] || []) {
        state[muscleId] = { intensity: INTENSIDAD_DOLOR, selected: true };
      }
    }
  }
  return state;
}

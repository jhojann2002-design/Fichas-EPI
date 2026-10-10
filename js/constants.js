// js/constants.js

export const dbSintomas = {
  resp: [
    { id: 'tos', label: 'Tos' }, { id: 'dolor_garganta', label: 'Dolor garganta' },
    { id: 'dif_respiratoria', label: 'Dificultad respiratoria' }, { id: 'cianosis', label: 'Cianosis' },
    { id: 'diarrea', label: 'Diarrea' }, { id: 'nauseas', label: 'Náuseas / Vómitos' },
    { id: 'dolor_abdominal', label: 'Dolor abdominal' }, { id: 'deshidratacion', label: 'Deshidratación' },
    { id: 'ictericia', label: 'Ictericia' }, { id: 'anorexia', label: 'Anorexia' }
  ],
  gen: [
    { id: 'fiebre', label: 'Fiebre' }, { id: 'cefalea', label: 'Cefalea' },
    { id: 'escalofrios', label: 'Escalofríos' }, { id: 'mialgias', label: 'Mialgias' },
    { id: 'artralgia', label: 'Artralgia' }, { id: 'sudoracion', label: 'Sudoración nocturna' },
    { id: 'sangrados', label: 'Sangrados' }, { id: 'erupcion', label: 'Erupción / Exantema' },
    { id: 'prurito', label: 'Prurito' }, { id: 'adenopatias', label: 'Adenopatías' }
  ],
  neuro: [
    { id: 'convulsiones', label: 'Convulsiones' }, { id: 'alt_neuro_central', label: 'Alteración Neuro Central' },
    { id: 'alt_neuro_periferico', label: 'Alteración Neuro Periférica' }, { id: 'vision_borrosa', label: 'Visión borrosa' },
    { id: 'rigidez', label: 'Rigidez muscular' }, { id: 'espasmo', label: 'Espasmo muscular' }
  ],
  baja: [
    { id: 'apnea', label: 'Apnea' }, { id: 'ascitis', label: 'Ascitis' },
    { id: 'paralisis', label: 'Parálisis' }, { id: 'estridor', label: 'Estridor respiratorio' },
    { id: 'oncocercomas', label: 'Oncocercomas' }, { id: 'trismus', label: 'Trismus' }
  ]
};

export const dbVacunas = [
  { id: 'bcg', label: 'BCG' }, { id: 'hb', label: 'HB' }, { id: 'rota', label: 'Rota' },
  { id: 'opv', label: 'OPV' }, { id: 'penta', label: 'Penta' }, { id: 'influenza', label: 'Influenza' },
  { id: 'neumococo_conj', label: 'Neumo. Conj.' }, { id: 'sr', label: 'SR' }, { id: 'fa', label: 'FA' },
  { id: 'dt', label: 'DT' }, { id: 'dpt', label: 'DPT' }, { id: 'dt_adulto', label: 'dT' },
  { id: 'srp', label: 'SRP' }, { id: 'varicela', label: 'Varicela' }, { id: 'neumococo_poli', label: 'Neumo. Poli.' }
];

export const API_URL = "https://script.google.com/macros/s/AKfycbyIai7A64P_OkaWXO1Pw-xedd6OXtcvt7DadkePJ5Ja5VdBB6clxUEmg0UDzHoqSW9EPA/exec";
export const counterUrl = 'https://api.counterapi.dev/v1/fichasepi_jhojann_v1/generadas'; 

export const etniaOpciones = {
  MASCULINO: ["MESTIZO", "BLANCO", "AFROECUATORIANO", "INDÍGENA", "MONTUBIO", "OTRO"],
  FEMENINO: ["MESTIZA", "BLANCA", "AFROECUATORIANA", "INDÍGENA", "MONTUBIA", "OTRA"]
};

export const civilOpciones = {
  MASCULINO: ["SOLTERO", "CASADO", "UNIÓN LIBRE", "DIVORCIADO", "VIUDO"],
  FEMENINO: ["SOLTERA", "CASADA", "UNIÓN LIBRE", "DIVORCIADA", "VIUDA"]
};
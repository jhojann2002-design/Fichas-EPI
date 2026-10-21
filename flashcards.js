import { Storage } from './storage.js';

export class FlashcardsManager {
  constructor() {
    this.deck = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.masteredCount = 0;
    this.filterSpecialty = 'Todas';
    this.filterSubtema = null;
    this.filterSource = 'all';

    // Perlas de Alto Voltaje CACES (Cubriendo los 7 Componentes Oficiales EHEP)
    this.mspPearls = [
      {
        id: "pearl_1",
        especialidad: "Ginecología y Obstetricia",
        subtema: "Emergencias Obstétricas MSP - Clave Roja",
        pregunta: "¿Cuál es el manejo farmacológico de primera línea en **Hemorragia Posparto (Atonía Uterina)** según la norma MSP de Ecuador?",
        respuesta: "**Oxitocina** 20 a 40 UI en 1000 ml de cristaloide IV a 125 ml/h + **Ácido Tranexámico** 1 g IV en 10 min (en las primeras 3 horas) + Masaje uterino bimanual.",
        justificacion: "Si no cede, usar Metilergonovina 0.2 mg IM (contraindicada en hipertensas/preeclampsia) o Misoprostol 800 mcg sublingual."
      },
      {
        id: "pearl_2",
        especialidad: "Ginecología y Obstetricia",
        subtema: "Trastornos Hipertensivos - Clave Azul",
        pregunta: "¿Cuál es el esquema oficial de **Sulfato de Magnesio (Zuspan)** en Preeclampsia Severa vs. Eclampsia según la GPC del MSP?",
        respuesta: "- **Preeclampsia severa:** Impregnación **4 g IV** en 20 min + Mantenimiento **1 g/hora**.\n- **Eclampsia (convulsiones):** Impregnación **6 g IV** en 20 min + Mantenimiento **2 g/hora**.",
        justificacion: "Antídoto ante abolición de reflejo rotuliano o FR < 12 rpm: **Gluconato de Calcio al 10%** (1 g IV lento en 3-5 min)."
      },
      {
        id: "pearl_3",
        especialidad: "Pediatría",
        subtema: "Estrategia AIEPI MSP - Deshidratación",
        pregunta: "En un niño con **algún grado de deshidratación** (irritable, ojos hundidos, bebe con avidez), ¿cuál es la dosis exacta del **Plan B**?",
        respuesta: "**Sales de Rehidratación Oral (SRO)** de baja osmolaridad: **50 a 100 ml/kg** administrados durante **4 horas** en el establecimiento de salud.",
        justificacion: "Reevaluar a las 4 horas. Al pasar a Plan A en casa, suplementar siempre con **Sulfato de Zinc** por 14 días (10 mg en < 6 meses; 20 mg en ≥ 6 meses)."
      },
      {
        id: "pearl_4",
        especialidad: "Pediatría",
        subtema: "Vacunación MSP Ecuador (PAI)",
        pregunta: "¿Qué vacunas recibe todo recién nacido en las primeras **24 horas de vida** según el esquema del MSP?",
        respuesta: "- **BCG:** 0.05 ml vía intradérmica en deltoides derecho.\n- **Hepatitis B pediátrica:** 0.5 ml vía intramuscular en vasto externo.",
        justificacion: "La vacuna Hepatitis B en las primeras 24 horas es crítica para prevenir la transmisión vertical perinatal."
      },
      {
        id: "pearl_5",
        especialidad: "Medicina Interna",
        subtema: "Infecciosas MSP - Dengue",
        pregunta: "¿Qué hallazgos definen a un **Dengue con Signos de Alarma (Grupo B2)** y cuál es su hidratación inicial?",
        respuesta: "Dolor abdominal intenso y continuo, vómitos persistentes, sangrado de mucosas, letargo, hepatomegalia > 2 cm o **aumento del hematocrito con caída de plaquetas**.",
        justificacion: "Manejo Grupo B2: Hospitalización e hidratación IV inmediata con **Cristaloides (Lactato Ringer o SSN 0.9%) a 10 ml/kg en la primera hora**."
      },
      {
        id: "pearl_6",
        especialidad: "Medicina Interna",
        subtema: "Cardiología - SCACEST",
        pregunta: "¿Cuál es el tiempo máximo permitido **Puerta-Balón** (ICP) y **Puerta-Aguja** (Fibrinólisis) en el IAM con elevación del ST?",
        respuesta: "- **Puerta-Balón (Angioplastia):** ≤ 90 min (o ≤ 120 min si requiere traslado).\n- **Puerta-Aguja (Fibrinólisis):** ≤ 30 min si no hay hemodinamia en < 120 min.",
        justificacion: "En SCACEST el bloqueo completo coronario exige reperfusión inmediata sin esperar resultado de troponinas."
      },
      {
        id: "pearl_7",
        especialidad: "Cirugía",
        subtema: "Abdomen Agudo - Apendicitis Aguda",
        pregunta: "¿Qué parámetros de la **Escala de Alvarado (MANTRELS)** valen **2 puntos** cada uno?",
        respuesta: "1. **Dolor directo en fosa ilíaca derecha** (+2 pts).\n2. **Leucocitosis > 10,000 /mm³** (+2 pts).",
        justificacion: "Los otros 6 criterios valen 1 punto. Un puntaje ≥ 7 indica alta probabilidad y conducta quirúrgica (apendicectomía)."
      },
      {
        id: "pearl_8",
        especialidad: "Cirugía",
        subtema: "Trauma Torácico ATLS",
        pregunta: "¿Cómo diferencias clínicamente un **Neumotórax a Tensión** de un **Taponamiento Cardíaco** en urgencias?",
        respuesta: "Ambos tienen hipotensión e ingurgitación yugular, pero el **Neumotórax a Tensión** presenta **abolición del murmullo vesicular e hiperresonancia** a la percusión del hemitórax afectado.",
        justificacion: "El Taponamiento Cardíaco (Tríada de Beck) tiene murmullo vesicular conservado y ruidos cardíacos velados (hipofonéticos)."
      },
      {
        id: "pearl_9",
        especialidad: "Salud Mental",
        subtema: "Urgencias Psiquiátricas - Delirium vs. Demencia",
        pregunta: "¿Cuál es la diferencia semiológica cardinal entre **Delirium (Síndrome Confusional Agudo)** y **Demencia** en el adulto mayor?",
        respuesta: "El **Delirium** tiene inicio **agudo (horas a días)**, curso **fluctuante** (empeora en la noche) y alteración marcada de la **atención y nivel de conciencia**.",
        justificacion: "En la demencia (ej. Alzheimer) el inicio es insidioso (meses/años) y el paciente mantiene la alerta y atención intactas en fases iniciales."
      },
      {
        id: "pearl_10",
        especialidad: "Salud Mental",
        subtema: "Riesgo Suicida y Depresión",
        pregunta: "¿Cuánto tiempo deben mantenerse los síntomas para diagnosticar un **Trastorno Depresivo Mayor** según el DSM-5 / CIE-11?",
        respuesta: "Al menos **2 semanas consecutivas** con ≥ 5 síntomas, incluyendo obligatoriamente **ánimo depresivo** o **anhedonia** (pérdida de interés o placer).",
        justificacion: "En adolescentes y niños, el ánimo depresivo puede manifestarse predominantemente como **irritabilidad**."
      },
      {
        id: "pearl_11",
        especialidad: "Salud Pública",
        subtema: "Modelo MAIS-FCI Ecuador",
        pregunta: "¿Qué porcentaje de problemas de salud debe resolver el **Primer Nivel de Atención** según el MAIS-FCI?",
        respuesta: "Resuelve al menos el **80% al 85%** de las necesidades de salud de la población y constituye la **puerta de entrada obligatoria** al Sistema Nacional de Salud.",
        justificacion: "Incluye Puestos de Salud y Centros de Salud Tipo A, B y C."
      },
      {
        id: "pearl_12",
        especialidad: "Bioética",
        subtema: "Principios Bioéticos y Final de la Vida",
        pregunta: "¿Qué es la **Adecuación (Limitación) del Esfuerzo Terapéutico (AET)** y en qué principio bioético se fundamenta?",
        respuesta: "Es la decisión clínica de **no iniciar o retirar medidas fútiles** que solo prolongan la agonía en un paciente irreversible, fundamentada en el principio de **No Maleficencia** (evitar la obstinación o encarnizamiento terapéutico).",
        justificacion: "No debe confundirse con eutanasia; en la AET se mantienen siempre los **cuidados paliativos, analgesia y confort**."
      }
    ];
  }

  async loadDeck({ specialty = 'Todas', subtema = null, source = 'all' } = {}) {
    this.filterSpecialty = specialty;
    this.filterSubtema = subtema || null;
    this.filterSource = source;
    this.currentIndex = 0;
    this.isFlipped = false;

    let cards = [];

    if (source === 'all' || source === 'msp_pearls') {
      cards.push(...this.mspPearls);
    }

    if (source === 'all' || source === 'errors') {
      const errorBank = Storage.getErrorBank();
      const allQ = await Storage.getAllQuestions();
      const errorIds = Object.keys(errorBank).filter(id => !errorBank[id].dominada);

      errorIds.forEach(id => {
        const q = allQ.find(item => item.id === id);
        if (q) {
          const optText = Array.isArray(q.opciones)
            ? (q.opciones.find(o => o.id === q.correcta)?.texto || '')
            : (q.opciones?.[q.correcta] || '');
          cards.push({
            id: `err_${q.id}`,
            especialidad: q.especialidad,
            subtema: q.subtema || 'La Morgue (Error)',
            pregunta: `${q.enunciado}\n\n**${q.pregunta || '¿Cuál es la respuesta correcta?'}**`,
            respuesta: `**Opción ${q.correcta}:** ${optText}`,
            justificacion: q.por_que_es || q.justificacion || 'Pregunta fallada en simulacros previos.',
            perla_caces: q.perla_caces || '',
            guia_msp: q.guia_msp || ''
          });
        }
      });
    }

    if (source === 'all' || source === 'questions') {
      const allQ = await Storage.getAllQuestions();
      allQ.forEach(q => {
        if (!cards.some(c => c.id === `err_${q.id}`)) {
          const optText = Array.isArray(q.opciones)
            ? (q.opciones.find(o => o.id === q.correcta)?.texto || '')
            : (q.opciones?.[q.correcta] || '');
          cards.push({
            id: `q_${q.id}`,
            especialidad: q.especialidad,
            subtema: q.subtema || 'Caso Clínico CACES',
            pregunta: `${q.enunciado}\n\n**${q.pregunta || '¿Cuál es la conducta de elección?'}**`,
            respuesta: `**Opción ${q.correcta}:** ${optText}`,
            justificacion: q.por_que_es || q.justificacion || '',
            perla_caces: q.perla_caces || '',
            guia_msp: q.guia_msp || ''
          });
        }
      });
    }

    if (specialty && specialty !== 'Todas') {
      cards = cards.filter(c => c.especialidad === specialty);
    }

    if (subtema && subtema !== 'Todos') {
      const sLower = subtema.toLowerCase().trim();
      cards = cards.filter(c => {
        if (!c.subtema) return false;
        const cLower = c.subtema.toLowerCase().trim();
        return cLower === sLower || cLower.includes(sLower) || sLower.includes(cLower);
      });
    }

    this.deck = this.shuffle(cards);
    return this.deck;
  }

  getCurrentCard() {
    if (this.deck.length === 0) return null;
    return this.deck[this.currentIndex];
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    return this.isFlipped;
  }

  nextCard() {
    if (this.currentIndex < this.deck.length - 1) {
      this.currentIndex++;
      this.isFlipped = false;
      return true;
    }
    return false;
  }

  prevCard() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isFlipped = false;
      return true;
    }
    return false;
  }

  loadSRSData() {
    try {
      return JSON.parse(localStorage.getItem('caces_srs_deck') || '{}');
    } catch {
      return {};
    }
  }

  saveSRSData(data) {
    try {
      localStorage.setItem('caces_srs_deck', JSON.stringify(data));
    } catch (e) {
      console.warn('Error guardando SRS:', e);
    }
  }

  rateCard(rating) {
    const current = this.getCurrentCard();
    if (!current) return;

    // Algoritmo SuperMemo-2 (SM-2)
    const srsData = this.loadSRSData();
    const cardId = current.id;
    let item = srsData[cardId] || {
      repetitions: 0,
      interval: 1, // en días
      easeFactor: 2.5,
      dueDate: Date.now()
    };

    let q = 3; // 'good'
    if (rating === 'hard') q = 1;
    else if (rating === 'easy') q = 5;

    // Cálculo SM-2
    if (q < 3) {
      item.repetitions = 0;
      item.interval = 1;
      // Reinsertar en la baraja actual 3 posiciones adelante
      const card = this.deck.splice(this.currentIndex, 1)[0];
      const targetPos = Math.min(this.currentIndex + 3, this.deck.length);
      this.deck.splice(targetPos, 0, card);
      this.isFlipped = false;
    } else {
      if (item.repetitions === 0) {
        item.interval = 1;
      } else if (item.repetitions === 1) {
        item.interval = 6;
      } else {
        item.interval = Math.round(item.interval * item.easeFactor);
      }
      item.repetitions += 1;
      this.nextCard();
    }

    item.easeFactor = Math.max(1.3, item.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    item.dueDate = Date.now() + item.interval * 24 * 60 * 60 * 1000;
    srsData[cardId] = item;
    this.saveSRSData(srsData);

    if (rating === 'easy') {
      this.masteredCount++;
      if (current.id.startsWith('err_')) {
        const origId = current.id.replace('err_', '');
        Storage.markErrorMastered(origId);
      }
    }
  }

  getDueTodayCount() {
    const srsData = this.loadSRSData();
    const now = Date.now();
    let count = 0;
    Object.values(srsData).forEach(card => {
      if (card.dueDate <= now) count++;
    });
    return count;
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export const Flashcards = new FlashcardsManager();
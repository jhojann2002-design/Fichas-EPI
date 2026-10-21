/**
 * HERRAMIENTAS Y CALCULADORAS CLÍNICAS CACES
 * Normativas y Algoritmos del Ministerio de Salud Pública (MSP) del Ecuador
 */

export class ClinicalCalculators {
  /**
   * 1. SCORE MAMÁ Y CLAVES OBSTÉTRICAS (MSP Ecuador)
   * Evalúa 6 signos vitales + estado de conciencia + proteinuria
   */
  static calculateScoreMama({ fc, pas, pad, fr, temp, sat, conciencia, proteinuria }) {
    let score = 0;
    const details = [];

    // Frecuencia Cardíaca
    fc = Number(fc);
    let sFc = 0;
    if (fc <= 50) sFc = 3;
    else if (fc >= 51 && fc <= 59) sFc = 1;
    else if (fc >= 60 && fc <= 100) sFc = 0;
    else if (fc >= 101 && fc <= 110) sFc = 1;
    else if (fc >= 111 && fc <= 119) sFc = 2;
    else if (fc >= 120) sFc = 3;
    score += sFc;
    if (sFc > 0) details.push(`FC (${fc} lpm): +${sFc}`);

    // Presión Sistólica
    pas = Number(pas);
    let sPas = 0;
    if (pas <= 70) sPas = 3;
    else if (pas >= 71 && pas <= 89) sPas = 2;
    else if (pas >= 90 && pas <= 139) sPas = 0;
    else if (pas >= 140 && pas <= 159) sPas = 2;
    else if (pas >= 160) sPas = 3;
    score += sPas;
    if (sPas > 0) details.push(`PA Sistólica (${pas} mmHg): +${sPas}`);

    // Presión Diastólica
    pad = Number(pad);
    let sPad = 0;
    if (pad <= 50) sPad = 3;
    else if (pad >= 51 && pad <= 59) sPad = 1;
    else if (pad >= 60 && pad <= 89) sPad = 0;
    else if (pad >= 90 && pad <= 109) sPas = 2;
    else if (pad >= 110) sPad = 3;
    score += sPad;
    if (sPad > 0) details.push(`PA Diastólica (${pad} mmHg): +${sPad}`);

    // Frecuencia Respiratoria
    fr = Number(fr);
    let sFr = 0;
    if (fr < 12) sFr = 3;
    else if (fr >= 12 && fr <= 22) sFr = 0;
    else if (fr >= 23 && fr <= 29) sFr = 2;
    else if (fr >= 30) sFr = 3;
    score += sFr;
    if (sFr > 0) details.push(`FR (${fr} rpm): +${sFr}`);

    // Temperatura
    temp = Number(temp);
    let sTemp = 0;
    if (temp <= 35.5) sTemp = 2;
    else if (temp > 35.5 && temp <= 37.5) sTemp = 0;
    else if (temp >= 37.6 && temp <= 38.4) sTemp = 1;
    else if (temp >= 38.5) sTemp = 2;
    score += sTemp;
    if (sTemp > 0) details.push(`Temp (${temp} °C): +${sTemp}`);

    // Saturación O2
    sat = Number(sat);
    let sSat = 0;
    if (sat < 85) sSat = 3;
    else if (sat >= 85 && sat <= 89) sSat = 2;
    else if (sat >= 90 && sat <= 93) sSat = 1;
    else if (sat >= 94) sSat = 0;
    score += sSat;
    if (sSat > 0) details.push(`SatO2 (${sat}%): +${sSat}`);

    // Conciencia: 0=Alerta, 2=Responde a la voz, 3=Responde al dolor / No responde
    const sCon = Number(conciencia || 0);
    score += sCon;
    if (sCon > 0) details.push(`Estado Conciencia: +${sCon}`);

    // Proteinuria: 0=Negativa/Trazas, 1=1+, 2=2+, 3=3+
    const sProt = Number(proteinuria || 0);
    score += sProt;
    if (sProt > 0) details.push(`Proteinuria: +${sProt}`);

    let alertLevel = 'normal';
    let recommendation = '';
    let activationKey = null;

    if (score === 0) {
      alertLevel = 'verde';
      recommendation = "Paciente estable. Evaluar y registrar signos vitales cada 4 horas.";
    } else if (score === 1) {
      alertLevel = 'amarillo_leve';
      recommendation = "Evaluar signos vitales cada 2 horas. Aplicar Score MAMÁ y vigilar evolución.";
    } else if (score >= 2 && score <= 4) {
      alertLevel = 'naranja';
      recommendation = "Puntuación de ALERTA (2-4). Evaluar signos vitales cada 30-60 minutos. Notificar al médico especialista / gineco-obstetra. Identificar causa y preparar posible activación de clave.";
    } else if (score >= 5) {
      alertLevel = 'rojo';
      recommendation = "Puntuación de EMERGENCIA (≥ 5). Notificación inmediata, activar equipo de respuesta rápida obstétrica y activar la CLAVE correspondiente.";
    }

    // Orientación de Claves Obstétricas CACES
    const keysInfo = {
      roja: {
        nombre: "CLAVE ROJA (Hemorragia Posparto / Atonía Uterina)",
        conducta: "1) Masaje uterino bimanual continuo. 2) Oxitocina 20-40 UI en 1000ml cristaloides a 125 ml/h. 3) Ácido Tranexámico 1g IV en 10 min. 4) Dos vías periféricas 16G/18G + Sonda Foley para cuantificar diuresis (meta > 30 ml/h)."
      },
      azul: {
        nombre: "CLAVE AZUL (Preeclampsia Severa / Eclampsia)",
        conducta: "1) Sulfato de Magnesio (Zuspan): Impregnación 4g IV en 20 min + Mantenimiento 1g/h por 24h. 2) Antihipertensivo si PA ≥ 160/110: Nifedipino 10mg VO o Hidralazina 5mg IV. 3) Tener listo Gluconato de Calcio al 10% (antídoto)."
      },
      amarilla: {
        nombre: "CLAVE AMARILLA (Sepsis Obstétrica)",
        conducta: "1) Tomar 2 pares de hemocultivos antes de antibióticos. 2) Antibioticoterapia empírica amplia en la 1ra hora (Ceftriaxona 1g IV c/12h + Metronidazol 500mg IV c/8h o Ampicilina/Sulbactam). 3) Cargas de cristaloides 30 ml/kg si PAM < 65 mmHg."
      }
    };

    return {
      score,
      details,
      alertLevel,
      recommendation,
      keysInfo
    };
  }

  /**
   * 2. REGLA DE NAEGELE Y WAHL (Fecha Probable de Parto & Edad Gestacional)
   */
  static calculateFPP(furDateString) {
    if (!furDateString) return null;
    const fur = new Date(furDateString);
    if (isNaN(fur.getTime())) return null;

    // Regla de Naegele: FUR + 7 días - 3 meses + 1 año
    const fppNaegele = new Date(fur);
    fppNaegele.setDate(fppNaegele.getDate() + 7);
    fppNaegele.setMonth(fppNaegele.getMonth() - 3);
    fppNaegele.setFullYear(fppNaegele.getFullYear() + 1);

    // Regla de Wahl: FUR + 10 días - 3 meses + 1 año
    const fppWahl = new Date(fur);
    fppWahl.setDate(fppWahl.getDate() + 10);
    fppWahl.setMonth(fppWahl.getMonth() - 3);
    fppWahl.setFullYear(fppWahl.getFullYear() + 1);

    // Semanas de gestación actuales
    const today = new Date();
    const diffTime = today - fur;
    const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(totalDays / 7);
    const remainingDays = totalDays % 7;

    return {
      fppNaegele: fppNaegele.toISOString().split('T')[0],
      fppWahl: fppWahl.toISOString().split('T')[0],
      gestationalAge: `${weeks} semanas y ${remainingDays} días`,
      totalWeeks: weeks
    };
  }

  /**
   * 3. AIEPI DESHIDRATACIÓN INFANTIL (MSP Ecuador)
   */
  static classifyAIEPIDehydration({ estado, ojos, sed, pliegue, pesoKg }) {
    // estado: 'alerta' | 'irritable' | 'letargico'
    // ojos: 'normales' | 'hundidos'
    // sed: 'normal' | 'avidez' | 'incapaz'
    // pliegue: 'inmediato' | 'lento' | 'muy_lento'

    let graveCount = 0;
    let algunCount = 0;

    if (estado === 'letargico') graveCount++;
    if (ojos === 'hundidos') { graveCount++; algunCount++; }
    if (sed === 'incapaz') graveCount++;
    if (pliegue === 'muy_lento') graveCount++;

    if (estado === 'irritable') algunCount++;
    if (sed === 'avidez') algunCount++;
    if (pliegue === 'lento') algunCount++;

    const peso = Number(pesoKg) || 10;

    if (graveCount >= 2 || (estado === 'letargico' && (sed === 'incapaz' || pliegue === 'muy_lento'))) {
      return {
        clasificacion: "DESHIDRATACIÓN GRAVE (Con Shock)",
        plan: "PLAN C (Hospitalario / Urgencias)",
        color: "rose",
        conducta: `Lactato Ringer o Solución Salina al 0.9% IV a 100 ml/kg (Total: ${(peso * 100).toFixed(0)} ml).\n` +
          `• Primera hora: 30 ml/kg (${(peso * 30).toFixed(0)} ml en 30-60 min).\n` +
          `• Siguientes horas: 70 ml/kg (${(peso * 70).toFixed(0)} ml en 2.5 a 5 horas).\n` +
          `• Evaluar cada 15-30 minutos pulso, llenado capilar y estado de alerta.`
      };
    } else if (algunCount >= 2) {
      return {
        clasificacion: "ALGÚN GRADO DE DESHIDRATACIÓN",
        plan: "PLAN B (Supervisado en Centro de Salud)",
        color: "amber",
        conducta: `Sales de Rehidratación Oral (SRO) a dosis de 50 a 100 ml/kg durante 4 horas.\n` +
          `• Volumen total calculado: ${(peso * 50).toFixed(0)} a ${(peso * 100).toFixed(0)} ml en 4 horas.\n` +
          `• Administrar a cucharaditas o jeringa de forma continua.\n` +
          `• Si vomita, esperar 10 minutos y reiniciar más lento.\n` +
          `• Reevaluar a las 4 horas: si resuelve, pasar a Plan A.`
      };
    } else {
      return {
        clasificacion: "NO TIENE DESHIDRATACIÓN",
        plan: "PLAN A (Ambulatorio en el Hogar)",
        color: "emerald",
        conducta: `Regla de las 4 A: 1) Aumentar líquidos caseros o SRO tras cada deposición líquida (<2 años: 50-100 ml; >2 años: 100-200 ml). 2) Alimentación continua adecuada a la edad (no suspender lactancia). 3) Administración de Sulfato de Zinc (10 mg/día en <6 meses; 20 mg/día en ≥6 meses por 14 días). 4) Alarma: consultar si fiebre alta, vómitos repetidos, sangre en heces o no come.`
      };
    }
  }

  /**
   * 4. ESCALA DE ALVARADO (Apendicitis Aguda)
   */
  static calculateAlvarado({ migratorio, anorexia, nauseas, dolorFID, blumberg, fiebre, leucocitosis, desviacionIzquierda }) {
    let score = 0;
    if (migratorio) score += 1;
    if (anorexia) score += 1;
    if (nauseas) score += 1;
    if (dolorFID) score += 2; // Dolor en cuadrante inferior derecho vale 2
    if (blumberg) score += 1;
    if (fiebre) score += 1; // >= 37.3 °C
    if (leucocitosis) score += 2; // Leucocitosis > 10,000 vale 2
    if (desviacionIzquierda) score += 1; // Neutrófilos > 75%

    let interpretation = "";
    let action = "";
    let badgeColor = "emerald";

    if (score <= 4) {
      interpretation = "Baja probabilidad de apendicitis aguda (0-4 pts).";
      action = "Manejo ambulatorio con pautas de alarma. Reevaluación en 12-24 horas si persisten los síntomas.";
      badgeColor = "emerald";
    } else if (score >= 5 && score <= 6) {
      interpretation = "Consistente con sospecha intermedia de apendicitis (5-6 pts).";
      action = "Observación clínica hospitalaria e imagen complementaria (Ecografía abdominal en niños/mujeres en edad fértil o TAC abdominal contrastada).";
      badgeColor = "amber";
    } else {
      interpretation = "Alta probabilidad de apendicitis aguda (7-10 pts).";
      action = "Valoración quirúrgica urgente y apendicectomía (laparoscópica de elección). No retrasar cirugía para estudios innecesarios si el cuadro es típico.";
      badgeColor = "rose";
    }

    return { score, interpretation, action, badgeColor };
  }

  /**
   * 5. CRITERIOS CURB-65 / CRB-65 (Neumonía Adquirida en la Comunidad - MSP)
   */
  static calculateCURB65({ confusion, ureaBUN, frElevada, presionBaja, edad65 }) {
    let score = 0;
    if (confusion) score += 1; // Test mental abreviado ≤ 8 o desorientación
    if (ureaBUN) score += 1; // BUN > 19 mg/dL o Urea > 7 mmol/L
    if (frElevada) score += 1; // FR ≥ 30 rpm
    if (presionBaja) score += 1; // PAS < 90 mmHg o PAD ≤ 60 mmHg
    if (edad65) score += 1; // Edad ≥ 65 años

    let riesgo = "";
    let lugarManejo = "";
    let esquemaTerapeutico = "";
    let badgeColor = "emerald";

    if (score <= 1) {
      riesgo = `Bajo riesgo (Mortalidad < 1.5% - Score ${score})`;
      lugarManejo = "Tratamiento Ambulatorio.";
      esquemaTerapeutico = "Amoxicilina 1g VO cada 8 horas o Azitromicina 500mg VO cada 24 horas por 5 días (Norma MSP).";
      badgeColor = "emerald";
    } else if (score === 2) {
      riesgo = `Riesgo Intermedio (Mortalidad ~ 9% - Score ${score})`;
      lugarManejo = "Considerar Hospitalización en sala general / Observación.";
      esquemaTerapeutico = "Amoxicilina/Ácido Clavulánico 1g/200mg IV c/8h o Ceftriaxona 1-2g IV c/24h + Macrólido (Claritromicina 500mg c/12h).";
      badgeColor = "amber";
    } else {
      riesgo = `Alto Riesgo (Mortalidad > 22% - Score ${score})`;
      lugarManejo = "Hospitalización inmediata. Evaluar criterios de ingreso en UCI si score ≥ 3 o choque séptico.";
      esquemaTerapeutico = "Betalactámico IV de amplio espectro (Ceftriaxona 2g IV o Ampicilina/Sulbactam) + Macrólido IV o Levofloxacino 750mg IV.";
      badgeColor = "rose";
    }

    return { score, riesgo, lugarManejo, esquemaTerapeutico, badgeColor };
  }
}

/**
 * MOTOR VISUAL "GUARDIA ARCADE" - EL HPTA CACES
 * 4 Videojuegos Clínicos Interactivos en Tiempo Real (Canvas 60FPS + Web Audio API)
 * Interfaz 100% basada en Vectores Minimalistas SVG (Cero Emojis).
 */

import { Storage } from './storage.js';

const SVG_ICONS = {
  bolt: `<svg class="w-5 h-5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  pulse: `<svg class="w-5 h-5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  siren: `<svg class="w-5 h-5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  shield: `<svg class="w-5 h-5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  crosshair: `<svg class="w-5 h-5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`,
  award: `<svg class="w-5 h-5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  scalpel: `<svg class="w-4 h-4 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,
  heartFull: `<svg class="w-5 h-5 text-rose-500 inline-block" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  heartEmpty: `<svg class="w-5 h-5 text-slate-600 inline-block opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  userPulse: `<svg class="w-5 h-5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 12h-2l-1.5 4-3-8-1.5 4h-2"/></svg>`,
  refresh: `<svg class="w-4 h-4 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`
};

export class ArcadeManager {
  constructor(formatMarkdownFn) {
    this.formatMd = formatMarkdownFn || ((t) => t);
    this.currentMode = 'blitz';
    this.sfxEnabled = localStorage.getItem('caces_sfx') !== 'off';
    this.audioCtx = null;

    this.xp = parseInt(localStorage.getItem('caces_xp') || '120', 10);
    this.streak = parseInt(localStorage.getItem('caces_streak') || '1', 10);
    this.highScoreBlitz = parseInt(localStorage.getItem('caces_blitz_high') || '0', 10);

    this.blitzInterval = null;
    this.activeRaf = null;
    this.activeTimers = [];
    this.activeKeyHandler = null;

    // =========================================================================
    // DATOS JUEGO 1: RITMOS ECG Y ALGORITMOS ACLS / MSP
    // =========================================================================
    this.ecgScenarios = [
      {
        id: 'fv',
        name: 'Fibrilación Ventricular (FV)',
        waveType: 'vfib',
        fc: '---',
        pa: '0/0',
        spo2: '--',
        pulse: false,
        vignette: 'Varón de 58 años colapsa súbitamente en emergencia. Inconsciente, apneico, sin pulso carotídeo.',
        correctAction: 'SHOCK',
        needsCharge: true,
        pearl: 'En FV y TV sin pulso la prioridad absoluta es la DESFIBRILACIÓN inmediata (200J bifásico) + RCP de alta calidad.'
      },
      {
        id: 'tvsp',
        name: 'Taquicardia Ventricular Sin Pulso (TVSP)',
        waveType: 'vtach',
        fc: '210',
        pa: '0/0',
        spo2: '--',
        pulse: false,
        vignette: 'Paciente posinfarto pierde la conciencia. Monitor muestra complejos QRS anchos y regulares, pero NO tiene pulso.',
        correctAction: 'SHOCK',
        needsCharge: true,
        pearl: 'La TV sin pulso se trata exactamente igual que la FV: Desfibrilación bifásica 200J inmediata sin sincronizar.'
      },
      {
        id: 'asistolia',
        name: 'Asistolia Confirmada',
        waveType: 'asystole',
        fc: '0',
        pa: '0/0',
        spo2: '--',
        pulse: false,
        vignette: 'Paciente en paro cardiorrespiratorio. Línea plana en el monitor tras verificar cables y ganancia.',
        correctAction: 'RCP_EPI',
        needsCharge: false,
        pearl: 'PROHIBIDO DESFIBRILAR LA ASISTOLIA. Es un ritmo NO desfibrilable: se maneja con RCP inmediata + Adrenalina 1 mg IV cada 3-5 min.'
      },
      {
        id: 'aesp',
        name: 'Actividad Eléctrica Sin Pulso (AESP)',
        waveType: 'pea',
        fc: '42',
        pa: '0/0',
        spo2: '--',
        pulse: false,
        vignette: 'Mujer con taponamiento cardíaco. El monitor muestra complejos eléctricos organizados, pero NO se palpa pulso carotídeo.',
        correctAction: 'RCP_EPI',
        needsCharge: false,
        pearl: 'AESP es ritmo NO desfibrilable. Inicia RCP + Adrenalina 1 mg IV de inmediato y busca las 5H y 5T.'
      },
      {
        id: 'tsv_estable',
        name: 'Taquicardia Supraventricular (TSV Estable)',
        waveType: 'svt',
        fc: '188',
        pa: '118/76',
        spo2: '97%',
        pulse: true,
        vignette: 'Joven de 26 años con palpitaciones súbitas. Alerta, bien perfundida, QRS estrecho regular sin ondas P visibles.',
        correctAction: 'ADENOSINA',
        needsCharge: false,
        pearl: 'En TSV regular de complejo estrecho hemodinámicamente ESTABLE: Maniobras vagales (Valsalva modificado) seguidas de Adenosina 6 mg IV en bolo rápido.'
      },
      {
        id: 'tv_inestable',
        name: 'Taquicardia con Pulso INESTABLE',
        waveType: 'vtach',
        fc: '195',
        pa: '68/40',
        spo2: '86%',
        pulse: true,
        vignette: 'Paciente obnubilado, diaforético, con dolor torácico e hipotensión severa. Pulso débil palpable.',
        correctAction: 'CARDIOVERSION',
        needsCharge: false,
        pearl: 'Toda taquicardia CON pulso pero hemodinámicamente INESTABLE (hipotensión, alteración mental, shock) exige Cardioversión Eléctrica Sincronizada.'
      },
      {
        id: 'bav_sintomatico',
        name: 'Bradicardia Inestable / Bloqueo AV',
        waveType: 'brady',
        fc: '34',
        pa: '72/44',
        spo2: '89%',
        pulse: true,
        vignette: 'Adulto mayor ingresa con mareo intenso, presíncope, frialdad distal y frecuencia cardíaca de 34 lpm.',
        correctAction: 'ATROPINA',
        needsCharge: false,
        pearl: 'Primera línea en bradicardia sintomática inestable: Atropina 1 mg IV en bolo (máx 3 mg). Si no responde: Marcapasos transcutáneo.'
      },
      {
        id: 'iam_cest',
        name: 'IAM con Supradesnivel del ST (SCACEST)',
        waveType: 'stemi',
        fc: '98',
        pa: '130/82',
        spo2: '94%',
        pulse: true,
        vignette: 'Dolor torácico opresivo de 40 min irradiado a mandíbula. Supradesnivel convexo del ST > 2 mm en derivaciones precordiales.',
        correctAction: 'REPERFUSION',
        needsCharge: false,
        pearl: 'SCACEST: Carga dual antiagregante + Reperfusión inmediata (ICP primaria en ≤ 120 min o Fibrinólisis IV en ≤ 30 min).'
      }
    ];

    // =========================================================================
    // DATOS JUEGO 2: GUARDIA CAOS (PACIENTES Y KITS MSP)
    // =========================================================================
    this.triageKits = [
      { id: 'CLAVE_AZUL', badge: 'AZUL', name: 'Clave Azul MSP', desc: 'Sulfato Magnesio (Zuspan) + Nifedipino', dotClass: 'bg-sky-500' },
      { id: 'CLAVE_ROJA', badge: 'ROJA', name: 'Clave Roja MSP', desc: 'Oxitocina 20-40 UI + Ác. Tranexámico 1g', dotClass: 'bg-rose-500' },
      { id: 'CLAVE_AMARILLA', badge: 'AMAR', name: 'Clave Amarilla', desc: 'Hemocultivos + ATB 1ra hora + Cristaloides', dotClass: 'bg-amber-400' },
      { id: 'PLAN_C_AIEPI', badge: 'PLAN C', name: 'Plan C AIEPI', desc: 'Lactato Ringer 100 ml/kg IV (30/70)', dotClass: 'bg-emerald-500' },
      { id: 'DENGUE_B2', badge: 'DENGUE', name: 'Protocolo Dengue B2', desc: 'Cristaloides IV 10 ml/kg/h + Control Hto', dotClass: 'bg-teal-400' },
      { id: 'ATROPINA_TOX', badge: 'ANTÍD', name: 'Atropinización IV', desc: 'Atropina 2-4 mg IV + Pralidoxima', dotClass: 'bg-purple-500' }
    ];

    this.triagePatientsPool = [
      {
        name: 'Gestante 35 SG',
        tag: 'OBST',
        symptom: 'PA 172/114 mmHg + Escotomas + Cefalea intensa',
        diagnosis: 'Preeclampsia con Criterios de Gravedad',
        kitId: 'CLAVE_AZUL'
      },
      {
        name: 'Primigesta 38 SG',
        tag: 'CRÍTICO',
        symptom: 'Convulsión tónico-clónica generalizada + PA 165/110',
        diagnosis: 'Eclampsia en Sala de Partos',
        kitId: 'CLAVE_AZUL'
      },
      {
        name: 'Puérpera Inmediata',
        tag: 'CHOQUE',
        symptom: 'Sangrado > 1000 ml + Útero blando supraumbilical + FC 124',
        diagnosis: 'Hemorragia Posparto por Atonía Uterina',
        kitId: 'CLAVE_ROJA'
      },
      {
        name: 'Puérpera 48 Horas',
        tag: 'SEPSIS',
        symptom: 'Temp 39.2°C + Loquios fétidos + PAM 58 mmHg + Confusión',
        diagnosis: 'Sepsis Puerperal / Choque Séptico Obstétrico',
        kitId: 'CLAVE_AMARILLA'
      },
      {
        name: 'Lactante 9 Meses',
        tag: 'PED',
        symptom: 'Letárgico + Ojos muy hundidos + Incapaz de beber + Pliegue > 2s',
        diagnosis: 'Deshidratación Grave con Shock (AIEPI)',
        kitId: 'PLAN_C_AIEPI'
      },
      {
        name: 'Escolar de Manabí',
        tag: 'TROP',
        symptom: 'Día 5 febril + Dolor abdominal continuo intenso + Vómitos + Hto elevado',
        diagnosis: 'Dengue con Signos de Alarma (Grupo B2)',
        kitId: 'DENGUE_B2'
      },
      {
        name: 'Agricultor 42 Años',
        tag: 'TOX',
        symptom: 'Miosis puntiforme + Sialorrea profusa + Broncorrea + Bradicardia',
        diagnosis: 'Síndrome Colinérgico por Organofosforados',
        kitId: 'ATROPINA_TOX'
      }
    ];

    // =========================================================================
    // DATOS JUEGO 3: TOXIN INVADERS (AMENAZAS Y ANTÍDOTOS SIN EMOJIS)
    // =========================================================================
    this.toxinArsenal = [
      { id: 'NAC', toxin: '[TOX] Paracetamol (15g)', antidote: 'N-Acetilcisteína', color: '#10B981' },
      { id: 'GLU_CA', toxin: '[TOX] Sulfato de Magnesio', antidote: 'Gluconato Calcio 10%', color: '#0EA5E9' },
      { id: 'NALOX', toxin: '[TOX] Opioides / Fentanilo', antidote: 'Naloxona IV', color: '#F43F5E' },
      { id: 'ATROP', toxin: '[TOX] Organofosforados', antidote: 'Atropina IV', color: '#A855F7' },
      { id: 'VIT_K', toxin: '[TOX] Warfarina (INR 8)', antidote: 'Vitamina K1 + PFC', color: '#F59E0B' },
      { id: 'PROTA', toxin: '[TOX] Heparina No Fracc.', antidote: 'Sulfato de Protamina', color: '#EC4899' },
      { id: 'FLUMA', toxin: '[TOX] Benzodiacepinas', antidote: 'Flumazenil IV', color: '#6366F1' },
      { id: 'TIAMINA', toxin: '[DEF] Encef. de Wernicke', antidote: 'Tiamina (Vit B1) IV', color: '#14B8A6' }
    ];

    // =========================================================================
    // DATOS JUEGO 4: RADAR SNIPER (TRIADAS Y SIGNOS CLÍNICOS DE ORO)
    // =========================================================================
    this.clinicalTriads = [
      {
        enunciado: 'Paciente politraumatizado con **Hipotensión arterial + Ruidos cardíacos apagados + Ingurgitación yugular**.',
        pregunta: '¿Qué triada presenta y cuál es el diagnóstico inmediato?',
        opciones: [
          { id: 'A', texto: 'Triada de Beck — Taponamiento Cardíaco Agudo' },
          { id: 'B', texto: 'Triada de Cushing — Hipertensión Intracraneal' },
          { id: 'C', texto: 'Triada de Charcot — Colangitis Aguda' },
          { id: 'D', texto: 'Triada de Virchow — Tromboembolia Pulmonar' }
        ],
        correcta: 'A',
        especialidad: 'Cirugía / Trauma',
        subtema: 'Triadas Clásicas'
      },
      {
        enunciado: 'Paciente con traumatismo craneoencefálico grave que desarrolla **Hipertensión arterial + Bradicardia + Respiración irregular (Cheyne-Stokes/Biot)**.',
        pregunta: '¿Cómo se denomina este fenómeno clínico de herniación inminente?',
        opciones: [
          { id: 'A', texto: 'Triada de Cushing (Hipertensión Intracraneal Severa)' },
          { id: 'B', texto: 'Triada de Hakim-Adams (Hidrocefalia Normotensiva)' },
          { id: 'C', texto: 'Péntada de Reynolds' },
          { id: 'D', texto: 'Triada de Whipple' }
        ],
        correcta: 'A',
        especialidad: 'Cirugía / Neuro',
        subtema: 'Neurotrauma'
      },
      {
        enunciado: 'Mujer de 45 años con **Fiebre con escalofríos + Ictericia + Dolor en hipocondrio derecho**, a lo que se suma **Hipotensión y Obnubilación mental**.',
        pregunta: '¿Qué estructura epónima define este cuadro de Colangitis Supurativa Grave?',
        opciones: [
          { id: 'A', texto: 'Péntada de Reynolds' },
          { id: 'B', texto: 'Signo de Murphy vesicular' },
          { id: 'C', texto: 'Ley de Courvoisier-Terrier' },
          { id: 'D', texto: 'Síndrome de Mirizzi Tipo II' }
        ],
        correcta: 'A',
        especialidad: 'Cirugía General',
        subtema: 'Vía Biliar'
      },
      {
        enunciado: 'Recién nacido a las 2 horas de vida con requerimiento de vacunación obligatoria según esquema PAI del MSP Ecuador.',
        pregunta: '¿Qué vacunas deben administrarse antes de las 24 horas de vida?',
        opciones: [
          { id: 'A', texto: 'BCG (Intradérmica) + Hepatitis B pediátrica (Intramuscular)' },
          { id: 'B', texto: 'BCG + Rotavirus + Pentavalente' },
          { id: 'C', texto: 'Solo BCG intradérmica en deltoides derecho' },
          { id: 'D', texto: 'Hepatitis B + IPV (Polio Inactivada)' }
        ],
        correcta: 'A',
        especialidad: 'Pediatría',
        subtema: 'Esquema PAI MSP'
      },
      {
        enunciado: 'Adulto mayor presenta **Demencia progresiva (alteración de memoria) + Apraxia de la marcha (marcha magnética) + Incontinencia urinaria**.',
        pregunta: '¿A qué patología corresponde esta triada clásica de Hakim-Adams?',
        opciones: [
          { id: 'A', texto: 'Hidrocefalia Normotensiva (Comunicante)' },
          { id: 'B', texto: 'Enfermedad de Parkinson Idiopática' },
          { id: 'C', texto: 'Hematoma Subdural Crónico' },
          { id: 'D', texto: 'Encefalopatía de Wernicke-Korsakoff' }
        ],
        correcta: 'A',
        especialidad: 'Medicina Interna',
        subtema: 'Neurología'
      }
    ];
  }

  renderLivesHearts(livesCount, maxLives = 3) {
    const safeLives = Math.max(0, Math.min(maxLives, livesCount));
    let html = '<span class="inline-flex items-center gap-1">';
    for (let i = 0; i < maxLives; i++) {
      html += i < safeLives ? SVG_ICONS.heartFull : SVG_ICONS.heartEmpty;
    }
    html += '</span>';
    return html;
  }

  // =========================================================================
  // MOTOR DE AUDIO SINTETIZADO (EFECTOS ARCADE Y HOSPITALARIOS)
  // =========================================================================
  playTone(type = 'click') {
    if (!this.sfxEnabled) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (type === 'correct') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.07);
        osc.frequency.setValueAtTime(783.99, now + 0.14);
        osc.frequency.setValueAtTime(1046.5, now + 0.21);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.38);
      } else if (type === 'wrong') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(165, now);
        osc.frequency.linearRampToValueAtTime(85, now + 0.3);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (type === 'beep') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(980, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'charge') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(1480, now + 0.55);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.58);
        osc.start(now);
        osc.stop(now + 0.58);
      } else if (type === 'shock') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.25);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'laser') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.16);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
        osc.start(now);
        osc.stop(now + 0.17);
      }
    } catch (e) {}
  }

  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    localStorage.setItem('caces_sfx', this.sfxEnabled ? 'on' : 'off');
    return this.sfxEnabled;
  }

  // =========================================================================
  // SISTEMA DE RANGOS, XP Y CELEBRACIONES MOTIVADORAS (SIN EMOJIS)
  // =========================================================================
  getRankInfo(xp = this.xp) {
    const ranks = [
      { min: 0, title: 'Externo de Guardia', next: 250 },
      { min: 250, title: 'Interno Rotativo', next: 600 },
      { min: 600, title: 'Residente R1 de Choque', next: 1200 },
      { min: 1200, title: 'Jefe de Guardia MSP', next: 2200 },
      { min: 2200, title: 'Leyenda del Hpta CACES', next: 5000 }
    ];
    let current = ranks[0];
    for (const r of ranks) {
      if (xp >= r.min) current = r;
    }
    const progress = Math.min(100, Math.round(((xp - current.min) / (current.next - current.min)) * 100));
    return { ...current, progress };
  }

  addXP(amount, isCorrectStreak = true, triggerToast = true) {
    this.xp += amount;
    if (isCorrectStreak) {
      this.streak += 1;
      if (triggerToast) {
        this.triggerStreakToast(this.streak);
      }
    } else {
      this.streak = 0;
    }

    localStorage.setItem('caces_xp', this.xp.toString());
    localStorage.setItem('caces_streak', this.streak.toString());
    this.updateHUD();
  }

  /**
   * Celebración inmediata cuando el usuario acierta la primera pregunta en Modo Estudio/Tutor
   */
  triggerTutorCelebration() {
    const praises = [
      { title: '¡Qué crack!', msg: 'Diagnóstico certero al primer vistazo (+10 XP).' },
      { title: '¡Qué pro!', msg: 'Lectura clínica impecable según protocolo MSP.' },
      { title: '¡Ojo Clínico!', msg: 'No caíste en el distractor del CACES. ¡Sigue así!' },
      { title: '¡Bisturí de Precisión!', msg: 'Conducta terapéutica de primera línea.' }
    ];
    const pick = praises[Math.floor(Math.random() * praises.length)];
    this.showFloatingStreakNotification(SVG_ICONS.bolt, pick.title, pick.msg, Math.max(1, this.streak));
  }

  triggerStreakToast(streak) {
    if (streak < 2) return;

    let title = "";
    let msg = "";
    let svgIcon = SVG_ICONS.bolt;

    if (streak === 2) {
      svgIcon = SVG_ICONS.pulse;
      title = "¡Calentando Motores!";
      msg = "2 diagnósticos certeros seguidos. ¡Sigue así!";
    } else if (streak === 3) {
      svgIcon = SVG_ICONS.bolt;
      title = "¡Qué pro!";
      msg = "Mano quirúrgica de precisión. Racha de 3 aciertos.";
    } else if (streak === 4) {
      svgIcon = SVG_ICONS.crosshair;
      title = "¡Imparable!";
      msg = "Ese R1 tiembla ante tu agudeza clínica.";
    } else if (streak === 5) {
      svgIcon = SVG_ICONS.award;
      title = "¡Qué crack!";
      msg = "Diagnóstico certero de Jefe de Guardia. Racha de 5.";
    } else if (streak === 6) {
      svgIcon = SVG_ICONS.pulse;
      title = "¡Clínica Impecable!";
      msg = "Dominando las Guías de Práctica Clínica del MSP.";
    } else if (streak === 7) {
      svgIcon = SVG_ICONS.crosshair;
      title = "¡Ojo Clínico de Águila!";
      msg = "Detectando trampas del CACES como un especialista.";
    } else if (streak === 8 || streak === 9) {
      svgIcon = SVG_ICONS.bolt;
      title = "¡Razonamiento Quirúrgico!";
      msg = `${streak} casos consecutivos resueltos sin dudar.`;
    } else if (streak === 10) {
      svgIcon = SVG_ICONS.award;
      title = "¡Nivel Dr. House!";
      msg = "Ni el lupus te engaña. ¡10 aciertos consecutivos!";
    } else if (streak === 12) {
      svgIcon = SVG_ICONS.pulse;
      title = "¡Cerebro Quirúrgico!";
      msg = "100% de apego a las normativas del MSP Ecuador.";
    } else if (streak === 15) {
      svgIcon = SVG_ICONS.award;
      title = "¡Modo Máquina CACES!";
      msg = "El examen EHEP ya está en tu bolsillo. Racha x15.";
    } else if (streak === 20) {
      svgIcon = SVG_ICONS.award;
      title = "¡Puntaje Perfecto Senescyt!";
      msg = "Nivel Catedrático Emérito. ¡20 aciertos sin fallar!";
    } else if (streak > 20 && streak % 5 === 0) {
      svgIcon = SVG_ICONS.award;
      title = "¡Leyenda Médica Nacional!";
      msg = `Superando a la Clínica Mayo con una racha de ${streak} aciertos.`;
    } else {
      const randomTitles = ["¡Qué crack!", "¡Qué pro!", "¡Nivel Dr. House!", "¡Guardia Impecable!"];
      title = `${randomTitles[streak % randomTitles.length]} (Racha x${streak})`;
      msg = "Manteniendo el ritmo de habilitación profesional.";
    }

    if (window.confetti && (streak === 3 || streak % 5 === 0)) {
      window.confetti({
        particleCount: Math.min(80, 30 + streak * 3),
        spread: 60,
        origin: { y: 0.8 }
      });
    }

    this.showFloatingStreakNotification(svgIcon, title, msg, streak);
  }

  showFloatingStreakNotification(svgIcon, title, msg, streak) {
    let container = document.getElementById('streak-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'streak-toast-container';
      container.className = 'fixed top-20 right-4 sm:right-8 z-50 flex flex-col gap-2 pointer-events-none transition-all';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto transform translate-y-2 opacity-0 transition-all duration-300 ease-out flex items-center gap-3.5 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl bg-slate-900/95 text-white border border-emerald-500/70 shadow-2xl shadow-emerald-500/20 backdrop-blur-md max-w-sm';
    toast.innerHTML = `
      <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center shrink-0">
        ${svgIcon}
      </div>
      <div class="space-y-0.5">
        <div class="flex items-center gap-2">
          <span class="font-display font-extrabold text-sm sm:text-base text-emerald-400 tracking-wide">${title}</span>
          <span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold">x${streak}</span>
        </div>
        <p class="text-xs sm:text-sm text-slate-300 leading-snug">${msg}</p>
      </div>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
      toast.classList.add('-translate-y-4', 'opacity-0');
      setTimeout(() => {
        toast.remove();
      }, 350);
    }, 3000);
  }

  saveHighScore(score) {
    if (score > this.highScoreBlitz) {
      this.highScoreBlitz = score;
      localStorage.setItem('caces_blitz_high', score.toString());
      if (window.confetti) window.confetti({ particleCount: 90, spread: 70 });
    }
    this.updateHUD();
  }

  updateHUD() {
    const rank = this.getRankInfo();
    const elStreak = document.getElementById('hud-streak');
    const elRank = document.getElementById('hud-rank-title');
    const elXp = document.getElementById('hud-xp-badge');
    const arcRank = document.getElementById('arcade-rank-badge');
    const arcXpTotal = document.getElementById('arcade-xp-total');
    const arcXpBar = document.getElementById('arcade-xp-bar');
    const arcHigh = document.getElementById('arcade-high-score');

    if (elStreak) elStreak.textContent = this.streak;
    if (elRank) elRank.textContent = rank.title;
    if (elXp) elXp.textContent = `${this.xp} XP`;
    if (arcRank) arcRank.textContent = rank.title;
    if (arcXpTotal) arcXpTotal.textContent = `${this.xp} XP`;
    if (arcXpBar) arcXpBar.style.width = `${rank.progress}%`;
    if (arcHigh) arcHigh.textContent = `${this.highScoreBlitz} pts`;
  }

  stopAllLoops() {
    if (this.blitzInterval) {
      clearInterval(this.blitzInterval);
      this.blitzInterval = null;
    }
    if (this.activeRaf) {
      cancelAnimationFrame(this.activeRaf);
      this.activeRaf = null;
    }
    this.activeTimers.forEach(t => clearInterval(t));
    this.activeTimers = [];
    if (this.activeKeyHandler) {
      window.removeEventListener('keydown', this.activeKeyHandler);
      this.activeKeyHandler = null;
    }
  }

  isArcadeVisible() {
    const tab = document.getElementById('tab-arcade');
    return tab && !tab.classList.contains('hidden');
  }

  // =========================================================================
  // INICIALIZACIÓN DEL HUB ARCADE (4 JUEGOS CON VECTORES MINIMALISTAS)
  // =========================================================================
  async initArcade(questionsPool = []) {
    this.questionsPool = questionsPool;
    this.stopAllLoops();
    this.updateHUD();
    this.upgradeModeSelectorCards();
    this.renderMode(this.currentMode);
  }

  upgradeModeSelectorCards() {
    const firstBtn = document.querySelector('.arcade-mode-btn');
    const gridContainer = firstBtn ? firstBtn.parentElement : null;
    if (!gridContainer) return;

    gridContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4';

    const modes = [
      {
        id: 'blitz',
        svg: SVG_ICONS.pulse,
        iconBg: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
        tag: 'Osciloscopio 60 FPS',
        tagColor: 'bg-emerald-500/15 text-emerald-500',
        title: '1. Cardio-Shock ECG',
        desc: 'Lee trazados ECG reales en vivo, carga el desfibrilador a 200J o administra el fármaco exacto antes del paro.'
      },
      {
        id: 'uci',
        svg: SVG_ICONS.siren,
        iconBg: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
        tag: 'Multitarea en Vivo',
        tagColor: 'bg-rose-500/15 text-rose-500',
        title: '2. Guardia Caos (ER)',
        desc: '4 camillas críticas drenándose en tiempo real. Equipa las Claves Obstétricas y Kits MSP antes del colapso.'
      },
      {
        id: 'match',
        svg: SVG_ICONS.shield,
        iconBg: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
        tag: 'Arcade Shooter',
        tagColor: 'bg-sky-500/15 text-sky-500',
        title: '3. Toxin Invaders',
        desc: 'Destruye sobredosis y toxinas que caen hacia la barrera hematoencefálica disparando su antídoto específico.'
      },
      {
        id: 'sniper',
        svg: SVG_ICONS.crosshair,
        iconBg: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
        tag: 'Bisturí 50/50',
        tagColor: 'bg-amber-500/15 text-amber-500',
        title: '4. Radar Sniper',
        desc: 'Caza triadas patognomónicas y casos relámpago de tu banco usando el bisturí quirúrgico para cortar distractores.'
      }
    ];

    gridContainer.innerHTML = modes.map(m => {
      const isActive = this.currentMode === m.id;
      return `
        <button type="button" data-game-mode="${m.id}" class="arcade-mode-btn bto-card text-left p-5 rounded-3xl bg-white dark:bg-bto-panel transition-all flex flex-col justify-between space-y-3 ${
          isActive ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/20' : 'hover:border-slate-400 dark:hover:border-slate-600'
        }">
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="w-10 h-10 rounded-xl border flex items-center justify-center ${m.iconBg}">${m.svg}</span>
              <span class="font-mono text-xs font-bold uppercase px-2.5 py-1 rounded-lg ${m.tagColor}">${m.tag}</span>
            </div>
            <h3 class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white">${m.title}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">${m.desc}</p>
          </div>
          <div class="pt-2 flex items-center justify-between text-xs font-mono font-bold ${isActive ? 'text-emerald-500' : 'text-slate-400'}">
            <span>${isActive ? 'CABINA ACTIVA' : 'SELECCIONAR JUEGO'}</span>
            <span>→</span>
          </div>
        </button>
      `;
    }).join('');

    gridContainer.querySelectorAll('.arcade-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const chosen = e.currentTarget.getAttribute('data-game-mode');
        this.playTone('beep');
        this.currentMode = chosen;
        this.stopAllLoops();
        this.upgradeModeSelectorCards();
        this.renderMode(chosen);
      });
    });
  }

  renderMode(mode) {
    this.stopAllLoops();
    if (mode === 'blitz') this.renderCardioShockIntro();
    else if (mode === 'uci') this.renderERRushIntro();
    else if (mode === 'match') this.renderToxinInvadersIntro();
    else if (mode === 'sniper') this.renderSniperIntro();
  }

  // =========================================================================
  // JUEGO 1: CARDIO-SHOCK (OSCILOSCOPIO ECG EN VIVO + DESFIBRILADOR)
  // =========================================================================
  renderCardioShockIntro() {
    const stage = document.getElementById('arcade-stage');
    if (!stage) return;

    stage.innerHTML = `
      <div class="my-auto text-center max-w-2xl mx-auto space-y-6 py-8">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
          ${SVG_ICONS.pulse}
        </div>
        <div class="space-y-2">
          <span class="font-mono text-xs uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-500 font-bold">Simulador de Reanimación ACLS / MSP</span>
          <h3 class="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">Cardio-Shock: Monitor ECG en Vivo</h3>
        </div>
        <p class="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          Analiza la onda electrocardiográfica en movimiento y verifica si el paciente tiene pulso. Si es un ritmo desfibrilable (<b>FV o TV sin pulso</b>), primero presiona <b>CARGAR 200J</b> y luego <b>DESCARGAR SHOCK</b>. Si desfibrilas una Asistolia o una AESP perderás una vida.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left text-sm font-mono bg-slate-100 dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div><b class="text-emerald-500">Tecla [C] + [ESPACIO]:</b> Cargar 200J y Desfibrilar</div>
          <div><b class="text-sky-400">Teclas [1 - 5]:</b> Fármacos y Maniobras ACLS</div>
          <div><b class="text-rose-400">3 Vidas Clínicas:</b> 12 seg de perfusión por caso</div>
        </div>
        <button id="btn-start-cardioshock" class="bto-btn px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-display font-bold text-lg tracking-wide shadow-lg shadow-emerald-500/25 border-transparent">
          Encender Monitor y Desfibrilador →
        </button>
      </div>
    `;

    document.getElementById('btn-start-cardioshock')?.addEventListener('click', () => {
      this.playTone('beep');
      this.startCardioShockGame();
    });
  }

  startCardioShockGame() {
    this.stopAllLoops();
    const stage = document.getElementById('arcade-stage');
    if (!stage) return;

    let score = 0;
    let lives = 3;
    let combo = 1;
    let isCharged = false;
    let isConverting = false;
    let timeRemaining = 100;
    let currentCase = this.ecgScenarios[Math.floor(Math.random() * this.ecgScenarios.length)];

    stage.innerHTML = `
      <div class="space-y-5 select-none">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-3 font-mono">
            <span id="cs-lives" class="inline-flex items-center gap-1">${this.renderLivesHearts(3)}</span>
            <span id="cs-combo" class="px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-500 text-sm font-bold border border-emerald-500/30">COMBO x1</span>
          </div>
          <div class="flex items-center gap-4 font-mono">
            <span class="text-base sm:text-lg font-bold">SCORE: <b id="cs-score" class="text-emerald-500 text-xl">0</b></span>
            <button id="cs-exit" class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">Salir</button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-950 p-4 sm:p-5 rounded-3xl border-2 border-slate-800 shadow-2xl relative overflow-hidden">
          <div class="lg:col-span-9 flex flex-col justify-between space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 font-mono text-xs sm:text-sm">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span class="text-emerald-400 font-bold">DERIVACIÓN II (25 mm/s)</span>
              </div>
              <span id="cs-pulse-badge" class="px-3 py-1 rounded-lg font-bold text-xs sm:text-sm">PULSO: VERIFICANDO</span>
            </div>

            <div class="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden bg-[#04080E] border border-slate-800/90">
              <canvas id="ecg-canvas" class="w-full h-full block"></canvas>
              <div id="cs-feedback-overlay" class="hidden absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-2">
                <div id="cs-feedback-title" class="font-display font-extrabold text-xl sm:text-2xl"></div>
                <p id="cs-feedback-pearl" class="text-sm sm:text-base text-slate-200 max-w-xl"></p>
              </div>
            </div>

            <div class="space-y-1">
              <div class="flex justify-between font-mono text-xs text-slate-400">
                <span>PERFUSIÓN CEREBRAL / TIEMPO LÍMITE</span>
                <span id="cs-timer-label" class="text-emerald-400 font-bold">100%</span>
              </div>
              <div class="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                <div id="cs-perfusion-bar" class="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full transition-all duration-100" style="width: 100%"></div>
              </div>
            </div>
          </div>

          <div class="lg:col-span-3 grid grid-cols-3 lg:grid-cols-1 gap-3 font-mono">
            <div class="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-between">
              <span class="text-xs text-emerald-400 uppercase">ECG // FC (lpm)</span>
              <span id="cs-fc" class="text-2xl sm:text-3xl font-black text-emerald-400">---</span>
            </div>
            <div class="p-3.5 rounded-2xl bg-slate-900/90 border border-rose-500/30 flex flex-col justify-between">
              <span class="text-xs text-rose-400 uppercase">PA (mmHg)</span>
              <span id="cs-pa" class="text-2xl sm:text-3xl font-black text-rose-400">0/0</span>
            </div>
            <div class="p-3.5 rounded-2xl bg-slate-900/90 border border-sky-500/30 flex flex-col justify-between">
              <span class="text-xs text-sky-400 uppercase">SpO2 (%)</span>
              <span id="cs-spo2" class="text-2xl sm:text-3xl font-black text-sky-400">--</span>
            </div>
          </div>
        </div>

        <div class="p-4 sm:p-5 rounded-2xl bg-slate-100 dark:bg-slate-900 border-l-4 border-emerald-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <span class="font-mono text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Cuadro Clínico en Box de Choque:</span>
            <p id="cs-vignette" class="text-base sm:text-lg font-semibold text-slate-900 dark:text-white"></p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div class="lg:col-span-5 p-5 rounded-3xl bg-slate-900 text-white border border-slate-800 flex flex-col justify-between space-y-4">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">${SVG_ICONS.bolt} Desfibrilador Bifásico</span>
              <span id="cs-charge-status" class="font-mono text-xs px-2.5 py-0.5 rounded bg-slate-800 text-slate-400">DESCARGADO</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button id="btn-cs-charge" type="button" class="py-4 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-base transition-all flex flex-col items-center justify-center gap-1">
                <span>1. CARGAR 200J</span>
                <span class="font-mono text-xs opacity-80">[Tecla C]</span>
              </button>
              <button id="btn-cs-shock" type="button" class="py-4 px-4 rounded-2xl bg-slate-800 text-slate-500 border border-slate-700 font-display font-extrabold text-base transition-all flex flex-col items-center justify-center gap-1">
                <span>2. SHOCK!</span>
                <span class="font-mono text-xs opacity-80">[ESPACIO]</span>
              </button>
            </div>
          </div>

          <div class="lg:col-span-7 p-5 rounded-3xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3">
            <span class="font-mono text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">Intervenciones y Fármacos del Carro de Paro:</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button type="button" data-cs-act="RCP_EPI" class="cs-act-btn bto-btn p-3.5 rounded-2xl bg-white dark:bg-slate-800 text-left flex items-center gap-3">
                <span class="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 font-mono font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <div class="font-bold text-sm sm:text-base text-slate-900 dark:text-white">RCP + Adrenalina 1 mg IV</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">Ritmos NO desfibrilables (Asistolia / AESP)</div>
                </div>
              </button>

              <button type="button" data-cs-act="ADENOSINA" class="cs-act-btn bto-btn p-3.5 rounded-2xl bg-white dark:bg-slate-800 text-left flex items-center gap-3">
                <span class="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-500 font-mono font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <div class="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Valsalva + Adenosina 6 mg IV</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">TSV regular QRS estrecho estable</div>
                </div>
              </button>

              <button type="button" data-cs-act="CARDIOVERSION" class="cs-act-btn bto-btn p-3.5 rounded-2xl bg-white dark:bg-slate-800 text-left flex items-center gap-3">
                <span class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 font-mono font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <div class="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Cardioversión Sincronizada</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">Taquicardia CON pulso pero INESTABLE</div>
                </div>
              </button>

              <button type="button" data-cs-act="ATROPINA" class="cs-act-btn bto-btn p-3.5 rounded-2xl bg-white dark:bg-slate-800 text-left flex items-center gap-3">
                <span class="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-500 font-mono font-bold flex items-center justify-center shrink-0">4</span>
                <div>
                  <div class="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Atropina 1 mg IV / Marcapasos</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">Bradicardia sintomática / Bloqueo AV</div>
                </div>
              </button>

              <button type="button" data-cs-act="REPERFUSION" class="cs-act-btn bto-btn p-3.5 rounded-2xl bg-white dark:bg-slate-800 text-left flex items-center gap-3 sm:col-span-2">
                <span class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 font-mono font-bold flex items-center justify-center shrink-0">5</span>
                <div>
                  <div class="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Reperfusión Coronaria (ICP ≤120m / Fibrinólisis ≤30m)</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">Infarto Agudo de Miocardio con Supradesnivel del ST (SCACEST)</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const canvas = document.getElementById('ecg-canvas');
    const ctx = canvas.getContext('2d');
    let phase = 0;

    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = canvas.clientWidth || 640;
      canvas.height = canvas.clientHeight || 200;
    };
    resizeCanvas();

    const updatePatientUI = () => {
      isCharged = false;
      timeRemaining = 100;
      const shockBtn = document.getElementById('btn-cs-shock');
      const chargeStatus = document.getElementById('cs-charge-status');
      if (shockBtn) {
        shockBtn.className = 'py-4 px-4 rounded-2xl bg-slate-800 text-slate-500 border border-slate-700 font-display font-extrabold text-base transition-all flex flex-col items-center justify-center gap-1';
      }
      if (chargeStatus) {
        chargeStatus.textContent = 'DESCARGADO';
        chargeStatus.className = 'font-mono text-xs px-2.5 py-0.5 rounded bg-slate-800 text-slate-400';
      }

      document.getElementById('cs-fc').textContent = isConverting ? '76' : currentCase.fc;
      document.getElementById('cs-pa').textContent = isConverting ? '120/78' : currentCase.pa;
      document.getElementById('cs-spo2').textContent = isConverting ? '98%' : currentCase.spo2;
      document.getElementById('cs-vignette').textContent = currentCase.vignette;

      const pulseBadge = document.getElementById('cs-pulse-badge');
      if (pulseBadge) {
        if (currentCase.pulse || isConverting) {
          pulseBadge.textContent = 'PULSO CAROTÍDEO: PRESENTE';
          pulseBadge.className = 'px-3 py-1 rounded-lg font-bold text-xs sm:text-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
        } else {
          pulseBadge.textContent = 'PULSO CAROTÍDEO: AUSENTE (PARO)';
          pulseBadge.className = 'px-3 py-1 rounded-lg font-bold text-xs sm:text-sm bg-rose-500/25 text-rose-400 border border-rose-500/40 animate-pulse';
        }
      }
    };

    const getECGY = (xPos, waveType, midY) => {
      const t = (xPos + phase);
      if (waveType === 'sinus' || isConverting) {
        const c = t % 110;
        if (c > 18 && c < 28) return midY - Math.sin(((c - 18) / 10) * Math.PI) * 9;
        if (c >= 34 && c < 37) return midY + 8;
        if (c >= 37 && c < 42) return midY - 62;
        if (c >= 42 && c < 46) return midY + 18;
        if (c > 58 && c < 76) return midY - Math.sin(((c - 58) / 18) * Math.PI) * 14;
        return midY;
      }
      if (waveType === 'vfib') {
        return midY + Math.sin(t * 0.19) * 26 + Math.cos(t * 0.31) * 20 + Math.sin(t * 0.08) * 15;
      }
      if (waveType === 'vtach') {
        const c = t % 44;
        return midY + Math.sin((c / 44) * Math.PI * 2) * 52 + Math.cos((c / 22) * Math.PI) * 14;
      }
      if (waveType === 'asystole') {
        return midY + Math.sin(t * 0.03) * 2.5 + (Math.random() - 0.5) * 2;
      }
      if (waveType === 'pea') {
        const c = t % 165;
        if (c >= 40 && c < 46) return midY - 40;
        if (c >= 46 && c < 52) return midY + 14;
        if (c > 68 && c < 90) return midY - Math.sin(((c - 68) / 22) * Math.PI) * 10;
        return midY;
      }
      if (waveType === 'svt') {
        const c = t % 42;
        if (c >= 18 && c < 21) return midY - 58;
        if (c >= 21 && c < 24) return midY + 14;
        if (c > 26 && c < 35) return midY - Math.sin(((c - 26) / 9) * Math.PI) * 11;
        return midY;
      }
      if (waveType === 'brady') {
        const c = t % 210;
        if (c > 25 && c < 35) return midY - Math.sin(((c - 25) / 10) * Math.PI) * 8;
        if (c >= 45 && c < 50) return midY - 56;
        if (c >= 50 && c < 55) return midY + 15;
        if (c > 75 && c < 98) return midY - Math.sin(((c - 75) / 23) * Math.PI) * 13;
        return midY;
      }
      if (waveType === 'stemi') {
        const c = t % 105;
        if (c > 15 && c < 24) return midY - Math.sin(((c - 15) / 9) * Math.PI) * 8;
        if (c >= 30 && c < 35) return midY - 60;
        if (c >= 35 && c < 72) {
          return midY - 28 - Math.sin(((c - 35) / 37) * Math.PI) * 16;
        }
        return midY;
      }
      return midY;
    };

    const drawLoop = () => {
      if (!this.isArcadeVisible()) {
        this.stopAllLoops();
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const midY = h * 0.55;

      ctx.fillStyle = '#04080E';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      const activeWave = isConverting ? 'sinus' : currentCase.waveType;
      ctx.strokeStyle = isConverting ? '#34D399' : (currentCase.pulse ? '#38BDF8' : '#F43F5E');
      ctx.lineWidth = 3;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();

      for (let x = 0; x < w - 16; x += 2) {
        const y = getECGY(x, activeWave, midY);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const tipX = w - 18;
      const tipY = getECGY(tipX, activeWave, midY);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      phase += 3.2;
      this.activeRaf = requestAnimationFrame(drawLoop);
    };

    const triggerResolution = (isSuccess, customErrorMsg = '') => {
      if (isConverting) return;
      const overlay = document.getElementById('cs-feedback-overlay');
      const titleEl = document.getElementById('cs-feedback-title');
      const pearlEl = document.getElementById('cs-feedback-pearl');

      if (isSuccess) {
        isConverting = true;
        this.playTone(currentCase.correctAction === 'SHOCK' ? 'shock' : 'correct');
        const pts = 150 * combo;
        score += pts;
        combo = Math.min(6, combo + 1);
        this.addXP(25, true);

        document.getElementById('cs-score').textContent = score;
        document.getElementById('cs-combo').textContent = `COMBO x${combo}`;
        updatePatientUI();

        if (overlay && titleEl && pearlEl) {
          overlay.classList.remove('hidden');
          titleEl.className = 'font-display font-extrabold text-xl sm:text-2xl text-emerald-400';
          titleEl.textContent = `¡${currentCase.name} Revertida! (+${pts} PTS)`;
          pearlEl.textContent = currentCase.pearl;
        }

        setTimeout(() => {
          if (!this.isArcadeVisible()) return;
          overlay?.classList.add('hidden');
          isConverting = false;
          currentCase = this.ecgScenarios[Math.floor(Math.random() * this.ecgScenarios.length)];
          updatePatientUI();
        }, 2100);
      } else {
        this.playTone('wrong');
        lives--;
        combo = 1;
        document.getElementById('cs-combo').textContent = `COMBO x1`;
        const livesEl = document.getElementById('cs-lives');
        if (livesEl) livesEl.innerHTML = this.renderLivesHearts(lives);
        stage.classList.add('shake-error');
        setTimeout(() => stage.classList.remove('shake-error'), 350);

        if (lives <= 0) {
          this.saveHighScore(score);
          this.stopAllLoops();
          this.renderGameOverScreen('Cardio-Shock ECG', score, () => this.startCardioShockGame());
          return;
        }

        isConverting = true;
        if (overlay && titleEl && pearlEl) {
          overlay.classList.remove('hidden');
          titleEl.className = 'font-display font-extrabold text-xl sm:text-2xl text-rose-400';
          titleEl.textContent = customErrorMsg || `Conducta Incorrecta en ${currentCase.name}`;
          pearlEl.textContent = currentCase.pearl;
        }

        setTimeout(() => {
          if (!this.isArcadeVisible()) return;
          overlay?.classList.add('hidden');
          isConverting = false;
          currentCase = this.ecgScenarios[Math.floor(Math.random() * this.ecgScenarios.length)];
          updatePatientUI();
        }, 2400);
      }
    };

    const handleCharge = () => {
      if (isConverting || isCharged) return;
      isCharged = true;
      this.playTone('charge');
      const shockBtn = document.getElementById('btn-cs-shock');
      const chargeStatus = document.getElementById('cs-charge-status');
      if (chargeStatus) {
        chargeStatus.textContent = '200J LISTOS';
        chargeStatus.className = 'font-mono text-xs px-2.5 py-0.5 rounded bg-rose-500 text-white font-bold animate-pulse';
      }
      if (shockBtn) {
        shockBtn.className = 'py-4 px-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-display font-extrabold text-base shadow-lg shadow-rose-500/40 animate-bounce transition-all flex flex-col items-center justify-center gap-1';
      }
    };

    const handleShock = () => {
      if (isConverting) return;
      if (!isCharged) {
        this.playTone('wrong');
        const chargeStatus = document.getElementById('cs-charge-status');
        if (chargeStatus) chargeStatus.textContent = 'CARGA 200J PRIMERO';
        return;
      }
      if (currentCase.correctAction === 'SHOCK') {
        triggerResolution(true);
      } else {
        triggerResolution(false, `ERROR LETAL: Desfibrilaste ${currentCase.name}`);
      }
    };

    document.getElementById('btn-cs-charge')?.addEventListener('click', handleCharge);
    document.getElementById('btn-cs-shock')?.addEventListener('click', handleShock);
    document.getElementById('cs-exit')?.addEventListener('click', () => this.renderCardioShockIntro());

    document.querySelectorAll('.cs-act-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (isConverting) return;
        const act = e.currentTarget.getAttribute('data-cs-act');
        if (act === currentCase.correctAction) {
          triggerResolution(true);
        } else {
          triggerResolution(false);
        }
      });
    });

    this.activeKeyHandler = (e) => {
      if (!this.isArcadeVisible() || isConverting) return;
      const k = e.key.toUpperCase();
      if (k === 'C') handleCharge();
      else if (e.key === ' ') {
        e.preventDefault();
        handleShock();
      } else if (['1', '2', '3', '4', '5'].includes(k)) {
        const actions = ['RCP_EPI', 'ADENOSINA', 'CARDIOVERSION', 'ATROPINA', 'REPERFUSION'];
        const chosen = actions[parseInt(k, 10) - 1];
        if (chosen === currentCase.correctAction) triggerResolution(true);
        else triggerResolution(false);
      }
    };
    window.addEventListener('keydown', this.activeKeyHandler);

    const perfInterval = setInterval(() => {
      if (!this.isArcadeVisible()) {
        this.stopAllLoops();
        return;
      }
      if (isConverting) return;

      timeRemaining = Math.max(0, timeRemaining - 1.4);
      const bar = document.getElementById('cs-perfusion-bar');
      const lbl = document.getElementById('cs-timer-label');
      if (bar) bar.style.width = `${timeRemaining}%`;
      if (lbl) lbl.textContent = `${Math.ceil(timeRemaining)}%`;

      if (timeRemaining <= 0) {
        triggerResolution(false, `Hipoxia Cerebral: Tiempo agotado en ${currentCase.name}`);
      }
    }, 150);
    this.activeTimers.push(perfInterval);

    updatePatientUI();
    this.activeRaf = requestAnimationFrame(drawLoop);
  }

  // =========================================================================
  // JUEGO 2: GUARDIA CAOS (SIMULADOR MULTITAREA 4 CAMILLAS)
  // =========================================================================
  renderERRushIntro() {
    const stage = document.getElementById('arcade-stage');
    if (!stage) return;

    stage.innerHTML = `
      <div class="my-auto text-center max-w-2xl mx-auto space-y-6 py-8">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/10">
          ${SVG_ICONS.siren}
        </div>
        <div class="space-y-2">
          <span class="font-mono text-xs uppercase tracking-widest px-3 py-1 rounded-full bg-rose-500/15 text-rose-500 font-bold">Simulador Multitarea de Emergencia</span>
          <h3 class="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">Guardia Caos: 4 Boxes en Simultáneo</h3>
        </div>
        <p class="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          Los pacientes ingresan sin parar a los <b>4 Boxes de Choque</b> y se descompensan en tiempo real. Selecciona el <b>Kit Terapéutico del MSP</b> en la bandeja inferior (o presiona las teclas <kbd class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-sm">1-6</kbd>) y haz clic sobre la camilla correspondiente para salvarlos.
        </p>
        <button id="btn-start-errush" class="bto-btn px-10 py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-display font-bold text-lg tracking-wide shadow-lg shadow-rose-500/25 border-transparent">
          Recibir Turno de Guardia →
        </button>
      </div>
    `;

    document.getElementById('btn-start-errush')?.addEventListener('click', () => {
      this.playTone('beep');
      this.startERRushGame();
    });
  }

  startERRushGame() {
    this.stopAllLoops();
    const stage = document.getElementById('arcade-stage');
    if (!stage) return;

    let score = 0;
    let savedCount = 0;
    let lives = 3;
    let selectedKitId = this.triageKits[0].id;
    let beds = [null, null, null, null];

    const spawnPatientInBed = (bedIdx) => {
      const template = this.triagePatientsPool[Math.floor(Math.random() * this.triagePatientsPool.length)];
      beds[bedIdx] = {
        ...template,
        hp: 100,
        decayRate: 1.15 + Math.min(1.4, savedCount * 0.08),
        status: 'active'
      };
    };

    spawnPatientInBed(0);
    spawnPatientInBed(1);

    stage.innerHTML = `
      <div class="space-y-6 select-none">
        <div class="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-4 font-mono">
            <span id="er-lives" class="inline-flex items-center gap-1">${this.renderLivesHearts(3)}</span>
            <span class="px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-500 text-sm font-bold">SALVADOS: <b id="er-saved">0</b></span>
          </div>
          <div class="flex items-center gap-4 font-mono">
            <span class="text-base sm:text-lg font-bold">SCORE: <b id="er-score" class="text-emerald-500 text-xl">0</b></span>
            <button id="er-exit" class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">Salir</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="er-beds-grid"></div>

        <div class="p-5 rounded-3xl bg-slate-900 text-white border border-slate-800 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-mono text-xs sm:text-sm uppercase tracking-wider text-emerald-400 font-bold">
              1. Equipa un Kit del MSP (Clic o Teclas 1-6) y luego aplica en la Camilla:
            </span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" id="er-kits-dock"></div>
        </div>
      </div>
    `;

    const renderKitsDock = () => {
      const dock = document.getElementById('er-kits-dock');
      if (!dock) return;
      dock.innerHTML = this.triageKits.map((k, idx) => {
        const isSelected = selectedKitId === k.id;
        return `
          <button type="button" data-kit-id="${k.id}" class="er-kit-btn p-3.5 rounded-2xl text-left transition-all border flex flex-col justify-between ${
            isSelected
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold ring-4 ring-emerald-500/30 scale-[1.02]'
              : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:border-slate-500'
          }">
            <div class="flex items-center justify-between mb-1.5">
              <span class="inline-flex items-center gap-1.5 font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded ${isSelected ? 'bg-slate-950 text-white' : 'bg-slate-900 text-slate-300'}">
                <span class="w-2 h-2 rounded-full ${k.dotClass}"></span>
                ${k.badge}
              </span>
              <span class="font-mono text-xs px-2 py-0.5 rounded ${isSelected ? 'bg-slate-950 text-emerald-400' : 'bg-slate-900 text-slate-400'}">[${idx + 1}]</span>
            </div>
            <div class="font-display font-bold text-sm leading-tight">${k.name}</div>
            <div class="text-xs mt-1 ${isSelected ? 'text-slate-900 font-medium' : 'text-slate-400'} leading-snug">${k.desc}</div>
          </button>
        `;
      }).join('');

      dock.querySelectorAll('.er-kit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          selectedKitId = e.currentTarget.getAttribute('data-kit-id');
          this.playTone('beep');
          renderKitsDock();
        });
      });
    };

    const renderBeds = () => {
      const grid = document.getElementById('er-beds-grid');
      if (!grid) return;

      grid.innerHTML = beds.map((b, idx) => {
        if (!b) {
          return `
            <div class="p-6 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center min-h-[175px] text-slate-400">
              <span class="font-mono text-sm font-bold">BOX DE CHOQUE #${idx + 1} — LIBRE</span>
              <span class="text-xs">Esperando ambulancia...</span>
            </div>
          `;
        }

        const isCritical = b.hp < 35;
        const barColor = b.hp > 60 ? 'bg-emerald-500' : b.hp > 35 ? 'bg-amber-500' : 'bg-rose-500 animate-pulse';

        return `
          <div data-bed-idx="${idx}" class="er-bed-card p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between min-h-[175px] ${
            isCritical
              ? 'border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/15'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 hover:border-emerald-500'
          }">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <span class="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-emerald-500 flex items-center justify-center font-mono text-xs font-black">${b.tag}</span>
                  <div>
                    <span class="font-mono text-xs font-bold uppercase text-slate-400 block">BOX #${idx + 1}</span>
                    <h4 class="font-display font-bold text-lg text-slate-900 dark:text-white">${b.name}</h4>
                  </div>
                </div>
                <span class="px-3 py-1 rounded-xl font-mono text-xs font-bold ${isCritical ? 'bg-rose-500 text-white animate-bounce' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
                  ${Math.ceil(b.hp)}% VITALIDAD
                </span>
              </div>

              <p class="text-sm sm:text-base font-medium text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                ${b.symptom}
              </p>
            </div>

            <div class="pt-3 space-y-2">
              <div class="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                <div class="${barColor} h-full transition-all duration-150" style="width: ${b.hp}%"></div>
              </div>
              <div class="flex items-center justify-between text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                <span>CLIC AQUÍ PARA APLICAR EL KIT EQUIPADO</span>
                <span>→</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('.er-bed-card').forEach(card => {
        card.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-bed-idx'), 10);
          handleApplyKitToBed(idx);
        });
      });
    };

    const handleApplyKitToBed = (bedIdx) => {
      const patient = beds[bedIdx];
      if (!patient) return;

      if (patient.kitId === selectedKitId) {
        this.playTone('correct');
        score += Math.round(100 + patient.hp);
        savedCount++;
        this.addXP(20, true);
        beds[bedIdx] = null;

        document.getElementById('er-score').textContent = score;
        document.getElementById('er-saved').textContent = savedCount;
        renderBeds();
      } else {
        this.playTone('wrong');
        patient.hp = Math.max(5, patient.hp - 25);
        stage.classList.add('shake-error');
        setTimeout(() => stage.classList.remove('shake-error'), 300);
        renderBeds();
      }
    };

    const tickInterval = setInterval(() => {
      if (!this.isArcadeVisible()) {
        this.stopAllLoops();
        return;
      }

      let changed = false;
      for (let i = 0; i < beds.length; i++) {
        if (beds[i]) {
          beds[i].hp -= beds[i].decayRate;
          changed = true;
          if (beds[i].hp <= 0) {
            this.playTone('wrong');
            lives--;
            beds[i] = null;
            const livesEl = document.getElementById('er-lives');
            if (livesEl) livesEl.innerHTML = this.renderLivesHearts(lives);
            if (lives <= 0) {
              this.saveHighScore(score);
              this.stopAllLoops();
              this.renderGameOverScreen('Guardia Caos (ER Rush)', score, () => this.startERRushGame());
              return;
            }
          }
        } else if (Math.random() < 0.08 || beds.every(b => b === null)) {
          spawnPatientInBed(i);
          changed = true;
        }
      }

      if (changed) renderBeds();
    }, 180);

    this.activeTimers.push(tickInterval);

    this.activeKeyHandler = (e) => {
      if (!this.isArcadeVisible()) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= this.triageKits.length) {
        selectedKitId = this.triageKits[num - 1].id;
        this.playTone('beep');
        renderKitsDock();
      }
    };
    window.addEventListener('keydown', this.activeKeyHandler);
    document.getElementById('er-exit')?.addEventListener('click', () => this.renderERRushIntro());

    renderKitsDock();
    renderBeds();
  }

  // =========================================================================
  // JUEGO 3: TOXIN INVADERS (ARCADE SHOOTER DE ANTÍDOTOS EN CANVAS)
  // =========================================================================
  renderToxinInvadersIntro() {
    const stage = document.getElementById('arcade-stage');
    if (!stage) return;

    stage.innerHTML = `
      <div class="my-auto text-center max-w-2xl mx-auto space-y-6 py-8">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-sky-500/15 border border-sky-500/40 text-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/10">
          ${SVG_ICONS.shield}
        </div>
        <div class="space-y-2">
          <span class="font-mono text-xs uppercase tracking-widest px-3 py-1 rounded-full bg-sky-500/15 text-sky-500 font-bold">Arcade Bio-Shooter en Canvas</span>
          <h3 class="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">Toxin Invaders: Defensa de Antídotos</h3>
        </div>
        <p class="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          Cápsulas letales de toxinas y sobredosis caen hacia la barrera hematoencefálica. Dispara el <b>Antídoto Específico</b> desde tus cañones inferiores o usa tus poderes tácticos (<b>Hipotermia Terapéutica</b> y <b>Carbón Activado</b>) antes de que impacten al paciente.
        </p>
        <button id="btn-start-invaders" class="bto-btn px-10 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-display font-bold text-lg tracking-wide shadow-lg shadow-sky-500/25 border-transparent">
          Iniciar Defensa Farmacológica →
        </button>
      </div>
    `;

    document.getElementById('btn-start-invaders')?.addEventListener('click', () => {
      this.playTone('beep');
      this.startToxinInvadersGame();
    });
  }

  startToxinInvadersGame() {
    this.stopAllLoops();
    const stage = document.getElementById('arcade-stage');
    if (!stage) return;

    let score = 0;
    let shield = 100;
    let freezeTimer = 0;
    let bombsLeft = 2;
    let enemies = [];
    let lasers = [];
    let particles = [];
    let frameCount = 0;

    stage.innerHTML = `
      <div class="space-y-4 select-none">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800 font-mono">
          <div class="flex items-center gap-3">
            <span class="px-3 py-1 rounded-xl bg-sky-500/15 text-sky-400 text-sm font-bold">ESCUDO PACIENTE: <b id="ti-shield">100%</b></span>
            <button id="btn-ti-freeze" type="button" class="px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-xs sm:text-sm font-bold hover:bg-cyan-500 hover:text-slate-950 transition-colors">
              Hipotermia [Q]
            </button>
            <button id="btn-ti-bomb" type="button" class="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs sm:text-sm font-bold hover:bg-amber-500 hover:text-slate-950 transition-colors">
              Carbón Activado (<span id="ti-bombs">2</span>) [E]
            </button>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-base sm:text-lg font-bold">SCORE: <b id="ti-score" class="text-emerald-500 text-xl">0</b></span>
            <button id="ti-exit" class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">Salir</button>
          </div>
        </div>

        <div class="relative w-full h-[320px] sm:h-[360px] rounded-3xl overflow-hidden bg-[#060A12] border-2 border-slate-800 shadow-2xl">
          <canvas id="invaders-canvas" class="w-full h-full block"></canvas>
        </div>

        <div class="space-y-2">
          <span class="font-mono text-xs uppercase tracking-wider text-slate-400 font-bold block">
            Haz clic en el Antídoto Correcto (o presiona Teclas 1-8) para disparar el láser neutralizador:
          </span>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5" id="ti-ammo-grid"></div>
        </div>
      </div>
    `;

    const ammoGrid = document.getElementById('ti-ammo-grid');
    if (ammoGrid) {
      ammoGrid.innerHTML = this.toxinArsenal.map((item, idx) => `
        <button type="button" data-ammo-id="${item.id}" class="ti-ammo-btn bto-btn p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 text-left flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 text-slate-950" style="background:${item.color}">${idx + 1}</span>
          <span class="font-bold text-xs sm:text-sm leading-tight truncate">${item.antidote}</span>
        </button>
      `).join('');
    }

    const canvas = document.getElementById('invaders-canvas');
    const ctx = canvas.getContext('2d');
    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.clientWidth || 760;
      canvas.height = canvas.clientHeight || 350;
    };
    resize();

    const spawnEnemy = () => {
      const item = this.toxinArsenal[Math.floor(Math.random() * this.toxinArsenal.length)];
      const margin = 110;
      const x = margin + Math.random() * Math.max(100, canvas.width - margin * 2);
      enemies.push({
        ...item,
        x,
        y: -25,
        vy: 0.55 + Math.min(0.85, score / 2500)
      });
    };

    spawnEnemy();

    const fireAntidote = (ammoId) => {
      let targetIdx = -1;
      let maxY = -999;
      enemies.forEach((en, idx) => {
        if (en.id === ammoId && en.y > maxY) {
          maxY = en.y;
          targetIdx = idx;
        }
      });

      if (targetIdx !== -1) {
        const target = enemies[targetIdx];
        this.playTone('laser');
        lasers.push({
          x1: canvas.width / 2,
          y1: canvas.height - 15,
          x2: target.x,
          y2: target.y,
          color: target.color,
          life: 12
        });

        for (let i = 0; i < 16; i++) {
          particles.push({
            x: target.x,
            y: target.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            color: target.color,
            life: 24
          });
        }

        enemies.splice(targetIdx, 1);
        score += 120;
        this.addXP(15, true);
        document.getElementById('ti-score').textContent = score;
        if (enemies.length === 0) spawnEnemy();
      } else {
        this.playTone('wrong');
        shield = Math.max(0, shield - 8);
        document.getElementById('ti-shield').textContent = `${shield}%`;
      }
    };

    ammoGrid?.querySelectorAll('.ti-ammo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        fireAntidote(e.currentTarget.getAttribute('data-ammo-id'));
      });
    });

    const triggerFreeze = () => {
      if (freezeTimer > 0) return;
      this.playTone('beep');
      freezeTimer = 180;
    };

    const triggerBomb = () => {
      if (bombsLeft <= 0 || enemies.length === 0) return;
      bombsLeft--;
      this.playTone('shock');
      document.getElementById('ti-bombs').textContent = bombsLeft;
      enemies.forEach(en => {
        for (let i = 0; i < 12; i++) {
          particles.push({
            x: en.x, y: en.y,
            vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
            color: '#F59E0B', life: 25
          });
        }
      });
      score += enemies.length * 80;
      enemies = [];
      document.getElementById('ti-score').textContent = score;
      spawnEnemy();
    };

    document.getElementById('btn-ti-freeze')?.addEventListener('click', triggerFreeze);
    document.getElementById('btn-ti-bomb')?.addEventListener('click', triggerBomb);
    document.getElementById('ti-exit')?.addEventListener('click', () => this.renderToxinInvadersIntro());

    this.activeKeyHandler = (e) => {
      if (!this.isArcadeVisible()) return;
      const k = e.key.toUpperCase();
      if (k === 'Q') triggerFreeze();
      else if (k === 'E') triggerBomb();
      else {
        const num = parseInt(k, 10);
        if (num >= 1 && num <= this.toxinArsenal.length) {
          fireAntidote(this.toxinArsenal[num - 1].id);
        }
      }
    };
    window.addEventListener('keydown', this.activeKeyHandler);

    const updateArena = () => {
      if (!this.isArcadeVisible()) {
        this.stopAllLoops();
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      frameCount++;

      if (freezeTimer > 0) freezeTimer--;

      if (frameCount % 135 === 0 && enemies.length < 4) {
        spawnEnemy();
      }

      ctx.fillStyle = freezeTimer > 0 ? '#061826' : '#060A12';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = shield > 40 ? '#10B981' : '#F43F5E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, h - 18);
      ctx.lineTo(w, h - 18);
      ctx.stroke();

      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(w / 2, h - 14, 14, Math.PI, 0);
      ctx.fill();

      for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        if (freezeTimer === 0) {
          en.y += en.vy;
        }

        const boxW = 230;
        const boxH = 38;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = en.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(en.x - boxW / 2, en.y - boxH / 2, boxW, boxH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(en.toxin, en.x, en.y);

        if (en.y + boxH / 2 >= h - 18) {
          this.playTone('wrong');
          shield = Math.max(0, shield - 25);
          document.getElementById('ti-shield').textContent = `${shield}%`;
          enemies.splice(i, 1);

          if (shield <= 0) {
            this.saveHighScore(score);
            this.stopAllLoops();
            this.renderGameOverScreen('Toxin Invaders', score, () => this.startToxinInvadersGame());
            return;
          }
        }
      }

      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
        l.life--;
        if (l.life <= 0) lasers.splice(i, 1);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        if (p.life <= 0) particles.splice(i, 1);
      }

      this.activeRaf = requestAnimationFrame(updateArena);
    };

    this.activeRaf = requestAnimationFrame(updateArena);
  }

  // =========================================================================
  // JUEGO 4: RADAR SNIPER (CAZADOR DE TRIADAS Y BANCO CON BISTURÍ 50/50)
  // =========================================================================
  renderSniperIntro() {
    const stage = document.getElementById('arcade-stage');
    if (!stage) return;

    stage.innerHTML = `
      <div class="my-auto text-center max-w-2xl mx-auto space-y-6 py-8">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
          ${SVG_ICONS.crosshair}
        </div>
        <div class="space-y-2">
          <span class="font-mono text-xs uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/15 text-amber-500 font-bold">Precisión Quirúrgica + Banco CACES</span>
          <h3 class="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">Radar Sniper: Triadas & Bisturí 50/50</h3>
        </div>
        <p class="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          Combina las triadas clásicas más preguntadas con casos reales de tu banco CACES. Cuentas con <b>3 Bisturíes Tácticos (50/50)</b> para amputar dos distractores falsos en los casos más difíciles y mantener viva tu racha.
        </p>
        <button id="btn-start-sniper" class="bto-btn px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-display font-bold text-lg tracking-wide shadow-lg shadow-amber-500/25 border-transparent">
          Activar Mira Quirúrgica →
        </button>
      </div>
    `;

    document.getElementById('btn-start-sniper')?.addEventListener('click', () => {
      this.playTone('beep');
      this.startSniperGame();
    });
  }

  async startSniperGame() {
    this.stopAllLoops();
    const stage = document.getElementById('arcade-stage');
    if (!stage) return;

    let customPool = this.questionsPool && this.questionsPool.length > 0
      ? [...this.questionsPool]
      : await Storage.getAllQuestions();

    const combinedPool = [...this.clinicalTriads, ...customPool].sort(() => Math.random() - 0.5);

    let idx = 0;
    let score = 0;
    let scalpels = 3;
    let streak = 0;

    const renderTarget = () => {
      if (idx >= combinedPool.length) {
        this.saveHighScore(score);
        this.renderGameOverScreen('Radar Sniper', score, () => this.startSniperGame());
        return;
      }

      const q = combinedPool[idx];
      const opts = Array.isArray(q.opciones) ? q.opciones : [];

      stage.innerHTML = `
        <div class="space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 font-mono">
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 rounded-xl bg-amber-500/15 text-amber-500 text-sm font-bold flex items-center gap-1.5">${SVG_ICONS.bolt} RACHA: ${streak}</span>
              <button id="btn-use-scalpel" type="button" ${scalpels <= 0 ? 'disabled' : ''} class="bto-btn px-3.5 py-1.5 rounded-xl bg-slate-900 text-emerald-400 text-xs sm:text-sm font-bold disabled:opacity-40 flex items-center gap-1.5">
                ${SVG_ICONS.scalpel} <span>Bisturí 50/50 (${scalpels} disp.)</span>
              </button>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-base sm:text-lg font-bold">SCORE: <b class="text-emerald-500 text-xl">${score}</b></span>
              <button id="sniper-exit" class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">Salir</button>
            </div>
          </div>

          <div class="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div class="flex items-center justify-between font-mono text-xs text-emerald-500 font-bold uppercase">
              <span>OBJETIVO #${idx + 1} // ${q.especialidad || 'CACES'}</span>
              <span>${q.subtema || 'Alto Rendimiento'}</span>
            </div>
            <div class="clinical-prose text-lg sm:text-xl text-slate-900 dark:text-white leading-relaxed">${this.formatMd(q.enunciado)}</div>
            <div class="font-bold text-base sm:text-lg text-emerald-600 dark:text-emerald-400 pt-1">${this.formatMd(q.pregunta || '¿Cuál es el diagnóstico o conducta de elección?')}</div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5" id="sniper-opts"></div>
        </div>
      `;

      const optsBox = document.getElementById('sniper-opts');
      opts.forEach(o => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-opt-id', o.id);
        btn.className = 'sniper-opt-btn bto-btn text-left p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 hover:border-emerald-500 flex items-start gap-3.5 transition-all';
        btn.innerHTML = `
          <span class="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 font-mono font-bold text-sm flex items-center justify-center shrink-0">${o.id}</span>
          <span class="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-100 leading-snug">${this.formatMd(o.texto)}</span>
        `;
        btn.addEventListener('click', () => {
          if (o.id === q.correcta) {
            this.playTone('correct');
            streak++;
            score += 120 + streak * 25;
            this.addXP(20, true);
            idx++;
            renderTarget();
          } else {
            this.playTone('wrong');
            this.saveHighScore(score);
            this.renderGameOverScreen('Radar Sniper', score, () => this.startSniperGame());
          }
        });
        optsBox.appendChild(btn);
      });

      document.getElementById('btn-use-scalpel')?.addEventListener('click', (e) => {
        if (scalpels <= 0) return;
        scalpels--;
        this.playTone('laser');
        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = `${SVG_ICONS.scalpel} <span>Bisturí Aplicado (${scalpels} disp.)</span>`;

        const wrongBtns = Array.from(document.querySelectorAll('.sniper-opt-btn')).filter(
          b => b.getAttribute('data-opt-id') !== q.correcta
        );
        wrongBtns.sort(() => Math.random() - 0.5).slice(0, 2).forEach(b => {
          b.disabled = true;
          b.classList.add('opacity-25', 'line-through', 'pointer-events-none');
        });
      });

      document.getElementById('sniper-exit')?.addEventListener('click', () => this.renderSniperIntro());
    };

    renderTarget();
  }

  // =========================================================================
  // PANTALLA DE RESUMEN FINAL DE PARTIDA ARCADE
  // =========================================================================
  renderGameOverScreen(gameTitle, finalScore, onRetryFn) {
    const stage = document.getElementById('arcade-stage');
    if (!stage) return;

    stage.innerHTML = `
      <div class="my-auto text-center space-y-5 py-10">
        <span class="px-4 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-xs sm:text-sm font-bold uppercase">
          Sesión Finalizada • ${gameTitle}
        </span>
        <h3 class="font-display text-5xl sm:text-6xl font-black text-slate-900 dark:text-white">${finalScore} PTS</h3>
        <p class="font-mono text-sm sm:text-base text-slate-500">
          Récord Personal en Guardia Arcade: <b class="text-emerald-500">${this.highScoreBlitz} pts</b>
        </p>
        <div class="pt-3 flex justify-center gap-4">
          <button id="btn-arcade-retry" class="bto-btn px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-display font-bold text-base sm:text-lg border-transparent flex items-center gap-2">
            ${SVG_ICONS.refresh}
            <span>Jugar Otra Partida</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-arcade-retry')?.addEventListener('click', () => {
      this.playTone('beep');
      onRetryFn();
    });
  }
}
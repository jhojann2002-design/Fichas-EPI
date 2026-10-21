/**
 * Módulo del Tutor Clínico IA para "EL HPTA CACES"
 * Motor de razonamiento clínico basado en GPC del MSP Ecuador y LLM multimodelo.
 * Interfaz limpia sin emojis.
 */

export class AITutor {
  constructor() {
    this.provider = localStorage.getItem('caces_ai_provider') || 'gemini';
    const savedKey = (localStorage.getItem('caces_ai_key') || '').trim();

    if (savedKey && (savedKey.startsWith('AQ.') || savedKey.length < 20)) {
      localStorage.removeItem('caces_ai_key');
      this.apiKey = '';
    } else {
      this.apiKey = savedKey;
    }
    
    let savedModel = localStorage.getItem('caces_ai_model');
    if (!savedModel || savedModel.includes('1.5')) {
      savedModel = 'gemini-flash-lite-latest';
      localStorage.setItem('caces_ai_model', savedModel);
    }
    this.model = savedModel;
  }

  isConfigured() {
    return true;
  }

  hasExternalKey() {
    if (!this.apiKey || this.apiKey.trim().length < 20) return false;
    if (this.provider === 'gemini' && !this.apiKey.startsWith('AIzaSy')) {
      return false;
    }
    return true;
  }

  saveCredentials(provider, apiKey, model = null) {
    this.provider = provider || 'gemini';
    this.apiKey = (apiKey || '').trim();
    
    if (this.provider === 'gemini' && this.apiKey && !this.apiKey.startsWith('AIzaSy')) {
      alert("Atención: La clave ingresada no parece una API Key de Google Gemini (las claves válidas comienzan con 'AIzaSy'). Se mantendrá activo el Motor Clínico Local de alta fidelidad.");
      this.apiKey = '';
      localStorage.removeItem('caces_ai_key');
      return;
    }

    if (model && !model.includes('1.5')) this.model = model;
    else {
      if (this.provider === 'gemini') this.model = 'gemini-flash-lite-latest';
      else if (this.provider === 'groq') this.model = 'llama-3.3-70b-versatile';
      else if (this.provider === 'openrouter') this.model = 'google/gemini-2.0-flash-exp:free';
      else if (this.provider === 'openai') this.model = 'gpt-4o-mini';
    }

    localStorage.setItem('caces_ai_provider', this.provider);
    localStorage.setItem('caces_ai_key', this.apiKey);
    localStorage.setItem('caces_ai_model', this.model);
  }

  getSystemPrompt() {
    return `Eres el Jefe de Guardia y Tutor Clínico de "CACES MedPrep", plataforma de alta fidelidad para el Examen de Habilitación para el Ejercicio Profesional (EHEP) de Medicina en Ecuador.
Dominas los 7 componentes oficiales del CACES (Medicina Interna 26%, Pediatría 21%, Gíneco-Obstetricia 17%, Cirugía 14%, Salud Mental 8%, Salud Pública 8%, Bioética 6%) y todas las Guías de Práctica Clínica (GPC) del MSP Ecuador (Score MAMÁ, Claves Obstétricas, AIEPI, MAIS-FCI, SIVE-Alerta, PAI, ATLS).

Reglas de respuesta médica:
1. Sé directo, claro y con tono de colega médico / docente universitario. No utilices emojis.
2. Explica con precisión fisiopatológica y farmacológica por qué la clave oficial es la correcta.
3. Desglosa los distractores explicando la trampa clásica del CACES (estudios de segunda línea, dosis incorrecta, contraindicación formal).
4. Cita siempre la norma técnica o GPC del MSP de Ecuador.`;
  }

  async askTutor({ question, prompt }) {
    if (!question) {
      return "No hay un caso clínico activo en este momento. Inicia una pregunta en el simulador o tutor.";
    }

    if (this.hasExternalKey()) {
      try {
        const optionsText = (question.opciones || [])
          .map(o => `${o.id}) ${o.texto || o.text || ''}`)
          .join('\n');

        const contextPrompt = `
=== CASO CLÍNICO CACES ===
Especialidad: ${question.especialidad || 'Medicina'}
Subtema: ${question.subtema || 'General'}
Enunciado: ${question.enunciado}
Pregunta: ${question.pregunta || '¿Cuál es la conducta diagnóstica o terapéutica de elección?'}
Opciones:
${optionsText}
Clave Oficial: Opción ${question.correcta}
Justificación base: ${question.por_que_es || question.justificacion || 'No disponible'}
Perla CACES: ${question.perla_caces || 'No disponible'}
Guía MSP: ${question.guia_msp || 'No disponible'}
==========================

Consulta del médico/estudiante: "${prompt}"
Responde en español con rigor médico docente, sin emojis, usando formato markdown limpio, encabezados breves y viñetas bien estructuradas.`;

        if (this.provider === 'gemini') {
          return await this.callGeminiAPI(contextPrompt);
        } else {
          return await this.callOpenAICompatibleAPI(contextPrompt);
        }
      } catch (err) {
        console.warn("Falla en API externa de IA, activando motor clínico local:", err);
        return this.localClinicalEngine({ question, prompt });
      }
    }

    return this.localClinicalEngine({ question, prompt });
  }

  localClinicalEngine({ question, prompt }) {
    const q = question;
    const p = (prompt || '').toLowerCase().trim();
    const correctOpt = Array.isArray(q.opciones) ? q.opciones.find(o => o.id === q.correcta) : null;
    const correctText = correctOpt ? (correctOpt.texto || correctOpt.text || '') : (q.opciones?.[q.correcta] || '');
    const breakdown = q.desglose_opciones || q.distractores || {};
    const porQue = q.por_que_es || q.justificacion || 'Conducta de primera elección estandarizada en las normativas del MSP de Ecuador.';
    const perla = q.perla_caces || '';
    const guia = q.guia_msp || q.fuente || 'Guías de Práctica Clínica del MSP Ecuador';

    const optMatch = p.match(/\bopci[oó]n\s*([abcd])\b|\b([abcd])\b/i);
    const askedLetter = optMatch ? (optMatch[1] || optMatch[2]).toUpperCase() : null;

    if (askedLetter && ['A', 'B', 'C', 'D'].includes(askedLetter)) {
      if (askedLetter === q.correcta) {
        return `### Opción ${askedLetter} (Respuesta Correcta)
**${correctText}**

${porQue}

**Perla CACES:** ${perla || 'Aprende a reconocer este patrón clínico cardinal en el examen.'}
**Normativa:** ${guia}`;
      } else {
        const whyNot = breakdown[askedLetter] || 'No constituye la conducta de primera línea ni cumple con los criterios de elección para este estadio clínico.';
        const optObj = Array.isArray(q.opciones) ? q.opciones.find(o => o.id === askedLetter) : null;
        const optText = optObj ? (optObj.texto || optObj.text || '') : '';
        return `### Análisis de la Opción ${askedLetter} (Distractor)
**Enunciado de la opción:** *"${optText}"*

${whyNot}

> **Recuerda:** La clave oficial es la **Opción ${q.correcta}** (*${correctText}*).
**Referencia Oficial:** ${guia}`;
      }
    }

    if (p.includes('distractor') || p.includes('no son') || p.includes('otra') || p.includes('incorrect') || p.includes('descart') || p.includes('por que no')) {
      const opts = Array.isArray(q.opciones) ? q.opciones : [];
      const lines = opts.map(opt => {
        const optText = opt.texto || opt.text || '';
        if (opt.id === q.correcta) {
          return `- **Opción ${opt.id} [CLAVE OFICIAL]:** ${optText}\n  *Fundamento:* ${porQue.slice(0, 180)}...`;
        }
        const reason = breakdown[opt.id] || 'Distractor clínico no indicado en este contexto.';
        return `- **Opción ${opt.id} [DESCARTADA]:** ${optText}\n  ${reason}`;
      }).join('\n\n');

      const perlaSection = perla ? `\n\n**Perla CACES:** ${perla}` : '';
      return `### Auditoría Integral de Distractores — Caso ${q.id}

${lines}
${perlaSection}
**Guía MSP:** ${guia}`;
    }

    if (p.includes('fisio') || p.includes('mecanismo') || p.includes('patogenia') || p.includes('fundamento') || p.includes('por qué') || p.includes('porque')) {
      return `### Razonamiento Fisiopatológico y Clínico
**Caso:** ${q.especialidad} — *${q.subtema || 'General'}*

${porQue}

**Perla Clave para el CACES:**
${perla || 'Reconoce la asociación entre el cuadro clínico agudo y el estudio diagnóstico inicial.'}

**Normativa de Referencia:** ${guia}`;
    }

    if (p.includes('guia') || p.includes('guía') || p.includes('msp') || p.includes('norma') || p.includes('protocolo') || p.includes('dosis') || p.includes('farmaco') || p.includes('tratamiento')) {
      return `### Protocolo Oficial y Manejo MSP Ecuador
**Normativa Aplicable:** ${guia}

- **Conducta de Elección:** Opción ${q.correcta} (*${correctText}*).
- **Esquema Terapéutico / Algoritmo:**
${porQue}

**Punto de Corte CACES:** ${perla}`;
    }

    if (p.includes('perla') || p.includes('mnemo') || p.includes('clave') || p.includes('truco') || p.includes('rapido') || p.includes('resumen')) {
      return `### Perla CACES de Alto Rendimiento
**Especialidad:** ${q.especialidad} | **Subtema:** ${q.subtema}

${perla || 'En el examen CACES, la respuesta correcta siempre prioriza la estabilización inicial sobre los estudios invasivos tardíos.'}

> **Clave Oficial:** Opción ${q.correcta} — *${correctText}*
**Guía Oficial:** ${guia}`;
    }

    const opts = Array.isArray(q.opciones) ? q.opciones : [];
    const distractorHighlights = opts
      .filter(o => o.id !== q.correcta)
      .map(o => {
        const reason = breakdown[o.id] || 'Descartada por protocolo.';
        return `- **Opción ${o.id}**: ${reason}`;
      })
      .slice(0, 3)
      .join('\n');

    return `### Interconsulta Clínica CACES — Ítem ${q.id}

**Diagnóstico y Conducta de Elección:**
**Opción ${q.correcta}** — *${correctText}*

**Fundamento Fisiopatológico:**
${porQue}

**Descarte Rápido de Distractores:**
${distractorHighlights}

**Perla CACES:** ${perla || 'Recuerda los puntos de corte del MSP.'}
**Normativa Oficial:** ${guia}

> _¿Tienes alguna duda puntual? Puedes preguntarme: "¿Por qué no la B?", "Dosis exacta", o "Explícame la fisiopatología"._`;
  }

  async generateOptionBreakdown(question) {
    if (!question) return {};

    if (question.desglose_opciones && Object.keys(question.desglose_opciones).length >= 2) {
      return {
        por_que_es: question.por_que_es || question.justificacion,
        desglose_opciones: question.desglose_opciones,
        perla_caces: question.perla_caces || '',
        guia_msp: question.guia_msp || 'GPC del MSP Ecuador'
      };
    }

    const autoMap = {};
    (question.opciones || []).forEach(o => {
      if (o.id === question.correcta) {
        autoMap[o.id] = `**Opción correcta.** ${question.por_que_es || question.justificacion || 'Opción respaldada por la GPC del MSP Ecuador.'}`;
      } else {
        autoMap[o.id] = `**Incorrecta.** "${o.texto || o.text || ''}" no constituye la indicación de primera línea en este escenario clínico.`;
      }
    });

    return {
      por_que_es: question.por_que_es || question.justificacion || 'Conducta de elección según protocolo MSP.',
      desglose_opciones: autoMap,
      perla_caces: question.perla_caces || 'Identifica siempre el cuadro clínico cardinal y la primera línea terapéutica.',
      guia_msp: question.guia_msp || 'Guías de Práctica Clínica MSP Ecuador'
    };
  }

  async callGeminiAPI(userContent, jsonMode = false) {
    const preferredModel = this.model || 'gemini-flash-lite-latest';
    const modelCandidates = Array.from(new Set([
      preferredModel,
      'gemini-flash-lite-latest',
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ]));

    let lastError = null;
    for (const modelName of modelCandidates) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
        const body = {
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2500 }
        };
        if (jsonMode) body.generationConfig.responseMimeType = "application/json";

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (!response.ok) continue;
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text.trim()) return text.trim();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("No se pudo conectar con el servicio de IA.");
  }

  async callOpenAICompatibleAPI(userContent, jsonMode = false) {
    let endpoint = "https://api.openai.com/v1/chat/completions";
    if (this.provider === 'groq') endpoint = "https://api.groq.com/openai/v1/chat/completions";
    else if (this.provider === 'openrouter') endpoint = "https://openrouter.ai/api/v1/chat/completions";

    const body = {
      model: this.model || (this.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
      messages: [
        { role: "system", content: this.getSystemPrompt() },
        { role: "user", content: userContent }
      ],
      temperature: 0.2
    };
    if (jsonMode && (this.provider === 'openai' || this.provider === 'groq')) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
    const data = await response.json();
    return (data?.choices?.[0]?.message?.content || '').trim();
  }
}

export const aiTutor = new AITutor();
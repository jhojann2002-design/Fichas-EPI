/**
 * Módulo de extracción e importación de PDFs y Markdown de bancos CACES
 * Blindado contra corrupción de caracteres y con limpieza de asteriscos de OCR.
 */

export class PDFQuestionImporter {
  constructor() {
    this.pdfjsLib = typeof window !== 'undefined' ? window['pdfjs-dist/build/pdf'] : null;
    if (this.pdfjsLib) {
      const protocol = 'https://';
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = protocol + 'cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  /**
   * Limpia asteriscos huérfanos o mal emparejados producidos por OCR o exportación Markdown
   */
  cleanBrokenMarkdown(str) {
    if (!str) return '';
    let s = String(str).trim();
    s = s.replace(/^\*+|\*+$/g, '').trim();
    const doubleAsteriskCount = (s.match(/\*\*/g) || []).length;
    if (doubleAsteriskCount % 2 !== 0) {
      s = s.replace(/\*\*/g, '');
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  async extractTextFromPDF(file, onProgress = null) {
    if (!this.pdfjsLib) {
      this.pdfjsLib = window['pdfjs-dist/build/pdf'];
    }
    if (!this.pdfjsLib) {
      throw new Error("Librería PDF.js no encontrada en la ventana global");
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = this.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (typeof onProgress === 'function' && pageNum % 5 === 0) {
        onProgress(pageNum, pdf.numPages);
      }

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width || 595.28;
      const pageHeight = viewport.height || 841.88;
      const textContent = await page.getTextContent();
      
      const items = (textContent.items || []).filter(it => it && it.str && it.str.trim().length > 0);
      if (items.length === 0) continue;

      const midX = pageWidth / 2;
      const leftItems = [];
      const rightItems = [];
      const fullWidthItems = [];

      for (const item of items) {
        const x = item.transform[4];
        const w = item.width || 0;
        if (x < (midX - 25) && (x + w) > (midX + 25)) {
          fullWidthItems.push(item);
        } else if (x >= (midX - 15)) {
          rightItems.push(item);
        } else {
          leftItems.push(item);
        }
      }

      const isTwoColumn = leftItems.length >= 8 && rightItems.length >= 8 && 
                          fullWidthItems.length < (leftItems.length + rightItems.length) * 0.35;

      const formatItemBlock = (itemList) => {
        const sorted = [...itemList].sort((a, b) => {
          const yDiff = b.transform[5] - a.transform[5];
          if (Math.abs(yDiff) > 3.5) return yDiff;
          return a.transform[4] - b.transform[4];
        });

        const lines = [];
        let curLine = "";
        let lastX = 0;
        let lastWidth = 0;
        let lastY = null;

        for (const item of sorted) {
          const x = item.transform[4];
          const y = item.transform[5];

          if (lastY !== null && Math.abs(y - lastY) > 3.5) {
            if (curLine.trim()) lines.push(curLine.trim());
            curLine = "";
            lastX = 0;
            lastWidth = 0;
          }

          const gap = x - (lastX + lastWidth);
          if (lastX > 0 && gap > 2.5 && !item.str.startsWith(" ") && !curLine.endsWith(" ")) {
            curLine += " ";
          }

          curLine += item.str;
          lastX = x;
          lastWidth = item.width || 0;
          lastY = y;
        }
        if (curLine.trim()) lines.push(curLine.trim());
        return lines.join("\n");
      };

      let pageText = "";
      if (isTwoColumn) {
        const topHeaders = fullWidthItems.filter(it => it.transform[5] > (pageHeight - 85));
        const bottomFooters = fullWidthItems.filter(it => it.transform[5] < 60);

        if (topHeaders.length > 0) pageText += formatItemBlock(topHeaders) + "\n";
        pageText += formatItemBlock(leftItems) + "\n";
        pageText += formatItemBlock(rightItems) + "\n";
        if (bottomFooters.length > 0) pageText += formatItemBlock(bottomFooters) + "\n";
      } else {
        pageText = formatItemBlock(items);
      }

      fullText += `\n--- PÁGINA ${pageNum} ---\n` + pageText + "\n";
    }

    if (typeof onProgress === 'function') {
      onProgress(pdf.numPages, pdf.numPages);
    }

    return fullText;
  }

  parseQuestionsFromText(text, defaultCategory = "Medicina Interna") {
    const cleanedText = text
      .replace(/###\s*\*\*PREGUNTA\s+\d+\s*\((?:CONTINUACI[ÓO]N\vert{}IMAGEN\s+ANEXO)\)[^\n]*\n*/gi, "\n")
      .replace(/\*\*Educaci[oó]n m[eé]dica, del futuro\.\*\*/gi, "")
      .replace(/<!-- Start of picture text -->[\s\S]*?<!-- End of picture text -->/g, "")
      .replace(/Este documento se encuentra sujeto al fiel cumplimiento[^\n]*\n?/gi, "")
      .replace(/consentimiento informado\.[^\n]*\n?/gi, "")
      .replace(/EXAMEN DE HABILITACIÓN[^\n]*\n?/gi, "")
      .replace(/CARRERAS? DE MEDICINA[^\n]*\n?/gi, "")
      .replace(/BANCO DE PREGUNTAS Y RESPUESTAS?[^\n]*\n?/gi, "")
      .replace(/CONVOCATORIA [^\n]*\n?/gi, "")
      .replace(/es-ES/g, "");

    if (/###\s*\*{0,2}PREGUNTA|#{1,4}\s*PREGUNTA|\*\*Respuesta\s*correcta/i.test(cleanedText)) {
      const mdQuestions = this.parseMarkdownQuestions(cleanedText);
      if (mdQuestions.length >= 2) {
        return this.deduplicateExtracted(mdQuestions);
      }
    }

    const globalAnswers = this.extractGlobalAnswerSheet(cleanedText);
    let rawResult = [];

    const sequentialQuestions = this.parseSequentialNumberedFormat(cleanedText, defaultCategory, globalAnswers);
    if (sequentialQuestions.length >= 2) {
      rawResult = sequentialQuestions;
    }

    if (rawResult.length === 0) {
      const respuestasMatches = cleanedText.match(/(?:^|\s)Respuestas\s*:\s*/gi);
      if (respuestasMatches && respuestasMatches.length >= 2) {
        const cacesQuestions = this.parseCacesRespuestasFormat(cleanedText, defaultCategory);
        if (cacesQuestions.length > 0) {
          rawResult = cacesQuestions;
        }
      }
    }

    if (rawResult.length === 0) {
      rawResult = this.parseGenericNumberedBlocks(cleanedText, defaultCategory, globalAnswers);
    }

    return this.deduplicateExtracted(rawResult);
  }

  parseMarkdownQuestions(mdText, filename = "") {
    const text = mdText.replace(/\r\n/g, '\n');

    const cleanedText = text
      .replace(/###\s*\*\*PREGUNTA\s+\d+\s*\((?:CONTINUACI[ÓO]N\vert{}IMAGEN\s+ANEXO)\)[^\n]*\n*/gi, '\n')
      .replace(/\*\*Educaci[oó]n m[eé]dica, del futuro\.\*\*/gi, '')
      .replace(/<!-- Start of picture text -->[\s\S]*?<!-- End of picture text -->/g, '');

    let headerRegex = /(?:^|\n)\s*#{1,4}\s*\*{0,2}(?:PREGUNTA|Caso\s+cl[íi]nico|Caso|Ítem|Item|Reactivo)\s*(\d{1,4})[^\n]*/gi;
    let headers = [...cleanedText.matchAll(headerRegex)];

    if (headers.length < 2) {
      headerRegex = /(?:^|\n)\s*(?:PREGUNTA|Caso\s+cl[íi]nico|Caso|Ítem|Item|Reactivo)\s+(\d{1,4})[\.\:\-\)]?\s*/gi;
      headers = [...cleanedText.matchAll(headerRegex)];
    }

    if (headers.length < 2) return [];

    const questions = [];
    const seenFingerprints = new Set();

    for (let i = 0; i < headers.length; i++) {
      const cur = headers[i];
      const start = cur.index + cur[0].length;
      const end = (i + 1 < headers.length) ? headers[i + 1].index : cleanedText.length;
      const qNum = cur[1];
      const rawBlock = cleanedText.substring(start, end).trim();

      if (rawBlock.length < 30) continue;

      const parsed = this.parseSingleQuestionMarkdown(rawBlock, qNum, filename, i + 1);
      if (parsed && parsed.enunciado && parsed.opciones && parsed.opciones.length >= 3) {
        const stemKey = (parsed.enunciado || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 150);
        const optKey = (parsed.opciones || []).map(o => o.texto.slice(0, 10)).join('');
        const fp = `${stemKey}_${optKey}`;

        if (!seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          questions.push(parsed);
        }
      }
    }

    return questions;
  }

  parseSingleQuestionMarkdown(block, qNum, filename, sequentialIdx = 1) {
    const respMatch = block.match(/(?:#{1,6}\s*)?\*{0,2}(?:Respuesta\s*correcta|Clave\s*correcta|Soluci[oó]n|Rta|Respuesta|Clave)\s*:?\*{0,2}/i);
    
    let stemAndOpts = block;
    let justificacion = "";
    let claveCorrecta = "A";

    if (respMatch) {
      stemAndOpts = block.substring(0, respMatch.index).trim();
      const afterResp = block.substring(respMatch.index + respMatch[0].length).trim();

      const keyLetterM = afterResp.match(/^\s*\*?\*?\s*([A-Ea-e1-5])[\.\:\)]/);
      if (keyLetterM) {
        const rawVal = keyLetterM[1].toUpperCase();
        claveCorrecta = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E" }[rawVal] || rawVal;
      } else {
        const firstLine = afterResp.split('\n')[0];
        const mFirst = firstLine.match(/\b([A-Da-d])\b/);
        if (mFirst) claveCorrecta = mFirst[1].toUpperCase();
      }

      const justM = afterResp.match(/(?:#{1,6}\s*)?\*{0,2}Justificaci[oó]n\s*:?\*{0,2}([\s\S]*)/i);
      if (justM) {
        justificacion = justM[1].split(/(?:#{1,6}\s*)?\*{0,2}Bibliograf[íi]a\s*:?\*{0,2}/i)[0].trim();
      } else {
        justificacion = afterResp.split(/(?:#{1,6}\s*)?\*{0,2}Bibliograf[íi]a\s*:?\*{0,2}/i)[0].trim();
      }
    }

    const normalizedContent = stemAndOpts.replace(/\s+([B-Db-d][\.\)\:\-]\s+)/g, '\n$1');
    const firstOptM = normalizedContent.match(/(?:^|\n)\s*(?:[\-\*•]\s*)?\*{0,2}A[\.\)\:\-]\s+/);
    let enunciado = "";
    let optsRaw = "";

    if (firstOptM) {
      enunciado = normalizedContent.substring(0, firstOptM.index).trim();
      optsRaw = normalizedContent.substring(firstOptM.index).trim();
    } else {
      enunciado = normalizedContent;
    }

    enunciado = this.cleanBrokenMarkdown(enunciado);
    justificacion = this.cleanBrokenMarkdown(justificacion);

    const optMatches = [...optsRaw.matchAll(/(?:^|\n)\s*(?:[\-\*•]\s*)?\*{0,2}([A-Da-d])[\.\)\:\-]\*{0,2}\s+([^\n]+(?:\n(?!\s*(?:[\-\*•]\s*)?\*{0,2}[A-Da-d][\.\)\:\-]).*)*)/g)];
    const opciones = [];

    for (const om of optMatches) {
      const letId = om[1].toUpperCase();
      const txt = this.cleanBrokenMarkdown(om[2]);
      opciones.push({ id: letId, texto: txt });
    }

    const letters = ["A", "B", "C", "D"];
    while (opciones.length < 4) {
      const nextL = letters[opciones.length];
      opciones.push({ id: nextL, texto: `Opción ${nextL}` });
    }

    const desglose = {};
    if (justificacion) {
      const distractorPatterns = [...justificacion.matchAll(/(?:La\s+opci[oó]n|Opci[oó]n|Distractor|Inciso)\s*([A-D])\s*(?:es\s+incorrecta\s+porque|no\s+corresponde\s+porque|:|\-)\s*([^\n\.]+\.)/gi)];
      for (const dp of distractorPatterns) {
        desglose[dp[1].toUpperCase()] = this.cleanBrokenMarkdown(dp[2]);
      }
    }

    const especialidad = this.detectSpecialty(enunciado + " " + justificacion);

    return {
      id: `CACES-2026-Q${sequentialIdx}`,
      enunciado,
      pregunta: "¿Cuál es la conducta diagnóstica o terapéutica correcta?",
      opciones: opciones.slice(0, 4),
      correcta: ["A", "B", "C", "D"].includes(claveCorrecta) ? claveCorrecta : "A",
      justificacion: justificacion || "Conducta clínica según Guías de Práctica Clínica del MSP Ecuador.",
      por_que_es: justificacion || "",
      desglose_opciones: desglose,
      especialidad,
      subtema: "Banco CACES Filtrado",
      fuente: filename || "Banco CACES Medicina"
    };
  }

  extractGlobalAnswerSheet(text) {
    const map = {};
    const allPairs = [...text.matchAll(/(?:^|\s)(\d{1,3})\s*[\.\-\:\)]\s*([A-Ea-e])\b/g)];
    if (allPairs.length >= 25) {
      allPairs.forEach(p => {
        const qNum = parseInt(p[1], 10);
        if (qNum >= 1 && qNum <= 300) map[qNum] = p[2].toUpperCase();
      });
    }
    return map;
  }

  parseSequentialNumberedFormat(text, defaultCategory, globalAnswers = {}) {
    const headerRegex = /(?:^|\n)\s*(?:Pregunta|Caso\s+cl[íi]nico|Caso|Reactivo|Ítem|Item|No\.|N°|#)?\s*(\d{1,3})\s*(?:[\.\-\:\)]|\s*[-–]\s*)\s*/gi;
    const allMatches = [];
    let m;

    while ((m = headerRegex.exec(text)) !== null) {
      allMatches.push({
        index: m.index,
        headerLength: m[0].length,
        num: parseInt(m[1], 10)
      });
    }

    if (allMatches.length < 2) return [];

    const validQuestions = [];
    for (let i = 0; i < allMatches.length; i++) {
      const cur = allMatches[i];
      if (validQuestions.length === 0) {
        if (cur.num <= 5) validQuestions.push(cur);
      } else {
        const last = validQuestions[validQuestions.length - 1];
        if (cur.num > last.num && (cur.num - last.num) <= 6) {
          const blockContent = text.substring(last.index, cur.index).trim();
          const hasOpts = /(?:^|\n|\s{2,})[A-Da-d][\.\)\:\-]\s+/.test(blockContent);
          if (blockContent.length >= 35 && hasOpts) {
            validQuestions.push(cur);
          }
        }
      }
    }

    if (validQuestions.length < 2) return [];

    const questions = [];
    for (let i = 0; i < validQuestions.length; i++) {
      const current = validQuestions[i];
      const start = current.index + current.headerLength;
      const end = (i + 1 < validQuestions.length) ? validQuestions[i + 1].index : text.length;
      const block = text.substring(start, end).trim();
      const parsed = this.parseSingleQuestionBlock(block, current.num, defaultCategory, globalAnswers[current.num]);
      if (parsed) questions.push(parsed);
    }

    return questions;
  }

  parseGenericNumberedBlocks(text, defaultCategory, globalAnswers = {}) {
    const splitRegex = /(?:^|\n)\s*(?:Pregunta\s+|Caso\s+cl[íi]nico\s+|Ítem\s+|Reactivo\s+)?(\d{1,3})[\.\-\)]\s+/gi;
    const matches = [...text.matchAll(splitRegex)];
    if (matches.length < 2) return [];

    const result = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index + current[0].length;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
      const block = text.substring(start, end).trim();
      const qNum = parseInt(current[1], 10);
      const parsed = this.parseSingleQuestionBlock(block, qNum, defaultCategory, globalAnswers[qNum]);
      if (parsed) result.push(parsed);
    }
    return result;
  }

  parseSingleQuestionBlock(block, qNum, defaultCategory, globalKey = null) {
    if (!block || block.length < 25) return null;

    const { enunciado, opciones, markedKey } = this.parseOptionsFromBlock(block);
    const finalKey = globalKey || markedKey || "A";
    const letters = ["A", "B", "C", "D"];
    while (opciones.length < 4) {
      const nextLetter = letters[opciones.length];
      opciones.push({ id: nextLetter, texto: `Opción ${nextLetter}` });
    }

    return {
      id: `PDF-${Date.now().toString(36).substr(-4)}-Q${qNum || 1}`,
      especialidad: this.detectSpecialty(enunciado + " " + block, defaultCategory),
      subtema: "CACES Examen Oficial",
      enunciado: this.cleanBrokenMarkdown(enunciado) || `Pregunta ${qNum}`,
      pregunta: "¿Cuál es la conducta diagnóstica o terapéutica correcta?",
      opciones: opciones.slice(0, 4),
      correcta: ["A", "B", "C", "D"].includes(finalKey) ? finalKey : "A",
      justificacion: "Pregunta extraída del banco oficial del CACES.",
      fuente: "Banco CACES PDF"
    };
  }

  /**
   * Usa \x5b y \x5d en lugar de corchetes escapados para evitar colisiones con LaTeX
   */
  parseOptionsFromBlock(content) {
    const normalized = content.replace(/([ \t]{2,}|\t+)(?=(?:[A-Ea-e]|[1-5])[\.\)\:\-]\s+)/g, "\n");
    const firstOptionMatch = normalized.search(/(?:^|\n)\s*(?:[\*\✓\•\-\(\x5b]?\s*[A-Ea-e1-5][\.\)\:\-\x5d]|\([A-Ea-e1-5]\))\s+/);

    const enunciado = firstOptionMatch !== -1 ? normalized.substring(0, firstOptionMatch).trim() : normalized;
    const optionsText = firstOptionMatch !== -1 ? normalized.substring(firstOptionMatch).trim() : "";
    let markedKey = null;

    const opciones = [];
    const letterRegex = /(?:^|\n)\s*([\*\✓\(\x5b]*)\s*([A-Ea-e])[\.\)\:\-\x5d]\s+([^\n\r]+(?:\n(?!\s*[\*\✓\(\x5b]*\s*[A-Ea-e1-5][\.\)\:\-\x5d]).*)*)/g;
    const letterMatches = [...optionsText.matchAll(letterRegex)];

    for (const m of letterMatches) {
      const prefix = m[1] || "";
      const id = m[2].toUpperCase();
      let txt = m[3].trim().replace(/\s+/g, " ");
      const hasMark = prefix.includes("*") || prefix.includes("✓") || txt.startsWith("*") || txt.endsWith("*");
      if (hasMark) {
        markedKey = id;
        txt = txt.replace(/[\*\✓]/g, "").trim();
      }
      opciones.push({ id, texto: this.cleanBrokenMarkdown(txt) });
    }

    return { enunciado, opciones, markedKey };
  }

  parseCacesRespuestasFormat(text, defaultCategory) {
    const chunks = text.split(/(?:^|\s)Respuestas\s*:\s*/i);
    const questions = [];
    const letters = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < chunks.length - 1; i++) {
      const nextLines = chunks[i + 1].split('\n').map(l => l.trim()).filter(l => l && !l.includes('--- PÁGINA '));
      const rawOptions = [];

      for (let idx = 0; idx < nextLines.length; idx++) {
        const l = nextLines[idx];
        const isOpt = l.startsWith('-') || l.startsWith('•') || /^[A-Da-d][\.\)]/.test(l);
        if (isOpt && rawOptions.length < 4) {
          const cleanOpt = l.replace(/^[\-\•]\s*/, '').replace(/^[A-Da-d][\.\)]\s*/, '').trim();
          if (cleanOpt) rawOptions.push(this.cleanBrokenMarkdown(cleanOpt));
        } else if (rawOptions.length >= 2) {
          break;
        }
      }

      const prevLines = chunks[i].split('\n').map(l => l.trim()).filter(l => l && !l.includes('--- PÁGINA '));
      let stem = i === 0 ? prevLines.join(' ') : prevLines.slice(Math.min(4, prevLines.length - 1)).join(' ');
      stem = this.cleanBrokenMarkdown(stem);

      if (stem.length > 15 && rawOptions.length >= 2) {
        const correctRawText = rawOptions[0];
        while (rawOptions.length < 4) rawOptions.push(`Opción ${letters[rawOptions.length]}`);
        const shuffled = [...rawOptions.slice(0, 4)].sort(() => Math.random() - 0.5);
        let finalCorrecta = 'A';
        const finalOptions = shuffled.map((txt, idx) => {
          if (txt === correctRawText) finalCorrecta = letters[idx];
          return { id: letters[idx], texto: txt };
        });

        questions.push({
          id: `CACES-IMP-${i + 1}`,
          especialidad: this.detectSpecialty(stem, defaultCategory),
          subtema: "CACES Banco Oficial",
          enunciado: stem,
          pregunta: "¿Cuál es la respuesta o conducta correcta?",
          opciones: finalOptions,
          correcta: finalCorrecta,
          justificacion: "Pregunta extraída del banco oficial del CACES.",
          fuente: "Banco CACES Oficial"
        });
      }
    }

    return questions;
  }

  detectSpecialty(fullText, fallback = "Medicina Interna") {
    const text = fullText.toLowerCase();
    if (/\b(suicid|depresi[oó]n|bipolar|ansiedad|p[aá]nico|tept|esquizofren|psic[oó]sis|delirium|demencia|alzheimer|adicci[oó]n|autismo|tdah|salud mental|psiquiatr[íi]a)\b/.test(text)) return "Salud Mental";
    if (/\b(bio[eé]tica|deontolog|consentimiento informado|autonom[íi]a del paciente|secreto profesional|confidencialidad|encarnizamiento|adecuaci[oó]n del esfuerzo|helsinki|dilema bio[eé]tico)\b/.test(text)) return "Bioética";
    if (/\b(lactante|niño|niña|pedi[aá]tr|neonato|reci[eé]n nacido|meses de edad|apgar|fontanela|crup|bronquiolitis|silverman|aiepi)\b/.test(text)) return "Pediatría";
    if (/\b(gestante|embaraz|parto|útero|c[eé]rvix|ces[aá]rea|preeclampsia|eclampsia|feto|puerperi|score mam[aá]|clave azul|clave roja|hellp|partograma)\b/.test(text)) return "Ginecología y Obstetricia";
    if (/\b(apendic|fosa il[íi]aca derecha|periton|alvarado|obstrucci[oó]n intestinal|colecist|quir[uú]rg|atls|trauma|neumot[oó]rax|hernia|quemadura|parkland|tokio)\b/.test(text)) return "Cirugía";
    if (/\b(mais|mais-fci|msp|epidemiolog|incidencia|prevalencia|sive-alerta|ficha familiar|rpis|asis|pai)\b/.test(text)) return "Salud Pública";
    return fallback;
  }

  deduplicateExtracted(questions) {
    if (!Array.isArray(questions)) return [];
    const seen = new Set();
    return questions.filter(q => {
      if (!q) return false;
      const key = (q.enunciado || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 200);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
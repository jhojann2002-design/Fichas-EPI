// js/sppat.js - Lógica Integral y Generación de Expedientes SPPAT / Emergencia
import { registrarOActualizarMedico } from './medicos.js';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFName,
  PDFString,
  PDFNumber,
  PDFArray,
  PDFDict,
  TextAlignment
} from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Función auxiliar para envolver texto en múltiples líneas dentro de una celda PDF
 */
function drawWrappedText(page, text, x, y, maxWidth, lineHeight, fontSize, font, color = rgb(0, 0, 0)) {
  if (!text) return y;
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  let line = '';
  let currentY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + (line ? ' ' : '') + words[n];
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && line.length > 0) {
      page.drawText(line, { x, y: currentY, size: fontSize, font, color });
      line = words[n];
      currentY -= lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.length > 0) {
    page.drawText(line, { x, y: currentY, size: fontSize, font, color });
  }
  return currentY;
}

/**
 * Obtiene las coordenadas normalizadas { x, y, width, height } de un diccionario Widget PDF.
 */
function obtenerRectDeWidgetDict(widgetDict) {
  try {
    const rectArr = widgetDict.lookup(PDFName.of('Rect'), PDFArray);
    if (!rectArr || rectArr.size() < 4) return { x: 0, y: 0, width: 100, height: 14 };
    const n0 = rectArr.lookup(0, PDFNumber)?.asNumber() ?? 0;
    const n1 = rectArr.lookup(1, PDFNumber)?.asNumber() ?? 0;
    const n2 = rectArr.lookup(2, PDFNumber)?.asNumber() ?? 0;
    const n3 = rectArr.lookup(3, PDFNumber)?.asNumber() ?? 0;
    return {
      x: Math.min(n0, n2),
      y: Math.min(n1, n3),
      width: Math.abs(n2 - n0),
      height: Math.abs(n3 - n1)
    };
  } catch (e) {
    return { x: 0, y: 0, width: 100, height: 14 };
  }
}

/**
 * Repara en memoria los problemas de mapeo en las plantillas de Acrobat antes de leer los campos:
 * 1. Desagrupa campos de texto cuyos widgets (Kids) fueron nombrados igual por error en Acrobat:
 *    - form_008_emergencia.pdf: 'dx_def_1' (3 filas agrupadas) -> 'dx_def_1', 'dx_def_2', 'dx_def_3'
 *    - form_012a_imagenologia.pdf: 'segundo_apellido_medico' (2 columnas agrupadas) -> 'primer_apellido_medico', 'segundo_apellido_medico'
 *    - reclamacion_sppat.pdf: 'vigencia de poliza desde_primer digito mes' (2 celdas) -> '...primer digito mes', '...segundo digito mes'
 *    - reclamacion_sppat.pdf: 'vigencia de poliza desde_primer digito dia' (2 celdas) -> '...primer digito dia', '...segundo digito dia'
 * 2. Promueve campos de 1 solo Kid (como 'nombre_acompañante' en 024, 'UNICÓDIGO' en 008, 'digagnostico de ingreso' en SPPAT)
 *    para eliminar el '/DA (/Helv 0 Tf)' o '/DA (/Helv 12 Tf)' heredado del nodo padre.
 * 3. Corrige rectángulos desfasados en las plantillas:
 *    - 'parentesco acompañante' en 024 (ajustado a la celda central x:196.7..361.0)
 *    - 'Informe del Accidente Relato breve de los hechos' en Reclamación SPPAT (ajustado sobre la línea superior para no quedar tachado)
 */
function repararEstructuraAcroForm(doc) {
  try {
    const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
    if (!acroForm) return;
    // Asegurar un DA base razonable a nivel de AcroForm
    acroForm.set(PDFName.of('DA'), PDFString.of('/Helv 7 Tf 0 g'));

    const fieldsArr = acroForm.lookup(PDFName.of('Fields'), PDFArray);
    if (!fieldsArr) return;

    const nuevosRefs = [];
    const total = fieldsArr.size();

    for (let i = 0; i < total; i++) {
      const fieldRef = fieldsArr.get(i);
      const fieldDict = doc.context.lookup(fieldRef, PDFDict);
      if (!fieldDict) {
        nuevosRefs.push(fieldRef);
        continue;
      }

      const tObj = fieldDict.lookup(PDFName.of('T'));
      const rawName = (tObj && typeof tObj.decodeText === 'function') ? tObj.decodeText().trim() : '';
      const ftObj = fieldDict.lookup(PDFName.of('FT'));
      const ftName = ftObj ? ftObj.toString() : '';
      const kidsArr = fieldDict.lookup(PDFName.of('Kids'), PDFArray);

      // Corregir rectángulo de 'parentesco acompañante' en Formulario 024 (para que centre en su casilla y no en el vacío)
      if (rawName === 'parentesco acompañante') {
        const rectArr = fieldDict.lookup(PDFName.of('Rect'), PDFArray);
        if (rectArr && rectArr.size() === 4) {
          fieldDict.set(PDFName.of('Rect'), doc.context.obj([196.7, 422.7, 361.0, 438.5]));
        }
      }

      // Corregir rectángulo de 'Informe del Accidente Relato breve de los hechos' en Reclamación SPPAT
      // para que no sea atravesado por la línea horizontal impresa en y=518.5
      if (rawName === 'Informe del Accidente Relato breve de los hechos') {
        const rectArr = fieldDict.lookup(PDFName.of('Rect'), PDFArray);
        if (rectArr && rectArr.size() === 4) {
          fieldDict.set(PDFName.of('Rect'), doc.context.obj([218.8, 519.2, 559.6, 530.2]));
        }
      }

      // Si no tiene Kids o es 'establecimiento' (que en Autorización repite legítimamente el hospital en 5 líneas), conservar
      if (!kidsArr || kidsArr.size() === 0 || rawName === 'establecimiento') {
        nuevosRefs.push(fieldRef);
        continue;
      }

      // Verificar si los Kids tienen su propio nombre '/T' (como los checkboxes jerárquicos custodiapolicial.si / no)
      let kidsTienenNombrePropio = false;
      const kidsList = [];
      for (let k = 0; k < kidsArr.size(); k++) {
        const kRef = kidsArr.get(k);
        const kDict = doc.context.lookup(kRef, PDFDict);
        if (kDict) {
          if (kDict.get(PDFName.of('T'))) kidsTienenNombrePropio = true;
          kidsList.push({ ref: kRef, dict: kDict, rect: obtenerRectDeWidgetDict(kDict) });
        }
      }

      if (kidsTienenNombrePropio || ftName !== '/Tx') {
        nuevosRefs.push(fieldRef);
        continue;
      }

      // Función auxiliar para convertir un Widget Kid en un campo de texto independiente de primer nivel
      const promoverKidACampo = (kidItem, nuevoNombre) => {
        kidItem.dict.delete(PDFName.of('Parent'));
        kidItem.dict.set(PDFName.of('FT'), PDFName.of('Tx'));
        kidItem.dict.set(PDFName.of('T'), PDFString.of(nuevoNombre));
        kidItem.dict.set(PDFName.of('DA'), PDFString.of('/Helv 7 Tf 0 g'));
        nuevosRefs.push(kidItem.ref);
      };

      if (rawName === 'dx_def_1' && kidsList.length === 3) {
        // Ordenar de arriba hacia abajo (mayor Y primero: fila 1, fila 2, fila 3)
        kidsList.sort((a, b) => b.rect.y - a.rect.y);
        promoverKidACampo(kidsList[0], 'dx_def_1');
        promoverKidACampo(kidsList[1], 'dx_def_2');
        promoverKidACampo(kidsList[2], 'dx_def_3');
      } else if (rawName === 'segundo_apellido_medico' && kidsList.length === 2) {
        // Ordenar de izquierda a derecha (menor X primero: Primer Apellido, Segundo Apellido)
        kidsList.sort((a, b) => a.rect.x - b.rect.x);
        promoverKidACampo(kidsList[0], 'primer_apellido_medico');
        promoverKidACampo(kidsList[1], 'segundo_apellido_medico');
      } else if (rawName === 'vigencia de poliza desde_primer digito mes' && kidsList.length === 2) {
        kidsList.sort((a, b) => a.rect.x - b.rect.x);
        promoverKidACampo(kidsList[0], 'vigencia de poliza desde_primer digito mes');
        promoverKidACampo(kidsList[1], 'vigencia de poliza desde_segundo digito mes');
      } else if (rawName === 'vigencia de poliza desde_primer digito dia' && kidsList.length === 2) {
        kidsList.sort((a, b) => a.rect.x - b.rect.x);
        promoverKidACampo(kidsList[0], 'vigencia de poliza desde_primer digito dia');
        promoverKidACampo(kidsList[1], 'vigencia de poliza desde_segundo digito dia');
      } else if (kidsList.length === 1) {
        promoverKidACampo(kidsList[0], rawName);
      } else {
        nuevosRefs.push(fieldRef);
      }
    }

    // Actualizar el arreglo Fields del AcroForm con los campos desagrupados y reparados
    while (fieldsArr.size() > 0) {
      fieldsArr.remove(0);
    }
    nuevosRefs.forEach(r => fieldsArr.push(r));
  } catch (e) {
    console.warn('Aviso al reparar estructura AcroForm:', e);
  }
}

/**
 * Calcula cuántas líneas ocupará un texto en un campo multilínea para un tamaño de fuente dado.
 */
function estimarLineasMultilinea(texto, maxWidth, fontSize, font) {
  if (!texto) return 1;
  const parrafos = String(texto).split(/\r?\n/);
  let totalLineas = 0;
  for (const p of parrafos) {
    const palabras = p.trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
      totalLineas += 1;
      continue;
    }
    let lineaActual = '';
    for (const palabra of palabras) {
      const prueba = lineaActual ? `${lineaActual} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, fontSize) > maxWidth && lineaActual.length > 0) {
        totalLineas += 1;
        lineaActual = palabra;
      } else {
        lineaActual = prueba;
      }
    }
    if (lineaActual.length > 0) totalLineas += 1;
  }
  return Math.max(1, totalLineas);
}

/**
 * Ajusta de forma matemática el tamaño de fuente, alineación, banderas (Multilínea / Comb)
 * y apariencia visual de un campo de texto en PDF-Lib para evitar textos gigantes, diminutos o cortados.
 */
function configurarYLlenarCampoTexto(field, texto, opciones = {}) {
  if (!field) return;
  const valStr = String(texto ?? '');
  const {
    baseSize = 7.0,
    minSize = 4.2,
    multiline = false,
    align = TextAlignment.Center,
    font = null
  } = opciones;

  try {
    // 1. Limpiar siempre la bandera Comb (Casillas) y MaxLen que descentraban dígitos en Reclamación SPPAT
    if (typeof field.disableCombing === 'function') field.disableCombing();
    if (field.acroField?.dict) {
      field.acroField.dict.delete(PDFName.of('MaxLen'));
    }

    // 2. Configurar Multilínea explícitamente
    if (multiline) {
      if (typeof field.enableMultiline === 'function') field.enableMultiline();
    } else {
      if (typeof field.disableMultiline === 'function') field.disableMultiline();
    }

    // 3. Configurar Alineación tanto a nivel de campo como en cada widget
    if (typeof field.setAlignment === 'function') {
      field.setAlignment(align);
    }
    const qNum = align === TextAlignment.Left ? 0 : (align === TextAlignment.Right ? 2 : 1);
    if (field.acroField?.dict) {
      field.acroField.dict.set(PDFName.of('Q'), PDFNumber.of(qNum));
    }

    // 4. Obtener dimensiones del widget principal para calcular auto-fit exacto
    const widgets = (field.acroField && field.acroField.getWidgets) ? field.acroField.getWidgets() : [];
    let minWidth = 200;
    let minHeight = 14;
    if (widgets.length > 0) {
      widgets.forEach(w => {
        try {
          w.dict.set(PDFName.of('Q'), PDFNumber.of(qNum));
          w.dict.delete(PDFName.of('MaxLen'));
          const r = w.getRectangle();
          if (r && r.width > 0 && r.height > 0) {
            if (r.width < minWidth) minWidth = r.width;
            if (r.height < minHeight) minHeight = r.height;
          }
        } catch (e) {}
      });
    }

    // 5. Calcular el tamaño de fuente óptimo que cabe sin cortarse ni desbordar verticalmente
    let finalSize = baseSize;
    if (!multiline) {
      // Nunca superar el 74% de la altura de la celda para no cortar tildes ni la Ñ
      const maxPorAltura = Math.max(minSize, Number((minHeight * 0.74).toFixed(1)));
      if (finalSize > maxPorAltura) finalSize = maxPorAltura;

      if (font && valStr.length > 0) {
        const paddingH = minWidth > 35 ? 3.5 : 1.6;
        const dispWidth = Math.max(6, minWidth - paddingH);
        while (finalSize > minSize && font.widthOfTextAtSize(valStr, finalSize) > dispWidth) {
          finalSize = Number((finalSize - 0.2).toFixed(1));
        }
      }
    } else if (font && valStr.length > 0) {
      const dispWidth = Math.max(15, minWidth - 4.0);
      const dispHeight = Math.max(8, minHeight - 2.0);
      while (finalSize > minSize) {
        const numLineas = estimarLineasMultilinea(valStr, dispWidth, finalSize, font);
        const altoTotal = numLineas * (finalSize * 1.22);
        if (altoTotal <= dispHeight) break;
        finalSize = Number((finalSize - 0.25).toFixed(2));
      }
    }

    // 6. Aplicar tamaño de fuente en el campo y en cada widget (/DA)
    if (typeof field.setFontSize === 'function') {
      field.setFontSize(finalSize);
    }
    const daStr = `/Helv ${finalSize} Tf 0 g`;
    if (field.acroField?.dict) {
      field.acroField.dict.set(PDFName.of('DA'), PDFString.of(daStr));
    }
    widgets.forEach(w => {
      try {
        w.dict.set(PDFName.of('DA'), PDFString.of(daStr));
      } catch (e) {}
    });

    // 7. Asignar texto y regenerar apariencia con la fuente incrustada (soporte completo de Ñ y tildes)
    field.setText(valStr);
    if (font && typeof field.updateAppearances === 'function') {
      field.updateAppearances(font);
    }
  } catch (e) {
    try {
      field.setText(valStr);
    } catch (_) {}
  }
}

/**
 * Recopila todos los datos del formulario SPPAT y los combina con los datos básicos del paciente.
 */
export function recopilarDatosSppat() {
  const getVal = id => (document.getElementById(id)?.value ?? '').trim();
  const getChk = id => Boolean(document.getElementById(id)?.checked);

  // El formulario SPPAT es exclusivo para Accidentes de Tránsito
  const tipoEvento = 'TRANSITO';
  const esAccidenteTransito = true;

  // Datos del médico tratante (exclusivos de SPPAT, sin sincronizar con EPI)
  const medicoNombre = getVal('sppat_medico_nombre').toUpperCase();
  const medicoCedula = getVal('sppat_medico_cedula').trim();
  const medicoEspecialidad = (getVal('sppat_medico_esp') || 'MEDICO RESIDENTE').toUpperCase();

  // Si hay datos del médico, auto-alimentar la base de datos de médicos
  if (medicoNombre || medicoCedula) {
    registrarOActualizarMedico({
      nombreCompleto: medicoNombre,
      cedula: medicoCedula,
      registroMsp: medicoCedula,
      especialidad: medicoEspecialidad,
      institucion: getVal('institucion') || 'IESS',
      establecimiento: getVal('establecimiento') || 'HOSPITAL GENERAL PORTOVIEJO'
    });
  }

  // Desglose inteligente de nombres y apellidos del médico responsable
  let primerNombreMed = '', primerApellidoMed = '', segundoApellidoMed = '';
  if (medicoNombre) {
    const limpio = medicoNombre
      .replace(/^(DR\.?|DRA\.?|MED\.?|MD\.?|DOCTORA?|MEDICO)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const partesMed = limpio.split(' ').filter(Boolean);
    if (partesMed.length >= 4) {
      primerNombreMed = partesMed[0];
      primerApellidoMed = partesMed[partesMed.length - 2];
      segundoApellidoMed = partesMed[partesMed.length - 1];
    } else if (partesMed.length === 3) {
      primerNombreMed = partesMed[0];
      primerApellidoMed = partesMed[1];
      segundoApellidoMed = partesMed[2];
    } else if (partesMed.length === 2) {
      primerNombreMed = partesMed[0];
      primerApellidoMed = partesMed[1];
      segundoApellidoMed = '';
    } else {
      primerNombreMed = partesMed[0] || '';
    }
  }

  // Datos del acompañante / familiar
  const acomNombre = getVal('sppat_acom_nombre').toUpperCase();
  const acomCedula = getVal('sppat_acom_cedula').trim();
  const acomParentesco = (getVal('sppat_acom_parentesco') || (acomNombre ? 'FAMILIAR' : '')).toUpperCase();
  const quienFirma = document.querySelector('input[name="sppat_quien_firma"]:checked')?.value || (acomNombre ? 'REPRESENTANTE' : 'PACIENTE');
  const esRepresentante = (quienFirma === 'REPRESENTANTE');

  const instRaw = (getVal('institucion') || '').toUpperCase();
  const estabRaw = (getVal('establecimiento') || '').toUpperCase();

  // Unicódigo: solo lo ingresado o inferido si el usuario lo dejó en blanco
  const unicodigoVal = getVal('sppat_unicodigo').toUpperCase();

  return {
    tipoEvento,
    esAccidenteTransito,

    // Institución y Establecimiento
    institucion: instRaw,
    institucionCorta: instRaw.includes('SEGURIDAD SOCIAL') ? 'IESS' : (instRaw.includes('MINISTERIO DE SALUD') ? 'MSP' : instRaw),
    unicodigo: unicodigoVal,
    establecimiento: estabRaw,
    establecimientoCorto: (getVal('sppat_estab_corto') || '').toUpperCase(),
    provinciaEstablecimiento: (getVal('prov_establecimiento') || '').toUpperCase(),
    cantonEstablecimiento: (getVal('canton_establecimiento') || '').toUpperCase(),
    parroquiaEstablecimiento: (getVal('parroquia_establecimiento') || '').toUpperCase(),
    historiaClinica: (getVal('historia_clinica') || getVal('cedula')).trim(),
    numArchivo: (getVal('sppat_num_archivo') || getVal('historia_clinica') || getVal('cedula')).trim(),

    // Cama / Sala (NUNCA inventar cama 'OBS-1'; vacío por defecto a menos que el usuario lo escriba)
    cama: getVal('sppat_cama').toUpperCase(),
    sala: (getVal('sppat_sala') || 'EMERGENCIA').toUpperCase(),

    // Datos del Paciente (todo en MAYÚSCULAS)
    primerApellido: getVal('primer_apellido').toUpperCase(),
    segundoApellido: getVal('segundo_apellido').toUpperCase(),
    primerNombre: getVal('primer_nombre').toUpperCase(),
    segundoNombre: getVal('segundo_nombre').toUpperCase(),
    nombreCompleto: `${getVal('primer_apellido')} ${getVal('segundo_apellido')} ${getVal('primer_nombre')} ${getVal('segundo_nombre')}`.replace(/\s+/g, ' ').trim().toUpperCase(),
    cedula: getVal('cedula').trim(),
    sexo: (getVal('sexo') || '').toUpperCase(),
    fechaNacimiento: getVal('fecha_nacimiento'),
    edad: (() => {
      let ed = getVal('edad_calculada_val') || getVal('sppat_edad') || '';
      if (!ed && getVal('fecha_nacimiento')) {
        const nac = new Date(getVal('fecha_nacimiento') + 'T12:00:00');
        const ref = getVal('fecha_atencion') ? new Date(getVal('fecha_atencion') + 'T12:00:00') : new Date();
        if (!isNaN(nac.getTime()) && !isNaN(ref.getTime())) {
          let a = ref.getFullYear() - nac.getFullYear();
          let m = ref.getMonth() - nac.getMonth();
          if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) a--;
          ed = Math.max(0, a).toString();
        }
      }
      return ed || '';
    })(),
    estadoCivil: (getVal('estado_civil') || '').toUpperCase(),
    nacionalidad: (getVal('nacionalidad') || 'ECUATORIANA').toUpperCase(),
    etnia: (getVal('etnia') || '').toUpperCase(),
    nivelEducacion: (getVal('escolaridad') || getVal('sppat_educacion') || '').toUpperCase(),
    ocupacion: (getVal('ocupacion') || '').toUpperCase(),
    seguroSalud: (getVal('sppat_seguro') || '').toUpperCase(),
    telefono: getVal('telefono').trim(),
    direccion: getVal('direccion').toUpperCase(),
    provincia: (getVal('prov_residencia') || '').toUpperCase(),
    canton: (getVal('canton_residencia') || '').toUpperCase(),
    parroquia: (getVal('parroquia_residencia') || '').toUpperCase(),
    barrio: (getVal('sppat_barrio') || '').toUpperCase(),

    // Acompañante / Representante
    acomNombre,
    acomCedula,
    acomParentesco,
    esRepresentante,

    // Datos de Atención y Accidente (todo en MAYÚSCULAS)
    fechaAtencion: getVal('fecha_atencion') || new Date().toISOString().slice(0, 10),
    horaAtencion: getVal('sppat_hora_atencion'),
    motivoAtencion: (getVal('sppat_motivo_atencion') || 'TRAUMA POR ACCIDENTE DE TRÁNSITO').toUpperCase(),
    condicionLlegada: (getVal('sppat_condicion_llegada') || 'ESTABLE').toUpperCase(),
    lugarAccidente: (getVal('sppat_lugar_evento') || getVal('direccion') || '').toUpperCase(),
    direccionAccidente: (getVal('sppat_dir_evento') || getVal('sppat_lugar_evento') || getVal('direccion') || '').toUpperCase(),
    condicionAccidentado: (getVal('sppat_condicion_accidentado') || 'CONDUCTOR').toUpperCase(), // CONDUCTOR / OCUPANTE / PEATON
    relatoAccidente: getVal('sppat_relato_accidente').toUpperCase(),
    custodiaPolicial: getChk('sppat_custodia_policial') ? 'SI' : 'NO',
    alientoAlcoholico: getChk('sppat_aliento_alcohol') ? 'SUGESTIVO DE ALIENTO ALCOHÓLICO' : '',

    // Vehículo (Opcional)
    vehiculoPlaca: getVal('sppat_veh_placa').toUpperCase(),
    vehiculoAsegurado: getChk('sppat_veh_asegurado'),
    vehiculoAseguradora: getVal('sppat_veh_aseguradora').toUpperCase(),

    // Modo de llegada y transporte
    modoLlegada: (getVal('sppat_modo_llegada') || 'OTRO').toUpperCase(),
    acomTelefono: (getVal('sppat_acom_telefono') || getVal('telefono')).trim(),

    // Constantes Vitales y Antropometría (Solo lo que el usuario ingrese)
    presionArterial: getVal('sppat_pa').toUpperCase(),
    pulso: getVal('sppat_pulso'),
    frecuenciaResp: getVal('sppat_fr'),
    pulsioximetria: getVal('sppat_spo2'),
    glasgow: getVal('sppat_glasgow'),
    pupilas: getVal('sppat_pupilas').toUpperCase(),
    llenadoCapilar: getVal('sppat_llenado_capilar').toUpperCase(),
    temperatura: getVal('sppat_temperatura'),
    peso: getVal('sppat_peso'),
    talla: getVal('sppat_talla'),
    glicemia: getVal('sppat_glicemia'),

    // Antecedentes, Examen Físico y Trauma (todo en MAYÚSCULAS)
    antecedentesDetalle: getVal('sppat_antecedentes').toUpperCase(),
    examenFisicoDetalle: getVal('sppat_examen_fisico').toUpperCase(),
    examenTraumaDetalle: getVal('sppat_examen_trauma').toUpperCase(),
    tratamiento: getVal('sppat_tratamiento').toUpperCase(),

    // Diagnósticos CIE-10 exclusivos de SPPAT
    diagnosticoPrincipal: (() => {
      let txt = getVal('sppat_diag_principal_txt');
      const raw = getVal('sppat_select_cie1');
      if (!txt && raw) {
        txt = raw.includes(' - ') ? raw.split(' - ').slice(1).join(' - ') : raw;
      }
      return txt.toUpperCase();
    })(),
    ciePrincipal: (() => {
      let c = getVal('sppat_diag_principal_cie');
      const raw = getVal('sppat_select_cie1');
      if (!c && raw && raw.includes(' - ')) {
        c = raw.split(' - ')[0].trim();
      }
      return c.toUpperCase();
    })(),
    diagnosticoSecundario: (() => {
      let txt = getVal('sppat_diag_sec_txt');
      const raw = getVal('sppat_select_cie2');
      if (!txt && raw) {
        txt = raw.includes(' - ') ? raw.split(' - ').slice(1).join(' - ') : raw;
      }
      return txt.toUpperCase();
    })(),
    cieSecundario: (() => {
      let c = getVal('sppat_diag_sec_cie');
      const raw = getVal('sppat_select_cie2');
      if (!c && raw && raw.includes(' - ')) {
        c = raw.split(' - ')[0].trim();
      }
      return c.toUpperCase();
    })(),

    // Solicitud de Rayos X (Formulario 012A)
    estudioImagenSolicitado: getVal('sppat_rx_estudio').toUpperCase(),
    motivoImagen: getVal('sppat_rx_motivo').toUpperCase(),

    // Médico Responsable
    medicoNombre,
    medicoCedula,
    medicoEspecialidad,
    primerNombreMed,
    primerApellidoMed,
    segundoApellidoMed,

    // Observaciones entrega-recepción de servicios
    observacionesEntregaServicio: getVal('sppat_observaciones_entrega').toUpperCase()
  };
}

/**
 * Parsea el texto del tratamiento médico en hasta 7 filas normalizadas para el Formulario 008 (Cuadro N),
 * separando limpiamente medicamento, vía, dosis, posología y días sin repetir dosis en el nombre.
 */
function parseTratamientoLineas(tratamientoStr) {
  const lineas = (tratamientoStr || '')
    .split('\n')
    .map(l => l.replace(/^\d+[\.\-\)]\s*/, '').trim())
    .filter(l => l.length > 0);

  const res = [];
  for (let i = 0; i < 7; i++) {
    const l = lineas[i];
    if (!l) {
      res.push({ med: '', via: '', dosis: '', pos: '', dias: '' });
      continue;
    }

    // Permitir formato separado por plecas o guiones si el usuario escribe: MED | VIA | DOSIS | POSOLOGIA | DIAS
    if (l.includes('|')) {
      const partes = l.split('|').map(p => p.trim().toUpperCase());
      res.push({
        med: partes[0] || '',
        via: partes[1] || '',
        dosis: partes[2] || '',
        pos: partes[3] || '',
        dias: partes[4] || '1'
      });
      continue;
    }

    // Detección de vía de administración
    let via = '';
    if (/\b(VO|V\.O\.|ORAL|VIA ORAL|VÍA ORAL)\b/i.test(l)) via = 'VO';
    else if (/\b(IM|I\.M\.|INTRAMUSCULAR)\b/i.test(l)) via = 'IM';
    else if (/\b(SC|S\.C\.|SUBCUTANEA|SUBCUTÁNEA)\b/i.test(l)) via = 'SC';
    else if (/\b(TOPICA|TÓPICA|LOCAL|CURACION|CURACIÓN)\b/i.test(l)) via = 'TOPICA';
    else if (/\b(INHALATORIA|INHAL)\b/i.test(l)) via = 'INHAL';
    else if (/\b(IV|I\.V\.|EV|INTRAVENOSA|ENDOVENOSA)\b/i.test(l)) via = 'IV';

    // Detección de dosis (ej: 1G, 60MG, 500 MG, 1 AMP, 2 TAB, 100ML)
    const regexDosis = /\b(\d+(?:[\.,]\d+)?\s*(?:MG|G|GR|MCG|UI|ML|CC|MEQ|AMP|AMPOLLA|TAB|TABLETA|CAP|CAPSULA))\b/i;
    const dosisMatch = l.match(regexDosis);
    const dosis = dosisMatch ? dosisMatch[1].replace(/\s+/g, ' ').toUpperCase() : (via === 'TOPICA' ? '-' : '');

    // Detección de días (ej: POR 3 DIAS, X 5 DIAS, 3 DIAS)
    const regexDias = /\b(?:POR|X)?\s*(\d+)\s*D[IÍ]AS?\b/i;
    const diasMatch = l.match(regexDias);

    // Detección de posología
    let pos = '';
    if (/\b(STAT|INMEDIATO|AHORA|DOSIS\s*[UÚ]NICA|DU)\b/i.test(l)) pos = 'STAT';
    else if (/\b(C\/8\s*H|CADA\s*8\s*HORAS?|C8H|TID)\b/i.test(l)) pos = 'C/8H';
    else if (/\b(C\/12\s*H|CADA\s*12\s*HORAS?|C12H|BID)\b/i.test(l)) pos = 'C/12H';
    else if (/\b(C\/6\s*H|CADA\s*6\s*HORAS?|C6H|QID)\b/i.test(l)) pos = 'C/6H';
    else if (/\b(C\/4\s*H|CADA\s*4\s*HORAS?|C4H)\b/i.test(l)) pos = 'C/4H';
    else if (/\b(C\/24\s*H|CADA\s*24\s*HORAS?|QD|C24H|CADA\s*D[IÍ]A)\b/i.test(l)) pos = 'C/24H';
    else if (/\b(PRN|POR\s*RAZ[OÓ]N\s*NECESARIA|SI\s*DOLOR)\b/i.test(l)) pos = 'PRN';

    const dias = diasMatch ? diasMatch[1] : ((dosis || via || pos) ? '1' : '');

    // Limpiar el nombre del medicamento quitando dosis, vía, posología y días ya extraídos
    let med = l
      .replace(regexDosis, '')
      .replace(regexDias, '')
      .replace(/\b(IV|I\.V\.|EV|IM|I\.M\.|VO|V\.O\.|SC|S\.C\.|TOPICA|TÓPICA|INHALATORIA|INHAL|VIA\s+ORAL|VÍA\s+ORAL|INTRAMUSCULAR|INTRAVENOSA|ENDOVENOSA|SUBCUTANEA|SUBCUTÁNEA)\b/gi, '')
      .replace(/\b(STAT|INMEDIATO|AHORA|DOSIS\s*[UÚ]NICA|DU|PRN|POR\s*RAZ[OÓ]N\s*NECESARIA|C\/\d+\s*H|C\d+H|CADA\s*\d+\s*HORAS?|QD|BID|TID|QID)\b/gi, '')
      .replace(/[,;:\-\/]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!med) med = l.toUpperCase();

    res.push({
      med: med.toUpperCase(),
      via,
      dosis,
      pos,
      dias
    });
  }
  return res;
}

/**
 * Llena de forma nativa, precisa e inteligente cualquier plantilla PDF de SPPAT,
 * reparando previamente los campos agrupados en Acrobat, calculando el tamaño exacto
 * de fuente según las dimensiones de cada celda y aplanando el documento final.
 */
export async function llenarFormularioAcrobat(doc, d) {
  if (!doc) return;

  // 1. Reparar campos fusionados (Kids) y rectángulos desfasados en la plantilla PDF
  repararEstructuraAcroForm(doc);

  let form;
  try {
    form = doc.getForm();
  } catch (e) {
    return;
  }
  const fields = form.getFields();
  if (!fields || fields.length === 0) return;

  // 2. Incrustar fuentes estándar para medición exacta de ancho y soporte de Ñ / tildes
  let fontRegular = null;
  let fontBold = null;
  try {
    fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  } catch (e) {}

  // Identificación del documento actual según sus campos característicos
  const fieldNamesSet = new Set(fields.map(f => f.getName()));
  const esDocActa = fieldNamesSet.has('apellidosynombres_paciente') || fieldNamesSet.has('sifirmapx');
  const esDoc024 = fieldNamesSet.has('nombrecompleto_px') || fieldNamesSet.has('negativa_nombre px');
  const esDocReclamacion = fieldNamesSet.has('Informe del Accidente Relato breve de los hechos') || fieldNamesSet.has('placa vehiculo');
  const esDoc008 = fieldNamesSet.has('PRESIÓN ARTERIALmmHg') || fieldNamesSet.has('enf actual');
  const esDoc012 = fieldNamesSet.has('detalle estudio imagen solicitado');

  const fAt = d.fechaAtencion ? new Date(d.fechaAtencion + 'T12:00:00') : new Date();
  const diaStr = String(fAt.getDate()).padStart(2, '0');
  const mesStr = MESES_ES[fAt.getMonth()] || 'Octubre';
  const anioStr = String(fAt.getFullYear());
  const fechaYmdNum = (d.fechaAtencion || '').replace(/-/g, '');
  const horaNum = (d.horaAtencion || '').replace(/:/g, '');
  const fechaNacNum = (d.fechaNacimiento || '').replace(/-/g, '');

  // Desglose de fecha y hora para Reclamación SPPAT
  const anioAt = fechaYmdNum.slice(0, 4) || anioStr;
  const mesAt = fechaYmdNum.slice(4, 6) || String(fAt.getMonth() + 1).padStart(2, '0');
  const diaAt = fechaYmdNum.slice(6, 8) || diaStr;

  const anioNac = fechaNacNum.slice(0, 4) || '';
  const mesNac = fechaNacNum.slice(4, 6) || '';
  const diaNac = fechaNacNum.slice(6, 8) || '';

  const hAtPadded = d.horaAtencion ? d.horaAtencion.replace(/:/g, '').padEnd(4, '0') : '';
  const anioSig = String(parseInt(anioAt, 10) + 1);

  const nomDeclarante = d.esRepresentante ? (d.acomNombre || d.nombreCompleto) : d.nombreCompleto;
  const cedDeclarante = d.esRepresentante ? (d.acomCedula || d.cedula) : d.cedula;

  const ttItems = parseTratamientoLineas(d.tratamiento);

  // Escala de Glasgow (Ocular 1-4, Verbal 1-5, Motor 1-6)
  const gTotal = parseInt(d.glasgow, 10);
  const tieneGlasgow = !isNaN(gTotal) && gTotal <= 15 && gTotal >= 3;
  const glasgowM = tieneGlasgow
    ? (gTotal === 15 ? '6' : String(Math.min(6, Math.max(1, Math.round(gTotal * 6 / 15)))))
    : '';
  const glasgowV = tieneGlasgow
    ? (gTotal === 15 ? '5' : String(Math.min(5, Math.max(1, Math.round(gTotal * 5 / 15)))))
    : '';
  const glasgowO = tieneGlasgow
    ? (gTotal === 15 ? '4' : String(Math.min(4, Math.max(1, Math.round(gTotal * 4 / 15)))))
    : '';

  // Combinar Examen Físico Regional (H) + Examen de Trauma (I) para que nunca se pierda lo escrito en H
  const textoExamenCombinado = [d.examenFisicoDetalle, d.examenTraumaDetalle]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(' | ');

  // Resumen clínico completo para Imagenología (012A)
  const textoResumenImagen = [d.relatoAccidente, textoExamenCombinado]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join('. ');

  // Diagnóstico de Egreso con código CIE-10 para Reclamación SPPAT
  const diagEgresoSppat = (() => {
    const cie = d.cieSecundario || d.ciePrincipal || '';
    const desc = d.diagnosticoSecundario || d.diagnosticoPrincipal || '';
    if (cie && desc && !desc.startsWith(cie)) return `${cie} - ${desc}`;
    return desc || cie;
  })();

  // En el Consentimiento 024 la casilla dice "NOMBRES" (plural y no tiene campo segundo_nombre_px),
  // mientras que en 008 y 012A sí existen dos casillas (primer_nombre_px y segundo_nombre_px)
  const valorPrimerNombrePx = esDoc024
    ? `${d.primerNombre} ${d.segundoNombre}`.replace(/\s+/g, ' ').trim()
    : d.primerNombre;

  // En 012A la columna sexo es estrecha, pero con auto-fit cabe 'FEMENINO'/'MASCULINO'
  const tieneAntecedentes = Boolean(d.antecedentesDetalle && d.antecedentesDetalle.trim().length > 0 && d.antecedentesDetalle.trim() !== 'NO APLICA' && d.antecedentesDetalle.trim() !== 'NINGUNO');

  // Diccionario exhaustivo de mapeo para campos de formulario de Acrobat
  const valores = {
    // ----------------------------------------------------
    // 1. ACTA Y AUTORIZACIÓN (acta_y_autorizacion.pdf)
    // ----------------------------------------------------
    'apellidosynombres_paciente': d.nombreCompleto,
    'cedula_paciente': d.cedula,
    'cedula_pacienteorepresentante': cedDeclarante,
    'cedula_px_o_representante': cedDeclarante,
    'establecimiento': d.establecimiento || '',
    'fecha_año': anioStr,
    'fecha_anio': anioStr,
    'fecha_dia': diaStr,
    'fecha_mes en letras': mesStr,
    'fecha_mes': mesStr,
    'nombre_paciente': d.nombreCompleto,
    'nombre_px_o_representante': nomDeclarante,
    'observaciones_entrega_servicio': d.observacionesEntregaServicio || '',
    'OBSERVACIONES_entrega_servicio': d.observacionesEntregaServicio || '',

    // ----------------------------------------------------
    // 2. FORMULARIO 024 - CONSENTIMIENTO INFORMADO (form_024_consentimiento.pdf)
    // ----------------------------------------------------
    'unicodigo': d.unicodigo || '',
    'parroquia_establecimiento': d.parroquiaEstablecimiento || d.parroquia || '',
    'canton_establecimiento': d.cantonEstablecimiento || d.canton || '',
    'provincia_establecimiento': d.provinciaEstablecimiento || d.provincia || '',
    'servicio': 'EMERGENCIA',
    'cama': d.cama || '', // NUNCA inventar 'OBS-1'
    'fecha': d.fechaAtencion || '',
    'hora': d.horaAtencion || '',
    'nombrecompleto_px': d.nombreCompleto,
    'medico_nombre completo': d.medicoNombre || '',
    'nombre_acompañante': d.esRepresentante ? d.acomNombre : '',
    'cedula_acompañante': d.esRepresentante ? d.acomCedula : '',
    'parentesco acompañante': d.esRepresentante ? d.acomParentesco : '',
    'negativa_nombre px': '',
    'negativa_cedulapx': '',
    'negativa_nombre_medico': '',
    'negativa_nombre_acompañante': '',
    'negativa_cedula_acompañante': '',

    // ----------------------------------------------------
    // 3. FORMULARIO ÚNICO DE RECLAMACIÓN SPPAT (reclamacion_sppat.pdf)
    // ----------------------------------------------------
    'codigo servicio de salud': d.unicodigo || '',
    'numero de tramite': '',
    'ciudad-provincia-canton-parroquia del establecimiento': (d.cantonEstablecimiento || d.provinciaEstablecimiento)
      ? [d.cantonEstablecimiento, d.provinciaEstablecimiento, d.parroquiaEstablecimiento].filter(Boolean).join(' - ')
      : [d.canton, d.provincia].filter(Boolean).join(' - '),
    'correo establecimiento': '',
    'telefonos establecimiento': '',
    'primer apellido px': d.primerApellido,
    'segundo apellido px': d.segundoApellido,
    'primer y segundo nombre px': `${d.primerNombre} ${d.segundoNombre}`.trim(),
    'sexo_px': (d.sexo && d.sexo.startsWith('M')) ? 'M' : (d.sexo ? 'F' : ''),
    'direccion_px': d.direccion || '',
    'ciudad_px': d.canton || '',
    'telefono_px': d.telefono || '',
    'Edad_px': String(d.edad || ''),

    // Fecha de Nacimiento desglosada (SPPAT)
    'primerdigito dia de nacimiento px': diaNac[0] || '',
    'segundodigito dia de nacimiento px': diaNac[1] || '',
    'primerdigito mes de nacimiento px': mesNac[0] || '',
    'segundodigito mes de nacimiento px': mesNac[1] || '',
    'año de nacimiento px': anioNac || '',

    // Accidente lugar y fecha/hora desglosada (SPPAT)
    'provincia accidente': d.provincia || '',
    'canton accidente': d.canton || '',
    'parroquia accidente': d.parroquia || '',
    'barrio accidente': d.barrio || '',
    'Calles en donde ocurrió el accidente': d.direccionAccidente || d.direccion || '',
    'Texto54': anioAt[0] || '',
    'segundo digito año de accidente': anioAt[1] || '',
    'tercer digito año de accidente': anioAt[2] || '',
    'cuarto digito año de accidente': anioAt[3] || '',
    'primer digito mes accidente': mesAt[0] || '',
    'segundo digito mes accidente': mesAt[1] || '',
    'primer digito dia accidente': diaAt[0] || '',
    'segundo digito dia accidente': diaAt[1] || '',
    'primer digito hora accidente': hAtPadded[0] || '',
    'segundo digito hora accidente': hAtPadded[1] || '',
    'tercer digito hora accidente': hAtPadded[2] || '',
    'cuarto digito hora accidente': hAtPadded[3] || '',
    'Informe del Accidente Relato breve de los hechos': d.relatoAccidente || '',

    // Vehículo SPPAT
    'placa vehiculo': d.vehiculoPlaca || '',
    'numero certificado SOAT': d.esAccidenteTransito ? 'SPPAT-EMERG' : '',
    'nombre de aseguradora y codigo': d.vehiculoAseguradora || (d.esAccidenteTransito ? 'SPPAT' : ''),
    'codigo de confirmaciond e cobertura': d.unicodigo ? `${d.unicodigo}-SPPAT` : '',

    // Vigencia de Póliza Desde/Hasta (SPPAT) - Con campos desagrupados 01 / 01
    'vigencia de poliza desde_primer digito año': anioAt[0] || '',
    'vigencia de poliza desde_segundo digito año': anioAt[1] || '',
    'vigencia de poliza desde_tercer digito año': anioAt[2] || '',
    'vigencia de poliza desde_cuarto digito año': anioAt[3] || '',
    'vigencia de poliza desde_primer digito mes': '0',
    'vigencia de poliza desde_segundo digito mes': '1',
    'vigencia de poliza desde_primer digito dia': '0',
    'vigencia de poliza desde_segundo digito dia': '1',
    'vigencia de poliza hasta_primer digito año': anioSig[0] || '',
    'vigencia de poliza hasta_segundodigito año': anioSig[1] || '',
    'vigencia de poliza hasta_tercer digito año': anioSig[2] || '',
    'vigencia de poliza hasta_cuartodigito año': anioSig[3] || '',
    'vigencia de poliza hasta_primer digito mes': '1',
    'vigencia de poliza hasta_segundo digito mes': '2',
    'vigencia de poliza hasta_primer digito dia': '3',
    'vigencia de poliza hasta_segundo digito dia': '1',

    // Atención Médica - Ingreso (SPPAT)
    'fecha ingreso_ primer digito año': anioAt[0] || '',
    'fecha ingreso_ segundo digito año': anioAt[1] || '',
    'fecha ingreso_ tercer digito año': anioAt[2] || '',
    'fecha ingreso_ cuarto digito año': anioAt[3] || '',
    'fecha ingreso_ primer digito mes': mesAt[0] || '',
    'fecha ingreso_ segundo digito mes': mesAt[1] || '',
    'fecha ingreso_ primer digito dia': diaAt[0] || '',
    'fecha ingreso_ segundo digito dia': diaAt[1] || '',
    'primer digito hora de ingreso': hAtPadded[0] || '',
    'segundo digito hora de ingreso': hAtPadded[1] || '',
    'tercer digito hora de ingreso': hAtPadded[2] || '',
    'cuarto digito hora de ingreso': hAtPadded[3] || '',
    'historia clinica': d.historiaClinica || d.cedula,
    'No de dias estada': '1',
    'digagnostico de ingreso': d.diagnosticoPrincipal ? `${d.ciePrincipal ? d.ciePrincipal + ' - ' : ''}${d.diagnosticoPrincipal}` : '',
    'digagnostico de egreso': diagEgresoSppat,
    'fecha egreso _ primer digito año': anioAt[0] || '',
    'fecha egreso _ segundo digito año': anioAt[1] || '',
    'fecha egreso _ tercer digito año': anioAt[2] || '',
    'fecha egreso _ cuarto digito año': anioAt[3] || '',
    'fecha egreso _ primer digito mes': mesAt[0] || '',
    'fecha egreso _ segundo digito mes': mesAt[1] || '',
    'fecha egreso _ primer digito dia': diaAt[0] || '',
    'fecha egreso _ segundo digito dia': diaAt[1] || '',
    'asegurado referido de': '',
    'asegurado referido a': '',
    'asegurado referido de_ciudad': '',
    'asegurado referido a_ciudad': '',
    'referido de_fecha_año': '',
    'referido de_fecha_mes': '',
    'referido de_fecha_dia': '',
    'referido a_fecha_año': '',
    'referido a_fecha_mes': '',
    'referido a_fecha_dia': '',

    // ----------------------------------------------------
    // 4. FORMULARIO 008 MSP (EMERGENCIAS)
    // ----------------------------------------------------
    'institucion': d.institucion || '',
    'UNICÓDIGO': d.unicodigo || '',
    'historia_clinica': d.historiaClinica || d.cedula,
    'numero_cedula': d.cedula,
    'primer_apellido_px': d.primerApellido,
    'segundo_apellido_px': d.segundoApellido,
    'primer_nombre_px': valorPrimerNombrePx,
    'segundo_nombre_px': d.segundoNombre,
    'sexo': d.sexo || '',
    'EDAD': String(d.edad || ''),
    'FECHA DE NACIMIENTO aaaammdd': fechaNacNum,
    'LUGAR DE NACIMIENTO': d.canton || '',
    'NACIONALIDAD': d.nacionalidad || 'ECUATORIANA',
    'AUTOIDENTIFICACIÓN ÉTNICARow1': d.etnia || '',
    'NACIONALIDAD ÉTNICARow1': '',
    'PUEBLOSRow1': '',
    'NIVEL DE EDUCACIÓNRow1': d.nivelEducacion || '',
    'ESTADO DEL NIVEL DE EDUCACIÓNRow1': '',
    'OCUPACIÓN  PROFESIÓNRow1': d.ocupacion || '',
    'TIPO DE EMPRESA DE TRABAJORow1': '',
    'telefono_fijo': d.telefono || '',
    'numero_celular': d.telefono || '',

    // Residencia del Paciente
    'PROVINCIARESIDENCIA': d.provincia || '',
    'CANTÓNRESIDENCIA': d.canton || '',
    'PARROQUIARESIDENCIA': d.parroquia || '',
    'BARRIO O SECTORRESIDENCIA': d.barrio || '',
    'CALLE PRINCIPALRESIDENCIA': d.direccion || '',
    'CALLE SECUNDARIARESIDENCIA': '',
    'REFERENCIARESIDENCIA': '',

    // Representante / En caso necesario llamar a:
    'nombre_representante': d.acomNombre || '',
    'parentesco_representante': d.acomNombre ? (d.acomParentesco || 'FAMILIAR') : '',
    'DIRECCIÓN_representante': d.acomNombre ? (d.direccion || '') : '',
    'N TELÉFONO_representante': d.acomNombre ? (d.acomTelefono || d.telefono || '') : '',
    'INSTITUCIÓN O PERSONA QUE ENTREGA AL PACIENTE': d.modoLlegada === 'AMBULANCIA' ? 'AMBULANCIA 911' : (d.acomNombre || 'PACIENTE'),
    'N TELÉFONO institucion o transporte que entrega al px': d.acomTelefono || d.telefono || '',
    'FUENTE DE INFORMACIÓN': d.esRepresentante ? (d.acomParentesco || 'FAMILIAR') : (d.nombreCompleto ? 'PACIENTE' : ''),
    'NOMBRE Y APELLIDO DEL ADMISIONISTARow1': '',
    'fecha_admision_aaaa-mm-dd': d.fechaAtencion || '',
    'FECHA aaaammddRow1_2': fechaYmdNum,
    'HORA hhmmRow1_2': horaNum,
    'FECHAatencion aaaammdd': fechaYmdNum,
    'HORAatencion hhmm': horaNum,
    'ESPECIFIQUE_GRUPO_PRIORITARIO': '',
    'Texto85': d.motivoAtencion || 'TRAUMA POR ACCIDENTE DE TRÁNSITO',

    // Punto D (Accidente de Tránsito)
    'FECHApuntoD aaaammddRow1': d.esAccidenteTransito ? fechaYmdNum : '',
    'HORApuntoD hhmmRow1': d.esAccidenteTransito ? horaNum : '',
    'LUGAR DEL EVENTOPuntoDRow1': d.esAccidenteTransito ? (d.lugarAccidente || '') : '',
    'DIRECCIÓN DEL EVENTOpuntoDRow1': d.esAccidenteTransito ? (d.direccionAccidente || d.direccion || '') : '',
    'observaciones punto D': d.esAccidenteTransito ? (d.relatoAccidente || '') : '',

    // Antecedentes y Examen Clínico
    'descripcion app y apf': tieneAntecedentes ? d.antecedentesDetalle : '',
    'enf actual': d.relatoAccidente || '',
    'examen fisico de trauma_critico': textoExamenCombinado,

    // Signos Vitales y Antropometría
    'PRESIÓN ARTERIALmmHg': d.presionArterial || '',
    'PULSO  min_2': d.pulso || '',
    'FRECUENCIA RESPIRATORIA  m n': d.frecuenciaResp || '',
    'PULSIOXIMETRIA': d.pulsioximetria || '',
    'pesokg': d.peso ? String(d.peso) : '',
    'tallacm': d.talla ? String(d.talla) : '',
    'T LLENADO': d.llenadoCapilar || '',
    'glicemiacapilar': d.glicemia ? String(d.glicemia) : '',
    'Glasgow_M': glasgowM,
    'glasgow_V': glasgowV,
    'glasgowocular': glasgowO,
    'reaccion pupila izq': d.pupilas || '',
    'reaccionpupila der': d.pupilas || '',
    'SIN CONSTANTES VITALES': '',

    // Exámenes Complementarios
    'comp_detalle': d.estudioImagenSolicitado ? ('SOLICITUD: ' + d.estudioImagenSolicitado) : '',

    // Diagnósticos (Presuntivos y Definitivos - ya desagrupados dx_def_1, dx_def_2, dx_def_3)
    'dx_presunt_1': d.diagnosticoPrincipal || '',
    'dx_presunt_CIE_1': d.ciePrincipal || '',
    'dx_presunt_2': d.diagnosticoSecundario || '',
    'dx_presunt_CIE_2': d.cieSecundario || '',
    'dx_presunt_3': '',
    'dx_presunt_CIE_3': '',
    'dx_def_1': d.diagnosticoPrincipal || '',
    'dx_def_CIE_1': d.ciePrincipal || '',
    'dx_def_2': d.diagnosticoSecundario || '',
    'dx_def_CIE_2': d.cieSecundario || '',
    'dx_def_3': '',
    'dx_def_CIE_3': '',

    // Plan de Tratamiento (Cuadro N: Filas 1 a 7)
    'tt_medicamento_1': ttItems[0].med,
    'tt_viadeadministracion_1': ttItems[0].via,
    'tt_dosis_1': ttItems[0].dosis,
    'tt_posologia_1': ttItems[0].pos,
    'tt_dias_1': ttItems[0].dias,

    'tt_medicamento_2': ttItems[1].med,
    'tt_viadeadministracion_2': ttItems[1].via,
    'tt_dosis_2': ttItems[1].dosis,
    'tt_posologia_2': ttItems[1].pos,
    'tt_dias_2': ttItems[1].dias,

    'tt_medicamento_3': ttItems[2].med,
    'tt_viadeadministracion_3': ttItems[2].via,
    'tt_dosis_3': ttItems[2].dosis,
    'tt_posologia_3': ttItems[2].pos,
    'tt_dias_3': ttItems[2].dias,

    'tt_medicamento_4': ttItems[3].med,
    'tt_viadeadministracion_4': ttItems[3].via,
    'tt_dosis_4': ttItems[3].dosis,
    'tt_posologia_4': ttItems[3].pos,
    'tt_dias_4': ttItems[3].dias,

    'tt_medicamento_5': ttItems[4].med,
    'tt_viadeadministracion_5': ttItems[4].via,
    'tt_dosis_5': ttItems[4].dosis,
    'tt_posologia_5': ttItems[4].pos,
    'tt_dias_5': ttItems[4].dias,

    'tt_medicamento_6': ttItems[5].med,
    'tt_viadeadministracion_6': ttItems[5].via,
    'tt_dosis_6': ttItems[5].dosis,
    'tt_posologia_6': ttItems[5].pos,
    'tt_dias_6': ttItems[5].dias,

    'tt_medicamento_7': ttItems[6].med,
    'tt_viadeadministracion_7': ttItems[6].via,
    'tt_dosis_7': ttItems[6].dosis,
    'tt_posologia_7': ttItems[6].pos,
    'tt_dias_7': ttItems[6].dias,

    // Responsable de la Atención (Médico Tratante)
    'primer nombre medico': d.primerNombreMed || '',
    'primer apellido medico': d.primerApellidoMed || '',
    'segundo apellido medico': d.segundoApellidoMed || '',
    'cedula_medico': d.medicoCedula || '',

    // Campos Obstétricos / Ginecológicos (marcar 'X' en NO APLICA)
    'abortos': '',
    'cesareas': '',
    'FECUENCIA CARDiACA FETAL': '',
    'tiemporuptura membranas': '',
    'presentacion fetal': '',
    'dilatacion': '',
    'PLANO fetal': '',
    'sangrado vaginal': '',
    'contracciones': '',
    'score mama': '',
    'AFU': '',
    'BORRAMIENTO': '',
    'FUM': '',
    'J EMBARAZO PARTO': '',
    'MOVIMIENTO FETAL': '',
    'NÚMERO GESTAS': '',
    'NÚMERO PARTOS': '',
    'PELVIS VIABLE': '',
    'PERÍMETRO CEFÁLICO cm_2': '',
    'RUPTURA DE MEMBRANAS': '',
    'SEMANAS GESTACIÓN': '',
    'NO APLICA': 'X',

    // ----------------------------------------------------
    // 5. FORMULARIO 012A MSP (IMAGENOLOGÍA)
    // ----------------------------------------------------
    'cedula_px': d.cedula,
    'historiaclinica': d.historiaClinica || d.cedula,
    'fecha_nacimiento_px': fechaNacNum,
    'edad_px': String(d.edad || ''),
    'FECHA aaaammddRow1': fechaYmdNum,
    'HORA hhmmRow1': horaNum,
    'detalle estudio imagen solicitado': d.estudioImagenSolicitado || '',
    'motivo de la solicitud': d.motivoImagen || '',
    'resumen clinico actual': textoResumenImagen,
    'fum': (d.sexo && d.sexo.startsWith('F')) ? 'N/A' : '',
    'dx_1': d.diagnosticoPrincipal || '',
    'dx_cie_1': d.ciePrincipal || '',
    'dx_2': d.diagnosticoSecundario || '',
    'dx_cie_2': d.cieSecundario || '',
    'dx_3': '',
    'dx_cie_3': '',
    'dx_4': '',
    'dx_cie_4': '',
    'dx_5': '',
    'dx_cie_5': '',
    'dx_6': '',
    'dx_cie_6': '',
    'sala': d.sala || 'EMERGENCIA',
    'servicio_especialidad': 'EMERGENCIA',
    'primer_nombre medico': d.primerNombreMed || '',
    'primer_apellido_medico': d.primerApellidoMed || '',
    'segundo_apellido_medico': d.segundoApellidoMed || ''
  };

  const edadInt = parseInt(d.edad, 10);
  const esAdultoOAño = isNaN(edadInt) || edadInt >= 1;

  // Determinar seguro de salud en 008
  const seg = (d.seguroSalud || '').toUpperCase();
  const inst = (d.institucion || '').toUpperCase();
  const esIessG = seg ? (seg === 'IESS-G' || seg === 'IESS') : (inst.includes('SEGURIDAD SOCIAL') || inst === 'IESS');
  const esIessC = seg === 'IESS-C' || seg.includes('CAMP');
  const esIsspol = seg === 'ISSPOL';
  const esIssfa = seg === 'ISSFA';
  const esPriv = seg === 'PRIV' || seg === 'PRIVADO';
  const esNinguno = seg === 'NINGUNO' || (!esIessG && !esIessC && !esIsspol && !esIssfa && !esPriv && (inst.includes('MINISTERIO') || inst === 'MSP'));

  fields.forEach(field => {
    const rawName = field.getName();
    const normName = rawName.toLowerCase().trim();

    // ----------------------------------------------------
    // MANEJO DE CASILLAS (CHECKBOXES - 008, 012A, Reclamación, Acta)
    // ----------------------------------------------------
    if (field.constructor.name === 'PDFCheckBox' || typeof field.check === 'function') {
      let check = false;

      // 1. Acta y Autorización
      if (normName === 'sifirmapx') {
        check = !d.esRepresentante;
      } else if (normName === 'sifirma_representante') {
        check = d.esRepresentante;
      }
      // 2. Formulario Único de Reclamación SPPAT
      // En Reclamación SPPAT solo existen 'Ocupante' y 'Peatón': tanto CONDUCTOR como OCUPANTE marcan 'Ocupante'
      else if (normName === 'condiciondelaccidentado_ocupante') {
        check = (d.condicionAccidentado === 'CONDUCTOR' || d.condicionAccidentado === 'OCUPANTE');
      } else if (normName === 'condiciondelaccidentado_peaton') {
        check = (d.condicionAccidentado === 'PEATON');
      } else if (normName === 'vehiculoasegurado_si') {
        check = Boolean(d.vehiculoAsegurado);
      } else if (normName === 'vehiculo no asegurado') {
        check = !d.vehiculoAsegurado;
      } else if (normName === 'vehiculo no identificado') {
        check = false;
      } else if (normName === 'atencion medica_observacion') {
        check = d.esAccidenteTransito;
      } else if (normName === 'atencion medica_ambulatorio') {
        check = false;
      } else if (normName === 'hispitalizacion_si') {
        check = false;
      }
      // 3. Cinemática y Causa del Evento (Punto D - 008)
      else if (normName === 'accidente de transito') {
        check = true;
      } else if (normName === 'custodiapolicial.si') {
        check = (d.custodiaPolicial === 'SI');
      } else if (normName === 'custodiapolicial.no') {
        check = (d.custodiaPolicial !== 'SI');
      } else if (normName === 'sugestivoalientoalcolico') {
        check = Boolean(d.alientoAlcoholico && d.alientoAlcoholico.includes('SUGESTIVO'));
      }
      // 4. Unidad de Edad en Formulario 008:
      // Check Box25 = H (Horas), Check Box27 = D (Días), Check Box29 = M (Meses), Check Box30 = A (Años)
      else if (normName === 'check box30' && esDoc008) {
        check = esAdultoOAño; // Años (A)
      } else if (normName === 'check box29' && esDoc008) {
        check = !esAdultoOAño; // Meses (M)
      } else if ((normName === 'check box25' || normName === 'check box27') && esDoc008) {
        check = false; // Horas (H) / Días (D)
      }
      // 5. Unidad de Edad en Formulario 012A
      else if (normName === 'condicionedad_años') {
        check = esAdultoOAño;
      } else if (normName === 'condicionedad_meses') {
        check = !esAdultoOAño;
      } else if (normName === 'condicionedad_dias' || normName === 'condicionedad_horas') {
        check = false;
      }
      // 6. Formulario 012A - Paciente Contaminado (Check Box26 = SI, Check Box27 = NO)
      else if (normName === 'check box26' && esDoc012) {
        check = false;
      } else if (normName === 'check box27' && esDoc012) {
        check = Boolean(d.estudioImagenSolicitado);
      }
      // 7. Formulario 012A - Servicio y Prioridad
      else if (normName === 'servicio_emergencias') {
        check = Boolean(d.estudioImagenSolicitado);
      } else if (normName === 'servicio_consultaexterna' || normName === 'servicio_hospitalizacion') {
        check = false;
      } else if (normName === 'prioridad_urgente') {
        check = Boolean(d.estudioImagenSolicitado);
      } else if (normName === 'prioridad_rutina' || normName === 'prioridad_control') {
        check = false;
      }
      // 8. Formulario 012A - Modalidad de Imagen solicitada
      else if (normName === 'imagen_rxconvencional') {
        const est = (d.estudioImagenSolicitado || '').toUpperCase();
        check = Boolean(est) && (est.includes('RX') || (!est.includes('TOMO') && !est.includes('ECO') && !est.includes('RESO') && !est.includes('TAC') && !est.includes('RMN')));
      } else if (normName === 'imagen_tomo') {
        const est = (d.estudioImagenSolicitado || '').toUpperCase();
        check = est.includes('TOMO') || est.includes('TAC');
      } else if (normName === 'imagen_eco') {
        check = (d.estudioImagenSolicitado || '').toUpperCase().includes('ECO');
      } else if (normName === 'imagen_resonancia') {
        const est = (d.estudioImagenSolicitado || '').toUpperCase();
        check = est.includes('RESO') || est.includes('RMN');
      } else if (normName === 'imagen_rxportatil' || normName === 'imagen_mamografia' || normName === 'imagen_procedimiento' || normName === 'imagen_otro') {
        check = false;
      }
      // 9. Formulario 012A - Sedación
      else if (normName === 'sedacion_no') {
        check = Boolean(d.estudioImagenSolicitado);
      } else if (normName === 'sedacion_si') {
        check = false;
      }
      // 10. Formulario 012A - Diagnósticos Presuntivos / Definitivos
      else if (normName === 'dxpresuntivo_1') {
        check = Boolean(d.diagnosticoPrincipal);
      } else if (normName === 'dxdef_1') {
        check = false;
      } else if (normName === 'dxpresuntivo_2') {
        check = Boolean(d.diagnosticoSecundario);
      } else if (normName === 'dxdef_2') {
        check = false;
      } else if (normName.startsWith('dxpresuntivo_') || normName.startsWith('dxdef_')) {
        check = false;
      }
      // 11. Estado Civil (008)
      else if (normName === 'estadocivil_sol') {
        check = d.estadoCivil.includes('SOL');
      } else if (normName === 'estadocivil_cas') {
        check = d.estadoCivil.includes('CAS');
      } else if (normName === 'estadocivil_div') {
        check = d.estadoCivil.includes('DIV');
      } else if (normName === 'estadocivil_viu') {
        check = d.estadoCivil.includes('VIU');
      } else if (normName === 'estadocivil_un') {
        check = d.estadoCivil.includes('UN');
      } else if (normName === 'estadocivil_u-h' || normName === 'estadocivil_na') {
        check = false;
      }
      // 12. Tipo de Identificación (008)
      else if (normName === 'tipo_identificacion_ci') {
        check = Boolean(d.cedula);
      } else if (normName.startsWith('tipo_identificacion_')) {
        check = false;
      }
      // 13. Seguro de Salud Principal (008)
      else if (normName === 'seguro_iess_g') {
        check = esIessG;
      } else if (normName === 'seguro_iess_c') {
        check = esIessC;
      } else if (normName === 'seguro_isspol') {
        check = esIsspol;
      } else if (normName === 'seguro_issfa') {
        check = esIssfa;
      } else if (normName === 'seguro_priv') {
        check = esPriv;
      } else if (normName === 'seguro_ninguno') {
        check = esNinguno;
      }
      // 14. Historia Clínica y Grupo Prioritario (008)
      else if (normName === 'hc_enestablecimiento_si') {
        check = Boolean(d.historiaClinica);
      } else if (normName === 'hc_enestablecimiento_no') {
        check = false;
      } else if (normName === 'no.grupoprioritario') {
        check = true;
      } else if (normName === 'si.grupoprioritario') {
        check = false;
      } else if (normName === 'si.notifiacion') {
        check = d.esAccidenteTransito || d.custodiaPolicial === 'SI';
      } else if (normName === 'no.notifiacion') {
        check = !(d.esAccidenteTransito || d.custodiaPolicial === 'SI');
      }
      // 15. Forma de Llegada y Condición de Llegada (008)
      else if (normName === 'llega estable') {
        check = (d.condicionLlegada === 'ESTABLE' || !d.condicionLlegada);
      } else if (normName === 'llega inestable') {
        check = (d.condicionLlegada === 'INESTABLE');
      } else if (normName === 'llega fallecido') {
        check = (d.condicionLlegada === 'FALLECIDO');
      } else if (normName === 'llega en ambulancia') {
        check = (d.modoLlegada === 'AMBULANCIA');
      } else if (normName === 'llegaambulatorio') {
        check = (d.modoLlegada === 'AMBULATORIO');
      } else if (normName === 'llega en otro transporte') {
        check = (d.modoLlegada === 'OTRO');
      }
      // 16. Antecedentes Personales y Familiares (APP / APF - 008 Cuadro E)
      else if (normName === 'no aplica app y apf') {
        check = !tieneAntecedentes;
      } else if (normName === 'clinicos') {
        check = tieneAntecedentes;
      }
      // 17. Exámenes Complementarios (008 Cuadro K)
      else if (normName === 'comp_rx osea') {
        const est = (d.estudioImagenSolicitado || '').toUpperCase();
        check = Boolean(est) && !est.includes('TORAX');
      } else if (normName === 'comp_rx torax') {
        const est = (d.estudioImagenSolicitado || '').toUpperCase();
        check = Boolean(est) && est.includes('TORAX');
      } else if (normName === 'comp_tomo') {
        const est = (d.estudioImagenSolicitado || '').toUpperCase();
        check = est.includes('TOMO') || est.includes('TAC');
      } else if (normName === 'comp_eco abdomen') {
        const est = (d.estudioImagenSolicitado || '').toUpperCase();
        check = est.includes('ECO');
      } else if (normName === 'comp_resolnancia') {
        const est = (d.estudioImagenSolicitado || '').toUpperCase();
        check = est.includes('RESO') || est.includes('RMN');
      } else if (normName === 'comp_no aplica') {
        check = !d.estudioImagenSolicitado;
      }

      if (check) {
        field.check();
      } else {
        field.uncheck();
      }
      return;
    }

    // ----------------------------------------------------
    // MANEJO DE CAMPOS DE TEXTO CON AUTO-ESCALADO Y ALINEACIÓN
    // ----------------------------------------------------
    if (field.constructor.name === 'PDFTextField' || typeof field.setText === 'function') {
      const val = valores[rawName] ?? valores[normName];
      if (val === undefined || val === null) return;

      // Selección de fuente según documento (Acta/Autorización en Helvetica regular, formularios clínicos en HelveticaBold)
      const activeFont = esDocActa ? (fontRegular || fontBold) : (fontBold || fontRegular);

      // Determinar si el campo es multilínea y su alineación ideal
      let isMulti = false;
      let align = TextAlignment.Center;
      let baseSize = 7.0;

      if (esDocActa) {
        baseSize = 9.0;
        if (normName.includes('observaciones')) {
          align = TextAlignment.Left;
          baseSize = 8.0;
        } else if (normName === 'establecimiento' || normName.includes('nombre')) {
          baseSize = 8.5;
        }
      } else if (esDoc024) {
        // En el Consentimiento 024 TODOS los campos son de 1 línea y centrados
        isMulti = false;
        align = TextAlignment.Center;
        if (normName === 'historia_clinica') baseSize = 9.0;
        else if (normName.includes('parroquia') || normName.includes('canton') || normName.includes('provincia') || normName === 'servicio') baseSize = 6.5;
        else baseSize = 7.8;
      } else if (esDocReclamacion) {
        isMulti = false;
        baseSize = 7.2;
        if (normName.includes('informe del accidente') || normName.includes('digagnostico')) {
          align = TextAlignment.Left;
          baseSize = 6.5;
        } else {
          align = TextAlignment.Center;
        }
      } else if (esDoc008) {
        baseSize = 6.5;
        if (normName === 'enf actual' || normName === 'examen fisico de trauma_critico' || normName === 'observaciones punto d' || normName === 'descripcion app y apf') {
          isMulti = true;
          align = TextAlignment.Left;
          baseSize = 6.5;
        } else if (normName === 'dx_presunt_1' || normName === 'dx_def_1') {
          isMulti = true;
          align = TextAlignment.Left;
          baseSize = 6.0;
        } else if (normName.startsWith('dx_presunt_') && !normName.includes('cie')) {
          isMulti = false;
          align = TextAlignment.Left;
          baseSize = 5.8;
        } else if (normName.startsWith('dx_def_') && !normName.includes('cie')) {
          isMulti = false;
          align = TextAlignment.Left;
          baseSize = 5.8;
        } else if (normName.startsWith('tt_medicamento') || normName === 'comp_detalle' || normName === 'texto85' || normName === 'especifique_grupo_prioritario') {
          isMulti = false;
          align = TextAlignment.Left;
          baseSize = 6.2;
        } else {
          isMulti = false;
          align = TextAlignment.Center;
          baseSize = 6.5;
        }
      } else if (esDoc012) {
        baseSize = 7.0;
        if (normName === 'resumen clinico actual') {
          isMulti = true;
          align = TextAlignment.Left;
          baseSize = 7.0;
        } else if (/^dx_[1-6]$/.test(normName)) {
          isMulti = true;
          align = TextAlignment.Left;
          baseSize = 6.0;
        } else if (normName === 'detalle estudio imagen solicitado' || normName === 'motivo de la solicitud') {
          isMulti = false;
          align = TextAlignment.Center;
          baseSize = 7.0;
        } else {
          isMulti = false;
          align = TextAlignment.Center;
          baseSize = 7.0;
        }
      }

      configurarYLlenarCampoTexto(field, val, {
        baseSize,
        minSize: 4.2,
        multiline: isMulti,
        align,
        font: activeFont
      });
    }
  });

  // APLANAR el formulario para convertirlo en documento estático (no interactivo)
  try {
    form.flatten();
  } catch (e) {
    console.warn('Advertencia al aplanar formulario:', e);
  }
}

/**
 * Llena el formulario interactivo de Acrobat en acta_y_autorizacion.pdf
 * utilizando estrictamente los campos oficiales de Acrobat, y lo aplana.
 */
export async function prepararActaYAutorizacion(docActaAut, d) {
  await llenarFormularioAcrobat(docActaAut, d);
}

// Funciones heredadas mantenidas como puente transparente hacia Acrobat
export function estamparAutorizacion(page, d) {}
export function estamparConsentimiento024(page, d) {}
export function estamparActaRecepcion(page, d) {}
export function estamparReclamacionSppat(page, d) {}
export function estamparFormulario008(page1, page2, d) {}
export function estamparFormulario012A(page, d) {}

/**
 * Función principal: Descarga y compila el expediente SPPAT completo en un solo archivo PDF
 * utilizando de forma exclusiva el llenado de formularios Acrobat y su aplanado final.
 */
export async function generarExpedienteSppatBlob(datosSppat) {
  if (!PDFDocument) {
    throw new Error('La librería PDF-Lib no está cargada en el navegador.');
  }

  // 1. Crear documento PDF unificado final
  const masterDoc = await PDFDocument.create();

  // Helper para cargar plantillas evitando respuestas viejas cacheadas
  const cargarPlantilla = async (rutaPdf) => {
    const res = await fetch(rutaPdf, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`No se pudo cargar la plantilla: ${rutaPdf}`);
    const bytes = await res.arrayBuffer();
    return await PDFDocument.load(bytes);
  };

  // ==========================================
  // DOCUMENTOS 1 Y 3: Autorización y Acta Entrega-Recepción
  // ==========================================
  const docActaAut = await cargarPlantilla('./plantillas_sppat/acta_y_autorizacion.pdf');
  await llenarFormularioAcrobat(docActaAut, datosSppat);

  // DOCUMENTO 1: Autorización al Hospital (Página 2 de acta_y_autorizacion.pdf, aplanada)
  const [pageAutorizacion] = await masterDoc.copyPages(docActaAut, [1]);
  masterDoc.addPage(pageAutorizacion);

  // ==========================================
  // DOCUMENTO 2: Consentimiento Informado (Formulario 024)
  // ==========================================
  const docConsentimiento = await cargarPlantilla('./plantillas_sppat/form_024_consentimiento.pdf');
  await llenarFormularioAcrobat(docConsentimiento, datosSppat);
  const pConsentIdx = docConsentimiento.getPageCount() > 1 ? 1 : 0;
  const [pageConsentimiento] = await masterDoc.copyPages(docConsentimiento, [pConsentIdx]);
  masterDoc.addPage(pageConsentimiento);

  // ==========================================
  // DOCUMENTO 3: Acta Entrega-Recepción de Servicios de Salud
  // (Página 1 del archivo acta_y_autorizacion.pdf, aplanada)
  // ==========================================
  const [pageActa] = await masterDoc.copyPages(docActaAut, [0]);
  masterDoc.addPage(pageActa);

  // ==========================================
  // DOCUMENTO 4: Formulario Único de Reclamación SPPAT (1 página)
  // ==========================================
  if (datosSppat.esAccidenteTransito) {
    const docReclamacion = await cargarPlantilla('./plantillas_sppat/reclamacion_sppat.pdf');
    await llenarFormularioAcrobat(docReclamacion, datosSppat);
    const [pageReclamacion] = await masterDoc.copyPages(docReclamacion, [0]);
    masterDoc.addPage(pageReclamacion);
  }

  // ==========================================
  // DOCUMENTO 5: Formulario 008 (Emergencia, 2 páginas)
  // ==========================================
  const doc008 = await cargarPlantilla('./plantillas_sppat/form_008_emergencia.pdf');
  await llenarFormularioAcrobat(doc008, datosSppat);
  const [page008_1, page008_2] = await masterDoc.copyPages(doc008, [0, 1]);
  masterDoc.addPage(page008_1);
  masterDoc.addPage(page008_2);

  // ==========================================
  // DOCUMENTO 6: Formulario 012A (Imagenología - Solicitud de Rayos X, 1 página)
  // ==========================================
  const doc012 = await cargarPlantilla('./plantillas_sppat/form_012a_imagenologia.pdf');
  await llenarFormularioAcrobat(doc012, datosSppat);
  const [page012] = await masterDoc.copyPages(doc012, [0]);
  masterDoc.addPage(page012);

  // ==========================================
  // APLANADO FINAL OBLIGATORIO (FLATTEN)
  // ==========================================
  try {
    masterDoc.getForm().flatten();
  } catch (e) {}

  // Generar bytes del PDF unificado
  const pdfBytes = await masterDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const fileName = `EXPEDIENTE_SPPAT_${(datosSppat.cedula || 'SN')}_${(datosSppat.primerApellido || 'PACIENTE')}.pdf`;

  return { blob, fileName };
}

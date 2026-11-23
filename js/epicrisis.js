// js/epicrisis.js - Lógica, Generación de Excel y PDF Oficial para Formulario 006 (Epicrisis MSP)
let PDFDocument, StandardFonts, rgb, TextAlignment, PDFName, PDFNumber, PDFString;

async function asegurarPdfLib() {
  if (PDFDocument) return { PDFDocument, StandardFonts, rgb, TextAlignment, PDFName, PDFNumber, PDFString };
  if (typeof window !== 'undefined') {
    const mod = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
    PDFDocument = mod.PDFDocument;
    StandardFonts = mod.StandardFonts;
    rgb = mod.rgb;
    TextAlignment = mod.TextAlignment;
    PDFName = mod.PDFName;
    PDFNumber = mod.PDFNumber;
    PDFString = mod.PDFString;
  }
  return { PDFDocument, StandardFonts, rgb, TextAlignment, PDFName, PDFNumber, PDFString };
}

import { mostrarLoader, ocultarLoader, enfocarElementoSeguro } from './ui.js';

function getVal(id) {
  if (typeof document === 'undefined') return '';
  const el = document.getElementById(id);
  return el ? (el.value || '').trim() : '';
}

function getChk(id) {
  if (typeof document === 'undefined') return false;
  const el = document.getElementById(id);
  return el ? Boolean(el.checked) : false;
}

// -------------------------------------------------------------
// CACHÉ DE PLANTILLAS EN MEMORIA
// -------------------------------------------------------------
let _cacheEpicrisisXlsxBytes = null;
let _cacheEpicrisisPdfBytes = null;

async function obtenerBytesPlantillaEpicrisisXlsx() {
  if (_cacheEpicrisisXlsxBytes) return _cacheEpicrisisXlsxBytes;
  const res = await fetch('./plantilla_epicrisis.xlsx');
  if (!res.ok) throw new Error('No se pudo cargar la plantilla plantilla_epicrisis.xlsx');
  const buf = await res.arrayBuffer();
  _cacheEpicrisisXlsxBytes = buf;
  return buf;
}

async function obtenerBytesPlantillaEpicrisisPdf() {
  if (_cacheEpicrisisPdfBytes) return _cacheEpicrisisPdfBytes;
  const res = await fetch('./plantilla_epicrisis.pdf');
  if (!res.ok) throw new Error('No se pudo cargar la plantilla plantilla_epicrisis.pdf');
  const buf = await res.arrayBuffer();
  _cacheEpicrisisPdfBytes = buf;
  return buf;
}

// -------------------------------------------------------------
// UTILIDADES ZIP ULTRA RÁPIDAS NATIVAS
// -------------------------------------------------------------
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32Bytes(u8) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) {
    crc = CRC32_TABLE[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function inflateRawBytes(compBytes) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compBytes);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

async function deflateRawBytes(rawBytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(rawBytes);
    writer.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  } catch (e) {
    return null;
  }
}

async function leerEntriesZip(arrayBuffer) {
  const u8 = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  let eocdOffset = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Archivo XLSX inválido (EOCD no encontrado).');

  const totalEntries = dv.getUint16(eocdOffset + 10, true);
  let cdOffset = dv.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries = [];

  for (let i = 0; i < totalEntries; i++) {
    if (dv.getUint32(cdOffset, true) !== 0x02014b50) break;
    const method = dv.getUint16(cdOffset + 10, true);
    const crc = dv.getUint32(cdOffset + 16, true);
    const compSize = dv.getUint32(cdOffset + 20, true);
    const uncompSize = dv.getUint32(cdOffset + 24, true);
    const nameLen = dv.getUint16(cdOffset + 28, true);
    const extraLen = dv.getUint16(cdOffset + 30, true);
    const commentLen = dv.getUint16(cdOffset + 32, true);
    const localHeaderOffset = dv.getUint32(cdOffset + 42, true);
    const name = decoder.decode(u8.subarray(cdOffset + 46, cdOffset + 46 + nameLen));

    const lNameLen = dv.getUint16(localHeaderOffset + 26, true);
    const lExtraLen = dv.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
    const compData = u8.subarray(dataStart, dataStart + compSize);

    if (!name.endsWith('/')) {
      entries.push({ name, method, crc, compSize, uncompSize, compData });
    }
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function construirZipDesdeEntries(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue;
    const nameBytes = encoder.encode(entry.name);
    let method = entry.method;
    let compData = entry.compData;
    let uncompSize = entry.uncompSize;
    let crc = entry.crc;

    if (entry.rawBytes) {
      uncompSize = entry.rawBytes.length;
      crc = crc32Bytes(entry.rawBytes);
      const deflated = await deflateRawBytes(entry.rawBytes);
      if (deflated) {
        method = 8;
        compData = deflated;
      } else {
        method = 0;
        compData = entry.rawBytes;
      }
    }

    const compSize = compData.length;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(localHeader.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true);
    ldv.setUint16(6, 0, true);
    ldv.setUint16(8, method, true);
    ldv.setUint16(10, 0, true);
    ldv.setUint16(12, 0x21, true); // Fecha DOS válida (1980-01-01)
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, compSize, true);
    ldv.setUint32(22, uncompSize, true);
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cdHeader.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, method, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0x21, true); // Fecha DOS válida (1980-01-01)
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, compSize, true);
    cdv.setUint32(24, uncompSize, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    cdHeader.set(nameBytes, 46);

    localParts.push(localHeader, compData);
    cdParts.push(cdHeader);
    offset += localHeader.length + compSize;
  }

  let cdSize = 0;
  cdParts.forEach(p => { cdSize += p.length; });

  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, cdParts.length, true);
  edv.setUint16(10, cdParts.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, offset, true);

  return new Blob([...localParts, ...cdParts, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

// -------------------------------------------------------------
// FUNCIÓN PARA LIMPIEZA DE TEXTOS COPIADOS DE AS400
// -------------------------------------------------------------
export function limpiarTextoAS400(texto) {
  if (!texto) return '';
  let str = String(texto);

  // 1. Normalizar saltos de línea a \n
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Eliminar caracteres de control invisibles que provienen del emulador de terminal
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3. Si en medio del texto hay viñetas separadas por espacios (ej: "...C/8H - DIETA BLANDA"), asegurar salto de línea antes de cada viñeta
  str = str.replace(/[ \t]+([-*•\u2013\u2014])\s*([A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ])/gu, '\n$1 $2');

  // 4. Unir palabras cortadas por guion al final de línea (ej: "HIPERTEN-\nsion" -> "HIPERTENsion")
  str = str.replace(/([A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ]{2,})-\n\s*([a-záéíóúüñ]{2,})/gu, '$1$2');

  // 5. Procesar líneas respetando viñetas como "enters" individuales y uniendo prosa partida
  const lineas = str.split('\n');
  const lineasProcesadas = [];
  let bufferProsa = '';

  for (let i = 0; i < lineas.length; i++) {
    let linea = lineas[i].trim();
    if (!linea) {
      if (bufferProsa) {
        lineasProcesadas.push(bufferProsa);
        bufferProsa = '';
      }
      continue;
    }

    // Colapsar espacios múltiples horizontales
    linea = linea.replace(/[ \t]{2,}/g, ' ');

    // Comprobar si la línea es una viñeta (inicia con guion, asterisco, bullet o número)
    const esVineta = /^([-*•\u2013\u2014]|\d+[.)\-])\s*/.test(linea);
    const terminaEnDosPuntos = /:\s*$/.test(bufferProsa);

    if (esVineta) {
      if (bufferProsa) {
        lineasProcesadas.push(bufferProsa);
        bufferProsa = '';
      }
      // Asegurar espacio tras el guion si viene pegado al texto
      if (/^[-*•\u2013\u2014][A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ]/.test(linea)) {
        linea = linea.charAt(0) + ' ' + linea.slice(1);
      }
      lineasProcesadas.push(linea);
    } else if (terminaEnDosPuntos) {
      if (bufferProsa) {
        lineasProcesadas.push(bufferProsa);
      }
      bufferProsa = linea;
    } else {
      if (bufferProsa) {
        bufferProsa += ' ' + linea;
      } else {
        bufferProsa = linea;
      }
    }
  }

  if (bufferProsa) {
    lineasProcesadas.push(bufferProsa);
  }

  return lineasProcesadas.join('\n').trim();
}

export function limpiarTextoAS400EnTextarea(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const original = el.value;
  const limpio = limpiarTextoAS400(original);
  if (limpio !== original) {
    el.value = limpio;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof Swal !== 'undefined') {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1600
      });
      Toast.fire({ icon: 'success', title: 'Saltos de línea AS400 limpiados' });
    }
  }
}

// -------------------------------------------------------------
// DESGLOSE INTELIGENTE DE NOMBRE DE MÉDICO
// -------------------------------------------------------------
export function desglosarNombreMedico(nombreCompleto) {
  if (!nombreCompleto) return { primerNombre: '', primerApellido: '', segundoApellido: '' };
  let limpio = String(nombreCompleto).replace(/^(DR\.|DRA\.|MED\.|MD\.)\s+/i, '').trim();
  const partes = limpio.split(/\s+/).filter(Boolean);
  if (partes.length === 0) {
    return { primerNombre: '', primerApellido: '', segundoApellido: '' };
  }
  if (partes.length === 1) {
    return { primerNombre: partes[0], primerApellido: '', segundoApellido: '' };
  }
  if (partes.length === 2) {
    return { primerNombre: partes[0], primerApellido: partes[1], segundoApellido: '' };
  }
  if (partes.length === 3) {
    return { primerNombre: partes[0], primerApellido: partes[1], segundoApellido: partes[2] };
  }
  // 4 o más palabras: ej "JUAN CARLOS PEREZ LOPEZ" -> "JUAN CARLOS", "PEREZ", "LOPEZ"
  const segundoApellido = partes[partes.length - 1];
  const primerApellido = partes[partes.length - 2];
  const primerNombre = partes.slice(0, partes.length - 2).join(' ');
  return { primerNombre, primerApellido, segundoApellido };
}

// -------------------------------------------------------------
// RECOPILACIÓN DE DATOS DEL FORMULARIO DE EPICRISIS
// -------------------------------------------------------------
export function recopilarDatosEpicrisis() {
  const d = {};

  // 1. Datos Generales (Predeterminados IESS y Hospital Portoviejo)
  let inst = getVal('institucion') || 'IESS';
  if (/instituto\s+ecuatoriano\s+de\s+seguridad\s+social/i.test(inst) || /iess/i.test(inst)) {
    inst = 'IESS';
  }
  d.institucion = inst;
  d.establecimiento = getVal('establecimiento') || 'HOSPITAL GENERAL PORTOVIEJO';
  d.unicodigo = getVal('epicrisis_unicodigo') || '13D01';
  d.archivo = getVal('cedula') || getVal('historia_clinica') || getVal('epicrisis_archivo');
  d.hcu = getVal('historia_clinica') || getVal('cedula') || getVal('epicrisis_hcu');
  d.numero_hoja = getVal('epicrisis_num_hoja') || '1';

  d.primer_apellido = getVal('primer_apellido');
  d.segundo_apellido = getVal('segundo_apellido');
  d.primer_nombre = getVal('primer_nombre');
  d.segundo_nombre = getVal('segundo_nombre');
  d.sexo = getVal('sexo');
  d.edad = getVal('edad_epicrisis') || getVal('edad');
  d.condicion_edad = getVal('condicion_edad_epicrisis') || getVal('condicion_edad') || 'A';

  // 2. Secciones Clínicas Hoja 1
  d.cuadro_clinico = getVal('epicrisis_cuadro_clinico');
  d.evolucion = getVal('epicrisis_evolucion') || d.cuadro_clinico;
  d.hallazgos = getVal('epicrisis_hallazgos');

  // 3. Secciones Clínicas Hoja 2
  d.tratamiento = getVal('epicrisis_tratamiento');
  // Indicaciones predeterminadas solicitadas por el usuario
  d.indicaciones_alta = getVal('epicrisis_indicaciones_alta') || 'PACIENTE HEMODINAMICAMENTE INESTABLE';

  // 4. Diagnósticos y CIE
  d.diag_principal = getVal('epicrisis_diag_principal');
  d.cie_principal = getVal('epicrisis_cie_principal');

  d.diag_sec_1 = getVal('epicrisis_diag_sec_1');
  d.cie_sec_1 = getVal('epicrisis_cie_sec_1');
  d.diag_sec_2 = getVal('epicrisis_diag_sec_2');
  d.cie_sec_2 = getVal('epicrisis_cie_sec_2');
  d.diag_sec_3 = getVal('epicrisis_diag_sec_3');
  d.cie_sec_3 = getVal('epicrisis_cie_sec_3');
  d.diag_sec_4 = getVal('epicrisis_diag_sec_4');
  d.cie_sec_4 = getVal('epicrisis_cie_sec_4');
  d.diag_sec_5 = getVal('epicrisis_diag_sec_5');
  d.cie_sec_5 = getVal('epicrisis_cie_sec_5');

  d.diag_causa_ext = getVal('epicrisis_diag_causa_ext');
  d.cie_causa_ext = getVal('epicrisis_cie_causa_ext');

  // 5. Condición de Alta / Egreso
  const condVital = (getVal('epicrisis_cond_vital') || 'VIVO').toUpperCase();
  d.cond_vital = condVital;
  d.cond_vivo = condVital === 'VIVO';
  d.cond_fallecido = condVital === 'FALLECIDO';

  d.tipo_alta = getVal('epicrisis_tipo_alta') || 'NO_APLICA';
  d.dias_estada = getVal('epicrisis_dias_estada') || '';
  d.dias_reposo = getVal('epicrisis_dias_reposo') || '';

  // 6. Médico Tratante Principal (repartido automáticamente y pedido por bloques)
  const med1PrimerNombre = getVal('epicrisis_med1_primer_nombre');
  const med1SegundoNombre = getVal('epicrisis_med1_segundo_nombre');
  const med1PrimerApe = getVal('epicrisis_med1_primer_ape');
  const med1SegundoApe = getVal('epicrisis_med1_segundo_ape');

  let medicoNombre = [med1PrimerNombre, med1SegundoNombre, med1PrimerApe, med1SegundoApe].filter(Boolean).join(' ').trim();
  if (!medicoNombre) {
    medicoNombre = getVal('epicrisis_med1_nombre') || getVal('epicrisis_medico_nombre') || getVal('medico_tratante');
  }

  const medicoDoc = getVal('epicrisis_med1_doc') || getVal('epicrisis_medico_doc');
  const medicoEsp = getVal('epicrisis_med1_esp') || getVal('epicrisis_medico_esp');
  const respFecha = getVal('fecha_atencion') || getVal('epicrisis_resp_fecha') || new Date().toISOString().slice(0, 10);
  const respHora = getVal('epicrisis_resp_hora') || new Date().toTimeString().slice(0, 5);
  const medicoPeriodo = getVal('epicrisis_med1_periodo') || getVal('epicrisis_medico_periodo') || respFecha;

  d.medico_1_nombre = medicoNombre;
  d.medico_1_esp = medicoEsp;
  d.medico_1_doc = medicoDoc;
  d.medico_1_periodo = medicoPeriodo;

  // Desglosar nombres para campos individuales de responsable (solo primer nombre en primer nombre)
  if (med1PrimerNombre || med1PrimerApe) {
    d.resp_primer_nombre = med1PrimerNombre.trim();
    d.resp_nombre = [med1PrimerNombre, med1SegundoNombre].filter(Boolean).join(' ').trim();
    d.resp_primer_ape = med1PrimerApe.trim();
    d.resp_segundo_ape = (med1SegundoApe || '').trim();
  } else {
    const desglosado = desglosarNombreMedico(medicoNombre);
    const primerNomDesg = (desglosado.primerNombre || '').split(' ')[0] || '';
    d.resp_primer_nombre = primerNomDesg;
    d.resp_nombre = getVal('epicrisis_resp_nombre') || desglosado.primerNombre;
    d.resp_primer_ape = (getVal('epicrisis_resp_primer_ape') || desglosado.primerApellido || '').trim();
    d.resp_segundo_ape = (getVal('epicrisis_resp_segundo_ape') || desglosado.segundoApellido || '').trim();
  }
  d.resp_doc = getVal('epicrisis_resp_doc') || medicoDoc;
  d.resp_fecha = respFecha;
  d.resp_hora = respHora;
  d.resp_rol = 'ELABORADO';

  // Médicos opcionales adicionales
  d.medico_2_nombre = getVal('epicrisis_med2_nombre');
  d.medico_2_esp = getVal('epicrisis_med2_esp');
  d.medico_2_doc = getVal('epicrisis_med2_doc');
  d.medico_2_periodo = getVal('epicrisis_med2_periodo');

  d.medico_3_nombre = getVal('epicrisis_med3_nombre');
  d.medico_3_esp = getVal('epicrisis_med3_esp');
  d.medico_3_doc = getVal('epicrisis_med3_doc');
  d.medico_3_periodo = getVal('epicrisis_med3_periodo');

  d.medico_4_nombre = getVal('epicrisis_med4_nombre');
  d.medico_4_esp = getVal('epicrisis_med4_esp');
  d.medico_4_doc = getVal('epicrisis_med4_doc');
  d.medico_4_periodo = getVal('epicrisis_med4_periodo');

  return d;
}

// -------------------------------------------------------------
// GENERADOR LOCAL ULTRA-RÁPIDO DE EXCEL PARA EPICRISIS (.XLSX)
// -------------------------------------------------------------
export async function procesarEpicrisisExcelLocalmente(d) {
  const arrayBuffer = await obtenerBytesPlantillaEpicrisisXlsx();
  const entries = await leerEntriesZip(arrayBuffer);

  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

  const colToNum = (col) => {
    let n = 0;
    for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
    return n;
  };
  const splitRef = (ref) => {
    if (!ref) return ['', 0];
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    return m ? [m[1], parseInt(m[2], 10)] : ['', 0];
  };

  const getOrCreateCell = (doc, ref) => {
    const [colStr, rnum] = splitRef(ref);
    const cnum = colToNum(colStr);
    const sheetData = doc.getElementsByTagNameNS(NS, 'sheetData')[0];
    const rows = sheetData.getElementsByTagNameNS(NS, 'row');
    let targetRow = null;
    for (let i = 0; i < rows.length; i++) {
      const rn = parseInt(rows[i].getAttribute('r'), 10);
      if (rn === rnum) { targetRow = rows[i]; break; }
      if (rn > rnum) {
        targetRow = doc.createElementNS(NS, 'row');
        targetRow.setAttribute('r', String(rnum));
        sheetData.insertBefore(targetRow, rows[i]);
        break;
      }
    }
    if (!targetRow) {
      targetRow = doc.createElementNS(NS, 'row');
      targetRow.setAttribute('r', String(rnum));
      sheetData.appendChild(targetRow);
    }
    const cells = targetRow.getElementsByTagNameNS(NS, 'c');
    for (let i = 0; i < cells.length; i++) {
      const rAttr = cells[i].getAttribute('r');
      if (!rAttr) continue;
      const [cCol] = splitRef(rAttr);
      const ccnum = colToNum(cCol);
      if (ccnum === cnum) return cells[i];
      if (ccnum > cnum) {
        const nc = doc.createElementNS(NS, 'c');
        nc.setAttribute('r', ref);
        targetRow.insertBefore(nc, cells[i]);
        return nc;
      }
    }
    const nc = doc.createElementNS(NS, 'c');
    nc.setAttribute('r', ref);
    targetRow.appendChild(nc);
    return nc;
  };

  const setCellValue = (doc, ref, val, forceType = null) => {
    const c = getOrCreateCell(doc, ref);
    const fEl = c.getElementsByTagNameNS(NS, 'f')[0];
    let strVal = (val === undefined || val === null) ? '' : String(val);
    strVal = strVal.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    if (fEl) {
      let vEl = c.getElementsByTagNameNS(NS, 'v')[0];
      if (!vEl) {
        vEl = doc.createElementNS(NS, 'v');
        c.appendChild(vEl);
      }
      vEl.textContent = strVal;
      if (forceType === 'b') c.setAttribute('t', 'b');
      else if (forceType === 'n') c.removeAttribute('t');
      else c.setAttribute('t', 'str');
      return;
    }

    while (c.firstChild) c.removeChild(c.firstChild);
    if (strVal === '') {
      c.removeAttribute('t');
      return;
    }
    if (forceType === 'b') {
      c.setAttribute('t', 'b');
      const vEl = doc.createElementNS(NS, 'v');
      vEl.textContent = (val === true || val === 1 || val === '1') ? '1' : '0';
      c.appendChild(vEl);
    } else if (forceType === 'n' && !isNaN(Number(strVal))) {
      c.removeAttribute('t');
      const vEl = doc.createElementNS(NS, 'v');
      vEl.textContent = String(Number(strVal));
      c.appendChild(vEl);
    } else {
      c.setAttribute('t', 'inlineStr');
      const isEl = doc.createElementNS(NS, 'is');
      const tEl = doc.createElementNS(NS, 't');
      if (strVal.includes('\n') || strVal.startsWith(' ') || strVal.endsWith(' ')) {
        tEl.setAttribute('xml:space', 'preserve');
      }
      tEl.textContent = strVal;
      isEl.appendChild(tEl);
      c.appendChild(isEl);
    }
  };

  for (const entry of entries) {
    if (entry.name === 'xl/worksheets/sheet1.xml') {
      const xmlBytes = entry.method === 8 ? await inflateRawBytes(entry.compData) : entry.compData;
      const xmlDoc = parser.parseFromString(decoder.decode(xmlBytes), 'application/xml');

      // A. DATOS DEL ESTABLECIMIENTO Y USUARIO / PACIENTE
      setCellValue(xmlDoc, 'A3', (d.institucion || 'IESS').toUpperCase());
      setCellValue(xmlDoc, 'N3', (d.unicodigo || '13D01').toUpperCase());
      setCellValue(xmlDoc, 'T3', (d.establecimiento || 'HOSPITAL GENERAL PORTOVIEJO').toUpperCase());
      setCellValue(xmlDoc, 'AH3', d.hcu || '');
      setCellValue(xmlDoc, 'AZ3', d.archivo || '');
      setCellValue(xmlDoc, 'BK3', d.numero_hoja || '1');

      setCellValue(xmlDoc, 'A6', (d.primer_apellido || '').toUpperCase());
      setCellValue(xmlDoc, 'R6', (d.segundo_apellido || '').toUpperCase());
      setCellValue(xmlDoc, 'AF6', (d.primer_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AP6', (d.segundo_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'BA6', (d.sexo ? d.sexo.charAt(0) : '').toUpperCase());
      setCellValue(xmlDoc, 'BD6', d.edad || '');

      // Condición edad: H, D, M, A -> BN6 (A), BL6 (M), BJ6 (D), BH6 (H)
      const cEdad = (d.condicion_edad || 'A').toUpperCase();
      if (cEdad === 'A') setCellValue(xmlDoc, 'BN6', 'X');
      else if (cEdad === 'M') setCellValue(xmlDoc, 'BL6', 'X');
      else if (cEdad === 'D') setCellValue(xmlDoc, 'BJ6', 'X');
      else if (cEdad === 'H') setCellValue(xmlDoc, 'BH6', 'X');

      // B, C, D
      setCellValue(xmlDoc, 'A9', d.cuadro_clinico || '');
      setCellValue(xmlDoc, 'A29', d.evolucion || d.cuadro_clinico || '');
      setCellValue(xmlDoc, 'A47', d.hallazgos || '');

      const modifiedXml = serializer.serializeToString(xmlDoc);
      entry.rawBytes = encoder.encode(modifiedXml);

    } else if (entry.name === 'xl/worksheets/sheet2.xml') {
      const xmlBytes = entry.method === 8 ? await inflateRawBytes(entry.compData) : entry.compData;
      const xmlDoc = parser.parseFromString(decoder.decode(xmlBytes), 'application/xml');

      // Encabezado Hoja 2
      setCellValue(xmlDoc, 'A3', (d.primer_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'P3', (d.primer_apellido || '').toUpperCase());
      setCellValue(xmlDoc, 'AF3', d.edad || '');
      setCellValue(xmlDoc, 'AJ3', d.hcu || '');
      setCellValue(xmlDoc, 'BD3', d.archivo || '');

      // E y F
      setCellValue(xmlDoc, 'A6', d.tratamiento || '');
      setCellValue(xmlDoc, 'A25', d.indicaciones_alta || 'PACIENTE HEMODINAMICAMENTE INESTABLE');

      // G. Diagnósticos
      setCellValue(xmlDoc, 'P38', (d.diag_principal || '').toUpperCase());
      setCellValue(xmlDoc, 'BI38', (d.cie_principal || '').toUpperCase());

      setCellValue(xmlDoc, 'P39', (d.diag_sec_1 || '').toUpperCase());
      setCellValue(xmlDoc, 'BI39', (d.cie_sec_1 || '').toUpperCase());
      setCellValue(xmlDoc, 'P40', (d.diag_sec_2 || '').toUpperCase());
      setCellValue(xmlDoc, 'BI40', (d.cie_sec_2 || '').toUpperCase());
      setCellValue(xmlDoc, 'P41', (d.diag_sec_3 || '').toUpperCase());
      setCellValue(xmlDoc, 'BI41', (d.cie_sec_3 || '').toUpperCase());
      setCellValue(xmlDoc, 'P42', (d.diag_sec_4 || '').toUpperCase());
      setCellValue(xmlDoc, 'BI42', (d.cie_sec_4 || '').toUpperCase());
      setCellValue(xmlDoc, 'P43', (d.diag_sec_5 || '').toUpperCase());
      setCellValue(xmlDoc, 'BI43', (d.cie_sec_5 || '').toUpperCase());

      setCellValue(xmlDoc, 'P44', (d.diag_causa_ext || '').toUpperCase());
      setCellValue(xmlDoc, 'BI44', (d.cie_causa_ext || '').toUpperCase());

      // H. Condición de alta
      if (d.cond_fallecido) {
        setCellValue(xmlDoc, 'BL46', 'X');
      } else {
        setCellValue(xmlDoc, 'BA46', 'X');
      }

      // Tipos de alta
      if (d.tipo_alta === 'ALTA_MEDICA') setCellValue(xmlDoc, 'J47', 'X');
      else if (d.tipo_alta === 'ASINTOMATICO') setCellValue(xmlDoc, 'U47', 'X');
      else if (d.tipo_alta === 'DISCAPACIDAD') setCellValue(xmlDoc, 'AF47', 'X');
      else if (d.tipo_alta === 'ALTA_VOLUNTARIA') setCellValue(xmlDoc, 'J48', 'X');
      else if (d.tipo_alta === 'RETIRO_NO_AUTORIZADO') setCellValue(xmlDoc, 'AP47', 'X');
      else if (d.tipo_alta === 'DEFUNCION_MENOS_48') setCellValue(xmlDoc, 'AZ47', 'X');
      else if (d.tipo_alta === 'DEFUNCION_MAS_48') setCellValue(xmlDoc, 'AZ48', 'X');

      setCellValue(xmlDoc, 'BL47', d.dias_estada || '');
      setCellValue(xmlDoc, 'BL48', d.dias_reposo || '');

      // I. Médicos tratantes (repartidos)
      setCellValue(xmlDoc, 'B54', (d.medico_1_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AD54', (d.medico_1_esp || '').toUpperCase());
      setCellValue(xmlDoc, 'AO54', d.medico_1_doc || '');
      setCellValue(xmlDoc, 'BC54', d.medico_1_periodo || d.resp_fecha || '');

      setCellValue(xmlDoc, 'B55', (d.medico_2_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AD55', (d.medico_2_esp || '').toUpperCase());
      setCellValue(xmlDoc, 'AO55', d.medico_2_doc || '');
      setCellValue(xmlDoc, 'BC55', d.medico_2_periodo || '');

      setCellValue(xmlDoc, 'B56', (d.medico_3_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AD56', (d.medico_3_esp || '').toUpperCase());
      setCellValue(xmlDoc, 'AO56', d.medico_3_doc || '');
      setCellValue(xmlDoc, 'BC56', d.medico_3_periodo || '');

      setCellValue(xmlDoc, 'B57', (d.medico_4_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AD57', (d.medico_4_esp || '').toUpperCase());
      setCellValue(xmlDoc, 'AO57', d.medico_4_doc || '');
      setCellValue(xmlDoc, 'BC57', d.medico_4_periodo || '');

      // J. Profesional responsable
      setCellValue(xmlDoc, 'A61', d.resp_fecha || '');
      setCellValue(xmlDoc, 'I61', d.resp_hora || '');
      setCellValue(xmlDoc, 'O61', (d.resp_primer_nombre || d.resp_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AI61', (d.resp_primer_ape || '').toUpperCase());
      setCellValue(xmlDoc, 'BA61', (d.resp_segundo_ape || '').toUpperCase());
      setCellValue(xmlDoc, 'A63', d.resp_doc || '');

      setCellValue(xmlDoc, 'N64', '');
      setCellValue(xmlDoc, 'AV64', '');

      const modifiedXml = serializer.serializeToString(xmlDoc);
      entry.rawBytes = encoder.encode(modifiedXml);
    }
  }

  return await construirZipDesdeEntries(entries);
}

// -------------------------------------------------------------
// GENERADOR DE PDF OFICIAL FORMULARIO 006 CON PDF-LIB
// Llenando directamente la plantilla oficial AcroForm
// -------------------------------------------------------------
export async function generarEpicrisisPdf(d) {
  const { PDFDocument, StandardFonts, rgb, TextAlignment, PDFName, PDFNumber, PDFString } = await asegurarPdfLib();
  if (!PDFDocument) throw new Error('pdf-lib no está disponible en este entorno');

  const pdfBytes = await obtenerBytesPlantillaEpicrisisPdf();
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helper para asignar valor a TextField con cálculo de fuente y tamaño
  const setTextField = (name, val, options = {}) => {
    try {
      const field = form.getTextField(name);
      if (!field) return;
      const strVal = String(val ?? '');
      if (typeof field.disableCombing === 'function') field.disableCombing();
      if (field.acroField?.dict) {
        field.acroField.dict.delete(PDFName.of('MaxLen'));
      }

      const isMulti = options.multiline || false;
      if (isMulti) {
        if (typeof field.enableMultiline === 'function') field.enableMultiline();
      }

      const align = options.align || (isMulti ? TextAlignment.Left : TextAlignment.Center);
      if (typeof field.setAlignment === 'function') field.setAlignment(align);

      const widgets = (field.acroField && field.acroField.getWidgets) ? field.acroField.getWidgets() : [];
      let minW = 200;
      let minH = 14;
      if (widgets.length > 0) {
        widgets.forEach(w => {
          try {
            w.dict.delete(PDFName.of('MaxLen'));
            const r = w.getRectangle();
            if (r && r.width > 0 && r.height > 0) {
              if (r.width < minW) minW = r.width;
              if (r.height < minH) minH = r.height;
            }
          } catch (_) {}
        });
      }

      let fs = options.fontSize || (isMulti ? 7.5 : 7.0);
      const minFs = options.minFontSize || 4.5;
      const fontUse = options.bold ? helveticaBold : helvetica;

      if (!isMulti && strVal.length > 0) {
        const dispW = Math.max(5, minW - 3);
        while (fs > minFs && fontUse.widthOfTextAtSize(strVal, fs) > dispW) {
          fs = Number((fs - 0.2).toFixed(1));
        }
      }

      field.setText(strVal);
      field.setFontSize(fs);
      field.updateAppearances(fontUse);
    } catch (e) {
      console.warn(`Aviso al establecer campo ${name}:`, e);
    }
  };

  // Helper para checkboxes
  const setCheckBox = (name, isChecked) => {
    try {
      const cb = form.getCheckBox(name);
      if (cb) {
        if (isChecked) cb.check();
        else cb.uncheck();
      }
    } catch (e) {
      try {
        const tf = form.getTextField(name);
        if (tf) tf.setText(isChecked ? 'X' : '');
      } catch (_) {}
    }
  };

  // 1. Hoja 1 - Encabezado
  setTextField('INSTITUCIÓN DEL SISTEMARow1', (d.institucion || 'IESS').toUpperCase(), { bold: true });
  setTextField('UNICÓDIGORow1', (d.unicodigo || '13D01').toUpperCase(), { bold: true });
  setTextField('ESTABLECIMIENTO DE SALUDRow1', (d.establecimiento || 'HOSPITAL GENERAL PORTOVIEJO').toUpperCase(), { bold: true });
  setTextField('NÚMERO DE HISTORIA CLÍNICA ÚNICARow1', d.hcu || '', { bold: true });
  setTextField('NÚMERO DE ARCHIVORow1', d.archivo || '', { bold: true });
  setTextField('No HOJARow1', d.numero_hoja || '1', { bold: true });

  setTextField('PRIMER APELLIDORow1', (d.primer_apellido || '').toUpperCase(), { bold: true });
  setTextField('SEGUNDO APELLIDORow1', (d.segundo_apellido || '').toUpperCase(), { bold: true });
  setTextField('PRIMER NOMBRERow1', (d.primer_nombre || '').toUpperCase(), { bold: true });
  setTextField('SEGUNDO NOMBRERow1', (d.segundo_nombre || '').toUpperCase(), { bold: true });
  setTextField('SEXORow1', (d.sexo ? d.sexo.charAt(0) : '').toUpperCase(), { bold: true });
  setTextField('EDADRow1', d.edad || '', { bold: true });

  // Condición de edad (checkboxes)
  const condEdad = (d.condicion_edad || 'A').toUpperCase();
  setCheckBox('condicion edad_años', condEdad === 'A');
  setCheckBox('condicion edad_meses', condEdad === 'M');
  setCheckBox('condicion edad_dias', condEdad === 'D');
  setCheckBox('condicion edad_horas', condEdad === 'H');

  // 2. Hoja 1 - Secciones Clínicas
  setTextField('resumen cuadro clinico', d.cuadro_clinico || '', { multiline: true, fontSize: 7.5 });
  setTextField('resumen de evolucion y complicaciones', d.evolucion || d.cuadro_clinico || '', { multiline: true, fontSize: 7.5 });
  setTextField('hallazgos relevantes de examenes', d.hallazgos || '', { multiline: true, fontSize: 7.5 });

  // 3. Hoja 2 - Encabezado
  setTextField('PRIMER APELLIDORow1_2', (d.primer_nombre || '').toUpperCase(), { bold: true });
  setTextField('PRIMER NOMBRERow1_2', (d.primer_apellido || '').toUpperCase(), { bold: true });
  setTextField('EDADRow1_2', d.edad || '', { bold: true });
  setTextField('NÚMERO DE HISTORIA CLÍNICA ÚNICARow1_2', d.hcu || '', { bold: true });
  setTextField('NÚMERO DE ARCHIVORow1_2', d.archivo || '', { bold: true });

  // 4. Hoja 2 - Tratamiento e Indicaciones
  setTextField('resumen de tratamiento', d.tratamiento || '', { multiline: true, fontSize: 7.5 });
  setTextField('indicaciones de alta/egreso', d.indicaciones_alta || 'PACIENTE HEMODINAMICAMENTE INESTABLE', { multiline: true, fontSize: 7.5, align: TextAlignment.Center });

  // 5. Hoja 2 - Diagnósticos y CIE-10
  setTextField('DIAGNÓSTICO PRINCIPAL', (d.diag_principal || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('CIEDIAGNÓSTICO PRINCIPAL', (d.cie_principal || '').toUpperCase(), { bold: true });

  setTextField('DIAGNÓSTICO SECUNDARIO', (d.diag_sec_1 || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('CIEDIAGNÓSTICO SECUNDARIO', (d.cie_sec_1 || '').toUpperCase(), { bold: true });

  setTextField('DIAGNÓSTICO SECUNDARIO_2', (d.diag_sec_2 || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('CIEDIAGNÓSTICO SECUNDARIO_2', (d.cie_sec_2 || '').toUpperCase(), { bold: true });

  setTextField('DIAGNÓSTICO SECUNDARIO_3', (d.diag_sec_3 || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('CIEDIAGNÓSTICO SECUNDARIO_3', (d.cie_sec_3 || '').toUpperCase(), { bold: true });

  setTextField('DIAGNÓSTICO SECUNDARIO_4', (d.diag_sec_4 || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('CIEDIAGNÓSTICO SECUNDARIO_4', (d.cie_sec_4 || '').toUpperCase(), { bold: true });

  setTextField('DIAGNÓSTICO SECUNDARIO_5', (d.diag_sec_5 || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('CIEDIAGNÓSTICO SECUNDARIO_5', (d.cie_sec_5 || '').toUpperCase(), { bold: true });

  setTextField('CAUSA EXTERNA', (d.diag_causa_ext || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('CIECAUSA EXTERNA', (d.cie_causa_ext || '').toUpperCase(), { bold: true });

  // 6. Hoja 2 - Condición al Egreso
  setCheckBox('vivo', d.cond_vivo !== false);
  setCheckBox('fallecido', d.cond_fallecido === true);

  // 7. Hoja 2 - Médicos Tratantes
  setTextField('medico tratante_1_nombre', (d.medico_1_nombre || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('medico tratante_1_especialidad', (d.medico_1_esp || '').toUpperCase());
  setTextField('medico tratante_1_cedula', d.medico_1_doc || '');
  setTextField('medico tratante_1_periodo responsabilidad', d.medico_1_periodo || d.resp_fecha || '');

  setTextField('medico tratante_2_nombre', (d.medico_2_nombre || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('medico tratante_2_especialidad', (d.medico_2_esp || '').toUpperCase());
  setTextField('medico tratante_2_cedula', d.medico_2_doc || '');
  setTextField('medico tratante_2_periodo responsabilidad', d.medico_2_periodo || '');

  setTextField('medico tratante_3_nombre', (d.medico_3_nombre || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('medico tratante_3_especialidad', (d.medico_3_esp || '').toUpperCase());
  setTextField('medico tratante_3_cedula', d.medico_3_doc || '');
  setTextField('medico tratante_3_periodo responsabilidad', d.medico_3_periodo || '');

  setTextField('medico tratante_4_nombre', (d.medico_4_nombre || '').toUpperCase(), { align: TextAlignment.Left });
  setTextField('medico tratante_4_especialidad', (d.medico_4_esp || '').toUpperCase());
  setTextField('medico tratante_4_cedula', d.medico_4_doc || '');
  setTextField('medico tratante_4_periodo responsabilidad', d.medico_4_periodo || '');

  // 8. Hoja 2 - Profesional Responsable
  setTextField('FECHA aaaammddRow1', d.resp_fecha || '');
  setTextField('HORA hhmmRow1', d.resp_hora || '');
  setTextField('PRIMER NOMBRE medico', (d.resp_primer_nombre || d.resp_nombre || '').toUpperCase());
  setTextField('PRIMER apellido medico', (d.resp_primer_ape || '').toUpperCase());
  setTextField('segundo apellido medico', (d.resp_segundo_ape || '').toUpperCase());
  setTextField('NÚMERO DE DOCUMENTO DE IDENTIFICACIÓN medico', d.resp_doc || '');
  setTextField('ELABORADO POR', '');
  setTextField('REVISADO POR', '');

  // Aplanar formulario para máxima fidelidad visual oficial
  try {
    form.flatten();
  } catch (errFlatten) {
    console.warn('Aviso al aplanar formulario PDF:', errFlatten);
  }

  const pdfSalidaBytes = await pdfDoc.save();
  return new Blob([pdfSalidaBytes], { type: 'application/pdf' });
}

// -------------------------------------------------------------
// DESCARGA SEGURA DE EPICRISIS (EXCEL Y PDF)
// -------------------------------------------------------------
export async function descargarEpicrisisSegura(formato = 'excel') {
  if (!getVal('primer_apellido') || !getVal('primer_nombre')) {
    Swal.fire({
      icon: 'warning',
      title: 'Datos Incompletos',
      text: 'Por favor, ingrese al menos el Primer Apellido y Primer Nombre del paciente.'
    });
    return;
  }

  const d = recopilarDatosEpicrisis();
  const aCed = (d.archivo || d.hcu || 'SIN_CEDULA').replace(/\s+/g, '_');
  const aApe = (d.primer_apellido || '').replace(/\s+/g, '_');
  const aNom = (d.primer_nombre || '').replace(/\s+/g, '_');

  try {
    mostrarLoader(formato === 'excel' ? 'Generando Excel Oficial (Formulario 006)...' : 'Generando PDF Oficial (Formulario 006)...');

    let blobFinal;
    let extension;
    if (formato === 'excel') {
      blobFinal = await procesarEpicrisisExcelLocalmente(d);
      extension = 'xlsx';
    } else {
      blobFinal = await generarEpicrisisPdf(d);
      extension = 'pdf';
    }

    const fileName = `Epicrisis_006_${aCed}_${aApe}_${aNom}.${extension}`;
    const url = URL.createObjectURL(blobFinal);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);

    ocultarLoader();
    Swal.fire({
      icon: 'success',
      title: 'Documento Generado',
      text: `Se descargó exitosamente ${fileName}`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    ocultarLoader();
    console.error('Error al generar Epicrisis:', err);
    Swal.fire({
      icon: 'error',
      title: 'Error al Generar',
      text: `Ocurrió un error: ${err.message || err}`
    });
  }
}

// -------------------------------------------------------------
// GESTIÓN DE MÉDICOS TRATANTES ADICIONALES
// -------------------------------------------------------------
export function agregarMedicoAdicional() {
  const bloques = [
    document.getElementById('bloqueMedico2'),
    document.getElementById('bloqueMedico3'),
    document.getElementById('bloqueMedico4')
  ];
  for (const b of bloques) {
    if (b && (b.style.display === 'none' || (typeof window !== 'undefined' && window.getComputedStyle && window.getComputedStyle(b).display === 'none'))) {
      b.style.display = 'block';
      const inp = b.querySelector('input');
      if (inp) inp.focus();
      return;
    }
  }
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: 'info',
      title: 'Límite alcanzado',
      text: 'El Formulario 006 admite un máximo de 4 médicos tratantes.'
    });
  }
}

export function eliminarMedicoAdicional(num) {
  const b = document.getElementById(`bloqueMedico${num}`);
  if (b) {
    b.style.display = 'none';
    const inputs = b.querySelectorAll('input');
    inputs.forEach(inp => {
      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
}

// -------------------------------------------------------------
// VINCULACIÓN EN TIEMPO REAL: PUNTO B -> PUNTO C
// -------------------------------------------------------------
let _usuarioEditoEvolucionManualmente = false;

export function inicializarEventosEpicrisis() {
  const txtCuadro = document.getElementById('epicrisis_cuadro_clinico');
  const txtEvolucion = document.getElementById('epicrisis_evolucion');

  if (txtCuadro && txtEvolucion) {
    txtEvolucion.addEventListener('input', () => {
      _usuarioEditoEvolucionManualmente = (txtEvolucion.value !== txtCuadro.value);
    });

    txtCuadro.addEventListener('input', () => {
      if (!_usuarioEditoEvolucionManualmente) {
        txtEvolucion.value = txtCuadro.value;
        txtEvolucion.dispatchEvent(new Event('input', { bubbles: true }));
        txtEvolucion.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  // Sincronización automática de médico tratante principal desde bloques
  const pNomEl = document.getElementById('epicrisis_med1_primer_nombre');
  const sNomEl = document.getElementById('epicrisis_med1_segundo_nombre');
  const pApeEl = document.getElementById('epicrisis_med1_primer_ape');
  const sApeEl = document.getElementById('epicrisis_med1_segundo_ape');
  const medDocEl = document.getElementById('epicrisis_med1_doc');

  function sincronizarMedicoPrincipalDesdeBloques() {
    const pNom = (pNomEl?.value || '').trim();
    const sNom = (sNomEl?.value || '').trim();
    const pApe = (pApeEl?.value || '').trim();
    const sApe = (sApeEl?.value || '').trim();
    const nombreCompleto = [pNom, sNom, pApe, sApe].filter(Boolean).join(' ');

    const hiddenMed1 = document.getElementById('epicrisis_med1_nombre');
    if (hiddenMed1) hiddenMed1.value = nombreCompleto;

    const respNom = document.getElementById('epicrisis_resp_nombre');
    const respApe1 = document.getElementById('epicrisis_resp_primer_ape');
    const respApe2 = document.getElementById('epicrisis_resp_segundo_ape');
    if (respNom && !respNom.dataset.edited) respNom.value = [pNom, sNom].filter(Boolean).join(' ');
    if (respApe1 && !respApe1.dataset.edited) respApe1.value = pApe;
    if (respApe2 && !respApe2.dataset.edited) respApe2.value = sApe;
  }

  [pNomEl, sNomEl, pApeEl, sApeEl].forEach(el => {
    if (el) el.addEventListener('input', sincronizarMedicoPrincipalDesdeBloques);
  });

  if (medDocEl) {
    medDocEl.addEventListener('input', () => {
      const respDoc = document.getElementById('epicrisis_resp_doc');
      if (respDoc && !respDoc.dataset.edited) respDoc.value = medDocEl.value;
    });
  }

  // Sincronización fallback en caso de med1_nombre unificado
  const medNombre = document.getElementById('epicrisis_med1_nombre');
  if (medNombre && !pNomEl && !pApeEl) {
    medNombre.addEventListener('input', () => {
      const { primerNombre, primerApellido, segundoApellido } = desglosarNombreMedico(medNombre.value);
      const respNom = document.getElementById('epicrisis_resp_nombre');
      const respApe1 = document.getElementById('epicrisis_resp_primer_ape');
      const respApe2 = document.getElementById('epicrisis_resp_segundo_ape');
      if (respNom && !respNom.dataset.edited) respNom.value = primerNombre;
      if (respApe1 && !respApe1.dataset.edited) respApe1.value = primerApellido;
      if (respApe2 && !respApe2.dataset.edited) respApe2.value = segundoApellido;
    });
  }

  // Marcar si el usuario edita manualmente los campos desglosados de responsable
  ['epicrisis_resp_nombre', 'epicrisis_resp_primer_ape', 'epicrisis_resp_segundo_ape', 'epicrisis_resp_doc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => { el.dataset.edited = 'true'; });
    }
  });

  // Sincronizar fecha única superior con campos internos de fecha de epicrisis
  const fAteEl = document.getElementById('fecha_atencion');
  const respFechaEl = document.getElementById('epicrisis_resp_fecha');
  const medPeriodoEl = document.getElementById('epicrisis_med1_periodo');
  if (fAteEl) {
    const sincronizarFechaEpicrisis = () => {
      const val = fAteEl.value;
      if (respFechaEl) respFechaEl.value = val;
      if (medPeriodoEl) medPeriodoEl.value = val;
    };
    fAteEl.addEventListener('input', sincronizarFechaEpicrisis);
    fAteEl.addEventListener('change', sincronizarFechaEpicrisis);
    sincronizarFechaEpicrisis();
  }

  inicializarBuscadorCie10Epicrisis();
}

// -------------------------------------------------------------
// CATÁLOGO LOCAL CIE-10 Y BUSCADOR INTELIGENTE OFFLINE
// -------------------------------------------------------------
let cie10Index = null;
let cie10Cargando = false;

export function formatearCie10Codigo(c) {
  if (!c) return '';
  const s = String(c).trim().toUpperCase();
  if (s.length === 4 && !s.includes('.') && /^[A-Z][0-9]{3}$/.test(s)) {
    return s.slice(0, 3) + '.' + s.slice(3);
  }
  return s;
}

export function normalizarParaBusqueda(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function cargarCatalogoCie10Local() {
  if (cie10Index) return cie10Index;
  if (cie10Cargando) {
    while (cie10Cargando) await new Promise(r => setTimeout(r, 50));
    return cie10Index;
  }
  cie10Cargando = true;
  try {
    let raw;
    if (typeof fetch === 'function') {
      try {
        const res = await fetch('./cie10.json');
        if (res.ok) raw = await res.json();
      } catch (_) {}
    }
    // Compatibilidad en entorno Node.js / pruebas unitarias
    if (!raw && typeof process !== 'undefined') {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const ciePath = path.resolve(process.cwd(), 'cie10.json');
        if (fs.existsSync(ciePath)) {
          raw = JSON.parse(fs.readFileSync(ciePath, 'utf8'));
        }
      } catch (_) {}
    }
    if (!raw) throw new Error('No se pudo cargar cie10.json');

    cie10Index = raw.map(item => {
      const cRaw = item.c;
      const cFmt = formatearCie10Codigo(cRaw);
      const desc = (item.d || '').toUpperCase();
      return {
        c: cRaw,
        cFmt: cFmt,
        d: desc,
        cLower: cRaw.toLowerCase(),
        cFmtLower: cFmt.toLowerCase(),
        searchCode: normalizarParaBusqueda(cRaw + ' ' + cFmt),
        searchDesc: normalizarParaBusqueda(desc)
      };
    });
  } catch (err) {
    console.error('Error cargando catálogo CIE-10 local:', err);
  } finally {
    cie10Cargando = false;
  }
  return cie10Index;
}

export function buscarCie10(query, maxResultados = 30) {
  if (!cie10Index || !query) return [];
  const qNorm = normalizarParaBusqueda(query);
  if (qNorm.length < 1) return [];
  const qSinPunto = qNorm.replace(/\./g, '').replace(/\s+/g, '');
  const esUnSoloCaracter = qSinPunto.length === 1;
  const esBusquedaCodigo = /^[a-z][0-9]|^[a-z]$/i.test(qSinPunto);

  // Cubetas priorizadas para garantizar que los códigos coincidentes nunca sufran inanición
  const exactos = [];     // Score 100: Coincidencia de prefijo de código o inicio de descripción
  const secundarios = []; // Score 70-85: Subcódigo o palabra de descripción
  const terciarios = [];  // Score 40-60: Subcadena en descripción o código

  for (let i = 0; i < cie10Index.length; i++) {
    const item = cie10Index[i];
    const cLow = item.cLower || item.c.toLowerCase();
    const cFmtLow = item.cFmtLower || item.cFmt.toLowerCase();

    if (esBusquedaCodigo) {
      if (cLow.startsWith(qSinPunto) || cFmtLow.startsWith(qNorm)) {
        exactos.push({ ...item, score: 100 });
      } else if (!esUnSoloCaracter && (item.searchCode.includes(qSinPunto) || item.searchCode.includes(qNorm))) {
        secundarios.push({ ...item, score: 80 });
      } else if (!esUnSoloCaracter && item.searchDesc.includes(qNorm)) {
        terciarios.push({ ...item, score: 50 });
      } else if (esUnSoloCaracter && (item.searchDesc.startsWith(qNorm) || item.searchDesc.includes(' ' + qNorm))) {
        terciarios.push({ ...item, score: 40 });
      }
    } else {
      if (item.searchDesc.startsWith(qNorm)) {
        exactos.push({ ...item, score: 100 });
      } else if (item.searchDesc.includes(' ' + qNorm)) {
        secundarios.push({ ...item, score: 85 });
      } else if (item.searchDesc.includes(qNorm)) {
        terciarios.push({ ...item, score: 70 });
      } else if (item.searchCode.includes(qSinPunto) || item.searchCode.includes(qNorm)) {
        terciarios.push({ ...item, score: 60 });
      }
    }
  }

  const resultados = exactos.concat(secundarios, terciarios);
  return resultados.slice(0, maxResultados);
}

const PAREJAS_DIAGNOSTICO_EPICRISIS = [
  { descId: 'epicrisis_diag_principal', cieId: 'epicrisis_cie_principal' },
  { descId: 'epicrisis_diag_sec_1', cieId: 'epicrisis_cie_sec_1' },
  { descId: 'epicrisis_diag_sec_2', cieId: 'epicrisis_cie_sec_2' },
  { descId: 'epicrisis_diag_sec_3', cieId: 'epicrisis_cie_sec_3' },
  { descId: 'epicrisis_diag_sec_4', cieId: 'epicrisis_cie_sec_4' },
  { descId: 'epicrisis_diag_sec_5', cieId: 'epicrisis_cie_sec_5' },
  { descId: 'epicrisis_diag_causa_ext', cieId: 'epicrisis_cie_causa_ext' }
];

export function inicializarBuscadorCie10Epicrisis() {
  cargarCatalogoCie10Local();

  PAREJAS_DIAGNOSTICO_EPICRISIS.forEach(({ descId, cieId }) => {
    const descInput = document.getElementById(descId);
    const cieInput = document.getElementById(cieId);
    if (!descInput || !cieInput) return;

    configurarAutocompleteInput(descInput, descInput, cieInput);
    configurarAutocompleteInput(cieInput, descInput, cieInput);

    cieInput.addEventListener('blur', () => {
      const val = cieInput.value.trim();
      const fmt = formatearCie10Codigo(val);
      if (fmt !== val) {
        cieInput.value = fmt;
        cieInput.dispatchEvent(new Event('input', { bubbles: true }));
        cieInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
}

function configurarAutocompleteInput(inputElement, descInput, cieInput) {
  const container = inputElement.parentElement;
  if (!container) return;

  let menu = container.querySelector('.cie10-autocomplete-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.className = 'cie10-autocomplete-menu';
    container.appendChild(menu);
  }

  let indiceActivo = -1;

  function renderResultados(resultados) {
    menu.innerHTML = '';
    indiceActivo = -1;

    if (!resultados || resultados.length === 0) {
      const noRes = document.createElement('div');
      noRes.className = 'cie10-no-results';
      noRes.textContent = 'Sin coincidencias CIE-10';
      menu.appendChild(noRes);
      menu.style.display = 'block';
      return;
    }

    resultados.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'cie10-autocomplete-item';
      row.dataset.index = idx;

      const badge = document.createElement('span');
      badge.className = 'cie10-code-badge';
      badge.textContent = item.cFmt;

      const desc = document.createElement('span');
      desc.className = 'cie10-desc-text';
      desc.textContent = item.d;

      row.appendChild(badge);
      row.appendChild(desc);

      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        seleccionarItem(item);
      });

      menu.appendChild(row);
    });

    menu.style.display = 'block';
  }

  function seleccionarItem(item) {
    descInput.value = item.d;
    cieInput.value = item.cFmt;
    descInput.dispatchEvent(new Event('input', { bubbles: true }));
    descInput.dispatchEvent(new Event('change', { bubbles: true }));
    cieInput.dispatchEvent(new Event('input', { bubbles: true }));
    cieInput.dispatchEvent(new Event('change', { bubbles: true }));
    cerrarMenu();
  }

  function cerrarMenu() {
    menu.style.display = 'none';
    menu.innerHTML = '';
    indiceActivo = -1;
  }

  function actualizarSeleccionTeclado(items) {
    items.forEach((el, idx) => {
      if (idx === indiceActivo) {
        el.classList.add('active');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });
  }

  inputElement.addEventListener('input', async () => {
    const val = inputElement.value.trim();
    if (val.length < 1) {
      cerrarMenu();
      return;
    }

    if (!cie10Index) {
      await cargarCatalogoCie10Local();
    }

    const res = buscarCie10(val, 25);
    renderResultados(res);
  });

  inputElement.addEventListener('focus', async () => {
    const val = inputElement.value.trim();
    if (val.length >= 1) {
      if (!cie10Index) await cargarCatalogoCie10Local();
      const res = buscarCie10(val, 25);
      renderResultados(res);
    }
  });

  inputElement.addEventListener('keydown', (e) => {
    if (menu.style.display !== 'block') return;
    const items = menu.querySelectorAll('.cie10-autocomplete-item');
    if (!items || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      indiceActivo = (indiceActivo + 1) % items.length;
      actualizarSeleccionTeclado(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      indiceActivo = (indiceActivo - 1 + items.length) % items.length;
      actualizarSeleccionTeclado(items);
    } else if (e.key === 'Enter') {
      if (indiceActivo >= 0 && indiceActivo < items.length) {
        e.preventDefault();
        items[indiceActivo].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cerrarMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      cerrarMenu();
    }
  });
}

// Exponer en window para llamadas desde botones inline y eventos DOM
if (typeof window !== 'undefined') {
  window.descargarEpicrisisSegura = descargarEpicrisisSegura;
  window.recopilarDatosEpicrisis = recopilarDatosEpicrisis;
  window.cargarCatalogoCie10Local = cargarCatalogoCie10Local;
  window.buscarCie10 = buscarCie10;
  window.formatearCie10Codigo = formatearCie10Codigo;
  window.inicializarBuscadorCie10Epicrisis = inicializarBuscadorCie10Epicrisis;
  window.limpiarTextoAS400 = limpiarTextoAS400;
  window.limpiarTextoAS400EnTextarea = limpiarTextoAS400EnTextarea;
  window.desglosarNombreMedico = desglosarNombreMedico;
  window.agregarMedicoAdicional = agregarMedicoAdicional;
  window.eliminarMedicoAdicional = eliminarMedicoAdicional;
}

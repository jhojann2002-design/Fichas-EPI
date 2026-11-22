// js/epicrisis.js - Lógica, Generación de Excel y PDF para Formulario 006 (Epicrisis MSP)
let PDFDocument, StandardFonts, rgb;
async function asegurarPdfLib() {
  if (PDFDocument) return { PDFDocument, StandardFonts, rgb };
  if (typeof window !== 'undefined') {
    const mod = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
    PDFDocument = mod.PDFDocument;
    StandardFonts = mod.StandardFonts;
    rgb = mod.rgb;
  }
  return { PDFDocument, StandardFonts, rgb };
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

let _cacheEpicrisisXlsxBytes = null;

/**
 * Obtiene los bytes de la plantilla XLSX (con caché en memoria)
 */
async function obtenerBytesPlantillaEpicrisis() {
  if (_cacheEpicrisisXlsxBytes) return _cacheEpicrisisXlsxBytes;
  const res = await fetch('./plantilla_epicrisis.xlsx');
  if (!res.ok) throw new Error('No se pudo cargar la plantilla plantilla_epicrisis.xlsx');
  const buf = await res.arrayBuffer();
  _cacheEpicrisisXlsxBytes = buf;
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
    let compSize = entry.compSize;
    const uncompSize = entry.uncompSize;
    const crc = entry.crc;

    if (entry.isModified) {
      const def = await deflateRawBytes(entry.rawBytes);
      if (def && def.length < entry.rawBytes.length) {
        method = 8;
        compData = def;
        compSize = def.length;
      } else {
        method = 0;
        compData = entry.rawBytes;
        compSize = entry.rawBytes.length;
      }
    }

    const localHdr = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(localHdr.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true);
    ldv.setUint16(6, 0, true);
    ldv.setUint16(8, method, true);
    ldv.setUint16(10, 0, true);
    ldv.setUint16(12, 0, true);
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, compSize, true);
    ldv.setUint32(22, uncompSize, true);
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true);
    localHdr.set(nameBytes, 30);

    const cdHdr = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cdHdr.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, method, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0, true);
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
    cdHdr.set(nameBytes, 46);

    localParts.push(localHdr, compData);
    cdParts.push(cdHdr);
    offset += localHdr.length + compData.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of cdParts) cdSize += c.length;

  const validEntriesCount = entries.filter(e => !e.name.endsWith('/')).length;
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true);
  edv.setUint16(6, 0, true);
  edv.setUint16(8, validEntriesCount, true);
  edv.setUint16(10, validEntriesCount, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, cdStart, true);
  edv.setUint16(20, 0, true);

  return new Blob([...localParts, ...cdParts, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

// -------------------------------------------------------------
// RECOPILACIÓN DE DATOS DEL FORMULARIO DE EPICRISIS
// -------------------------------------------------------------
export function recopilarDatosEpicrisis() {
  const d = {};

  // 1. Datos Generales (reutilizados del formulario base)
  d.institucion = getVal('institucion');
  d.establecimiento = getVal('establecimiento');
  d.unicodigo = getVal('epicrisis_unicodigo') || '';
  d.hcu = getVal('epicrisis_hcu') || getVal('cedula');
  d.archivo = getVal('epicrisis_archivo') || getVal('cedula');
  d.numero_hoja = getVal('epicrisis_num_hoja') || '1';

  d.primer_apellido = getVal('primer_apellido');
  d.segundo_apellido = getVal('segundo_apellido');
  d.primer_nombre = getVal('primer_nombre');
  d.segundo_nombre = getVal('segundo_nombre');
  d.sexo = getVal('sexo'); // M o F
  d.edad = getVal('edad');
  d.condicion_edad = getVal('condicion_edad') || 'A'; // H, D, M, A

  // 2. Secciones Clínicas Hoja 1
  d.cuadro_clinico = getVal('epicrisis_cuadro_clinico');
  d.evolucion = getVal('epicrisis_evolucion');
  d.hallazgos = getVal('epicrisis_hallazgos');

  // 3. Secciones Clínicas Hoja 2
  d.tratamiento = getVal('epicrisis_tratamiento');
  d.indicaciones_alta = getVal('epicrisis_indicaciones_alta');

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
  d.cond_vivo = getVal('epicrisis_cond_vital') === 'VIVO' || !getVal('epicrisis_cond_vital');
  d.cond_fallecido = getVal('epicrisis_cond_vital') === 'FALLECIDO';

  d.tipo_alta = getVal('epicrisis_tipo_alta') || 'ALTA_MEDICA'; // ALTA_MEDICA, ALTA_VOLUNTARIA, ASINTOMATICO, DISCAPACIDAD, RETIRO_NO_AUTORIZADO, DEFUNCION_MENOS_48, DEFUNCION_MAS_48
  d.dias_estada = getVal('epicrisis_dias_estada') || '';
  d.dias_reposo = getVal('epicrisis_dias_reposo') || '';

  // 6. Médicos Tratantes (hasta 4)
  d.medico_1_nombre = getVal('epicrisis_med1_nombre');
  d.medico_1_esp = getVal('epicrisis_med1_esp');
  d.medico_1_doc = getVal('epicrisis_med1_doc');
  d.medico_1_periodo = getVal('epicrisis_med1_periodo');

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

  // 7. Profesional Responsable
  d.resp_fecha = getVal('epicrisis_resp_fecha') || new Date().toISOString().slice(0, 10);
  d.resp_hora = getVal('epicrisis_resp_hora') || new Date().toTimeString().slice(0, 5);
  d.resp_nombre = getVal('epicrisis_resp_nombre');
  d.resp_primer_ape = getVal('epicrisis_resp_primer_ape');
  d.resp_segundo_ape = getVal('epicrisis_resp_segundo_ape');
  d.resp_doc = getVal('epicrisis_resp_doc');
  d.resp_rol = getVal('epicrisis_resp_rol') || 'ELABORADO'; // ELABORADO o REVISADO

  return d;
}

// -------------------------------------------------------------
// GENERADOR LOCAL ULTRA-RÁPIDO DE EXCEL PARA EPICRISIS (.XLSX)
// -------------------------------------------------------------
export async function procesarEpicrisisExcelLocalmente(d) {
  const arrayBuffer = await obtenerBytesPlantillaEpicrisis();
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
    const strVal = (val === undefined || val === null) ? '' : String(val);

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
      if (strVal.startsWith(' ') || strVal.endsWith(' ')) {
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
      setCellValue(xmlDoc, 'A3', (d.institucion || '').toUpperCase());
      setCellValue(xmlDoc, 'N3', (d.unicodigo || '').toUpperCase());
      setCellValue(xmlDoc, 'T3', (d.establecimiento || '').toUpperCase());
      setCellValue(xmlDoc, 'AH3', d.hcu || '');
      setCellValue(xmlDoc, 'AZ3', d.archivo || '');
      setCellValue(xmlDoc, 'BK3', d.numero_hoja || '1');

      setCellValue(xmlDoc, 'A6', (d.primer_apellido || '').toUpperCase());
      setCellValue(xmlDoc, 'R6', (d.segundo_apellido || '').toUpperCase());
      setCellValue(xmlDoc, 'AF6', (d.primer_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AP6', (d.segundo_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'BA6', (d.sexo || '').toUpperCase());
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
      const rawBytes = encoder.encode(modifiedXml);
      entry.rawBytes = rawBytes;
      entry.crc = crc32Bytes(rawBytes);
      entry.uncompSize = rawBytes.length;
      entry.isModified = true;

    } else if (entry.name === 'xl/worksheets/sheet2.xml') {
      const xmlBytes = entry.method === 8 ? await inflateRawBytes(entry.compData) : entry.compData;
      const xmlDoc = parser.parseFromString(decoder.decode(xmlBytes), 'application/xml');

      // Encabezado Hoja 2
      setCellValue(xmlDoc, 'A3', (d.primer_apellido || '').toUpperCase());
      setCellValue(xmlDoc, 'P3', (d.primer_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AF3', d.edad || '');
      setCellValue(xmlDoc, 'AJ3', d.hcu || '');
      setCellValue(xmlDoc, 'BD3', d.archivo || '');

      // E y F
      setCellValue(xmlDoc, 'A6', d.tratamiento || '');
      setCellValue(xmlDoc, 'A25', d.indicaciones_alta || '');

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

      // I. Médicos tratantes
      setCellValue(xmlDoc, 'B54', (d.medico_1_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AD54', (d.medico_1_esp || '').toUpperCase());
      setCellValue(xmlDoc, 'AO54', d.medico_1_doc || '');
      setCellValue(xmlDoc, 'BC54', d.medico_1_periodo || '');

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
      setCellValue(xmlDoc, 'O61', (d.resp_nombre || '').toUpperCase());
      setCellValue(xmlDoc, 'AI61', (d.resp_primer_ape || '').toUpperCase());
      setCellValue(xmlDoc, 'BA61', (d.resp_segundo_ape || '').toUpperCase());
      setCellValue(xmlDoc, 'A63', d.resp_doc || '');

      if (d.resp_rol === 'REVISADO') {
        setCellValue(xmlDoc, 'AV64', 'X');
      } else {
        setCellValue(xmlDoc, 'N64', 'X');
      }

      const modifiedXml = serializer.serializeToString(xmlDoc);
      const rawBytes = encoder.encode(modifiedXml);
      entry.rawBytes = rawBytes;
      entry.crc = crc32Bytes(rawBytes);
      entry.uncompSize = rawBytes.length;
      entry.isModified = true;
    }
  }

  return await construirZipDesdeEntries(entries);
}

// -------------------------------------------------------------
// GENERADOR DE PDF OFICIAL FORMULARIO 006 CON PDF-LIB
// -------------------------------------------------------------
function wrapText(text, maxWidth, font, fontSize) {
  if (!text) return [];
  const lines = [];
  const paragraphs = String(text).split('\n');
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    let currentLine = '';
    for (const w of words) {
      if (!w) continue;
      const testLine = currentLine ? `${currentLine} ${w}` : w;
      if (font.widthOfTextAtSize(testLine, fontSize) <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

export async function generarEpicrisisPdf(d) {
  await asegurarPdfLib();
  if (!PDFDocument) throw new Error('pdf-lib no está disponible en este entorno');
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;  // A4
  const PAGE_HEIGHT = 841.89; // A4
  const MARGIN_X = 25;
  const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_X * 2); // 545.28

  const COLOR_HEADER_BG = rgb(0.92, 0.94, 0.96);
  const COLOR_BORDER = rgb(0.2, 0.2, 0.2);
  const COLOR_TEXT = rgb(0, 0, 0);

  // Helper para dibujar celdas con etiqueta y valor
  const drawCell = (page, x, y, w, h, label, val, isBoldVal = true, fontSizeVal = 8) => {
    page.drawRectangle({
      x, y: y - h, width: w, height: h,
      borderWidth: 0.5, borderColor: COLOR_BORDER
    });
    if (label) {
      page.drawText(label, {
        x: x + 2, y: y - 7,
        size: 5.5, font: fontBold, color: COLOR_TEXT
      });
    }
    if (val !== undefined && val !== null && val !== '') {
      page.drawText(String(val), {
        x: x + 3, y: y - h + 3,
        size: fontSizeVal, font: isBoldVal ? fontBold : fontRegular, color: COLOR_TEXT
      });
    }
  };

  const drawSectionHeader = (page, y, title) => {
    page.drawRectangle({
      x: MARGIN_X, y: y - 14, width: CONTENT_WIDTH, height: 14,
      color: COLOR_HEADER_BG, borderWidth: 0.6, borderColor: COLOR_BORDER
    });
    page.drawText(title, {
      x: MARGIN_X + 5, y: y - 10,
      size: 7.5, font: fontBold, color: COLOR_TEXT
    });
    return y - 14;
  };

  const drawTextAreaBlock = (page, y, height, text) => {
    page.drawRectangle({
      x: MARGIN_X, y: y - height, width: CONTENT_WIDTH, height,
      borderWidth: 0.5, borderColor: COLOR_BORDER
    });
    const lines = wrapText(text, CONTENT_WIDTH - 8, fontRegular, 8);
    let curY = y - 10;
    for (const line of lines) {
      if (curY < y - height + 4) break; // no desbordar
      page.drawText(line, {
        x: MARGIN_X + 4, y: curY,
        size: 8, font: fontRegular, color: COLOR_TEXT
      });
      curY -= 10;
    }
    return y - height;
  };

  // ==========================================
  // HOJA 1
  // ==========================================
  const page1 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 25;

  // Título Formulario
  page1.drawText("SNS-MSP / HCU-form.006 / 2021", {
    x: MARGIN_X, y: y, size: 7, font: fontRegular, color: COLOR_TEXT
  });
  page1.drawText("EPICRISIS (1)", {
    x: PAGE_WIDTH - MARGIN_X - 70, y: y, size: 9, font: fontBold, color: COLOR_TEXT
  });
  y -= 12;

  // Sección A
  y = drawSectionHeader(page1, y, "A. DATOS DEL ESTABLECIMIENTO Y USUARIO / PACIENTE");
  
  // Fila 1 de A: Institución, Unicódigo, Establecimiento, HCU, Archivo, No. Hoja
  const wA1 = CONTENT_WIDTH;
  drawCell(page1, MARGIN_X, y, 110, 20, "INSTITUCIÓN DEL SISTEMA", (d.institucion || '').toUpperCase(), true, 7.5);
  drawCell(page1, MARGIN_X + 110, y, 60, 20, "UNICÓDIGO", (d.unicodigo || '').toUpperCase(), true, 7.5);
  drawCell(page1, MARGIN_X + 170, y, 150, 20, "ESTABLECIMIENTO DE SALUD", (d.establecimiento || '').toUpperCase(), true, 7.5);
  drawCell(page1, MARGIN_X + 320, y, 95, 20, "No. HISTORIA CLÍNICA", d.hcu || '', true, 8);
  drawCell(page1, MARGIN_X + 415, y, 90, 20, "No. ARCHIVO", d.archivo || '', true, 8);
  drawCell(page1, MARGIN_X + 505, y, 40.28, 20, "No. HOJA", d.numero_hoja || '1', true, 8);
  y -= 20;

  // Fila 2 de A: Apellidos, Nombres, Sexo, Edad, Condición
  drawCell(page1, MARGIN_X, y, 130, 20, "PRIMER APELLIDO", (d.primer_apellido || '').toUpperCase(), true, 8);
  drawCell(page1, MARGIN_X + 130, y, 130, 20, "SEGUNDO APELLIDO", (d.segundo_apellido || '').toUpperCase(), true, 8);
  drawCell(page1, MARGIN_X + 260, y, 110, 20, "PRIMER NOMBRE", (d.primer_nombre || '').toUpperCase(), true, 8);
  drawCell(page1, MARGIN_X + 370, y, 90, 20, "SEGUNDO NOMBRE", (d.segundo_nombre || '').toUpperCase(), true, 8);
  drawCell(page1, MARGIN_X + 460, y, 35, 20, "SEXO", (d.sexo || '').toUpperCase(), true, 8);
  drawCell(page1, MARGIN_X + 495, y, 50.28, 20, `EDAD (${d.condicion_edad || 'A'})`, `${d.edad || ''}`, true, 8);
  y -= 26;

  // Sección B: Resumen del Cuadro Clínico
  y = drawSectionHeader(page1, y, "B. RESUMEN DEL CUADRO CLÍNICO");
  y = drawTextAreaBlock(page1, y, 220, d.cuadro_clinico || '');
  y -= 8;

  // Sección C: Resumen de Evolución y Complicaciones
  y = drawSectionHeader(page1, y, "C. RESUMEN DE EVOLUCIÓN Y COMPLICACIONES");
  y = drawTextAreaBlock(page1, y, 220, d.evolucion || d.cuadro_clinico || '');
  y -= 8;

  // Sección D: Hallazgos Relevantes
  y = drawSectionHeader(page1, y, "D. HALLAZGOS RELEVANTES DE EXÁMENES Y PROCEDIMIENTOS DIAGNÓSTICOS");
  y = drawTextAreaBlock(page1, y, 225, d.hallazgos || '');

  // Pie de Hoja 1
  page1.drawText("SNS-MSP / HCU-form.006 / 2021", {
    x: MARGIN_X, y: 15, size: 6.5, font: fontRegular, color: rgb(0.4, 0.4, 0.4)
  });
  page1.drawText("EPICRISIS (1)", {
    x: PAGE_WIDTH - MARGIN_X - 60, y: 15, size: 7, font: fontBold, color: rgb(0.4, 0.4, 0.4)
  });

  // ==========================================
  // HOJA 2
  // ==========================================
  const page2 = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  y = PAGE_HEIGHT - 25;

  page2.drawText("DATOS DEL USUARIO / PACIENTE", {
    x: MARGIN_X, y: y, size: 7, font: fontBold, color: COLOR_TEXT
  });
  page2.drawText("EPICRISIS (2)", {
    x: PAGE_WIDTH - MARGIN_X - 70, y: y, size: 9, font: fontBold, color: COLOR_TEXT
  });
  y -= 12;

  // Encabezado Hoja 2
  drawCell(page2, MARGIN_X, y, 140, 18, "PRIMER APELLIDO", (d.primer_apellido || '').toUpperCase(), true, 7.5);
  drawCell(page2, MARGIN_X + 140, y, 140, 18, "PRIMER NOMBRE", (d.primer_nombre || '').toUpperCase(), true, 7.5);
  drawCell(page2, MARGIN_X + 280, y, 40, 18, "EDAD", d.edad || '', true, 7.5);
  drawCell(page2, MARGIN_X + 320, y, 115, 18, "No. HISTORIA CLÍNICA", d.hcu || '', true, 7.5);
  drawCell(page2, MARGIN_X + 435, y, 110.28, 18, "No. ARCHIVO", d.archivo || '', true, 7.5);
  y -= 24;

  // Sección E: Tratamiento y Procedimientos
  y = drawSectionHeader(page2, y, "E. RESUMEN DE TRATAMIENTO Y PROCEDIMIENTOS TERAPÉUTICOS");
  y = drawTextAreaBlock(page2, y, 145, d.tratamiento || '');
  y -= 8;

  // Sección F: Indicaciones de Alta
  y = drawSectionHeader(page2, y, "F. INDICACIONES DE ALTA / EGRESO");
  y = drawTextAreaBlock(page2, y, 120, d.indicaciones_alta || '');
  y -= 8;

  // Sección G: Diagnóstico de Alta / Egreso
  y = drawSectionHeader(page2, y, "G. DIAGNÓSTICO DE ALTA / EGRESO");
  
  // Encabezados tabla G
  page2.drawRectangle({
    x: MARGIN_X, y: y - 12, width: CONTENT_WIDTH, height: 12,
    color: rgb(0.96, 0.96, 0.96), borderWidth: 0.5, borderColor: COLOR_BORDER
  });
  page2.drawText("TIPO DE DIAGNÓSTICO", { x: MARGIN_X + 4, y: y - 9, size: 6, font: fontBold });
  page2.drawText("DESCRIPCIÓN DEL DIAGNÓSTICO", { x: MARGIN_X + 120, y: y - 9, size: 6, font: fontBold });
  page2.drawText("CIE-10", { x: PAGE_WIDTH - MARGIN_X - 50, y: y - 9, size: 6, font: fontBold });
  y -= 12;

  const drawDiagRow = (tipoLabel, desc, cie) => {
    drawCell(page2, MARGIN_X, y, 115, 15, null, tipoLabel, false, 7);
    drawCell(page2, MARGIN_X + 115, y, CONTENT_WIDTH - 170, 15, null, (desc || '').toUpperCase(), true, 7);
    drawCell(page2, PAGE_WIDTH - MARGIN_X - 55, y, 55, 15, null, (cie || '').toUpperCase(), true, 7.5);
    y -= 15;
  };

  drawDiagRow("DIAGNÓSTICO PRINCIPAL", d.diag_principal, d.cie_principal);
  drawDiagRow("DIAGNÓSTICO SECUNDARIO 1", d.diag_sec_1, d.cie_sec_1);
  drawDiagRow("DIAGNÓSTICO SECUNDARIO 2", d.diag_sec_2, d.cie_sec_2);
  drawDiagRow("DIAGNÓSTICO SECUNDARIO 3", d.diag_sec_3, d.cie_sec_3);
  if (d.diag_sec_4 || d.cie_sec_4) {
    drawDiagRow("DIAGNÓSTICO SECUNDARIO 4", d.diag_sec_4, d.cie_sec_4);
  }
  if (d.diag_sec_5 || d.cie_sec_5) {
    drawDiagRow("DIAGNÓSTICO SECUNDARIO 5", d.diag_sec_5, d.cie_sec_5);
  }
  drawDiagRow("CAUSA EXTERNA", d.diag_causa_ext, d.cie_causa_ext);
  y -= 6;

  // Sección H: Condición de Alta / Egreso
  y = drawSectionHeader(page2, y, "H. CONDICIÓN DE ALTA / EGRESO");
  const condVitalStr = d.cond_fallecido ? "[   ] VIVO      [ X ] FALLECIDO" : "[ X ] VIVO      [   ] FALLECIDO";
  page2.drawRectangle({
    x: MARGIN_X, y: y - 32, width: CONTENT_WIDTH, height: 32,
    borderWidth: 0.5, borderColor: COLOR_BORDER
  });
  page2.drawText(`ESTADO VITAL:   ${condVitalStr}`, {
    x: MARGIN_X + 6, y: y - 10, size: 7.5, font: fontBold
  });

  const altaMedicaChk = d.tipo_alta === 'ALTA_MEDICA' ? '[X]' : '[ ]';
  const altaVolunChk = d.tipo_alta === 'ALTA_VOLUNTARIA' ? '[X]' : '[ ]';
  const asintoChk = d.tipo_alta === 'ASINTOMATICO' ? '[X]' : '[ ]';
  const discapChk = d.tipo_alta === 'DISCAPACIDAD' ? '[X]' : '[ ]';
  const retiroChk = d.tipo_alta === 'RETIRO_NO_AUTORIZADO' ? '[X]' : '[ ]';
  
  page2.drawText(`${altaMedicaChk} ALTA MÉDICA    ${altaVolunChk} ALTA VOLUNTARIA    ${asintoChk} ASINTOMÁTICO    ${discapChk} DISCAPACIDAD    ${retiroChk} RETIRO NO AUTORIZADO`, {
    x: MARGIN_X + 6, y: y - 22, size: 6.8, font: fontRegular
  });
  page2.drawText(`DÍAS DE ESTADA: ${d.dias_estada || '0'}         DÍAS DE REPOSO: ${d.dias_reposo || '0'}`, {
    x: MARGIN_X + 340, y: y - 10, size: 7, font: fontBold
  });
  y -= 38;

  // Sección I: Médicos Tratantes
  y = drawSectionHeader(page2, y, "I. MÉDICOS TRATANTES");
  drawCell(page2, MARGIN_X, y, 210, 14, null, "NOMBRE Y APELLIDOS", true, 6);
  drawCell(page2, MARGIN_X + 210, y, 120, 14, null, "ESPECIALIDAD", true, 6);
  drawCell(page2, MARGIN_X + 330, y, 110, 14, null, "No. IDENTIFICACIÓN", true, 6);
  drawCell(page2, MARGIN_X + 440, y, CONTENT_WIDTH - 440, 14, null, "PERÍODO RESPONSABILIDAD", true, 6);
  y -= 14;

  const drawMedRow = (num, nom, esp, doc, per) => {
    drawCell(page2, MARGIN_X, y, 210, 13, null, nom ? `${num}. ${nom}` : `${num}.`, false, 6.5);
    drawCell(page2, MARGIN_X + 210, y, 120, 13, null, esp || '', false, 6.5);
    drawCell(page2, MARGIN_X + 330, y, 110, 13, null, doc || '', false, 6.5);
    drawCell(page2, MARGIN_X + 440, y, CONTENT_WIDTH - 440, 13, null, per || '', false, 6.5);
    y -= 13;
  };
  drawMedRow(1, d.medico_1_nombre, d.medico_1_esp, d.medico_1_doc, d.medico_1_periodo);
  drawMedRow(2, d.medico_2_nombre, d.medico_2_esp, d.medico_2_doc, d.medico_2_periodo);
  y -= 6;

  // Sección J: Profesional Responsable
  y = drawSectionHeader(page2, y, "J. DATOS DEL PROFESIONAL RESPONSABLE");
  drawCell(page2, MARGIN_X, y, 70, 20, "FECHA", d.resp_fecha || '', true, 7.5);
  drawCell(page2, MARGIN_X + 70, y, 50, 20, "HORA", d.resp_hora || '', true, 7.5);
  drawCell(page2, MARGIN_X + 120, y, 130, 20, "PRIMER NOMBRE", (d.resp_nombre || '').toUpperCase(), true, 7.5);
  drawCell(page2, MARGIN_X + 250, y, 120, 20, "PRIMER APELLIDO", (d.resp_primer_ape || '').toUpperCase(), true, 7.5);
  drawCell(page2, MARGIN_X + 370, y, 100, 20, "SEGUNDO APELLIDO", (d.resp_segundo_ape || '').toUpperCase(), true, 7.5);
  drawCell(page2, MARGIN_X + 470, y, CONTENT_WIDTH - 470, 20, "No. IDENTIFICACIÓN", d.resp_doc || '', true, 7.5);
  y -= 20;

  // Rol elaborado/revisado
  const elabChk = d.resp_rol === 'REVISADO' ? '[   ] ELABORADO POR' : '[ X ] ELABORADO POR';
  const revChk = d.resp_rol === 'REVISADO' ? '[ X ] REVISADO POR' : '[   ] REVISADO POR';
  page2.drawRectangle({
    x: MARGIN_X, y: y - 18, width: CONTENT_WIDTH, height: 18,
    borderWidth: 0.5, borderColor: COLOR_BORDER
  });
  page2.drawText(`${elabChk}                 ${revChk}                 FIRMA Y SELLO: ________________________________`, {
    x: MARGIN_X + 10, y: y - 12, size: 7.5, font: fontBold, color: COLOR_TEXT
  });

  // Pie de Hoja 2
  page2.drawText("SNS-MSP / HCU-form.006 / 2021", {
    x: MARGIN_X, y: 15, size: 6.5, font: fontRegular, color: rgb(0.4, 0.4, 0.4)
  });
  page2.drawText("EPICRISIS (2)", {
    x: PAGE_WIDTH - MARGIN_X - 60, y: 15, size: 7, font: fontBold, color: rgb(0.4, 0.4, 0.4)
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
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
// VINCULACIÓN EN TIEMPO REAL: PUNTO B -> PUNTO C
// -------------------------------------------------------------
let _usuarioEditoEvolucionManualmente = false;

export function inicializarEventosEpicrisis() {
  const txtCuadro = document.getElementById('epicrisis_cuadro_clinico');
  const txtEvolucion = document.getElementById('epicrisis_evolucion');

  if (txtCuadro && txtEvolucion) {
    txtEvolucion.addEventListener('input', () => {
      // Si el usuario borra todo o escribe algo distinto, marcamos que hubo edición manual
      _usuarioEditoEvolucionManualmente = (txtEvolucion.value !== txtCuadro.value);
    });

    txtCuadro.addEventListener('input', () => {
      if (!_usuarioEditoEvolucionManualmente) {
        txtEvolucion.value = txtCuadro.value;
        // Notificar guardado automático si aplica
        txtEvolucion.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
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
        // Para 1 carácter, solo palabras que inician con ese carácter, NUNCA subcadenas intermedias
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
  // Pre-cargar catálogo de forma asíncrona en segundo plano
  cargarCatalogoCie10Local();

  PAREJAS_DIAGNOSTICO_EPICRISIS.forEach(({ descId, cieId }) => {
    const descInput = document.getElementById(descId);
    const cieInput = document.getElementById(cieId);
    if (!descInput || !cieInput) return;

    // Configurar autocompletado en el campo de descripción
    configurarAutocompleteInput(descInput, descInput, cieInput);

    // Configurar autocompletado en el campo de código CIE
    configurarAutocompleteInput(cieInput, descInput, cieInput);

    // Al salir del campo de código, formatear automáticamente si se ingresó sin punto
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

  // Evitar duplicar menú
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
        e.preventDefault(); // Prevenir blur antes de procesar selección
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

// Exponer en window para llamadas desde botones inline
if (typeof window !== 'undefined') {
  window.descargarEpicrisisSegura = descargarEpicrisisSegura;
  window.recopilarDatosEpicrisis = recopilarDatosEpicrisis;
  window.cargarCatalogoCie10Local = cargarCatalogoCie10Local;
  window.buscarCie10 = buscarCie10;
  window.formatearCie10Codigo = formatearCie10Codigo;
  window.inicializarBuscadorCie10Epicrisis = inicializarBuscadorCie10Epicrisis;
}

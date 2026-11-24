// js/epiExcel.js
// Generación local de Fichas EPI en formato Excel (.xlsx ECMA-376, 3 hojas)

import {
  calcularSemanaEpidemiologica,
  splitDireccion,
  dividirTextoPorPalabras,
  obtenerBytesPlantilla
} from './epiUtils.js';

// ============================================================================
// GENERADOR LOCAL ULTRARRÁPIDO DE EXCEL (.XLSX) - FORMATO NUEVO (3 HOJAS)
// ============================================================================
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

    // Ignorar entradas de directorio vacías para cumplir estrictamente la norma OPC ECMA-376
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
    ldv.setUint16(12, 0x21, true);
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
    cdv.setUint16(14, 0x21, true);
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

export async function procesarFichaEpiExcelLocalmente(datosObj) {
  const arrayBuffer = await obtenerBytesPlantilla('./plantilla_epi_nuevo.xlsx', 'epi_xlsx');
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

  const splitYMD = (dStr) => {
    if (!dStr) return ['', '', ''];
    const p = String(dStr).trim().split('-');
    if (p.length !== 3) return ['', '', ''];
    return [String(parseInt(p[2], 10)), String(parseInt(p[1], 10)), String(parseInt(p[0], 10))];
  };

  const splitDateDigits = (dStr) => {
    if (!dStr) return { d1: '', d2: '', m1: '', m2: '', ano: '', dia: '', mes: '' };
    const p = String(dStr).trim().split('-');
    if (p.length !== 3) return { d1: '', d2: '', m1: '', m2: '', ano: '', dia: '', mes: '' };
    const dNum = parseInt(p[2], 10);
    const mNum = parseInt(p[1], 10);
    const aNum = parseInt(p[0], 10);
    if (isNaN(dNum) || isNaN(mNum) || isNaN(aNum)) {
      return { d1: '', d2: '', m1: '', m2: '', ano: '', dia: '', mes: '' };
    }
    const diaStr = String(dNum).padStart(2, '0');
    const mesStr = String(mNum).padStart(2, '0');
    const anoStr = String(aNum);
    return {
      d1: diaStr[0],
      d2: diaStr[1],
      m1: mesStr[0],
      m2: mesStr[1],
      dia: String(dNum),
      mes: String(mNum),
      ano: anoStr
    };
  };

  const up = (v) => String(v || '').trim().toUpperCase();
  const ced = String(datosObj.cedula || '').trim();
  const hc = String(datosObj.historia_clinica || '').trim();
  const ape1 = up(datosObj.primer_apellido);
  const ape2 = up(datosObj.segundo_apellido);
  const nom1 = up(datosObj.primer_nombre);
  const nom2 = up(datosObj.segundo_nombre);

  const [fnDia, fnMes, fnAno] = splitYMD(datosObj.fecha_nacimiento);
  const [faDia, faMes, faAno] = splitYMD(datosObj.fecha_atencion);
  const [fsDia, fsMes, fsAno] = splitYMD(datosObj.fecha_inicio_sintomas);
  const [ffDia, ffMes, ffAno] = splitYMD(datosObj.fecha_fallecimiento);
  const [fmDia, fmMes, fmAno] = splitYMD(datosObj.fecha_muestra);

  const faDig = splitDateDigits(datosObj.fecha_atencion);
  const fsDig = splitDateDigits(datosObj.fecha_inicio_sintomas);
  const frDig = splitDateDigits(datosObj.fecha_sintoma_relevante);
  const fhDig = splitDateDigits(datosObj.fecha_hosp);
  const ffDig = splitDateDigits(datosObj.fecha_fallecimiento);
  const fvDig = splitDateDigits(datosObj.fecha_ultima_dosis);
  const fvdDig = splitDateDigits(datosObj.fecha_desde);
  const fvhDig = splitDateDigits(datosObj.fecha_hasta);
  const fcDig = splitDateDigits(datosObj.fecha_contacto);

  let edadAnos = '', edadMeses = '', edadDias = '';
  if (datosObj.fecha_nacimiento) {
    const nac = new Date(datosObj.fecha_nacimiento + 'T12:00:00');
    const ref = datosObj.fecha_atencion ? new Date(datosObj.fecha_atencion + 'T12:00:00') : new Date();
    if (!isNaN(nac.getTime()) && !isNaN(ref.getTime()) && ref >= nac) {
      let a = ref.getFullYear() - nac.getFullYear();
      let m = ref.getMonth() - nac.getMonth();
      let d = ref.getDate() - nac.getDate();
      if (d < 0) {
        m--;
        d += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
      }
      if (m < 0) { a--; m += 12; }
      edadAnos = String(Math.max(0, a));
      edadMeses = String(Math.max(0, m));
      edadDias = String(Math.max(0, d));
    }
  }

  const semanaEpi = calcularSemanaEpidemiologica(datosObj.fecha_inicio_sintomas || datosObj.fecha_atencion);
  const instUp = up(datosObj.institucion);
  const estabUp = up(datosObj.establecimiento);
  const provEstUp = up(datosObj.prov_establecimiento);
  const cantEstUp = up(datosObj.canton_establecimiento);
  const parrEstUp = up(datosObj.parroquia_establecimiento);
  const sexoUp = up(datosObj.sexo);
  const embUp = sexoUp === 'MASCULINO' ? 'NO' : up(datosObj.embarazada || 'NO');
  const semGest = (sexoUp !== 'MASCULINO' && embUp === 'SI') ? String(datosObj.semanas_gestacion || '').trim() : '';
  const lugarProbInfeccion = up(datosObj.lugar_viaje || datosObj.canton_residencia || datosObj.canton_establecimiento);
  const condEgUp = up(datosObj.condicion_egreso);
  const esFallecido = condEgUp === 'FALLECIDO' || condEgUp === 'MUERTO';

  const parseSheetXml = async (entryName) => {
    const entry = entries.find(e => e.name === entryName);
    if (!entry) return null;
    const raw = entry.method === 8 ? await inflateRawBytes(entry.compData) : entry.compData;
    const rawStr = decoder.decode(raw);
    const doc = parser.parseFromString(rawStr, 'application/xml');
    return { entry, doc, rawStr };
  };

  // Preservar intactos el encabezado XML y la etiqueta <worksheet ...> original de Microsoft Excel
  const serializarHojaSegura = (doc, rawXmlOriginal) => {
    let xmlOut = serializer.serializeToString(doc);
    const matchOrigOpen = rawXmlOriginal.match(/^[\s\S]*?<worksheet\b[^>]*>/);
    const matchNewOpen = xmlOut.match(/^[\s\S]*?<worksheet\b[^>]*>/);
    if (matchOrigOpen && matchNewOpen) {
      xmlOut = matchOrigOpen[0] + xmlOut.slice(matchNewOpen[0].length);
    } else if (!xmlOut.startsWith('<?xml')) {
      xmlOut = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + xmlOut;
    }
    const matchExtOrig = rawXmlOriginal.match(/<extLst>[\s\S]*?<\/extLst>/);
    const matchExtNew = xmlOut.match(/<extLst>[\s\S]*?<\/extLst>/);
    if (matchExtOrig && matchExtNew) {
      xmlOut = xmlOut.replace(/<extLst>[\s\S]*?<\/extLst>/, matchExtOrig[0]);
    }
    return encoder.encode(xmlOut);
  };

  const s1Obj = await parseSheetXml('xl/worksheets/sheet1.xml'); // Epi individual
  const s2Obj = await parseSheetXml('xl/worksheets/sheet2.xml'); // Clinica Epidemiolo
  const s3Obj = await parseSheetXml('xl/worksheets/sheet3.xml'); // Hoja Posterior

  const todosContactos = [...(datosObj.contactos || []), ...(datosObj.contactos_12_14 || [])].slice(0, 18);
  let totalSintomaticos = 0;
  todosContactos.forEach(c => { if (up(c?.enfermo) === 'SI') totalSintomaticos++; });

  const expNinguno = Boolean(datosObj.exp_ninguno);
  const procAguaVal = datosObj.procedencia_agua === 'Otro' ? up(datosObj.procedencia_agua_otro) : up(datosObj.procedencia_agua);
  const tipoExpVal = datosObj.tipo_exposicion === 'Otras' ? up(datosObj.tipo_exposicion_otro) : up(datosObj.tipo_exposicion);
  const caracSignosTxt = up(datosObj.aplica_caracterizar_signos) === 'SI' ? up(datosObj.caracterizar_signos) : '';

  // -------------------------------------------------------------------------
  // 1. HOJA 1: Epi individual
  // -------------------------------------------------------------------------
  if (s1Obj) {
    const d1 = s1Obj.doc;
    setCellValue(d1, 'W9', semanaEpi);
    setCellValue(d1, 'C13', (instUp === 'MSP' || instUp.includes('SALUD PÚBLICA') || instUp.includes('SALUD PUBLICA')) ? 'X' : '');
    setCellValue(d1, 'D13', (instUp === 'IESS' || instUp.includes('SEGURIDAD SOCIAL')) ? 'X' : '');
    setCellValue(d1, 'E13', (instUp === 'FFAA' || instUp === 'ISSFA' || instUp.includes('FUERZAS ARMADAS')) ? 'X' : '');
    setCellValue(d1, 'F13', (instUp === 'POL' || instUp === 'ISSPOL' || instUp.includes('POLIC')) ? 'X' : '');
    setCellValue(d1, 'G13', (instUp.includes('JBG') || instUp.includes('BENEFICENCIA')) ? 'X' : '');
    setCellValue(d1, 'H13', (instUp === 'MEC' || instUp.includes('EDUCAC')) ? 'X' : '');
    setCellValue(d1, 'I13', instUp === 'DRS' ? 'X' : '');
    setCellValue(d1, 'J13', instUp.includes('PRIV') ? 'X' : '');
    setCellValue(d1, 'K13', (instUp === 'ONG' || instUp.includes('FUNDAC')) ? 'X' : '');

    setCellValue(d1, 'S12', estabUp);
    setCellValue(d1, 'E15', provEstUp);
    setCellValue(d1, 'K15', cantEstUp);
    setCellValue(d1, 'R15', parrEstUp);
    setCellValue(d1, 'F18', faDia);
    setCellValue(d1, 'H18', faMes);
    setCellValue(d1, 'J18', faAno);
    setCellValue(d1, 'R18', up(datosObj.medico_tratante));

    setCellValue(d1, 'C21', ape1);
    setCellValue(d1, 'F21', ape2);
    setCellValue(d1, 'I21', nom1);
    setCellValue(d1, 'K21', nom2);
    setCellValue(d1, 'Q21', ced);
    setCellValue(d1, 'I24', hc);
    setCellValue(d1, 'Q24', up(datosObj.nacionalidad));

    setCellValue(d1, 'D26', sexoUp === 'MASCULINO' ? 'X' : '');
    setCellValue(d1, 'F26', sexoUp === 'FEMENINO' ? 'X' : '');
    setCellValue(d1, 'M26', fnDia);
    setCellValue(d1, 'N26', fnMes);
    setCellValue(d1, 'O26', fnAno);
    setCellValue(d1, 'S26', edadAnos);
    setCellValue(d1, 'U26', edadMeses);
    setCellValue(d1, 'W26', edadDias);

    setCellValue(d1, 'F29', up(datosObj.prov_residencia));
    setCellValue(d1, 'K29', up(datosObj.canton_residencia));
    setCellValue(d1, 'O29', up(datosObj.parroquia_residencia));
    const dirCompletaS1 = [up(datosObj.direccion), up(datosObj.parroquia_residencia)].filter(Boolean).join(' - ');
    setCellValue(d1, 'F31', dirCompletaS1);
    setCellValue(d1, 'T32', datosObj.telefono || '');
    setCellValue(d1, 'F35', lugarProbInfeccion);

    setCellValue(d1, 'F39', fsDia);
    setCellValue(d1, 'H39', fsMes);
    setCellValue(d1, 'J39', fsAno);
    setCellValue(d1, 'Q40', up(datosObj.diagnostico_cie10));

    setCellValue(d1, 'G42', (sexoUp !== 'MASCULINO' && embUp === 'SI') ? 'X' : '');
    setCellValue(d1, 'I42', (sexoUp !== 'MASCULINO' && embUp === 'NO') ? 'X' : '');
    setCellValue(d1, 'R42', semGest);

    const muestraSi = up(datosObj.muestra) === 'SI';
    setCellValue(d1, 'G45', muestraSi ? 'X' : '');
    setCellValue(d1, 'I45', up(datosObj.muestra) === 'NO' ? 'X' : '');
    setCellValue(d1, 'O46', muestraSi ? up(datosObj.tipo_muestra) : '');
    setCellValue(d1, 'S46', muestraSi ? fmDia : '');
    setCellValue(d1, 'U46', muestraSi ? fmMes : '');
    setCellValue(d1, 'W46', muestraSi ? fmAno : '');
    // Punto 22: Nombre y ubicación del laboratorio va en la línea combinada B48:K48 (debajo de la etiqueta B47)
    setCellValue(d1, 'G47', '');
    setCellValue(d1, 'B48', muestraSi ? (estabUp || instUp) : '');
    setCellValue(d1, 'C52', muestraSi ? up(datosObj.tipo_muestra) : '');
    setCellValue(d1, 'I52', muestraSi ? fmDia : '');
    setCellValue(d1, 'J52', muestraSi ? fmMes : '');
    setCellValue(d1, 'K52', muestraSi ? fmAno : '');
    setCellValue(d1, 'M52', (muestraSi && up(datosObj.muestra_adecuada) === 'SI') ? 'X' : '');
    setCellValue(d1, 'N52', (muestraSi && up(datosObj.muestra_adecuada) === 'NO') ? 'X' : '');

    const resUp = up(datosObj.resultado);
    setCellValue(d1, 'F56', resUp === 'POSITIVO' ? 'X' : '');
    setCellValue(d1, 'J56', resUp === 'NEGATIVO' ? 'X' : '');
    setCellValue(d1, 'N56', resUp === 'DUDOSO' ? 'X' : '');
    setCellValue(d1, 'T56', muestraSi ? up(datosObj.agente) : '');
    setCellValue(d1, 'T57', muestraSi ? up(datosObj.tecnica) : '');
    setCellValue(d1, 'D58', up(datosObj.obs_epidemiologicas));

    // Puntos 26 y 27 quedan vacíos para Epidemiología
    setCellValue(d1, 'G60', '');
    setCellValue(d1, 'F62', '');
    setCellValue(d1, 'H62', '');
    setCellValue(d1, 'J62', '');
    setCellValue(d1, 'R62', String(totalSintomaticos), 'n');

    const hospUp = up(datosObj.hospitalizado);
    const uciUp = up(datosObj.ingreso_uci);
    setCellValue(d1, 'I65', (hospUp === 'NO' && datosObj.fecha_atencion) ? 'X' : '');
    setCellValue(d1, 'I66', (hospUp === 'SI' && uciUp !== 'SI') ? 'X' : '');
    setCellValue(d1, 'I67', (hospUp === 'SI' && uciUp === 'SI') ? 'X' : '');

    setCellValue(d1, 'W65', condEgUp === 'VIVO' ? 'X' : '');
    setCellValue(d1, 'W66', condEgUp === 'CON DISCAPACIDAD' ? 'X' : '');
    setCellValue(d1, 'W67', esFallecido ? 'X' : '');
    setCellValue(d1, 'S69', esFallecido ? ffDia : '');
    setCellValue(d1, 'U69', esFallecido ? ffMes : '');
    setCellValue(d1, 'W69', esFallecido ? ffAno : '');

    const confUp = up(datosObj.confirmado_por);
    setCellValue(d1, 'J78', (resUp === 'POSITIVO' || confUp !== '') ? 'X' : '');
    setCellValue(d1, 'O78', resUp === 'NEGATIVO' ? 'X' : '');
    setCellValue(d1, 'U78', (resUp === 'DUDOSO' || resUp === 'NO CONCLUYENTE') ? 'X' : '');
    setCellValue(d1, 'H80', confUp.includes('LAB') ? 'X' : '');
    setCellValue(d1, 'H82', confUp.includes('CL') ? 'X' : '');
    setCellValue(d1, 'H84', confUp.includes('NEXO') ? 'X' : '');
    setCellValue(d1, 'R80', '');
    setCellValue(d1, 'P82', '');
    setCellValue(d1, 'Q82', '');
    setCellValue(d1, 'R82', '');
    setCellValue(d1, 'Q84', '');

    s1Obj.entry.rawBytes = serializarHojaSegura(d1, s1Obj.rawStr);
  }

  // -------------------------------------------------------------------------
  // 2. HOJA 2: Clinica Epidemiolo
  // -------------------------------------------------------------------------
  if (s2Obj) {
    const d2 = s2Obj.doc;
    setCellValue(d2, 'N5', up(datosObj.diagnostico_cie10));
    setCellValue(d2, 'H7', estabUp);
    setCellValue(d2, 'Y7', faDig.dia ? faDig.dia.padStart(2, '0') : '');
    setCellValue(d2, 'AA7', faDig.mes ? faDig.mes.padStart(2, '0') : '');
    setCellValue(d2, 'AC7', faDig.ano);
    setCellValue(d2, 'G9', provEstUp);
    setCellValue(d2, 'P9', cantEstUp);
    setCellValue(d2, 'X9', parrEstUp);

    setCellValue(d2, 'D12', ape1);
    setCellValue(d2, 'J12', ape2);
    setCellValue(d2, 'P12', nom1);
    setCellValue(d2, 'T12', nom2);
    setCellValue(d2, 'AC12', sexoUp === 'MASCULINO' ? 'X' : '');
    setCellValue(d2, 'AD12', sexoUp === 'FEMENINO' ? 'X' : '');

    // Punto 6: Edad en DÍAS (D15, E15) | MESES (F15, G15) | AÑOS (H15:I15)
    const edDiaPad = edadDias !== '' ? edadDias.padStart(2, '0') : '';
    const edMesPad = edadMeses !== '' ? edadMeses.padStart(2, '0') : '';
    setCellValue(d2, 'D15', edDiaPad);
    setCellValue(d2, 'F15', edMesPad);
    setCellValue(d2, 'H15', edadAnos);

    setCellValue(d2, 'P15', up(datosObj.estado_civil));
    setCellValue(d2, 'AA15', up(datosObj.escolaridad));
    setCellValue(d2, 'D18', up(datosObj.ocupacion));
    setCellValue(d2, 'Z18', datosObj.telefono || '');
    setCellValue(d2, 'G20', up(datosObj.prov_residencia));
    setCellValue(d2, 'P20', up(datosObj.canton_residencia));
    setCellValue(d2, 'X20', up(datosObj.parroquia_residencia));
    const dirPartsS2 = splitDireccion(datosObj.direccion, 55);
    setCellValue(d2, 'G23', up(dirPartsS2.l1));
    setCellValue(d2, 'G24', up(dirPartsS2.l2 || datosObj.parroquia_residencia));
    setCellValue(d2, 'J26', up(datosObj.nombre_madre));

    setCellValue(d2, 'P28', datosObj.hora_inicio_sintomas || '');
    setCellValue(d2, 'R28', fsDig.dia ? fsDig.dia.padStart(2, '0') : '');
    setCellValue(d2, 'T28', fsDig.mes ? fsDig.mes.padStart(2, '0') : '');
    setCellValue(d2, 'V28', fsDig.ano);
    // H31 contiene la etiqueta impresa "relevante"; el valor va en la celda combinada J31:N31
    setCellValue(d2, 'J31', up(datosObj.cual_sintoma));
    setCellValue(d2, 'P31', datosObj.hora_sintoma_relevante || '');
    setCellValue(d2, 'R31', frDig.dia ? frDig.dia.padStart(2, '0') : '');
    setCellValue(d2, 'T31', frDig.mes ? frDig.mes.padStart(2, '0') : '');
    setCellValue(d2, 'V31', frDig.ano);
    setCellValue(d2, 'AB31', datosObj.num_dias_sintomas || '');

    const mapSintomasS2 = {
      J34: 'adenopatias', J35: 'alt_neuro_periferico', J36: 'alt_neuro_central', J37: 'anorexia',
      J38: 'apnea', J39: 'artralgia', J40: 'ascitis', J41: 'cefalea',
      Q34: 'cianosis', Q35: 'convulsiones', Q36: 'deshidratacion', Q37: 'diarrea',
      Q38: 'dif_respiratoria', Q39: 'dolor_abdominal', Q40: 'dolor_garganta', Q41: 'erupcion',
      X34: 'escalofrios', X35: 'espasmo', X36: 'estridor', X37: 'fiebre',
      X38: 'ictericia', X39: 'mialgias', X40: 'nauseas', X41: 'paralisis',
      AD34: 'prurito', AD35: 'rigidez', AD36: 'sangrados', AD37: 'tos',
      AD38: 'trismus', AD39: 'vision_borrosa'
    };
    Object.entries(mapSintomasS2).forEach(([cellRef, key]) => {
      setCellValue(d2, cellRef, datosObj[key] ? 'X' : '');
    });

    const otrosSigArr = [
      up(datosObj.otros_signos),
      datosObj.sudoracion ? 'SUDORACIÓN NOCTURNA' : '',
      datosObj.oncocercomas ? 'ONCOCERCOMAS' : ''
    ].filter(Boolean);
    setCellValue(d2, 'G42', otrosSigArr.join(', '));

    // Punto 14: Celda unificada C45:AD49 para Caracterizar signos/síntomas
    setCellValue(d2, 'C45', caracSignosTxt);

    const tratSi = up(datosObj.recibio_tratamiento) === 'SI';
    setCellValue(d2, 'H51', tratSi ? 'X' : '');
    setCellValue(d2, 'K51', up(datosObj.recibio_tratamiento) === 'NO' ? 'X' : '');
    setCellValue(d2, 'Q51', tratSi ? up(datosObj.especificar_tratamiento) : '');
    const evoUp = up(datosObj.evolucion);
    setCellValue(d2, 'K53', (evoUp === 'MEJORÓ' || evoUp === 'MEJORO') ? 'X' : '');
    setCellValue(d2, 'K54', evoUp === 'IGUALES CONDICIONES' ? 'X' : '');
    setCellValue(d2, 'K55', (evoUp === 'EMPEORÓ' || evoUp === 'EMPEORO') ? 'X' : '');
    const lugTUp = up(datosObj.lugar_tratamiento);
    setCellValue(d2, 'AD53', (tratSi && lugTUp === 'UNIDADES DE SALUD DEL MSP') ? 'X' : '');
    setCellValue(d2, 'T54', (tratSi && lugTUp === 'DOMICILIO') ? 'X' : '');
    setCellValue(d2, 'AD54', (tratSi && lugTUp.includes('SECTOR P')) ? 'X' : '');
    setCellValue(d2, 'T55', (tratSi && lugTUp === 'FARMACIA') ? 'X' : '');
    setCellValue(d2, 'AD55', (tratSi && lugTUp === 'UNIDADES DE SALUD PRIVADAS') ? 'X' : '');

    const hospSi = up(datosObj.hospitalizado) === 'SI';
    setCellValue(d2, 'F57', hospSi ? 'X' : '');
    setCellValue(d2, 'I57', up(datosObj.hospitalizado) === 'NO' ? 'X' : '');
    setCellValue(d2, 'Q57', hospSi && fhDig.dia ? fhDig.dia.padStart(2, '0') : '');
    setCellValue(d2, 'S57', hospSi && fhDig.mes ? fhDig.mes.padStart(2, '0') : '');
    setCellValue(d2, 'U57', hospSi ? fhDig.ano : '');
    setCellValue(d2, 'Y57', hospSi ? up(datosObj.hc_hosp) : '');
    setCellValue(d2, 'AC57', hospSi ? up(datosObj.servicio_hosp) : '');
    setCellValue(d2, 'F60', hospSi ? up(datosObj.nombre_hospital) : '');
    setCellValue(d2, 'W60', (hospSi && up(datosObj.ingreso_uci) === 'SI') ? 'X' : '');
    setCellValue(d2, 'Z60', (hospSi && up(datosObj.ingreso_uci) === 'NO') ? 'X' : '');

    setCellValue(d2, 'H62', condEgUp === 'VIVO' ? 'X' : '');
    setCellValue(d2, 'L62', esFallecido ? 'X' : '');
    setCellValue(d2, 'X62', esFallecido && ffDig.dia ? ffDig.dia.padStart(2, '0') : '');
    setCellValue(d2, 'Z62', esFallecido && ffDig.mes ? ffDig.mes.padStart(2, '0') : '');
    setCellValue(d2, 'AB62', esFallecido ? ffDig.ano : '');

    const vacUp = up(datosObj.antecedente_vacunal);
    setCellValue(d2, 'H64', vacUp === 'SI' ? 'X' : '');
    setCellValue(d2, 'K64', vacUp === 'NO' ? 'X' : '');
    setCellValue(d2, 'P64', vacUp === 'DESCONOCE' ? 'X' : '');
    const mapVacS2 = {
      D66: 'bcg', G66: 'hb', J66: 'rota', N66: 'opv',
      Q66: 'penta', U66: 'influenza', AA66: 'neumococo_conj', AD66: 'sr',
      D68: 'fa', G68: 'dt', J68: 'dpt', N68: 'dt_adulto',
      Q68: 'srp', U68: 'varicela', AA68: 'neumococo_poli'
    };
    Object.entries(mapVacS2).forEach(([cRef, k]) => {
      setCellValue(d2, cRef, datosObj[k] ? 'X' : '');
    });
    setCellValue(d2, 'AC68', datosObj.otras_vacunas ? `OTRAS: ${up(datosObj.otras_vacunas)}` : 'otras____');
    setCellValue(d2, 'E70', fvDig.dia ? fvDig.dia.padStart(2, '0') : '');
    setCellValue(d2, 'G70', fvDig.mes ? fvDig.mes.padStart(2, '0') : '');
    setCellValue(d2, 'I70', fvDig.ano);

    // Punto 22: No. de dosis recibidas tiene 2 casillas de 1 dígito (Y70 y Z70)
    const numDosisStr = up(datosObj.num_dosis);
    if (numDosisStr) {
      if (numDosisStr.length === 1) {
        setCellValue(d2, 'Y70', '0');
        setCellValue(d2, 'Z70', numDosisStr);
      } else {
        setCellValue(d2, 'Y70', numDosisStr[0]);
        setCellValue(d2, 'Z70', numDosisStr[1]);
      }
    } else {
      setCellValue(d2, 'Y70', '');
      setCellValue(d2, 'Z70', '');
    }

    const fInfoUp = up(datosObj.fuente_info);
    setCellValue(d2, 'N72', fInfoUp.includes('TARJETA') ? 'X' : '');
    setCellValue(d2, 'S72', fInfoUp.includes('REGISTRO') ? 'X' : '');
    setCellValue(d2, 'Y72', fInfoUp === 'VERBAL' ? 'X' : '');

    setCellValue(d2, 'I74', (!expNinguno && (datosObj.exp_animal_vivo || datosObj.exp_animal_muerto)) ? 'X' : '');
    setCellValue(d2, 'P74', (!expNinguno && datosObj.exp_persona_sint) ? 'X' : '');
    setCellValue(d2, 'T74', (!expNinguno && datosObj.exp_alimentos) ? 'X' : '');
    setCellValue(d2, 'Y74', (!expNinguno && datosObj.exp_agua_suelo) ? 'X' : '');
    setCellValue(d2, 'AD74', (!expNinguno && datosObj.exp_basurales) ? 'X' : '');
    setCellValue(d2, 'I76', (!expNinguno && datosObj.exp_metanol) ? 'X' : '');
    setCellValue(d2, 'P76', (!expNinguno && datosObj.exp_metales_pesados) ? 'X' : '');
    setCellValue(d2, 'T76', (!expNinguno && datosObj.exp_solventes) ? 'X' : '');
    setCellValue(d2, 'Y76', (!expNinguno && datosObj.exp_plaguicidas) ? 'X' : '');
    setCellValue(d2, 'AD76', expNinguno ? 'X' : '');
    setCellValue(d2, 'AD78', !expNinguno ? up(datosObj.exp_otros) : '');

    setCellValue(d2, 'C79', !expNinguno ? up(datosObj.lugar_contacto) : '');
    setCellValue(d2, 'J79', !expNinguno ? up(datosObj.forma_contacto) : '');
    setCellValue(d2, 'S79', !expNinguno ? up(datosObj.origen_objeto) : '');
    setCellValue(d2, 'G82', !expNinguno && fcDig.dia ? fcDig.dia.padStart(2, '0') : '');
    setCellValue(d2, 'I82', !expNinguno && fcDig.mes ? fcDig.mes.padStart(2, '0') : '');
    setCellValue(d2, 'K82', !expNinguno ? fcDig.ano : '');
    setCellValue(d2, 'P82', !expNinguno ? (datosObj.hora_contacto || '') : '');

    s2Obj.entry.rawBytes = serializarHojaSegura(d2, s2Obj.rawStr);
  }

  // -------------------------------------------------------------------------
  // 3. HOJA 3: Hoja Posterior
  // -------------------------------------------------------------------------
  if (s3Obj) {
    const d3 = s3Obj.doc;
    const habAgua = !expNinguno && (datosObj.exp_agua_suelo || datosObj.exp_alimentos);
    const esProcStd = ['CASA', 'RESTAURANTE', 'CALLE', 'REUNIÓN SOCIAL', 'REUNION SOCIAL'].includes(procAguaVal);
    setCellValue(d3, 'D4', (habAgua && procAguaVal === 'CASA') ? 'X' : '');
    setCellValue(d3, 'I4', (habAgua && procAguaVal === 'RESTAURANTE') ? 'X' : '');
    setCellValue(d3, 'M4', (habAgua && procAguaVal === 'CALLE') ? 'X' : '');
    setCellValue(d3, 'R4', (habAgua && (procAguaVal === 'REUNIÓN SOCIAL' || procAguaVal === 'REUNION SOCIAL')) ? 'X' : '');
    setCellValue(d3, 'U4', (habAgua && procAguaVal && !esProcStd) ? procAguaVal : '');

    const esTipoStd = ['OCUPACIONAL', 'INTENCIONAL SUICIDA', 'REACCIÓN ADVERSA', 'REACCION ADVERSA', 'ACCIDENTAL', 'INTENCIONAL HOMICIDA', 'DESCONOCIDA'].includes(tipoExpVal);
    setCellValue(d3, 'I6', (!expNinguno && tipoExpVal === 'OCUPACIONAL') ? 'X' : '');
    setCellValue(d3, 'P6', (!expNinguno && tipoExpVal === 'INTENCIONAL SUICIDA') ? 'X' : '');
    setCellValue(d3, 'V6', (!expNinguno && (tipoExpVal === 'REACCIÓN ADVERSA' || tipoExpVal === 'REACCION ADVERSA')) ? 'X' : '');
    setCellValue(d3, 'I8', (!expNinguno && tipoExpVal === 'ACCIDENTAL') ? 'X' : '');
    setCellValue(d3, 'P8', (!expNinguno && tipoExpVal === 'INTENCIONAL HOMICIDA') ? 'X' : '');
    setCellValue(d3, 'V8', (!expNinguno && tipoExpVal === 'DESCONOCIDA') ? 'X' : '');
    if (!expNinguno && tipoExpVal && !esTipoStd) {
      const lineasTipoS3 = dividirTextoPorPalabras(tipoExpVal, 2, 20);
      setCellValue(d3, 'Z6', lineasTipoS3[0] || '');
      setCellValue(d3, 'X8', lineasTipoS3[1] || '');
    } else {
      setCellValue(d3, 'Z6', '');
      setCellValue(d3, 'X8', '');
    }

    setCellValue(d3, 'L10', up(datosObj.transfusion) === 'SI' ? 'X' : '');
    setCellValue(d3, 'O10', up(datosObj.transfusion) === 'NO' ? 'X' : '');
    setCellValue(d3, 'S10', (sexoUp !== 'MASCULINO' && embUp === 'SI') ? 'X' : '');
    setCellValue(d3, 'V10', (sexoUp !== 'MASCULINO' && embUp === 'NO') ? 'X' : '');
    setCellValue(d3, 'AD10', semGest);

    const viajeSi = up(datosObj.realizo_viaje) === 'SI';
    setCellValue(d3, 'J12', viajeSi ? 'X' : '');
    setCellValue(d3, 'L12', up(datosObj.realizo_viaje) === 'NO' ? 'X' : '');
    setCellValue(d3, 'O12', viajeSi ? up(datosObj.lugar_viaje) : '');
    setCellValue(d3, 'Y12', viajeSi && fvdDig.dia ? fvdDig.dia.padStart(2, '0') : '');
    setCellValue(d3, 'Z12', viajeSi && fvdDig.mes ? fvdDig.mes.padStart(2, '0') : '');
    setCellValue(d3, 'AC12', viajeSi ? fvdDig.ano : '');
    setCellValue(d3, 'Y13', viajeSi && fvhDig.dia ? fvhDig.dia.padStart(2, '0') : '');
    setCellValue(d3, 'Z13', viajeSi && fvhDig.mes ? fvhDig.mes.padStart(2, '0') : '');
    setCellValue(d3, 'AC13', viajeSi ? fvhDig.ano : '');

    // Punto 31: Celda unificada C16:AD21 para Caracterizar factores de riesgo
    const partesFactores = [
      (up(datosObj.comorbilidades) === 'SI' && up(datosObj.especificar_comor)) ? `COMORBILIDADES: ${up(datosObj.especificar_comor)}` : '',
      up(datosObj.carac_factores),
      up(datosObj.obs_epidemiologicas)
    ].filter(Boolean).join(' | ');
    setCellValue(d3, 'C16', partesFactores);

    for (let i = 0; i < 18; i++) {
      const r3 = 28 + i;
      const c = todosContactos[i] || {};
      const hasNom = Boolean(c.nombre && String(c.nombre).trim());
      const dirYTel = [up(c.direccion), up(c.lugar)].filter(Boolean).join(' - ');
      const enfermoSi = Boolean(hasNom && up(c.enfermo) === 'SI');
      setCellValue(d3, `C${r3}`, hasNom ? up(c.nombre) : '');
      setCellValue(d3, `I${r3}`, hasNom ? (c.edad || '') : '');
      setCellValue(d3, `J${r3}`, hasNom ? up(c.sexo) : '');
      setCellValue(d3, `L${r3}`, hasNom ? up(c.relacion) : '');
      setCellValue(d3, `P${r3}`, hasNom ? dirYTel : '');
      setCellValue(d3, `U${r3}`, enfermoSi ? 'X' : '');
      setCellValue(d3, `V${r3}`, (hasNom && !enfermoSi) ? 'X' : '');
      setCellValue(d3, `W${r3}`, enfermoSi ? (c.fecha || '') : '');
      setCellValue(d3, `Y${r3}`, enfermoSi ? up(c.obs) : '');
    }

    const muestraSi = up(datosObj.muestra) === 'SI';
    setCellValue(d3, 'J47', muestraSi ? 'X' : '');
    setCellValue(d3, 'L47', up(datosObj.muestra) === 'NO' ? 'X' : '');
    setCellValue(d3, 'U47', (muestraSi && up(datosObj.antes_tratamiento) === 'SI') ? 'X' : '');
    setCellValue(d3, 'W47', (muestraSi && up(datosObj.antes_tratamiento) === 'NO') ? 'X' : '');
    setCellValue(d3, 'F49', muestraSi ? up(datosObj.tipo_muestra) : '');
    const resLabTxt = muestraSi ? [up(datosObj.resultado), up(datosObj.agente), up(datosObj.tecnica)].filter(Boolean).join(' - ') : '';
    setCellValue(d3, 'G51', resLabTxt);

    setCellValue(d3, 'G53', '');
    const confUp = up(datosObj.confirmado_por);
    setCellValue(d3, 'W53', confUp.includes('LAB') ? 'X' : '');
    setCellValue(d3, 'Z53', confUp.includes('CL') ? 'X' : '');
    setCellValue(d3, 'AD53', confUp.includes('NEXO') ? 'X' : '');
    const broteUp = up(datosObj.tipo_caso_brote);
    setCellValue(d3, 'E55', broteUp.includes('AISLADO') ? 'X' : '');
    setCellValue(d3, 'N55', broteUp.includes('BROTE') ? 'X' : '');
    setCellValue(d3, 'H78', up(datosObj.medico_tratante));
    setCellValue(d3, 'D80', faDia);
    setCellValue(d3, 'F80', faMes);
    setCellValue(d3, 'H80', faAno);

    s3Obj.entry.rawBytes = serializarHojaSegura(d3, s3Obj.rawStr);
  }

  return await construirZipDesdeEntries(entries);
}

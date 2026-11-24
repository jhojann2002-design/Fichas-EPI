// js/epiUtils.js
// Utilidades compartidas y caché en memoria de plantillas para exportación EPI (PDF y Excel)

export function calcularSemanaEpidemiologica(fechaStr) {
  if (!fechaStr) return '';
  const partes = String(fechaStr).split('-');
  if (partes.length !== 3) return '';
  const ano = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1;
  const dia = parseInt(partes[2], 10);
  const fecha = new Date(ano, mes, dia);
  if (isNaN(fecha.getTime())) return '';

  // Norma CDC / OPS / MSP Ecuador (Semana Epidemiológica):
  // La semana corre de domingo a sábado.
  // La SE 1 es la primera semana del año que contiene al menos 4 días del año (contiene el 4 de enero).
  const dow = fecha.getDay(); // 0: domingo, ..., 6: sábado
  const startOfWeek = new Date(ano, mes, dia - dow); // domingo de esta semana
  const wednesday = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 3);
  const epiYear = wednesday.getFullYear();

  // Semana 1 del año epidemiológico: domingo de la semana que contiene el 4 de enero
  const jan4 = new Date(epiYear, 0, 4);
  const jan4Dow = jan4.getDay();
  const startOfEpiYear = new Date(epiYear, 0, 4 - jan4Dow);

  const diffDays = Math.round((startOfWeek.getTime() - startOfEpiYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(diffDays / 7) + 1;
  return weekNum > 0 ? String(weekNum) : '1';
}

export function splitDireccion(dir, maxChars = 45) {
  if (!dir) return { l1: '', l2: '' };
  const str = String(dir).trim();
  if (str.length <= maxChars) return { l1: str, l2: '' };
  let breakPoint = str.lastIndexOf(' ', maxChars);
  if (breakPoint <= 0 || breakPoint < maxChars * 0.4) {
    breakPoint = str.indexOf(' ', maxChars);
    if (breakPoint === -1) breakPoint = maxChars;
  }
  const l1 = str.substring(0, breakPoint).trim();
  const l2 = str.substring(breakPoint).trim();
  return { l1, l2 };
}

export function dividirTextoPorPalabras(texto, numLineas, maxCharsPorLinea) {
  const limpio = String(texto || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!limpio) return [];
  const palabras = limpio.split(' ');
  const lineas = [];
  let actual = '';

  for (let i = 0; i < palabras.length; i++) {
    const pal = palabras[i];
    const candidato = actual ? `${actual} ${pal}` : pal;
    if (candidato.length <= maxCharsPorLinea || !actual) {
      actual = candidato;
    } else {
      if (lineas.length < numLineas - 1) {
        lineas.push(actual);
        actual = pal;
      } else {
        actual = candidato;
      }
    }
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, numLineas);
}

let _cacheEpiPdfBytes = null;
let _cacheEpiXlsxBytes = null;
let _cacheTbPdfBytes = null;

export async function obtenerBytesPlantilla(url, tipoCache) {
  if (tipoCache === 'epi_pdf' && _cacheEpiPdfBytes) return _cacheEpiPdfBytes;
  if (tipoCache === 'epi_xlsx' && _cacheEpiXlsxBytes) return _cacheEpiXlsxBytes;
  if (tipoCache === 'tb_pdf' && _cacheTbPdfBytes) return _cacheTbPdfBytes;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se encontró la plantilla (${url}) en el servidor.`);
  }
  const buf = await res.arrayBuffer();
  if (tipoCache === 'epi_pdf') _cacheEpiPdfBytes = buf;
  if (tipoCache === 'epi_xlsx') _cacheEpiXlsxBytes = buf;
  if (tipoCache === 'tb_pdf') _cacheTbPdfBytes = buf;
  return buf;
}

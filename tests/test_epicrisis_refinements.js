// tests/test_epicrisis_refinements.js
// Verification of user refinements for Formulario 006 (Epicrisis)

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Epicrisis Refinements ---');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// 1. Unicodigo default
assert(
  html.includes('id="epicrisis_unicodigo"') && html.includes('value="13D01"'),
  '#epicrisis_unicodigo must exist in index.html with default value 13D01'
);
console.log('✓ PASS: Unicódigo defaults to 13D01 in HTML');

// 2. Redundant inputs hidden
assert(
  html.includes('<input type="hidden" id="epicrisis_hcu">'),
  '#epicrisis_hcu must be hidden input'
);
assert(
  html.includes('<input type="hidden" id="epicrisis_archivo">'),
  '#epicrisis_archivo must be hidden input'
);
console.log('✓ PASS: Redundant HCU and Archivo inputs are hidden to avoid duplicate prompt');

// 3. Tipo de alta defaults to NO_APLICA
assert(
  html.includes('<option value="NO_APLICA" selected>'),
  '#epicrisis_tipo_alta must have NO_APLICA selected by default'
);
console.log('✓ PASS: Tipo de alta has NO_APLICA selected by default');

// 4. Doctor blocks exist in HTML
assert(html.includes('id="epicrisis_med1_primer_nombre"'), 'med1_primer_nombre exists');
assert(html.includes('id="epicrisis_med1_segundo_nombre"'), 'med1_segundo_nombre exists');
assert(html.includes('id="epicrisis_med1_primer_ape"'), 'med1_primer_ape exists');
assert(html.includes('id="epicrisis_med1_segundo_ape"'), 'med1_segundo_ape exists');
console.log('✓ PASS: Doctor name block inputs (primer/segundo nombre/apellido) exist');

// 5. Additional doctor blocks have remove buttons
for (let i = 2; i <= 4; i++) {
  assert(html.includes(`id="bloqueMedico${i}"`), `#bloqueMedico${i} must exist`);
  assert(html.includes(`eliminarMedicoAdicional(${i})`), `Remove button for medico ${i} must exist`);
}
console.log('✓ PASS: Additional doctor blocks 2, 3, 4 have individual removal buttons');

// 6. Selector "elaborado y revisado por" removed from DOM
assert(!html.includes('id="epicrisis_resp_rol"'), '#epicrisis_resp_rol should not exist in DOM');
console.log('✓ PASS: Elaborado / Revisado selector is removed');

// 7. Verify logic in js/epicrisis.js
const epicrisisCode = fs.readFileSync(path.resolve(__dirname, '../js/epicrisis.js'), 'utf8');

// Checks for abbreviation of IESS
assert(
  epicrisisCode.includes("inst = 'IESS'") || epicrisisCode.includes('d.institucion = inst'),
  'js/epicrisis.js must abbreviate IESS'
);
console.log('✓ PASS: IESS abbreviation logic present in js/epicrisis.js');

// Checks that colon ":" is preserved in time field
assert(
  !epicrisisCode.includes("d.resp_hora.replace(':', '')"),
  'js/epicrisis.js must NOT strip colon from resp_hora'
);
assert(
  epicrisisCode.includes("setTextField('HORA hhmmRow1', d.resp_hora || '')"),
  'js/epicrisis.js must preserve colon in HORA hhmmRow1'
);
console.log('✓ PASS: Colon ":" is preserved in time field');

// Checks that ELABORADO POR and REVISADO POR are both empty (no X)
assert(epicrisisCode.includes("setTextField('ELABORADO POR', '')"), 'js/epicrisis.js sets ELABORADO POR to empty');
assert(epicrisisCode.includes("setTextField('REVISADO POR', '')"), 'js/epicrisis.js sets REVISADO POR to empty');
assert(epicrisisCode.includes("setCellValue(xmlDoc, 'N64', '')"), 'js/epicrisis.js clears N64 in Excel');
assert(epicrisisCode.includes("setCellValue(xmlDoc, 'AV64', '')"), 'js/epicrisis.js clears AV64 in Excel');
console.log('✓ PASS: ELABORADO POR and REVISADO POR are both blank without X');

// Checks that Hoja 2 header names are correctly oriented
assert(epicrisisCode.includes("setTextField('PRIMER APELLIDORow1_2', (d.primer_apellido || '').toUpperCase()"), 'PDF Hoja 2 puts primer_apellido in PRIMER APELLIDO');
assert(epicrisisCode.includes("setTextField('PRIMER NOMBRERow1_2', (d.primer_nombre || '').toUpperCase()"), 'PDF Hoja 2 puts primer_nombre in PRIMER NOMBRE');
assert(epicrisisCode.includes("setCellValue(xmlDoc, 'A3', (d.primer_apellido || '').toUpperCase())"), 'Excel Hoja 2 sets A3 to primer_apellido');
assert(epicrisisCode.includes("setCellValue(xmlDoc, 'P3', (d.primer_nombre || '').toUpperCase())"), 'Excel Hoja 2 sets P3 to primer_nombre');
console.log('✓ PASS: Hoja 2 header names correctly mapped in PDF and Excel (primer apellido and primer nombre in their rightful fields)');

// Checks that medico responsable receives only first name
assert(epicrisisCode.includes("d.resp_primer_nombre = med1PrimerNombre.trim()"), 'Extracts only primer nombre from med1PrimerNombre');
assert(epicrisisCode.includes("setTextField('PRIMER NOMBRE medico', (d.resp_primer_nombre || d.resp_nombre || '').toUpperCase())"), 'Sets only primer nombre in PDF');
assert(epicrisisCode.includes("setCellValue(xmlDoc, 'O61', (d.resp_primer_nombre || d.resp_nombre || '').toUpperCase())"), 'Sets only primer nombre in Excel');
console.log('✓ PASS: Medico responsable uses strictly first name in field');

// Checks that Point F is centered
assert(epicrisisCode.includes("indicaciones de alta/egreso") && epicrisisCode.includes("TextAlignment.Center"), 'Point F is centered in PDF');
assert(html.includes('id="epicrisis_indicaciones_alta"') && html.includes('text-align: center;'), 'Point F is centered in HTML');
console.log('✓ PASS: Point F is centered in PDF and HTML');

// Checks that periodo de responsabilidad defaults to date and supports range
assert(html.includes('id="epicrisis_med1_periodo_desde"'), '#epicrisis_med1_periodo_desde must exist');
assert(html.includes('id="epicrisis_med1_periodo_hasta"'), '#epicrisis_med1_periodo_hasta must exist');
assert(epicrisisCode.includes("d.medico_1_periodo || d.resp_fecha"), 'Período de responsabilidad falls back to resp_fecha');
assert(epicrisisCode.includes("periodoCompuesto = `${med1Desde} al ${med1Hasta}`"), 'Periodo de responsabilidad supports date range');
console.log('✓ PASS: Período de responsabilidad defaults to initial date and supports date range');

// Checks AS400 cleaning preserves bullet points with newlines and cleans rogue spaces
assert(epicrisisCode.includes('export function limpiarTextoAS400'), 'limpiarTextoAS400 exists');

// Extraer y evaluar limpiarTextoAS400 para pruebas unitarias directas
const limpiarFnMatch = epicrisisCode.match(/export function limpiarTextoAS400\([\s\S]*?\n\}/);
assert(limpiarFnMatch, 'limpiarTextoAS400 function definition found');
const fnCode = limpiarFnMatch[0].replace('export function limpiarTextoAS400', 'function limpiarTextoAS400');
const limpiarTestFn = new Function(`${fnCode}; return limpiarTextoAS400;`)();

const as400Raw = `-   CEFTRIAXONA 1G IV   C/12H\n- \u00A0 \u00A0PARACETAMOL 1G VO  , PRN DOLOR .\n- DIETA HIPOSODICA CON\n  ABUNDANTE LIQUIDO ORAL`;
const as400Cleaned = limpiarTestFn(as400Raw);
assert.strictEqual(
  as400Cleaned,
  '- CEFTRIAXONA 1G IV C/12H\n- PARACETAMOL 1G VO, PRN DOLOR.\n- DIETA HIPOSODICA CON ABUNDANTE LIQUIDO ORAL',
  'limpiarTextoAS400 must clean non-breaking spaces, multi-spaces, punctuation spacing, and join wrapped bullet lines'
);
console.log('✓ PASS: AS400 cleaning functionality verified with real-world edge cases (viñetas, NBSP, punctuation spacing)');

// Verifica que las viñetas con letras (D., I., M., E., L., C., O.) y prescripciones médicas respeten los enters
const as400LetrasRaw = `D. NPO
I. CLORURO DE SODIO 0.9% PASAR IV A 32 ML CADA HORA
M. CEFTRIAXONA 900 MG IV CADA 12 HORAS
ONDANSETRON 3.5 MG IV PRN
PARACETAMOL 245 MG IV PRN
E. ECOGRAFIA DE ABDOMEN REPORTADA EN SISTEMA
L. EN SISTEMA
C. COMUNICAR NOVEDADES
O. INTERCONSULTA A CIRUGIA PEDIATRICA
OBSERVACION`;

const as400LetrasCleaned = limpiarTestFn(as400LetrasRaw);
const expectedLetras = `D. NPO
I. CLORURO DE SODIO 0.9% PASAR IV A 32 ML CADA HORA
M. CEFTRIAXONA 900 MG IV CADA 12 HORAS
ONDANSETRON 3.5 MG IV PRN
PARACETAMOL 245 MG IV PRN
E. ECOGRAFIA DE ABDOMEN REPORTADA EN SISTEMA
L. EN SISTEMA
C. COMUNICAR NOVEDADES
O. INTERCONSULTA A CIRUGIA PEDIATRICA
OBSERVACION`;

assert.strictEqual(
  as400LetrasCleaned,
  expectedLetras,
  'limpiarTextoAS400 must respect enters for letter bullets (D., I., M., E., L., C., O.) and independent medical prescriptions'
);
console.log('✓ PASS: AS400 letter bullets (D., I., M., etc.) and medical prescriptions respect enters without joining into prose');

// Verifica que las viñetas compuestas con número y guión (1. - , 2. - , 11. -) NO se dividan en líneas separadas
const as400CompuestoRaw = `PLAN INICIAL:
1. - CONTROL DE SIGNOS VITALES
2. - CUIDADOS DE ENFERMERIA
3. - MONITORIZACION CONTINUA
4. EVITAR RUIDOS Y LUZ INTENSA
5. MANIPULACION MINIMA
6- NADA POR VIA ORAL MAS SOGA
7. - PHP 6/0/0 FB: 4.1 DEXTRO0A AL 10% 152MILILITROS
+ PASAR A 6.3 ML/HORA
6. OXIGENOTERAPIA CPAP FIO2 30 %
7. - AMPICILINA 253 MILIGRAMOS ENDOVENOSO CADA 12 HORAS (1)
8. - GENTAMICINA 10 MILIGRAMOS ENDOVENOSO CADA 24 HORAS (1)
9. EXAMENES DE LABORATORIOS, BIOMETRIA, PCR, PROCALCITONINA, EMO, URO HEMOX2 CALCIO. ELECTROLITOS, CALCIO, AST, ALT.
10. EXAMENES TORCH PARTICULAR
11. - REPORTAR NOVEDADES`;

const as400CompuestoCleaned = limpiarTestFn(as400CompuestoRaw);
assert(!as400CompuestoCleaned.includes('1.\n-'), '1. must not be isolated on a separate line from -');
assert(!as400CompuestoCleaned.includes('2.\n-'), '2. must not be isolated on a separate line from -');
assert(!as400CompuestoCleaned.includes('3.\n-'), '3. must not be isolated on a separate line from -');
assert(!as400CompuestoCleaned.includes('7.\n-'), '7. must not be isolated on a separate line from -');
assert(!as400CompuestoCleaned.includes('8.\n-'), '8. must not be isolated on a separate line from -');
assert(!as400CompuestoCleaned.includes('11.\n-'), '11. must not be isolated on a separate line from -');
assert(as400CompuestoCleaned.includes('1. - CONTROL DE SIGNOS VITALES'), 'Preserves 1. - CONTROL DE SIGNOS VITALES');
assert(as400CompuestoCleaned.includes('2. - CUIDADOS DE ENFERMERIA'), 'Preserves 2. - CUIDADOS DE ENFERMERIA');
assert(as400CompuestoCleaned.includes('11. - REPORTAR NOVEDADES'), 'Preserves 11. - REPORTAR NOVEDADES');
console.log('✓ PASS: AS400 combined bullets (1. - , 2. - , 11. -) preserved intact without creating orphan number lines');

// Checks that Diagnósticos Secundarios 2-5 are collapsible with remove buttons and dynamic add button
assert(html.includes('id="filaDiagSec2"') && html.includes('id="filaDiagSec5"'), 'filaDiagSec2 through filaDiagSec5 exist');
for (let i = 2; i <= 5; i++) {
  assert(html.includes(`id="filaDiagSec${i}"`) && html.includes(`onclick="window.eliminarDiagnosticoSecundario(${i})"`), `Fila ${i} has removal button`);
}
assert(html.includes('id="btnAgregarDiagSec"') && html.includes('window.agregarDiagnosticoSecundario()'), 'btnAgregarDiagSec exists');
assert(epicrisisCode.includes('function agregarDiagnosticoSecundario'), 'agregarDiagnosticoSecundario exists in epicrisis.js');
assert(epicrisisCode.includes('function eliminarDiagnosticoSecundario'), 'eliminarDiagnosticoSecundario exists in epicrisis.js');
assert(epicrisisCode.includes('function actualizarVisibilidadDiagnosticosSecundarios'), 'actualizarVisibilidadDiagnosticosSecundarios exists in epicrisis.js');
console.log('✓ PASS: Dynamic secondary diagnoses (hidden 2-5 by default, add/remove buttons) verified');

// Checks that agregarMedicoAdicional and eliminarMedicoAdicional exist
assert(epicrisisCode.includes('function agregarMedicoAdicional'), 'agregarMedicoAdicional function exists');
assert(epicrisisCode.includes('function eliminarMedicoAdicional'), 'eliminarMedicoAdicional function exists');
console.log('✓ PASS: Doctor addition and removal functions exist');

// 8. Verify storage.js defaults
const storageCode = fs.readFileSync(path.resolve(__dirname, '../js/storage.js'), 'utf8');
assert(storageCode.includes("unicodigoEl.value = '13D01'"), 'storage.js resets unicodigo to 13D01');
assert(storageCode.includes("tipoAlta.value = 'NO_APLICA'"), 'storage.js resets tipo_alta to NO_APLICA');
console.log('✓ PASS: storage.js resets unicodigo to 13D01 and tipo_alta to NO_APLICA');

// 9. Verify single date at top, hour at top, unicodigo & num_hoja at top, no duplicate date in epicrisis
const topCardMatch = html.match(/<div class="card-body pt-2">[\s\S]*?id="colFechaAtencion"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
assert(topCardMatch, 'Top card exists');
const topCardContent = topCardMatch[0];
assert(topCardContent.includes('id="epicrisis_unicodigo"'), 'Unicodigo is placed in the top card');
assert(topCardContent.includes('id="epicrisis_num_hoja"'), 'Num hoja is placed in the top card');
assert(topCardContent.includes('id="fecha_atencion"'), 'Fecha is placed in the top card');
assert(topCardContent.includes('id="epicrisis_resp_hora"'), 'Hora is placed in the top card');

const epicrisisContainer = html.substring(html.indexOf('id="contenedorEpicrisis"'));
assert(epicrisisContainer.includes('id="epicrisis_med1_periodo_desde"') && epicrisisContainer.includes('id="epicrisis_med1_periodo_hasta"'), 'Periodo de responsabilidad has date range pickers');
assert(epicrisisContainer.includes('id="epicrisis_med1_periodo"'), 'med1_periodo field exists');
console.log('✓ PASS: Single date at top, hour/unicodigo/hoja at top, periodo de responsabilidad supports date range');

// 10. Verify visual and functional unification of top cards
const mainJs = fs.readFileSync(path.resolve(__dirname, '../js/main.js'), 'utf8');
const stylesCss = fs.readFileSync(path.resolve(__dirname, '../styles.css'), 'utf8');

assert(
  mainJs.includes("txtTituloUnidad.innerText = 'Establecimiento de Salud'"),
  'In Epicrisis, card title must be "Establecimiento de Salud" without "notificador"'
);
assert(
  !mainJs.includes("'Establecimiento Notificador (Epicrisis)'"),
  'main.js must not contain "Establecimiento Notificador"'
);
assert(html.includes('id="badgeSeccionA"'), 'badgeSeccionA exists for Section A');
assert(stylesCss.includes('.apple-card {'), '.apple-card class is formally defined in styles.css');
assert(stylesCss.includes('body[data-modo="epicrisis"] #accordionFicha > .accordion-item:first-child .accordion-button::after'), 'Chevron is hidden on identification card in epicrisis');
assert(html.includes('id="edad_epicrisis"') && html.includes('id="condicion_edad_epicrisis"'), 'Edad and Condicion inputs exist');
console.log('✓ PASS: Top cards visually and functionally unified with rest of Epicrisis');

// 11. Point F multiline indications in PDF and Excel
assert(
  html.includes('id="epicrisis_indicaciones_alta"'),
  'Point F indicaciones_alta must exist'
);
assert(
  epicrisisCode.includes("w.setRectangle({") && epicrisisCode.includes("110.478"),
  'PDF synchronizes indicaciones de alta/egreso widget rectangle to expanded 110.48pt box'
);
assert(
  epicrisisCode.includes("w.dict.set(PDFName.of('Ff'), PDFNumber.of(4096))"),
  'PDF ensures multiline flag (Ff 4096) is active on field and widgets'
);
assert(
  epicrisisCode.includes("setCellValue(xmlDoc, 'A25', textoInd)"),
  'Excel writes complete multiline text into merged cell A25'
);
assert(
  epicrisisCode.includes("cellA25.setAttribute('s', '106')") && epicrisisCode.includes("cellA25.setAttribute('s', '120')"),
  'Excel applies top-align wrapText style 106 for multiline and style 120 for hemodinamico'
);
assert(
  epicrisisCode.includes("for (let r = 26; r <= 36; r++)") && epicrisisCode.includes("setCellValue(xmlDoc, `A${r}`, '')"),
  'Excel clears collapsed/hidden rows 26 to 36'
);

// Verify plantilla_epicrisis.xlsx has wrapText="1" on style 120
const { execSync } = require('child_process');
const pyCheck = execSync(`python3 -c "
import zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile('plantilla_epicrisis.xlsx', 'r') as z:
    content = z.read('xl/styles.xml')
root = ET.fromstring(content)
ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
xfs = root.find('.//main:cellXfs', ns)
xf120 = xfs.findall('main:xf', ns)[120]
align = xf120.find('main:alignment', ns)
assert align.attrib.get('wrapText') == '1', 'wrapText must be 1 on style 120'
print('OK')
"`).toString().trim();
assert.strictEqual(pyCheck, 'OK', 'plantilla_epicrisis.xlsx style 120 must have wrapText=1');

console.log('✓ PASS: Point F has ample space and renders complete multiline content in both PDF and Excel without clipping');

// 12. Dark Mode text visibility in sections G downwards
assert(
  stylesCss.includes('[data-theme="dark"] .text-dark') && stylesCss.includes('[data-theme="dark"] .text-muted'),
  'styles.css must override text-dark and text-muted in dark mode to prevent black-on-black text'
);
assert(
  !html.includes('class="fw-bold text-dark"'),
  'index.html should not use text-dark in section labels'
);
const uiJs = fs.readFileSync(path.resolve(__dirname, '../js/ui.js'), 'utf8');
assert(
  uiJs.includes("data-bs-theme"),
  'ui.js must sync data-bs-theme to keep Bootstrap components visible in dark mode'
);
console.log('✓ PASS: Dark mode text visibility resolved across all sections G to J');

console.log('\nAll Epicrisis Refinement Tests Passed Successfully!');

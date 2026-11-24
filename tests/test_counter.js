// tests/test_counter.js - Unit and Integration Tests for Local & Offline Document Counter
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Fichas Document Counter & Statistics System ---');

// Mock browser localStorage
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Mock browser window and document
global.window = {
  dispatchEvent: () => {}
};
global.document = {
  getElementById: (id) => null
};
global.navigator = {
  onLine: false
};

// Read counter code directly or evaluate its logic
const counterCode = fs.readFileSync(path.resolve(__dirname, '../js/counter.js'), 'utf8');

// 1. Verify counter.js exports and functions
assert(counterCode.includes('export function obtenerEstadisticasLocales'), 'obtenerEstadisticasLocales must be exported');
assert(counterCode.includes('export function registrarFichaGenerada'), 'registrarFichaGenerada must be exported');
assert(counterCode.includes('export function actualizarBadgesContador'), 'actualizarBadgesContador must be exported');
assert(counterCode.includes('export function mostrarModalEstadisticas'), 'mostrarModalEstadisticas must be exported');
assert(counterCode.includes('export async function sincronizarFichasPendientes'), 'sincronizarFichasPendientes must be exported');
assert(counterCode.includes('export function inicializarContador'), 'inicializarContador must be exported');
console.log('✓ PASS: All core counter functions are properly defined and exported');

// 2. Test counter logic in Node VM
const vm = require('vm');
const sandbox = {
  localStorage: global.localStorage,
  window: global.window,
  document: global.document,
  navigator: global.navigator,
  console: console,
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  Date: Date,
  Math: Math,
  JSON: JSON,
  Array: Array,
  String: String,
  CustomEvent: class CustomEvent { constructor(type, opt) { this.type = type; this.detail = opt ? opt.detail : null; } }
};

// Strip ESM export/import for standalone node execution of counter logic
const cjsCounterCode = counterCode
  .replace(/import\s+.*?;/g, 'const API_URL = "https://script.google.com/test";')
  .replace(/export\s+async\s+function/g, 'async function')
  .replace(/export\s+function/g, 'function')
  .replace(/export\s+const/g, 'const')
  .replace(/export\s+let/g, 'let')
  + '\n;module.exports = { obtenerEstadisticasLocales, registrarFichaGenerada, guardarEstadisticasLocales, actualizarBadgesContador };';

const moduleContext = { module: { exports: {} } };
vm.runInNewContext(cjsCounterCode, { ...sandbox, ...moduleContext });
const counter = moduleContext.module.exports;

// Test initial stats
const initial = counter.obtenerEstadisticasLocales();
assert.strictEqual(initial.total, 0, 'Initial total must be 0');
assert.strictEqual(initial.hoy.cantidad, 0, 'Initial today count must be 0');
assert.strictEqual(initial.porModo.epi, 0, 'Initial epi count must be 0');
assert.strictEqual(initial.porModo.sppat, 0, 'Initial sppat count must be 0');
assert.strictEqual(initial.porModo.epicrisis, 0, 'Initial epicrisis count must be 0');
assert.strictEqual(initial.porFormato.pdf, 0, 'Initial pdf count must be 0');
assert.strictEqual(initial.porFormato.excel, 0, 'Initial excel count must be 0');
assert.strictEqual(initial.historial.length, 0, 'Initial history length must be 0');
console.log('✓ PASS: Initial stats default correctly to zero with valid schema');

// Test recording an EPI PDF
counter.registrarFichaGenerada({
  modo: 'epi',
  formato: 'pdf',
  paciente: 'DEMERA JHOJANN',
  cedula: '1315556667',
  establecimiento: 'HOSPITAL GENERAL PORTOVIEJO',
  diagnostico: 'A09 - DIARREA'
});

let stats = counter.obtenerEstadisticasLocales();
assert.strictEqual(stats.total, 1, 'Total must be 1');
assert.strictEqual(stats.hoy.cantidad, 1, 'Today count must be 1');
assert.strictEqual(stats.porModo.epi, 1, 'EPI count must be 1');
assert.strictEqual(stats.porFormato.pdf, 1, 'PDF count must be 1');
assert.strictEqual(stats.porEstablecimiento['HOSPITAL GENERAL PORTOVIEJO'], 1, 'Establishment count must be 1');
assert.strictEqual(stats.historial.length, 1, 'History length must be 1');
assert.strictEqual(stats.historial[0].paciente, 'DEMERA JHOJANN');
console.log('✓ PASS: Recording EPI PDF updates total, today, mode, format and history accurately');

// Test recording SPPAT
counter.registrarFichaGenerada({
  modo: 'sppat',
  formato: 'pdf',
  paciente: 'LOOR CARLOS',
  cedula: '1309998881',
  establecimiento: 'HOSPITAL GENERAL PORTOVIEJO',
  diagnostico: 'V89 - ACCIDENTE'
});

stats = counter.obtenerEstadisticasLocales();
assert.strictEqual(stats.total, 2, 'Total must be 2');
assert.strictEqual(stats.porModo.sppat, 1, 'SPPAT count must be 1');
assert.strictEqual(stats.porFormato.pdf, 2, 'PDF count must be 2');
console.log('✓ PASS: Recording SPPAT increments sppat mode and total count');

// Test recording Epicrisis Excel
counter.registrarFichaGenerada({
  modo: 'epicrisis',
  formato: 'excel',
  paciente: 'MENDOZA MARIA',
  cedula: '1301112223',
  establecimiento: 'HOSPITAL DE ESPECIALIDADES',
  diagnostico: 'K35 - APENDICITIS'
});

stats = counter.obtenerEstadisticasLocales();
assert.strictEqual(stats.total, 3, 'Total must be 3');
assert.strictEqual(stats.porModo.epicrisis, 1, 'Epicrisis count must be 1');
assert.strictEqual(stats.porFormato.excel, 1, 'Excel count must be 1');
assert.strictEqual(stats.porEstablecimiento['HOSPITAL DE ESPECIALIDADES'], 1, 'Hospital count must be 1');
console.log('✓ PASS: Recording Epicrisis Excel increments epicrisis mode, excel format, and distinct hospital');

// Test history capping at 50
for (let i = 0; i < 60; i++) {
  counter.registrarFichaGenerada({
    modo: 'epi',
    formato: 'pdf',
    paciente: `PACIENTE TEST ${i}`,
    cedula: `13000000${i}`,
    establecimiento: 'CENTRO DE SALUD'
  });
}
stats = counter.obtenerEstadisticasLocales();
assert.strictEqual(stats.total, 63, 'Total must reflect all 63 generated files');
assert(stats.historial.length <= 50, 'History array must not exceed 50 entries to keep localStorage lean');
console.log('✓ PASS: History array is properly capped at 50 entries while total count preserves all 63');

// 3. Verify hooks in api.js, main.js, and epicrisis.js
const apiJs = fs.readFileSync(path.resolve(__dirname, '../js/api.js'), 'utf8');
assert(apiJs.includes('registrarFichaGenerada'), 'api.js must import and call registrarFichaGenerada');
assert(apiJs.includes("modo: 'epi'"), 'api.js must pass modo: "epi"');
console.log('✓ PASS: api.js successfully hooked to document counter for EPI PDF & Excel');

const mainJs = fs.readFileSync(path.resolve(__dirname, '../js/main.js'), 'utf8');
assert(mainJs.includes('registrarFichaGenerada'), 'main.js must import and call registrarFichaGenerada');
assert(mainJs.includes("modo: 'sppat'"), 'main.js must pass modo: "sppat"');
assert(mainJs.includes('inicializarContador()'), 'main.js must call inicializarContador()');
console.log('✓ PASS: main.js successfully hooked to document counter for SPPAT and initializes counter');

const epicrisisJs = fs.readFileSync(path.resolve(__dirname, '../js/epicrisis.js'), 'utf8');
assert(epicrisisJs.includes('registrarFichaGenerada'), 'epicrisis.js must import and call registrarFichaGenerada');
assert(epicrisisJs.includes("modo: 'epicrisis'"), 'epicrisis.js must pass modo: "epicrisis"');
console.log('✓ PASS: epicrisis.js successfully hooked to document counter for Epicrisis PDF & Excel');

// 4. Verify discreet UI in index.html and dblclick trigger
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
assert(!html.includes('id="btnStatsHeader"'), 'index.html must not show visible counter button in header');
assert(!html.includes('id="btnStatsMenu"'), 'index.html must not show visible stats menu button');
assert(html.includes('id="devSignature"'), 'index.html must contain #devSignature in footer');
assert(
  html.includes('id="devSignature"') && html.includes('ondblclick="window.mostrarModalEstadisticas()"'),
  '#devSignature must bind ondblclick to mostrarModalEstadisticas()'
);
assert(
  html.includes('Desarrollado por Jhojann Demera') && !html.includes('fichas generadas</span> (Ver estadísticas)'),
  '#devSignature must only display "Desarrollado por Jhojann Demera" without visible counter or stats text'
);
assert(apiJs.includes("devSig.addEventListener('dblclick'"), 'api.js must listen to dblclick event on #devSignature');
console.log('✓ PASS: Discreet footer signature verified with double-click stats trigger and clean text');

// 5. Verify styles in styles.css
const stylesCss = fs.readFileSync(path.resolve(__dirname, '../styles.css'), 'utf8');
assert(stylesCss.includes('.btn-apple-stats'), 'styles.css must style .btn-apple-stats');
assert(stylesCss.includes('.badge-stats-count'), 'styles.css must style .badge-stats-count');
console.log('✓ PASS: CSS styles for Apple counter button and count badge verified');

// 6. Verify Service Worker v47
const swJs = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8');
assert(swJs.includes("'fichas-epi-cache-v47'"), 'sw.js must be bumped to fichas-epi-cache-v47');
assert(swJs.includes("'./js/counter.js'"), 'sw.js must cache ./js/counter.js');
console.log('✓ PASS: Service worker cache updated to v47 with ./js/counter.js included');

console.log('\n--- All 6 Document Counter & Statistics Tests Passed Successfully! ---');

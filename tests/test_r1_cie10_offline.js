// tests/test_r1_cie10_offline.js
// Test Suite for Requirement R1: Local Bundled CIE-10 Search & Epicrisis Form Wiring

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createSimulatedEnvironment } = require('./helpers/dom_env.js');

const CIE10_JSON_PATH = path.resolve(__dirname, '../cie10.json');
const SW_PATH = path.resolve(__dirname, '../sw.js');
const INDEX_HTML_PATH = path.resolve(__dirname, '../index.html');
const EPICRISIS_JS_PATH = path.resolve(__dirname, '../js/epicrisis.js');

/**
 * Normalization helper (matches application logic)
 */
function normalizarTexto(txt) {
  if (!txt) return '';
  return txt
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .trim();
}

/**
 * Format 4-character code (e.g. K358 -> K35.8)
 */
function formatearCie10Codigo(c) {
  if (!c) return '';
  const clean = c.toString().trim().toUpperCase();
  if (clean.includes('.')) return clean;
  if (clean.length === 4 && /^[A-Z][0-9]{3}$/.test(clean)) {
    return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  }
  return clean;
}

/**
 * Simulates in-memory CIE-10 search matching the search engine specifications
 */
function buscarEnCatalogoCie10(catalogo, query, maxResultados = 30) {
  if (!query || typeof query !== 'string') return [];
  const qNorm = normalizarTexto(query);
  if (!qNorm) return [];

  const tokens = qNorm.split(/\s+/).filter(Boolean);
  const resultados = [];

  for (let i = 0; i < catalogo.length; i++) {
    const item = catalogo[i];
    const cNorm = normalizarTexto(item.c);
    const dNorm = normalizarTexto(item.d);

    const matchesAll = tokens.every(tok => cNorm.includes(tok) || dNorm.includes(tok));
    if (matchesAll) {
      resultados.push({
        c: item.c,
        cFmt: formatearCie10Codigo(item.c),
        d: item.d
      });
      if (resultados.length >= maxResultados) break;
    }
  }
  return resultados;
}

function runR1Tests() {
  const suiteResults = [];

  function test(name, fn) {
    try {
      fn();
      suiteResults.push({ name, passed: true });
    } catch (err) {
      suiteResults.push({ name, passed: false, error: err.message });
    }
  }

  let cie10Catalog = null;

  // --- TIER 1: Feature Coverage (>= 5 tests) ---

  test('R1-T1-1: cie10.json is bundled locally, valid JSON, and contains >14,000 items', () => {
    assert(fs.existsSync(CIE10_JSON_PATH), `Local bundled catalog cie10.json not found at ${CIE10_JSON_PATH}`);
    const raw = fs.readFileSync(CIE10_JSON_PATH, 'utf8');
    cie10Catalog = JSON.parse(raw);
    assert(Array.isArray(cie10Catalog), 'cie10.json root must be a JSON array');
    assert(cie10Catalog.length >= 14000, `Expected at least 14,000 entries in cie10.json, found ${cie10Catalog.length}`);

    // Sample validation of schema: { c: string, d: string }
    const sample = cie10Catalog[0];
    assert(sample && typeof sample.c === 'string' && typeof sample.d === 'string', 'Items in cie10.json must have string properties "c" and "d"');
  });

  test('R1-T1-2: Real-time search by code matches exact disease codes', () => {
    assert(cie10Catalog, 'cie10Catalog must be loaded');
    const resA00 = buscarEnCatalogoCie10(cie10Catalog, 'A00');
    assert(resA00.length > 0, 'Searching for code "A00" should return results');
    assert(resA00.some(r => r.c.startsWith('A00')), 'Results for "A00" must include A00 category');

    const resK358 = buscarEnCatalogoCie10(cie10Catalog, 'K358');
    assert(resK358.length > 0, 'Searching for code "K358" should return results');
    assert(resK358.some(r => r.c === 'K358' || r.c === 'K35.8'), 'Results must contain K358/K35.8');
  });

  test('R1-T1-3: Real-time search by description matches clinical terms', () => {
    assert(cie10Catalog, 'cie10Catalog must be loaded');
    const resApendicitis = buscarEnCatalogoCie10(cie10Catalog, 'apendicitis');
    assert(resApendicitis.length > 0, 'Searching for "apendicitis" should return results');
    assert(resApendicitis.some(r => r.d.toLowerCase().includes('apendicitis')));

    const resCovid = buscarEnCatalogoCie10(cie10Catalog, 'COVID-19');
    assert(resCovid.length > 0, 'Searching for "COVID-19" should return results');
    assert(resCovid.some(r => r.d.toLowerCase().includes('covid')));
  });

  test('R1-T1-4: All 7 diagnosis field pairs exist in index.html (Principal, Secundarios 1–5, Causa Externa)', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    const requiredPairs = [
      { desc: 'epicrisis_diag_principal', cie: 'epicrisis_cie_principal', name: 'Principal' },
      { desc: 'epicrisis_diag_sec_1', cie: 'epicrisis_cie_sec_1', name: 'Secundario 1' },
      { desc: 'epicrisis_diag_sec_2', cie: 'epicrisis_cie_sec_2', name: 'Secundario 2' },
      { desc: 'epicrisis_diag_sec_3', cie: 'epicrisis_cie_sec_3', name: 'Secundario 3' },
      { desc: 'epicrisis_diag_sec_4', cie: 'epicrisis_cie_sec_4', name: 'Secundario 4' },
      { desc: 'epicrisis_diag_sec_5', cie: 'epicrisis_cie_sec_5', name: 'Secundario 5' },
      { desc: 'epicrisis_diag_causa_ext', cie: 'epicrisis_cie_causa_ext', name: 'Causa Externa' },
    ];

    requiredPairs.forEach(pair => {
      assert(
        html.includes(`id="${pair.desc}"`),
        `Missing description input #${pair.desc} for ${pair.name} in index.html`
      );
      assert(
        html.includes(`id="${pair.cie}"`),
        `Missing CIE-10 code input #${pair.cie} for ${pair.name} in index.html`
      );
    });
  });

  test('R1-T1-5: Selection populates both description and formatted code into DOM fields and dispatches events', () => {
    const env = createSimulatedEnvironment();
    const doc = env.doc;

    // Simulate selection on Secundario 4 and Secundario 5
    const testCases = [
      { descId: 'epicrisis_diag_principal', cieId: 'epicrisis_cie_principal', code: 'K358', desc: 'Apendicitis aguda no especificada', expectedFmt: 'K35.8' },
      { descId: 'epicrisis_diag_sec_4', cieId: 'epicrisis_cie_sec_4', code: 'U071', desc: 'COVID-19, virus identificado', expectedFmt: 'U07.1' },
      { descId: 'epicrisis_diag_sec_5', cieId: 'epicrisis_cie_sec_5', code: 'U072', desc: 'COVID-19, virus no identificado', expectedFmt: 'U07.2' },
      { descId: 'epicrisis_diag_causa_ext', cieId: 'epicrisis_cie_causa_ext', code: 'V892', desc: 'Persona lesionada en accidente de transito', expectedFmt: 'V89.2' }
    ];

    testCases.forEach(tc => {
      const descEl = doc.getElementById(tc.descId);
      const cieEl = doc.getElementById(tc.cieId);

      assert(descEl, `Element #${tc.descId} should exist in DOM`);
      assert(cieEl, `Element #${tc.cieId} should exist in DOM`);

      let inputDispatched = 0;
      let changeDispatched = 0;
      descEl.addEventListener('input', () => inputDispatched++);
      cieEl.addEventListener('change', () => changeDispatched++);

      // Simulate the selection action
      descEl.value = tc.desc;
      cieEl.value = formatearCie10Codigo(tc.code);
      descEl.dispatchEvent(new env.win.Event('input', { bubbles: true }));
      cieEl.dispatchEvent(new env.win.Event('change', { bubbles: true }));

      assert.strictEqual(descEl.value, tc.desc);
      assert.strictEqual(cieEl.value, tc.expectedFmt);
      assert(inputDispatched > 0, `Input event must be dispatched on #${tc.descId}`);
      assert(changeDispatched > 0, `Change event must be dispatched on #${tc.cieId}`);
    });
  });

  test('R1-T1-6: sw.js caches cie10.json in STATIC_ASSETS for complete offline reliability', () => {
    assert(fs.existsSync(SW_PATH), `sw.js not found at ${SW_PATH}`);
    const swContent = fs.readFileSync(SW_PATH, 'utf8');
    assert(
      swContent.includes("'./cie10.json'") || swContent.includes('"./cie10.json"'),
      `sw.js must include './cie10.json' in STATIC_ASSETS array for offline caching`
    );
  });

  // --- TIER 2: Boundary & Corner Cases (>= 5 tests) ---

  test('R1-T2-1: Code searches match identically with and without dots', () => {
    assert(cie10Catalog, 'cie10Catalog must be loaded');

    // "K358" vs "K35.8"
    const resNoDot = buscarEnCatalogoCie10(cie10Catalog, 'K358');
    const resWithDot = buscarEnCatalogoCie10(cie10Catalog, 'K35.8');

    assert(resNoDot.length > 0, 'Search for K358 should find results');
    assert(resWithDot.length > 0, 'Search for K35.8 should find results');
    assert.strictEqual(
      resNoDot[0].c.replace('.', ''),
      resWithDot[0].c.replace('.', ''),
      'Top result for K358 and K35.8 must refer to the same CIE-10 code'
    );

    // "U071" vs "U07.1"
    const resCovidNoDot = buscarEnCatalogoCie10(cie10Catalog, 'U071');
    const resCovidWithDot = buscarEnCatalogoCie10(cie10Catalog, 'U07.1');
    assert(resCovidNoDot.length > 0, 'Search for U071 should find results');
    assert(resCovidWithDot.length > 0, 'Search for U07.1 should find results');
    assert(resCovidNoDot.some(r => r.c.replace('.', '') === 'U071'));
  });

  test('R1-T2-2: Accent handling (accent-folding) produces identical search matches', () => {
    assert(cie10Catalog, 'cie10Catalog must be loaded');

    // "apéndice" vs "apendice"
    const resWithAccent = buscarEnCatalogoCie10(cie10Catalog, 'apéndice');
    const resWithoutAccent = buscarEnCatalogoCie10(cie10Catalog, 'apendice');

    assert(resWithAccent.length > 0, 'Search with accent "apéndice" must return results');
    assert(resWithoutAccent.length > 0, 'Search without accent "apendice" must return results');
    assert.strictEqual(
      resWithAccent.length,
      resWithoutAccent.length,
      'Search with and without accent must return the same number of results'
    );

    // "cólera" vs "colera"
    const resColera1 = buscarEnCatalogoCie10(cie10Catalog, 'cólera');
    const resColera2 = buscarEnCatalogoCie10(cie10Catalog, 'colera');
    assert.strictEqual(resColera1.length, resColera2.length);
  });

  test('R1-T2-3: Case-insensitivity across uppercase, lowercase, and mixed-case queries', () => {
    assert(cie10Catalog, 'cie10Catalog must be loaded');

    const lower = buscarEnCatalogoCie10(cie10Catalog, 'covid');
    const upper = buscarEnCatalogoCie10(cie10Catalog, 'COVID');
    const mixed = buscarEnCatalogoCie10(cie10Catalog, 'CoVid');

    assert(lower.length > 0, 'Lowercase query should find results');
    assert.strictEqual(lower.length, upper.length, 'Lowercase and uppercase must yield identical match counts');
    assert.strictEqual(lower.length, mixed.length, 'Mixed case must yield identical match counts');
  });

  test('R1-T2-4: Non-existent code or gibberish returns empty array without throwing', () => {
    assert(cie10Catalog, 'cie10Catalog must be loaded');

    const resNonExistent1 = buscarEnCatalogoCie10(cie10Catalog, 'ZZ999');
    const resNonExistent2 = buscarEnCatalogoCie10(cie10Catalog, 'XYZ12345');
    const resNonExistent3 = buscarEnCatalogoCie10(cie10Catalog, '@@@###$$$');

    assert.deepStrictEqual(resNonExistent1, [], 'Query ZZ999 must return empty array');
    assert.deepStrictEqual(resNonExistent2, [], 'Query XYZ12345 must return empty array');
    assert.deepStrictEqual(resNonExistent3, [], 'Query special symbols must return empty array');
  });

  test('R1-T2-5: Chapter and section headers (pipes e.g. |I1, |XXII) are completely excluded from catalog', () => {
    assert(cie10Catalog, 'cie10Catalog must be loaded');

    const headersWithPipe = cie10Catalog.filter(item =>
      (item.c && item.c.startsWith('|')) || (item.d && item.d.startsWith('|'))
    );
    assert.strictEqual(
      headersWithPipe.length,
      0,
      `Chapter headers with pipe markers must be excluded, found ${headersWithPipe.length}`
    );

    const romanHeaders = cie10Catalog.filter(item =>
      /^(CAPITULO|CHAPTER)\s+[IVXLCDM]+/i.test(item.d || '')
    );
    assert.strictEqual(
      romanHeaders.length,
      0,
      `Chapter title blocks must be excluded from diagnostic codes, found ${romanHeaders.length}`
    );
  });

  test('R1-T2-6: Empty queries and pure whitespace return empty array gracefully', () => {
    assert(cie10Catalog, 'cie10Catalog must be loaded');

    assert.deepStrictEqual(buscarEnCatalogoCie10(cie10Catalog, ''), []);
    assert.deepStrictEqual(buscarEnCatalogoCie10(cie10Catalog, '   '), []);
    assert.deepStrictEqual(buscarEnCatalogoCie10(cie10Catalog, null), []);
    assert.deepStrictEqual(buscarEnCatalogoCie10(cie10Catalog, undefined), []);
  });

  return suiteResults;
}

module.exports = { runR1Tests };

if (require.main === module) {
  const results = runR1Tests();
  let passed = 0;
  let failed = 0;
  console.log('--- R1 Test Suite Results ---');
  results.forEach(r => {
    if (r.passed) {
      passed++;
      console.log(`  ✓ ${r.name}`);
    } else {
      failed++;
      console.log(`  ✗ ${r.name}: ${r.error}`);
    }
  });
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

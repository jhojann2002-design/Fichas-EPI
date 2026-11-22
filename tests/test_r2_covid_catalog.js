// tests/test_r2_covid_catalog.js
// Test Suite for Requirement R2: EPI COVID-19 CIE-10 Corrections & Catalog Integrity

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const CATALOGOS_PATH = path.resolve(__dirname, '../catalogos.json');

// Golden baseline of the 46 non-COVID entries in catalogos.json
const EXPECTED_NON_COVID_46 = [
  "A90 DENGUE CON SIGNOS DE ALARMA",
  "A90 DENGUE SIN SIGNOS DE ALARMA",
  "A90 DENGUE CLÁSICO",
  "A91 DENGUE GRAVE",
  "A91 DENGUE HEMORRÁGICO",
  "A92.0 ENFERMEDAD POR VIRUS CHIKUNGUNYA",
  "A92.5 ENFERMEDAD POR VIRUS ZIKA",
  "A95 FIEBRE AMARILLA",
  "B50 PALUDISMO POR PLASMODIUM FALCIPARUM",
  "B51 PALUDISMO POR PLASMODIUM VIVAX",
  "B54 PALUDISMO NO ESPECIFICADO",
  "A27 LEPTOSPIROSIS",
  "B05 SARAMPIÓN",
  "B06 RUBÉOLA",
  "B26 PAROTIDITIS INFECCIOSA",
  "A37 TOS FERINA",
  "A36 DIFTERIA",
  "A35 TÉTANOS ACCIDENTAL",
  "A33 TÉTANOS NEONATAL",
  "A82 RABIA HUMANA",
  "B01 VARICELA",
  "B04 VIRUELA SÍMICA (MPOX)",
  "J09 INFLUENZA POR VIRUS IDENTIFICADO",
  "J10 INFLUENZA POR OTRO VIRUS IDENTIFICADO",
  "J11 INFLUENZA, VIRUS NO IDENTIFICADO",
  "J12-J18 NEUMONÍA GRAVE",
  "A00 CÓLERA",
  "A01 FIEBRE TIFOIDEA Y PARATIFOIDEA",
  "A08 INFECCIONES INTESTINALES VIRALES",
  "A09 ENFERMEDAD DIARREICA AGUDA",
  "B15 HEPATITIS A",
  "B16 HEPATITIS B",
  "B17 OTRAS HEPATITIS VIRALES AGUDAS",
  "A22 ÁNTRAX (CARBUNCO)",
  "A20 PESTE",
  "B55 LEISHMANIASIS CUTÁNEA",
  "B55.1 LEISHMANIASIS MUCOCUTÁNEA",
  "B57 ENFERMEDAD DE CHAGAS",
  "A50 SÍFILIS CONGÉNITA",
  "A51-A53 SÍFILIS GESTACIONAL / ADQUIRIDA",
  "B20-B24 INFECCIÓN POR VIH / SIDA",
  "A15-A16 TUBERCULOSIS PULMONAR",
  "A17-A19 TUBERCULOSIS EXTRAPULMONAR",
  "G00 MENINGITIS BACTERIANA",
  "A80 POLIOMIELITIS AGUDA",
  "OTRO EVENTO DE VIGILANCIA EPIDEMIOLÓGICA"
];

function runR2Tests() {
  const suiteResults = [];

  function test(name, fn) {
    try {
      fn();
      suiteResults.push({ name, passed: true });
    } catch (err) {
      suiteResults.push({ name, passed: false, error: err.message });
    }
  }

  // Read catalogos.json raw text
  let rawContent;
  let catalogos;

  // --- TIER 1: Feature Coverage (>= 5 tests) ---

  test('R2-T1-1: catalogos.json is valid parseable JSON', () => {
    assert(fs.existsSync(CATALOGOS_PATH), `catalogos.json must exist at ${CATALOGOS_PATH}`);
    rawContent = fs.readFileSync(CATALOGOS_PATH, 'utf8');
    catalogos = JSON.parse(rawContent);
    assert(catalogos && typeof catalogos === 'object', 'Parsed JSON must be an object');
    assert(Array.isArray(catalogos.cie10), 'catalogos.cie10 must be an array');
  });

  test('R2-T1-2: U07.1 is defined as "COVID-19, virus identificado"', () => {
    const u071Entry = catalogos.cie10.find(entry => entry.startsWith('U07.1') || entry.startsWith('U071'));
    assert(u071Entry, 'U07.1 entry must exist in catalogos.cie10');
    assert(
      u071Entry.includes('COVID-19, virus identificado'),
      `U07.1 entry must contain "COVID-19, virus identificado", found: "${u071Entry}"`
    );
  });

  test('R2-T1-3: U07.2 is defined as "COVID-19, virus no identificado"', () => {
    const u072Entry = catalogos.cie10.find(entry => entry.startsWith('U07.2') || entry.startsWith('U072'));
    assert(u072Entry, 'U07.2 entry must exist in catalogos.cie10');
    assert(
      u072Entry.includes('COVID-19, virus no identificado'),
      `U07.2 entry must contain "COVID-19, virus no identificado", found: "${u072Entry}"`
    );
  });

  test('R2-T1-4: Exactly 48 entries are present in catalogos.cie10', () => {
    assert.strictEqual(
      catalogos.cie10.length,
      48,
      `Expected exactly 48 items in catalogos.cie10, found ${catalogos.cie10.length}`
    );
  });

  test('R2-T1-5: All 46 non-COVID entries are strictly preserved without modification', () => {
    const nonCovidEntries = catalogos.cie10.filter(entry => !entry.includes('COVID'));
    assert.strictEqual(
      nonCovidEntries.length,
      46,
      `Expected exactly 46 non-COVID items, found ${nonCovidEntries.length}`
    );

    EXPECTED_NON_COVID_46.forEach(expectedItem => {
      assert(
        nonCovidEntries.includes(expectedItem),
        `Preserved entry missing or corrupted: "${expectedItem}"`
      );
    });
  });

  // --- TIER 2: Boundary & Corner Cases (>= 5 tests) ---

  test('R2-T2-1: No duplicate COVID codes in catalogos.cie10', () => {
    const covidEntries = catalogos.cie10.filter(c => c.toUpperCase().includes('COVID'));
    assert.strictEqual(
      covidEntries.length,
      2,
      `Expected exactly 2 COVID entries, found ${covidEntries.length}: ${JSON.stringify(covidEntries)}`
    );

    const u071Count = catalogos.cie10.filter(c => c.startsWith('U07.1') || c.startsWith('U071')).length;
    const u072Count = catalogos.cie10.filter(c => c.startsWith('U07.2') || c.startsWith('U072')).length;
    assert.strictEqual(u071Count, 1, `Expected exactly 1 U07.1 code, found ${u071Count}`);
    assert.strictEqual(u072Count, 1, `Expected exactly 1 U07.2 code, found ${u072Count}`);
  });

  test('R2-T2-2: Exact formatting of COVID entries with standard space and punctuation', () => {
    const u071Entry = catalogos.cie10.find(entry => entry.startsWith('U07.1'));
    const u072Entry = catalogos.cie10.find(entry => entry.startsWith('U07.2'));

    assert.strictEqual(
      u071Entry,
      'U07.1 COVID-19, virus identificado',
      `Exact string mismatch for U07.1: "${u071Entry}"`
    );
    assert.strictEqual(
      u072Entry,
      'U07.2 COVID-19, virus no identificado',
      `Exact string mismatch for U07.2: "${u072Entry}"`
    );
  });

  test('R2-T2-3: No spurious or phantom COVID / U-codes exist in catalogos.cie10', () => {
    const extraUCodes = catalogos.cie10.filter(c => c.startsWith('U') && !c.startsWith('U07.1') && !c.startsWith('U07.2'));
    assert.strictEqual(
      extraUCodes.length,
      0,
      `Found unexpected U-codes in catalogos.cie10: ${JSON.stringify(extraUCodes)}`
    );
  });

  test('R2-T2-4: TomSelect search distinguishability between virus identificado and no identificado for COVID-19', () => {
    // Simulating TomSelect search filtering logic from api.js for COVID entries
    const covidEntries = catalogos.cie10.filter(item => item.toUpperCase().includes('COVID'));
    const searchIdentificado = covidEntries.filter(item =>
      item.toLowerCase().includes('virus identificado')
    );
    assert.strictEqual(
      searchIdentificado.length,
      1,
      `Expected COVID query with "virus identificado" to return exactly 1 result (U07.1), found ${searchIdentificado.length}`
    );
    assert(searchIdentificado[0].startsWith('U07.1'));

    const searchNoIdentificado = covidEntries.filter(item =>
      item.toLowerCase().includes('virus no identificado')
    );
    assert.strictEqual(
      searchNoIdentificado.length,
      1,
      `Expected COVID query with "virus no identificado" to return exactly 1 result (U07.2), found ${searchNoIdentificado.length}`
    );
    assert(searchNoIdentificado[0].startsWith('U07.2'));
  });

  test('R2-T2-5: Character encoding integrity and accent validation across all catalog entries', () => {
    const accentedEntries = [
      "B05 SARAMPIÓN",
      "B06 RUBÉOLA",
      "A22 ÁNTRAX (CARBUNCO)",
      "A00 CÓLERA",
      "B55 LEISHMANIASIS CUTÁNEA"
    ];
    accentedEntries.forEach(acc => {
      assert(
        catalogos.cie10.includes(acc),
        `Accent encoding corrupted for: "${acc}"`
      );
    });
  });

  return suiteResults;
}

module.exports = { runR2Tests };

if (require.main === module) {
  const results = runR2Tests();
  let passed = 0;
  let failed = 0;
  console.log('--- R2 Test Suite Results ---');
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

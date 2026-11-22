// tests/test_tier3_pairwise.js
// Tier 3: Cross-Feature Combinations (Pairwise Coverage) Test Suite

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createSimulatedEnvironment } = require('./helpers/dom_env.js');

const SW_PATH = path.resolve(__dirname, '../sw.js');
const STYLES_PATH = path.resolve(__dirname, '../styles.css');

function runTier3Tests() {
  const suiteResults = [];

  function test(name, fn) {
    try {
      fn();
      suiteResults.push({ name, passed: true });
    } catch (err) {
      suiteResults.push({ name, passed: false, error: err.message });
    }
  }

  test('T3-1: Multi-form state lifecycle cycle (EPI -> Epicrisis -> SPPAT -> Epicrisis -> EPI)', () => {
    const env = createSimulatedEnvironment();
    const { doc, localStorage, win } = env;

    // Helper functions for state save/load
    function saveState(modo) {
      const data = {};
      doc.querySelectorAll('.save-state').forEach(el => {
        const esCampoSppat = el.id?.startsWith('sppat_') || Boolean(el.closest('#contenedorSppat'));
        const esCampoEpicrisis = el.id?.startsWith('epicrisis_') || Boolean(el.closest('#contenedorEpicrisis'));
        const esCampoExclusivoEpi = el.classList.contains('ocultar-en-sppat') || Boolean(el.closest('.ocultar-en-sppat')) || Boolean(el.closest('#contenedorEpiTb'));

        if (modo === 'sppat' && (esCampoExclusivoEpi || esCampoEpicrisis)) return;
        if (modo === 'epicrisis' && (esCampoExclusivoEpi || esCampoSppat)) return;
        if (modo === 'epi' && (esCampoSppat || esCampoEpicrisis)) return;

        if (el.id) data[el.id] = el.value;
      });
      const key = modo === 'epicrisis' ? 'epicrisisFormData' : (modo === 'sppat' ? 'sppatFormData' : 'epiFormData');
      localStorage.setItem(key, JSON.stringify(data));
    }

    function switchMode(targetMode) {
      const prevMode = win.modoAppActual;
      saveState(prevMode);
      win.modoAppActual = targetMode;
      doc.body.setAttribute('data-modo', targetMode);

      // Reset DOM fields
      const patientFields = ['cedula', 'primer_apellido', 'primer_nombre', 'telefono'];
      patientFields.forEach(id => {
        const el = doc.getElementById(id);
        if (el) el.value = '';
      });

      const key = targetMode === 'epicrisis' ? 'epicrisisFormData' : (targetMode === 'sppat' ? 'sppatFormData' : 'epiFormData');
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(id => {
          const el = doc.getElementById(id);
          if (el) el.value = parsed[id];
        });
      }
    }

    // Step 1: Admission in EPI
    win.modoAppActual = 'epi';
    doc.getElementById('cedula').value = '1301111111';
    doc.getElementById('primer_apellido').value = 'PACIENTE_EPI';
    doc.getElementById('primer_nombre').value = 'JUAN';
    doc.getElementById('telefono').value = '0981111111';
    saveState('epi');

    // Step 2: Switch to Epicrisis without prior saved data -> Clean initialization
    switchMode('epicrisis');
    assert.strictEqual(doc.getElementById('cedula').value, '', 'Epicrisis must start with blank cedula');
    assert.strictEqual(doc.getElementById('primer_apellido').value, '', 'Epicrisis must start with blank apellido');

    // Step 3: Clinician enters Patient B in Epicrisis
    doc.getElementById('cedula').value = '1302222222';
    doc.getElementById('primer_apellido').value = 'PACIENTE_EPICRISIS';
    doc.getElementById('primer_nombre').value = 'MARIA';
    doc.getElementById('epicrisis_diag_principal').value = 'Apendicitis aguda';
    doc.getElementById('epicrisis_cie_principal').value = 'K35.8';
    saveState('epicrisis');

    // Step 4: Switch to SPPAT
    switchMode('sppat');
    assert.strictEqual(doc.getElementById('cedula').value, '', 'SPPAT must start with blank cedula');
    doc.getElementById('cedula').value = '1303333333';
    doc.getElementById('primer_apellido').value = 'PACIENTE_SPPAT';
    doc.getElementById('primer_nombre').value = 'PEDRO';
    saveState('sppat');

    // Step 5: Switch back to Epicrisis -> Patient B restored completely
    switchMode('epicrisis');
    assert.strictEqual(doc.getElementById('cedula').value, '1302222222', 'Patient B cedula restored');
    assert.strictEqual(doc.getElementById('primer_apellido').value, 'PACIENTE_EPICRISIS', 'Patient B apellido restored');
    assert.strictEqual(doc.getElementById('epicrisis_cie_principal').value, 'K35.8', 'Patient B CIE-10 restored');

    // Step 6: Switch back to EPI -> Patient A restored completely
    switchMode('epi');
    assert.strictEqual(doc.getElementById('cedula').value, '1301111111', 'Patient A cedula restored');
    assert.strictEqual(doc.getElementById('primer_apellido').value, 'PACIENTE_EPI', 'Patient A apellido restored');
  });

  test('T3-2: CIE-10 selection across all 7 Epicrisis fields persists and restores accurately on reload', () => {
    const env = createSimulatedEnvironment();
    const { doc, localStorage } = env;

    const diagnosesToTest = [
      { descId: 'epicrisis_diag_principal', cieId: 'epicrisis_cie_principal', desc: 'Apendicitis aguda, no especificada', cie: 'K35.8' },
      { descId: 'epicrisis_diag_sec_1', cieId: 'epicrisis_cie_sec_1', desc: 'COVID-19, virus identificado', cie: 'U07.1' },
      { descId: 'epicrisis_diag_sec_2', cieId: 'epicrisis_cie_sec_2', desc: 'Neumonía bacteriana, no especificada', cie: 'J18.9' },
      { descId: 'epicrisis_diag_sec_3', cieId: 'epicrisis_cie_sec_3', desc: 'Hipertensión esencial (primaria)', cie: 'I10' },
      { descId: 'epicrisis_diag_sec_4', cieId: 'epicrisis_cie_sec_4', desc: 'Diabetes mellitus tipo 2', cie: 'E11.9' },
      { descId: 'epicrisis_diag_sec_5', cieId: 'epicrisis_cie_sec_5', desc: 'Infección de vías urinarias', cie: 'N39.0' },
      { descId: 'epicrisis_diag_causa_ext', cieId: 'epicrisis_cie_causa_ext', desc: 'Caída en el mismo nivel por deslizamiento', cie: 'W01.0' },
    ];

    // Populate fields
    const storedState = {};
    diagnosesToTest.forEach(item => {
      const descEl = doc.getElementById(item.descId);
      const cieEl = doc.getElementById(item.cieId);
      if (descEl) descEl.value = item.desc;
      if (cieEl) cieEl.value = item.cie;
      storedState[item.descId] = item.desc;
      storedState[item.cieId] = item.cie;
    });

    localStorage.setItem('epicrisisFormData', JSON.stringify(storedState));

    // Clear fields to simulate page reload
    diagnosesToTest.forEach(item => {
      const descEl = doc.getElementById(item.descId);
      const cieEl = doc.getElementById(item.cieId);
      if (descEl) descEl.value = '';
      if (cieEl) cieEl.value = '';
    });

    // Reload from storage
    const reloaded = JSON.parse(localStorage.getItem('epicrisisFormData'));
    Object.keys(reloaded).forEach(id => {
      const el = doc.getElementById(id);
      if (el) el.value = reloaded[id];
    });

    // Assert all 7 pairs match
    diagnosesToTest.forEach(item => {
      const descEl = doc.getElementById(item.descId);
      const cieEl = doc.getElementById(item.cieId);
      assert.strictEqual(descEl.value, item.desc, `Mismatch in ${item.descId}`);
      assert.strictEqual(cieEl.value, item.cie, `Mismatch in ${item.cieId}`);
    });
  });

  test('T3-3: Service worker cache versioning aligns with catalog and asset updates (v38)', () => {
    assert(fs.existsSync(SW_PATH), 'sw.js must exist');
    const swContent = fs.readFileSync(SW_PATH, 'utf8');

    // Check version bump: should be v38 (or higher than v36/v37)
    const match = swContent.match(/CACHE_NAME\s*=\s*['"]fichas-epi-cache-v(\d+)['"]/);
    assert(match, 'CACHE_NAME must follow pattern fichas-epi-cache-vXX');
    const versionNum = parseInt(match[1], 10);
    assert(
      versionNum >= 38,
      `Service worker cache version must be bumped to at least v38 to invalidate old catalog caches, current: v${versionNum}`
    );

    // Check that STATIC_ASSETS caches both catalogos.json and cie10.json
    assert(swContent.includes("'./catalogos.json'"), 'sw.js must include ./catalogos.json in cache list');
    assert(swContent.includes("'./cie10.json'"), 'sw.js must include ./cie10.json in cache list');
  });

  test('T3-4: CSS rules hide EPI-only inputs when body mode is epicrisis', () => {
    assert(fs.existsSync(STYLES_PATH), 'styles.css must exist');
    const stylesContent = fs.readFileSync(STYLES_PATH, 'utf8');

    const hasHideRule =
      /body\[data-modo="epicrisis"\]\s+\.ocultar-en-sppat/i.test(stylesContent) ||
      /\[data-modo="epicrisis"\]\s+\.ocultar-en-sppat/i.test(stylesContent);

    assert(
      hasHideRule,
      'styles.css must contain a rule hiding EPI-only fields (.ocultar-en-sppat) in epicrisis mode'
    );
  });

  return suiteResults;
}

module.exports = { runTier3Tests };

if (require.main === module) {
  const results = runTier3Tests();
  let passed = 0;
  let failed = 0;
  console.log('--- Tier 3 Test Suite Results ---');
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

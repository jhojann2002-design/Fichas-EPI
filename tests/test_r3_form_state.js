// tests/test_r3_form_state.js
// Test Suite for Requirement R3: Epicrisis Patient Data Initialization & Form State Isolation

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createSimulatedEnvironment, MockElement } = require('./helpers/dom_env.js');

const STORAGE_JS_PATH = path.resolve(__dirname, '../js/storage.js');
const MAIN_JS_PATH = path.resolve(__dirname, '../js/main.js');
const EPICRISIS_JS_PATH = path.resolve(__dirname, '../js/epicrisis.js');
const STYLES_CSS_PATH = path.resolve(__dirname, '../styles.css');

/**
 * Helper to simulate storage.js logic in Node environment
 */
function createStorageModule(env) {
  const { doc, localStorage, win } = env;

  function obtenerClaveStorage(modoExplicito) {
    const modo = modoExplicito || win.modoAppActual || localStorage.getItem('modoAppActual') || 'epi';
    if (modo === 'epicrisis') return 'epicrisisFormData';
    return modo === 'sppat' ? 'sppatFormData' : 'epiFormData';
  }

  function resetearCamposBaseEnDOM(modo) {
    const form = doc.getElementById('epiForm');
    if (form) form.reset();

    const patientFields = [
      'cedula', 'historia_clinica', 'fecha_nacimiento', 'sexo',
      'primer_apellido', 'segundo_apellido', 'primer_nombre', 'segundo_nombre',
      'telefono', 'nacionalidad', 'prov_residencia', 'canton_residencia',
      'parroquia_residencia', 'direccion', 'estado_civil', 'etnia',
      'escolaridad', 'ocupacion', 'edad', 'condicion_edad'
    ];

    if (modo === 'epicrisis') {
      patientFields.forEach(id => {
        const el = doc.getElementById(id);
        if (el) {
          if (el.tagName === 'SELECT') {
            el.value = '';
          } else {
            el.value = '';
          }
        }
      });
      const badgeEdad = doc.getElementById('badge_edad_calculada');
      if (badgeEdad) badgeEdad.innerText = '';
    } else {
      // Default residence for EPI / SPPAT
      const provEl = doc.getElementById('prov_residencia');
      if (provEl) provEl.value = 'MANABI';
    }

    if (modo === 'sppat' || modo === 'epicrisis') {
      const medEpi = doc.getElementById('medico_tratante');
      if (medEpi) medEpi.value = '';
      const tbResp = doc.getElementById('tb_responsable');
      if (tbResp) tbResp.value = '';
    }
  }

  function saveFormData(modoExplicito) {
    const modo = modoExplicito || win.modoAppActual || 'epi';
    const storageKey = obtenerClaveStorage(modo);

    const data = {};
    doc.querySelectorAll('.save-state').forEach(el => {
      const esCampoSppat = el.id?.startsWith('sppat_') || el.name?.startsWith('sppat_') || Boolean(el.closest('#contenedorSppat'));
      const esCampoEpicrisis = el.id?.startsWith('epicrisis_') || el.name?.startsWith('epicrisis_') || Boolean(el.closest('#contenedorEpicrisis'));
      const esCampoExclusivoEpi = el.classList.contains('ocultar-en-sppat') || Boolean(el.closest('.ocultar-en-sppat')) || Boolean(el.closest('#contenedorEpiTb'));

      if (modo === 'sppat' && (esCampoExclusivoEpi || esCampoEpicrisis)) return;
      if (modo === 'epicrisis' && (esCampoExclusivoEpi || esCampoSppat)) return;
      if (modo === 'epi' && (esCampoSppat || esCampoEpicrisis)) return;

      if (el.type === 'checkbox') {
        data[el.id] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else if (el.id) {
        data[el.id] = el.value;
      }
    });

    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  function loadFormData(modoExplicito = null, desdeCambioModo = false) {
    const modo = modoExplicito || win.modoAppActual || localStorage.getItem('modoAppActual') || 'epi';
    const storageKey = obtenerClaveStorage(modo);
    const savedData = localStorage.getItem(storageKey);

    resetearCamposBaseEnDOM(modo);

    if (!savedData) return;

    try {
      const data = JSON.parse(savedData);
      doc.querySelectorAll('.save-state').forEach(el => {
        const esCampoSppat = el.id?.startsWith('sppat_') || el.name?.startsWith('sppat_') || Boolean(el.closest('#contenedorSppat'));
        const esCampoEpicrisis = el.id?.startsWith('epicrisis_') || el.name?.startsWith('epicrisis_') || Boolean(el.closest('#contenedorEpicrisis'));
        const esCampoExclusivoEpi = el.classList.contains('ocultar-en-sppat') || Boolean(el.closest('.ocultar-en-sppat')) || Boolean(el.closest('#contenedorEpiTb'));

        if (modo === 'sppat' && (esCampoExclusivoEpi || esCampoEpicrisis)) return;
        if (modo === 'epicrisis' && (esCampoExclusivoEpi || esCampoSppat)) return;
        if (modo === 'epi' && (esCampoSppat || esCampoEpicrisis)) return;

        if (el.type === 'checkbox') {
          if (data[el.id] !== undefined) el.checked = data[el.id];
        } else if (el.type === 'radio') {
          if (data[el.name] !== undefined) el.checked = (data[el.name] === el.value);
        } else if (el.id && data[el.id] !== undefined) {
          el.value = data[el.id];
        }
      });
    } catch (e) {}
  }

  function cambiarModoApp(modo, esCargaInicial = false) {
    const modoAnterior = win.modoAppActual;
    if (!esCargaInicial && modoAnterior !== modo) {
      saveFormData(modoAnterior);
    }
    win.modoAppActual = modo;
    doc.body.setAttribute('data-modo', modo);
    try { localStorage.setItem('modoAppActual', modo); } catch (e) {}
    if (!esCargaInicial && modoAnterior !== modo) {
      loadFormData(modo, true);
    }
  }

  function limpiarFormulario() {
    const modo = win.modoAppActual || 'epi';
    localStorage.removeItem(obtenerClaveStorage(modo));
    resetearCamposBaseEnDOM(modo);
  }

  return {
    obtenerClaveStorage,
    resetearCamposBaseEnDOM,
    saveFormData,
    loadFormData,
    cambiarModoApp,
    limpiarFormulario
  };
}

function runR3Tests() {
  const suiteResults = [];

  function test(name, fn) {
    try {
      fn();
      suiteResults.push({ name, passed: true });
    } catch (err) {
      suiteResults.push({ name, passed: false, error: err.message });
    }
  }

  // --- TIER 1: Feature Coverage (>= 5 tests) ---

  test('R3-T1-1: Switching from EPI to Epicrisis without prior saved data initializes all patient fields blank/zero', () => {
    const env = createSimulatedEnvironment();
    const storageMod = createStorageModule(env);

    // 1. User enters patient data in EPI
    env.win.modoAppActual = 'epi';
    env.doc.getElementById('cedula').value = '1309876543';
    env.doc.getElementById('primer_apellido').value = 'MENDOZA';
    env.doc.getElementById('segundo_apellido').value = 'ALCIVAR';
    env.doc.getElementById('primer_nombre').value = 'CARLOS';
    env.doc.getElementById('segundo_nombre').value = 'ALBERTO';
    env.doc.getElementById('fecha_nacimiento').value = '1985-04-12';
    env.doc.getElementById('telefono').value = '0981122334';
    env.doc.getElementById('historia_clinica').value = 'HCU-12345';
    env.doc.getElementById('direccion').value = 'Av. 4 de Noviembre y Calle 115';

    // 2. Switch to Epicrisis without prior saved epicrisis data
    storageMod.cambiarModoApp('epicrisis');

    // 3. Confirm all patient demographic fields in Epicrisis are now blank/empty
    const checkFields = [
      'cedula', 'primer_apellido', 'segundo_apellido', 'primer_nombre',
      'segundo_nombre', 'fecha_nacimiento', 'telefono', 'historia_clinica', 'direccion'
    ];
    checkFields.forEach(fId => {
      const val = env.doc.getElementById(fId).value;
      assert.strictEqual(
        val,
        '',
        `Patient field #${fId} must be blank when switching to Epicrisis without saved data, got "${val}"`
      );
    });
  });

  test('R3-T1-2: Switching from SPPAT to Epicrisis without prior saved data initializes patient fields blank/zero', () => {
    const env = createSimulatedEnvironment();
    const storageMod = createStorageModule(env);

    // 1. User fills SPPAT form
    env.win.modoAppActual = 'sppat';
    env.doc.getElementById('cedula').value = '0922334455';
    env.doc.getElementById('primer_apellido').value = 'ZAMBRANO';
    env.doc.getElementById('primer_nombre').value = 'PATRICIA';
    env.doc.getElementById('telefono').value = '0995544332';
    storageMod.saveFormData('sppat');

    // 2. Switch to Epicrisis
    storageMod.cambiarModoApp('epicrisis');

    // 3. Confirm demographic fields are blank
    assert.strictEqual(env.doc.getElementById('cedula').value, '');
    assert.strictEqual(env.doc.getElementById('primer_apellido').value, '');
    assert.strictEqual(env.doc.getElementById('primer_nombre').value, '');
    assert.strictEqual(env.doc.getElementById('telefono').value, '');
  });

  test('R3-T1-3: Returning to Epicrisis when Epicrisis data has been saved reloads the saved Epicrisis data', () => {
    const env = createSimulatedEnvironment();
    const storageMod = createStorageModule(env);

    // 1. Save Epicrisis data directly
    const epicrisisSaved = {
      cedula: '1312345678',
      primer_apellido: 'BRIONES',
      segundo_apellido: 'CEVALLOS',
      primer_nombre: 'ANA',
      segundo_nombre: 'LUCIA',
      epicrisis_diag_principal: 'Apendicitis aguda no especificada',
      epicrisis_cie_principal: 'K35.8',
      epicrisis_diag_sec_1: 'COVID-19, virus identificado',
      epicrisis_cie_sec_1: 'U07.1',
      epicrisis_diag_sec_4: 'Hipertension esencial',
      epicrisis_cie_sec_4: 'I10',
      epicrisis_diag_sec_5: 'Diabetes mellitus tipo 2',
      epicrisis_cie_sec_5: 'E11.9'
    };
    env.localStorage.setItem('epicrisisFormData', JSON.stringify(epicrisisSaved));

    // 2. Switch to Epicrisis
    storageMod.cambiarModoApp('epicrisis');

    // 3. Confirm fields were restored
    assert.strictEqual(env.doc.getElementById('cedula').value, '1312345678');
    assert.strictEqual(env.doc.getElementById('primer_apellido').value, 'BRIONES');
    assert.strictEqual(env.doc.getElementById('primer_nombre').value, 'ANA');
    assert.strictEqual(env.doc.getElementById('epicrisis_diag_principal').value, 'Apendicitis aguda no especificada');
    assert.strictEqual(env.doc.getElementById('epicrisis_cie_principal').value, 'K35.8');
    assert.strictEqual(env.doc.getElementById('epicrisis_diag_sec_4').value, 'Hipertension esencial');
    assert.strictEqual(env.doc.getElementById('epicrisis_cie_sec_4').value, 'I10');
  });

  test('R3-T1-4: Independent storage keys (epiFormData, sppatFormData, epicrisisFormData) without cross-contamination', () => {
    const env = createSimulatedEnvironment();
    const storageMod = createStorageModule(env);

    assert.strictEqual(storageMod.obtenerClaveStorage('epi'), 'epiFormData');
    assert.strictEqual(storageMod.obtenerClaveStorage('sppat'), 'sppatFormData');
    assert.strictEqual(storageMod.obtenerClaveStorage('epicrisis'), 'epicrisisFormData');

    // Enter data in EPI
    storageMod.cambiarModoApp('epi');
    env.doc.getElementById('cedula').value = '1111111111';
    storageMod.saveFormData('epi');

    // Enter data in SPPAT
    storageMod.cambiarModoApp('sppat');
    env.doc.getElementById('cedula').value = '2222222222';
    storageMod.saveFormData('sppat');

    // Enter data in Epicrisis
    storageMod.cambiarModoApp('epicrisis');
    env.doc.getElementById('cedula').value = '3333333333';
    storageMod.saveFormData('epicrisis');

    const epiData = JSON.parse(env.localStorage.getItem('epiFormData'));
    const sppatData = JSON.parse(env.localStorage.getItem('sppatFormData'));
    const epicrisisData = JSON.parse(env.localStorage.getItem('epicrisisFormData'));

    assert.strictEqual(epiData.cedula, '1111111111');
    assert.strictEqual(sppatData.cedula, '2222222222');
    assert.strictEqual(epicrisisData.cedula, '3333333333');
  });

  test('R3-T1-5: js/epicrisis.js does not fall back to sppat_unicodigo when epicrisis_unicodigo is empty', () => {
    const epicrisisJs = fs.readFileSync(EPICRISIS_JS_PATH, 'utf8');

    // Check that getVal('sppat_unicodigo') is NOT used in recopilarDatosEpicrisis
    const hasSppatFallback = /unicodigo\s*=\s*[^;]*sppat_unicodigo/i.test(epicrisisJs);
    assert(
      !hasSppatFallback,
      'js/epicrisis.js must NOT fall back to sppat_unicodigo when epicrisis_unicodigo is empty'
    );
  });

  test('R3-T1-6: Form cleaning in Epicrisis mode removes only epicrisisFormData, preserving other form states', () => {
    const env = createSimulatedEnvironment();
    const storageMod = createStorageModule(env);

    env.localStorage.setItem('epiFormData', JSON.stringify({ cedula: '1111111111' }));
    env.localStorage.setItem('sppatFormData', JSON.stringify({ cedula: '2222222222' }));
    env.localStorage.setItem('epicrisisFormData', JSON.stringify({ cedula: '3333333333' }));

    env.win.modoAppActual = 'epicrisis';
    storageMod.limpiarFormulario();

    assert.strictEqual(
      env.localStorage.getItem('epicrisisFormData'),
      null,
      'epicrisisFormData must be removed after cleaning form in Epicrisis mode'
    );
    assert(
      env.localStorage.getItem('epiFormData') !== null,
      'epiFormData must be preserved when clearing Epicrisis form'
    );
    assert(
      env.localStorage.getItem('sppatFormData') !== null,
      'sppatFormData must be preserved when clearing Epicrisis form'
    );
  });

  // --- TIER 2: Boundary & Corner Cases (>= 5 tests) ---

  test('R3-T2-1: Rapid repeated mode switching (epi -> epicrisis -> sppat -> epicrisis) preserves integrity', () => {
    const env = createSimulatedEnvironment();
    const storageMod = createStorageModule(env);

    // Setup initial saved data for all 3 modes
    env.localStorage.setItem('epiFormData', JSON.stringify({ primer_apellido: 'EPI_PATIENT' }));
    env.localStorage.setItem('sppatFormData', JSON.stringify({ primer_apellido: 'SPPAT_PATIENT' }));
    env.localStorage.setItem('epicrisisFormData', JSON.stringify({ primer_apellido: 'EPICRISIS_PATIENT' }));

    // Start in EPI and load its data
    storageMod.loadFormData('epi');
    assert.strictEqual(env.doc.getElementById('primer_apellido').value, 'EPI_PATIENT');

    // Rapid mode switches
    const sequence = ['epicrisis', 'sppat', 'epicrisis', 'epi', 'sppat', 'epicrisis'];
    sequence.forEach(targetMode => {
      storageMod.cambiarModoApp(targetMode);
      const expectedApe = targetMode === 'epi' ? 'EPI_PATIENT' : (targetMode === 'sppat' ? 'SPPAT_PATIENT' : 'EPICRISIS_PATIENT');
      assert.strictEqual(
        env.doc.getElementById('primer_apellido').value,
        expectedApe,
        `Field corrupted during rapid switch to ${targetMode}`
      );
    });
  });

  test('R3-T2-2: Special characters and Spanish accents in patient demographics persist and restore cleanly', () => {
    const env = createSimulatedEnvironment();
    const storageMod = createStorageModule(env);

    const specialPatient = {
      cedula: '1301234567',
      primer_apellido: "O'CONNOR",
      segundo_apellido: 'PEÑA-ÑIQUE',
      primer_nombre: 'JOSÉ-MARÍA',
      segundo_nombre: 'ÁNGEL',
      direccion: 'Km 5 1/2 Vía "El Paraíso" & Calle #10'
    };

    env.localStorage.setItem('epicrisisFormData', JSON.stringify(specialPatient));
    storageMod.cambiarModoApp('epicrisis');

    assert.strictEqual(env.doc.getElementById('primer_apellido').value, "O'CONNOR");
    assert.strictEqual(env.doc.getElementById('segundo_apellido').value, "PEÑA-ÑIQUE");
    assert.strictEqual(env.doc.getElementById('primer_nombre').value, "JOSÉ-MARÍA");
    assert.strictEqual(env.doc.getElementById('segundo_nombre').value, "ÁNGEL");
    assert.strictEqual(env.doc.getElementById('direccion').value, 'Km 5 1/2 Vía "El Paraíso" & Calle #10');
  });

  test('R3-T2-3: Partial saved state does not crash or corrupt missing fields', () => {
    const env = createSimulatedEnvironment();
    const storageMod = createStorageModule(env);

    // Saved state with only a single field
    env.localStorage.setItem('epicrisisFormData', JSON.stringify({ primer_apellido: 'SOLO_APELLIDO' }));
    storageMod.cambiarModoApp('epicrisis');

    assert.strictEqual(env.doc.getElementById('primer_apellido').value, 'SOLO_APELLIDO');
    assert.strictEqual(env.doc.getElementById('primer_nombre').value, '');
    assert.strictEqual(env.doc.getElementById('cedula').value, '');
    assert.strictEqual(env.doc.getElementById('historia_clinica').value, '');
  });

  test('R3-T2-4: Null safety during DOM reset when elements are not in DOM', () => {
    const emptyDocEnv = {
      doc: {
        getElementById: () => null,
        querySelectorAll: () => [],
        body: new MockElement('body')
      },
      localStorage: new (require('./helpers/dom_env.js').MockLocalStorage)(),
      win: { modoAppActual: 'epicrisis' }
    };
    const storageMod = createStorageModule(emptyDocEnv);

    // Calling reset on empty DOM should not throw
    assert.doesNotThrow(() => {
      storageMod.resetearCamposBaseEnDOM('epicrisis');
    });
  });

  test('R3-T2-5: CSS rule ensures EPI-only fields (.ocultar-en-sppat) are hidden when data-modo is epicrisis', () => {
    const css = fs.readFileSync(STYLES_CSS_PATH, 'utf8');

    // Rule should hide .ocultar-en-sppat or dedicated class when data-modo="epicrisis"
    const hasEpicrisisHideRule =
      /body\[data-modo="epicrisis"\]\s+\.ocultar-en-sppat/i.test(css) ||
      /body\[data-modo="epicrisis"\]\s+\.ocultar-en-epicrisis/i.test(css) ||
      /\[data-modo="epicrisis"\][^{]*\.ocultar-en-sppat/i.test(css);

    assert(
      hasEpicrisisHideRule,
      'styles.css must include a rule hiding .ocultar-en-sppat in Epicrisis mode (body[data-modo="epicrisis"] .ocultar-en-sppat { display: none !important; })'
    );
  });

  return suiteResults;
}

module.exports = { runR3Tests };

if (require.main === module) {
  const results = runR3Tests();
  let passed = 0;
  let failed = 0;
  console.log('--- R3 Test Suite Results ---');
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

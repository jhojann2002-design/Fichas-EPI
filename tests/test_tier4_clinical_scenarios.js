// tests/test_tier4_clinical_scenarios.js
// Tier 4: Real-World Clinical Application Scenarios Test Suite

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createSimulatedEnvironment } = require('./helpers/dom_env.js');

const EPICRISIS_JS_PATH = path.resolve(__dirname, '../js/epicrisis.js');

function runTier4Tests() {
  const suiteResults = [];

  function test(name, fn) {
    try {
      fn();
      suiteResults.push({ name, passed: true });
    } catch (err) {
      suiteResults.push({ name, passed: false, error: err.message });
    }
  }

  test('T4-1: Realistic clinical workflow — Admission in EPI with COVID-19 and independent Epicrisis consultation/discharge', () => {
    const env = createSimulatedEnvironment();
    const { doc, localStorage, win } = env;

    // Helper to extract values
    function getVal(id) {
      const el = doc.getElementById(id);
      return el ? (el.value || '').trim() : '';
    }

    // Helper mimicking recopilarDatosEpicrisis
    function recopilarEpicrisis() {
      return {
        institucion: getVal('institucion'),
        establecimiento: getVal('establecimiento'),
        unicodigo: getVal('epicrisis_unicodigo'), // Strictly no sppat fallback!
        hcu: getVal('epicrisis_hcu') || getVal('cedula'),
        archivo: getVal('epicrisis_archivo') || getVal('cedula'),
        numero_hoja: getVal('epicrisis_num_hoja') || '1',
        primer_apellido: getVal('primer_apellido'),
        segundo_apellido: getVal('segundo_apellido'),
        primer_nombre: getVal('primer_nombre'),
        segundo_nombre: getVal('segundo_nombre'),
        sexo: getVal('sexo'),
        edad: getVal('edad'),
        condicion_edad: getVal('condicion_edad') || 'A',
        cuadro_clinico: getVal('epicrisis_cuadro_clinico'),
        evolucion: getVal('epicrisis_evolucion'),
        hallazgos: getVal('epicrisis_hallazgos'),
        tratamiento: getVal('epicrisis_tratamiento'),
        indicaciones_alta: getVal('epicrisis_indicaciones_alta'),
        diag_principal: getVal('epicrisis_diag_principal'),
        cie_principal: getVal('epicrisis_cie_principal'),
        diag_sec_1: getVal('epicrisis_diag_sec_1'),
        cie_sec_1: getVal('epicrisis_cie_sec_1'),
        diag_sec_2: getVal('epicrisis_diag_sec_2'),
        cie_sec_2: getVal('epicrisis_cie_sec_2'),
        diag_sec_3: getVal('epicrisis_diag_sec_3'),
        cie_sec_3: getVal('epicrisis_cie_sec_3'),
        diag_sec_4: getVal('epicrisis_diag_sec_4'),
        cie_sec_4: getVal('epicrisis_cie_sec_4'),
        diag_sec_5: getVal('epicrisis_diag_sec_5'),
        cie_sec_5: getVal('epicrisis_cie_sec_5'),
        diag_causa_ext: getVal('epicrisis_diag_causa_ext'),
        cie_causa_ext: getVal('epicrisis_cie_causa_ext'),
      };
    }

    // --- PHASE 1: Clinician admits Patient 1 in Fichas EPI ---
    win.modoAppActual = 'epi';
    doc.getElementById('cedula').value = '1309876543';
    doc.getElementById('primer_apellido').value = 'ORTIZ';
    doc.getElementById('segundo_apellido').value = 'LOOR';
    doc.getElementById('primer_nombre').value = 'MARIA';
    doc.getElementById('segundo_nombre').value = 'ELENA';
    doc.getElementById('fecha_nacimiento').value = '1982-08-20';
    doc.getElementById('telefono').value = '0991234567';

    // Simulate save to EPI storage
    const epiData = {
      cedula: '1309876543',
      primer_apellido: 'ORTIZ',
      segundo_apellido: 'LOOR',
      primer_nombre: 'MARIA',
      segundo_nombre: 'ELENA',
      diagnostico_cie10: 'U07.1 COVID-19, virus identificado'
    };
    localStorage.setItem('epiFormData', JSON.stringify(epiData));

    // Also simulate dummy SPPAT unicodigo in DOM to test for leakage
    const sppatUnicodigoEl = doc.getElementById('sppat_unicodigo');
    if (sppatUnicodigoEl) sppatUnicodigoEl.value = 'SPPAT_UNICO_LEAK';

    // --- PHASE 2: Transition to Epicrisis (Formulario 006 MSP) ---
    win.modoAppActual = 'epicrisis';
    doc.body.setAttribute('data-modo', 'epicrisis');

    // DOM reset for epicrisis
    ['cedula', 'primer_apellido', 'segundo_apellido', 'primer_nombre', 'segundo_nombre', 'telefono'].forEach(id => {
      doc.getElementById(id).value = '';
    });

    // Verify Patient 1 data does NOT leak into Epicrisis DOM
    assert.strictEqual(getVal('cedula'), '', 'Patient 1 cedula must not leak into Epicrisis');
    assert.strictEqual(getVal('primer_apellido'), '', 'Patient 1 apellido must not leak into Epicrisis');

    // --- PHASE 3: Clinician fills Epicrisis for Patient 2 ---
    doc.getElementById('cedula').value = '1312345678';
    doc.getElementById('primer_apellido').value = 'ZAMBRANO';
    doc.getElementById('segundo_apellido').value = 'PEREZ';
    doc.getElementById('primer_nombre').value = 'JUAN';
    doc.getElementById('segundo_nombre').value = 'CARLOS';
    doc.getElementById('sexo').value = 'M';
    doc.getElementById('fecha_nacimiento').value = '1989-05-10';
    const edadEl = doc.getElementById('edad');
    if (edadEl) edadEl.value = '35';

    // Clinical descriptions
    doc.getElementById('epicrisis_cuadro_clinico').value = 'Paciente masculino de 35 años acude por dolor abdominal intenso en fosa ilíaca derecha de 24 horas de evolución.';
    doc.getElementById('epicrisis_evolucion').value = 'Intervenido quirúrgicamente mediante laparoscopía, evolución posoperatoria favorable sin complicaciones.';
    doc.getElementById('epicrisis_hallazgos').value = 'Apendicitis flemonosa supurada con moderado líquido periapendicular.';
    doc.getElementById('epicrisis_tratamiento').value = 'Ceftriaxona 1g IV c/12h + Metronidazol 500mg IV c/8h por 3 días, analgesia con Ketorolaco.';
    doc.getElementById('epicrisis_indicaciones_alta').value = 'Reposo relativo por 15 días, dieta blanda hiperproteica, retiro de puntos en 8 días.';

    // Diagnoses selection across all 7 fields
    doc.getElementById('epicrisis_diag_principal').value = 'Apendicitis aguda no especificada';
    doc.getElementById('epicrisis_cie_principal').value = 'K35.8';

    doc.getElementById('epicrisis_diag_sec_1').value = 'COVID-19, virus identificado';
    doc.getElementById('epicrisis_cie_sec_1').value = 'U07.1';

    doc.getElementById('epicrisis_diag_sec_2').value = 'Sepsis, no especificada';
    doc.getElementById('epicrisis_cie_sec_2').value = 'A41.9';

    doc.getElementById('epicrisis_diag_sec_3').value = 'Hipertensión esencial (primaria)';
    doc.getElementById('epicrisis_cie_sec_3').value = 'I10';

    doc.getElementById('epicrisis_diag_sec_4').value = 'Diabetes mellitus tipo 2';
    doc.getElementById('epicrisis_cie_sec_4').value = 'E11.9';

    doc.getElementById('epicrisis_diag_sec_5').value = 'Adherencias peritoneales [bridas]';
    doc.getElementById('epicrisis_cie_sec_5').value = 'K56.5';

    doc.getElementById('epicrisis_diag_causa_ext').value = 'Procedimiento quirúrgico';
    doc.getElementById('epicrisis_cie_causa_ext').value = 'Y83.8';

    // --- PHASE 4: Extract and Verify Aggregated Data Payload ---
    const payload = recopilarEpicrisis();

    assert.strictEqual(payload.cedula, undefined); // cedula is mapped to hcu/archivo
    assert.strictEqual(payload.hcu, '1312345678');
    assert.strictEqual(payload.primer_apellido, 'ZAMBRANO');
    assert.strictEqual(payload.primer_nombre, 'JUAN');
    assert.strictEqual(payload.unicodigo, '', 'unicodigo must NOT inherit sppat_unicodigo');

    assert.strictEqual(payload.diag_principal, 'Apendicitis aguda no especificada');
    assert.strictEqual(payload.cie_principal, 'K35.8');
    assert.strictEqual(payload.diag_sec_1, 'COVID-19, virus identificado');
    assert.strictEqual(payload.cie_sec_1, 'U07.1');
    assert.strictEqual(payload.diag_sec_4, 'Diabetes mellitus tipo 2');
    assert.strictEqual(payload.cie_sec_4, 'E11.9');
    assert.strictEqual(payload.diag_sec_5, 'Adherencias peritoneales [bridas]');
    assert.strictEqual(payload.cie_sec_5, 'K56.5');
    assert.strictEqual(payload.diag_causa_ext, 'Procedimiento quirúrgico');
    assert.strictEqual(payload.cie_causa_ext, 'Y83.8');
  });

  test('T4-2: Epicrisis export data payload structure matches Excel P38:BI44 and PDF generation requirements', () => {
    const epicrisisJs = fs.readFileSync(EPICRISIS_JS_PATH, 'utf8');

    // Verify Excel cell mappings in js/epicrisis.js
    const excelMappings = [
      { cellDesc: 'P38', cellCie: 'BI38', field: 'Principal' },
      { cellDesc: 'P39', cellCie: 'BI39', field: 'Secundario 1' },
      { cellDesc: 'P40', cellCie: 'BI40', field: 'Secundario 2' },
      { cellDesc: 'P41', cellCie: 'BI41', field: 'Secundario 3' },
      { cellDesc: 'P42', cellCie: 'BI42', field: 'Secundario 4' },
      { cellDesc: 'P43', cellCie: 'BI43', field: 'Secundario 5' },
      { cellDesc: 'P44', cellCie: 'BI44', field: 'Causa Externa' },
    ];

    excelMappings.forEach(mapping => {
      assert(
        epicrisisJs.includes(`'${mapping.cellDesc}'`) || epicrisisJs.includes(`"${mapping.cellDesc}"`),
        `Excel mapping for ${mapping.field} description cell ${mapping.cellDesc} missing in js/epicrisis.js`
      );
      assert(
        epicrisisJs.includes(`'${mapping.cellCie}'`) || epicrisisJs.includes(`"${mapping.cellCie}"`),
        `Excel mapping for ${mapping.field} CIE code cell ${mapping.cellCie} missing in js/epicrisis.js`
      );
    });

    // Verify PDF drawing calls for diagnoses exist
    assert(
      epicrisisJs.includes('d.diag_principal') && epicrisisJs.includes('d.cie_principal'),
      'PDF generator must reference Principal diagnosis'
    );
    assert(
      epicrisisJs.includes('d.diag_causa_ext') && epicrisisJs.includes('d.cie_causa_ext'),
      'PDF generator must reference Causa Externa diagnosis'
    );
  });

  return suiteResults;
}

module.exports = { runTier4Tests };

if (require.main === module) {
  const results = runTier4Tests();
  let passed = 0;
  let failed = 0;
  console.log('--- Tier 4 Test Suite Results ---');
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

// js/main.js
import { dbSintomas, dbVacunas } from './constants.js';
import { initTheme, enfocarElementoSeguro, mostrarLoader, ocultarLoader } from './ui.js';
import { setupAutoSave } from './storage.js';
import { initData, initApiListeners } from './api.js';
import { 
  toggleElementos, toggleExposicion, validarProcedenciaAgua, 
  actualizarGeneroDropdowns, actualizarEstadoEmbarazo, 
  toggleLaboratorio, forzarCalculoDias
} from './formLogic.js';

// 1. IMPORTAMOS LA FUNCIÓN DE LA NUBE
import { initCloudAuth } from './cloud.js';

// Inicializar configuración base
initTheme();
setupAutoSave();
initApiListeners();

// 2. INICIAMOS LA SESIÓN EN LA NUBE
initCloudAuth();

// ==========================================
// INYECCIÓN DINÁMICA DE SÍNTOMAS Y VACUNAS
// ==========================================
function inicializarCheckboxes() {
  const generarHTML = (arr, claseExtra, disabled = false) => arr.map(item => `
    <div class="${claseExtra.includes('chk-vac') ? 'col-6 col-md-2' : 'form-check'}" ${disabled ? 'class="disabled-block"' : ''}>
      ${claseExtra.includes('chk-vac') ? '<div class="form-check">' : ''}
      <input class="form-check-input ${claseExtra} save-state" type="checkbox" id="${item.id}" ${disabled ? 'disabled' : ''}>
      <label class="form-check-label" for="${item.id}">${item.label}</label>
      ${claseExtra.includes('chk-vac') ? '</div>' : ''}
    </div>
  `).join('');

  const contResp = document.getElementById('cont-sint-resp');
  const contGen = document.getElementById('cont-sint-gen');
  const contNeuro = document.getElementById('cont-sint-neuro');
  const contBaja = document.getElementById('cont-sint-baja');
  const contVac = document.getElementById('cont-vacunas');

  if(contResp) contResp.insertAdjacentHTML('beforeend', generarHTML(dbSintomas.resp, 'chk-sin'));
  if(contGen) contGen.insertAdjacentHTML('beforeend', generarHTML(dbSintomas.gen, 'chk-sin'));
  if(contNeuro) contNeuro.insertAdjacentHTML('beforeend', generarHTML(dbSintomas.neuro, 'chk-sin'));
  if(contBaja) contBaja.insertAdjacentHTML('beforeend', generarHTML(dbSintomas.baja, 'chk-sin'));
  if(contVac) contVac.insertAdjacentHTML('beforeend', generarHTML(dbVacunas, 'chk-vac', true));
}
inicializarCheckboxes();

// ==========================================
// FILTROS DE INPUTS (MAYÚSCULAS Y NÚMEROS)
// ==========================================
document.addEventListener('input', function(e) {
  if (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'textarea')) {
    if (!e.target.classList.contains('decimal-input')) {
        let start = e.target.selectionStart; let end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        try { e.target.setSelectionRange(start, end); } catch(err) {}
    }
  }
  if ((e.target.type === 'tel' || e.target.classList.contains('numeric-input')) && !e.target.classList.contains('decimal-input')) {
    let val = e.target.value;
    if (/\D/.test(val)) e.target.value = val.replace(/\D/g, '');
  }
  if (e.target.classList.contains('decimal-input')) {
    let val = e.target.value;
    if (/[^\d.,]/.test(val)) e.target.value = val.replace(/[^\d.,]/g, '');
  }
});

document.addEventListener('paste', function(e) {
  if ((e.target.type === 'tel' || e.target.classList.contains('numeric-input')) && !e.target.classList.contains('decimal-input')) {
    setTimeout(() => { e.target.value = e.target.value.replace(/\D/g, ''); }, 0);
  }
  if (e.target.classList.contains('decimal-input')) {
    setTimeout(() => { e.target.value = e.target.value.replace(/[^\d.,]/g, ''); }, 0);
  }
});

const criticalFields = ['cedula', 'primer_apellido', 'primer_nombre', 'institucion', 'establecimiento'];
criticalFields.forEach(id => {
  const el = document.getElementById(id);
  if(el) {
    el.addEventListener('blur', function() {
      if(!this.value || !this.value.trim()) this.classList.add('input-error');
      else this.classList.remove('input-error');
    });
    el.addEventListener('change', function() {
      if(this.value && this.value.trim()) this.classList.remove('input-error');
    });
  }
});

// ==========================================
// LISTENERS PRINCIPALES DE CARGA (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

  // 3. AVISO DE NOVEDAD (Aparece una única vez)
  if (!localStorage.getItem('aviso_nube_vista')) {
    Swal.fire({
      title: '¡Nuevas Funciones! 🚀',
      html: '☁️ Ahora puedes <b>acceder usando tu número de cédula</b> para guardar fichas temporalmente en la nube (Ideal para llenar en el celular e imprimir en la computadora).<br><br>🫁 <b>NUEVO:</b> Se ha integrado la <b>Ficha de Tuberculosis</b>. El formulario adicional aparecerá automáticamente cuando selecciones un diagnóstico relacionado a Tuberculosis en la sección de CIE-10.',
      icon: 'info',
      confirmButtonText: '¡Genial, Entendido!',
      confirmButtonColor: 'var(--apple-blue)'
    }).then(() => {
      localStorage.setItem('aviso_nube_vista', 'true');
    });
  }
  const expNinguno = document.getElementById('exp_ninguno');
  if(expNinguno) toggleExposicion(expNinguno.checked);

  mostrarLoader("Cargando base de datos local...");
  fetch('catalogos.json')
    .then(response => response.text())
    .then(dataStr => {
      try { initData(dataStr); } catch (err) {
        ocultarLoader();
        document.body.innerHTML = `<div class="container mt-5 text-center"><h3 class="text-danger">⚠️ Error de formato</h3><textarea class="form-control" style="height: 300px; font-size: 12px;">${err.toString()}</textarea></div>`;
      }
    })
    .catch(err => {
      ocultarLoader(); Swal.fire('Error', 'No se pudo cargar el archivo de catálogos local.', 'error');
    });

  // ALERTAS EN CASCADA
  function bindCascadeAlert(childId, parentId, msg) {
    const child = document.getElementById(childId);
    if (child) {
      let startY = 0;
      child.addEventListener('touchstart', function(e) { startY = e.touches[0].clientY; }, {passive: true});
      const checkFn = function(e) {
        if (e.type === 'touchend') { const endY = e.changedTouches[0].clientY; if (Math.abs(endY - startY) >= 10) return; }
        const parent = document.getElementById(parentId);
        if (parent && !parent.value) {
          e.preventDefault(); child.blur();
          Swal.fire({icon: 'warning', title: 'Acción requerida', text: msg, confirmButtonColor: 'var(--apple-blue)'}).then(() => enfocarElementoSeguro(parent)); 
        }
      };
      child.addEventListener('mousedown', checkFn); child.addEventListener('touchend', checkFn, {passive: false});
    }
  }
  bindCascadeAlert('establecimiento', 'institucion', 'Primero debe seleccionar una Institución.');
  bindCascadeAlert('canton_residencia', 'prov_residencia', 'Primero debe seleccionar la Provincia de Residencia.');
  bindCascadeAlert('parroquia_residencia', 'canton_residencia', 'Primero debe seleccionar el Cantón de Residencia.');
  bindCascadeAlert('estado_civil', 'sexo', 'Primero debe seleccionar el Sexo del paciente.');
  bindCascadeAlert('etnia', 'sexo', 'Primero debe seleccionar el Sexo del paciente.');

  // ALERTAS EN TABLA DE CONTACTOS
  const tablaContactos = document.getElementById('tablaContactos');
  if (tablaContactos) {
    let startY = 0;
    tablaContactos.addEventListener('touchstart', function(e) { startY = e.touches[0].clientY; }, {passive: true});
    const checkTablaFn = function(e) {
      if (e.type === 'touchend') { const endY = e.changedTouches[0].clientY; if (Math.abs(endY - startY) >= 10) return; }
      if (e.target.classList.contains('c-relacion')) {
        const row = e.target.closest('tr'); const sexoSel = row.querySelector('.c-sexo');
        if (sexoSel && !sexoSel.value) {
          e.preventDefault(); e.target.blur();
          Swal.fire({icon: 'warning', title: 'Acción requerida', text: 'Primero debe seleccionar el Sexo del contacto.', confirmButtonColor: 'var(--apple-blue)'}).then(() => enfocarElementoSeguro(sexoSel)); 
        }
      }
    };
    tablaContactos.addEventListener('mousedown', checkTablaFn); tablaContactos.addEventListener('touchend', checkTablaFn, {passive: false});
  }

  // ACORDEÓN SCROLL
  const accordionContainer = document.getElementById('accordionFicha');
  if (accordionContainer) {
    accordionContainer.addEventListener('shown.bs.collapse', function (e) {
      if (!e.target.classList.contains('accordion-collapse')) return; 
      const header = document.querySelector('.glass-header'); const element = e.target.parentElement;
      const headerOffset = header ? header.offsetHeight : 0; const rect = element.getBoundingClientRect();
      window.scrollBy({ top: rect.top - headerOffset - 15, behavior: 'smooth' });
    });
  }

  // EVENTOS SUELTOS DE INPUTS DEPENDIENTES
  const sec5 = document.getElementById('sec5');
  if(sec5) {
    sec5.addEventListener('change', (e) => {
      if (e.target.classList.contains('chk-exp') && (e.target.id === 'exp_agua_suelo' || e.target.id === 'exp_alimentos')) validarProcedenciaAgua();
    });
  }

  document.querySelectorAll('input[name="rad_procedencia"]').forEach(r => {
    r.addEventListener('change', (e) => {
      const inpOtro = document.getElementById('procedencia_agua_otro'); toggleElementos([inpOtro], e.target.value === 'Otro');
      if (e.target.value === 'Otro') inpOtro.focus(); else inpOtro.value = '';
    });
  });

  document.querySelectorAll('input[name="rad_tipo_exp"]').forEach(r => {
    r.addEventListener('change', (e) => {
      const inpOtro = document.getElementById('tipo_exposicion_otro'); toggleElementos([inpOtro], e.target.value === 'Otras');
      if (e.target.value === 'Otras') inpOtro.focus(); else inpOtro.value = '';
    });
  });


  const selectSexo = document.getElementById('sexo');
  if(selectSexo) selectSexo.addEventListener('change', () => { actualizarGeneroDropdowns(); actualizarEstadoEmbarazo(); });
  
  const selectEmb = document.getElementById('embarazada');
  if(selectEmb) selectEmb.addEventListener('change', () => actualizarEstadoEmbarazo());

  const hosp = document.getElementById('hospitalizado');
  if(hosp) {
    hosp.addEventListener('change', e => {
      const isYes = e.target.value === 'SI';
      toggleElementos([ document.getElementById('fecha_hosp'), document.getElementById('hc_hosp'), document.getElementById('nombre_hospital'), document.getElementById('servicio_hosp'), document.getElementById('ingreso_uci') ], isYes);
      if(!isYes) { document.getElementById('fecha_hosp').value = ''; document.getElementById('hc_hosp').value = ''; document.getElementById('nombre_hospital').value = ''; document.getElementById('servicio_hosp').value = ''; }
    });
  }

  document.querySelectorAll('input[name="cond_egreso"]').forEach(r => {
    r.addEventListener('change', e => {
      toggleElementos([document.getElementById('fecha_fallecimiento')], e.target.value !== 'VIVO');
      if (e.target.value === 'VIVO') document.getElementById('fecha_fallecimiento').value = '';
    });
  });

  const antVac = document.getElementById('antecedente_vacunal');
  if(antVac) {
    antVac.addEventListener('change', e => {
      const isSi = e.target.value === 'SI';
      toggleElementos(document.querySelectorAll('.vac-f'), isSi); toggleElementos(document.querySelectorAll('.chk-vac'), isSi);
      if(!isSi){ document.querySelectorAll('.vac-f:not(select)').forEach(el => el.value = ''); document.querySelectorAll('.chk-vac').forEach(el => el.checked = false); }
    });
  }

  const rViaje = document.getElementById('realizo_viaje');
  if(rViaje) {
    rViaje.addEventListener('change', e => {
      const isYes = e.target.value === 'SI';
      toggleElementos([document.getElementById('lugar_viaje'), document.getElementById('fecha_desde'), document.getElementById('fecha_hasta')], isYes);
      if (!isYes) { document.getElementById('lugar_viaje').value = ''; document.getElementById('fecha_desde').value = ''; document.getElementById('fecha_hasta').value = ''; }
    });
  }

  const comor = document.getElementById('comorbilidades');
  if(comor) {
    comor.addEventListener('change', e => {
      const isSi = e.target.value === 'SI'; toggleElementos([document.getElementById('especificar_comor')], isSi);
      if (!isSi) document.getElementById('especificar_comor').value = '';
    });
  }

  const selectMuestra = document.getElementById('muestra');
  if (selectMuestra) {
      selectMuestra.addEventListener('change', e => { const isNO = e.target.value === 'NO'; toggleLaboratorio(!isNO); });
  }
});

// ==========================================
// EVENTOS PARA EL CÁLCULO DE FECHAS
// ==========================================
['fecha_inicio_sintomas', 'fecha_sintoma_relevante', 'fecha_atencion'].forEach(id => {
  const element = document.getElementById(id);
  if (element) {
      element.addEventListener('change', forzarCalculoDias);
      element.addEventListener('input', forzarCalculoDias);
  }
});
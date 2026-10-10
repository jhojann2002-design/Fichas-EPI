// js/storage.js
import { agregarContacto, agregarContactoRestaurado } from './contacts.js';
import { 
  toggleElementos, setUnidadPredeterminada, fillCantones, fillParroquias, 
  actualizarGeneroDropdowns, actualizarEstadoEmbarazo, toggleTratamientoCampos, 
  toggleExposicion, validarProcedenciaAgua, toggleDondeEnfermos, 
  toggleLaboratorio, forzarCalculoDias,
  toggleFormularioTB, revisarCie10ParaTB, toggleServiciosTB, toggleCondicionesEspeciales, toggleCaracterizarSignos
} from './formLogic.js';

let saveTimeout;

export function saveFormData() {
  const data = {};
  document.querySelectorAll('.save-state').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked) {
        if (el.type === 'radio') data[el.name] = el.value;
        else data[el.id] = el.checked;
      }
    } else if (el.id) {
      data[el.id] = el.value;
    }
  });

  const contacts = [];
  document.querySelectorAll('#contactsBody tr').forEach(tr => {
    contacts.push({
      nombre: tr.querySelector('.c-nombre')?.value || '',
      edad: tr.querySelector('.c-edad')?.value || '',
      sexo: tr.querySelector('.c-sexo')?.value || '',
      relacion: tr.querySelector('.c-relacion')?.value || '',
      dir: tr.querySelector('.c-dir')?.value || '',
      lugar: tr.querySelector('.c-lugar')?.value || '',
      enfermo: tr.querySelector('.c-enfermo')?.value || '',
      fecha: tr.querySelector('.c-fecha')?.value || '',
      obs: tr.querySelector('.c-obs')?.value || ''
    });
  });
  data.contactos = contacts;
  localStorage.setItem('epiFormData', JSON.stringify(data));
}

export function loadFormData() {
  const savedData = localStorage.getItem('epiFormData');
  if (!savedData) {
    for (let i = 0; i < 1; i++) agregarContacto();
    setUnidadPredeterminada();
    document.getElementById('prov_residencia').value = "MANABI";
    fillCantones("MANABI");
    return;
  }
  try {
    const data = JSON.parse(savedData);
    document.querySelectorAll('.save-state').forEach(el => {
      if (el.type === 'checkbox') {
        if (data[el.id] !== undefined) el.checked = data[el.id];
      } else if (el.type === 'radio') {
        if (data[el.name] === el.value) el.checked = true;
      } else if (el.id && data[el.id] !== undefined && 
                 el.id !== 'canton_residencia' && el.id !== 'parroquia_residencia' &&
                 el.id !== 'institucion' && el.id !== 'establecimiento') { 
        el.value = data[el.id];
      }
    });

    if (data.institucion) {
      const instSelect = document.getElementById('institucion');
      instSelect.value = data.institucion;
      instSelect.dispatchEvent(new Event('change')); 
      if (data.establecimiento) {
        const estabSelect = document.getElementById('establecimiento');
        estabSelect.value = data.establecimiento;
        estabSelect.dispatchEvent(new Event('change'));
      }
    } else {
      setUnidadPredeterminada();
    }

    if (data.prov_residencia) {
      fillCantones(data.prov_residencia);
      if (data.canton_residencia) {
        document.getElementById('canton_residencia').value = data.canton_residencia;
        fillParroquias(data.prov_residencia, data.canton_residencia);
        if (data.parroquia_residencia) document.getElementById('parroquia_residencia').value = data.parroquia_residencia;
      }
    }

    if (data.sexo) {
      actualizarGeneroDropdowns();
      if (data.estado_civil) document.getElementById('estado_civil').value = data.estado_civil;
      if (data.etnia) document.getElementById('etnia').value = data.etnia;
    }

    actualizarEstadoEmbarazo();
    if (data.semanas_gestacion && document.getElementById('embarazada').value === 'SI') {
      document.getElementById('semanas_gestacion').value = data.semanas_gestacion;
    }

    toggleTratamientoCampos();
    toggleExposicion(document.getElementById('exp_ninguno').checked);
    validarProcedenciaAgua();
    toggleDondeEnfermos(document.getElementById('otros_enfermos').value);

    const isHospYes = document.getElementById('hospitalizado').value === 'SI';
    toggleElementos([
      document.getElementById('fecha_hosp'), document.getElementById('hc_hosp'),
      document.getElementById('nombre_hospital'), document.getElementById('servicio_hosp'),
      document.getElementById('ingreso_uci')
    ], isHospYes);

    const isVacSi = document.getElementById('antecedente_vacunal').value === 'SI';
    toggleElementos(document.querySelectorAll('.vac-f'), isVacSi);
    toggleElementos(document.querySelectorAll('.chk-vac'), isVacSi);

    const isViajeSi = document.getElementById('realizo_viaje').value === 'SI';
    toggleElementos([document.getElementById('lugar_viaje'), document.getElementById('fecha_desde'), document.getElementById('fecha_hasta')], isViajeSi);

    toggleElementos([document.getElementById('especificar_comor')], document.getElementById('comorbilidades').value === 'SI');
    
    if (data.muestra === 'NO') {
        toggleLaboratorio(false);
    } else {
        toggleLaboratorio(true);
    }

    // --- CORRECCIÓN: RE-EVALUAR ESTADOS AL CARGAR (SOLUCIONA INACTIVIDAD POST-ACTUALIZACIÓN) ---
    toggleCaracterizarSignos();
    toggleServiciosTB();
    
    const espChk = document.getElementById('tb_crit_especiales');
    if (espChk) toggleCondicionesEspeciales(espChk.checked);

    const condEgreso = document.querySelector('input[name="cond_egreso"]:checked')?.value;
    toggleElementos([document.getElementById('fecha_fallecimiento')], condEgreso === 'FALLECIDO');
          
    const tipoExp = document.querySelector('input[name="rad_tipo_exp"]:checked')?.value;
    toggleElementos([document.getElementById('tipo_exposicion_otro')], tipoExp === 'Otras');
    // ------------------------------------------------------------------------------------------

    const tbody = document.getElementById('contactsBody');
    tbody.innerHTML = '';
    if (data.contactos && data.contactos.length > 0) {
      data.contactos.forEach((c, index) => agregarContactoRestaurado(c, index === 0));
    } else {
      for (let i = 0; i < 1; i++) agregarContacto();
    }

    forzarCalculoDias();

    // Restaurar el bloque de TB sin hacer brincar la pantalla (skipScroll = true)
    const cieAct = document.getElementById('diagnostico_cie10').value;
    revisarCie10ParaTB(cieAct);
    toggleFormularioTB(true);

  } catch(e) {
    for (let i = 0; i < 1; i++) agregarContacto();
  }
}

export function limpiarFormulario() {
  Swal.fire({
    title: '¿Limpiar Ficha?', text: "Se borrarán todos los datos ingresados.", icon: 'warning', showCancelButton: true,
    confirmButtonColor: 'var(--apple-red)', cancelButtonColor: 'var(--apple-text-muted)', confirmButtonText: 'Sí, limpiar', cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem('epiFormData');
      document.getElementById('epiForm').reset();
      
      const provSelect = document.getElementById('prov_residencia');
      if (provSelect) {
        provSelect.value = "MANABI"; fillCantones("MANABI"); 
        const cantonSelect = document.getElementById('canton_residencia');
        cantonSelect.value = ""; cantonSelect.dispatchEvent(new Event('change')); 
      }
      
      document.getElementById('parroquia_residencia').innerHTML = '<option value="" selected disabled>Seleccione Parroquia...</option>';
      document.getElementById('estado_civil').innerHTML = '<option value="" selected disabled>Seleccione Sexo primero...</option>';
      document.getElementById('etnia').innerHTML = '<option value="" selected disabled>Seleccione Sexo primero...</option>';
      document.getElementById('establecimiento').innerHTML = '<option value="" selected disabled>Seleccione primero una Institución...</option>';
      
      const selectsParaActualizar = ['sexo', 'embarazada', 'recibio_tratamiento', 'hospitalizado', 'antecedente_vacunal', 'realizo_viaje', 'comorbilidades', 'otros_enfermos', 'aplica_caracterizar_signos'];
      selectsParaActualizar.forEach(id => { const el = document.getElementById(id); if (el) el.dispatchEvent(new Event('change')); });
      
      if (window.tomSelectCie10) window.tomSelectCie10.clear();
      document.getElementById('exp_ninguno').checked = true;
      toggleExposicion(true);
      
   // Ocultar sección TB y reiniciar estado
      const tbReq = document.getElementById('tb_requiere_ficha');
      if (tbReq) tbReq.value = 'NO';
      revisarCie10ParaTB('');
      if (window.toggleFormularioTB) window.toggleFormularioTB(true);
      
      document.getElementById('contactsBody').innerHTML = '';
      for (let i = 0; i < 1; i++) agregarContacto();
      
      setUnidadPredeterminada(); saveFormData();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

export function setupAutoSave() {
  const form = document.getElementById('epiForm');
  if (form) {
    form.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveFormData, 1000);
    });
    form.addEventListener('change', () => saveFormData());
  }
}

window.limpiarFormulario = limpiarFormulario;
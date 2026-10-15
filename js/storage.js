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
let isInitializing = true; // Bandera para evitar autoguardados durante la carga inicial

export function saveFormData() {
  if (isInitializing) return; // Evitar que el autoguardado borre datos mientras se carga la página

  const data = {};
  document.querySelectorAll('.save-state').forEach(el => {
  if (el.type === 'checkbox') {
    data[el.id] = el.checked; 
  } else if (el.type === 'radio') {
    if (el.checked) data[el.name] = el.value;
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
  isInitializing = true; // Bloqueamos el guardado
  
  const savedData = localStorage.getItem('epiFormData');
  if (!savedData) {
    for (let i = 0; i < 1; i++) agregarContacto();
    setUnidadPredeterminada();
    let provDef = "MANABI";
    const savedDefs = localStorage.getItem('epiUserDefaults');
    if (savedDefs) {
      try { provDef = JSON.parse(savedDefs).prov_residencia || "MANABI"; } catch(e) {}
    }
    const provEl = document.getElementById('prov_residencia');
    if (provEl) {
      provEl.value = provDef;
      fillCantones(provDef);
    }
    const fAte = document.getElementById('fecha_atencion');
    if (fAte && !fAte.value) {
      fAte.value = new Date().toISOString().slice(0, 10);
    }
    window.actualizarBadgeEdad?.();
    isInitializing = false;
    return;
  }
  
  try {
    const data = JSON.parse(savedData);
    document.querySelectorAll('.save-state').forEach(el => {
      if (el.type === 'checkbox') {
        el.checked = data[el.id] !== undefined ? data[el.id] : false;
      } else if (el.type === 'radio') {
        if (data[el.name] === el.value) el.checked = true;
      } else if (el.id && data[el.id] !== undefined && 
           el.id !== 'canton_residencia' && el.id !== 'parroquia_residencia' &&
           el.id !== 'institucion' && el.id !== 'establecimiento') { 
        el.value = data[el.id];
        if (el.id === 'diagnostico_cie10' && window.tomSelectCie10) {
          window.tomSelectCie10.setValue(data[el.id], true);
        }
      }
    });

    if (data.diagnostico_cie10 && window.tomSelectCie10) {
      window.tomSelectCie10.setValue(data.diagnostico_cie10, true);
    }

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

    toggleCaracterizarSignos();
    toggleServiciosTB();
    window.togglePcrLam1eraPrueba?.();
    
    const espChk = document.getElementById('tb_crit_especiales');
    if (espChk) toggleCondicionesEspeciales(espChk.checked);

    const condEgreso = document.querySelector('input[name="cond_egreso"]:checked')?.value;
    toggleElementos([document.getElementById('fecha_fallecimiento')], condEgreso === 'FALLECIDO');
          
    const tipoExp = document.querySelector('input[name="rad_tipo_exp"]:checked')?.value;
    toggleElementos([document.getElementById('tipo_exposicion_otro')], tipoExp === 'Otras');

    // === CARGA SEGURA DE CONTACTOS ===
    const tbody = document.getElementById('contactsBody');
    tbody.innerHTML = '';
    if (data.contactos && data.contactos.length > 0) {
      data.contactos.forEach((c, index) => agregarContactoRestaurado(c, index === 0));
    } else {
      for (let i = 0; i < 1; i++) agregarContacto();
    }

    forzarCalculoDias();

    const cieAct = document.getElementById('diagnostico_cie10').value;
    revisarCie10ParaTB(cieAct);
    toggleFormularioTB(true);
    window.actualizarBadgeEdad?.();

  } catch(e) {
    for (let i = 0; i < 1; i++) agregarContacto();
  } finally {
    // Restauramos el guardado después de un ligero delay
    setTimeout(() => { isInitializing = false; }, 500); 
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
      
      let provDef = "MANABI";
      const savedDefs = localStorage.getItem('epiUserDefaults');
      if (savedDefs) {
        try { provDef = JSON.parse(savedDefs).prov_residencia || "MANABI"; } catch(e) {}
      }
      const provSelect = document.getElementById('prov_residencia');
      if (provSelect) {
        provSelect.value = provDef; fillCantones(provDef); 
        const cantonSelect = document.getElementById('canton_residencia');
        cantonSelect.value = ""; cantonSelect.dispatchEvent(new Event('change')); 
      }
      
      const fAte = document.getElementById('fecha_atencion');
      if (fAte) fAte.value = new Date().toISOString().slice(0, 10);
      
      document.getElementById('parroquia_residencia').innerHTML = '<option value="" selected disabled>Seleccione Parroquia...</option>';
      document.getElementById('estado_civil').innerHTML = '<option value="" selected disabled>Seleccione Sexo primero...</option>';
      document.getElementById('etnia').innerHTML = '<option value="" selected disabled>Seleccione Sexo primero...</option>';
      document.getElementById('establecimiento').innerHTML = '<option value="" selected disabled>Seleccione primero una Institución...</option>';
      
      const selectsParaActualizar = ['sexo', 'embarazada', 'recibio_tratamiento', 'hospitalizado', 'antecedente_vacunal', 'realizo_viaje', 'comorbilidades', 'otros_enfermos', 'aplica_caracterizar_signos', 'muestra'];
      selectsParaActualizar.forEach(id => { const el = document.getElementById(id); if (el) el.dispatchEvent(new Event('change')); });
      
      if (window.tomSelectCie10) window.tomSelectCie10.clear();
      document.getElementById('exp_ninguno').checked = true;
      toggleExposicion(true);
      
      const tbReq = document.getElementById('tb_requiere_ficha');
      if (tbReq) tbReq.value = 'NO';
      revisarCie10ParaTB('');
      if (window.toggleFormularioTB) window.toggleFormularioTB(true);
      
      document.getElementById('contactsBody').innerHTML = '';
      for (let i = 0; i < 1; i++) agregarContacto();
      
      setUnidadPredeterminada(); 
      window.actualizarBadgeEdad?.();
      window.togglePcrLam1eraPrueba?.();
      setTimeout(() => saveFormData(), 200); // Esperar a que el DOM se asiente
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

export function guardarBorradorLocal() {
  saveFormData();
  const savedData = localStorage.getItem('epiFormData');
  if (!savedData) {
    Swal.fire('Formulario vacío', 'No hay datos para guardar como borrador.', 'info');
    return;
  }
  const data = JSON.parse(savedData);
  const cedula = (data.cedula || '').trim() || 'Sin-CI';
  const nombre = `${data.primer_apellido || ''} ${data.primer_nombre || ''}`.trim() || 'Paciente sin nombre';
  const cie10 = data.diagnostico_cie10 || 'Sin diagnóstico';
  const idBorrador = `${cedula}_${Date.now()}`;

  let borradores = [];
  try {
    borradores = JSON.parse(localStorage.getItem('epiBorradoresLocales') || '[]');
  } catch(e) {
    borradores = [];
  }

  const indexExistente = borradores.findIndex(b => b.cedula && b.cedula === cedula && cedula !== 'Sin-CI');
  const nuevoBorrador = {
    id: idBorrador,
    cedula,
    nombre,
    cie10,
    fecha: new Date().toISOString(),
    data
  };

  if (indexExistente >= 0) {
    borradores[indexExistente] = nuevoBorrador;
  } else {
    borradores.unshift(nuevoBorrador);
  }

  localStorage.setItem('epiBorradoresLocales', JSON.stringify(borradores));

  const menuEl = document.getElementById('menuOpciones');
  if (menuEl) {
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(menuEl);
    if (bsOffcanvas) bsOffcanvas.hide();
  }

  Swal.fire({
    icon: 'success',
    title: '¡Borrador Guardado!',
    html: `Guardado en la memoria de este equipo:<br><b>${nombre}</b> (C.I: ${cedula})<br><br><small style="color: var(--apple-text-muted);">Total de borradores: ${borradores.length}</small>`,
    confirmButtonColor: 'var(--apple-blue)',
    timer: 2500
  });
}

export function abrirModalBorradores() {
  const menuEl = document.getElementById('menuOpciones');
  if (menuEl) {
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(menuEl);
    if (bsOffcanvas) bsOffcanvas.hide();
  }

  let borradores = [];
  try {
    borradores = JSON.parse(localStorage.getItem('epiBorradoresLocales') || '[]');
  } catch(e) {
    borradores = [];
  }

  if (borradores.length === 0) {
    Swal.fire('Sin borradores', 'Aún no tienes borradores guardados localmente en este dispositivo.', 'info');
    return;
  }

  let htmlContent = `
    <div class="d-flex gap-2 align-items-center mb-3">
      <input type="text" id="filtroBorradores" class="form-control" placeholder="🔍 Buscar por cédula o nombre..." style="border-radius: 8px;">
      <button type="button" class="btn btn-sm btn-apple text-nowrap d-flex align-items-center gap-1" style="font-size: 0.8rem; padding: 8px 12px;" onclick="sincronizarBorradoresNube()" title="Subir todos los borradores a la nube">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path><polyline points="16 12 12 8 8 12"></polyline><line x1="12" y1="8" x2="12" y2="21"></line></svg>
        Sincronizar Nube
      </button>
    </div>
    <div id="listaBorradoresCont" class="list-group text-start" style="max-height: 380px; overflow-y: auto;">
  `;

  borradores.forEach((b) => {
    const fechaStr = new Date(b.fecha).toLocaleDateString() + ' ' + new Date(b.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const busqueda = `${b.cedula} ${b.nombre} ${b.cie10}`.toLowerCase();
    htmlContent += `
      <div class="list-group-item item-borrador flex-column align-items-start mb-2 p-3" data-busqueda="${busqueda}" style="border-radius: 8px; border: 1px solid var(--apple-border); background: var(--apple-subcard-bg);">
        <div class="d-flex justify-content-between align-items-center w-100 mb-2">
          <div style="line-height: 1.3;">
            <strong style="color: var(--apple-blue); font-size: 1rem;">C.I: ${b.cedula}</strong><br>
            <span style="color: var(--apple-text); font-weight: 500;">${b.nombre}</span><br>
            <small style="color: var(--apple-text-muted); font-size: 0.78rem;">${b.cie10}</small><br>
            <small style="color: var(--apple-text-muted); font-size: 0.75rem;">Guardado: ${fechaStr}</small>
          </div>
          <button class="btn btn-sm btn-del-contacto" onclick="eliminarBorradorLocal('${b.id}')" title="Eliminar este borrador">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
        <button class="btn btn-sm btn-apple w-100" style="padding: 8px; font-size: 0.88rem;" onclick="cargarBorradorLocal('${b.id}')">
          Cargar en Formulario
        </button>
      </div>
    `;
  });
  htmlContent += `</div>`;

  Swal.fire({
    title: 'Mis Borradores Locales (Offline)',
    html: htmlContent,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: 'Cerrar',
    cancelButtonColor: 'var(--apple-text-muted)',
    width: '560px',
    didOpen: () => {
      const filtro = document.getElementById('filtroBorradores');
      if (filtro) {
        filtro.addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase().trim();
          document.querySelectorAll('.item-borrador').forEach(item => {
            const texto = item.getAttribute('data-busqueda') || '';
            item.style.display = texto.includes(q) ? '' : 'none';
          });
        });
      }
    }
  });
}

export function cargarBorradorLocal(id) {
  let borradores = [];
  try { borradores = JSON.parse(localStorage.getItem('epiBorradoresLocales') || '[]'); } catch(e) {}
  const b = borradores.find(item => item.id === id);
  if (!b) return;

  Swal.close();
  localStorage.setItem('epiFormData', JSON.stringify(b.data));
  loadFormData();
  Swal.fire({
    icon: 'success',
    title: '¡Borrador Cargado!',
    text: `Datos de ${b.nombre} restaurados en el formulario.`,
    timer: 1800,
    showConfirmButton: false
  });
}

export function eliminarBorradorLocal(id) {
  let borradores = [];
  try { borradores = JSON.parse(localStorage.getItem('epiBorradoresLocales') || '[]'); } catch(e) {}
  borradores = borradores.filter(item => item.id !== id);
  localStorage.setItem('epiBorradoresLocales', JSON.stringify(borradores));
  abrirModalBorradores();
}

export function exportarRespaldoJSON() {
  saveFormData();
  const savedData = localStorage.getItem('epiFormData');
  if (!savedData) {
    Swal.fire('Sin datos', 'No hay datos en el formulario para exportar.', 'info');
    return;
  }
  const data = JSON.parse(savedData);
  const ced = data.cedula || 'SIN_CEDULA';
  const nombre = `${data.primer_apellido || ''}_${data.primer_nombre || ''}`.trim() || 'PACIENTE';
  const fecha = new Date().toISOString().slice(0, 10);
  const fileName = `FichaEPI_${ced}_${nombre}_${fecha}.json`;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  Swal.fire({
    icon: 'success',
    title: '¡Respaldo JSON Generado!',
    text: `El archivo ${fileName} ha sido descargado.`,
    timer: 2000,
    showConfirmButton: false
  });
}

export function importarRespaldoJSON(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || typeof data !== 'object') throw new Error("Estructura de archivo inválida.");
      localStorage.setItem('epiFormData', JSON.stringify(data));
      loadFormData();
      Swal.fire('¡Importado con éxito!', 'Los datos de la ficha fueron restaurados correctamente.', 'success');
    } catch(err) {
      Swal.fire('Error al importar', 'El archivo seleccionado no es un respaldo válido de Fichas EPI: ' + err.message, 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

export function setupAutoSave() {
  const form = document.getElementById('epiForm');
  if (form) {
    form.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveFormData, 1000);
    });
    form.addEventListener('change', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveFormData, 500); // Dar un margen para que Selects actualicen
    });
  }
}

window.limpiarFormulario = limpiarFormulario;
window.guardarBorradorLocal = guardarBorradorLocal;
window.abrirModalBorradores = abrirModalBorradores;
window.cargarBorradorLocal = cargarBorradorLocal;
window.eliminarBorradorLocal = eliminarBorradorLocal;
window.exportarRespaldoJSON = exportarRespaldoJSON;
window.importarRespaldoJSON = importarRespaldoJSON;

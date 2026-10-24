// js/storage.js
import { agregarContacto, agregarContactoRestaurado } from './contacts.js';
import { 
  toggleElementos, setUnidadPredeterminada, fillCantones, fillParroquias, 
  actualizarGeneroDropdowns, actualizarEstadoEmbarazo, toggleTratamientoCampos, 
  toggleExposicion, validarProcedenciaAgua, toggleDondeEnfermos, 
  toggleLaboratorio, forzarCalculoDias,
  toggleFormularioTB, revisarCie10ParaTB, toggleServiciosTB, toggleCondicionesEspeciales, toggleCaracterizarSignos,
  sincronizarCopiasTB
} from './formLogic.js';

let saveTimeout;
let isInitializing = true; // Bandera para evitar autoguardados durante la carga inicial o cambio de formulario

export function obtenerClaveStorage(modoExplicito) {
  const modo = modoExplicito || window.modoAppActual || localStorage.getItem('modoAppActual') || 'epi';
  return modo === 'sppat' ? 'sppatFormData' : 'epiFormData';
}

export function saveFormData(modoExplicito) {
  if (isInitializing) return; // Evitar que el autoguardado borre datos mientras se carga o cambia de formulario

  const modo = modoExplicito || window.modoAppActual || 'epi';
  const storageKey = obtenerClaveStorage(modo);

  const data = {};
  document.querySelectorAll('.save-state').forEach(el => {
    const esCampoSppat = el.id?.startsWith('sppat_') || el.name?.startsWith('sppat_') || Boolean(el.closest('#contenedorSppat'));
    const esCampoExclusivoEpi = el.classList.contains('ocultar-en-sppat') || Boolean(el.closest('.ocultar-en-sppat')) || Boolean(el.closest('#contenedorEpiTb'));

    // Evitar mezclar campos entre formularios
    if (modo === 'sppat' && esCampoExclusivoEpi) return;
    if (modo === 'epi' && esCampoSppat) return;

    if (el.type === 'checkbox') {
      data[el.id] = el.checked; 
    } else if (el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
    } else if (el.id) {
      data[el.id] = el.value;
    }
  });

  if (modo === 'epi') {
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
  }

  localStorage.setItem(storageKey, JSON.stringify(data));
}

function resetearCamposBaseEnDOM(modo) {
  const form = document.getElementById('epiForm');
  if (form) form.reset();

  if (window.tomSelectCie10) window.tomSelectCie10.clear(true);
  if (window.tomSelectSppatCie1) window.tomSelectSppatCie1.clear(true);
  if (window.tomSelectSppatCie2) window.tomSelectSppatCie2.clear(true);

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
  const cantonEl = document.getElementById('canton_residencia');
  if (cantonEl) cantonEl.value = '';
  const parrEl = document.getElementById('parroquia_residencia');
  if (parrEl) parrEl.innerHTML = '<option value="" selected disabled>Seleccione Parroquia...</option>';

  const civilEl = document.getElementById('estado_civil');
  if (civilEl) civilEl.innerHTML = '<option value="" selected disabled>Seleccione...</option>';
  const etniaEl = document.getElementById('etnia');
  if (etniaEl) etniaEl.innerHTML = '<option value="" selected disabled>Seleccione...</option>';

  setUnidadPredeterminada();

  // Si estamos en SPPAT, nunca arrastrar médico tratante de EPI
  if (modo === 'sppat') {
    const medEpi = document.getElementById('medico_tratante');
    if (medEpi) medEpi.value = '';
    const tbResp = document.getElementById('tb_responsable');
    if (tbResp) tbResp.value = '';
  }

  const fAte = document.getElementById('fecha_atencion');
  if (fAte && !fAte.value) {
    fAte.value = new Date().toISOString().slice(0, 10);
  }

  if (modo === 'sppat') {
    const sppatHora = document.getElementById('sppat_hora_atencion');
    if (sppatHora && !sppatHora.value) {
      sppatHora.value = new Date().toTimeString().slice(0, 5);
    }
    const chkAsegurado = document.getElementById('sppat_veh_asegurado');
    if (chkAsegurado) chkAsegurado.checked = true;
    window.alternarQuienFirmaSppat?.('PACIENTE');
    window.sincronizarChipsRx?.();
  } else {
    const tbody = document.getElementById('contactsBody');
    if (tbody) {
      tbody.innerHTML = '';
      agregarContacto();
    }
    const expNinguno = document.getElementById('exp_ninguno');
    if (expNinguno) {
      expNinguno.checked = true;
      toggleExposicion(true);
    }
    const tbReq = document.getElementById('tb_requiere_ficha');
    if (tbReq) tbReq.value = 'NO';
    sincronizarCopiasTB('2');
    revisarCie10ParaTB('');
    toggleFormularioTB(true);
  }

  window.actualizarBadgeEdad?.();
}

export function loadFormData(modoExplicito = null, desdeCambioModo = false) {
  isInitializing = true; // Bloqueamos el autoguardado durante la carga
  
  const modo = modoExplicito || window.modoAppActual || localStorage.getItem('modoAppActual') || 'epi';
  const storageKey = obtenerClaveStorage(modo);
  const savedData = localStorage.getItem(storageKey);

  // Siempre partimos de un DOM limpio para que no se filtren datos entre EPI y SPPAT
  resetearCamposBaseEnDOM(modo);

  if (!savedData) {
    if (!desdeCambioModo && typeof window.cambiarModoApp === 'function') {
      window.cambiarModoApp(modo, true);
    }
    setTimeout(() => { isInitializing = false; }, 250);
    return;
  }
  
  try {
    const data = JSON.parse(savedData);
    document.querySelectorAll('.save-state').forEach(el => {
      const esCampoSppat = el.id?.startsWith('sppat_') || el.name?.startsWith('sppat_') || Boolean(el.closest('#contenedorSppat'));
      const esCampoExclusivoEpi = el.classList.contains('ocultar-en-sppat') || Boolean(el.closest('.ocultar-en-sppat')) || Boolean(el.closest('#contenedorEpiTb'));

      if (modo === 'sppat' && esCampoExclusivoEpi) return;
      if (modo === 'epi' && esCampoSppat) return;

      if (el.type === 'checkbox') {
        if (data[el.id] !== undefined) el.checked = data[el.id];
      } else if (el.type === 'radio') {
        if (data[el.name] !== undefined) {
          el.checked = (data[el.name] === el.value);
        }
      } else if (el.id && data[el.id] !== undefined && 
           el.id !== 'canton_residencia' && el.id !== 'parroquia_residencia' &&
           el.id !== 'institucion' && el.id !== 'establecimiento') { 
        el.value = data[el.id];
      }
    });

    if (modo === 'epi' && data.diagnostico_cie10 && window.tomSelectCie10) {
      window.tomSelectCie10.setValue(data.diagnostico_cie10, true);
    }
    if (modo === 'sppat') {
      if (data.sppat_select_cie1 && window.tomSelectSppatCie1) {
        window.tomSelectSppatCie1.setValue(data.sppat_select_cie1, true);
      }
      if (data.sppat_select_cie2 && window.tomSelectSppatCie2) {
        window.tomSelectSppatCie2.setValue(data.sppat_select_cie2, true);
      }
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
      document.getElementById('prov_residencia').value = data.prov_residencia;
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

    if (modo === 'epi') {
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
      sincronizarCopiasTB(data.tb_copias || data.tb_copias_sec || '2');
      
      const espChk = document.getElementById('tb_crit_especiales');
      if (espChk) toggleCondicionesEspeciales(espChk.checked);

      const condEgreso = document.querySelector('input[name="cond_egreso"]:checked')?.value;
      toggleElementos([document.getElementById('fecha_fallecimiento')], condEgreso === 'FALLECIDO');
            
      const tipoExp = document.querySelector('input[name="rad_tipo_exp"]:checked')?.value;
      toggleElementos([document.getElementById('tipo_exposicion_otro')], tipoExp === 'Otras');

      // === CARGA SEGURA DE CONTACTOS ===
      const tbody = document.getElementById('contactsBody');
      tbody.innerHTML = '';
      const listaContactos = [...(data.contactos || []), ...(data.contactos_12_14 || [])];
      if (listaContactos.length > 0) {
        listaContactos.forEach((c, index) => agregarContactoRestaurado(c, index === 0));
      } else {
        agregarContacto();
      }
      const inpDiagDef = document.getElementById('diagnostico_def');
      if (inpDiagDef) inpDiagDef.value = '';
      const inpFechaCierre = document.getElementById('fecha_cierre');
      if (inpFechaCierre) inpFechaCierre.value = '';

      forzarCalculoDias();

      const cieAct = document.getElementById('diagnostico_cie10').value;
      revisarCie10ParaTB(cieAct);
      toggleFormularioTB(true);
    } else {
      const quienFirma = data.sppat_quien_firma || (data.sppat_acom_nombre ? 'REPRESENTANTE' : 'PACIENTE');
      window.alternarQuienFirmaSppat?.(quienFirma);
      window.sincronizarChipsRx?.();
    }

    window.actualizarBadgeEdad?.();

    if (!desdeCambioModo && typeof window.cambiarModoApp === 'function') {
      window.cambiarModoApp(modo, true);
    }
  } catch(e) {
    console.warn("Error cargando datos del formulario:", e);
  } finally {
    setTimeout(() => { isInitializing = false; }, 300); 
  }
}

export function limpiarFormulario() {
  const esSppat = (window.modoAppActual === 'sppat');
  const titulo = esSppat ? '¿Limpiar Formulario SPPAT?' : '¿Limpiar Ficha EPI?';
  const texto = esSppat 
    ? 'Se borrarán únicamente los datos del formulario SPPAT de accidentes de tránsito (la Ficha EPI no se verá afectada).' 
    : 'Se borrarán únicamente los datos de la ficha epidemiológica (el Formulario SPPAT no se verá afectado).';

  Swal.fire({
    title: titulo, 
    text: texto, 
    icon: 'warning', 
    showCancelButton: true,
    confirmButtonColor: 'var(--apple-red)', 
    cancelButtonColor: 'var(--apple-text-muted)', 
    confirmButtonText: 'Sí, limpiar', 
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      const modo = esSppat ? 'sppat' : 'epi';
      localStorage.removeItem(obtenerClaveStorage(modo));
      isInitializing = true;
      resetearCamposBaseEnDOM(modo);
      setTimeout(() => {
        isInitializing = false;
        saveFormData(modo);
      }, 200);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      Swal.fire({
        icon: 'success',
        title: esSppat ? 'Formulario SPPAT Limpio' : 'Ficha EPI Limpia',
        text: 'Los campos han sido restablecidos correctamente.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  });
}

export function guardarBorradorLocal() {
  const modo = window.modoAppActual || 'epi';
  saveFormData(modo);
  const savedData = localStorage.getItem(obtenerClaveStorage(modo));
  if (!savedData) {
    Swal.fire('Formulario vacío', 'No hay datos para guardar como borrador.', 'info');
    return;
  }
  const data = JSON.parse(savedData);
  const cedula = (data.cedula || '').trim() || 'Sin-CI';
  const nombre = `${data.primer_apellido || ''} ${data.primer_nombre || ''}`.trim() || 'Paciente sin nombre';
  const cie10 = modo === 'sppat'
    ? (`[SPPAT] ${data.sppat_diag_principal_cie || ''} ${data.sppat_diag_principal_txt || ''}`.trim() || '[SPPAT] Accidente de Tránsito')
    : (data.diagnostico_cie10 || 'Sin diagnóstico');
  const idBorrador = `${modo}_${cedula}_${Date.now()}`;

  let borradores = [];
  try {
    borradores = JSON.parse(localStorage.getItem('epiBorradoresLocales') || '[]');
  } catch(e) {
    borradores = [];
  }

  const indexExistente = borradores.findIndex(b => b.cedula && b.cedula === cedula && (b.modo || 'epi') === modo && cedula !== 'Sin-CI');
  const nuevoBorrador = {
    id: idBorrador,
    modo,
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
  const modoDestino = b.modo || 'epi';
  localStorage.setItem(obtenerClaveStorage(modoDestino), JSON.stringify(b.data));
  if (typeof window.cambiarModoApp === 'function' && window.modoAppActual !== modoDestino) {
    window.cambiarModoApp(modoDestino);
  } else {
    loadFormData(modoDestino);
  }
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
  const modo = window.modoAppActual || 'epi';
  saveFormData(modo);
  const savedData = localStorage.getItem(obtenerClaveStorage(modo));
  if (!savedData) {
    Swal.fire('Sin datos', 'No hay datos en el formulario para exportar.', 'info');
    return;
  }
  const data = JSON.parse(savedData);
  data._modoFormulario = modo;
  const ced = data.cedula || 'SIN_CEDULA';
  const nombre = `${data.primer_apellido || ''}_${data.primer_nombre || ''}`.trim() || 'PACIENTE';
  const fecha = new Date().toISOString().slice(0, 10);
  const prefijo = modo === 'sppat' ? 'FichaSPPAT' : 'FichaEPI';
  const fileName = `${prefijo}_${ced}_${nombre}_${fecha}.json`;

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
      const modoDestino = data._modoFormulario || window.modoAppActual || 'epi';
      localStorage.setItem(obtenerClaveStorage(modoDestino), JSON.stringify(data));
      if (typeof window.cambiarModoApp === 'function' && window.modoAppActual !== modoDestino) {
        window.cambiarModoApp(modoDestino);
      } else {
        loadFormData(modoDestino);
      }
      Swal.fire('¡Importado con éxito!', 'Los datos de la ficha fueron restaurados correctamente.', 'success');
    } catch(err) {
      Swal.fire('Error al importar', 'El archivo seleccionado no es un respaldo válido: ' + err.message, 'error');
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
      saveTimeout = setTimeout(() => saveFormData(), 1000);
    });
    form.addEventListener('change', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => saveFormData(), 500); // Dar un margen para que Selects actualicen
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

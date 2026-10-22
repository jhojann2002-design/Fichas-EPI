// js/main.js
import { dbSintomas, dbVacunas } from './constants.js';
import { initTheme, enfocarElementoSeguro, mostrarLoader, ocultarLoader } from './ui.js';
import { setupAutoSave, saveFormData, loadFormData } from './storage.js';
import { initData, initApiListeners } from './api.js';
import { 
  toggleElementos, toggleExposicion, validarProcedenciaAgua, 
  actualizarGeneroDropdowns, actualizarEstadoEmbarazo, 
  toggleLaboratorio, forzarCalculoDias
} from './formLogic.js';

// 1. IMPORTAMOS LA FUNCIÓN DE LA NUBE
import { initCloudAuth } from './cloud.js';

// 2. IMPORTAMOS FUNCIONES SPPAT, MÉDICOS Y EXPORTACIÓN
import { 
  configurarAutocompletadoMedicos, 
  abrirGestionMedicos, 
  registrarOActualizarMedico,
  obtenerMedicos
} from './medicos.js';
import { recopilarDatosSppat, generarExpedienteSppatBlob } from './sppat.js';
import { descargarFichaSegura } from './api.js';

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

// Quitamos 'cedula' de aquí porque ahora tiene validación propia
const criticalFields = ['primer_apellido', 'primer_nombre', 'institucion', 'establecimiento'];
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
// VALIDACIÓN INTELIGENTE: CÉDULA/EXTRANJEROS
// ==========================================
function setupValidacionCedula() {
  const cedulaInput = document.getElementById('cedula');
  const nacionalidadInput = document.getElementById('nacionalidad');
  const labelCedula = cedulaInput.previousElementSibling;
  
  let typingTimer;                
  const doneTypingInterval = 800; // 800ms de inactividad para validar

  function validarCedulaEcuatoriana(cedula) {
    if (cedula.length !== 10) return false;
    const digitoRegion = parseInt(cedula.substring(0, 2), 10);
    if (digitoRegion < 1 || digitoRegion > 24) return false;
    const ultimoDigito = parseInt(cedula.substring(9, 10), 10);
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let digito = parseInt(cedula.charAt(i), 10);
      if (i % 2 === 0) {
        digito *= 2;
        if (digito > 9) digito -= 9;
      }
      suma += digito;
    }
    const decenaSuperior = Math.ceil(suma / 10) * 10;
    let digitoVerificador = decenaSuperior - suma;
    if (digitoVerificador === 10) digitoVerificador = 0;
    return digitoVerificador === ultimoDigito;
  }

  function ejecutarValidacion() {
    const nac = nacionalidadInput.value.trim().toUpperCase();
    const val = cedulaInput.value.trim();

    if (nac === 'ECUATORIANA' || nac === '') {
      if (val.length === 0) {
        cedulaInput.classList.add('input-error');
        labelCedula.innerText = 'Cédula (Requerida):';
        labelCedula.style.color = 'var(--apple-red)';
      } else if (val.length !== 10 || !validarCedulaEcuatoriana(val)) {
        cedulaInput.classList.add('input-error');
        labelCedula.innerText = 'Cédula (Inválida):';
        labelCedula.style.color = 'var(--apple-red)';
      } else {
        cedulaInput.classList.remove('input-error');
        labelCedula.innerText = 'Cédula (Válida):';
        labelCedula.style.color = 'var(--apple-blue)';
      }
    } else {
      if (val.length === 0) {
        cedulaInput.classList.add('input-error');
        labelCedula.innerText = 'Identificación (Requerida):';
        labelCedula.style.color = 'var(--apple-red)';
      } else {
        cedulaInput.classList.remove('input-error');
        labelCedula.innerText = 'Identificación (Extranjero):';
        labelCedula.style.color = 'var(--apple-blue)';
      }
    }
  }

  function onInputHandler() {
    const nac = nacionalidadInput.value.trim().toUpperCase();
    
    if (nac === 'ECUATORIANA' || nac === '') {
      // Se permite más de 10 dígitos momentáneamente para que pueda ver el error si se pasa
      cedulaInput.setAttribute('maxlength', '15'); 
      cedulaInput.setAttribute('type', 'tel');
      if (!cedulaInput.classList.contains('numeric-input')) cedulaInput.classList.add('numeric-input');
    } else {
      cedulaInput.setAttribute('maxlength', '20');
      cedulaInput.setAttribute('type', 'text');
      cedulaInput.classList.remove('numeric-input');
    }

    // Estado Neutral mientras escribe
    cedulaInput.classList.remove('input-error');
    labelCedula.innerText = (nac === 'ECUATORIANA' || nac === '') ? 'Cédula:' : 'Identificación:';
    labelCedula.style.color = 'var(--apple-label)';

    // Reiniciamos el temporizador
    clearTimeout(typingTimer);
    typingTimer = setTimeout(ejecutarValidacion, doneTypingInterval);
  }

  // Eventos
  cedulaInput.addEventListener('input', onInputHandler);
  cedulaInput.addEventListener('blur', () => {
      clearTimeout(typingTimer);
      ejecutarValidacion(); // Valida de golpe al cambiar de celda
  });
  
  nacionalidadInput.addEventListener('input', () => {
     onInputHandler();
     ejecutarValidacion();
  });
  
  setTimeout(() => {
     if(cedulaInput.value.trim().length > 0) ejecutarValidacion();
  }, 500); 
}

// ==========================================
// LISTENERS PRINCIPALES DE CARGA (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

  // Iniciamos Validación de Cédula
  setupValidacionCedula();

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

  // ==========================================
  // SINCRONIZACIÓN AUTOMÁTICA: MÉDICO TRATANTE -> RESPONSABLE TB
  // ==========================================
  let ultimoMedicoTratante = '';
  const medicoTratanteInput = document.getElementById('medico_tratante');
  const tbResponsableInput = document.getElementById('tb_responsable');

  if (medicoTratanteInput && tbResponsableInput) {
    ultimoMedicoTratante = medicoTratanteInput.value;
    medicoTratanteInput.addEventListener('input', () => {
      const nuevoValor = medicoTratanteInput.value;
      if (!tbResponsableInput.value || tbResponsableInput.value === ultimoMedicoTratante) {
        tbResponsableInput.value = nuevoValor;
        tbResponsableInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      ultimoMedicoTratante = nuevoValor;
    });
  }

  // Listener para edad en tiempo real
  const fNac = document.getElementById('fecha_nacimiento');
  if (fNac) {
    fNac.addEventListener('input', actualizarBadgeEdad);
    fNac.addEventListener('change', actualizarBadgeEdad);
  }
  const fAte = document.getElementById('fecha_atencion');
  if (fAte) {
    fAte.addEventListener('input', actualizarBadgeEdad);
    fAte.addEventListener('change', actualizarBadgeEdad);
  }
  actualizarBadgeEdad();
});

// ==========================================
// RETROALIMENTACIÓN DE EDAD Y BOTÓN HOY
// ==========================================
export function actualizarBadgeEdad() {
  const fNacVal = document.getElementById('fecha_nacimiento')?.value;
  const fAteVal = document.getElementById('fecha_atencion')?.value;
  const badge = document.getElementById('badge_edad_calculada');
  if (!badge) return;

  if (!fNacVal) {
    badge.style.display = 'none';
    badge.textContent = '';
    return;
  }

  const nac = new Date(fNacVal + 'T12:00:00');
  const refDate = fAteVal ? new Date(fAteVal + 'T12:00:00') : new Date();

  if (isNaN(nac.getTime()) || isNaN(refDate.getTime()) || nac > refDate) {
    badge.style.display = 'inline-block';
    badge.style.background = 'rgba(255, 59, 48, 0.1)';
    badge.style.color = 'var(--apple-red)';
    badge.style.borderColor = 'rgba(255, 59, 48, 0.2)';
    badge.textContent = 'Fecha inválida';
    return;
  }

  let anos = refDate.getFullYear() - nac.getFullYear();
  let meses = refDate.getMonth() - nac.getMonth();
  let dias = refDate.getDate() - nac.getDate();

  if (dias < 0) {
    meses--;
    dias += new Date(refDate.getFullYear(), refDate.getMonth(), 0).getDate();
  }
  if (meses < 0) {
    anos--;
    meses += 12;
  }

  let texto = '';
  if (anos > 0) {
    texto = `${anos} año${anos > 1 ? 's' : ''}${meses > 0 ? `, ${meses} m` : ''}`;
  } else if (meses > 0) {
    texto = `${meses} mes${meses > 1 ? 'es' : ''}${dias > 0 ? `, ${dias} d` : ''}`;
  } else {
    texto = `${Math.max(0, dias)} día${dias !== 1 ? 's' : ''}`;
  }

  badge.style.display = 'inline-block';
  badge.style.background = 'var(--apple-blue-tint)';
  badge.style.color = 'var(--apple-blue)';
  badge.style.borderColor = 'rgba(0, 113, 227, 0.2)';
  badge.textContent = `Edad: ${texto}`;
}
window.actualizarBadgeEdad = actualizarBadgeEdad;

export function establecerFechaHoy(inputId) {
  const el = document.getElementById(inputId);
  if (el) {
    const hoy = new Date().toISOString().slice(0, 10);
    el.value = hoy;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (inputId === 'fecha_atencion') {
      actualizarBadgeEdad();
    }
  }
}
window.establecerFechaHoy = establecerFechaHoy;

// ==========================================
// REGISTRO DE SERVICE WORKER (PWA OFFLINE)
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Registro de Service Worker falló:', err);
    });
  });
}

// ==========================================
// GESTIÓN DE INSTALACIÓN PWA Y EXPERIENCIA OFFLINE
// ==========================================
let deferredPWAInstallPrompt = null;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPWAInstallPrompt = e;

  // Si no ha sido descartado recientemente ni está ya instalada, mostrar el banner tras unos segundos
  const dismissedUntil = localStorage.getItem('pwaDismissedUntil');
  const now = Date.now();
  if (!isStandalone && (!dismissedUntil || now > parseInt(dismissedUntil, 10))) {
    setTimeout(() => {
      const banner = document.getElementById('pwaInstallBanner');
      if (banner) banner.classList.add('show');
    }, 2500);
  }
});

window.addEventListener('appinstalled', () => {
  deferredPWAInstallPrompt = null;
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) banner.classList.remove('show');
  const txtInstall = document.getElementById('txtBtnInstallApp');
  if (txtInstall) txtInstall.innerText = '✓ App Instalada (Modo Offline)';
});

export function cerrarBannerPWA(recordarDespues = false) {
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) banner.classList.remove('show');
  if (recordarDespues) {
    // Recordar en 5 días
    localStorage.setItem('pwaDismissedUntil', (Date.now() + 5 * 24 * 60 * 60 * 1000).toString());
  }
}

export async function instalarAppPWA() {
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) banner.classList.remove('show');

  const menuEl = document.getElementById('menuOpciones');
  if (menuEl) {
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(menuEl);
    if (bsOffcanvas) bsOffcanvas.hide();
  }

  if (isStandalone) {
    Swal.fire({
      icon: 'success',
      title: '¡App Instalada!',
      html: 'Ya estás utilizando la aplicación en modo nativo.<br>Todas las funciones de llenado y exportación de fichas operan <b>100% sin conexión a internet</b>.',
      confirmButtonColor: 'var(--apple-blue)'
    });
    return;
  }

  if (deferredPWAInstallPrompt) {
    deferredPWAInstallPrompt.prompt();
    const { outcome } = await deferredPWAInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPWAInstallPrompt = null;
      const txtInstall = document.getElementById('txtBtnInstallApp');
      if (txtInstall) txtInstall.innerText = '✓ App Instalada';
    }
    return;
  }

  // Si es iOS / iPadOS / Safari (no soportan beforeinstallprompt)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    Swal.fire({
      title: 'Instalar en iPhone / iPad',
      html: `
        <div class="text-start" style="font-size: 0.9rem;">
          <p class="mb-2">Para instalar y usar esta app sin internet en tu dispositivo Apple:</p>
          <ol class="ps-3 mb-3">
            <li class="mb-1">Toca el botón <b>Compartir</b> en Safari (icono <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> abajo en tu pantalla).</li>
            <li class="mb-1">Baja y selecciona <b>"Agregar a Inicio"</b> (o <i>Add to Home Screen</i>).</li>
            <li>Pulsa <b>"Agregar"</b> en la esquina superior derecha.</li>
          </ol>
          <p class="text-muted small mb-0">¡Listo! Podrás abrirla desde tu pantalla de inicio incluso en modo avión.</p>
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: 'var(--apple-blue)'
    });
    return;
  }

  // Si es PC o Android sin el evento aún disponible
  Swal.fire({
    title: 'Instalación de Aplicación',
    html: `
      <div class="text-start" style="font-size: 0.9rem;">
        <p class="mb-2">Puedes instalar esta app directamente desde tu navegador:</p>
        <ul class="ps-3 mb-2">
          <li>En <b>Chrome o Edge en PC</b>: Haz clic en el icono de instalación <b>(+)</b> en la barra de direcciones superior.</li>
          <li>En <b>Android</b>: Abre el menú de 3 puntos (⋮) y selecciona <b>"Instalar aplicación"</b> o <b>"Agregar a pantalla principal"</b>.</li>
        </ul>
        <p class="text-muted small mb-0">La aplicación se descargará en tu equipo y funcionará sin internet en todo momento.</p>
      </div>
    `,
    confirmButtonText: 'Entendido',
    confirmButtonColor: 'var(--apple-blue)'
  });
}

// ==========================================
// MONITOR DE ESTADO DE RED (ONLINE / OFFLINE)
// ==========================================
function actualizarEstadoRed() {
  const badge = document.getElementById('offlineBadge');
  const badgeText = document.getElementById('offlineBadgeText');
  if (!badge) return;

  if (!navigator.onLine) {
    badge.classList.remove('d-none', 'online');
    if (badgeText) badgeText.innerText = '⚡ Modo Offline';
  } else {
    badge.classList.remove('d-none');
    badge.classList.add('online');
    if (badgeText) badgeText.innerText = '🟢 En línea';
    setTimeout(() => {
      if (navigator.onLine) badge.classList.add('d-none');
    }, 2800);
  }
}

export function mostrarInfoModoOffline() {
  Swal.fire({
    icon: 'info',
    title: navigator.onLine ? 'Conexión Activa' : '⚡ Modo Offline Activo',
    html: navigator.onLine
      ? 'Tienes conexión a internet activa. Tus fichas se pueden sincronizar con la nube y generar en PDF o Excel.'
      : '<b>Estás trabajando 100% sin conexión a internet.</b><br><br>Puedes llenar cualquier ficha, calcular edades y semanas epidemiológicas, y generar los PDFs oficiales con total normalidad.<br><br>Tus fichas se guardan en tus <b>Borradores Locales</b> en este dispositivo hasta que recuperes señal.',
    confirmButtonText: 'Aceptar',
    confirmButtonColor: 'var(--apple-blue)'
  });
}

window.cerrarBannerPWA = cerrarBannerPWA;
window.instalarAppPWA = instalarAppPWA;
window.mostrarInfoModoOffline = mostrarInfoModoOffline;

window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);
// Comprobar estado inicial
if (!navigator.onLine) {
  actualizarEstadoRed();
}

// Si ya está instalada, actualizar el texto del botón del menú
if (isStandalone) {
  const txtInstall = document.getElementById('txtBtnInstallApp');
  if (txtInstall) txtInstall.innerText = '✓ App Instalada (Offline)';
}

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

// ==========================================
// MÓDULO SPPAT / ACCIDENTES Y GESTIÓN DE MÉDICOS
// ==========================================
let modoAppActual = 'epi';
try {
  const savedModo = localStorage.getItem('modoAppActual');
  if (savedModo === 'sppat' || savedModo === 'epi') modoAppActual = savedModo;
} catch(e) {}
window.modoAppActual = modoAppActual;

export function alternarModoApp() {
  const nuevoModo = (modoAppActual === 'sppat') ? 'epi' : 'sppat';
  abrirModalCambiarFormulario(nuevoModo);
}

export function abrirModalCambiarFormulario(modoDestino) {
  const target = modoDestino || (modoAppActual === 'sppat' ? 'epi' : 'sppat');
  if (target === modoAppActual) return;

  const esHaciaSppat = (target === 'sppat');
  const nombreDestino = esHaciaSppat ? 'Expediente SPPAT' : 'Fichas Epidemiológicas';
  const subtituloDestino = esHaciaSppat ? 'Accidentes de Tránsito / Emergencias' : 'Notificación EPI y TB';
  const iconoDestino = esHaciaSppat ? '🚨' : '📋';
  const colorBoton = esHaciaSppat ? '#ff453a' : '#0071e3';

  Swal.fire({
    title: `¿Cambiar a ${nombreDestino}?`,
    html: `
      <div class="text-center py-2" style="color: var(--apple-text);">
        <div style="font-size: 2.4rem; margin-bottom: 12px; line-height: 1;">${iconoDestino}</div>
        <p style="font-size: 0.95rem; font-weight: 500; margin-bottom: 8px;">
          Vas a ingresar al entorno de <b>${nombreDestino}</b> (${subtituloDestino}).
        </p>
        <p class="text-muted" style="font-size: 0.82rem; margin-bottom: 0;">
          🔒 Ambos formularios son 100% independientes (no se mezclan ni sincronizan datos entre EPI y SPPAT).
        </p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: `Sí, cambiar a ${nombreDestino}`,
    cancelButtonText: 'Cancelar',
    confirmButtonColor: colorBoton,
    cancelButtonColor: '#8e8e93',
    reverseButtons: true,
    focusCancel: true
  }).then((result) => {
    if (result.isConfirmed) {
      cambiarModoApp(target, false);
      const Toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: false
      });
      Toast.fire({
        icon: 'success',
        title: `Modo activo: ${nombreDestino}`
      });
    }
  });
}

export function cambiarModoApp(modo, esCargaInicial = false) {
  const modoAnterior = modoAppActual;
  if (!esCargaInicial && modoAnterior !== modo) {
    saveFormData(modoAnterior);
  }
  modoAppActual = modo;
  window.modoAppActual = modo;
  document.body.setAttribute('data-modo', modo);
  try { localStorage.setItem('modoAppActual', modo); } catch(e) {}
  if (!esCargaInicial && modoAnterior !== modo) {
    loadFormData(modo, true);
  }

  // 1. Elementos del Switcher Superior Izquierdo (Desktop)
  const headerTitulo = document.getElementById('headerTituloFormulario');
  const headerBadge = document.getElementById('headerBadgeFormulario');
  const optEpi = document.getElementById('optSwitchEpi');
  const optSppat = document.getElementById('optSwitchSppat');

  // 2. Elementos del Switcher en Móvil
  const mobileTitulo = document.getElementById('mobileTituloFormulario');
  const mobileBadge = document.getElementById('mobileBadgeModo');
  const mobileIconWrap = document.getElementById('mobileModeIconWrap');

  // 3. Encabezados de tarjetas adaptables
  const txtTituloUnidad = document.getElementById('txtTituloUnidadCard');
  const txtTituloIdent = document.getElementById('txtTituloIdentificacion');

  // 4. Contenedores y botones
  const contEpi = document.getElementById('contenedorEpiTb');
  const contSppat = document.getElementById('contenedorSppat');
  const btnExportHeader = document.getElementById('btnExportarHeader');
  const btnGenPdfBottom = document.getElementById('btnGenerarPdfBottom');
  const btnGenExcelBottom = document.getElementById('btnGenerarExcelBottom');
  const btnGenSppatBottom = document.getElementById('btnGenerarSppatBottom');

  if (modo === 'sppat') {
    // Switcher Superior Izquierdo
    if (headerTitulo) headerTitulo.innerText = 'Expediente SPPAT';
    if (headerBadge) {
      headerBadge.innerText = 'SPPAT / EMERGENCIA';
      headerBadge.className = 'badge-form-mode badge-sppat';
    }
    if (optEpi) optEpi.classList.remove('active');
    if (optSppat) optSppat.classList.add('active');

    // Switcher Móvil
    if (mobileTitulo) mobileTitulo.innerText = 'Expediente SPPAT';
    if (mobileBadge) {
      mobileBadge.innerText = 'SPPAT / EMERGENCIA';
      mobileBadge.className = 'badge-form-mode badge-sppat';
    }
    if (mobileIconWrap) {
      mobileIconWrap.className = 'mobile-switcher-icon-wrap icon-sppat';
      mobileIconWrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m4.93 4.93 4.24 4.24"></path><path d="m14.83 9.17 4.24-4.24"></path><path d="m14.83 14.83 4.24 4.24"></path><path d="m9.17 14.83-4.24 4.24"></path><circle cx="12" cy="4" r="2"></circle></svg>`;
    }

    // Títulos de tarjetas
    if (txtTituloUnidad) txtTituloUnidad.innerText = 'Establecimiento de Salud (Emergencia SPPAT)';
    if (txtTituloIdent) txtTituloIdent.innerText = 'Datos del Paciente / Accidentado';

    // Visibilidad de secciones
    if (contEpi) contEpi.style.display = 'none';
    if (contSppat) contSppat.style.display = 'block';

    if (btnExportHeader) {
      btnExportHeader.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Exportar SPPAT
      `;
      btnExportHeader.setAttribute('title', 'Generar expediente oficial SPPAT');
    }
    if (btnGenPdfBottom) btnGenPdfBottom.style.display = 'none';
    if (btnGenExcelBottom) btnGenExcelBottom.style.display = 'none';
    if (btnGenSppatBottom) btnGenSppatBottom.style.display = 'flex';

    sincronizarChipsRx();
  } else {
    // Switcher Superior Izquierdo
    if (headerTitulo) headerTitulo.innerText = 'Fichas EPI';
    if (headerBadge) {
      headerBadge.innerText = 'EPI / TB';
      headerBadge.className = 'badge-form-mode badge-epi';
    }
    if (optEpi) optEpi.classList.add('active');
    if (optSppat) optSppat.classList.remove('active');

    // Switcher Móvil
    if (mobileTitulo) mobileTitulo.innerText = 'Fichas EPI';
    if (mobileBadge) {
      mobileBadge.innerText = 'EPI / TB';
      mobileBadge.className = 'badge-form-mode badge-epi';
    }
    if (mobileIconWrap) {
      mobileIconWrap.className = 'mobile-switcher-icon-wrap icon-epi';
      mobileIconWrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    }

    // Títulos de tarjetas
    if (txtTituloUnidad) txtTituloUnidad.innerText = 'Unidad Notificadora';
    if (txtTituloIdent) txtTituloIdent.innerText = 'Identificación y Datos del Paciente';

    // Visibilidad de secciones
    if (contEpi) contEpi.style.display = 'block';
    if (contSppat) contSppat.style.display = 'none';

    if (btnExportHeader) {
      btnExportHeader.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Exportar PDF
      `;
      btnExportHeader.setAttribute('title', 'Descargar Ficha Epidemiológica');
    }
    if (btnGenPdfBottom) btnGenPdfBottom.style.display = 'flex';
    if (btnGenExcelBottom) btnGenExcelBottom.style.display = 'flex';
    if (btnGenSppatBottom) btnGenSppatBottom.style.display = 'none';
  }
}

export async function ejecutarExportarHeader() {
  if (modoAppActual === 'sppat') {
    await descargarExpedienteSppat();
  } else {
    await descargarFichaSegura('pdf', false);
  }
}

export function actualizarTipoEventoSppat() {
  const secDetalles = document.getElementById('seccionDetallesAccidente');
  if (secDetalles) secDetalles.style.display = 'block';
}

export function alternarEstudioRx(chipBtn, estudio) {
  const inputRx = document.getElementById('sppat_rx_estudio');
  if (!inputRx) return;
  const target = (estudio || chipBtn?.getAttribute('data-estudio') || '').trim();
  if (!target) return;

  const targetCodigoMatch = target.match(/\b\d{5}\b/);
  const targetCodigo = targetCodigoMatch ? targetCodigoMatch[0] : null;
  const targetDesc = target.replace(/^\d{5}\s*[-–—]\s*/, '').trim().toUpperCase();

  let items = inputRx.value
    .split(/[\/,;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Comprobar si ya existe por código o por texto descriptivo
  const index = items.findIndex(item => {
    if (targetCodigo && item.includes(targetCodigo)) return true;
    const itemDesc = item.replace(/^\d{5}\s*[-–—]\s*/, '').trim().toUpperCase();
    return (targetDesc.length >= 4 && itemDesc === targetDesc) || item.toUpperCase() === target.toUpperCase();
  });

  if (index >= 0) {
    // Si ya existe, se remueve completamente (toggle OFF)
    items.splice(index, 1);
  } else {
    // Si no existe, se añade una sola vez (toggle ON)
    items.push(target);
  }

  // Deduplicación estricta por código o nombre
  const listaUnica = [];
  const clavesVistas = new Set();
  for (const item of items) {
    const codMatch = item.match(/\b\d{5}\b/);
    const key = codMatch ? codMatch[0] : item.toUpperCase().trim();
    if (!clavesVistas.has(key)) {
      clavesVistas.add(key);
      listaUnica.push(item);
    }
  }

  inputRx.value = listaUnica.join(' / ');
  inputRx.dispatchEvent(new Event('input', { bubbles: true }));
  inputRx.dispatchEvent(new Event('change', { bubbles: true }));
  sincronizarChipsRx();
}

export function sincronizarChipsRx() {
  const inputRx = document.getElementById('sppat_rx_estudio');
  const valor = (inputRx?.value || '').toUpperCase();
  const chips = document.querySelectorAll('.btn-chip-rx');

  chips.forEach(chip => {
    const estudio = (chip.getAttribute('data-estudio') || chip.getAttribute('onclick') || '').toUpperCase();
    const codigoMatch = estudio.match(/\d{5}/);
    const codigo = codigoMatch ? codigoMatch[0] : null;

    let activo = false;
    if (codigo && valor.includes(codigo)) {
      activo = true;
    } else {
      const textoBuscado = chip.textContent.replace('+', '').replace('Rx', '').replace('✓', '').trim().toUpperCase();
      if (textoBuscado.length >= 3 && valor.includes(textoBuscado)) {
        activo = true;
      }
    }

    if (activo) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}



export function alternarQuienFirmaSppat(quien) {
  const secAcom = document.getElementById('seccionAcompananteSppat');
  const esRep = (quien === 'REPRESENTANTE');

  if (secAcom) {
    secAcom.style.display = esRep ? 'block' : 'none';
  }

  const rPx = document.getElementById('sppat_firma_px');
  const rRep = document.getElementById('sppat_firma_rep');
  if (rPx && rRep) {
    if (esRep) rRep.checked = true;
    else rPx.checked = true;
  }

  if (esRep) {
    const nomAcom = document.getElementById('sppat_acom_nombre');
    if (nomAcom && !nomAcom.value) nomAcom.focus();
  }
}



export function seleccionarObservacionEntrega(obs) {
  const input = document.getElementById('sppat_observaciones_entrega');
  if (input) {
    input.value = obs;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export async function descargarExpedienteSppat() {
  const cedula = (document.getElementById('cedula')?.value || '').trim();
  const apellido = (document.getElementById('primer_apellido')?.value || '').trim();
  const nombre = (document.getElementById('primer_nombre')?.value || '').trim();

  if (!cedula && !apellido && !nombre) {
    Swal.fire({
      icon: 'warning',
      title: 'Datos del Paciente Requeridos',
      text: 'Por favor complete al menos la Cédula y Nombres del paciente en la sección superior antes de generar el expediente.',
      confirmButtonColor: 'var(--apple-blue)'
    });
    return;
  }

  try {
    mostrarLoader("Compilando expediente oficial SPPAT (6 documentos)...");
    const datos = recopilarDatosSppat();
    const { blob, fileName } = await generarExpedienteSppatBlob(datos);
    ocultarLoader();

    // Descarga segura multiplataforma
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);

    Swal.fire({
      icon: 'success',
      title: '¡Expediente Generado con Éxito!',
      html: `Se descargó <b>${fileName}</b>.<br><br>Incluye <b>6 documentos</b> en el orden reglamentario del hospital:<br>` +
            `<ol class="text-start small ps-4 mt-2">` +
            `<li>Autorización al Hospital</li>` +
            `<li>Consentimiento Informado (Form. 024 - Pág. 2)</li>` +
            `<li>Acta Entrega-Recepción Servicios</li>` +
            `<li>Formulario Único Reclamación SPPAT</li>` +
            `<li>Formulario 008 Emergencia</li>` +
            `<li>Formulario 012A Rayos X</li>` +
            `</ol>`,
      confirmButtonColor: 'var(--apple-blue)'
    });
  } catch (err) {
    ocultarLoader();
    console.error('Error generando SPPAT:', err);
    Swal.fire({
      icon: 'error',
      title: 'Error al generar expediente',
      text: err.message || 'Ocurrió un error inesperado al estampar las plantillas oficiales.',
      confirmButtonColor: 'var(--apple-blue)'
    });
  }
}

// Configuración de autocompletado de médicos (independiente entre EPI y SPPAT)
function inicializarModuloMedicos() {
  const alSeleccionarMedicoEpi = (medico) => {
    const elMedTrat = document.getElementById('medico_tratante');
    const elTbResp = document.getElementById('tb_responsable');
    if (elMedTrat) elMedTrat.value = medico.nombreCompleto;
    if (elTbResp) elTbResp.value = medico.nombreCompleto;
  };

  const alSeleccionarMedicoSppat = (medico) => {
    const elSppatNom = document.getElementById('sppat_medico_nombre');
    const elSppatCed = document.getElementById('sppat_medico_cedula');
    const elSppatEsp = document.getElementById('sppat_medico_esp');
    if (elSppatNom) elSppatNom.value = medico.nombreCompleto;
    if (elSppatCed) elSppatCed.value = medico.cedula || medico.registroMsp || '';
    if (elSppatEsp) elSppatEsp.value = medico.especialidad || 'MEDICO RESIDENTE';
  };

  configurarAutocompletadoMedicos('medico_tratante', { onSelect: alSeleccionarMedicoEpi });
  configurarAutocompletadoMedicos('sppat_medico_nombre', { onSelect: alSeleccionarMedicoSppat });

  // Auto-aprendizaje al perder el foco (blur)
  const guardarMedicoSilencioso = (esSppatField) => {
    if (esSppatField) {
      const nom = (document.getElementById('sppat_medico_nombre')?.value || '').trim();
      const ced = (document.getElementById('sppat_medico_cedula')?.value || '').trim();
      const esp = (document.getElementById('sppat_medico_esp')?.value || 'MEDICO RESIDENTE').trim();
      if (nom.length >= 5 || ced.length >= 7) {
        registrarOActualizarMedico({ nombreCompleto: nom, cedula: ced, registroMsp: ced, especialidad: esp });
      }
    } else {
      const nom = (document.getElementById('medico_tratante')?.value || '').trim();
      if (nom.length >= 5) {
        registrarOActualizarMedico({ nombreCompleto: nom });
      }
    }
  };

  ['sppat_medico_nombre', 'sppat_medico_cedula', 'sppat_medico_esp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', () => guardarMedicoSilencioso(true));
  });
  const elMedEpi = document.getElementById('medico_tratante');
  if (elMedEpi) elMedEpi.addEventListener('blur', () => guardarMedicoSilencioso(false));

  const rxInput = document.getElementById('sppat_rx_estudio');
  if (rxInput) {
    rxInput.addEventListener('input', sincronizarChipsRx);
    rxInput.addEventListener('change', sincronizarChipsRx);
  }

  setTimeout(() => {
    actualizarTipoEventoSppat();
    sincronizarChipsRx();
  }, 100);
}

// Inicializar al cargar el DOM
const initAppModoYMedicos = () => {
  inicializarModuloMedicos();
  cambiarModoApp(modoAppActual, true);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppModoYMedicos);
} else {
  initAppModoYMedicos();
}

// Exponer funciones al objeto global window para botones HTML onclick
window.cambiarModoApp = cambiarModoApp;
window.alternarModoApp = alternarModoApp;
window.abrirModalCambiarFormulario = abrirModalCambiarFormulario;
window.solicitarCambioModo = abrirModalCambiarFormulario;
window.descargarExpedienteSppat = descargarExpedienteSppat;
window.ejecutarExportarHeader = ejecutarExportarHeader;
window.actualizarTipoEventoSppat = actualizarTipoEventoSppat;
window.agregarEstudioRx = alternarEstudioRx;
window.alternarEstudioRx = alternarEstudioRx;
window.sincronizarChipsRx = sincronizarChipsRx;
window.abrirGestionMedicos = abrirGestionMedicos;
window.alternarQuienFirmaSppat = alternarQuienFirmaSppat;
window.seleccionarObservacionEntrega = seleccionarObservacionEntrega;
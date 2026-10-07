// ==========================================
// FUNCIÓN DE FOCO INTELIGENTE PARA ALERTAS (Fix 3: Scroll Seguro y Preciso)
// ==========================================
function enfocarElementoSeguro(elemento) {
  if (!elemento) return;
  const headerOffset = document.querySelector('.glass-header') ? document.querySelector('.glass-header').offsetHeight : 0;
  const acordeon = elemento.closest('.accordion-collapse');
  
  const hacerScroll = () => {
      setTimeout(() => {
          const rect = elemento.getBoundingClientRect();
          const absoluteTop = window.scrollY + rect.top;
          window.scrollTo({ top: Math.max(0, absoluteTop - headerOffset - 20), behavior: 'smooth' });
          
          setTimeout(() => {
              elemento.focus({ preventScroll: true }); 
          }, 150); 
      }, 400); 
  };

  if (acordeon && !acordeon.classList.contains('show')) {
      const bsCollapse = new bootstrap.Collapse(acordeon, { toggle: false });
      bsCollapse.show();
      acordeon.addEventListener('shown.bs.collapse', hacerScroll, { once: true });
  } else {
      hacerScroll();
  }
}

// ==========================================
// FUNCIONES DE SOPORTE PARA BLOQUES DESACTIVADOS (NUEVA UNIFICACIÓN)
// ==========================================
function toggleElementos(elementos, habilitar) {
  const iterables = Array.isArray(elementos) || elementos instanceof NodeList ? elementos : [elementos];
  iterables.forEach(el => {
    if (!el) return;
    el.disabled = !habilitar;
    const parent = el.closest('.form-check') || el.closest('[class*="col-"]');
    if (parent) {
      habilitar ? parent.classList.remove('disabled-block') : parent.classList.add('disabled-block');
    }
  });
}

// ==========================================
// INYECCIÓN DINÁMICA DE SÍNTOMAS Y VACUNAS
// ==========================================
const dbSintomas = {
resp: [
  { id: 'tos', label: 'Tos' }, { id: 'dolor_garganta', label: 'Dolor garganta' },
  { id: 'dif_respiratoria', label: 'Dificultad respiratoria' }, { id: 'cianosis', label: 'Cianosis' },
  { id: 'diarrea', label: 'Diarrea' }, { id: 'nauseas', label: 'Náuseas / Vómitos' },
  { id: 'dolor_abdominal', label: 'Dolor abdominal' }, { id: 'deshidratacion', label: 'Deshidratación' },
  { id: 'ictericia', label: 'Ictericia' }, { id: 'anorexia', label: 'Anorexia' }
],
gen: [
  { id: 'fiebre', label: 'Fiebre' }, { id: 'cefalea', label: 'Cefalea' },
  { id: 'escalofrios', label: 'Escalofríos' }, { id: 'mialgias', label: 'Mialgias' },
  { id: 'artralgia', label: 'Artralgia' }, { id: 'sudoracion', label: 'Sudoración nocturna' },
  { id: 'sangrados', label: 'Sangrados' }, { id: 'erupcion', label: 'Erupción / Exantema' },
  { id: 'prurito', label: 'Prurito' }, { id: 'adenopatias', label: 'Adenopatías' }
],
neuro: [
  { id: 'convulsiones', label: 'Convulsiones' }, { id: 'alt_neuro_central', label: 'Alteración Neuro Central' },
  { id: 'alt_neuro_periferico', label: 'Alteración Neuro Periférica' }, { id: 'vision_borrosa', label: 'Visión borrosa' },
  { id: 'rigidez', label: 'Rigidez muscular' }, { id: 'espasmo', label: 'Espasmo muscular' }
],
baja: [
  { id: 'apnea', label: 'Apnea' }, { id: 'ascitis', label: 'Ascitis' },
  { id: 'paralisis', label: 'Parálisis' }, { id: 'estridor', label: 'Estridor respiratorio' },
  { id: 'oncocercomas', label: 'Oncocercomas' }, { id: 'trismus', label: 'Trismus' }
]
};

const dbVacunas = [
{ id: 'bcg', label: 'BCG' }, { id: 'hb', label: 'HB' }, { id: 'rota', label: 'Rota' },
{ id: 'opv', label: 'OPV' }, { id: 'penta', label: 'Penta' }, { id: 'influenza', label: 'Influenza' },
{ id: 'neumococo_conj', label: 'Neumo. Conj.' }, { id: 'sr', label: 'SR' }, { id: 'fa', label: 'FA' },
{ id: 'dt', label: 'DT' }, { id: 'dpt', label: 'DPT' }, { id: 'dt_adulto', label: 'dT' },
{ id: 'srp', label: 'SRP' }, { id: 'varicela', label: 'Varicela' }, { id: 'neumococo_poli', label: 'Neumo. Poli.' }
];

function inicializarCheckboxes() {
const generarHTML = (arr, claseExtra, disabled = false) => arr.map(item => `
  <div class="${claseExtra.includes('chk-vac') ? 'col-6 col-md-2' : 'form-check'}" ${disabled ? 'class="disabled-block"' : ''}>
    ${claseExtra.includes('chk-vac') ? '<div class="form-check">' : ''}
    <input class="form-check-input ${claseExtra} save-state" type="checkbox" id="${item.id}" ${disabled ? 'disabled' : ''}>
    <label class="form-check-label" for="${item.id}">${item.label}</label>
    ${claseExtra.includes('chk-vac') ? '</div>' : ''}
  </div>
`).join('');

document.getElementById('cont-sint-resp').insertAdjacentHTML('beforeend', generarHTML(dbSintomas.resp, 'chk-sin'));
document.getElementById('cont-sint-gen').insertAdjacentHTML('beforeend', generarHTML(dbSintomas.gen, 'chk-sin'));
document.getElementById('cont-sint-neuro').insertAdjacentHTML('beforeend', generarHTML(dbSintomas.neuro, 'chk-sin'));
document.getElementById('cont-sint-baja').insertAdjacentHTML('beforeend', generarHTML(dbSintomas.baja, 'chk-sin'));
document.getElementById('cont-vacunas').insertAdjacentHTML('beforeend', generarHTML(dbVacunas, 'chk-vac', true));
}
inicializarCheckboxes();

const API_URL = "https://script.google.com/macros/s/AKfycbxT7ozOahA31entb9M017m8Z9nKFfnmsR1HhHmPHzYKsNj5lQv-4HBWnEP65LA2g_Owqw/exec";
const counterUrl = 'https://api.counterapi.dev/v1/fichasepi_jhojann_v1/generadas'; 
let catData = null;
let saveTimeout;
let tomSelectCie10 = null;

const etniaOpciones = {
MASCULINO: ["MESTIZO", "BLANCO", "AFROECUATORIANO", "INDÍGENA", "MONTUBIO", "OTRO"],
FEMENINO: ["MESTIZA", "BLANCA", "AFROECUATORIANA", "INDÍGENA", "MONTUBIA", "OTRA"]
};
const civilOpciones = {
MASCULINO: ["SOLTERO", "CASADO", "UNIÓN LIBRE", "DIVORCIADO", "VIUDO"],
FEMENINO: ["SOLTERA", "CASADA", "UNIÓN LIBRE", "DIVORCIADA", "VIUDA"]
};

document.getElementById('devSignature').addEventListener('dblclick', async () => {
  try {
    mostrarLoader("Consultando base de datos...");
    
    // Consultamos DIRECTAMENTE a tu Google Apps Script
    const urlStats = API_URL + "?action=stats";
    const res = await fetch(urlStats);
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);

    const totalGlobal = data.totalGlobal || 0;
    let htmlExtra = "";
    
    // Si hay datos por establecimiento, creamos una lista detallada
    if (data.porEstablecimiento && Object.keys(data.porEstablecimiento).length > 0) {
      
      // Convertir el objeto a array y ordenarlo de mayor a menor cantidad de fichas
      const establecimientosArray = Object.entries(data.porEstablecimiento)
                                        .sort((a, b) => b[1] - a[1]);
      
      htmlExtra = `
        <div style="margin-top: 15px; max-height: 250px; overflow-y: auto; text-align: left; background: var(--apple-subcard-bg); border-radius: 12px; padding: 10px; border: 1px solid var(--apple-border);">
          <table style="width: 100%; font-size: 0.9rem;">
            <tbody>
      `;
      
      establecimientosArray.forEach(([nombre, cantidad]) => {
        htmlExtra += `
              <tr style="border-bottom: 1px solid var(--apple-border);">
                <td style="padding: 8px 4px; color: var(--apple-text);">${nombre}</td>
                <td style="padding: 8px 4px; text-align: right; font-weight: bold; color: var(--apple-blue); white-space: nowrap;">${cantidad} fichas</td>
              </tr>
        `;
      });
      
      htmlExtra += `
            </tbody>
          </table>
        </div>
      `;
    } else {
      htmlExtra = `<br><br><small style="color: gray;">Aún no hay registros detallados por establecimiento.</small>`;
    }

    ocultarLoader();
    Swal.fire({
      title: '📊 Estadísticas Reales', 
      html: `Total Global (Todas las unidades): <b style="font-size: 1.2rem; color: var(--apple-blue);">${totalGlobal}</b>${htmlExtra}`, 
      icon: 'info',
      confirmButtonColor: 'var(--apple-blue)',
      width: '600px' // Hacemos la alerta un poco más ancha para que la tabla se vea bien
    });
  } catch(err) {
    ocultarLoader();
    Swal.fire('Error', 'Hubo un problema consultando el registro de Google Sheets.', 'error');
  }
});

// --- MODO OSCURO ---
const themeToggleBtn = document.getElementById('themeToggle');
const moonIcon = document.getElementById('moonIcon');
const sunIcon = document.getElementById('sunIcon');
const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
if (currentTheme === 'dark') {
document.documentElement.setAttribute('data-theme', 'dark');
moonIcon.style.display = 'none'; sunIcon.style.display = 'block';
}
themeToggleBtn.addEventListener('click', () => {
let theme = document.documentElement.getAttribute('data-theme');
if (theme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.setItem('theme', 'light');
  moonIcon.style.display = 'block'; sunIcon.style.display = 'none';
} else {
  document.documentElement.setAttribute('data-theme', 'dark');
  localStorage.setItem('theme', 'dark');
  moonIcon.style.display = 'none'; sunIcon.style.display = 'block';
}
});

function actualizarEstadoEmbarazo() {
const sexo = document.getElementById('sexo').value;
const embSelect = document.getElementById('embarazada');
const semInput = document.getElementById('semanas_gestacion');

if (sexo === 'MASCULINO') {
  toggleElementos([embSelect], false);
  embSelect.value = 'NO';
  toggleElementos([semInput], false);
  semInput.value = '';
} else {
  toggleElementos([embSelect], true);
  if (embSelect.value === 'SI') {
    toggleElementos([semInput], true);
  } else {
    toggleElementos([semInput], false);
    semInput.value = '';
  }
}
}

// --- AUTOGUARDADO ---
function saveFormData() {
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

function loadFormData() {
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
  
  // Validar campos de laboratorio
  if (data.muestra === 'NO') {
      toggleLaboratorio(false);
  } else {
      toggleLaboratorio(true);
  }

  const tbody = document.getElementById('contactsBody');
  tbody.innerHTML = '';
  if (data.contactos && data.contactos.length > 0) {
    data.contactos.forEach((c, index) => agregarContactoRestaurado(c, index === 0));
  } else {
    for (let i = 0; i < 1; i++) agregarContacto();
  }
} catch(e) {
  for (let i = 0; i < 1; i++) agregarContacto();
}
}

function setUnidadPredeterminada() {
const instSelect = document.getElementById('institucion');
const estabSelect = document.getElementById('establecimiento');
if (!instSelect || !estabSelect) return;
const instOpt = Array.from(instSelect.options).find(o => o.value.toUpperCase().includes("INSTITUTO ECUATORIANO DE SEGURIDAD SOCIAL") || o.value.toUpperCase() === "IESS");
if (instOpt) {
  instSelect.value = instOpt.value;
  instSelect.dispatchEvent(new Event('change')); 
  const estabOpt = Array.from(estabSelect.options).find(o => {
    const val = o.value.toUpperCase();
    return val.includes("PORTOVIEJO") && val.includes("GENERAL") && !val.includes("CENTRO") && !val.includes("TIPO B");
  });
  if (estabOpt) {
    estabSelect.value = estabOpt.value;
    estabSelect.dispatchEvent(new Event('change'));
  }
}
}

function limpiarFormulario() {
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
    
    if (tomSelectCie10) tomSelectCie10.clear();
    document.getElementById('exp_ninguno').checked = true;
    toggleExposicion(true);
    
    document.getElementById('contactsBody').innerHTML = '';
    for (let i = 0; i < 1; i++) agregarContacto();
    
    setUnidadPredeterminada(); saveFormData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});
}

function setupAutoSave() {
document.getElementById('epiForm').addEventListener('input', () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveFormData, 1000);
});
document.getElementById('epiForm').addEventListener('change', () => saveFormData());
}

document.addEventListener('input', function(e) {
if (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'textarea')) {
  if (!e.target.classList.contains('decimal-input')) {
      let start = e.target.selectionStart;
      let end = e.target.selectionEnd;
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
  if (/[^\d.,]/.test(val)) {
    e.target.value = val.replace(/[^\d.,]/g, '');
  }
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

function actualizarGeneroDropdowns() {
const sexo = document.getElementById('sexo').value;
const civil = document.getElementById('estado_civil');
const etnia = document.getElementById('etnia');

civil.innerHTML = '<option value="" selected disabled>Seleccione...</option>';
etnia.innerHTML = '<option value="" selected disabled>Seleccione...</option>';

if (sexo && civilOpciones[sexo]) {
  const fragCivil = document.createDocumentFragment();
  civilOpciones[sexo].forEach(o => fragCivil.appendChild(new Option(o, o)));
  civil.appendChild(fragCivil);
  
  const fragEtnia = document.createDocumentFragment();
  etniaOpciones[sexo].forEach(o => fragEtnia.appendChild(new Option(o, o)));
  etnia.appendChild(fragEtnia);
}
}

function toggleTratamientoCampos() {
const isSi = document.getElementById('recibio_tratamiento').value === 'SI';
toggleElementos([
  document.getElementById('especificar_tratamiento'),
  document.getElementById('evolucion'),
  document.getElementById('lugar_tratamiento'),
  document.getElementById('asistio_controles')
], isSi);

if (!isSi) {
  document.getElementById('especificar_tratamiento').value = '';
  document.getElementById('evolucion').value = '';
  document.getElementById('lugar_tratamiento').value = '';
  document.getElementById('asistio_controles').value = '';
}
toggleControlesCampos();
}

function toggleControlesCampos() {
const isSi = (document.getElementById('recibio_tratamiento').value === 'SI' && document.getElementById('asistio_controles').value === 'SI');
toggleElementos([document.getElementById('cuantos_controles')], isSi);
if (!isSi) document.getElementById('cuantos_controles').value = '';
}

function toggleExposicion(isNinguno) {
toggleElementos(document.querySelectorAll('.chk-exp'), !isNinguno);
toggleElementos(document.querySelectorAll('.d-exp'), !isNinguno);

if (isNinguno) {
  document.querySelectorAll('.chk-exp').forEach(chk => chk.checked = false);
  document.querySelectorAll('.d-exp').forEach(inp => {
    if (inp.type === 'radio') inp.checked = false;
    else inp.value = '';
  });
}
toggleElementos([document.getElementById('exp_otros')], !isNinguno);
if (isNinguno) document.getElementById('exp_otros').value = '';

toggleElementos([document.getElementById('tipo_exposicion_otro')], false);
document.getElementById('tipo_exposicion_otro').value = '';
validarProcedenciaAgua();
}

function validarProcedenciaAgua() {
const isNinguno = document.getElementById('exp_ninguno').checked;
const agua = document.getElementById('exp_agua_suelo').checked;
const alimentos = document.getElementById('exp_alimentos').checked;
const habilitar = !isNinguno && (agua || alimentos);

toggleElementos(document.querySelectorAll('.rad-proc'), habilitar);
if (!habilitar) document.querySelectorAll('.rad-proc').forEach(r => r.checked = false);

const otroChecked = document.getElementById('proc_otro')?.checked;
const inpOtro = document.getElementById('procedencia_agua_otro');
toggleElementos([inpOtro], habilitar && otroChecked);
if (!habilitar || !otroChecked) inpOtro.value = '';
}

function toggleDondeEnfermos(val) {
const isSi = (val === 'SI');
toggleElementos(document.querySelectorAll('.rad-donde'), isSi);
if (!isSi) document.querySelectorAll('.rad-donde').forEach(r => r.checked = false);
}

// Nueva función para deshabilitar campos de laboratorio
function toggleLaboratorio(habilitar) {
  const camposLab = [
    document.getElementById('fecha_muestra'),
    document.getElementById('muestra_adecuada'),
    document.getElementById('tipo_muestra'),
    document.getElementById('tecnica'),
    document.getElementById('antes_tratamiento'),
    document.getElementById('resultado'),
    document.getElementById('agente')
  ];
  
  toggleElementos(camposLab, habilitar);
  
  if (!habilitar) {
      camposLab.forEach(campo => {
          if (campo) campo.value = '';
      });
  }
}

document.addEventListener('DOMContentLoaded', () => {
toggleExposicion(document.getElementById('exp_ninguno').checked);

mostrarLoader("Cargando base de datos del hospital...");

  const controllerInit = new AbortController();
  const timeoutInit = setTimeout(() => controllerInit.abort(), 15000); 

  fetch(API_URL, { signal: controllerInit.signal })
  .then(response => {
    clearTimeout(timeoutInit);
    return response.text();
  })
  .then(dataStr => {
    try { initData(dataStr); } catch (err) {
      ocultarLoader();
      document.body.innerHTML = `<div class="container mt-5 text-center"><h3 class="text-danger">⚠️ Error de comunicación</h3><textarea class="form-control" style="height: 300px; font-size: 12px;">${dataStr}</textarea></div>`;
    }
  })
  .catch(err => {
    ocultarLoader();
    if (err.name === 'AbortError') {
      Swal.fire('Conexión lenta', 'La base de datos del hospital tardó demasiado en cargar. Recarga la página por favor.', 'error');
    } else {
      Swal.fire('Error', 'Error de red: ' + err, 'error');
    }
  });

setupAutoSave();

function bindCascadeAlert(childId, parentId, msg) {
  const child = document.getElementById(childId);
  if (child) {
    let startY = 0;
    child.addEventListener('touchstart', function(e) {
      startY = e.touches[0].clientY;
    }, {passive: true});

    const checkFn = function(e) {
      if (e.type === 'touchend') {
        const endY = e.changedTouches[0].clientY;
        if (Math.abs(endY - startY) >= 10) return; 
      }
      const parent = document.getElementById(parentId);
      if (parent && !parent.value) {
        e.preventDefault();
        child.blur();
        Swal.fire({icon: 'warning', title: 'Acción requerida', text: msg, confirmButtonColor: 'var(--apple-blue)'})
        .then(() => enfocarElementoSeguro(parent)); 
      }
    };
    
    child.addEventListener('mousedown', checkFn);
    child.addEventListener('touchend', checkFn, {passive: false});
  }
}

bindCascadeAlert('establecimiento', 'institucion', 'Primero debe seleccionar una Institución.');
bindCascadeAlert('canton_residencia', 'prov_residencia', 'Primero debe seleccionar la Provincia de Residencia.');
bindCascadeAlert('parroquia_residencia', 'canton_residencia', 'Primero debe seleccionar el Cantón de Residencia.');
bindCascadeAlert('estado_civil', 'sexo', 'Primero debe seleccionar el Sexo del paciente.');
bindCascadeAlert('etnia', 'sexo', 'Primero debe seleccionar el Sexo del paciente.');

const tablaContactos = document.getElementById('tablaContactos');
if (tablaContactos) {
  let startY = 0;
  tablaContactos.addEventListener('touchstart', function(e) {
    startY = e.touches[0].clientY;
  }, {passive: true});
  
  const checkTablaFn = function(e) {
    if (e.type === 'touchend') {
      const endY = e.changedTouches[0].clientY;
      if (Math.abs(endY - startY) >= 10) return; 
    }
    if (e.target.classList.contains('c-relacion')) {
      const row = e.target.closest('tr');
      const sexoSel = row.querySelector('.c-sexo');
      if (sexoSel && !sexoSel.value) {
        e.preventDefault();
        e.target.blur();
        Swal.fire({icon: 'warning', title: 'Acción requerida', text: 'Primero debe seleccionar el Sexo del contacto.', confirmButtonColor: 'var(--apple-blue)'})
        .then(() => enfocarElementoSeguro(sexoSel)); 
      }
    }
  };
  tablaContactos.addEventListener('mousedown', checkTablaFn);
  tablaContactos.addEventListener('touchend', checkTablaFn, {passive: false});
}

const accordionContainer = document.getElementById('accordionFicha');
if (accordionContainer) {
  accordionContainer.addEventListener('shown.bs.collapse', function (e) {
    if (!e.target.classList.contains('accordion-collapse')) return; 
    
    const header = document.querySelector('.glass-header');
    const element = e.target.parentElement;
    const headerOffset = header ? header.offsetHeight : 0;
    const rect = element.getBoundingClientRect();
    
    window.scrollBy({ top: rect.top - headerOffset - 15, behavior: 'smooth' });
  });
}

document.getElementById('sec5').addEventListener('change', (e) => {
  if (e.target.classList.contains('chk-exp') && (e.target.id === 'exp_agua_suelo' || e.target.id === 'exp_alimentos')) validarProcedenciaAgua();
});

document.querySelectorAll('input[name="rad_procedencia"]').forEach(r => {
  r.addEventListener('change', (e) => {
    const inpOtro = document.getElementById('procedencia_agua_otro');
    toggleElementos([inpOtro], e.target.value === 'Otro');
    if (e.target.value === 'Otro') inpOtro.focus(); else inpOtro.value = '';
  });
});

document.querySelectorAll('input[name="rad_tipo_exp"]').forEach(r => {
  r.addEventListener('change', (e) => {
    const inpOtro = document.getElementById('tipo_exposicion_otro');
    toggleElementos([inpOtro], e.target.value === 'Otras');
    if (e.target.value === 'Otras') inpOtro.focus(); else inpOtro.value = '';
  });
});

document.getElementById('aplica_caracterizar_signos').addEventListener('change', (e) => {
  const isSi = (e.target.value === 'SI');
  toggleElementos([document.getElementById('caracterizar_signos')], isSi);
  if (!isSi) document.getElementById('caracterizar_signos').value = ''; else document.getElementById('caracterizar_signos').focus();
});

document.getElementById('sexo').addEventListener('change', () => { actualizarGeneroDropdowns(); actualizarEstadoEmbarazo(); });
document.getElementById('embarazada').addEventListener('change', () => actualizarEstadoEmbarazo());

['fecha_inicio_sintomas', 'fecha_sintoma_relevante', 'fecha_atencion'].forEach(id => {
  const element = document.getElementById(id);
  if (element) {
      element.addEventListener('change', calcDiasSintomas);
      element.addEventListener('input', calcDiasSintomas);
  }
});

document.getElementById('hospitalizado').addEventListener('change', e => {
  const isYes = e.target.value === 'SI';
  toggleElementos([
    document.getElementById('fecha_hosp'), document.getElementById('hc_hosp'), 
    document.getElementById('nombre_hospital'), document.getElementById('servicio_hosp'), document.getElementById('ingreso_uci')
  ], isYes);
  if(!isYes) {
    document.getElementById('fecha_hosp').value = ''; document.getElementById('hc_hosp').value = '';
    document.getElementById('nombre_hospital').value = ''; document.getElementById('servicio_hosp').value = '';
  }
});

document.querySelectorAll('input[name="cond_egreso"]').forEach(r => {
  r.addEventListener('change', e => {
    toggleElementos([document.getElementById('fecha_fallecimiento')], e.target.value !== 'VIVO');
    if (e.target.value === 'VIVO') document.getElementById('fecha_fallecimiento').value = '';
  });
});

document.getElementById('antecedente_vacunal').addEventListener('change', e => {
  const isSi = e.target.value === 'SI';
  toggleElementos(document.querySelectorAll('.vac-f'), isSi);
  toggleElementos(document.querySelectorAll('.chk-vac'), isSi);
  if(!isSi){
    document.querySelectorAll('.vac-f:not(select)').forEach(el => el.value = '');
    document.querySelectorAll('.chk-vac').forEach(el => el.checked = false);
  }
});

document.getElementById('realizo_viaje').addEventListener('change', e => {
  const isYes = e.target.value === 'SI';
  toggleElementos([document.getElementById('lugar_viaje'), document.getElementById('fecha_desde'), document.getElementById('fecha_hasta')], isYes);
  if (!isYes) { document.getElementById('lugar_viaje').value = ''; document.getElementById('fecha_desde').value = ''; document.getElementById('fecha_hasta').value = ''; }
});

document.getElementById('comorbilidades').addEventListener('change', e => {
  const isSi = e.target.value === 'SI';
  toggleElementos([document.getElementById('especificar_comor')], isSi);
  if (!isSi) document.getElementById('especificar_comor').value = '';
});

// Event listener para el campo 'muestra' (Laboratorio)
const selectMuestra = document.getElementById('muestra');
if (selectMuestra) {
    selectMuestra.addEventListener('change', e => {
        const isNO = e.target.value === 'NO';
        toggleLaboratorio(!isNO);
    });
}
});

function initData(dataStr) {
catData = JSON.parse(dataStr);
const instSelect = document.getElementById('institucion');
const fragInst = document.createDocumentFragment();
const optBaseInst = document.createElement('option');
optBaseInst.value = ""; optBaseInst.text = "Seleccione Institución...";
optBaseInst.selected = true; optBaseInst.disabled = true;
fragInst.appendChild(optBaseInst);

catData.instituciones_lista.forEach(i => {
  let opt = document.createElement('option'); opt.value = i; opt.text = i; fragInst.appendChild(opt);
});
instSelect.innerHTML = ""; instSelect.appendChild(fragInst);

instSelect.addEventListener('change', e => {
  const inst = e.target.value; const estabSelect = document.getElementById('establecimiento');
  document.getElementById('prov_establecimiento').value = ''; document.getElementById('canton_establecimiento').value = ''; document.getElementById('parroquia_establecimiento').value = '';
  const fragEstab = document.createDocumentFragment();
  let o = document.createElement('option'); o.value = ""; o.text = "Seleccione Establecimiento..."; o.selected = true; o.disabled = true;
  fragEstab.appendChild(o);
  if (inst && catData.unidades[inst]) {
    [...catData.unidades[inst]].sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach((u) => {
      let opt = document.createElement('option'); opt.value = u.nombre; opt.text = u.nombre; fragEstab.appendChild(opt);
    });
  }
  estabSelect.innerHTML = ""; estabSelect.appendChild(fragEstab);
});

document.getElementById('establecimiento').addEventListener('change', e => {
  const inst = document.getElementById('institucion').value;
  if (inst && e.target.value && catData.unidades[inst]) {
    const u = catData.unidades[inst].find(item => item.nombre === e.target.value);
    if (u) {
      document.getElementById('prov_establecimiento').value = u.provincia || "";
      document.getElementById('canton_establecimiento').value = u.canton || "";
      document.getElementById('parroquia_establecimiento').value = u.parroquia || "";
    }
  }
});

let provs = Object.keys(catData.ubicaciones);
const topProvs = ["MANABI", "SANTO DOMINGO DE LOS TSÁCHILAS", "GUAYAS", "LOS RÍOS", "SANTA ELENA"];
provs = provs.filter(p => !topProvs.includes(p)).sort();
topProvs.reverse().forEach(tp => { if (catData.ubicaciones[tp]) provs.unshift(tp); });

const provSelect = document.getElementById('prov_residencia');
const fragProv = document.createDocumentFragment();
let op = document.createElement('option'); op.value = ""; op.text = "Seleccione Provincia..."; op.selected = true; op.disabled = true;
fragProv.appendChild(op);
provs.forEach(p => { let opt = document.createElement('option'); opt.value = p; opt.text = p; fragProv.appendChild(opt); });
provSelect.innerHTML = ""; provSelect.appendChild(fragProv);

provSelect.addEventListener('change', e => fillCantones(e.target.value));
document.getElementById('canton_residencia').addEventListener('change', e => fillParroquias(provSelect.value, e.target.value));
document.getElementById('parroquia_residencia').addEventListener('change', e => {
  document.querySelectorAll('.c-dir').forEach(inp => { if (!inp.value) inp.value = e.target.value; });
});

const cieSelect = document.getElementById('diagnostico_cie10');
const fragCie = document.createDocumentFragment();
let optCieVacio = document.createElement('option'); optCieVacio.value = ""; optCieVacio.text = "Buscar diagnóstico..."; fragCie.appendChild(optCieVacio);

if (catData.cie10 && Array.isArray(catData.cie10)) {
  const topCIE = [
    "A90 - DENGUE CLASICO",
    "A91 - DENGUE HEMORRAGICO",
    "A90 - DENGUE CON SIGNOS DE ALARMA",
    "A90 - DENGUE SIN SIGNOS DE ALARMA",
    "A91 - DENGUE GRAVE",
    "A279 - LEPTOSPIROSIS NO ESPECIFICADA"
  ];
  topCIE.forEach(c => { 
    let opt = document.createElement('option'); opt.value = c; opt.text = c; fragCie.appendChild(opt); 
  });

  let cieFiltrado = catData.cie10.filter(c => {
    let cUp = c.toUpperCase(); 
    return !cUp.includes('DENGUE') && !cUp.includes('LEPTOSPIROSIS'); 
  }).sort();

  cieFiltrado.forEach(c => { 
    let opt = document.createElement('option'); opt.value = c; opt.text = c; fragCie.appendChild(opt); 
  });
}
cieSelect.innerHTML = ""; cieSelect.appendChild(fragCie);

const lugSelect = document.getElementById('lugar_tratamiento');
const fragLug = document.createDocumentFragment();
let optLug = document.createElement('option'); optLug.value = ""; optLug.text = "-- Seleccione --"; optLug.selected = true; fragLug.appendChild(optLug);
if (catData.lugares_tratamiento && catData.lugares_tratamiento.length > 0) {
  catData.lugares_tratamiento.forEach(lt => { let opt = document.createElement('option'); opt.value = lt; opt.text = lt; fragLug.appendChild(opt); });
}
lugSelect.innerHTML = ""; lugSelect.appendChild(fragLug);

loadFormData();

tomSelectCie10 = new TomSelect("#diagnostico_cie10", { 
  create: false, 
  maxOptions: null,
  onDropdownOpen: function() {
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        this.control.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }
  }
});

ocultarLoader();
}

function fillCantones(prov) {
const cantSelect = document.getElementById('canton_residencia');
document.getElementById('parroquia_residencia').innerHTML = '<option value="" selected disabled>Seleccione Parroquia...</option>';
if (!prov || !catData.ubicaciones[prov]) return;
let cantones = Object.keys(catData.ubicaciones[prov]);
const topCantons = ["PORTOVIEJO", "MANTA", "MONTECRISTI", "JARAMIJÓ", "ROCAFUERTE", "CHONE"];
cantones = cantones.filter(c => !topCantons.includes(c)).sort();
topCantons.reverse().forEach(tc => { if (catData.ubicaciones[prov][tc]) cantones.unshift(tc); });

const fragCant = document.createDocumentFragment();
let op = document.createElement('option'); op.value = ""; op.text = "Seleccione Cantón..."; op.selected = true; op.disabled = true; fragCant.appendChild(op);
cantones.forEach(c => { let opt = document.createElement('option'); opt.value = c; opt.text = c; fragCant.appendChild(opt); });
cantSelect.innerHTML = ""; cantSelect.appendChild(fragCant);
}

function fillParroquias(prov, canton) {
const parrSelect = document.getElementById('parroquia_residencia');
if (!prov || !canton || !catData.ubicaciones[prov][canton]) return;
const fragParr = document.createDocumentFragment();
let op = document.createElement('option'); op.value = ""; op.text = "Seleccione Parroquia..."; op.selected = true; op.disabled = true; fragParr.appendChild(op);
catData.ubicaciones[prov][canton].sort().forEach(p => { let opt = document.createElement('option'); opt.value = p; opt.text = p; fragParr.appendChild(opt); });
parrSelect.innerHTML = ""; parrSelect.appendChild(fragParr);
}

function calcDiasSintomas() {
  const ini = document.getElementById('fecha_inicio_sintomas').value || document.getElementById('fecha_sintoma_relevante').value;
  const ate = document.getElementById('fecha_atencion').value;
  const diasInput = document.getElementById('num_dias_sintomas');

  if (ini && ate) {
    const [y1, m1, d1] = ini.split('-');
    const [y2, m2, d2] = ate.split('-');
    const dateIni = new Date(y1, m1 - 1, d1);
    const dateAte = new Date(y2, m2 - 1, d2);
    
    const diff = dateAte - dateIni;
    const dias = Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
    
    diasInput.value = dias;
    diasInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function toggleContactoRow(trElement) {
if (window.innerWidth <= 768) {
  const isExpanded = trElement.classList.contains('expanded');
  document.querySelectorAll('#tablaContactos tbody tr').forEach(r => r.classList.remove('expanded'));
  if (!isExpanded) {
    trElement.classList.add('expanded');
  }
}
}

function updSummary(el) {
const tr = el.closest('tr');
const nom = tr.querySelector('.c-nombre').value.trim() || 'Nuevo Contacto';
const rel = tr.querySelector('.c-relacion').value || 'Sin relación';
const sumName = tr.querySelector('.sum-name');
const sumRel = tr.querySelector('.sum-rel');
if (sumName) sumName.textContent = nom;
if (sumRel) sumRel.textContent = rel;
}

function agregarContacto() {
const tbody = document.getElementById('contactsBody');

if (tbody.children.length >= 14) { 
  Swal.fire('Límite alcanzado', 'Se ha alcanzado el límite máximo de 14 contactos.', 'warning'); 
  return; 
}

const defaultParr = document.getElementById('parroquia_residencia') ? document.getElementById('parroquia_residencia').value : '';
const defVal = (defaultParr === 'Seleccione Parroquia...' || !defaultParr) ? '' : defaultParr;

const rowHTML = `
  <tr onclick="toggleContactoRow(this)">
    <td data-label="Nombre">
      <div class="contact-summary" style="display: none; pointer-events: none;">
        <span class="sum-name">Nuevo Contacto</span>&nbsp;-&nbsp;<span class="sum-rel">Sin relación</span>
      </div>
      <div class="contact-input-wrapper">
        <input type="text" class="form-control c-nombre save-state" style="font-size:0.85rem" oninput="updSummary(this)" onclick="event.stopPropagation()">
      </div>
    </td>
    <td data-label="Edad"><input type="number" class="form-control c-edad save-state numeric-input" style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
    <td data-label="Sexo">
      <select class="form-select c-sexo save-state" onchange="updRelacion(this)" style="font-size:0.85rem" onclick="event.stopPropagation()">
        <option value="" selected disabled>Sel</option>
        <option value="M">M</option>
        <option value="F">F</option>
      </select>
    </td>
    <td data-label="Relación">
      <select class="form-select c-relacion save-state" style="font-size:0.85rem" onchange="updSummary(this)" onclick="event.stopPropagation()"><option value="" selected disabled>Sel. Sexo</option></select>
    </td>
    <td data-label="Dirección/Teléf"><input type="text" class="form-control c-dir save-state" value="${defVal}" style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
    <td data-label="Lugar">
      <select class="form-select c-lugar save-state" style="font-size:0.85rem" onclick="event.stopPropagation()">
        <option value="CASA">CASA</option>
        <option value="TRABAJO">TRABAJO</option>
        <option value="ESCUELA">ESCUELA</option>
        <option value="OTRO">OTRO</option>
      </select>
    </td>
    <td data-label="¿Enfermó?">
      <select class="form-select c-enfermo save-state" onchange="updCont(this)" style="font-size:0.85rem" onclick="event.stopPropagation()">
        <option value="NO">NO</option>
        <option value="SI">SI</option>
      </select>
    </td>
    <td data-label="Fecha Sínt."><input type="date" class="form-control c-fecha save-state" disabled style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
    <td data-label="Observaciones"><input type="text" class="form-control c-obs save-state" disabled style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
  </tr>
`;
tbody.insertAdjacentHTML('beforeend', rowHTML);
const trs = tbody.querySelectorAll('tr');
toggleContactoRow(trs[trs.length - 1]);
}

function agregarContactoRestaurado(c, isFirst) {
const tbody = document.getElementById('contactsBody');
const rowHTML = `
  <tr class="${isFirst ? 'expanded' : ''}" onclick="toggleContactoRow(this)">
    <td data-label="Nombre">
      <div class="contact-summary" style="display: none; pointer-events: none;">
        <span class="sum-name">${c.nombre || 'Nuevo Contacto'}</span>&nbsp;-&nbsp;<span class="sum-rel">${c.relacion || 'Sin relación'}</span>
      </div>
      <div class="contact-input-wrapper">
        <input type="text" class="form-control c-nombre save-state" value="${c.nombre || ''}" style="font-size:0.85rem" oninput="updSummary(this)" onclick="event.stopPropagation()">
      </div>
    </td>
    <td data-label="Edad"><input type="number" class="form-control c-edad save-state numeric-input" value="${c.edad || ''}" style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
    <td data-label="Sexo">
      <select class="form-select c-sexo save-state" onchange="updRelacion(this)" style="font-size:0.85rem" onclick="event.stopPropagation()">
        <option value="" ${!c.sexo ? 'selected disabled' : ''}>Sel</option>
        <option value="M" ${c.sexo === 'M' ? 'selected' : ''}>M</option>
        <option value="F" ${c.sexo === 'F' ? 'selected' : ''}>F</option>
      </select>
    </td>
    <td data-label="Relación">
      <select class="form-select c-relacion save-state" style="font-size:0.85rem" onchange="updSummary(this)" onclick="event.stopPropagation()"><option value="" ${!c.relacion ? 'selected disabled' : ''}>Sel. Sexo</option></select>
    </td>
    <td data-label="Dirección/Teléf"><input type="text" class="form-control c-dir save-state" value="${c.dir || ''}" style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
    <td data-label="Lugar">
      <select class="form-select c-lugar save-state" style="font-size:0.85rem" onclick="event.stopPropagation()">
        <option value="CASA" ${c.lugar === 'CASA' ? 'selected' : ''}>CASA</option>
        <option value="TRABAJO" ${c.lugar === 'TRABAJO' ? 'selected' : ''}>TRABAJO</option>
        <option value="ESCUELA" ${c.lugar === 'ESCUELA' ? 'selected' : ''}>ESCUELA</option>
        <option value="OTRO" ${c.lugar === 'OTRO' ? 'selected' : ''}>OTRO</option>
      </select>
    </td>
    <td data-label="¿Enfermó?">
      <select class="form-select c-enfermo save-state" onchange="updCont(this)" style="font-size:0.85rem" onclick="event.stopPropagation()">
        <option value="NO" ${c.enfermo !== 'SI' ? 'selected' : ''}>NO</option>
        <option value="SI" ${c.enfermo === 'SI' ? 'selected' : ''}>SI</option>
      </select>
    </td>
    <td data-label="Fecha Sínt."><input type="date" class="form-control c-fecha save-state" value="${c.fecha || ''}" ${c.enfermo !== 'SI' ? 'disabled' : ''} style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
    <td data-label="Observaciones"><input type="text" class="form-control c-obs save-state" value="${c.obs || ''}" ${c.enfermo !== 'SI' ? 'disabled' : ''} style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
  </tr>
`;
tbody.insertAdjacentHTML('beforeend', rowHTML);
const lastRow = tbody.lastElementChild;
const selectSexo = lastRow.querySelector('.c-sexo');
if (selectSexo.value) { updRelacion(selectSexo); lastRow.querySelector('.c-relacion').value = c.relacion; updSummary(lastRow.querySelector('.c-relacion')); }
}

function updRelacion(sel) {
const row = sel.closest('tr'); const relSelect = row.querySelector('.c-relacion');
const fragRel = document.createDocumentFragment();
let op = document.createElement('option'); op.value = ""; op.text = "Seleccione..."; op.selected = true; op.disabled = true; fragRel.appendChild(op);

if (sel.value === 'M') ['PADRE', 'HERMANO', 'HIJO', 'TÍO', 'PRIMO', 'SOBRINO', 'ABUELO', 'ESPOSO', 'AMIGO', 'COMPAÑERO', 'OTRO'].forEach(o => fragRel.appendChild(new Option(o, o)));
else if (sel.value === 'F') ['MADRE', 'HERMANA', 'HIJA', 'TÍA', 'PRIMA', 'SOBRINA', 'ABUELA', 'ESPOSA', 'AMIGA', 'COMPAÑERA', 'OTRA'].forEach(o => fragRel.appendChild(new Option(o, o)));
relSelect.innerHTML = ""; relSelect.appendChild(fragRel);
updSummary(sel);
}

function updCont(sel) {
const row = sel.closest('tr'); const isSi = sel.value === 'SI';
toggleElementos([row.querySelector('.c-fecha'), row.querySelector('.c-obs')], isSi);
if (!isSi) { row.querySelector('.c-fecha').value = ''; row.querySelector('.c-obs').value = ''; }

let enfermos = 0; document.querySelectorAll('.c-enfermo').forEach(s => { if (s.value === 'SI') enfermos++; });
const selectOtrosEnf = document.getElementById('otros_enfermos');
selectOtrosEnf.value = enfermos > 0 ? 'SI' : 'NO'; toggleDondeEnfermos(selectOtrosEnf.value);
}

function mostrarLoader(msg) { document.getElementById('loader-text').innerText = msg || "Procesando..."; document.getElementById('loader').style.display = 'flex'; }
function ocultarLoader() { document.getElementById('loader').style.display = 'none'; }
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function getChk(id) { const el = document.getElementById(id); return el ? el.checked : false; }

function recopilarDatos() {
const condEgreso = document.querySelector('input[name="cond_egreso"]:checked')?.value || "";
const radProc = document.querySelector('input[name="rad_procedencia"]:checked')?.value || "";
const radTipoExp = document.querySelector('input[name="rad_tipo_exp"]:checked')?.value || "";
const otrosEnfVal = getVal('otros_enfermos');
const dondeEnfermos = (otrosEnfVal === 'SI') ? (document.querySelector('input[name="rad_donde"]:checked')?.value || "") : "";

const sexoVal = getVal('sexo');
let embarazadaVal = "NO"; let semanasVal = "";
if (sexoVal !== "MASCULINO") {
  embarazadaVal = getVal('embarazada') || "NO";
  if (embarazadaVal === "SI") semanasVal = getVal('semanas_gestacion');
}

const d = {
  cedula: getVal('cedula'), historia_clinica: getVal('historia_clinica'), primer_apellido: getVal('primer_apellido'),
  segundo_apellido: getVal('segundo_apellido'), primer_nombre: getVal('primer_nombre'), segundo_nombre: getVal('segundo_nombre'),
  fecha_nacimiento: getVal('fecha_nacimiento'), telefono: getVal('telefono'), nacionalidad: getVal('nacionalidad'), sexo: sexoVal,
  prov_residencia: getVal('prov_residencia'), canton_residencia: getVal('canton_residencia'), parroquia_residencia: getVal('parroquia_residencia'),
  direccion: getVal('direccion'), estado_civil: getVal('estado_civil'), etnia: getVal('etnia'), escolaridad: getVal('escolaridad'),
  ocupacion: getVal('ocupacion'), nombre_madre: getVal('nombre_madre'), medico_tratante: getVal('medico_tratante'), diagnostico_cie10: getVal('diagnostico_cie10'),
  embarazada: embarazadaVal, semanas_gestacion: semanasVal, institucion: getVal('institucion'), establecimiento: getVal('establecimiento'),
  prov_establecimiento: getVal('prov_establecimiento'), canton_establecimiento: getVal('canton_establecimiento'), parroquia_establecimiento: getVal('parroquia_establecimiento'),
  fecha_atencion: getVal('fecha_atencion'), 
  fecha_inicio_sintomas: getVal('fecha_inicio_sintomas'), 
  hora_inicio_sintomas: getVal('hora_inicio_sintomas'), // Nuevo campo
  fecha_sintoma_relevante: getVal('fecha_sintoma_relevante'),
  hora_sintoma_relevante: getVal('hora_sintoma_relevante'), // Nuevo campo
  cual_sintoma: getVal('cual_sintoma'),
  tos: getChk('tos'), dolor_garganta: getChk('dolor_garganta'), dif_respiratoria: getChk('dif_respiratoria'), cianosis: getChk('cianosis'),
  diarrea: getChk('diarrea'), nauseas: getChk('nauseas'), dolor_abdominal: getChk('dolor_abdominal'), deshidratacion: getChk('deshidratacion'),
  ictericia: getChk('ictericia'), anorexia: getChk('anorexia'), fiebre: getChk('fiebre'), cefalea: getChk('cefalea'), escalofrios: getChk('escalofrios'),
  mialgias: getChk('mialgias'), artralgia: getChk('artralgia'), sudoracion: getChk('sudoracion'), sangrados: getChk('sangrados'), erupcion: getChk('erupcion'),
  prurito: getChk('prurito'), adenopatias: getChk('adenopatias'), convulsiones: getChk('convulsiones'), alt_neuro_central: getChk('alt_neuro_central'),
  alt_neuro_periferico: getChk('alt_neuro_periferico'), vision_borrosa: getChk('vision_borrosa'), rigidez: getChk('rigidez'), espasmo: getChk('espasmo'),
  apnea: getChk('apnea'), ascitis: getChk('ascitis'), paralisis: getChk('paralisis'), estridor: getChk('estridor'), oncocercomas: getChk('oncocercomas'), trismus: getChk('trismus'),
  otros_signos: getVal('otros_signos'), num_dias_sintomas: getVal('num_dias_sintomas'), aplica_caracterizar_signos: getVal('aplica_caracterizar_signos'),
  caracterizar_signos: getVal('caracterizar_signos'), recibio_tratamiento: getVal('recibio_tratamiento'), especificar_tratamiento: getVal('especificar_tratamiento'),
  evolucion: getVal('evolucion'), lugar_tratamiento: getVal('lugar_tratamiento'), asistio_controles: getVal('asistio_controles'), cuantos_controles: getVal('cuantos_controles'),
  hospitalizado: getVal('hospitalizado'), fecha_hosp: getVal('fecha_hosp'), hc_hosp: getVal('hc_hosp'), nombre_hospital: getVal('nombre_hospital'),
  servicio_hosp: getVal('servicio_hosp'), ingreso_uci: getVal('ingreso_uci'), condicion_egreso: condEgreso, fecha_fallecimiento: getVal('fecha_fallecimiento'),
  exp_animal_vivo: getChk('exp_animal_vivo'), exp_animal_muerto: getChk('exp_animal_muerto'), exp_persona_sint: getChk('exp_persona_sint'), exp_agua_suelo: getChk('exp_agua_suelo'),
  exp_alimentos: getChk('exp_alimentos'), exp_basurales: getChk('exp_basurales'), exp_plaguicidas: getChk('exp_plaguicidas'), exp_metanol: getChk('exp_metanol'),
  exp_ninguno: getChk('exp_ninguno'), exp_otros: getVal('exp_otros'), lugar_contacto: getVal('lugar_contacto'), forma_contacto: getVal('forma_contacto'),
  origen_objeto: getVal('origen_objeto'), fecha_contacto: getVal('fecha_contacto'), hora_contacto: getVal('hora_contacto'), procedencia_agua: radProc,
  procedencia_agua_otro: getVal('procedencia_agua_otro'), tipo_exposicion: radTipoExp, tipo_exposicion_otro: getVal('tipo_exposicion_otro'), transfusion: getVal('transfusion'),
  quimioterapia: getVal('quimioterapia'), contactos: [], contactos_12_14: [], antecedente_vacunal: getVal('antecedente_vacunal'), fecha_ultima_dosis: getVal('fecha_ultima_dosis'),
  num_dosis: getVal('num_dosis'), fuente_info: getVal('fuente_info'), bcg: getChk('bcg'), hb: getChk('hb'), rota: getChk('rota'), opv: getChk('opv'),
  penta: getChk('penta'), influenza: getChk('influenza'), neumococo_conj: getChk('neumococo_conj'), sr: getChk('sr'), fa: getChk('fa'), dt: getChk('dt'),
  dpt: getChk('dpt'), dt_adulto: getChk('dt_adulto'), srp: getChk('srp'), varicela: getChk('varicela'), neumococo_poli: getChk('neumococo_poli'),
  otras_vacunas: getVal('otras_vacunas'), realizo_viaje: getVal('realizo_viaje'), lugar_viaje: getVal('lugar_viaje'), fecha_desde: getVal('fecha_desde'),
  fecha_hasta: getVal('fecha_hasta'), otros_enfermos: otrosEnfVal, donde_enfermos: dondeEnfermos, tipo_caso: getVal('tipo_caso'),
  comorbilidades: getVal('comorbilidades'), especificar_comor: getVal('especificar_comor'), carac_factores: getVal('carac_factores'), obs_epidemiologicas: getVal('obs_epidemiologicas'),
  muestra: getVal('muestra'), fecha_muestra: getVal('fecha_muestra'), muestra_adecuada: getVal('muestra_adecuada'), tipo_muestra: getVal('tipo_muestra'),
  tecnica: getVal('tecnica'), antes_tratamiento: getVal('antes_tratamiento'), resultado: getVal('resultado'), agente: getVal('agente'),
  diagnostico_def: getVal('diagnostico_def'), confirmado_por: getVal('confirmado_por'), tipo_caso_brote: getVal('tipo_caso_brote'), fecha_cierre: getVal('fecha_cierre')
};

let validContactCount = 0;

document.querySelectorAll('#contactsBody tr').forEach(tr => {
  const nom = tr.querySelector('.c-nombre')?.value?.trim();
  if (nom) {
    const objContacto = {
      nombre: nom, 
      edad: tr.querySelector('.c-edad')?.value || '', 
      sexo: tr.querySelector('.c-sexo')?.value || '',
      relacion: tr.querySelector('.c-relacion')?.value || '', 
      direccion: tr.querySelector('.c-dir')?.value || '',
      lugar: tr.querySelector('.c-lugar')?.value || '', 
      enfermo: tr.querySelector('.c-enfermo')?.value || 'NO',
      fecha: tr.querySelector('.c-fecha')?.value || '', 
      obs: tr.querySelector('.c-obs')?.value || ''
    };

    if (validContactCount < 11) {
      d.contactos.push(objContacto);
    } else {
      d.contactos_12_14.push(objContacto);
    }
    
    validContactCount++;
  }
});

return JSON.stringify(d);
}

function descargarFichaSegura() {
if (!getVal('cedula')) { 
    Swal.fire('Falta información', 'Por favor, ingrese la Cédula del paciente.', 'warning').then(() => enfocarElementoSeguro(document.getElementById('cedula'))); 
    document.getElementById('cedula').classList.add('input-error'); 
    return; 
}
if (!getVal('primer_apellido')) { 
    Swal.fire('Falta información', 'Por favor, ingrese el Primer Apellido.', 'warning').then(() => enfocarElementoSeguro(document.getElementById('primer_apellido'))); 
    document.getElementById('primer_apellido').classList.add('input-error'); 
    return; 
}
if (!getVal('primer_nombre')) { 
    Swal.fire('Falta información', 'Por favor, ingrese el Primer Nombre.', 'warning').then(() => enfocarElementoSeguro(document.getElementById('primer_nombre'))); 
    document.getElementById('primer_nombre').classList.add('input-error'); 
    return; 
}
if (!getVal('institucion') || !getVal('establecimiento')) { 
    Swal.fire('Falta información', 'Por favor, seleccione la Institución y el Establecimiento de Salud.', 'warning').then(() => enfocarElementoSeguro(document.getElementById(!getVal('institucion') ? 'institucion' : 'establecimiento'))); 
    return; 
}

mostrarLoader("Generando PDF (aprox. 15-20 seg)...");

const aCed = getVal('cedula').trim();
const aApe = getVal('primer_apellido').trim().toUpperCase();
const aNom = getVal('primer_nombre').trim().toUpperCase();
const nFinal = `FichasEPI_${aCed}_${aApe}_${aNom}.pdf`;

const controllerPDF = new AbortController();
const timeoutPDF = setTimeout(() => controllerPDF.abort(), 30000); 

// GUARDAMOS EL ESTABLECIMIENTO ANTES DE ENVIAR (Para el contador)
const nombreEstabSeleccionado = getVal('establecimiento');

fetch(API_URL, { 
  method: 'POST', 
  body: recopilarDatos(),
  signal: controllerPDF.signal
})
.then(response => {
  clearTimeout(timeoutPDF);
  return response.json();
})
.then(res => {
  ocultarLoader();
  if (res && res.success) {

    // (SE BORRÓ EL BLOQUE DEL CONTADOR EXTERNO)

    const a = document.createElement('a'); 
    a.href = 'data:application/pdf;base64,' + res.base64; 
    a.download = res.fileName || nFinal;
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a);
    Swal.fire({ icon: 'success', title: '¡Ficha Generada!', text: 'La descarga ha comenzado correctamente.', timer: 3000, showConfirmButton: false });
  } else { 
    Swal.fire('Error de PDF', (res ? res.error : 'Respuesta desconocida'), 'error'); 
  }
}).catch(err => {
  ocultarLoader(); 
  if (err.name === 'AbortError') {
    Swal.fire('Servidor Saturado', 'El sistema está procesando demasiadas peticiones a la vez. Por favor, espera 10 segundos y vuelve a darle a exportar.', 'warning');
  } else {
    Swal.fire('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
  }
});
}

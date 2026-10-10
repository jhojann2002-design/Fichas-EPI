// js/formLogic.js
import { etniaOpciones, civilOpciones } from './constants.js';

export let catData = null;
export function setCatData(data) { catData = data; }

export function toggleElementos(elementos, habilitar) {
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

export function actualizarGeneroDropdowns() {
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

export function actualizarEstadoEmbarazo() {
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

export function toggleTratamientoCampos() {
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

export function toggleControlesCampos() {
  const isSi = (document.getElementById('recibio_tratamiento').value === 'SI' && document.getElementById('asistio_controles').value === 'SI');
  toggleElementos([document.getElementById('cuantos_controles')], isSi);
  if (!isSi) document.getElementById('cuantos_controles').value = '';
}

export function toggleExposicion(isNinguno) {
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

export function validarProcedenciaAgua() {
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

export function toggleDondeEnfermos(val) {
  const isSi = (val === 'SI');
  toggleElementos(document.querySelectorAll('.rad-donde'), isSi);
  if (!isSi) document.querySelectorAll('.rad-donde').forEach(r => r.checked = false);
}

export function toggleLaboratorio(habilitar) {
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

export function setUnidadPredeterminada() {
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

export function fillCantones(prov) {
  const cantSelect = document.getElementById('canton_residencia');
  document.getElementById('parroquia_residencia').innerHTML = '<option value="" selected disabled>Seleccione Parroquia...</option>';
  if (!prov || !catData || !catData.ubicaciones[prov]) return;
  let cantones = Object.keys(catData.ubicaciones[prov]);
  const topCantons = ["PORTOVIEJO", "MANTA", "MONTECRISTI", "JARAMIJÓ", "ROCAFUERTE", "CHONE"];
  cantones = cantones.filter(c => !topCantons.includes(c)).sort();
  topCantons.reverse().forEach(tc => { if (catData.ubicaciones[prov][tc]) cantones.unshift(tc); });

  const fragCant = document.createDocumentFragment();
  let op = document.createElement('option'); op.value = ""; op.text = "Seleccione Cantón..."; op.selected = true; op.disabled = true; fragCant.appendChild(op);
  cantones.forEach(c => { let opt = document.createElement('option'); opt.value = c; opt.text = c; fragCant.appendChild(opt); });
  cantSelect.innerHTML = ""; cantSelect.appendChild(fragCant);
}

export function fillParroquias(prov, canton) {
  const parrSelect = document.getElementById('parroquia_residencia');
  if (!prov || !canton || !catData || !catData.ubicaciones[prov][canton]) return;
  const fragParr = document.createDocumentFragment();
  let op = document.createElement('option'); op.value = ""; op.text = "Seleccione Parroquia..."; op.selected = true; op.disabled = true; fragParr.appendChild(op);
  catData.ubicaciones[prov][canton].sort().forEach(p => { let opt = document.createElement('option'); opt.value = p; opt.text = p; fragParr.appendChild(opt); });
  parrSelect.innerHTML = ""; parrSelect.appendChild(fragParr);
}

// ==========================================
// CÁLCULO DE FECHAS
// ==========================================
export function forzarCalculoDias() {
  try {
    const elIni = document.getElementById('fecha_inicio_sintomas');
    const elRel = document.getElementById('fecha_sintoma_relevante');
    const elAte = document.getElementById('fecha_atencion');
    const elDias = document.getElementById('num_dias_sintomas');

    if (!elDias || !elAte) return;

    const valIni = (elIni && elIni.value) ? elIni.value : ((elRel && elRel.value) ? elRel.value : '');
    const valAte = elAte.value || '';

    if (!valIni || !valAte) {
      if (elDias.value !== '') {
        elDias.value = '';
        elDias.dispatchEvent(new Event('input', { bubbles: true }));
        elDias.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }

    const dIni = new Date(valIni + 'T12:00:00Z');
    const dAte = new Date(valAte + 'T12:00:00Z');

    if (!isNaN(dIni.getTime()) && !isNaN(dAte.getTime())) {
      const diffTime = dAte.getTime() - dIni.getTime();
      const dias = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
      
      if (elDias.value !== String(dias)) {
        elDias.value = dias;
        elDias.dispatchEvent(new Event('input', { bubbles: true }));
        elDias.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  } catch (err) {
    console.error("Error en cálculo de días:", err);
  }
}

// ==========================================
// LÓGICA OPCIONAL DE TUBERCULOSIS Y ANIMACIÓN
// ==========================================
export function revisarCie10ParaTB(value) {
  const pregContainer = document.getElementById('tb_pregunta_container');
  const reqSelect = document.getElementById('tb_requiere_ficha');
  if (pregContainer) {
    if (value && value.toUpperCase().includes('TUBERCULOSIS')) {
      pregContainer.style.display = 'block';
    } else {
      pregContainer.style.display = 'none';
      if(reqSelect) { 
          reqSelect.value = 'NO'; 
      }
      // Forzar que el acordeón se esconda automáticamente
      toggleFormularioTB(true);
    }
  }
}

export function toggleFormularioTB(skipScroll = false) {
  const req = document.getElementById('tb_requiere_ficha')?.value;
  const container = document.getElementById('secTuberculosisContainer');
  const collapseEl = document.getElementById('secTuberculosis');

  if (!container) return;

  if (req === 'SI') {
    container.style.display = 'block';
    if (collapseEl && !collapseEl.classList.contains('show')) {
        if (skipScroll) {
            // Carga silenciosa si viene de recargar la página (sin brincos)
            collapseEl.classList.add('show');
            const btn = container.querySelector('.accordion-button');
            if (btn) btn.classList.remove('collapsed');
        } else {
            // Animación de despliegue y auto-scroll si lo hace el humano
            const bsCollapse = new bootstrap.Collapse(collapseEl, { toggle: false });
            bsCollapse.show(); // Esto dispara automáticamente el scroll de main.js
        }
    }
  } else {
    container.style.display = 'none';
    if (collapseEl && collapseEl.classList.contains('show')) {
        if (skipScroll) {
            collapseEl.classList.remove('show');
            const btn = container.querySelector('.accordion-button');
            if (btn) btn.classList.add('collapsed');
        } else {
            const bsCollapse = new bootstrap.Collapse(collapseEl, { toggle: false });
            bsCollapse.hide();
        }
    }
  }
}

// Exponer funciones a Window
window.calcDiasSintomas = forzarCalculoDias;
window.toggleFormularioTB = toggleFormularioTB;
window.revisarCie10ParaTB = revisarCie10ParaTB;

// --- LÓGICA DE INTERFAZ DE TUBERCULOSIS ---

export function toggleServiciosTB() {
  const srv = document.querySelector('input[name="tb_servicio"]:checked')?.value;
  const inpEsp = document.getElementById('tb_srv_esp');
  const inpConsEsp = document.getElementById('tb_srv_cons_esp');
  
  if (srv === 'cons') {
    inpEsp.disabled = true; inpEsp.value = '';
    inpConsEsp.disabled = false; inpConsEsp.focus();
  } else if (srv) {
    inpConsEsp.disabled = true; inpConsEsp.value = '';
    inpEsp.disabled = false; inpEsp.focus();
  }
}

export function toggleCondicionesEspeciales(checked) {
  const inp = document.getElementById('tb_crit_especiales_txt');
  inp.disabled = !checked;
  if (!checked) inp.value = ''; else inp.focus();
}

export function calcularZonaDistrito(provincia, canton) {
  const tbZona = document.getElementById('tb_zona');
  const tbDistrito = document.getElementById('tb_distrito');
  if(!tbZona || !tbDistrito) return;

  if (provincia === 'MANABI') {
    tbZona.value = 'ZONA 4';
    const distritos = {
      "PORTOVIEJO": "13D01", "MANTA": "13D02", "MONTECRISTI": "13D02", "JARAMIJÓ": "13D02",
      "JIPIJAPA": "13D03", "PUERTO LÓPEZ": "13D03", "PAJÁN": "13D09",
      "SANTA ANA": "13D04", "24 DE MAYO": "13D04", "OLMEDO": "13D04",
      "EL CARMEN": "13D05", "BOLÍVAR": "13D06", "JUNÍN": "13D06",
      "CHONE": "13D07", "FLAVIO ALFARO": "13D07", "PICHINCHA": "13D08",
      "PEDERNALES": "13D10", "JAMA": "13D10", "SUCRE": "13D11", "SAN VICENTE": "13D11",
      "ROCAFUERTE": "13D12", "TOSAGUA": "13D12"
    };
    tbDistrito.value = distritos[canton] || '';
    // Disparamos eventos para el autoguardado
    tbZona.dispatchEvent(new Event('change', { bubbles: true }));
    tbDistrito.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (provincia === 'SANTO DOMINGO DE LOS TSÁCHILAS') {
    tbZona.value = 'ZONA 4';
    tbDistrito.value = canton === 'LA CONCORDIA' ? '23D03' : '23D01 / 23D02';
  } else if (provincia === 'SANTA ELENA') {
    tbZona.value = 'ZONA 5';
    tbDistrito.value = '24D01 / 24D02';
  }
}

// Exponer las nuevas funciones a Window para el HTML
window.toggleServiciosTB = toggleServiciosTB;
window.toggleCondicionesEspeciales = toggleCondicionesEspeciales;

export function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
export function getChk(id) { const el = document.getElementById(id); return el ? el.checked : false; }

export function recopilarDatos() {
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
    fecha_atencion: getVal('fecha_atencion'), fecha_inicio_sintomas: getVal('fecha_inicio_sintomas'), hora_inicio_sintomas: getVal('hora_inicio_sintomas'),
    fecha_sintoma_relevante: getVal('fecha_sintoma_relevante'), hora_sintoma_relevante: getVal('hora_sintoma_relevante'), cual_sintoma: getVal('cual_sintoma'),
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
}// --- NUEVA FUNCIÓN PARA CARACTERIZAR SIGNOS ---
export function toggleCaracterizarSignos() {
  const el = document.getElementById('aplica_caracterizar_signos');
  const input = document.getElementById('caracterizar_signos');
  if (el && input) {
    const isSi = el.value === 'SI';
    toggleElementos([input], isSi);
    if (!isSi) input.value = '';
  }
}

// ==========================================
// EXPONER FUNCIONES A WINDOW PARA EL HTML
// ==========================================
window.calcDiasSintomas = forzarCalculoDias;
window.toggleFormularioTB = toggleFormularioTB;
window.revisarCie10ParaTB = revisarCie10ParaTB;
window.toggleServiciosTB = toggleServiciosTB;
window.toggleCondicionesEspeciales = toggleCondicionesEspeciales;

// ¡AQUÍ ESTÁ LA CORRECCIÓN DE LOS FALLOS (Faltaban exponerlas globalmente)!
window.toggleTratamientoCampos = toggleTratamientoCampos;
window.toggleControlesCampos = toggleControlesCampos;
window.toggleExposicion = toggleExposicion;
window.toggleDondeEnfermos = toggleDondeEnfermos;
window.toggleCaracterizarSignos = toggleCaracterizarSignos;
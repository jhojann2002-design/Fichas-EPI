// js/api.js
// Orquestador de catálogos, inicialización y descarga de Fichas EPI (delegando PDF a epiPdf.js y Excel a epiExcel.js)
import { API_URL, dbCie10Sppat } from './constants.js';
import { mostrarLoader, ocultarLoader, enfocarElementoSeguro } from './ui.js';
import { setCatData, catData, fillCantones, fillParroquias, getVal, recopilarDatos, calcularZonaDistrito } from './formLogic.js';
import { loadFormData } from './storage.js';
import { registrarFichaGenerada, mostrarModalEstadisticas } from './counter.js';
import { calcularSemanaEpidemiologica, splitDireccion } from './epiUtils.js';
import { aplanarFormularioSeguro, generarPdfFichaEpi } from './epiPdf.js';
import { procesarFichaEpiExcelLocalmente } from './epiExcel.js';

export { calcularSemanaEpidemiologica, splitDireccion, aplanarFormularioSeguro };

export function initApiListeners() {
  const devSig = document.getElementById('devSignature');
  if (devSig) {
    devSig.addEventListener('dblclick', () => {
      mostrarModalEstadisticas();
    });

    // Soporte para doble toque rápido en pantallas táctiles / móviles
    let lastTap = 0;
    devSig.addEventListener('touchend', (e) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      if (tapLength < 400 && tapLength > 0) {
        e.preventDefault();
        mostrarModalEstadisticas();
      }
      lastTap = currentTime;
    });
  }
}

export function initData(dataStr) {
  setCatData(JSON.parse(dataStr));
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
        
        calcularZonaDistrito(u.provincia, u.canton);
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
      "A90 - DENGUE CLASICO", "A91 - DENGUE HEMORRAGICO", "A90 - DENGUE CON SIGNOS DE ALARMA",
      "A90 - DENGUE SIN SIGNOS DE ALARMA", "A91 - DENGUE GRAVE", "A279 - LEPTOSPIROSIS NO ESPECIFICADA"
    ];
    topCIE.forEach(c => { let opt = document.createElement('option'); opt.value = c; opt.text = c; fragCie.appendChild(opt); });

    let cieFiltrado = catData.cie10.filter(c => {
      let cUp = c.toUpperCase(); return !cUp.includes('DENGUE') && !cUp.includes('LEPTOSPIROSIS'); 
    }).sort();
    cieFiltrado.forEach(c => { let opt = document.createElement('option'); opt.value = c; opt.text = c; fragCie.appendChild(opt); });
  }
  cieSelect.innerHTML = ""; cieSelect.appendChild(fragCie);

  const lugSelect = document.getElementById('lugar_tratamiento');
  const fragLug = document.createDocumentFragment();
  let optLug = document.createElement('option'); optLug.value = ""; optLug.text = "-- Seleccione --"; optLug.selected = true; fragLug.appendChild(optLug);
  if (catData.lugares_tratamiento && catData.lugares_tratamiento.length > 0) {
    catData.lugares_tratamiento.forEach(lt => { let opt = document.createElement('option'); opt.value = lt; opt.text = lt; fragLug.appendChild(opt); });
  }
  lugSelect.innerHTML = ""; lugSelect.appendChild(fragLug);

  // Poblar selectores de CIE-10 exclusivos para el Formulario SPPAT (Accidentes de Tránsito y Lesiones Anatómicas)
  const sppatCatalog = (catData && catData.cie10_sppat) ? catData.cie10_sppat : dbCie10Sppat;
  const listaTransito = Array.isArray(sppatCatalog?.transito) ? sppatCatalog.transito : (dbCie10Sppat.transito || []);
  const listaLesiones = Array.isArray(sppatCatalog?.lesiones) ? sppatCatalog.lesiones : (dbCie10Sppat.lesiones || []);

  const poblarSelectSppat = (selectId, placeholderTxt, primeroLesiones = false) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const frag = document.createDocumentFragment();
    const optEmpty = document.createElement('option');
    optEmpty.value = "";
    optEmpty.text = placeholderTxt;
    frag.appendChild(optEmpty);

    const crearGrupo = (titulo, items) => {
      const grp = document.createElement('optgroup');
      grp.label = titulo;
      items.forEach(item => {
        const o = document.createElement('option');
        o.value = item;
        o.text = item;
        grp.appendChild(o);
      });
      return grp;
    };

    if (primeroLesiones) {
      frag.appendChild(crearGrupo('LESIONES ANATÓMICAS Y TRAUMATISMOS (S00 - T14)', listaLesiones));
      frag.appendChild(crearGrupo('ACCIDENTES DE TRÁNSITO / CAUSA EXTERNA (V01 - V99)', listaTransito));
    } else {
      frag.appendChild(crearGrupo('ACCIDENTES DE TRÁNSITO / CAUSA EXTERNA (V01 - V99)', listaTransito));
      frag.appendChild(crearGrupo('LESIONES ANATÓMICAS Y TRAUMATISMOS (S00 - T14)', listaLesiones));
    }
    sel.innerHTML = "";
    sel.appendChild(frag);
  };

  poblarSelectSppat('sppat_select_cie1', 'Buscar CIE-10 de tránsito (V01-V99) o lesión (S00-T14)...', false);
  poblarSelectSppat('sppat_select_cie2', 'Buscar lesión anatómica (S00-T14) o tránsito (V01-V99)...', true);

  window.tomSelectCie10 = new TomSelect("#diagnostico_cie10", { 
    create: false, maxOptions: null,
    onDropdownOpen: function() {
      if (window.innerWidth <= 768) {
        setTimeout(() => { this.control.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
      }
    },
    onChange: function(value) {
      if (window.revisarCie10ParaTB) window.revisarCie10ParaTB(value);
    }
  });

  const aplicarSeleccionCieSppat = (valor, idTxt, idCie) => {
    if (!valor) return;
    const inpTxt = document.getElementById(idTxt);
    const inpCie = document.getElementById(idCie);
    const partes = String(valor).split(' - ');
    const codigo = (partes[0] || '').trim().toUpperCase();
    const desc = (partes.length > 1 ? partes.slice(1).join(' - ') : valor).trim().toUpperCase();
    if (inpCie) {
      inpCie.value = codigo;
      inpCie.dispatchEvent(new Event('input', { bubbles: true }));
      inpCie.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (inpTxt) {
      inpTxt.value = desc;
      inpTxt.dispatchEvent(new Event('input', { bubbles: true }));
      inpTxt.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  if (document.getElementById('sppat_select_cie1')) {
    window.tomSelectSppatCie1 = new TomSelect("#sppat_select_cie1", {
      create: false, maxOptions: null,
      onChange: function(value) {
        if (value) aplicarSeleccionCieSppat(value, 'sppat_diag_principal_txt', 'sppat_diag_principal_cie');
      }
    });
  }

  if (document.getElementById('sppat_select_cie2')) {
    window.tomSelectSppatCie2 = new TomSelect("#sppat_select_cie2", {
      create: false, maxOptions: null,
      onChange: function(value) {
        if (value) aplicarSeleccionCieSppat(value, 'sppat_diag_sec_txt', 'sppat_diag_sec_cie');
      }
    });
  }

  loadFormData();

  ocultarLoader();
}

export async function obtenerBlobDocumento(formato) {
  const esTuberculosis = getVal('tb_requiere_ficha') === 'SI';
  const datosObj = JSON.parse(recopilarDatos());
  datosObj.formato = formato;

  if (formato === 'excel') {
    const aCed = (datosObj.cedula || 'SIN_CI').trim();
    const aApe = (datosObj.primer_apellido || 'PACIENTE').trim().toUpperCase();
    const aNom = (datosObj.primer_nombre || '').trim().toUpperCase();
    const fileNameLocal = `FichasEPI_${aCed}_${aApe}_${aNom}.xlsx`;

    // Registro estadístico asíncrono en segundo plano (sin bloquear ni generar cuello de botella)
    if (navigator.onLine) {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...datosObj, soloRegistroEstadistico: true })
      }).catch(() => {});
    }

    try {
      const blobLocal = await procesarFichaEpiExcelLocalmente(datosObj);
      return { blob: blobLocal, fileName: fileNameLocal };
    } catch (errLocal) {
      console.warn('Fallback a generación remota de Excel:', errLocal);
      const payloadFinal = JSON.stringify(datosObj);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadFinal
      });
      const text = await response.text();
      const res = JSON.parse(text);
      if (!res || !res.success) throw new Error(res.error || "Error desconocido del servidor al generar Excel");
      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      return { blob: new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName: res.fileName || fileNameLocal };
    }
  }

  if (formato === 'pdf') {
    return await generarPdfFichaEpi(datosObj, esTuberculosis);
  }
}

export async function descargarFichaSegura(formato = 'pdf', retornarBlob = false) {
  if (!getVal('cedula') || !getVal('primer_apellido') || !getVal('primer_nombre')) { 
    Swal.fire('Falta información', 'Por favor, ingrese Cédula, Primer Apellido y Primer Nombre.', 'warning'); 
    return; 
  }

  const camposRecomendados = [
    { id: 'institucion', label: 'Institución Notificadora' },
    { id: 'establecimiento', label: 'Establecimiento de Salud' },
    { id: 'fecha_atencion', label: 'Fecha de Atención' },
    { id: 'diagnostico_cie10', label: 'Diagnóstico CIE-10' },
    { id: 'fecha_nacimiento', label: 'Fecha de Nacimiento' },
    { id: 'sexo', label: 'Sexo del Paciente' }
  ];

  const faltantes = camposRecomendados.filter(c => !getVal(c.id));
  if (!retornarBlob && faltantes.length > 0) {
    const listaHtml = faltantes.map(f => `<li><b>${f.label}</b></li>`).join('');
    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: 'Campos recomendados incompletos',
      html: `Los siguientes campos clave para la ficha oficial están vacíos:<br><ul class="text-start mt-2 mb-3" style="font-size: 0.88rem; max-height: 160px; overflow-y: auto;">${listaHtml}</ul>¿Deseas generar el documento de todos modos?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, generar de todos modos',
      cancelButtonText: 'Completar datos',
      confirmButtonColor: 'var(--apple-blue)',
      cancelButtonColor: 'var(--apple-text-muted)'
    });

    if (!confirmacion.isConfirmed) {
      const primerFaltante = document.getElementById(faltantes[0].id);
      if (primerFaltante) enfocarElementoSeguro(primerFaltante);
      return;
    }
  }

  const esTuberculosis = getVal('tb_requiere_ficha') === 'SI';
  
  if(!retornarBlob) {
      mostrarLoader(formato === 'excel' ? "Generando Excel localmente..." : (esTuberculosis ? "Procesando Fichas EPI y TB..." : "Generando PDF localmente..."));
  }

  try {
    const aCed = getVal('cedula').trim(); 
    const aApe = getVal('primer_apellido').trim().toUpperCase(); 
    const aNom = getVal('primer_nombre').trim().toUpperCase();
    
    const { blob, fileName } = await obtenerBlobDocumento(formato);
    const nFinal = fileName || `FichasEPI_${aCed}_${aApe}_${aNom}.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
    
    if (retornarBlob) {
        return blob;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nFinal;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Registro seguro en contador local y telemetría
    try {
      registrarFichaGenerada({
        modo: 'epi',
        formato: formato,
        paciente: `${aApe} ${aNom}`.trim(),
        primer_apellido: aApe,
        primer_nombre: aNom,
        cedula: aCed,
        establecimiento: getVal('establecimiento') || 'HOSPITAL GENERAL PORTOVIEJO',
        institucion: getVal('institucion') || 'IESS',
        medico: getVal('medico_tratante') || '',
        diagnostico: getVal('diagnostico_cie10') || ''
      });
    } catch (eCnt) {
      console.warn('Aviso en contador EPI:', eCnt);
    }

    ocultarLoader();
    Swal.fire({ icon: 'success', title: '¡Documento Generado!', timer: 3000, showConfirmButton: false });
  } catch (err) {
    if (!retornarBlob) ocultarLoader(); 
    if (retornarBlob) {
      throw err;
    } else {
      Swal.fire('Error', err.message, 'error'); 
    }
  }
}

window.descargarFichaSegura = descargarFichaSegura;

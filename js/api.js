// js/api.js
import { API_URL } from './constants.js';
import { mostrarLoader, ocultarLoader, enfocarElementoSeguro } from './ui.js';
import { setCatData, catData, fillCantones, fillParroquias, getVal, getChk, recopilarDatos, calcularZonaDistrito } from './formLogic.js';
import { loadFormData } from './storage.js';
import { PDFDocument } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';

export function initApiListeners() {
  const devSig = document.getElementById('devSignature');
  if (devSig) {
    devSig.addEventListener('dblclick', async () => {
      try {
        mostrarLoader("Consultando base de datos...");
        const urlStats = API_URL + "?action=stats";
        const res = await fetch(urlStats);
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);

        const totalGlobal = data.totalGlobal || 0;
        let htmlExtra = "";
        
        if (data.porEstablecimiento && Object.keys(data.porEstablecimiento).length > 0) {
          const establecimientosArray = Object.entries(data.porEstablecimiento).sort((a, b) => b[1] - a[1]);
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
          htmlExtra += `</tbody></table></div>`;
        } else {
          htmlExtra = `<br><br><small style="color: gray;">Aún no hay registros detallados por establecimiento.</small>`;
        }

        ocultarLoader();
        Swal.fire({
          title: '📊 Estadísticas Reales', 
          html: `Total Global (Todas las unidades): <b style="font-size: 1.2rem; color: var(--apple-blue);">${totalGlobal}</b>${htmlExtra}`, 
          icon: 'info', confirmButtonColor: 'var(--apple-blue)', width: '600px'
        });
      } catch(err) {
        ocultarLoader();
        Swal.fire('Error', 'Hubo un problema consultando el registro de Google Sheets.', 'error');
      }
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
        
        // Esto es lo que inyecta la Zona y el Distrito automáticamente
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

  loadFormData();

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

  ocultarLoader();
}

export async function descargarFichaSegura(formato = 'pdf') {
  if (!getVal('cedula')) { 
    Swal.fire('Falta información', 'Por favor, ingrese la Cédula del paciente.', 'warning').then(() => enfocarElementoSeguro(document.getElementById('cedula'))); 
    return; 
  }
  if (!getVal('primer_apellido')) { 
    Swal.fire('Falta información', 'Por favor, ingrese el Primer Apellido.', 'warning').then(() => enfocarElementoSeguro(document.getElementById('primer_apellido'))); 
    return; 
  }
  if (!getVal('primer_nombre')) { 
    Swal.fire('Falta información', 'Por favor, ingrese el Primer Nombre.', 'warning').then(() => enfocarElementoSeguro(document.getElementById('primer_nombre'))); 
    return; 
  }

  const esTuberculosis = getVal('tb_requiere_ficha') === 'SI';
  mostrarLoader(formato === 'excel' ? "Generando Excel..." : (esTuberculosis ? "Procesando Ficha EPI y Formulario TB..." : "Generando PDF..."));

  const aCed = getVal('cedula').trim(); const aApe = getVal('primer_apellido').trim().toUpperCase(); const aNom = getVal('primer_nombre').trim().toUpperCase();
  const nFinal = `FichasEPI_${aCed}_${aApe}_${aNom}.${formato === 'excel' ? 'xlsx' : 'pdf'}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const datosObj = JSON.parse(recopilarDatos());
    datosObj.formato = formato; 
    const payloadFinal = JSON.stringify(datosObj);

    // 1. Pedir Ficha EPI al servidor
    const response = await fetch(API_URL, { 
      method: 'POST', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payloadFinal, redirect: 'follow', signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const text = await response.text();
    const res = JSON.parse(text);

    if (!res || !res.success) throw new Error(res.error || "Error desconocido del servidor");

    if (formato === 'excel') {
      const a = document.createElement('a'); 
      a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`; 
      a.download = res.fileName || nFinal;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      ocultarLoader();
      Swal.fire({ icon: 'success', title: '¡Excel Generado!', timer: 3000, showConfirmButton: false });
      return;
    }

    // 2. FUSIÓN DE PDFS
    const mainPdfBytes = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0));
    const mainPdfDoc = await PDFDocument.load(mainPdfBytes);

    if (esTuberculosis) {
      try {
        const tbPdfResponse = await fetch('./formato_tb.pdf');
        if (!tbPdfResponse.ok) {
           throw new Error(`Error ${tbPdfResponse.status}: No se encontró formato_tb.pdf.`);
        }
        
        const tbPdfBytes = await tbPdfResponse.arrayBuffer();
        const tbDoc = await PDFDocument.load(tbPdfBytes);
        const form = tbDoc.getForm();

        const setCampo = (idPDF, valorHTML) => { 
          try { 
            if(valorHTML) {
                // Quitamos la validación 'constructor.name' porque falla en código minificado
                const field = form.getTextField(idPDF);
                field.setText(String(valorHTML));
            }
          } catch(e) {
             console.warn(`No se pudo llenar el campo de texto: ${idPDF}. Verifica que el tipo coincida en Acrobat.`);
          } 
        };

        const setCheck = (idPDF, checkedHTML) => { 
          try { 
            if(checkedHTML) {
                try {
                    // Primero intentamos marcarlo como si fuera un CheckBox real
                    const field = form.getCheckBox(idPDF);
                    field.check();
                } catch (errCheck) {
                    // Si falla (porque en Acrobat lo crearon como un campo de texto), le ponemos una "X"
                    const fieldTxt = form.getTextField(idPDF);
                    fieldTxt.setText('X');
                }
            } 
          } catch(e) {
             console.warn(`No se pudo marcar la casilla: ${idPDF}`);
          } 
        };

        // --- MAPEO DE LA LISTA EXACTA DEL ESCÁNER ---
        
        // Datos Comunes
        setCampo('institucion', getVal('institucion'));
        setCampo('establecimiento', getVal('establecimiento'));
        setCampo('provincia', getVal('prov_establecimiento'));
        setCampo('canton', getVal('canton_establecimiento'));
        setCampo('parroquia', getVal('parroquia_establecimiento'));
        const nombreCompleto = `${getVal('primer_apellido')} ${getVal('segundo_apellido')} ${getVal('primer_nombre')} ${getVal('segundo_nombre')}`.trim();
        setCampo('nombres', nombreCompleto);
        setCampo('cedula', getVal('cedula'));
        setCampo('nacionalidad', getVal('nacionalidad'));
        setCampo('sexo', getVal('sexo'));
        setCampo('direccion', `${getVal('direccion')} - Telf: ${getVal('telefono')}`);
        setCampo('etnia', getVal('etnia'));
        const fNac = getVal('fecha_nacimiento');
        if (fNac) {
            const birthDate = new Date(fNac);
            const ageDate = new Date(new Date() - birthDate.getTime()); 
            setCampo('edad', String(Math.abs(ageDate.getUTCFullYear() - 1970)));
        }

        // Datos Administrativos TB
        setCampo('zona', getVal('tb_zona'));
        setCampo('distrito', getVal('tb_distrito'));
        setCampo('fechatomamuestra', getVal('tb_fecha_toma'));
        setCampo('ESPECIFIQUEELTIPODEMUESTRA', getVal('tb_tipo_muestra'));
        setCampo('nombres_responsable_solicitud', getVal('tb_responsable'));
        setCampo('esquema_tt', getVal('tb_esquema_tt'));

        // CORRECCIÓN: Servicio (Ahora usando Radios)
        const srv = document.querySelector('input[name="tb_servicio"]:checked')?.value;
        setCheck('consulta externa', srv === 'cext');
        setCheck('hospitalizacion', srv === 'hosp');
        setCheck('emergencia', srv === 'emerg');
        
        setCampo('especialidad_cexternaoemergenciaohospitalizacion', getVal('tb_srv_esp'));
        setCheck('consultorio', getChk('tb_srv_cons'));
        setCampo('especialidad_consulltorio', getVal('tb_srv_cons_esp'));

        // Clasificación
        const tbTipo = getVal('tb_tipo');
        if(tbTipo === 'PULMONAR') setCheck('muestra_pulmonar', true);
        if(tbTipo === 'EXTRAPULMONAR') setCheck('muestra_extrapulmonar', true);

        const tbAnt = getVal('tb_antecedente');
        if(tbAnt === 'NUEVO') setCheck('casonuevotb', true);
        if(tbAnt === 'RECAIDA') setCheck('recaida', true);
        if(tbAnt === 'FRACASO') setCheck('fracaso', true);
        if(tbAnt === 'PERDIDA') setCheck('perdida_seguimiento_recuperado', true);

        // Tipo de Usuario / Comorbilidades
        setCheck('contactotbr', getChk('tb_usr_contacto'));
        setCheck('albergue_calle', getChk('tb_usr_albergue'));
        setCheck('contacto_fallecidotb', getChk('tb_usr_fallecido'));
        setCheck('adicciones_centrosatencion', getChk('tb_usr_adicciones'));
        setCheck('talentohumano', getChk('tb_usr_salud'));
        setCheck('irregularidad_tt', getChk('tb_usr_irregular'));
        setCheck('embarazo', getChk('tb_usr_embarazo'));
        setCheck('pvv', getChk('tb_usr_pvv'));
        setCheck('diabetes', getChk('tb_usr_diabetes'));
        setCheck('ppl', getChk('tb_usr_ppl'));
        setCheck('residente_zona_endemica_tb', getChk('tb_usr_endemica'));
        setCheck('reversion', getChk('tb_usr_reversion'));
        
        // CORRECCIÓN: Separación de Otras Comorbilidades vs Especificar
        setCampo('otras_comorbilidades', getVal('tb_usr_otras_txt'));
        setCampo('otros', getVal('tb_usr_otros'));

        // Criterios LAM / Especiales
        setCheck('alta_sospecha_clinicaoradio', getChk('tb_crit_alta'));
        setCheck('signosysintomastb', getChk('tb_crit_signos'));
        setCheck('gravemente_enfermo', getChk('tb_crit_grave'));
        setCheck('cd4_menor200', getChk('tb_crit_cd4'));
        setCheck('bk_al_2do_mes', getChk('tb_crit_bk2'));
        setCheck('sospecha_meningitistb', getChk('tb_crit_meningitis'));
        
        // CORRECCIÓN: Casilla "Especiales" separada del texto
        setCheck('especiales', getChk('tb_crit_especiales'));
        setCampo('especificar_otras_comorbilidades', getVal('tb_crit_especiales_txt'));

        // Diagnóstico
        setCheck('baciloscopia', getChk('tb_diag_bac'));
        setCampo('n_baciloscopia', getVal('tb_diag_bac_num'));
        setCheck('cultivomediosolido', getChk('tb_diag_cult_solido'));
        setCheck('cultivo_medio_liq', getChk('tb_diag_cult_liq'));
        setCheck('pcr_xpert_mbt_rif_ultra', getChk('tb_diag_xpert'));
        setCheck('pcr_xpert_mbt_xdr', getChk('tb_diag_xpert_xdr'));
        
        // CORRECCIÓN: Radios amplios de PCR y LAM
        const pcr1 = document.querySelector('input[name="tb_diag_pcr1"]:checked')?.value;
        if(pcr1 === 'SI') setCheck('pcr_1eraprueba_si', true);
        if(pcr1 === 'NO') setCheck('pcr_1eraprueba_no', true);

        setCheck('lam', getChk('tb_diag_lam'));
        
        const lam1 = document.querySelector('input[name="tb_diag_lam1"]:checked')?.value;
        if(lam1 === 'SI') setCheck('lam_1eraprueba_si', true);
        if(lam1 === 'NO') setCheck('lam_1eraprueba_no', true);

        setCheck('proporciones_1era', getChk('tb_diag_prop1'));
        setCheck('proporcion_2da', getChk('tb_diag_prop2'));
        setCheck('mgit1era', getChk('tb_diag_mgit1'));
        setCheck('mgit2da', getChk('tb_diag_mgit2'));
        setCheck('lpa1era', getChk('tb_diag_lpa1'));
        setCheck('lpa_2da', getChk('tb_diag_lpa2'));
        setCheck('tipificacion_micobacterias', getChk('tb_diag_tipif'));
        setCheck('ada', getChk('tb_diag_ada'));

        // Control
        setCheck('baciloscopia_control', getChk('tb_ctrl_bac'));
        setCampo('mesdett_control', getVal('tb_ctrl_bac_mes'));
        setCheck('cultivo_medio_solido_control', getChk('tb_ctrl_cult_solido'));
        setCampo('mes_tto_2', getVal('tb_ctrl_cult_solido_mes'));
        setCheck('cultivo_liq_control', getChk('tb_ctrl_cult_liq'));
        setCampo('mes_tto_3', getVal('tb_ctrl_cult_liq_mes'));
        setCheck('tb_sensible_control', getChk('tb_ctrl_sensible'));
        setCheck('tb_resistente_control', getChk('tb_ctrl_resistente'));
        setCampo('tipo_resistencia_control', getVal('tb_ctrl_resistencia'));

        // Observaciones
        setCampo('OBSERVACIONES', getVal('tb_obs'));
        setCampo('OPCIONAL', getVal('tb_opcional'));
        // --- FIN MAPEO ---

        const copiedPages = await mainPdfDoc.copyPages(tbDoc, tbDoc.getPageIndices());
        copiedPages.forEach((page) => mainPdfDoc.addPage(page));

      } catch (errTB) {
        ocultarLoader();
        Swal.fire({
          icon: 'error',
          title: 'Error exacto en la unión de PDF',
          text: errTB.message,
          footer: 'Mándame una captura de este error exacto.'
        });
        return; 
      }
    }

    const finalPdfBytes = await mainPdfDoc.save();
    const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileName || nFinal;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    ocultarLoader();
    Swal.fire({ icon: 'success', title: '¡Documento Generado!', timer: 3000, showConfirmButton: false });

  } catch (err) {
    ocultarLoader(); 
    if (err.name === 'AbortError' || err.message.includes('JSON')) { 
      Swal.fire('Servidor Saturado / Error', 'Hubo un problema de conexión.', 'warning'); 
    } else { 
      Swal.fire('Error', err.message, 'error'); 
    }
  }
}

window.descargarFichaSegura = descargarFichaSegura;
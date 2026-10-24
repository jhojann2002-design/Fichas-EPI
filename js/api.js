// js/api.js
import { API_URL, dbCie10Sppat } from './constants.js';
import { mostrarLoader, ocultarLoader, enfocarElementoSeguro } from './ui.js';
import { setCatData, catData, fillCantones, fillParroquias, getVal, getChk, recopilarDatos, calcularZonaDistrito } from './formLogic.js';
import { loadFormData } from './storage.js';
import { 
  PDFDocument, StandardFonts, TextAlignment, 
  PDFName, PDFRef, PDFDict, 
  pushGraphicsState, popGraphicsState, translate, drawObject 
} from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';

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

export function calcularSemanaEpidemiologica(fechaStr) {
  if (!fechaStr) return '';
  const partes = String(fechaStr).split('-');
  if (partes.length !== 3) return '';
  const ano = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1;
  const dia = parseInt(partes[2], 10);
  const fecha = new Date(ano, mes, dia);
  if (isNaN(fecha.getTime())) return '';

  // Norma CDC / OPS / MSP Ecuador (Semana Epidemiológica):
  // La semana corre de domingo a sábado.
  // La SE 1 es la primera semana del año que contiene al menos 4 días del año (contiene el 4 de enero).
  const dow = fecha.getDay(); // 0: domingo, ..., 6: sábado
  const startOfWeek = new Date(ano, mes, dia - dow); // domingo de esta semana
  const wednesday = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 3);
  const epiYear = wednesday.getFullYear();
  
  // Semana 1 del año epidemiológico: domingo de la semana que contiene el 4 de enero
  const jan4 = new Date(epiYear, 0, 4);
  const jan4Dow = jan4.getDay();
  const startOfEpiYear = new Date(epiYear, 0, 4 - jan4Dow);
  
  const diffDays = Math.round((startOfWeek.getTime() - startOfEpiYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(diffDays / 7) + 1;
  return weekNum > 0 ? String(weekNum) : '1';
}

export function aplanarFormularioSeguro(pdfDoc) {
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      try {
        const widgets = field.acroField.getWidgets();
        for (let j = 0; j < widgets.length; j++) {
          const widget = widgets[j];
          try {
            const normalAp = widget.getNormalAppearance();
            let apRef = null;

            if (normalAp instanceof PDFRef) {
              // Para TextFields: si el campo está vacío, NO estampar apariencias residuales de la plantilla
              if (typeof field.getText === 'function') {
                const txtVal = field.getText();
                apRef = (txtVal && String(txtVal).trim() !== '') ? normalAp : null;
              } else {
                apRef = normalAp;
              }
            } else if (normalAp instanceof PDFDict) {
              // Para CheckBoxes: si el campo está desmarcado, NO debemos sobreescribir el fondo de la plantilla
              if (typeof field.isChecked === 'function' && !field.isChecked()) {
                apRef = null;
              } else {
                const val = field.acroField.getValue();
                if (val) {
                  apRef = normalAp.get(val);
                }
                // Si la clave no coincidió y el checkbox está marcado, tomar la apariencia activa diferente de /Off
                if (!apRef && typeof field.isChecked === 'function' && field.isChecked()) {
                  const keys = normalAp.keys();
                  for (let k = 0; k < keys.length; k++) {
                    const keyStr = keys[k].asString();
                    if (keyStr !== '/Off' && keyStr !== 'Off') {
                      apRef = normalAp.get(keys[k]);
                      break;
                    }
                  }
                }
              }
            }

            // Solo se dibuja si el widget tiene un flujo de apariencia válido en memoria
            if (apRef instanceof PDFRef) {
              const pageRef = widget.P();
              let page = pdfDoc.getPages().find(p => p.ref === pageRef);
              if (!page) {
                const widgetRef = pdfDoc.context.getObjectRef(widget.dict);
                if (widgetRef && typeof pdfDoc.findPageForAnnotationRef === 'function') {
                  page = pdfDoc.findPageForAnnotationRef(widgetRef);
                }
              }

              if (page) {
                const rect = widget.getRectangle();
                const xObjectKey = page.node.newXObject('FlatWidget', apRef);
                page.pushOperators(
                  pushGraphicsState(),
                  translate(rect.x, rect.y),
                  drawObject(xObjectKey),
                  popGraphicsState()
                );
              }
            }
          } catch (errWidget) {}
        }
      } catch (errField) {}
    }

    // 1. Eliminar las anotaciones interactivas de todas las páginas para que Apple Preview y visores no muestren controles
    const pages = pdfDoc.getPages();
    for (let p = 0; p < pages.length; p++) {
      try {
        pages[p].node.delete(PDFName.of('Annots'));
      } catch (e) {}
    }

    // 2. Eliminar por completo el diccionario AcroForm del catálogo del documento
    // para que Apple Preview, QuickLook y visores antiguos NO detecten ningún formulario interactivo
    try {
      pdfDoc.catalog.delete(PDFName.of('AcroForm'));
    } catch (e) {}

    // 3. Limpiar la propiedad interna form en la instancia
    try {
      delete pdfDoc.form;
    } catch (e) {}
  } catch (errGlobal) {
    console.warn("Aviso en aplanamiento seguro:", errGlobal);
  }
}

async function procesarFichaEpiLocalmente(datosObj) {
  // Selección de plantilla según el establecimiento:
  // "Hospital General Portoviejo" usa formato_epi.pdf.
  // El resto de establecimientos usan formato_epi_resto.pdf (que incluye semanaepi).
  const estNorm = (datosObj.establecimiento || '').toUpperCase().trim();
  const esHospGeneralPortoviejo = estNorm.includes('HOSPITAL GENERAL PORTOVIEJO');
  const rutaPlantillaEpi = esHospGeneralPortoviejo ? './formato_epi.pdf' : './formato_epi_resto.pdf';

  let epiPdfResponse = await fetch(rutaPlantillaEpi);
  if (!epiPdfResponse.ok) {
    epiPdfResponse = await fetch('./formato_epi.pdf');
    if (!epiPdfResponse.ok) throw new Error(`No se encontró la plantilla EPI en el servidor.`);
  }
  
  const epiPdfBytes = await epiPdfResponse.arrayBuffer();
  const pdfDoc = await PDFDocument.load(epiPdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  // 1. Cargar la fuente Negrita en memoria
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Limpiar cualquier valor pregrabado en la plantilla PDF (ej. 'paracetamol', '*', '40', 'HOSPITAL')
  try {
    form.getFields().forEach(f => {
      if (typeof f.setText === 'function') {
        try { f.setText(''); } catch (e) {}
      }
    });
  } catch (e) {}

  // 2. Helper con CENTRADO, NEGRITA Y AUTO-AJUSTE GEOMÉTRICO REAL
  const setCampo = (idPDF, valor, opciones = { centrado: true, negrita: true }) => { 
    try { 
      if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
        const campo = form.getTextField(idPDF);
        const strVal = String(valor).trim().toUpperCase();
        const widgets = campo.acroField.getWidgets();

        const esFilaContacto = idPDF.startsWith('c_');
        const esObsContacto = idPDF.startsWith('c_obs_');

        // Ajuste geométrico de celdas en la tabla de contactos (h=7.68pt en plantilla original)
        // para evitar que el padding interno de pdf-lib recorte vertical u horizontalmente el texto
        if (esFilaContacto && widgets.length > 0) {
          const w0 = widgets[0];
          const r0 = w0.getRectangle();
          const anchoObs = 106.3; // Columna Observaciones completa (x: 478.5 .. 584.8)
          const necesitaDosLineas = esObsContacto && helveticaBold.widthOfTextAtSize(strVal, 4.6) > (anchoObs - 3.5);

          if (necesitaDosLineas) {
            try { campo.enableMultiline(); } catch (e) {}
            w0.setRectangle({
              x: 478.5,
              y: r0.y - 2.2,
              width: anchoObs,
              height: 12.2
            });
          } else {
            try { campo.disableMultiline(); } catch (e) {}
            w0.setRectangle({
              x: esObsContacto ? 478.5 : r0.x,
              y: r0.y - 0.8,
              width: esObsContacto ? anchoObs : r0.width,
              height: Math.max(r0.height, 9.3)
            });
          }
        }

        campo.setText(strVal);

        // Calcular dimensiones mínimas entre los widgets del campo
        let minW = Infinity;
        let minH = Infinity;
        widgets.forEach(w => {
          const r = w.getRectangle();
          if (r.width > 0 && r.width < minW) minW = r.width;
          if (r.height > 0 && r.height < minH) minH = r.height;
        });

        const isMulti = campo.isMultiline();
        let fs = opciones.fontSize || 7.5;

        if (isMulti && esObsContacto) {
          // Observación de contacto larga en 2 líneas dentro de la fila
          const usableW2 = Math.max(20, (minW - 3.5) * 1.9);
          fs = 4.3;
          while (fs > 3.1 && helveticaBold.widthOfTextAtSize(strVal, fs) > usableW2) {
            fs = Math.round((fs - 0.2) * 10) / 10;
          }
        } else if (!isMulti && isFinite(minW) && isFinite(minH)) {
          // Limitar altura de fuente para no cortar tildes ni la Ñ
          const maxFsByHeight = esFilaContacto ? 6.5 : Math.max(5.5, Math.min(9.0, minH * 0.75));
          fs = Math.min(fs, maxFsByHeight);
          const usableW = Math.max(8, minW - 3.5);
          while (fs > 3.3 && helveticaBold.widthOfTextAtSize(strVal, fs) > usableW) {
            fs = Math.round((fs - 0.2) * 10) / 10;
          }
        } else if (isMulti) {
          if (strVal.length > 260) fs = Math.min(fs, 5.8);
          else if (strVal.length > 140) fs = Math.min(fs, 6.5);
        }

        campo.setFontSize(fs);
        
        // Aplicar alineación
        if (opciones.centrado) {
          campo.setAlignment(TextAlignment.Center);
        } else {
          campo.setAlignment(TextAlignment.Left);
        }
        
        // Sellar la apariencia con HelveticaBold real (recibe PDFFont directamente)
        if (opciones.negrita) {
          campo.updateAppearances(helveticaBold);
        } else {
          campo.updateAppearances();
        }
      }
    } catch(e) {} 
  };
  
  const setCheck = (idPDF, checked) => { 
    try { 
      if (checked) {
        try {
          form.getCheckBox(idPDF).check();
        } catch (errCheck) {
          const txtFld = form.getTextField(idPDF);
          txtFld.setText('X');
          txtFld.setAlignment(TextAlignment.Center);
          txtFld.updateAppearances(helveticaBold);
        }
      }
    } catch(e) {} 
  };
  
  const setFechaDesglose = (baseId, dateStr) => {
    if (!dateStr) return;
    const partes = dateStr.split('-'); 
    if (partes.length === 3) {
      setCampo(`${baseId}_año`, partes[0]);
      setCampo(`${baseId}_mes`, partes[1]);
      setCampo(`${baseId}_dia`, partes[2]);
    }
  };

  setCampo('institucion', datosObj.institucion);
  setCampo('establecimiento', datosObj.establecimiento);
  setCampo('prov_establecimiento', datosObj.prov_establecimiento);
  setCampo('canton_establecimiento', datosObj.canton_establecimiento);
  setCampo('parroquia_establecimiento', datosObj.parroquia_establecimiento);
  setCampo('historia_clinica', datosObj.historia_clinica);
  setCampo('primer_apellido', datosObj.primer_apellido);
  setCampo('segundo_apellido', datosObj.segundo_apellido);
  setCampo('primer_nombre', datosObj.primer_nombre);
  setCampo('segundo_nombre', datosObj.segundo_nombre);
  setCampo('nacionalidad', datosObj.nacionalidad);
  setCampo('telefono', datosObj.telefono);
  setCampo('prov_residencia', datosObj.prov_residencia);
  setCampo('canton_residencia', datosObj.canton_residencia);
  setCampo('parroquia_residencia', datosObj.parroquia_residencia);
  
  // Excepción Alineada a la Izquierda
  setCampo('direccion', datosObj.direccion, { centrado: false, negrita: true });
  
  setCampo('estado_civil', datosObj.estado_civil);
  setCampo('etnia', datosObj.etnia);
  setCampo('escolaridad', datosObj.escolaridad);
  setCampo('Ocupación', datosObj.ocupacion);
  setCampo('nombre_madre', datosObj.nombre_madre);
  setCampo('medico_tratante', datosObj.medico_tratante);
  setCampo('diagnostico_cie10', datosObj.diagnostico_cie10);
  setCampo('semanas_gestacion', datosObj.semanas_gestacion);
  setCampo('cual_sintoma', datosObj.cual_sintoma);
  setCampo('otros_signos', datosObj.otros_signos);
  setCampo('num_dias_sintomas', datosObj.num_dias_sintomas);
  
  // Excepción Alineada a la Izquierda
  setCampo('caracterizar_signos', datosObj.caracterizar_signos, { centrado: false, negrita: true });
  
  setCampo('especificar_tratamiento', datosObj.especificar_tratamiento);
  setCampo('cuantos_controles', datosObj.cuantos_controles);
  setCampo('hc_hosp', datosObj.hc_hosp);
  setCampo('nombre_hospital', datosObj.nombre_hospital);
  setCampo('servicio_hosp', datosObj.servicio_hosp);
  setCampo('exp_otros', datosObj.exp_otros);
  setCampo('lugar_contacto', datosObj.lugar_contacto);
  setCampo('forma_contacto', datosObj.forma_contacto);
  setCampo('origen_objeto', datosObj.origen_objeto);
  setCampo('procedencia_agua_otro', datosObj.procedencia_agua_otro);
  setCampo('tipo_exposicion_otro', datosObj.tipo_exposicion_otro);
  setCampo('num_dosis', datosObj.num_dosis);
  setCampo('otras_vacunas', datosObj.otras_vacunas);
  setCampo('lugar_viaje', datosObj.lugar_viaje);
  setCampo('especificar_comor', datosObj.especificar_comor, { centrado: false, negrita: true });
  const textoFactoresYObs = [datosObj.carac_factores, datosObj.obs_epidemiologicas]
    .map(v => (v || '').trim())
    .filter(Boolean)
    .join(' | ');
  setCampo('carac_factores', textoFactoresYObs, { centrado: false, negrita: true });
  setCampo('nombre_ubicacion_laboratorio', datosObj.establecimiento || datosObj.institucion, { centrado: false, negrita: true, fontSize: 6.5 });
  setCampo('tipo_muestra', datosObj.tipo_muestra, { centrado: false, negrita: true });
  setCampo('tecnica', datosObj.tecnica, { centrado: false, negrita: true });
  setCampo('agente', datosObj.agente, { centrado: false, negrita: true });
  setCampo('resultado', datosObj.resultado, { centrado: false, negrita: true });
  // NOTA: diagnostico_def y fecha_cierre NO se llenan (uso exclusivo de Epidemiología)

  const ced = datosObj.cedula || '';
  for (let i = 0; i < 10; i++) {
    if (ced[i]) setCampo(`cedula_digito_${i+1}`, ced[i]);
  }

  if (datosObj.fecha_nacimiento && datosObj.fecha_atencion) {
    const nac = new Date(datosObj.fecha_nacimiento + 'T12:00:00');
    const atencion = new Date(datosObj.fecha_atencion + 'T12:00:00');
    let anos = atencion.getFullYear() - nac.getFullYear();
    let meses = atencion.getMonth() - nac.getMonth();
    let dias = atencion.getDate() - nac.getDate();
    
    if (dias < 0) {
      meses--;
      dias += new Date(atencion.getFullYear(), atencion.getMonth(), 0).getDate();
    }
    if (meses < 0) { anos--; meses += 12; }
    
    setCampo('edad_años', Math.max(0, anos));
    setCampo('edad_meses', Math.max(0, meses));
    setCampo('edad_días', Math.max(0, dias));
  }

  setFechaDesglose('fecha_atencion', datosObj.fecha_atencion);
  setFechaDesglose('fecha_nacimiento', datosObj.fecha_nacimiento);
  setFechaDesglose('fecha_inicio_sintomas', datosObj.fecha_inicio_sintomas);
  setFechaDesglose('fecha_sintoma_relevante', datosObj.fecha_sintoma_relevante);
  setFechaDesglose('fecha_hosp', datosObj.fecha_hosp);
  setFechaDesglose('fecha_fallecimiento', datosObj.fecha_fallecimiento);
  setFechaDesglose('fecha_contacto', datosObj.fecha_contacto);
  setFechaDesglose('fecha_desde', datosObj.fecha_desde);
  setFechaDesglose('fecha_hasta', datosObj.fecha_hasta);
  setFechaDesglose('fecha_muestra', datosObj.fecha_muestra);
  setCampo('fecha_muestra', datosObj.fecha_muestra, { centrado: true, negrita: true });
  setFechaDesglose('fecha_ultima_dosis', datosObj.fecha_ultima_dosis);

  // Cálculo y asignación de semana epidemiológica (semanaepi):
  // Se calcula a partir de la fecha de inicio de síntomas, o en su defecto de la fecha de atención.
  const fechaSemanaRef = datosObj.fecha_inicio_sintomas || datosObj.fecha_atencion;
  const numSemanaEpi = calcularSemanaEpidemiologica(fechaSemanaRef);
  setCampo('semanaepi', numSemanaEpi, { centrado: true, negrita: true, fontSize: 8 });

  setCampo('hora_inicio_sintomas', datosObj.hora_inicio_sintomas);
  setCampo('hora_sintoma_relevante', datosObj.hora_sintoma_relevante);
  setCampo('hora_contacto', datosObj.hora_contacto);

  setCheck('sexo_masculino', datosObj.sexo === 'MASCULINO');
  setCheck('sexo_femenino', datosObj.sexo === 'FEMENINO');
  setCheck('embarazada_si', datosObj.embarazada === 'SI');
  setCheck('embarazada_no', datosObj.embarazada === 'NO');

  const sintomasList = ['fiebre', 'tos', 'dolor_garganta', 'dif_respiratoria', 'cianosis', 'diarrea', 'nauseas', 'dolor_abdominal', 'deshidratacion', 'ictericia', 'anorexia', 'cefalea', 'escalofrios', 'mialgias', 'artralgia', 'sudoracion', 'sangrados', 'erupcion', 'prurito', 'adenopatias', 'convulsiones', 'alt_neuro_central', 'alt_neuro_periferico', 'vision_borrosa', 'rigidez', 'espasmo', 'apnea', 'ascitis', 'paralisis', 'estridor', 'oncocercomas', 'trismus'];
  sintomasList.forEach(s => setCheck(s, datosObj[s] === true));

  setCheck('recibio_tratamiento_si', datosObj.recibio_tratamiento === 'SI');
  setCheck('recibio_tratamiento_no', datosObj.recibio_tratamiento === 'NO');
  setCheck('evolucion_mejoro', datosObj.evolucion === 'Mejoró');
  setCheck('evolucion_iguales_condiciones', datosObj.evolucion === 'Iguales condiciones');
  setCheck('evolucion_empeoro', datosObj.evolucion === 'Empeoró');

  if (datosObj.lugar_tratamiento === 'Unidades de Salud del MSP') setCheck('lugar_tratamiento_msp', true);
  if (datosObj.lugar_tratamiento === 'Domicilio') setCheck('lugar_tratamiento_domicilio', true);
  if (datosObj.lugar_tratamiento === 'Otras Unidades de sector Público') setCheck('lugar_tratamiento_publico', true);
  if (datosObj.lugar_tratamiento === 'Farmacia') setCheck('lugar_tratamiento_farmacia', true);
  if (datosObj.lugar_tratamiento === 'Unidades de Salud Privadas') setCheck('lugar_tratamiento_privadas', true);

  setCheck('asistio_controles_si', datosObj.asistio_controles === 'SI');
  setCheck('asistio_controles_no', datosObj.asistio_controles === 'NO');
  setCheck('hospitalizado_si', datosObj.hospitalizado === 'SI');
  setCheck('hospitalizado_no', datosObj.hospitalizado === 'NO');
  setCheck('ingreso_uci_si', datosObj.ingreso_uci === 'SI');
  setCheck('ingreso_uci_no', datosObj.ingreso_uci === 'NO');
  
  setCheck('condicion_egreso_vivo', datosObj.condicion_egreso === 'VIVO');
  setCheck('condicion_egreso_muerto', datosObj.condicion_egreso === 'FALLECIDO');

  const expList = ['exp_animal_vivo', 'exp_animal_muerto', 'exp_persona_sint', 'exp_agua_suelo', 'exp_alimentos', 'exp_basurales', 'exp_plaguicidas', 'exp_metanol', 'exp_ninguno'];
  expList.forEach(e => setCheck(e, datosObj[e] === true));

  if (datosObj.procedencia_agua === 'Casa') setCheck('procedencia_agua_casa', true);
  if (datosObj.procedencia_agua === 'Restaurante') setCheck('procedencia_agua_restaurante', true);
  if (datosObj.procedencia_agua === 'Calle') setCheck('procedencia_agua_calle', true);
  if (datosObj.procedencia_agua === 'Reunión social') setCheck('procedencia_agua_reunion social', true);

  if (datosObj.tipo_exposicion === 'Ocupacional') setCheck('tipo_exposicion_ocupacional', true);
  if (datosObj.tipo_exposicion === 'Desconocida') setCheck('tipo_exposicion_desconocida', true);
  if (datosObj.tipo_exposicion === 'Accidental') setCheck('tipo_exposicion_accidental', true);

  setCheck('transfusion_si', datosObj.transfusion === 'SI');
  setCheck('transfusion_no', datosObj.transfusion === 'NO');
  setCheck('quimioterapia_si', datosObj.quimioterapia === 'SI');
  setCheck('quimioterapia_no', datosObj.quimioterapia === 'NO');

  setCheck('antecedente_vacunal_si', datosObj.antecedente_vacunal === 'SI');
  setCheck('antecedente_vacunal_no', datosObj.antecedente_vacunal === 'NO');
  setCheck('antecedente_vacunal_desconoce', datosObj.antecedente_vacunal === 'DESCONOCE');

  if (datosObj.fuente_info === 'Verbal') setCheck('fuente_info_verbal', true);
  if (datosObj.fuente_info === 'Tarjeta vacunación') setCheck('fuente_info_tarj_vacunacion', true);
  if (datosObj.fuente_info === 'Registro servicio de salud') setCheck('fuente_info_servicio_salud', true);

  const vacunasList = ['bcg', 'hb', 'rota', 'opv', 'penta', 'influenza', 'neumococo_conj', 'sr', 'fa', 'dt', 'dpt', 'srp', 'varicela', 'neumococo_poli'];
  vacunasList.forEach(v => setCheck(v, datosObj[v] === true));

  setCheck('realizo_viaje_si', datosObj.realizo_viaje === 'SI');
  setCheck('realizo_viaje_no', datosObj.realizo_viaje === 'NO');

  setCheck('otros_enfermos_si', datosObj.otros_enfermos === 'SI');
  setCheck('otros_enfermos_no', datosObj.otros_enfermos === 'NO');

  if (datosObj.tipo_caso === 'Autóctono') setCheck('tipo_caso_autoctono', true);
  if (datosObj.tipo_caso === 'Importado') setCheck('tipo_caso_importado', true);
  if (datosObj.tipo_caso === 'Introducido') setCheck('tipo_caso_introducido', true);

  if (datosObj.donde_enfermos === 'Casa') setCheck('donde_enfermos_casa', true);
  if (datosObj.donde_enfermos === 'Barrio') setCheck('donde_enfermos_barrio', true);
  if (datosObj.donde_enfermos === 'Lugar de trabajo') setCheck('donde_enfermos_lugar_trabajo', true);

  setCheck('comorbilidades_si', datosObj.comorbilidades === 'SI');
  setCheck('comorbilidades_no', datosObj.comorbilidades === 'NO');

  setCheck('muestra_si', datosObj.muestra === 'SI');
  setCheck('muestra_no', datosObj.muestra === 'NO');
  
  setCheck('muestra_adecuada_si', datosObj.muestra_adecuada === 'SI'); 
  setCheck('muestra_adecuada_no', datosObj.muestra_adecuada === 'NO');

  setCheck('antes_tratamiento_si', datosObj.antes_tratamiento === 'SI');
  setCheck('antes_tratamiento_no', datosObj.antes_tratamiento === 'NO');

  setCheck('resultado_positivo', datosObj.resultado === 'POSITIVO');
  setCheck('resultado_negativo', datosObj.resultado === 'NEGATIVO');
  setCheck('resultado_dudoso', datosObj.resultado === 'DUDOSO');

  const confPor = (datosObj.confirmado_por || '').toUpperCase();
  if (confPor.includes('LAB')) setCheck('confirmado_por_laboratorio', true);
  if (confPor.includes('CLINIC') || confPor.includes('CLÍNIC')) { 
    setCheck('confirmado_por_clinica', true); 
    setCheck('confirmado_por_clinico', true); 
  }
  if (confPor.includes('NEXO')) { 
    setCheck('confirmado_por_nexo_epi', true); 
    setCheck('confirmado_por_nexoepi', true); 
  }

  if (datosObj.tipo_caso_brote === 'CASO AISLADO') setCheck('tipo_caso_casoaislado', true);
  if (datosObj.tipo_caso_brote === 'BROTE / EPIDEMIA') setCheck('tipo_caso_brote', true);

  let sintomaticos = 0;
  const todosContactos = [...(datosObj.contactos || []), ...(datosObj.contactos_12_14 || [])];
  
  for (let i = 0; i < 14; i++) {
    const num = i + 1;
    const cont = todosContactos[i];
    
    if (cont && cont.nombre) {
      // Excepciones a la izquierda con tamaño legible (7.2 - 7.5 pt)
      setCampo(`c_nombre_${num}`, cont.nombre, { centrado: false, negrita: true, fontSize: 7.5 });
      setCampo(`c_obs_${num}`, cont.obs, { centrado: false, negrita: true, fontSize: 7.0 });
      
      // Resto toma el valor por defecto (Centrado y Negrita) con tamaño legible (7.2 - 7.5 pt)
      setCampo(`c_edad_${num}`, cont.edad, { centrado: true, negrita: true, fontSize: 7.5 });
      setCampo(`c_sexo_${num}`, cont.sexo, { centrado: true, negrita: true, fontSize: 7.5 });
      setCampo(`c_relacion_${num}`, cont.relacion, { centrado: true, negrita: true, fontSize: 7.2 });
      setCampo(`c_dir_${num}`, cont.direccion, { centrado: false, negrita: true, fontSize: 7.0 });
      setCampo(`c_lugar_${num}`, cont.lugar, { centrado: true, negrita: true, fontSize: 7.2 });
      setCampo(`c_fecha_${num}`, cont.fecha, { centrado: true, negrita: true, fontSize: 7.2 });
      
      if (cont.enfermo === 'SI') {
        setCheck(`c_enfermo_si_${num}`, true);
        sintomaticos++;
      } else {
        setCheck(`c_enfermo_no_${num}`, true);
      }
    }
  }
  setCampo('numero_contactos_sintomaticos', sintomaticos);

  // === CAMPOS ESPECÍFICOS DE PÁGINA 3 (FORMULARIO EPI-GRUPAL / NOTIFICACIÓN SEMANAL) ===
  // Clasificación final del caso
  if (datosObj.resultado === 'POSITIVO' || datosObj.confirmado_por) {
    setCheck('clasificacion_final_caso_confirmado', true);
  } else if (datosObj.resultado === 'NEGATIVO') {
    setCheck('clasificacion_final_caso_descartado', true);
  } else if (datosObj.resultado === 'DUDOSO') {
    setCheck('clasificacion_final_caso_no concluyente', true);
  }

  // Condición final del caso
  if (datosObj.condicion_egreso === 'VIVO') {
    setCheck('condicion_final_caso_vivo', true);
  } else if (datosObj.condicion_egreso === 'FALLECIDO') {
    setCheck('condicion_final_caso_muerto', true);
  }

  // Condición de egreso / hospitalización
  if (datosObj.ingreso_uci === 'SI') {
    setCheck('condicion_uci', true);
  } else if (datosObj.hospitalizado === 'SI') {
    setCheck('condicion_clinico', true);
  } else if (datosObj.hospitalizado === 'NO') {
    setCheck('condicion_egreso_ambulatorio', true);
  }

  // NOTA: fecha_cierre y diagnostico_def se dejan en blanco para ser llenados por Epidemiología

  // Lugar probable de infección y laboratorio
  setCampo('lugar_probable_infeccion', datosObj.lugar_viaje || datosObj.canton_residencia || datosObj.canton_establecimiento);
  setCampo('nombre_ubicacion_laboratorio', datosObj.establecimiento || datosObj.institucion);

  // === APLANAMIENTO FINAL SEGURO (Bake Appearance Streams) ===
  // Estampa los flujos de apariencia en negrita real (helveticaBold) directamente en la página estática
  // y elimina por completo AcroForm para que Apple Preview, QuickLook y visores antiguos
  // abran el PDF de forma 100% estática, sin controles de formulario ni distorsiones.
  aplanarFormularioSeguro(pdfDoc);
  
  return pdfDoc;
}

export async function obtenerBlobDocumento(formato) {
  const esTuberculosis = getVal('tb_requiere_ficha') === 'SI';
  const datosObj = JSON.parse(recopilarDatos());
  datosObj.formato = formato; 

  if (formato === 'excel') {
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
    
    return { blob: new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName: res.fileName };
  }

  if (formato === 'pdf') {
    const mainPdfDoc = await procesarFichaEpiLocalmente(datosObj);

    if (esTuberculosis) {
      const tbPdfResponse = await fetch('./formato_tb.pdf');
      if (!tbPdfResponse.ok) throw new Error(`Error ${tbPdfResponse.status}: No se encontró formato_tb.pdf.`);
      
      const tbPdfBytes = await tbPdfResponse.arrayBuffer();
      const tbDoc = await PDFDocument.load(tbPdfBytes, { ignoreEncryption: true });
      const form = tbDoc.getForm();
      const tbHelveticaBold = await tbDoc.embedFont(StandardFonts.HelveticaBold);
      
      const setCampo = (idPDF, valorHTML, opciones = { centrado: true, negrita: true }) => { 
        try { 
          if(valorHTML !== undefined && valorHTML !== null && valorHTML !== '') {
            const campo = form.getTextField(idPDF);
            const strVal = String(valorHTML).toUpperCase();
            campo.setText(strVal);
            
            if (opciones.fontSize) {
              campo.setFontSize(opciones.fontSize);
            } else if (strVal.length > 90) {
              campo.setFontSize(5.0);
            } else if (strVal.length > 60) {
              campo.setFontSize(5.8);
            } else if (strVal.length > 35) {
              campo.setFontSize(7.0);
            }

            if (opciones.centrado) {
              campo.setAlignment(TextAlignment.Center);
            } else {
              campo.setAlignment(TextAlignment.Left);
            }

            if (opciones.negrita) {
              campo.updateAppearances(tbHelveticaBold); // Aplica negrita obligatoria con PDFFont
            } else {
              campo.updateAppearances();
            }
          } 
        } catch(e) {} 
      };
      
      const setCheck = (idPDF, checkedHTML) => { 
        try { 
          if(checkedHTML) {
            try { 
              form.getCheckBox(idPDF).check(); 
            } catch (errCheck) { 
              const txt = form.getTextField(idPDF);
              txt.setText('X');
              txt.setAlignment(TextAlignment.Center);
              txt.updateAppearances(tbHelveticaBold);
            }
          } 
        } catch(e) {} 
      };

      let instTb = (getVal('institucion') || '').toUpperCase().trim();
      if (instTb.includes('SEGURIDAD SOCIAL') || instTb === 'IESS') {
        instTb = 'IESS';
      } else if (instTb.includes('SALUD PÚBLICA') || instTb.includes('SALUD PUBLICA') || instTb === 'MSP') {
        instTb = 'MSP';
      } else if (instTb.includes('FUERZAS ARMADAS') || instTb === 'ISSFA') {
        instTb = 'ISSFA';
      } else if (instTb.includes('POLICÍA') || instTb.includes('POLICIA') || instTb === 'ISSPOL') {
        instTb = 'ISSPOL';
      } else if (instTb.includes('RED PRIVADA') || instTb.includes('PRIVAD')) {
        instTb = 'PRIVADO';
      }
      let fontSizeInst = 7.0;
      if (instTb.length > 20) fontSizeInst = 4.2;
      else if (instTb.length > 10) fontSizeInst = 5.2;
      else if (instTb.length > 6) fontSizeInst = 6.0;
      setCampo('institucion', instTb, { centrado: true, negrita: true, fontSize: fontSizeInst });
      
      const campoTbEst = form.getTextField('establecimiento');
      try { campoTbEst.disableMultiline(); } catch (e) {}
      const estTb = (getVal('establecimiento') || '').trim();
      let fontSizeEst = 5.2;
      if (estTb.length > 40) fontSizeEst = 3.6;
      else if (estTb.length > 30) fontSizeEst = 4.0;
      else if (estTb.length > 20) fontSizeEst = 4.6;
      setCampo('establecimiento', estTb, { centrado: false, negrita: true, fontSize: fontSizeEst });
      // En la ficha TB, provincia, cantón y parroquia corresponden a los datos de residencia del paciente:
      setCampo('provincia', getVal('prov_residencia'));
      setCampo('canton', getVal('canton_residencia'));
      setCampo('parroquia', getVal('parroquia_residencia'));
      const nombreCompleto = `${getVal('primer_apellido')} ${getVal('segundo_apellido')} ${getVal('primer_nombre')} ${getVal('segundo_nombre')}`.trim();
      setCampo('nombres', nombreCompleto);
      setCampo('cedula', getVal('cedula'));
      setCampo('nacionalidad', getVal('nacionalidad'));
      setCampo('sexo', getVal('sexo'));

      // Ajuste inteligente para que direcciones largas entren perfectamente sin truncarse
      const dirTbTexto = `${getVal('direccion')} - Telf: ${getVal('telefono')}`.trim();
      let tbDirFontSize = 7.0;
      if (dirTbTexto.length > 95) tbDirFontSize = 4.5;
      else if (dirTbTexto.length > 70) tbDirFontSize = 5.2;
      else if (dirTbTexto.length > 45) tbDirFontSize = 6.0;
      setCampo('direccion', dirTbTexto, { centrado: false, negrita: true, fontSize: tbDirFontSize });
      setCampo('etnia', getVal('etnia'));
      
      const fNac = getVal('fecha_nacimiento');
      if (fNac) {
          const birthDate = new Date(fNac);
          const ageDate = new Date(new Date() - birthDate.getTime()); 
          setCampo('edad', String(Math.abs(ageDate.getUTCFullYear() - 1970)));
      }

      setCampo('zona', getVal('tb_zona'));
      setCampo('distrito', getVal('tb_distrito'));
      setCampo('fechatomamuestra', getVal('tb_fecha_toma'));
      setCampo('ESPECIFIQUEELTIPODEMUESTRA', getVal('tb_tipo_muestra'));
      setCampo('nombres_responsable_solicitud', getVal('tb_responsable'));
      setCampo('esquema_tt', getVal('tb_esquema_tt'));

      const srv = document.querySelector('input[name="tb_servicio"]:checked')?.value;
      setCheck('consulta externa', srv === 'cext');
      setCheck('hospitalizacion', srv === 'hosp');
      setCheck('emergencia', srv === 'emerg');
      
      setCampo('especialidad_cexternaoemergenciaohospitalizacion', getVal('tb_srv_esp'));
      setCheck('consultorio', getChk('tb_srv_cons'));
      setCampo('especialidad_consulltorio', getVal('tb_srv_cons_esp'));

      const tbTipo = getVal('tb_tipo');
      if(tbTipo === 'PULMONAR') setCheck('muestra_pulmonar', true);
      if(tbTipo === 'EXTRAPULMONAR') setCheck('muestra_extrapulmonar', true);

      const tbAnt = getVal('tb_antecedente');
      if(tbAnt === 'NUEVO') setCheck('casonuevotb', true);
      if(tbAnt === 'RECAIDA') setCheck('recaida', true);
      if(tbAnt === 'FRACASO') setCheck('fracaso', true);
      if(tbAnt === 'PERDIDA') setCheck('perdida_seguimiento_recuperado', true);

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
      
      const otrasComorbTxt = (getVal('tb_usr_otras_txt') || '').trim();
      const critEspTxt = (getVal('tb_crit_especiales_txt') || '').trim();
      const detalleComorb = [otrasComorbTxt, critEspTxt].filter(Boolean).join(' - ');

      // Checkbox OTRAS COMORBILIDADES
      setCheck('otras_comorbilidades', Boolean(otrasComorbTxt || critEspTxt));

      // Línea de texto ESPECIFICAR
      if (detalleComorb) {
        const fsDetalle = detalleComorb.length > 35 ? 4.8 : (detalleComorb.length > 20 ? 5.5 : 6.5);
        setCampo('especificar_otras_comorbilidades', detalleComorb, { centrado: false, negrita: true, fontSize: fsDetalle });
      }

      // Checkbox OTROS
      const otroUsrTxt = (getVal('tb_usr_otros') || '').trim();
      setCheck('otros', Boolean(otroUsrTxt));

      setCheck('alta_sospecha_clinicaoradio', getChk('tb_crit_alta'));
      setCheck('signosysintomastb', getChk('tb_crit_signos'));
      setCheck('gravemente_enfermo', getChk('tb_crit_grave'));
      setCheck('cd4_menor200', getChk('tb_crit_cd4'));
      setCheck('bk_al_2do_mes', getChk('tb_crit_bk2'));
      setCheck('sospecha_meningitistb', getChk('tb_crit_meningitis'));
      if (tbTipo === 'EXTRAPULMONAR') {
        setCheck('sospecha_tb_extapulmonar', true);
      }
      
      setCheck('especiales', getChk('tb_crit_especiales'));

      setCheck('baciloscopia', getChk('tb_diag_bac'));
      setCampo('n_baciloscopia', getVal('tb_diag_bac_num'));
      setCheck('cultivomediosolido', getChk('tb_diag_cult_solido'));
      setCheck('cultivo_medio_liq', getChk('tb_diag_cult_liq'));
      setCheck('pcr_xpert_mbt_rif_ultra', getChk('tb_diag_xpert'));
      setCheck('pcr_xpert_mbt_xdr', getChk('tb_diag_xpert_xdr'));
      
      const hasPcr = getChk('tb_diag_xpert') || getChk('tb_diag_xpert_xdr');
      if (hasPcr) {
        const pcr1 = document.querySelector('input[name="tb_diag_pcr1"]:checked')?.value;
        if (pcr1 === 'SI') setCheck('pcr_1eraprueba_si', true);
        if (pcr1 === 'NO') setCheck('pcr_1eraprueba_no', true);
      }

      const hasLam = getChk('tb_diag_lam');
      setCheck('lam', hasLam);
      if (hasLam) {
        const lam1 = document.querySelector('input[name="tb_diag_lam1"]:checked')?.value;
        if (lam1 === 'SI') setCheck('lam_1eraprueba_si', true);
        if (lam1 === 'NO') setCheck('lam_1eraprueba_no', true);
      }

      setCheck('proporciones_1era', getChk('tb_diag_prop1'));
      setCheck('proporcion_2da', getChk('tb_diag_prop2'));
      setCheck('mgit1era', getChk('tb_diag_mgit1'));
      setCheck('mgit2da', getChk('tb_diag_mgit2'));
      setCheck('lpa1era', getChk('tb_diag_lpa1'));
      setCheck('lpa_2da', getChk('tb_diag_lpa2'));
      setCheck('tipificacion_micobacterias', getChk('tb_diag_tipif'));
      setCheck('ada', getChk('tb_diag_ada'));

      setCheck('baciloscopia_control', getChk('tb_ctrl_bac'));
      setCampo('mesdett_control', getVal('tb_ctrl_bac_mes'));
      setCheck('cultivo_medio_solido_control', getChk('tb_ctrl_cult_solido'));
      setCampo('mes_tto_2', getVal('tb_ctrl_cult_solido_mes'));
      setCheck('cultivo_liq_control', getChk('tb_ctrl_cult_liq'));
      setCampo('mes_tto_3', getVal('tb_ctrl_cult_liq_mes'));
      setCheck('tb_sensible_control', getChk('tb_ctrl_sensible'));
      setCheck('tb_resistente_control', getChk('tb_ctrl_resistente'));
      const campoTbRes = form.getTextField('tipo_resistencia_control');
      try { campoTbRes.enableMultiline(); } catch (e) {}
      setCampo('tipo_resistencia_control', getVal('tb_ctrl_resistencia'), { centrado: true, negrita: true, fontSize: 4.8 });

      let obsFinalTb = (getVal('tb_obs') || '').trim();
      if (otroUsrTxt) {
        obsFinalTb = obsFinalTb ? `${obsFinalTb} | Grupo vulnerable: ${otroUsrTxt}` : `Grupo vulnerable: ${otroUsrTxt}`;
      }
      setCampo('OBSERVACIONES', obsFinalTb, { centrado: false, negrita: true, fontSize: obsFinalTb.length > 60 ? 5.8 : 7.0 });
      setCampo('OPCIONAL', getVal('tb_opcional'), { centrado: false, negrita: true });

      // Aplanar formulario de Tuberculosis conservando apariencia e impidiendo distorsiones
      aplanarFormularioSeguro(tbDoc);
      
      const numCopiasTb = (getVal('tb_copias') === '2' || getVal('tb_copias_sec') === '2' || datosObj.tb_copias === '2') ? 2 : 1;
      for (let copiaIdx = 0; copiaIdx < numCopiasTb; copiaIdx++) {
        const copiedPages = await mainPdfDoc.copyPages(tbDoc, tbDoc.getPageIndices());
        copiedPages.forEach((page) => mainPdfDoc.addPage(page));
      }
    }

    try {
      mainPdfDoc.catalog.delete(PDFName.of('AcroForm'));
    } catch (e) {}
    try {
      delete mainPdfDoc.form;
    } catch (e) {}

    let finalPdfBytes;
    try {
      finalPdfBytes = await mainPdfDoc.save({ updateFieldAppearances: false });
    } catch (errSave) {
      console.warn("Aviso al guardar con aplanado rápido, usando guardado alternativo:", errSave);
      finalPdfBytes = await mainPdfDoc.save();
    }

    return { blob: new Blob([finalPdfBytes], { type: 'application/pdf' }), fileName: null };
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
      mostrarLoader(formato === 'excel' ? "Generando Excel en el servidor..." : (esTuberculosis ? "Procesando Fichas EPI y TB..." : "Generando PDF localmente..."));
  }

  try {
    const aCed = getVal('cedula').trim(); 
    const aApe = getVal('primer_apellido').trim().toUpperCase(); 
    const aNom = getVal('primer_nombre').trim().toUpperCase();
    
    // Al pedir el Blob puro, Firebase no tendrá problemas en leerlo
    const { blob, fileName } = await obtenerBlobDocumento(formato);
    const nFinal = fileName || `FichasEPI_${aCed}_${aApe}_${aNom}.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
    
    // Si estamos en la nube, detenemos la descarga y mandamos el objeto directo
    if (retornarBlob) {
        return blob;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nFinal;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    ocultarLoader();
    Swal.fire({ icon: 'success', title: '¡Documento Generado!', timer: 3000, showConfirmButton: false });
  } catch (err) {
    if (!retornarBlob) ocultarLoader(); 
    if (retornarBlob) {
      throw err; // Lanza el error para que cloud.js lo muestre en rojo
    } else {
      Swal.fire('Error', err.message, 'error'); 
    }
  }
}

window.descargarFichaSegura = descargarFichaSegura;

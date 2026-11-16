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

export function splitDireccion(dir, maxChars = 45) {
  if (!dir) return { l1: '', l2: '' };
  const str = String(dir).trim();
  if (str.length <= maxChars) return { l1: str, l2: '' };
  let breakPoint = str.lastIndexOf(' ', maxChars);
  if (breakPoint <= 0 || breakPoint < maxChars * 0.4) {
    breakPoint = str.indexOf(' ', maxChars);
    if (breakPoint === -1) breakPoint = maxChars;
  }
  const l1 = str.substring(0, breakPoint).trim();
  const l2 = str.substring(breakPoint).trim();
  return { l1, l2 };
}

function dividirTextoPorPalabras(texto, numLineas, maxCharsPorLinea) {
  const limpio = String(texto || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!limpio) return [];
  const palabras = limpio.split(' ');
  const lineas = [];
  let actual = '';

  for (let i = 0; i < palabras.length; i++) {
    const pal = palabras[i];
    const candidato = actual ? `${actual} ${pal}` : pal;
    if (candidato.length <= maxCharsPorLinea || !actual) {
      actual = candidato;
    } else {
      if (lineas.length < numLineas - 1) {
        lineas.push(actual);
        actual = pal;
      } else {
        actual = candidato;
      }
    }
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, numLineas);
}

export function aplanarFormularioSeguro(pdfDoc) {
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    // Crear un mapa exacto de cada anotación a su respectiva página PDF
    const annotToPageMap = new Map();
    const pages = pdfDoc.getPages();
    for (let p = 0; p < pages.length; p++) {
      const page = pages[p];
      const annotsRef = page.node.get(PDFName.of('Annots'));
      const annots = pdfDoc.context.lookup(annotsRef);
      if (annots && annots.size) {
        for (let a = 0; a < annots.size(); a++) {
          const aRef = annots.get(a);
          if (aRef instanceof PDFRef) {
            annotToPageMap.set(aRef.tag || `${aRef.objectNumber} ${aRef.generationNumber} R`, page);
          }
        }
      }
    }

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
              const apResolved = pdfDoc.context.lookup(normalAp);

              // Si apunta a un diccionario de estados (CheckBox con /Off y estado activo)
              if (apResolved instanceof PDFDict && typeof apResolved.getContents !== 'function') {
                if (typeof field.isChecked === 'function' && field.isChecked()) {
                  const onVal = (typeof widget.getOnValue === 'function') ? widget.getOnValue() : null;
                  if (onVal && apResolved.get(onVal)) {
                    apRef = apResolved.get(onVal);
                  } else {
                    const keys = apResolved.keys();
                    for (let k = 0; k < keys.length; k++) {
                      const keyStr = keys[k].asString();
                      if (keyStr !== '/Off' && keyStr !== 'Off') {
                        apRef = apResolved.get(keys[k]);
                        break;
                      }
                    }
                  }
                } else {
                  apRef = null;
                }
              } else if (typeof apResolved.getContents === 'function' || !apResolved) {
                // Es un Appearance Stream directo (TextField u otro control)
                if (typeof field.getText === 'function') {
                  const txtVal = field.getText();
                  apRef = (txtVal && String(txtVal).trim() !== '') ? normalAp : null;
                } else if (typeof field.isChecked === 'function') {
                  apRef = field.isChecked() ? normalAp : null;
                } else {
                  apRef = normalAp;
                }
              }
            } else if (normalAp instanceof PDFDict) {
              // Diccionario embebido directo
              if (typeof field.isChecked === 'function' && field.isChecked()) {
                const keys = normalAp.keys();
                for (let k = 0; k < keys.length; k++) {
                  const keyStr = keys[k].asString();
                  if (keyStr !== '/Off' && keyStr !== 'Off') {
                    apRef = normalAp.get(keys[k]);
                    break;
                  }
                }
              } else {
                apRef = null;
              }
            }

            // Si tenemos un flujo de apariencia válido (Stream XObject), estamparlo en la página
            if (apRef instanceof PDFRef) {
              const widgetRef = pdfDoc.context.getObjectRef(widget.dict);
              const tag = widgetRef ? (widgetRef.tag || `${widgetRef.objectNumber} ${widgetRef.generationNumber} R`) : null;
              let page = tag ? annotToPageMap.get(tag) : null;
              if (!page) {
                const pageRef = widget.P();
                page = pages.find(p => p.ref === pageRef);
              }
              if (!page && widgetRef && typeof pdfDoc.findPageForAnnotationRef === 'function') {
                page = pdfDoc.findPageForAnnotationRef(widgetRef);
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

    // 1. Eliminar las anotaciones interactivas de todas las páginas para que visores no muestren controles
    for (let p = 0; p < pages.length; p++) {
      try {
        pages[p].node.delete(PDFName.of('Annots'));
      } catch (e) {}
    }

    // 2. Eliminar por completo el diccionario AcroForm del catálogo del documento
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

let _cacheEpiPdfBytes = null;
let _cacheEpiXlsxBytes = null;
let _cacheTbPdfBytes = null;

async function obtenerBytesPlantilla(url, tipoCache) {
  if (tipoCache === "epi_pdf" && _cacheEpiPdfBytes) return _cacheEpiPdfBytes;
  if (tipoCache === "epi_xlsx" && _cacheEpiXlsxBytes) return _cacheEpiXlsxBytes;
  if (tipoCache === "tb_pdf" && _cacheTbPdfBytes) return _cacheTbPdfBytes;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se encontró la plantilla (${url}) en el servidor.`);
  }
  const buf = await res.arrayBuffer();
  if (tipoCache === "epi_pdf") _cacheEpiPdfBytes = buf;
  if (tipoCache === "epi_xlsx") _cacheEpiXlsxBytes = buf;
  if (tipoCache === "tb_pdf") _cacheTbPdfBytes = buf;
  return buf;
}

async function procesarFichaEpiLocalmente(datosObj) {
  // Todos los establecimientos utilizan un único formato oficial (./formato_epi.pdf)
  const epiPdfBytes = await obtenerBytesPlantilla("./formato_epi.pdf", "epi_pdf");
  const pdfDoc = await PDFDocument.load(epiPdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const page1 = pages[0]; // Clinica Epidemiolo (Anverso)
  const page2 = pages[1]; // Hoja Posterior (Reverso)
  const page3 = pages[2]; // EPI-1 Individual (Notificación y Cierre de Caso)

  // Mapa O(1) de anotaciones a su página correspondiente (usado para estampar "X" uniformes)
  const annotToPageMap = new Map();
  for (let p = 0; p < pages.length; p++) {
    const pg = pages[p];
    const annotsRef = pg.node.get(PDFName.of('Annots'));
    const annots = pdfDoc.context.lookup(annotsRef);
    if (annots && annots.size) {
      for (let a = 0; a < annots.size(); a++) {
        const aRef = annots.get(a);
        if (aRef instanceof PDFRef) {
          annotToPageMap.set(aRef.tag || `${aRef.objectNumber} ${aRef.generationNumber} R`, pg);
        }
      }
    }
  }

  // Asegurar que el catálogo contenga la estructura AcroForm con los campos de todas las páginas
  if (!pdfDoc.catalog.get(PDFName.of('AcroForm'))) {
    const allAnnotRefs = [];
    for (let p = 0; p < pages.length; p++) {
      const annotsRef = pages[p].node.get(PDFName.of('Annots'));
      const annots = pdfDoc.context.lookup(annotsRef);
      if (annots && annots.size) {
        for (let i = 0; i < annots.size(); i++) {
          allAnnotRefs.push(annots.get(i));
        }
      }
    }
    const acroFormDict = pdfDoc.context.obj({
      Fields: pdfDoc.context.obj(allAnnotRefs),
      SigFlags: 3
    });
    pdfDoc.catalog.set(PDFName.of('AcroForm'), pdfDoc.context.register(acroFormDict));
  }

  const form = pdfDoc.getForm();

  // 1. Cargar las fuentes en memoria
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 2. Indexar todos los campos del formulario en un Map O(1) en una sola pasada
  const normKey = (s) => String(s || "").normalize("NFC").trim();
  const campoMap = new Map();
  const vacunaDtFields = [];

  const allFields = form.getFields();
  for (let i = 0; i < allFields.length; i++) {
    const f = allFields[i];
    const k = normKey(f.getName());
    if (!campoMap.has(k)) campoMap.set(k, []);
    campoMap.get(k).push(f);

    if (k === "vacuna_ DT") {
      vacunaDtFields.push(f);
    }
  }

  const up = (v) => String(v === undefined || v === null ? "" : v).trim().toUpperCase();

  // 3. Helper con TIPOGRAFÍA UNIFORME EN NEGRITA Y AUTO-AJUSTE HORIZONTAL
  const aplicarTextoACampo = (campo, strVal, opciones = { centrado: true, negrita: true }) => {
    try {
      try { campo.acroField.dict.delete(PDFName.of('MaxLen')); } catch (e) {}
      const widgets = campo.acroField.getWidgets();
      let minW = Infinity;
      for (let wIdx = 0; wIdx < widgets.length; wIdx++) {
        try { widgets[wIdx].dict.delete(PDFName.of('MaxLen')); } catch (e) {}
        const r = widgets[wIdx].getRectangle();
        if (r.width > 0 && r.width < minW) minW = r.width;
      }

      campo.setText(strVal);

      const isMulti = typeof campo.isMultiline === "function" && campo.isMultiline();
      let fs = opciones.fontSize || (minW < 25 ? 6.8 : 6.5);

      if (!isMulti && isFinite(minW)) {
        const usableW = Math.max(5.5, minW - 2.0);
        while (fs > 2.8 && helveticaBold.widthOfTextAtSize(strVal, fs) > usableW) {
          fs = Math.round((fs - 0.2) * 100) / 100;
        }
      } else if (isMulti) {
        if (strVal.length > 260) fs = Math.min(fs, 5.8);
        else if (strVal.length > 140) fs = Math.min(fs, 6.2);
      }

      campo.setFontSize(fs);
      campo.setAlignment(opciones.centrado ? TextAlignment.Center : TextAlignment.Left);
      campo.updateAppearances(opciones.negrita ? helveticaBold : helvetica);
    } catch (e) {}
  };

  const setCampo = (idPDF, valor, opciones = { centrado: true, negrita: true }) => {
    if (valor === undefined || valor === null) return;
    const strVal = up(valor);
    if (strVal === "") return;

    const lista = campoMap.get(normKey(idPDF));
    if (!lista || lista.length === 0) return;

    for (let i = 0; i < lista.length; i++) {
      const campo = lista[i];
      if (typeof campo.setText === "function") {
        aplicarTextoACampo(campo, strVal, opciones);
      }
    }
  };

  // Estampado tipográfico uniforme de "X" en Helvetica-Bold (6.8pt) para TODAS las casillas
  const marcarWidget = (campo) => {
    try {
      const widgets = campo.acroField.getWidgets();
      let stamped = false;
      for (let wIdx = 0; wIdx < widgets.length; wIdx++) {
        const w = widgets[wIdx];
        const wRef = pdfDoc.context.getObjectRef(w.dict);
        const tag = wRef ? (wRef.tag || `${wRef.objectNumber} ${wRef.generationNumber} R`) : null;
        let pg = tag ? annotToPageMap.get(tag) : null;
        if (!pg) {
          const pRef = w.P();
          pg = pages.find(p => p.ref === pRef);
        }
        if (pg) {
          const rect = w.getRectangle();
          const xSize = 6.8;
          const xW = helveticaBold.widthOfTextAtSize("X", xSize);
          const xH = xSize * 0.72;
          const drawX = rect.x + (rect.width - xW) / 2;
          const drawY = rect.y + (rect.height - xH) / 2 + 0.3;
          pg.drawText("X", { x: drawX, y: drawY, size: xSize, font: helveticaBold });
          stamped = true;
        }
      }
      if (!stamped && typeof campo.setText === "function") {
        aplicarTextoACampo(campo, "X", { centrado: true, negrita: true, fontSize: 6.8 });
      }
    } catch (e) {}
  };

  const setCheck = (idPDF, checked) => {
    if (!checked) return;
    const lista = campoMap.get(normKey(idPDF));
    if (!lista || lista.length === 0) return;
    for (let i = 0; i < lista.length; i++) {
      marcarWidget(lista[i]);
    }
  };

  const dibujarTextoDirecto = (page, texto, x, y, size = 6.5, maxWidth = 0) => {
    const str = up(texto);
    if (!page || !str) return;
    let fs = size;
    if (maxWidth > 0) {
      while (fs > 4.0 && helveticaBold.widthOfTextAtSize(str, fs) > maxWidth) {
        fs = Math.round((fs - 0.2) * 100) / 100;
      }
    }
    try {
      page.drawText(str, { x, y, size: fs, font: helveticaBold });
    } catch (e) {}
  };

  const dividirEnLineas = (texto, numLineas, anchoMaxPt, fontSize = 6.5) => {
    const limpio = up(texto).replace(/\s+/g, " ");
    if (!limpio) return [];
    const palabras = limpio.split(" ");
    const lineas = [];
    let actual = "";

    for (let i = 0; i < palabras.length; i++) {
      const pal = palabras[i];
      const candidato = actual ? `${actual} ${pal}` : pal;
      if (helveticaBold.widthOfTextAtSize(candidato, fontSize) <= anchoMaxPt || !actual) {
        actual = candidato;
      } else {
        if (lineas.length < numLineas - 1) {
          lineas.push(actual);
          actual = pal;
        } else {
          actual = candidato;
        }
      }
    }
    if (actual) lineas.push(actual);
    return lineas.slice(0, numLineas);
  };

  const desglosarFecha = (dateStr) => {
    if (!dateStr) return { d1: "", d2: "", m1: "", m2: "", dia: "", mes: "", ano: "" };
    const partes = String(dateStr).trim().split("-");
    if (partes.length !== 3) return { d1: "", d2: "", m1: "", m2: "", dia: "", mes: "", ano: "" };
    const ano = partes[0].trim();
    const mesPad = partes[1].trim().padStart(2, "0");
    const diaPad = partes[2].trim().padStart(2, "0");
    return {
      d1: diaPad[0] || "",
      d2: diaPad[1] || "",
      m1: mesPad[0] || "",
      m2: mesPad[1] || "",
      dia: diaPad,
      mes: mesPad,
      ano
    };
  };

  // Desglose de todas las fechas del formulario
  const fa = desglosarFecha(datosObj.fecha_atencion);
  const fn = desglosarFecha(datosObj.fecha_nacimiento);
  const fs = desglosarFecha(datosObj.fecha_inicio_sintomas);
  const fr = desglosarFecha(datosObj.fecha_sintoma_relevante);
  const fh = desglosarFecha(datosObj.fecha_hosp);
  const ff = desglosarFecha(datosObj.fecha_fallecimiento);
  const fv = desglosarFecha(datosObj.fecha_ultima_dosis);
  const fc = desglosarFecha(datosObj.fecha_contacto);
  const fvd = desglosarFecha(datosObj.fecha_desde);
  const fvh = desglosarFecha(datosObj.fecha_hasta);
  const fm = desglosarFecha(datosObj.fecha_muestra);

  // Cálculo de edad exacta (Años, Meses, Días)
  let edadAnos = "", edadMeses = "", edadDias = "";
  if (datosObj.fecha_nacimiento) {
    const nac = new Date(datosObj.fecha_nacimiento + "T12:00:00");
    const ref = datosObj.fecha_atencion ? new Date(datosObj.fecha_atencion + "T12:00:00") : new Date();
    if (!isNaN(nac.getTime()) && !isNaN(ref.getTime()) && ref >= nac) {
      let anos = ref.getFullYear() - nac.getFullYear();
      let meses = ref.getMonth() - nac.getMonth();
      let dias = ref.getDate() - nac.getDate();
      if (dias < 0) {
        meses--;
        dias += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
      }
      if (meses < 0) {
        anos--;
        meses += 12;
      }
      edadAnos = String(Math.max(0, anos));
      edadMeses = String(Math.max(0, meses));
      edadDias = String(Math.max(0, dias));
    }
  }

  const instUp = up(datosObj.institucion);
  const estabUp = up(datosObj.establecimiento);
  const sexoUp = up(datosObj.sexo);
  const embUp = sexoUp === "MASCULINO" ? "NO" : up(datosObj.embarazada);
  const semGest = (sexoUp !== "MASCULINO" && embUp === "SI") ? up(datosObj.semanas_gestacion) : "";
  const tratSi = up(datosObj.recibio_tratamiento) === "SI";
  const hospUp = up(datosObj.hospitalizado);
  const hospSi = hospUp === "SI";
  const uciUp = up(datosObj.ingreso_uci);
  const condEgUp = up(datosObj.condicion_egreso);
  const esFallecido = condEgUp === "FALLECIDO" || condEgUp === "MUERTO";
  const vacUp = up(datosObj.antecedente_vacunal);
  const expNinguno = Boolean(datosObj.exp_ninguno);
  const viajeSi = up(datosObj.realizo_viaje) === "SI";
  const muestraSi = up(datosObj.muestra) === "SI";
  const resUp = up(datosObj.resultado);
  const confPor = up(datosObj.confirmado_por);
  const lugarProbInfeccion = up(datosObj.lugar_viaje || datosObj.canton_residencia || datosObj.canton_establecimiento);

  // =========================================================================
  // PÁGINA 1: CLÍNICA EPIDEMIOLÓGICA (PUNTOS 1 AL 26)
  // =========================================================================
  setCampo("Diagnostico inicial", datosObj.diagnostico_cie10, { centrado: false, negrita: true });
  setCampo("Nombre unidad que investiga", estabUp);
  setCampo("fecha investigacion_dia_1erdigito", fa.d1);
  setCampo("fecha investigacion_dia_2dodigito", fa.d2);
  setCampo("fecha investigacion_mes_1erdigito", fa.m1);
  setCampo("fecha investigacion_mes_2dodigito", fa.m2);
  setCampo("fecha investigacion_año", fa.ano);

  setCampo("Provincia de la unidad", datosObj.prov_establecimiento);
  setCampo("Canton de la unidad", datosObj.canton_establecimiento);
  setCampo("Parroquia de la unidad", datosObj.parroquia_establecimiento);

  setCampo("Nombre_px_Primer apellido", datosObj.primer_apellido);
  setCampo("Nombre_px_Segundo apellido", datosObj.segundo_apellido);
  setCampo("Nombre_px_Primer nombre", datosObj.primer_nombre);
  setCampo("Nombre_px_Segundo nombre", datosObj.segundo_nombre);
  setCheck("Sexo masculino", sexoUp === "MASCULINO");
  setCheck("Sexo Femenino", sexoUp === "FEMENINO");

  // Punto 6: Edad en DÍAS | MESES | AÑOS
  if (edadDias !== "" || edadMeses !== "" || edadAnos !== "") {
    const edDiaPad = edadDias.padStart(2, "0");
    const edMesPad = edadMeses.padStart(2, "0");
    setCampo("fecha nacimiento_dia_ 1er digito", edDiaPad[0]);
    setCampo("fecha nacimiento_dia_ 2do digito", edDiaPad[1]);
    setCampo("fecha nacimiento_mes_ 1er digito", edMesPad[0]);
    setCampo("fecha nacimiento_mes_ 2do digito", edMesPad[1]);
    setCampo("fecha nacimiento_año", edadAnos);
  }

  setCampo("Estado Civil", datosObj.estado_civil);
  setCampo("Escolaridad", datosObj.escolaridad);
  setCampo("Ocupacion", datosObj.ocupacion, { centrado: false, negrita: true });
  setCampo("Telefono", datosObj.telefono);
  setCampo("Lugar residencia_provincia", datosObj.prov_residencia);
  setCampo("Lugar residencia_canton", datosObj.canton_residencia);
  setCampo("Lugar residencia_parroquia", datosObj.parroquia_residencia);

  // Punto 11: Dirección exacta (2 líneas)
  const dirP1 = splitDireccion(datosObj.direccion, 62);
  setCampo("Direccion exacta", dirP1.l1, { centrado: false, negrita: true });
  setCampo("Direccion exacta linea 2", dirP1.l2 || datosObj.parroquia_residencia, { centrado: false, negrita: true });

  setCampo("Nombre del paciente o responsable", datosObj.nombre_madre, { centrado: false, negrita: true });

  // Punto 13: Signos y Síntomas
  setCampo("fecha inicio cuadro clinico_hora", datosObj.hora_inicio_sintomas);
  setCampo("fecha inicio cuadro clinico_dia_1er digito", fs.d1);
  setCampo("fecha inicio cuadro clinico_dia_2do digito", fs.d2);
  setCampo("fecha inicio cuadro clinico_mes_1er digito", fs.m1);
  setCampo("fecha inicio cuadro clinico_mes_2do digito", fs.m2);
  setCampo("fecha inicio cuadro clinico_año", fs.ano);

  setCampo("cual sintoma relevante fue", datosObj.cual_sintoma);
  setCampo("fecha inicio sintoma relevante_hora", datosObj.hora_sintoma_relevante);
  setCampo("fecha inicio sintoma relevante_dia_1er digito", fr.d1);
  setCampo("fecha inicio sintoma relevante_dia_2do digito", fr.d2);
  setCampo("fecha inicio sintoma relevante_mes_1er digito", fr.m1);
  setCampo("fecha inicio sintoma relevante_mes_2do digito", fr.m2);
  setCampo("fecha inicio sintoma relevante_año", fr.ano);
  setCampo("numero de dias con sintomas", datosObj.num_dias_sintomas);

  const mapaSintomasP1 = [
    ["adenopatias", "sintomas_adenopatias"],
    ["alt_neuro_periferico", "sintomas_alt neurologicas periferic"],
    ["alt_neuro_central", "sintomas_alt neurologicas central"],
    ["anorexia", "sintomas_anorexia"],
    ["apnea", "sintomas_apnea"],
    ["artralgia", "sintomas_artralgia"],
    ["ascitis", "sintomas_ascitis"],
    ["cefalea", "sintomas_cefalea"],
    ["cianosis", "sintomas_cianosis"],
    ["convulsiones", "sintomas_convulsiones"],
    ["deshidratacion", "sintomas_deshidratacion"],
    ["diarrea", "sintomas_diarrea"],
    ["dif_respiratoria", "sintomas_dificultad respiratoria"],
    ["dolor_abdominal", "sintomas_dolor abdominal"],
    ["dolor_garganta", "sintomas_dolor de garganta"],
    ["erupcion", "sintomas_erupcion"],
    ["escalofrios", "sintomas_escalofrios"],
    ["espasmo", "sintomas_espasmo muscular"],
    ["estridor", "sintomas_estridor respiratorio"],
    ["fiebre", "sintomas_fiebre"],
    ["ictericia", "sintomas_ictericia"],
    ["mialgias", "sintomas_mialgias"],
    ["nauseas", "sintomas_nauseas/vomito"],
    ["paralisis", "sintomas_paralisis"],
    ["prurito", "sintomas_prurito"],
    ["rigidez", "sintomas_rigidez muscular"],
    ["sangrados", "sintomas_sangrados"],
    ["tos", "sintomas_tos"],
    ["trismus", "sintomas_trismus"],
    ["vision_borrosa", "sintomas_vision borrosa"]
  ];
  for (let i = 0; i < mapaSintomasP1.length; i++) {
    const [keyDatos, nombrePdf] = mapaSintomasP1[i];
    setCheck(nombrePdf, datosObj[keyDatos] === true);
  }

  const otrosSignosP1 = [
    up(datosObj.otros_signos),
    datosObj.sudoracion ? "SUDORACIÓN NOCTURNA" : "",
    datosObj.oncocercomas ? "ONCOCERCOMAS" : ""
  ].filter(Boolean).join(", ");
  setCampo("sintomas_otros signos y sintomas", otrosSignosP1, { centrado: false, negrita: true });

  // Punto 14: Caracterizar signos/síntomas más relevantes (5 líneas)
  const textoCaracSignos = up(datosObj.aplica_caracterizar_signos) === "NO" ? "" : up(datosObj.caracterizar_signos);
  if (textoCaracSignos) {
    const lineasSignos = dividirEnLineas(textoCaracSignos, 5, 498, 6.5);
    for (let i = 0; i < lineasSignos.length; i++) {
      setCampo(`caracterizas signos/sintomas mas relevantes_ linea ${i + 1}`, lineasSignos[i], { centrado: false, negrita: true, fontSize: 6.5 });
    }
  }

  // Punto 15: Tratamiento, Evolución y Lugar
  setCheck("recibio tratamiento_ si", tratSi);
  setCheck("recibio tratamiento_ no", up(datosObj.recibio_tratamiento) === "NO");
  if (tratSi && up(datosObj.especificar_tratamiento)) {
    setCampo("especificar el tratamiento", datosObj.especificar_tratamiento, { centrado: false, negrita: true, fontSize: 6.5 });
  }

  const evoUp = up(datosObj.evolucion);
  setCheck("evolucion_mejoró", evoUp === "MEJORÓ" || evoUp === "MEJORO");
  setCheck("evolucion_iguales condiciones", evoUp === "IGUALES CONDICIONES");
  setCheck("evolucion_empeoró", evoUp === "EMPEORÓ" || evoUp === "EMPEORO");

  const lugTUp = up(datosObj.lugar_tratamiento);
  if (tratSi) {
    setCheck("lugar tratamiento_unidades MSP", lugTUp === "UNIDADES DE SALUD DEL MSP");
    setCheck("lugar tratamiento_domicilio", lugTUp === "DOMICILIO");
    setCheck("lugar tratamiento_otras unidades del sector publico", lugTUp.includes("SECTOR P"));
    setCheck("lugar tratamiento_farmacia", lugTUp === "FARMACIA");
    setCheck("lugar tratamiento_unidades salud privadas", lugTUp === "UNIDADES DE SALUD PRIVADAS");
  }

  // Puntos 16 a 19: Hospitalización, UCI, Egreso y Fallecimiento
  setCheck("Hospitalizado_si", hospSi);
  setCheck("Hospitalizado_no", hospUp === "NO");
  if (hospSi) {
    setCampo("Fecha de hospitalizacion_dia_1er digito", fh.d1);
    setCampo("Fecha de hospitalizacion_dia_2do digito", fh.d2);
    setCampo("Fecha de hospitalizacion_mes_1er digito", fh.m1);
    setCampo("Fecha de hospitalizacion_mes_2do digito", fh.m2);
    setCampo("Fecha de hospitalizacion_año", fh.ano);
    setCampo("Numero historia clinica", datosObj.hc_hosp);
    setCampo("Servicio", datosObj.servicio_hosp);
    setCampo("Nombre del hospital donde fue hospitalizado", datosObj.nombre_hospital, { centrado: false, negrita: true });
    setCheck("Ingreso a UCI_si", uciUp === "SI");
    setCheck("Ingreso a UCI_no", uciUp === "NO");
  }

  setCheck("condicion egreso_vivo", condEgUp === "VIVO");
  setCheck("condicion egreso_muerto", esFallecido);
  if (esFallecido) {
    setCampo("fecha fallecimiento_dia_primer digito", ff.d1);
    setCampo("fecha fallecimiento_dia_2do digito", ff.d2);
    setCampo("fecha fallecimiento_mes_primer digito", ff.m1);
    setCampo("fecha fallecimiento_dia_segundo digito", ff.m2); // 2do dígito del mes en Página 1 (x=496.5)
    setCampo("fecha fallecimiento_año", ff.ano); // Llena tanto Página 1 como Página 3
  }

  // Puntos 20 a 23: Antecedente Vacunal
  setCheck("antecedente vacuna_si", vacUp === "SI");
  setCheck("antecedente vacuna_no", vacUp === "NO");
  setCheck("antecedente vacuna_desconoce", vacUp === "DESCONOCE");

  const mapaVacunasP1 = [
    ["bcg", "vacuna_ BCG"],
    ["hb", "vacuna_ HB"],
    ["rota", "vacuna_ ROTA"],
    ["opv", "vacuna_ OPV"],
    ["penta", "vacuna_ PENTA"],
    ["influenza", "vacuna_ INFLUENZA"],
    ["neumococo_conj", "vacuna_ NEUMOCOCO CONJUGADO"],
    ["sr", "vacuna_ SR"],
    ["fa", "vacuna_ FA"],
    ["dpt", "vacuna_ DP"],
    ["srp", "vacuna_ SRP"],
    ["varicela", "vacuna_ VARICELA"],
    ["neumococo_poli", "vacuna_ NEUMOCOCO POLISACARIDO"]
  ];
  for (let i = 0; i < mapaVacunasP1.length; i++) {
    const [keyVac, pdfVac] = mapaVacunasP1[i];
    setCheck(pdfVac, datosObj[keyVac] === true);
  }

  // Desambiguación por coordenada X para los dos campos llamados "vacuna_ DT" en Página 1:
  // x=151.51 corresponde a DT pediátrica (datosObj.dt) y x=268.53 corresponde a dT adulto (datosObj.dt_adulto)
  for (let i = 0; i < vacunaDtFields.length; i++) {
    const fDt = vacunaDtFields[i];
    try {
      const rect = fDt.acroField.getWidgets()[0].getRectangle();
      if (rect.x < 200 && datosObj.dt === true) marcarWidget(fDt);
      else if (rect.x >= 200 && datosObj.dt_adulto === true) marcarWidget(fDt);
    } catch (e) {}
  }

  setCampo("vacuna_otras", datosObj.otras_vacunas, { centrado: false, negrita: true });
  setCampo("Fecha ultima dosis_dia_primer dia", fv.d1);
  setCampo("Fecha ultima dosis_dia_segundo dia", fv.d2);
  setCampo("Fecha ultima dosis_mes_primer dia", fv.m1);
  setCampo("Fecha ultima dosis_mes_segundo dia", fv.m2);
  setCampo("Fecha ultima dosis_año", fv.ano);

  const numDosisStr = up(datosObj.num_dosis);
  if (numDosisStr) {
    if (numDosisStr.length === 1) {
      setCampo("numero de dodis vacuna recibidas_primer digito", "0");
      setCampo("numero de dodis vacuna recibidas_segundo digito", numDosisStr);
    } else {
      setCampo("numero de dodis vacuna recibidas_primer digito", numDosisStr[0]);
      setCampo("numero de dodis vacuna recibidas_segundo digito", numDosisStr[1]);
    }
  }

  const fInfoUp = up(datosObj.fuente_info);
  setCheck("fuente de informacion vacunas_ tarjeta vacunacion", fInfoUp.includes("TARJETA"));
  setCheck("fuente de informacion vacunas_ registro servicio salud", fInfoUp.includes("REGISTRO"));
  setCheck("fuente de informacion vacunas_ verbal", fInfoUp === "VERBAL");

  // Puntos 24 a 26: Antecedentes de Exposición / Conflicto con
  setCheck("antecedentes de conflicto con_ animal", !expNinguno && Boolean(datosObj.exp_animal_vivo || datosObj.exp_animal_muerto));
  setCheck("antecedentes de conflicto con_ persona sintomatica", !expNinguno && Boolean(datosObj.exp_persona_sint));
  setCheck("antecedentes de conflicto con_ alimentos", !expNinguno && Boolean(datosObj.exp_alimentos));
  setCheck("antecedentes de conflicto con_ agua/suelos", !expNinguno && Boolean(datosObj.exp_agua_suelo));
  setCheck("antecedentes de conflicto con_ basurales", !expNinguno && Boolean(datosObj.exp_basurales));
  setCheck("antecedentes de conflicto con_ metanol", !expNinguno && Boolean(datosObj.exp_metanol));
  setCheck("antecedentes de conflicto con_ metales pesados", !expNinguno && Boolean(datosObj.exp_metales_pesados));
  setCheck("antecedentes de conflicto con_ solventes", !expNinguno && Boolean(datosObj.exp_solventes));
  setCheck("antecedentes de conflicto con_ plaguicidas", !expNinguno && Boolean(datosObj.exp_plaguicidas));
  setCheck("antecedentes de conflicto con_ ninguno", expNinguno);
  setCheck("antecedentes de conflicto con_ otros", !expNinguno && Boolean(up(datosObj.exp_otros)));

  if (!expNinguno) {
    if (up(datosObj.exp_otros)) {
      dibujarTextoDirecto(page1, datosObj.exp_otros, 516, 224.9, 5.8, 34);
    }
    setCampo("antecedente de contacto_lugar geografico", datosObj.lugar_contacto);
    setCampo("antecedente de contacto_ forma de contacto", datosObj.forma_contacto);
    setCampo("antecedente de contacto_origen/tipo/nombre del objeto del contacto", datosObj.origen_objeto);
    setCampo("fecha de contacto_dia_primer digito", fc.d1);
    setCampo("fecha de contacto_dia_ segundo digito", fc.d2);
    setCampo("fecha de contacto_mes_ primer digito", fc.m1);
    setCampo("fecha de contacto_mes_ segundo digito", fc.m2);
    setCampo("fecha de contacto_año", fc.ano);
    setCampo("fecha de contacto_hora", datosObj.hora_contacto);
  }

  // =========================================================================
  // PÁGINA 2: HOJA POSTERIOR (PUNTOS 27 AL 41)
  // =========================================================================
  const habAgua = !expNinguno && Boolean(datosObj.exp_agua_suelo || datosObj.exp_alimentos);
  const procAguaVal = datosObj.procedencia_agua === "Otro" ? up(datosObj.procedencia_agua_otro) : up(datosObj.procedencia_agua);
  const esProcStd = ["CASA", "RESTAURANTE", "CALLE", "REUNIÓN SOCIAL", "REUNION SOCIAL"].includes(procAguaVal);

  if (habAgua) {
    setCheck("procedencia agua/alimentos_ casa", procAguaVal === "CASA");
    setCheck("procedencia agua/alimentos_ restaurante", procAguaVal === "RESTAURANTE");
    setCheck("procedencia agua/alimentos_ calle", procAguaVal === "CALLE");
    setCheck("procedencia agua/alimentos_ reunion social", procAguaVal === "REUNIÓN SOCIAL" || procAguaVal === "REUNION SOCIAL");
    if (procAguaVal && !esProcStd) {
      setCampo("procedencia agua/alimentos_ otros", procAguaVal, { centrado: false, negrita: true });
    }
  }

  // Punto 28: Tipo de Exposición
  const tipoExpVal = datosObj.tipo_exposicion === "Otras" ? up(datosObj.tipo_exposicion_otro) : up(datosObj.tipo_exposicion);
  const esTipoStd = ["OCUPACIONAL", "INTENCIONAL SUICIDA", "REACCIÓN ADVERSA", "REACCION ADVERSA", "ACCIDENTAL", "INTENCIONAL HOMICIDA", "DESCONOCIDA"].includes(tipoExpVal);
  if (!expNinguno && tipoExpVal) {
    setCheck("tipo exposicion_ ocupacional", tipoExpVal === "OCUPACIONAL");
    setCheck("tipo exposicion_ intencional suicida", tipoExpVal === "INTENCIONAL SUICIDA");
    setCheck("tipo exposicion_ reaccion adversa", tipoExpVal === "REACCIÓN ADVERSA" || tipoExpVal === "REACCION ADVERSA");
    setCheck("tipo exposicion_ accidental", tipoExpVal === "ACCIDENTAL");
    setCheck("tipo exposicion_ intencional homicida", tipoExpVal === "INTENCIONAL HOMICIDA");
    setCheck("tipo exposicion_ desconocida", tipoExpVal === "DESCONOCIDA");
    if (!esTipoStd) {
      const lineasTipo = dividirEnLineas(tipoExpVal, 2, 64, 6.5);
      if (lineasTipo[0]) setCampo("tipo exposicion_ otros linea 1", lineasTipo[0], { centrado: false, negrita: true });
      if (lineasTipo[1]) setCampo("tipo exposicion_ otros linea 2", lineasTipo[1], { centrado: false, negrita: true });
    }
  }

  // Punto 29: Transfusión y Embarazo (embarazada_si/no y semanas de gestacion llenan P2 y P3 simultáneamente)
  setCheck("transfusion_si", up(datosObj.transfusion) === "SI");
  setCheck("transfusion_no", up(datosObj.transfusion) === "NO");
  setCheck("embarazada_si", sexoUp !== "MASCULINO" && embUp === "SI");
  setCheck("embarazada_no", sexoUp !== "MASCULINO" && embUp === "NO");
  setCampo("semanas de gestacion", semGest, { centrado: true, negrita: true });

  // Punto 30: Viajes o visitas
  setCheck("viajes o visitas_si", viajeSi);
  setCheck("viajes o visitas_no", up(datosObj.realizo_viaje) === "NO");
  if (viajeSi) {
    setCampo("viajes o visitas_lugar", datosObj.lugar_viaje);
    setCampo("viajes o visitas_fecha estadia_desde_dia_primer digito", fvd.d1);
    setCampo("viajes o visitas_fecha estadia_desde_dia_segundo digito", fvd.d2);
    setCampo("viajes o visitas_fecha estadia_desde_mes_primer digito", fvd.m1);
    setCampo("viajes o visitas_fecha estadia_desde_mes_segundo digito", fvd.m2);
    setCampo("viajes o visitas_fecha estadia_desde_año", fvd.ano);
    setCampo("viajes o visitas_fecha estadia_hasta_dia_primer digito", fvh.d1);
    setCampo("viajes o visitas_fecha estadia_hasta_dia_segundo digito", fvh.d2);
    setCampo("viajes o visitas_fecha estadia_hasta_mes_primer digito", fvh.m1);
    setCampo("viajes o visitas_fecha estadia_hasta_mes_segundo digito", fvh.m2);
    setCampo("viajes o visitas_fecha estadia_hasta_año", fvh.ano);
  }

  // Punto 31: Caracterizar factores de riesgo (6 líneas)
  const partesFactores = [
    (up(datosObj.comorbilidades) === "SI" && up(datosObj.especificar_comor)) ? `COMORBILIDADES: ${up(datosObj.especificar_comor)}` : "",
    up(datosObj.carac_factores),
    up(datosObj.obs_epidemiologicas)
  ].filter(Boolean).join(" | ");
  if (partesFactores) {
    const lineasFactores = dividirEnLineas(partesFactores, 6, 508, 6.5);
    for (let i = 0; i < lineasFactores.length; i++) {
      setCampo(`caracterizar fact riesgos linea ${i + 1}`, lineasFactores[i], { centrado: false, negrita: true, fontSize: 6.5 });
    }
  }

  // Punto 32: Tabla de Contactos (18 filas: Row1 .. Row18) con tamaño uniforme 6.2pt
  let sintomaticos = 0;
  const todosContactos = [...(datosObj.contactos || []), ...(datosObj.contactos_12_14 || [])].slice(0, 18);
  for (let i = 0; i < 18; i++) {
    const num = i + 1;
    const cont = todosContactos[i];
    if (cont && up(cont.nombre)) {
      setCampo(`NombreRow${num}`, cont.nombre, { centrado: false, negrita: true, fontSize: 6.2 });
      setCampo(`edadRow${num}`, cont.edad, { centrado: true, negrita: true, fontSize: 6.2 });
      setCampo(`sexoRow${num}`, cont.sexo, { centrado: true, negrita: true, fontSize: 6.2 });
      setCampo(`Relación con el casoRow${num}`, cont.relacion, { centrado: true, negrita: true, fontSize: 6.2 });
      const dirYTel = [up(cont.direccion), up(cont.lugar)].filter(Boolean).join(" - ");
      setCampo(`Dirección domiciliariatelefRow${num}`, dirYTel, { centrado: false, negrita: true, fontSize: 6.2 });
      setCampo(`fecha de inicio de síntomasRow${num}`, cont.fecha, { centrado: true, negrita: true, fontSize: 6.2 });
      setCampo(`ObservacionesRow${num}`, cont.obs, { centrado: false, negrita: true, fontSize: 6.2 });

      if (up(cont.enfermo) === "SI") {
        setCheck(`síRow${num}`, true);
        sintomaticos++;
      } else {
        setCheck(`noRow${num}`, true);
      }
    }
  }

  // Puntos 33 a 41: Laboratorio, Clasificación y Responsable en Hoja Posterior
  setCheck("se tomo muestra lab_si", muestraSi);
  setCheck("se tomo muestra lab_no", up(datosObj.muestra) === "NO");
  if (muestraSi) {
    setCheck("se tomo muestra antes de dar tt_si", up(datosObj.antes_tratamiento) === "SI");
    setCheck("se tomo muestra antes de dar tt_no", up(datosObj.antes_tratamiento) === "NO");
    setCampo("tipo de muestra", datosObj.tipo_muestra, { centrado: false, negrita: true });
    const resLabP2 = [resUp, up(datosObj.agente), up(datosObj.tecnica)].filter(Boolean).join(" - ");
    setCampo("Resultado de laboratorio", resLabP2, { centrado: false, negrita: true });
  }

  // NOTA: "diagnostico definitivo" y "fecha_dia_1er digito".."fecha_año" (Fecha de cierre) se dejan en blanco para Epidemiología
  if (confPor.includes("LAB")) setCheck("diagnostico confirmado por_laboratorio", true);
  if (confPor.includes("CLINIC") || confPor.includes("CLÍNIC")) setCheck("diagnostico confirmado por_clinica", true);
  if (confPor.includes("NEXO")) setCheck("diagnostico confirmado por_nexo", true);

  // Punto 37: En caso aislado / Es parte de brote o epidemia (estampado directo en las casillas de Página 2)
  const broteUp = up(datosObj.tipo_caso_brote);
  if (broteUp.includes("AISLADO")) {
    dibujarTextoDirecto(page2, "X", 120.2, 395.3, 6.8);
  } else if (broteUp.includes("BROTE")) {
    dibujarTextoDirecto(page2, "X", 264.6, 395.3, 6.8);
  }

  setCampo("responsable nombre", ""); // Nombre responsable epid. debe ir vacío (lo llenan los epidemiólogos)

  // =========================================================================
  // PÁGINA 3: FORMULARIO EPI-1 INDIVIDUAL (NOTIFICACIÓN Y CIERRE DE CASO)
  // =========================================================================
  const fechaSemanaRef = datosObj.fecha_inicio_sintomas || datosObj.fecha_atencion;
  const numSemanaEpi = calcularSemanaEpidemiologica(fechaSemanaRef);
  setCampo("Semana EPI", numSemanaEpi, { centrado: true, negrita: true, fontSize: 7.5 });

  // 1. Institución
  if (instUp === "MSP" || instUp.includes("SALUD PÚBLICA") || instUp.includes("SALUD PUBLICA")) {
    setCheck("Institucion_MSP", true);
  } else if (instUp === "IESS" || instUp.includes("SEGURIDAD SOCIAL")) {
    setCheck("Institucion_IESS", true);
  } else if (instUp === "FFAA" || instUp === "ISSFA" || instUp.includes("FUERZAS ARMADAS")) {
    dibujarTextoDirecto(page3, "X", 156.5, 675.9, 6.8);
  } else if (instUp === "POL" || instUp === "ISSPOL" || instUp.includes("POLIC")) {
    dibujarTextoDirecto(page3, "X", 179.3, 675.9, 6.8);
  } else if (instUp.includes("JBG") || instUp.includes("BENEFICENCIA")) {
    dibujarTextoDirecto(page3, "X", 199.8, 675.9, 6.8);
  } else if (instUp === "MEC" || instUp.includes("EDUCAC")) {
    dibujarTextoDirecto(page3, "X", 218.0, 675.9, 6.8);
  } else if (instUp === "DRS") {
    dibujarTextoDirecto(page3, "X", 236.2, 675.9, 6.8);
  } else if (instUp.includes("PRIV")) {
    dibujarTextoDirecto(page3, "X", 258.4, 675.9, 6.8);
  } else if (instUp === "ONG" || instUp.includes("FUNDAC")) {
    dibujarTextoDirecto(page3, "X", 280.7, 675.9, 6.8);
  }

  // 2 al 5: Unidad y Médico notificante
  setCampo("nombre unidad que notifica", estabUp);
  setCampo("unidad_provincia", datosObj.prov_establecimiento);
  setCampo("unidad_canton", datosObj.canton_establecimiento);
  setCampo("unidad_parroquia", datosObj.parroquia_establecimiento);
  setCampo("fecha atencion_dia", fa.dia);
  setCampo("fecha atencion_mes", fa.mes);
  setCampo("fecha atencion_año", fa.ano);
  setCampo("Nombre unidad", datosObj.medico_tratante); // Casilla 5: Nombre médico o quien notifica

  // 6 al 18: Datos del Paciente en EPI-1 Individual
  setCampo("Primer apellido", datosObj.primer_apellido);
  setCampo("Segundo apellido", datosObj.segundo_apellido);
  setCampo("Primer nombre", datosObj.primer_nombre);
  setCampo("Segundo nombre", datosObj.segundo_nombre);
  setCampo("Numero de identificacion", datosObj.cedula);
  setCampo("Numero de historia clinica", datosObj.historia_clinica);
  setCampo("Nacionalidad", datosObj.nacionalidad);
  setCheck("sexo_masculino", sexoUp === "MASCULINO");
  setCheck("sexo_femenino", sexoUp === "FEMENINO");
  setCampo("Fecha nacimiento_dia", fn.dia);
  setCampo("Fecha nacimiento_mes", fn.mes);
  setCampo("Fecha nacimiento_año", fn.ano);
  setCampo("edad en años", edadAnos);
  setCampo("edad en meses", edadMeses);
  setCampo("edad en dias", edadDias);

  setCampo("lugar residencia_provincia", datosObj.prov_residencia);
  setCampo("lugar residencia_canton", datosObj.canton_residencia);
  setCampo("lugar residencia_parroquia", datosObj.parroquia_residencia);
  const dirP3 = splitDireccion(datosObj.direccion, 54);
  setCampo("direccion exacta", dirP3.l1, { centrado: false, negrita: true });
  setCampo("direccion exacta_barrio, localidad", dirP3.l2 || datosObj.parroquia_residencia, { centrado: false, negrita: true });
  setCampo("Telf", datosObj.telefono);
  setCampo("lugar probable de infeccion", lugarProbInfeccion, { centrado: false, negrita: true });

  // 19 y 20: Cuadro Clínico y Embarazo
  setCampo("fecha inicio de sintomas_dia", fs.dia);
  setCampo("fecha inicio de sintomas_mes", fs.mes);
  setCampo("fecha inicio de sintomas_año", fs.ano);
  setCampo("diagnostico inicial", datosObj.diagnostico_cie10, { centrado: false, negrita: true });

  // 21 al 25: Laboratorio en EPI-1 Individual
  setCheck("muestra laboratorio_si", muestraSi);
  setCheck("muestra laboratorio_no", up(datosObj.muestra) === "NO");
  if (muestraSi) {
    setCampo("tipo de muestra 1", datosObj.tipo_muestra, { centrado: false, negrita: true }); // Llena sección 21 y sección 23
    setCampo("fecha toma muestra_dia 1", fm.dia);
    setCampo("fecha toma muestra_mes", fm.mes);
    setCampo("fecha toma muestra_año 1", fm.ano);
    setCampo("Nombre y ubicacion del laboratorio", estabUp || instUp, { centrado: false, negrita: true, fontSize: 6.5 });
    setCampo("fecha recepcion muestra_dia_1", fm.dia);
    setCampo("fecha recepcion muestra_mes_1", fm.mes);
    setCampo("fecha recepcion muestra_año_1", fm.ano);
    setCheck("muestra adecuada_si_1", up(datosObj.muestra_adecuada) === "SI");
    setCheck("muestra adecuada_no_1", up(datosObj.muestra_adecuada) === "NO");
  }

  setCheck("resultado_positivo", resUp === "POSITIVO");
  setCheck("resultado_negativo", resUp === "NEGATIVO");
  setCheck("resultado_dudoso", resUp === "DUDOSO");
  setCampo("resultado_agente_1", datosObj.agente, { centrado: false, negrita: true });
  setCampo("resultado_agente_2", datosObj.tecnica, { centrado: false, negrita: true });

  // 25. Observaciones (estampado directo en Página 3; secciones 26 y 27 quedan en blanco para Epidemiología)
  if (up(datosObj.obs_epidemiologicas)) {
    dibujarTextoDirecto(page3, datosObj.obs_epidemiologicas, 125.4, 303.0, 6.5, 305);
  }

  // 28 al 36: Contactos sintomáticos, Evolución, Condición Final y Clasificación
  setCampo("28 N Contactos sintomáticos", String(sintomaticos));

  if (hospSi && uciUp === "SI") {
    setCheck("evolucion caso_UCI", true);
  } else if (hospSi) {
    setCheck("evolucion caso_hospitalizacion", true);
  } else if (hospUp === "NO" && datosObj.fecha_atencion) {
    setCheck("evolucion caso_ambulatorio", true);
  }

  setCheck("condicion final del caso_vivo", condEgUp === "VIVO");
  setCheck("condicion final del caso_con discapacidad", condEgUp === "CON DISCAPACIDAD");
  setCheck("condicion final del caso_muerto", esFallecido);
  if (esFallecido) {
    setCampo("fecha fallecimiento_dia", ff.dia);
    setCampo("fecha fallecimiento_mes", ff.mes);
  }

  if (resUp === "POSITIVO" || confPor) {
    setCheck("clasificacion final del caso_confirmado", true);
  } else if (resUp === "NEGATIVO") {
    setCheck("clasificacion final del caso_descartado", true);
  } else if (resUp === "DUDOSO") {
    setCheck("clasificacion final del caso_no concluyente", true);
  }

  if (confPor.includes("LAB")) setCheck("confirmado por_laboratorio", true);
  if (confPor.includes("CLINIC") || confPor.includes("CLÍNIC")) setCheck("confirmado por_clinico", true);
  if (confPor.includes("NEXO")) setCheck("confirmado por_nexo epidemio", true);

  // NOTA: "diagnostico final" (34), "35. Fecha cierre caso" y "36. Nombre responsable epid." quedan vacíos para Epidemiología

  // === APLANAMIENTO FINAL SEGURO (Bake Appearance Streams) ===
  aplanarFormularioSeguro(pdfDoc);

  return pdfDoc;
}

// ============================================================================
// GENERADOR LOCAL ULTRARRÁPIDO DE EXCEL (.XLSX) - FORMATO NUEVO (3 HOJAS)
// ============================================================================
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32Bytes(u8) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) {
    crc = CRC32_TABLE[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function inflateRawBytes(compBytes) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compBytes);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

async function deflateRawBytes(rawBytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(rawBytes);
    writer.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  } catch (e) {
    return null;
  }
}

async function leerEntriesZip(arrayBuffer) {
  const u8 = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  let eocdOffset = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Archivo XLSX inválido (EOCD no encontrado).');

  const totalEntries = dv.getUint16(eocdOffset + 10, true);
  let cdOffset = dv.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries = [];

  for (let i = 0; i < totalEntries; i++) {
    if (dv.getUint32(cdOffset, true) !== 0x02014b50) break;
    const method = dv.getUint16(cdOffset + 10, true);
    const crc = dv.getUint32(cdOffset + 16, true);
    const compSize = dv.getUint32(cdOffset + 20, true);
    const uncompSize = dv.getUint32(cdOffset + 24, true);
    const nameLen = dv.getUint16(cdOffset + 28, true);
    const extraLen = dv.getUint16(cdOffset + 30, true);
    const commentLen = dv.getUint16(cdOffset + 32, true);
    const localHeaderOffset = dv.getUint32(cdOffset + 42, true);
    const name = decoder.decode(u8.subarray(cdOffset + 46, cdOffset + 46 + nameLen));

    const lNameLen = dv.getUint16(localHeaderOffset + 26, true);
    const lExtraLen = dv.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
    const compData = u8.subarray(dataStart, dataStart + compSize);

    // Ignorar entradas de directorio vacías para cumplir estrictamente la norma OPC ECMA-376
    if (!name.endsWith('/')) {
      entries.push({ name, method, crc, compSize, uncompSize, compData });
    }
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function construirZipDesdeEntries(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue;
    const nameBytes = encoder.encode(entry.name);
    let method = entry.method;
    let compData = entry.compData;
    let uncompSize = entry.uncompSize;
    let crc = entry.crc;

    if (entry.rawBytes) {
      uncompSize = entry.rawBytes.length;
      crc = crc32Bytes(entry.rawBytes);
      const deflated = await deflateRawBytes(entry.rawBytes);
      if (deflated) {
        method = 8;
        compData = deflated;
      } else {
        method = 0;
        compData = entry.rawBytes;
      }
    }

    const compSize = compData.length;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(localHeader.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true);
    ldv.setUint16(6, 0, true);
    ldv.setUint16(8, method, true);
    ldv.setUint16(10, 0, true);
    ldv.setUint16(12, 0x21, true);
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, compSize, true);
    ldv.setUint32(22, uncompSize, true);
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cdHeader.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, method, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0x21, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, compSize, true);
    cdv.setUint32(24, uncompSize, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    cdHeader.set(nameBytes, 46);

    localParts.push(localHeader, compData);
    cdParts.push(cdHeader);
    offset += localHeader.length + compSize;
  }

  let cdSize = 0;
  cdParts.forEach(p => { cdSize += p.length; });

  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, cdParts.length, true);
  edv.setUint16(10, cdParts.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, offset, true);

  return new Blob([...localParts, ...cdParts, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

async function procesarFichaEpiExcelLocalmente(datosObj) {
  const arrayBuffer = await obtenerBytesPlantilla('./plantilla_epi_nuevo.xlsx', 'epi_xlsx');
  const entries = await leerEntriesZip(arrayBuffer);

  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

  const colToNum = (col) => {
    let n = 0;
    for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
    return n;
  };
  const splitRef = (ref) => {
    if (!ref) return ['', 0];
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    return m ? [m[1], parseInt(m[2], 10)] : ['', 0];
  };

  const getOrCreateCell = (doc, ref) => {
    const [colStr, rnum] = splitRef(ref);
    const cnum = colToNum(colStr);
    const sheetData = doc.getElementsByTagNameNS(NS, 'sheetData')[0];
    const rows = sheetData.getElementsByTagNameNS(NS, 'row');
    let targetRow = null;
    for (let i = 0; i < rows.length; i++) {
      const rn = parseInt(rows[i].getAttribute('r'), 10);
      if (rn === rnum) { targetRow = rows[i]; break; }
      if (rn > rnum) {
        targetRow = doc.createElementNS(NS, 'row');
        targetRow.setAttribute('r', String(rnum));
        sheetData.insertBefore(targetRow, rows[i]);
        break;
      }
    }
    if (!targetRow) {
      targetRow = doc.createElementNS(NS, 'row');
      targetRow.setAttribute('r', String(rnum));
      sheetData.appendChild(targetRow);
    }
    const cells = targetRow.getElementsByTagNameNS(NS, 'c');
    for (let i = 0; i < cells.length; i++) {
      const rAttr = cells[i].getAttribute('r');
      if (!rAttr) continue;
      const [cCol] = splitRef(rAttr);
      const ccnum = colToNum(cCol);
      if (ccnum === cnum) return cells[i];
      if (ccnum > cnum) {
        const nc = doc.createElementNS(NS, 'c');
        nc.setAttribute('r', ref);
        targetRow.insertBefore(nc, cells[i]);
        return nc;
      }
    }
    const nc = doc.createElementNS(NS, 'c');
    nc.setAttribute('r', ref);
    targetRow.appendChild(nc);
    return nc;
  };

  const setCellValue = (doc, ref, val, forceType = null) => {
    const c = getOrCreateCell(doc, ref);
    const fEl = c.getElementsByTagNameNS(NS, 'f')[0];
    const strVal = (val === undefined || val === null) ? '' : String(val);

    if (fEl) {
      let vEl = c.getElementsByTagNameNS(NS, 'v')[0];
      if (!vEl) {
        vEl = doc.createElementNS(NS, 'v');
        c.appendChild(vEl);
      }
      vEl.textContent = strVal;
      if (forceType === 'b') c.setAttribute('t', 'b');
      else if (forceType === 'n') c.removeAttribute('t');
      else c.setAttribute('t', 'str');
      return;
    }

    while (c.firstChild) c.removeChild(c.firstChild);
    if (strVal === '') {
      c.removeAttribute('t');
      return;
    }
    if (forceType === 'b') {
      c.setAttribute('t', 'b');
      const vEl = doc.createElementNS(NS, 'v');
      vEl.textContent = (val === true || val === 1 || val === '1') ? '1' : '0';
      c.appendChild(vEl);
    } else if (forceType === 'n' && !isNaN(Number(strVal))) {
      c.removeAttribute('t');
      const vEl = doc.createElementNS(NS, 'v');
      vEl.textContent = String(Number(strVal));
      c.appendChild(vEl);
    } else {
      c.setAttribute('t', 'inlineStr');
      const isEl = doc.createElementNS(NS, 'is');
      const tEl = doc.createElementNS(NS, 't');
      if (strVal.startsWith(' ') || strVal.endsWith(' ')) {
        tEl.setAttribute('xml:space', 'preserve');
      }
      tEl.textContent = strVal;
      isEl.appendChild(tEl);
      c.appendChild(isEl);
    }
  };

  const splitYMD = (dStr) => {
    if (!dStr) return ['', '', ''];
    const p = String(dStr).trim().split('-');
    if (p.length !== 3) return ['', '', ''];
    return [String(parseInt(p[2], 10)), String(parseInt(p[1], 10)), String(parseInt(p[0], 10))];
  };

  const splitDateDigits = (dStr) => {
    if (!dStr) return { d1: '', d2: '', m1: '', m2: '', ano: '', dia: '', mes: '' };
    const p = String(dStr).trim().split('-');
    if (p.length !== 3) return { d1: '', d2: '', m1: '', m2: '', ano: '', dia: '', mes: '' };
    const dNum = parseInt(p[2], 10);
    const mNum = parseInt(p[1], 10);
    const aNum = parseInt(p[0], 10);
    if (isNaN(dNum) || isNaN(mNum) || isNaN(aNum)) {
      return { d1: '', d2: '', m1: '', m2: '', ano: '', dia: '', mes: '' };
    }
    const diaStr = String(dNum).padStart(2, '0');
    const mesStr = String(mNum).padStart(2, '0');
    const anoStr = String(aNum);
    return {
      d1: diaStr[0],
      d2: diaStr[1],
      m1: mesStr[0],
      m2: mesStr[1],
      dia: String(dNum),
      mes: String(mNum),
      ano: anoStr
    };
  };

  const up = (v) => String(v || '').trim().toUpperCase();
  const ced = String(datosObj.cedula || '').trim();
  const hc = String(datosObj.historia_clinica || '').trim();
  const ape1 = up(datosObj.primer_apellido);
  const ape2 = up(datosObj.segundo_apellido);
  const nom1 = up(datosObj.primer_nombre);
  const nom2 = up(datosObj.segundo_nombre);

  const [fnDia, fnMes, fnAno] = splitYMD(datosObj.fecha_nacimiento);
  const [faDia, faMes, faAno] = splitYMD(datosObj.fecha_atencion);
  const [fsDia, fsMes, fsAno] = splitYMD(datosObj.fecha_inicio_sintomas);
  const [ffDia, ffMes, ffAno] = splitYMD(datosObj.fecha_fallecimiento);
  const [fmDia, fmMes, fmAno] = splitYMD(datosObj.fecha_muestra);

  const faDig = splitDateDigits(datosObj.fecha_atencion);
  const fsDig = splitDateDigits(datosObj.fecha_inicio_sintomas);
  const frDig = splitDateDigits(datosObj.fecha_sintoma_relevante);
  const fhDig = splitDateDigits(datosObj.fecha_hosp);
  const ffDig = splitDateDigits(datosObj.fecha_fallecimiento);
  const fvDig = splitDateDigits(datosObj.fecha_ultima_dosis);
  const fvdDig = splitDateDigits(datosObj.fecha_desde);
  const fvhDig = splitDateDigits(datosObj.fecha_hasta);
  const fcDig = splitDateDigits(datosObj.fecha_contacto);

  let edadAnos = '', edadMeses = '', edadDias = '';
  if (datosObj.fecha_nacimiento) {
    const nac = new Date(datosObj.fecha_nacimiento + 'T12:00:00');
    const ref = datosObj.fecha_atencion ? new Date(datosObj.fecha_atencion + 'T12:00:00') : new Date();
    if (!isNaN(nac.getTime()) && !isNaN(ref.getTime()) && ref >= nac) {
      let a = ref.getFullYear() - nac.getFullYear();
      let m = ref.getMonth() - nac.getMonth();
      let d = ref.getDate() - nac.getDate();
      if (d < 0) {
        m--;
        d += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
      }
      if (m < 0) { a--; m += 12; }
      edadAnos = String(Math.max(0, a));
      edadMeses = String(Math.max(0, m));
      edadDias = String(Math.max(0, d));
    }
  }

  const semanaEpi = calcularSemanaEpidemiologica(datosObj.fecha_inicio_sintomas || datosObj.fecha_atencion);
  const instUp = up(datosObj.institucion);
  const estabUp = up(datosObj.establecimiento);
  const provEstUp = up(datosObj.prov_establecimiento);
  const cantEstUp = up(datosObj.canton_establecimiento);
  const parrEstUp = up(datosObj.parroquia_establecimiento);
  const sexoUp = up(datosObj.sexo);
  const embUp = sexoUp === 'MASCULINO' ? 'NO' : up(datosObj.embarazada || 'NO');
  const semGest = (sexoUp !== 'MASCULINO' && embUp === 'SI') ? String(datosObj.semanas_gestacion || '').trim() : '';
  const lugarProbInfeccion = up(datosObj.lugar_viaje || datosObj.canton_residencia || datosObj.canton_establecimiento);
  const condEgUp = up(datosObj.condicion_egreso);
  const esFallecido = condEgUp === 'FALLECIDO' || condEgUp === 'MUERTO';

  const parseSheetXml = async (entryName) => {
    const entry = entries.find(e => e.name === entryName);
    if (!entry) return null;
    const raw = entry.method === 8 ? await inflateRawBytes(entry.compData) : entry.compData;
    const rawStr = decoder.decode(raw);
    const doc = parser.parseFromString(rawStr, 'application/xml');
    return { entry, doc, rawStr };
  };

  // Preservar intactos el encabezado XML y la etiqueta <worksheet ...> original de Microsoft Excel
  const serializarHojaSegura = (doc, rawXmlOriginal) => {
    let xmlOut = serializer.serializeToString(doc);
    const matchOrigOpen = rawXmlOriginal.match(/^[\s\S]*?<worksheet\b[^>]*>/);
    const matchNewOpen = xmlOut.match(/^[\s\S]*?<worksheet\b[^>]*>/);
    if (matchOrigOpen && matchNewOpen) {
      xmlOut = matchOrigOpen[0] + xmlOut.slice(matchNewOpen[0].length);
    } else if (!xmlOut.startsWith('<?xml')) {
      xmlOut = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + xmlOut;
    }
    const matchExtOrig = rawXmlOriginal.match(/<extLst>[\s\S]*?<\/extLst>/);
    const matchExtNew = xmlOut.match(/<extLst>[\s\S]*?<\/extLst>/);
    if (matchExtOrig && matchExtNew) {
      xmlOut = xmlOut.replace(/<extLst>[\s\S]*?<\/extLst>/, matchExtOrig[0]);
    }
    return encoder.encode(xmlOut);
  };

  const s1Obj = await parseSheetXml('xl/worksheets/sheet1.xml'); // Epi individual
  const s2Obj = await parseSheetXml('xl/worksheets/sheet2.xml'); // Clinica Epidemiolo
  const s3Obj = await parseSheetXml('xl/worksheets/sheet3.xml'); // Hoja Posterior

  const todosContactos = [...(datosObj.contactos || []), ...(datosObj.contactos_12_14 || [])].slice(0, 18);
  let totalSintomaticos = 0;
  todosContactos.forEach(c => { if (up(c?.enfermo) === 'SI') totalSintomaticos++; });

  const expNinguno = Boolean(datosObj.exp_ninguno);
  const procAguaVal = datosObj.procedencia_agua === 'Otro' ? up(datosObj.procedencia_agua_otro) : up(datosObj.procedencia_agua);
  const tipoExpVal = datosObj.tipo_exposicion === 'Otras' ? up(datosObj.tipo_exposicion_otro) : up(datosObj.tipo_exposicion);
  const caracSignosTxt = up(datosObj.aplica_caracterizar_signos) === 'SI' ? up(datosObj.caracterizar_signos) : '';

  // -------------------------------------------------------------------------
  // 1. HOJA 1: Epi individual
  // -------------------------------------------------------------------------
  if (s1Obj) {
    const d1 = s1Obj.doc;
    setCellValue(d1, 'W9', semanaEpi);
    setCellValue(d1, 'C13', (instUp === 'MSP' || instUp.includes('SALUD PÚBLICA') || instUp.includes('SALUD PUBLICA')) ? 'X' : '');
    setCellValue(d1, 'D13', (instUp === 'IESS' || instUp.includes('SEGURIDAD SOCIAL')) ? 'X' : '');
    setCellValue(d1, 'E13', (instUp === 'FFAA' || instUp === 'ISSFA' || instUp.includes('FUERZAS ARMADAS')) ? 'X' : '');
    setCellValue(d1, 'F13', (instUp === 'POL' || instUp === 'ISSPOL' || instUp.includes('POLIC')) ? 'X' : '');
    setCellValue(d1, 'G13', (instUp.includes('JBG') || instUp.includes('BENEFICENCIA')) ? 'X' : '');
    setCellValue(d1, 'H13', (instUp === 'MEC' || instUp.includes('EDUCAC')) ? 'X' : '');
    setCellValue(d1, 'I13', instUp === 'DRS' ? 'X' : '');
    setCellValue(d1, 'J13', instUp.includes('PRIV') ? 'X' : '');
    setCellValue(d1, 'K13', (instUp === 'ONG' || instUp.includes('FUNDAC')) ? 'X' : '');

    setCellValue(d1, 'R12', estabUp);
    setCellValue(d1, 'E15', provEstUp);
    setCellValue(d1, 'K15', cantEstUp);
    setCellValue(d1, 'R15', parrEstUp);
    setCellValue(d1, 'F18', faDia);
    setCellValue(d1, 'H18', faMes);
    setCellValue(d1, 'J18', faAno);
    setCellValue(d1, 'R18', up(datosObj.medico_tratante));

    setCellValue(d1, 'C21', ape1);
    setCellValue(d1, 'F21', ape2);
    setCellValue(d1, 'I21', nom1);
    setCellValue(d1, 'K21', nom2);
    setCellValue(d1, 'Q21', ced);
    setCellValue(d1, 'I24', hc);
    setCellValue(d1, 'Q24', up(datosObj.nacionalidad));

    setCellValue(d1, 'D26', sexoUp === 'MASCULINO' ? 'X' : '');
    setCellValue(d1, 'F26', sexoUp === 'FEMENINO' ? 'X' : '');
    setCellValue(d1, 'M26', fnDia);
    setCellValue(d1, 'N26', fnMes);
    setCellValue(d1, 'O26', fnAno);
    setCellValue(d1, 'S26', edadAnos);
    setCellValue(d1, 'U26', edadMeses);
    setCellValue(d1, 'W26', edadDias);

    setCellValue(d1, 'F29', up(datosObj.prov_residencia));
    setCellValue(d1, 'K29', up(datosObj.canton_residencia));
    setCellValue(d1, 'O29', up(datosObj.parroquia_residencia));
    const dirPartsS1 = splitDireccion(datosObj.direccion, 45);
    setCellValue(d1, 'F32', up(dirPartsS1.l1));
    setCellValue(d1, 'F33', up(dirPartsS1.l2 || datosObj.parroquia_residencia));
    setCellValue(d1, 'T32', datosObj.telefono || '');
    setCellValue(d1, 'F35', lugarProbInfeccion);

    setCellValue(d1, 'F39', fsDia);
    setCellValue(d1, 'H39', fsMes);
    setCellValue(d1, 'J39', fsAno);
    setCellValue(d1, 'Q39', up(datosObj.diagnostico_cie10));

    setCellValue(d1, 'G42', (sexoUp !== 'MASCULINO' && embUp === 'SI') ? 'X' : '');
    setCellValue(d1, 'I42', (sexoUp !== 'MASCULINO' && embUp === 'NO') ? 'X' : '');
    setCellValue(d1, 'R42', semGest);

    const muestraSi = up(datosObj.muestra) === 'SI';
    setCellValue(d1, 'G45', muestraSi ? 'X' : '');
    setCellValue(d1, 'I45', up(datosObj.muestra) === 'NO' ? 'X' : '');
    setCellValue(d1, 'O46', muestraSi ? up(datosObj.tipo_muestra) : '');
    setCellValue(d1, 'S46', muestraSi ? fmDia : '');
    setCellValue(d1, 'U46', muestraSi ? fmMes : '');
    setCellValue(d1, 'W46', muestraSi ? fmAno : '');
    // Punto 22: Nombre y ubicación del laboratorio va en la línea combinada B48:K48 (debajo de la etiqueta B47)
    setCellValue(d1, 'B48', muestraSi ? (estabUp || instUp) : '');
    setCellValue(d1, 'C52', muestraSi ? up(datosObj.tipo_muestra) : '');
    setCellValue(d1, 'I52', muestraSi ? fmDia : '');
    setCellValue(d1, 'J52', muestraSi ? fmMes : '');
    setCellValue(d1, 'K52', muestraSi ? fmAno : '');
    setCellValue(d1, 'M52', (muestraSi && up(datosObj.muestra_adecuada) === 'SI') ? 'X' : '');
    setCellValue(d1, 'N52', (muestraSi && up(datosObj.muestra_adecuada) === 'NO') ? 'X' : '');

    const resUp = up(datosObj.resultado);
    setCellValue(d1, 'F56', resUp === 'POSITIVO' ? 'X' : '');
    setCellValue(d1, 'J56', resUp === 'NEGATIVO' ? 'X' : '');
    setCellValue(d1, 'N56', resUp === 'DUDOSO' ? 'X' : '');
    setCellValue(d1, 'T56', muestraSi ? up(datosObj.agente) : '');
    setCellValue(d1, 'T57', muestraSi ? up(datosObj.tecnica) : '');
    setCellValue(d1, 'D58', up(datosObj.obs_epidemiologicas));

    // Puntos 26 y 27 quedan vacíos para Epidemiología
    setCellValue(d1, 'G60', '');
    setCellValue(d1, 'F62', '');
    setCellValue(d1, 'H62', '');
    setCellValue(d1, 'J62', '');
    setCellValue(d1, 'R62', String(totalSintomaticos), 'n');

    const hospUp = up(datosObj.hospitalizado);
    const uciUp = up(datosObj.ingreso_uci);
    setCellValue(d1, 'I65', (hospUp === 'NO' && datosObj.fecha_atencion) ? 'X' : '');
    setCellValue(d1, 'I66', (hospUp === 'SI' && uciUp !== 'SI') ? 'X' : '');
    setCellValue(d1, 'I67', (hospUp === 'SI' && uciUp === 'SI') ? 'X' : '');

    setCellValue(d1, 'W65', condEgUp === 'VIVO' ? 'X' : '');
    setCellValue(d1, 'W66', condEgUp === 'CON DISCAPACIDAD' ? 'X' : '');
    setCellValue(d1, 'W67', esFallecido ? 'X' : '');
    setCellValue(d1, 'S69', esFallecido ? ffDia : '');
    setCellValue(d1, 'U69', esFallecido ? ffMes : '');
    setCellValue(d1, 'W69', esFallecido ? ffAno : '');

    const confUp = up(datosObj.confirmado_por);
    setCellValue(d1, 'J78', (resUp === 'POSITIVO' || confUp !== '') ? 'X' : '');
    setCellValue(d1, 'O78', resUp === 'NEGATIVO' ? 'X' : '');
    setCellValue(d1, 'U78', (resUp === 'DUDOSO' || resUp === 'NO CONCLUYENTE') ? 'X' : '');
    setCellValue(d1, 'H80', confUp.includes('LAB') ? 'X' : '');
    setCellValue(d1, 'H82', confUp.includes('CL') ? 'X' : '');
    setCellValue(d1, 'H84', confUp.includes('NEXO') ? 'X' : '');
    setCellValue(d1, 'R80', '');
    setCellValue(d1, 'P82', '');
    setCellValue(d1, 'Q82', '');
    setCellValue(d1, 'R82', '');
    setCellValue(d1, 'R84', '');

    s1Obj.entry.rawBytes = serializarHojaSegura(d1, s1Obj.rawStr);
  }

  // -------------------------------------------------------------------------
  // 2. HOJA 2: Clinica Epidemiolo
  // -------------------------------------------------------------------------
  if (s2Obj) {
    const d2 = s2Obj.doc;
    setCellValue(d2, 'N5', up(datosObj.diagnostico_cie10));
    setCellValue(d2, 'H7', estabUp);
    setCellValue(d2, 'Y7', faDig.d1);
    setCellValue(d2, 'Z7', faDig.d2);
    setCellValue(d2, 'AA7', faDig.m1);
    setCellValue(d2, 'AB7', faDig.m2);
    setCellValue(d2, 'AC7', faDig.ano);
    setCellValue(d2, 'G9', provEstUp);
    setCellValue(d2, 'P9', cantEstUp);
    setCellValue(d2, 'X9', parrEstUp);

    setCellValue(d2, 'D12', ape1);
    setCellValue(d2, 'I12', ape2);
    setCellValue(d2, 'N12', nom1);
    setCellValue(d2, 'S12', nom2);
    setCellValue(d2, 'AC12', sexoUp === 'MASCULINO' ? 'X' : '');
    setCellValue(d2, 'AD12', sexoUp === 'FEMENINO' ? 'X' : '');

    // Punto 6: Edad en DÍAS (D15, E15) | MESES (F15, G15) | AÑOS (H15:I15)
    const edDiaPad = edadDias !== '' ? edadDias.padStart(2, '0') : '';
    const edMesPad = edadMeses !== '' ? edadMeses.padStart(2, '0') : '';
    setCellValue(d2, 'D15', edDiaPad ? edDiaPad[0] : '');
    setCellValue(d2, 'E15', edDiaPad ? edDiaPad[1] : '');
    setCellValue(d2, 'F15', edMesPad ? edMesPad[0] : '');
    setCellValue(d2, 'G15', edMesPad ? edMesPad[1] : '');
    setCellValue(d2, 'H15', edadAnos);

    setCellValue(d2, 'P15', up(datosObj.estado_civil));
    setCellValue(d2, 'AA15', up(datosObj.escolaridad));
    setCellValue(d2, 'D18', up(datosObj.ocupacion));
    setCellValue(d2, 'Z18', datosObj.telefono || '');
    setCellValue(d2, 'G20', up(datosObj.prov_residencia));
    setCellValue(d2, 'P20', up(datosObj.canton_residencia));
    setCellValue(d2, 'X20', up(datosObj.parroquia_residencia));
    const dirPartsS2 = splitDireccion(datosObj.direccion, 55);
    setCellValue(d2, 'G23', up(dirPartsS2.l1));
    setCellValue(d2, 'G24', up(dirPartsS2.l2 || datosObj.parroquia_residencia));
    setCellValue(d2, 'J26', up(datosObj.nombre_madre));

    setCellValue(d2, 'P28', datosObj.hora_inicio_sintomas || '');
    setCellValue(d2, 'R28', fsDig.d1);
    setCellValue(d2, 'S28', fsDig.d2);
    setCellValue(d2, 'T28', fsDig.m1);
    setCellValue(d2, 'U28', fsDig.m2);
    setCellValue(d2, 'V28', fsDig.ano);
    // H31 contiene la etiqueta impresa "relevante"; el valor va en la celda combinada J31:N31
    setCellValue(d2, 'J31', up(datosObj.cual_sintoma));
    setCellValue(d2, 'P31', datosObj.hora_sintoma_relevante || '');
    setCellValue(d2, 'R31', frDig.d1);
    setCellValue(d2, 'S31', frDig.d2);
    setCellValue(d2, 'T31', frDig.m1);
    setCellValue(d2, 'U31', frDig.m2);
    setCellValue(d2, 'V31', frDig.ano);
    setCellValue(d2, 'AB31', datosObj.num_dias_sintomas || '');

    const mapSintomasS2 = {
      J34: 'adenopatias', J35: 'alt_neuro_periferico', J36: 'alt_neuro_central', J37: 'anorexia',
      J38: 'apnea', J39: 'artralgia', J40: 'ascitis', J41: 'cefalea',
      Q34: 'cianosis', Q35: 'convulsiones', Q36: 'deshidratacion', Q37: 'diarrea',
      Q38: 'dif_respiratoria', Q39: 'dolor_abdominal', Q40: 'dolor_garganta', Q41: 'erupcion',
      X34: 'escalofrios', X35: 'espasmo', X36: 'estridor', X37: 'fiebre',
      X38: 'ictericia', X39: 'mialgias', X40: 'nauseas', X41: 'paralisis',
      AD34: 'prurito', AD35: 'rigidez', AD36: 'sangrados', AD37: 'tos',
      AD38: 'trismus', AD39: 'vision_borrosa'
    };
    Object.entries(mapSintomasS2).forEach(([cellRef, key]) => {
      setCellValue(d2, cellRef, datosObj[key] ? 'X' : '');
    });

    const otrosSigArr = [
      up(datosObj.otros_signos),
      datosObj.sudoracion ? 'SUDORACIÓN NOCTURNA' : '',
      datosObj.oncocercomas ? 'ONCOCERCOMAS' : ''
    ].filter(Boolean);
    setCellValue(d2, 'G42', otrosSigArr.join(', '));

    // Punto 14: Distribuir Caracterizar signos/síntomas en las 5 filas combinadas C45..C49
    const lineasCaracS2 = dividirTextoPorPalabras(caracSignosTxt, 5, 88);
    const filasCaracS2 = ['C45', 'C46', 'C47', 'C48', 'C49'];
    for (let i = 0; i < filasCaracS2.length; i++) {
      setCellValue(d2, filasCaracS2[i], lineasCaracS2[i] || '');
    }

    const tratSi = up(datosObj.recibio_tratamiento) === 'SI';
    setCellValue(d2, 'H51', tratSi ? 'X' : '');
    setCellValue(d2, 'K51', up(datosObj.recibio_tratamiento) === 'NO' ? 'X' : '');
    setCellValue(d2, 'Q51', tratSi ? up(datosObj.especificar_tratamiento) : '');
    const evoUp = up(datosObj.evolucion);
    setCellValue(d2, 'K53', (evoUp === 'MEJORÓ' || evoUp === 'MEJORO') ? 'X' : '');
    setCellValue(d2, 'K54', evoUp === 'IGUALES CONDICIONES' ? 'X' : '');
    setCellValue(d2, 'K55', (evoUp === 'EMPEORÓ' || evoUp === 'EMPEORO') ? 'X' : '');
    const lugTUp = up(datosObj.lugar_tratamiento);
    setCellValue(d2, 'AD53', (tratSi && lugTUp === 'UNIDADES DE SALUD DEL MSP') ? 'X' : '');
    setCellValue(d2, 'T54', (tratSi && lugTUp === 'DOMICILIO') ? 'X' : '');
    setCellValue(d2, 'AD54', (tratSi && lugTUp.includes('SECTOR P')) ? 'X' : '');
    setCellValue(d2, 'T55', (tratSi && lugTUp === 'FARMACIA') ? 'X' : '');
    setCellValue(d2, 'AD55', (tratSi && lugTUp === 'UNIDADES DE SALUD PRIVADAS') ? 'X' : '');

    const hospSi = up(datosObj.hospitalizado) === 'SI';
    setCellValue(d2, 'F57', hospSi ? 'X' : '');
    setCellValue(d2, 'I57', up(datosObj.hospitalizado) === 'NO' ? 'X' : '');
    setCellValue(d2, 'Q57', hospSi ? fhDig.d1 : '');
    setCellValue(d2, 'R57', hospSi ? fhDig.d2 : '');
    setCellValue(d2, 'S57', hospSi ? fhDig.m1 : '');
    setCellValue(d2, 'T57', hospSi ? fhDig.m2 : '');
    setCellValue(d2, 'U57', hospSi ? fhDig.ano : '');
    setCellValue(d2, 'Y57', hospSi ? up(datosObj.hc_hosp) : '');
    setCellValue(d2, 'AC57', hospSi ? up(datosObj.servicio_hosp) : '');
    setCellValue(d2, 'F60', hospSi ? up(datosObj.nombre_hospital) : '');
    setCellValue(d2, 'W60', (hospSi && up(datosObj.ingreso_uci) === 'SI') ? 'X' : '');
    setCellValue(d2, 'Z60', (hospSi && up(datosObj.ingreso_uci) === 'NO') ? 'X' : '');

    setCellValue(d2, 'H62', condEgUp === 'VIVO' ? 'X' : '');
    setCellValue(d2, 'L62', esFallecido ? 'X' : '');
    setCellValue(d2, 'X62', esFallecido ? ffDig.d1 : '');
    setCellValue(d2, 'Y62', esFallecido ? ffDig.d2 : '');
    setCellValue(d2, 'Z62', esFallecido ? ffDig.m1 : '');
    setCellValue(d2, 'AA62', esFallecido ? ffDig.m2 : '');
    setCellValue(d2, 'AB62', esFallecido ? ffDig.ano : '');

    const vacUp = up(datosObj.antecedente_vacunal);
    setCellValue(d2, 'H64', vacUp === 'SI' ? 'X' : '');
    setCellValue(d2, 'K64', vacUp === 'NO' ? 'X' : '');
    setCellValue(d2, 'P64', vacUp === 'DESCONOCE' ? 'X' : '');
    const mapVacS2 = {
      D66: 'bcg', G66: 'hb', J66: 'rota', N66: 'opv',
      Q66: 'penta', U66: 'influenza', AA66: 'neumococo_conj', AD66: 'sr',
      D68: 'fa', G68: 'dt', J68: 'dpt', N68: 'dt_adulto',
      Q68: 'srp', U68: 'varicela', AA68: 'neumococo_poli'
    };
    Object.entries(mapVacS2).forEach(([cRef, k]) => {
      setCellValue(d2, cRef, datosObj[k] ? 'X' : '');
    });
    setCellValue(d2, 'AC68', datosObj.otras_vacunas ? `OTRAS: ${up(datosObj.otras_vacunas)}` : 'otras____');
    setCellValue(d2, 'E70', fvDig.d1);
    setCellValue(d2, 'F70', fvDig.d2);
    setCellValue(d2, 'G70', fvDig.m1);
    setCellValue(d2, 'H70', fvDig.m2);
    setCellValue(d2, 'I70', fvDig.ano);

    // Punto 22: No. de dosis recibidas tiene 2 casillas de 1 dígito (Y70 y Z70)
    const numDosisStr = up(datosObj.num_dosis);
    if (numDosisStr) {
      if (numDosisStr.length === 1) {
        setCellValue(d2, 'Y70', '0');
        setCellValue(d2, 'Z70', numDosisStr);
      } else {
        setCellValue(d2, 'Y70', numDosisStr[0]);
        setCellValue(d2, 'Z70', numDosisStr[1]);
      }
    } else {
      setCellValue(d2, 'Y70', '');
      setCellValue(d2, 'Z70', '');
    }

    const fInfoUp = up(datosObj.fuente_info);
    setCellValue(d2, 'N72', fInfoUp.includes('TARJETA') ? 'X' : '');
    setCellValue(d2, 'S72', fInfoUp.includes('REGISTRO') ? 'X' : '');
    setCellValue(d2, 'Y72', fInfoUp === 'VERBAL' ? 'X' : '');

    setCellValue(d2, 'I74', (!expNinguno && (datosObj.exp_animal_vivo || datosObj.exp_animal_muerto)) ? 'X' : '');
    setCellValue(d2, 'P74', (!expNinguno && datosObj.exp_persona_sint) ? 'X' : '');
    setCellValue(d2, 'T74', (!expNinguno && datosObj.exp_alimentos) ? 'X' : '');
    setCellValue(d2, 'Y74', (!expNinguno && datosObj.exp_agua_suelo) ? 'X' : '');
    setCellValue(d2, 'AD74', (!expNinguno && datosObj.exp_basurales) ? 'X' : '');
    setCellValue(d2, 'I76', (!expNinguno && datosObj.exp_metanol) ? 'X' : '');
    setCellValue(d2, 'P76', (!expNinguno && datosObj.exp_metales_pesados) ? 'X' : '');
    setCellValue(d2, 'T76', (!expNinguno && datosObj.exp_solventes) ? 'X' : '');
    setCellValue(d2, 'Y76', (!expNinguno && datosObj.exp_plaguicidas) ? 'X' : '');
    setCellValue(d2, 'AD76', expNinguno ? 'X' : '');
    setCellValue(d2, 'AD78', !expNinguno ? up(datosObj.exp_otros) : '');

    setCellValue(d2, 'C79', !expNinguno ? up(datosObj.lugar_contacto) : '');
    setCellValue(d2, 'J79', !expNinguno ? up(datosObj.forma_contacto) : '');
    setCellValue(d2, 'S79', !expNinguno ? up(datosObj.origen_objeto) : '');
    setCellValue(d2, 'G82', !expNinguno ? fcDig.d1 : '');
    setCellValue(d2, 'H82', !expNinguno ? fcDig.d2 : '');
    setCellValue(d2, 'I82', !expNinguno ? fcDig.m1 : '');
    setCellValue(d2, 'J82', !expNinguno ? fcDig.m2 : '');
    setCellValue(d2, 'K82', !expNinguno ? fcDig.ano : '');
    setCellValue(d2, 'P82', !expNinguno ? (datosObj.hora_contacto || '') : '');

    s2Obj.entry.rawBytes = serializarHojaSegura(d2, s2Obj.rawStr);
  }

  // -------------------------------------------------------------------------
  // 3. HOJA 3: Hoja Posterior
  // -------------------------------------------------------------------------
  if (s3Obj) {
    const d3 = s3Obj.doc;
    const habAgua = !expNinguno && (datosObj.exp_agua_suelo || datosObj.exp_alimentos);
    const esProcStd = ['CASA', 'RESTAURANTE', 'CALLE', 'REUNIÓN SOCIAL', 'REUNION SOCIAL'].includes(procAguaVal);
    setCellValue(d3, 'D4', (habAgua && procAguaVal === 'CASA') ? 'X' : '');
    setCellValue(d3, 'I4', (habAgua && procAguaVal === 'RESTAURANTE') ? 'X' : '');
    setCellValue(d3, 'M4', (habAgua && procAguaVal === 'CALLE') ? 'X' : '');
    setCellValue(d3, 'R4', (habAgua && (procAguaVal === 'REUNIÓN SOCIAL' || procAguaVal === 'REUNION SOCIAL')) ? 'X' : '');
    setCellValue(d3, 'U4', (habAgua && procAguaVal && !esProcStd) ? procAguaVal : '');

    const esTipoStd = ['OCUPACIONAL', 'INTENCIONAL SUICIDA', 'REACCIÓN ADVERSA', 'REACCION ADVERSA', 'ACCIDENTAL', 'INTENCIONAL HOMICIDA', 'DESCONOCIDA'].includes(tipoExpVal);
    setCellValue(d3, 'I6', (!expNinguno && tipoExpVal === 'OCUPACIONAL') ? 'X' : '');
    setCellValue(d3, 'P6', (!expNinguno && tipoExpVal === 'INTENCIONAL SUICIDA') ? 'X' : '');
    setCellValue(d3, 'V6', (!expNinguno && (tipoExpVal === 'REACCIÓN ADVERSA' || tipoExpVal === 'REACCION ADVERSA')) ? 'X' : '');
    setCellValue(d3, 'I8', (!expNinguno && tipoExpVal === 'ACCIDENTAL') ? 'X' : '');
    setCellValue(d3, 'P8', (!expNinguno && tipoExpVal === 'INTENCIONAL HOMICIDA') ? 'X' : '');
    setCellValue(d3, 'V8', (!expNinguno && tipoExpVal === 'DESCONOCIDA') ? 'X' : '');
    if (!expNinguno && tipoExpVal && !esTipoStd) {
      const lineasTipoS3 = dividirTextoPorPalabras(tipoExpVal, 2, 20);
      setCellValue(d3, 'Z6', lineasTipoS3[0] || '');
      setCellValue(d3, 'X8', lineasTipoS3[1] || '');
    } else {
      setCellValue(d3, 'Z6', '');
      setCellValue(d3, 'X8', '');
    }

    setCellValue(d3, 'L10', up(datosObj.transfusion) === 'SI' ? 'X' : '');
    setCellValue(d3, 'O10', up(datosObj.transfusion) === 'NO' ? 'X' : '');
    setCellValue(d3, 'S10', (sexoUp !== 'MASCULINO' && embUp === 'SI') ? 'X' : '');
    setCellValue(d3, 'V10', (sexoUp !== 'MASCULINO' && embUp === 'NO') ? 'X' : '');
    setCellValue(d3, 'AD10', semGest);

    const viajeSi = up(datosObj.realizo_viaje) === 'SI';
    setCellValue(d3, 'J12', viajeSi ? 'X' : '');
    setCellValue(d3, 'L12', up(datosObj.realizo_viaje) === 'NO' ? 'X' : '');
    setCellValue(d3, 'O12', viajeSi ? up(datosObj.lugar_viaje) : '');
    setCellValue(d3, 'Y12', viajeSi ? fvdDig.d1 : '');
    setCellValue(d3, 'Z12', viajeSi ? fvdDig.d2 : '');
    setCellValue(d3, 'AA12', viajeSi ? fvdDig.m1 : '');
    setCellValue(d3, 'AB12', viajeSi ? fvdDig.m2 : '');
    setCellValue(d3, 'AC12', viajeSi ? fvdDig.ano : '');
    setCellValue(d3, 'Y13', viajeSi ? fvhDig.d1 : '');
    setCellValue(d3, 'Z13', viajeSi ? fvhDig.d2 : '');
    setCellValue(d3, 'AA13', viajeSi ? fvhDig.m1 : '');
    setCellValue(d3, 'AB13', viajeSi ? fvhDig.m2 : '');
    setCellValue(d3, 'AC13', viajeSi ? fvhDig.ano : '');

    // Punto 31: Distribuir Caracterizar factores de riesgo en las 6 filas combinadas C16..C21
    const partesFactores = [
      (up(datosObj.comorbilidades) === 'SI' && up(datosObj.especificar_comor)) ? `COMORBILIDADES: ${up(datosObj.especificar_comor)}` : '',
      up(datosObj.carac_factores),
      up(datosObj.obs_epidemiologicas)
    ].filter(Boolean).join(' | ');
    const lineasFactS3 = dividirTextoPorPalabras(partesFactores, 6, 88);
    const filasFactS3 = ['C16', 'C17', 'C18', 'C19', 'C20', 'C21'];
    for (let i = 0; i < filasFactS3.length; i++) {
      setCellValue(d3, filasFactS3[i], lineasFactS3[i] || '');
    }

    for (let i = 0; i < 18; i++) {
      const r3 = 28 + i;
      const c = todosContactos[i] || {};
      const hasNom = Boolean(c.nombre && String(c.nombre).trim());
      const dirYTel = [up(c.direccion), up(c.lugar)].filter(Boolean).join(' - ');
      setCellValue(d3, `C${r3}`, hasNom ? up(c.nombre) : '');
      setCellValue(d3, `I${r3}`, hasNom ? (c.edad || '') : '');
      setCellValue(d3, `J${r3}`, hasNom ? up(c.sexo) : '');
      setCellValue(d3, `L${r3}`, hasNom ? up(c.relacion) : '');
      setCellValue(d3, `P${r3}`, hasNom ? dirYTel : '');
      setCellValue(d3, `U${r3}`, (hasNom && up(c.enfermo) === 'SI') ? 'X' : '');
      setCellValue(d3, `V${r3}`, (hasNom && up(c.enfermo || 'NO') === 'NO') ? 'X' : '');
      setCellValue(d3, `W${r3}`, hasNom ? (c.fecha || '') : '');
      setCellValue(d3, `Y${r3}`, hasNom ? up(c.obs) : '');
    }

    const muestraSi = up(datosObj.muestra) === 'SI';
    setCellValue(d3, 'J47', muestraSi ? 'X' : '');
    setCellValue(d3, 'L47', up(datosObj.muestra) === 'NO' ? 'X' : '');
    setCellValue(d3, 'U47', (muestraSi && up(datosObj.antes_tratamiento) === 'SI') ? 'X' : '');
    setCellValue(d3, 'W47', (muestraSi && up(datosObj.antes_tratamiento) === 'NO') ? 'X' : '');
    setCellValue(d3, 'F48', muestraSi ? up(datosObj.tipo_muestra) : '');
    const resLabTxt = muestraSi ? [up(datosObj.resultado), up(datosObj.agente), up(datosObj.tecnica)].filter(Boolean).join(' - ') : '';
    setCellValue(d3, 'G51', resLabTxt);

    setCellValue(d3, 'G53', '');
    const confUp = up(datosObj.confirmado_por);
    setCellValue(d3, 'W53', confUp.includes('LAB') ? 'X' : '');
    setCellValue(d3, 'Z53', confUp.includes('CL') ? 'X' : '');
    setCellValue(d3, 'AD53', confUp.includes('NEXO') ? 'X' : '');
    const broteUp = up(datosObj.tipo_caso_brote);
    setCellValue(d3, 'E55', broteUp.includes('AISLADO') ? 'X' : '');
    setCellValue(d3, 'N55', broteUp.includes('BROTE') ? 'X' : '');
    setCellValue(d3, 'H78', '');
    setCellValue(d3, 'D80', '');
    setCellValue(d3, 'F80', '');
    setCellValue(d3, 'H80', '');

    s3Obj.entry.rawBytes = serializarHojaSegura(d3, s3Obj.rawStr);
  }

  return await construirZipDesdeEntries(entries);
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
    const mainPdfDoc = await procesarFichaEpiLocalmente(datosObj);

    if (esTuberculosis) {
      const tbPdfBytes = await obtenerBytesPlantilla('./formato_tb.pdf', 'tb_pdf');
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
              campo.updateAppearances(tbHelveticaBold);
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
      setCampo('provincia', getVal('prov_residencia'));
      setCampo('canton', getVal('canton_residencia'));
      setCampo('parroquia', getVal('parroquia_residencia'));
      const nombreCompleto = `${getVal('primer_apellido')} ${getVal('segundo_apellido')} ${getVal('primer_nombre')} ${getVal('segundo_nombre')}`.trim();
      setCampo('nombres', nombreCompleto);
      setCampo('cedula', getVal('cedula'));
      setCampo('nacionalidad', getVal('nacionalidad'));
      setCampo('sexo', getVal('sexo'));

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

      setCheck('otras_comorbilidades', Boolean(otrasComorbTxt || critEspTxt));

      if (detalleComorb) {
        const fsDetalle = detalleComorb.length > 35 ? 4.8 : (detalleComorb.length > 20 ? 5.5 : 6.5);
        setCampo('especificar_otras_comorbilidades', detalleComorb, { centrado: false, negrita: true, fontSize: fsDetalle });
      }

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

// js/epiPdf.js
// Generación local de Fichas EPI (Formato Nuevo 3 páginas) y Solicitud de Tuberculosis en PDF

import { getVal, getChk } from './formLogic.js';
import {
  PDFDocument, StandardFonts, TextAlignment,
  PDFName, PDFRef, PDFDict,
  pushGraphicsState, popGraphicsState, translate, drawObject
} from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { calcularSemanaEpidemiologica, splitDireccion, obtenerBytesPlantilla } from './epiUtils.js';

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

export async function procesarFichaEpiLocalmente(datosObj) {
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

  // 3. Helper con TIPOGRAFÍA UNIFORME EN NEGRITA (6.5pt), CENTRADO Y SIN DESBORDAMIENTO
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
      let fs = (opciones && typeof opciones.fontSize === "number") ? opciones.fontSize : 6.5;

      if (!isMulti && isFinite(minW) && minW > 0) {
        const usableW = Math.max(5.0, minW - 2.5);
        while (fs > 3.8 && helveticaBold.widthOfTextAtSize(strVal, fs) > usableW) {
          fs = Math.round((fs - 0.1) * 100) / 100;
        }
      }

      campo.setFontSize(fs);
      campo.setAlignment((opciones && opciones.centrado === false) ? TextAlignment.Left : TextAlignment.Center);
      campo.updateAppearances(helveticaBold);
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
          const xSize = 6.5;
          const xW = helveticaBold.widthOfTextAtSize("X", xSize);
          const xH = xSize * 0.72;
          const drawX = rect.x + (rect.width - xW) / 2;
          const drawY = rect.y + (rect.height - xH) / 2 + 0.3;
          pg.drawText("X", { x: drawX, y: drawY, size: xSize, font: helveticaBold });
          stamped = true;
        }
      }
      if (!stamped && typeof campo.setText === "function") {
        aplicarTextoACampo(campo, "X", { centrado: true, negrita: true, fontSize: 6.5 });
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
      while (fs > 3.8 && helveticaBold.widthOfTextAtSize(str, fs) > maxWidth) {
        fs = Math.round((fs - 0.1) * 100) / 100;
      }
    }
    let drawX = x;
    if (maxWidth > 0) {
      const tw = helveticaBold.widthOfTextAtSize(str, fs);
      drawX = x + Math.max(0, (maxWidth - tw) / 2);
    }
    try {
      page.drawText(str, { x: drawX, y, size: fs, font: helveticaBold });
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
  setCampo("Diagnostico inicial", datosObj.diagnostico_cie10, { centrado: true, negrita: true });
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
  setCampo("Ocupacion", datosObj.ocupacion, { centrado: true, negrita: true });
  setCampo("Telefono", datosObj.telefono);
  setCampo("Lugar residencia_provincia", datosObj.prov_residencia);
  setCampo("Lugar residencia_canton", datosObj.canton_residencia);
  setCampo("Lugar residencia_parroquia", datosObj.parroquia_residencia);

  // Punto 11: Dirección exacta (2 líneas)
  const dirP1 = splitDireccion(datosObj.direccion, 62);
  setCampo("Direccion exacta", dirP1.l1, { centrado: true, negrita: true });
  setCampo("Direccion exacta linea 2", dirP1.l2 || datosObj.parroquia_residencia, { centrado: true, negrita: true });

  setCampo("Nombre del paciente o responsable", datosObj.nombre_madre, { centrado: true, negrita: true });

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
  setCampo("sintomas_otros signos y sintomas", otrosSignosP1, { centrado: true, negrita: true });

  // Punto 14: Caracterizar signos/síntomas más relevantes (5 líneas)
  const textoCaracSignos = up(datosObj.aplica_caracterizar_signos) === "NO" ? "" : up(datosObj.caracterizar_signos);
  if (textoCaracSignos) {
    const lineasSignos = dividirEnLineas(textoCaracSignos, 5, 498, 6.5);
    for (let i = 0; i < lineasSignos.length; i++) {
      setCampo(`caracterizas signos/sintomas mas relevantes_ linea ${i + 1}`, lineasSignos[i], { centrado: true, negrita: true, fontSize: 6.5 });
    }
  }

  // Punto 15: Tratamiento, Evolución y Lugar
  setCheck("recibio tratamiento_ si", tratSi);
  setCheck("recibio tratamiento_ no", up(datosObj.recibio_tratamiento) === "NO");
  if (tratSi && up(datosObj.especificar_tratamiento)) {
    setCampo("especificar el tratamiento", datosObj.especificar_tratamiento, { centrado: true, negrita: true, fontSize: 6.5 });
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
    setCampo("Nombre del hospital donde fue hospitalizado", datosObj.nombre_hospital, { centrado: true, negrita: true });
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

  setCampo("vacuna_otras", datosObj.otras_vacunas, { centrado: true, negrita: true });
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
      dibujarTextoDirecto(page1, datosObj.exp_otros, 516, 224.9, 6.5, 34);
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
      setCampo("procedencia agua/alimentos_ otros", procAguaVal, { centrado: true, negrita: true });
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
      if (lineasTipo[0]) setCampo("tipo exposicion_ otros linea 1", lineasTipo[0], { centrado: true, negrita: true });
      if (lineasTipo[1]) setCampo("tipo exposicion_ otros linea 2", lineasTipo[1], { centrado: true, negrita: true });
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
      setCampo(`caracterizar fact riesgos linea ${i + 1}`, lineasFactores[i], { centrado: true, negrita: true, fontSize: 6.5 });
    }
  }

  // Punto 32: Tabla de Contactos (18 filas: Row1 .. Row18) con tamaño uniforme 6.5pt y autoajuste tipográfico
  let sintomaticos = 0;
  const todosContactos = [...(datosObj.contactos || []), ...(datosObj.contactos_12_14 || [])].slice(0, 18);
  for (let i = 0; i < 18; i++) {
    const num = i + 1;
    const cont = todosContactos[i];
    if (cont && up(cont.nombre)) {
      setCampo(`NombreRow${num}`, cont.nombre, { centrado: true, negrita: true, fontSize: 6.5 });
      setCampo(`edadRow${num}`, cont.edad, { centrado: true, negrita: true, fontSize: 6.5 });
      setCampo(`sexoRow${num}`, cont.sexo, { centrado: true, negrita: true, fontSize: 6.5 });
      setCampo(`Relación con el casoRow${num}`, cont.relacion, { centrado: true, negrita: true, fontSize: 6.5 });
      const dirYTel = [up(cont.direccion), up(cont.lugar)].filter(Boolean).join(" - ");
      setCampo(`Dirección domiciliariatelefRow${num}`, dirYTel, { centrado: true, negrita: true, fontSize: 6.5 });

      if (up(cont.enfermo) === "SI") {
        setCheck(`síRow${num}`, true);
        setCampo(`fecha de inicio de síntomasRow${num}`, cont.fecha, { centrado: true, negrita: true, fontSize: 5.2 });
        setCampo(`ObservacionesRow${num}`, cont.obs, { centrado: true, negrita: true, fontSize: 6.5 });
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
    setCampo("tipo de muestra", datosObj.tipo_muestra, { centrado: true, negrita: true });
    const resLabP2 = [resUp, up(datosObj.agente), up(datosObj.tecnica)].filter(Boolean).join(" - ");
    setCampo("Resultado de laboratorio", resLabP2, { centrado: true, negrita: true });
  }

  // NOTA: "diagnostico definitivo" y "fecha_dia_1er digito".."fecha_año" (Fecha de cierre) se dejan en blanco para Epidemiología
  if (confPor.includes("LAB")) setCheck("diagnostico confirmado por_laboratorio", true);
  if (confPor.includes("CLINIC") || confPor.includes("CLÍNIC")) setCheck("diagnostico confirmado por_clinica", true);
  if (confPor.includes("NEXO")) setCheck("diagnostico confirmado por_nexo", true);

  // Punto 37: En caso aislado / Es parte de brote o epidemia (estampado directo en las casillas de Página 2)
  const broteUp = up(datosObj.tipo_caso_brote);
  if (broteUp.includes("AISLADO")) {
    dibujarTextoDirecto(page2, "X", 120.2, 395.3, 6.5);
  } else if (broteUp.includes("BROTE")) {
    dibujarTextoDirecto(page2, "X", 264.6, 395.3, 6.5);
  }

  setCampo("responsable nombre", datosObj.medico_tratante);
  setCampo("fecha_dia_1er digito", fa.d1);
  setCampo("fecha_dia_2do digito", fa.d2);
  setCampo("fecha_mes_1er digito", fa.m1);
  setCampo("fecha_mes_2do digito", fa.m2);
  setCampo("fecha_año", fa.ano);

  // =========================================================================
  // PÁGINA 3: FORMULARIO EPI-1 INDIVIDUAL (NOTIFICACIÓN Y CIERRE DE CASO)
  // =========================================================================
  const fechaSemanaRef = datosObj.fecha_inicio_sintomas || datosObj.fecha_atencion;
  const numSemanaEpi = calcularSemanaEpidemiologica(fechaSemanaRef);
  setCampo("Semana EPI", numSemanaEpi, { centrado: true, negrita: true, fontSize: 6.5 });

  // 1. Institución
  if (instUp === "MSP" || instUp.includes("SALUD PÚBLICA") || instUp.includes("SALUD PUBLICA")) {
    setCheck("Institucion_MSP", true);
  } else if (instUp === "IESS" || instUp.includes("SEGURIDAD SOCIAL")) {
    setCheck("Institucion_IESS", true);
  } else if (instUp === "FFAA" || instUp === "ISSFA" || instUp.includes("FUERZAS ARMADAS")) {
    dibujarTextoDirecto(page3, "X", 156.5, 675.9, 6.5);
  } else if (instUp === "POL" || instUp === "ISSPOL" || instUp.includes("POLIC")) {
    dibujarTextoDirecto(page3, "X", 179.3, 675.9, 6.5);
  } else if (instUp.includes("JBG") || instUp.includes("BENEFICENCIA")) {
    dibujarTextoDirecto(page3, "X", 199.8, 675.9, 6.5);
  } else if (instUp === "MEC" || instUp.includes("EDUCAC")) {
    dibujarTextoDirecto(page3, "X", 218.0, 675.9, 6.5);
  } else if (instUp === "DRS") {
    dibujarTextoDirecto(page3, "X", 236.2, 675.9, 6.5);
  } else if (instUp.includes("PRIV")) {
    dibujarTextoDirecto(page3, "X", 258.4, 675.9, 6.5);
  } else if (instUp === "ONG" || instUp.includes("FUNDAC")) {
    dibujarTextoDirecto(page3, "X", 280.7, 675.9, 6.5);
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
  setCampo("direccion exacta", dirP3.l1, { centrado: true, negrita: true });
  setCampo("direccion exacta_barrio, localidad", dirP3.l2 || datosObj.parroquia_residencia, { centrado: true, negrita: true });
  setCampo("Telf", datosObj.telefono);
  setCampo("lugar probable de infeccion", lugarProbInfeccion, { centrado: true, negrita: true });

  // 19 y 20: Cuadro Clínico y Embarazo
  setCampo("fecha inicio de sintomas_dia", fs.dia);
  setCampo("fecha inicio de sintomas_mes", fs.mes);
  setCampo("fecha inicio de sintomas_año", fs.ano);
  setCampo("diagnostico inicial", datosObj.diagnostico_cie10, { centrado: true, negrita: true });

  // 21 al 25: Laboratorio en EPI-1 Individual
  setCheck("muestra laboratorio_si", muestraSi);
  setCheck("muestra laboratorio_no", up(datosObj.muestra) === "NO");
  if (muestraSi) {
    setCampo("tipo de muestra 1", datosObj.tipo_muestra, { centrado: true, negrita: true }); // Llena sección 21 y sección 23
    setCampo("fecha toma muestra_dia 1", fm.dia);
    setCampo("fecha toma muestra_mes", fm.mes);
    setCampo("fecha toma muestra_año 1", fm.ano);
    setCampo("Nombre y ubicacion del laboratorio", estabUp || instUp, { centrado: true, negrita: true, fontSize: 6.5 });
    setCampo("fecha recepcion muestra_dia_1", fm.dia);
    setCampo("fecha recepcion muestra_mes_1", fm.mes);
    setCampo("fecha recepcion muestra_año_1", fm.ano);
    setCheck("muestra adecuada_si_1", up(datosObj.muestra_adecuada) === "SI");
    setCheck("muestra adecuada_no_1", up(datosObj.muestra_adecuada) === "NO");
  }

  setCheck("resultado_positivo", resUp === "POSITIVO");
  setCheck("resultado_negativo", resUp === "NEGATIVO");
  setCheck("resultado_dudoso", resUp === "DUDOSO");
  setCampo("resultado_agente_1", datosObj.agente, { centrado: true, negrita: true });
  setCampo("resultado_agente_2", datosObj.tecnica, { centrado: true, negrita: true });

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

export async function generarPdfFichaEpi(datosObj, esTuberculosis = false) {
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

/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT - FICHAS EPI (NUEVO FORMATO OFICIAL 3 HOJAS)
 * ============================================================================
 * Hojas de la plantilla:
 *   1. DATOS (Hoja de captura vinculada por fórmulas)
 *   2. Epi individual (Puntos 1 al 36)
 *   3. Clinica Epidemiolo (Anverso Ficha de Investigación - Puntos 1 al 26)
 *   4. Hoja Posterior (Reverso Ficha de Investigación - Puntos 27 al 41)
 */

const ID_PLANTILLA_NUEVA = '1mTMaOzeqjo0XLsDb9TIHk79lOtlVr_HN9wxu9s_YDJk'; // ID de la plantilla en Google Drive
const ID_HOJA_REGISTRO_ESTADISTICO = '1JAoG1T0O-vzISYMO3InmZQIzQec5AsgnqRhzcx_Vx-Q'; // FICHAS EPI SOLO PARA WEB

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  if (action === 'stats') {
    return obtenerEstadisticas();
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', mensaje: 'API Fichas EPI Nuevo Formato Activa' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const d = JSON.parse(raw);

    // 1. Registrar en hoja estadística global
    registrarEnEstadisticas(d);

    // Si la app web ya generó el Excel localmente en el navegador (<50ms) y solo envió el log estadístico:
    if (d.soloRegistroEstadistico) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, mode: 'stats_only' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Generación en servidor (Fallback o llamada directa)
    const resultado = generarExcelNuevoFormato(d);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        base64: resultado.base64,
        fileName: resultado.fileName
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function registrarEnEstadisticas(d) {
  try {
    const ss = SpreadsheetApp.openById(ID_HOJA_REGISTRO_ESTADISTICO);
    const sheet = ss.getSheets()[0];
    const prop = PropertiesService.getScriptProperties();
    const totalActual = parseInt(prop.getProperty('TOTAL_FICHAS_GLOBAL') || '0', 10) + 1;
    prop.setProperty('TOTAL_FICHAS_GLOBAL', String(totalActual));

    const nombrePac = [d.primer_apellido, d.segundo_apellido, d.primer_nombre, d.segundo_nombre]
      .map(x => (x || '').trim().toUpperCase())
      .filter(Boolean)
      .join(' ');

    sheet.appendRow([
      new Date(),
      "'" + (d.cedula || ''),
      nombrePac,
      (d.diagnostico_cie10 || '').toUpperCase(),
      (d.establecimiento || '').toUpperCase(),
      (d.institucion || '').toUpperCase(),
      (d.medico_tratante || '').toUpperCase()
    ]);
  } catch (e) {
    console.warn('Aviso al registrar estadística:', e);
  }
}

function obtenerEstadisticas() {
  try {
    const ss = SpreadsheetApp.openById(ID_HOJA_REGISTRO_ESTADISTICO);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    const porEstablecimiento = {};
    let conteoFilas = 0;

    for (let i = 1; i < data.length; i++) {
      const estab = String(data[i][4] || 'NO ESPECIFICADO').trim().toUpperCase();
      if (estab) {
        porEstablecimiento[estab] = (porEstablecimiento[estab] || 0) + 1;
        conteoFilas++;
      }
    }

    const propTotal = parseInt(PropertiesService.getScriptProperties().getProperty('TOTAL_FICHAS_GLOBAL') || '0', 10);
    const totalGlobal = Math.max(propTotal, conteoFilas);

    return ContentService
      .createTextOutput(JSON.stringify({ totalGlobal: totalGlobal, porEstablecimiento: porEstablecimiento }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function calcularSemanaEpiServer(fechaStr) {
  if (!fechaStr) return '';
  const p = String(fechaStr).split('-');
  if (p.length !== 3) return '';
  const ano = parseInt(p[0], 10), mes = parseInt(p[1], 10) - 1, dia = parseInt(p[2], 10);
  const f = new Date(ano, mes, dia);
  if (isNaN(f.getTime())) return '';
  const dow = f.getDay();
  const startOfWeek = new Date(ano, mes, dia - dow);
  const wed = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 3);
  const epiYear = wed.getFullYear();
  const jan4 = new Date(epiYear, 0, 4);
  const startOfEpiYear = new Date(epiYear, 0, 4 - jan4.getDay());
  const diffDays = Math.round((startOfWeek.getTime() - startOfEpiYear.getTime()) / 86400000);
  return String(Math.max(1, Math.floor(diffDays / 7) + 1));
}

function desglosarFechaYMD(fechaStr) {
  if (!fechaStr) return ['', '', ''];
  const p = String(fechaStr).trim().split('-');
  if (p.length !== 3) return ['', '', ''];
  return [parseInt(p[2], 10), parseInt(p[1], 10), parseInt(p[0], 10)];
}

function generarExcelNuevoFormato(d) {
  const ced = String(d.cedula || 'SIN_CI').trim();
  const tempFile = DriveApp.getFileById(ID_PLANTILLA_NUEVA).makeCopy('TEMP_FICHA_' + ced + '_' + Date.now());
  const tempId = tempFile.getId();

  try {
    const ss = SpreadsheetApp.openById(tempId);
    const shDatos = ss.getSheetByName('DATOS');
    if (!shDatos) throw new Error('La plantilla no contiene la hoja DATOS.');

    const up = (v) => String(v || '').trim().toUpperCase();

    // Forzar formato de texto plano '@' en celdas críticas para que parroquias como
    // "18 DE OCTUBRE", "12 DE MARZO" o "24 DE MAYO" y números con 0 inicial jamás se conviertan en fechas
    const rangosTexto = [
      'C5', 'C6', 'C8', 'C9', 'C10', 'C15', 'C16', 'C18:C25', 'D26', 'C27', 'C28', 'D30',
      'K12:K16', 'B52:H62', 'J52:J62', 'R52:X58', 'Z52:Z58', 'L71', 'C72', 'F72', 'C74',
      'C89', 'G99', 'C100', 'F100', 'M100', 'C102', 'C103', 'F108', 'C109', 'G110', 'C111', 'C112',
      'C117', 'F117', 'C118', 'F118', 'H119', 'C120'
    ];
    shDatos.getRangeList(rangosTexto).setNumberFormat('@');

    const [fnDia, fnMes, fnAno] = desglosarFechaYMD(d.fecha_nacimiento);
    const [faDia, faMes, faAno] = desglosarFechaYMD(d.fecha_atencion);
    const [fsDia, fsMes, fsAno] = desglosarFechaYMD(d.fecha_inicio_sintomas);
    const [frDia, frMes, frAno] = desglosarFechaYMD(d.fecha_sintoma_relevante);
    const [fvdDia, fvdMes, fvdAno] = desglosarFechaYMD(d.fecha_desde);
    const [fcDia, fcMes, fcAno] = desglosarFechaYMD(d.fecha_contacto);

    const apellidos = [up(d.primer_apellido), up(d.segundo_apellido)].filter(Boolean).join(' ');
    const nombres = [up(d.primer_nombre), up(d.segundo_nombre)].filter(Boolean).join(' ');
    const semanaEpi = calcularSemanaEpiServer(d.fecha_inicio_sintomas || d.fecha_atencion);
    const sexoUp = up(d.sexo);
    const embUp = sexoUp === 'MASCULINO' ? 'NO' : up(d.embarazada || 'NO');
    const semGest = (sexoUp !== 'MASCULINO' && embUp === 'SI') ? String(d.semanas_gestacion || '').trim() : '';

    shDatos.getRange('C5').setValue(ced);
    shDatos.getRange('C6').setValue(String(d.historia_clinica || '').trim());
    shDatos.getRange('S6').setValue(semanaEpi);

    if (d.fecha_nacimiento) {
      shDatos.getRange('C7').setValue(d.fecha_nacimiento);
      shDatos.getRange('D7:F7').setValues([[fnDia, fnMes, fnAno]]);
    }
    shDatos.getRange('C8').setValue(apellidos);
    shDatos.getRange('C9').setValue(nombres);
    shDatos.getRange('C10').setValue(String(d.telefono || '').trim());

    if (d.fecha_atencion) {
      shDatos.getRange('C12').setValue(d.fecha_atencion);
      shDatos.getRange('D12:F12').setValues([[faDia, faMes, faAno]]);
    }
    if (d.fecha_inicio_sintomas) {
      shDatos.getRange('C13').setValue(d.fecha_inicio_sintomas);
      shDatos.getRange('D13:F13').setValues([[fsDia, fsMes, fsAno]]);
    }
    shDatos.getRange('G13').setValue(d.hora_inicio_sintomas || '');

    if (d.fecha_sintoma_relevante) {
      shDatos.getRange('C14').setValue(d.fecha_sintoma_relevante);
      shDatos.getRange('D14:F14').setValues([[frDia, frMes, frAno]]);
    }
    shDatos.getRange('G14').setValue(d.hora_sintoma_relevante || '');

    shDatos.getRange('K12:K16').setValues([
      [d.institucion || ''],
      [up(d.establecimiento)],
      [up(d.prov_establecimiento)],
      [up(d.canton_establecimiento)],
      [up(d.parroquia_establecimiento)]
    ]);

    shDatos.getRange('C15:C25').setValues([
      [up(d.cual_sintoma)],
      [up(d.nacionalidad)],
      [sexoUp],
      [up(d.prov_residencia)],
      [up(d.canton_residencia)],
      [up(d.parroquia_residencia)],
      [up(d.direccion)],
      [up(d.estado_civil)],
      [up(d.etnia)],
      [up(d.escolaridad)],
      [up(d.ocupacion)]
    ]);

    shDatos.getRange('D26').setValue(up(d.nombre_madre));
    shDatos.getRange('C27').setValue(up(d.medico_tratante));
    shDatos.getRange('C28').setValue(up(d.diagnostico_cie10));
    shDatos.getRange('C29').setValue(embUp);
    shDatos.getRange('D30').setValue(semGest);

    // Síntomas
    shDatos.getRange('C34:C43').setValues([
      [Boolean(d.tos)], [Boolean(d.dolor_garganta)], [Boolean(d.dif_respiratoria)], [Boolean(d.cianosis)],
      [Boolean(d.diarrea)], [Boolean(d.nauseas)], [Boolean(d.dolor_abdominal)], [Boolean(d.deshidratacion)],
      [Boolean(d.ictericia)], [Boolean(d.anorexia)]
    ]);
    shDatos.getRange('C45:C46').setValues([[Boolean(d.apnea)], [Boolean(d.estridor)]]);

    shDatos.getRange('F34:F43').setValues([
      [Boolean(d.fiebre)], [Boolean(d.cefalea)], [Boolean(d.escalofrios)], [Boolean(d.mialgias)],
      [Boolean(d.artralgia)], [Boolean(d.sudoracion)], [Boolean(d.sangrados)], [Boolean(d.erupcion)],
      [Boolean(d.prurito)], [Boolean(d.adenopatias)]
    ]);
    shDatos.getRange('F45:F46').setValues([[Boolean(d.ascitis)], [Boolean(d.oncocercomas)]]);

    shDatos.getRange('J34:J39').setValues([
      [Boolean(d.convulsiones)], [Boolean(d.alt_neuro_central)], [Boolean(d.alt_neuro_periferico)],
      [Boolean(d.vision_borrosa)], [Boolean(d.rigidez)], [Boolean(d.espasmo)]
    ]);
    shDatos.getRange('J45:J46').setValues([[Boolean(d.paralisis)], [Boolean(d.trismus)]]);

    shDatos.getRange('C48').setValue(up(d.otros_signos));
    shDatos.getRange('E48').setValue(d.num_dias_sintomas || '');

    // Contactos (1 al 18)
    const todosContactos = [...(d.contactos || []), ...(d.contactos_12_14 || [])].slice(0, 18);
    const filas1a11 = [];
    for (let i = 0; i < 11; i++) {
      const c = todosContactos[i] || {};
      const ok = Boolean(c.nombre && String(c.nombre).trim());
      const enfermoSi = ok && up(c.enfermo) === 'SI';
      filas1a11.push([
        ok ? up(c.nombre) : '', ok ? (c.edad || '') : '', ok ? up(c.sexo) : '',
        ok ? up(c.relacion) : '', ok ? up(c.direccion) : '', ok ? up(c.lugar) : '',
        ok ? (enfermoSi ? 'SI' : 'NO') : '', enfermoSi ? (c.fecha || '') : '', enfermoSi ? up(c.obs) : ''
      ]);
    }
    shDatos.getRange('B52:J62').setValues(filas1a11);

    const filas12a18 = [];
    for (let i = 11; i < 18; i++) {
      const c = todosContactos[i] || {};
      const ok = Boolean(c.nombre && String(c.nombre).trim());
      const enfermoSi = ok && up(c.enfermo) === 'SI';
      filas12a18.push([
        ok ? up(c.nombre) : '', ok ? (c.edad || '') : '', ok ? up(c.sexo) : '',
        ok ? up(c.relacion) : '', ok ? up(c.direccion) : '', ok ? up(c.lugar) : '',
        ok ? (enfermoSi ? 'SI' : 'NO') : '', enfermoSi ? (c.fecha || '') : '', enfermoSi ? up(c.obs) : ''
      ]);
    }
    shDatos.getRange('R52:Z58').setValues(filas12a18);

    // Tratamiento y Hospitalización
    shDatos.getRange('C64').setValue(up(d.aplica_caracterizar_signos) === 'SI' ? up(d.caracterizar_signos) : '');
    shDatos.getRange('C65').setValue(up(d.recibio_tratamiento));
    shDatos.getRange('E65').setValue(up(d.especificar_tratamiento));
    shDatos.getRange('C66').setValue(d.evolucion || '');
    shDatos.getRange('E66').setValue(d.lugar_tratamiento || '');
    shDatos.getRange('C67').setValue(up(d.asistio_controles));
    shDatos.getRange('E67').setValue(d.cuantos_controles || '');

    shDatos.getRange('C71').setValue(up(d.hospitalizado));
    shDatos.getRange('F71').setValue(d.fecha_hosp || '');
    shDatos.getRange('L71').setValue(up(d.hc_hosp));
    shDatos.getRange('C72').setValue(up(d.servicio_hosp));
    shDatos.getRange('F72').setValue(up(d.nombre_hospital));
    shDatos.getRange('O72').setValue(up(d.ingreso_uci));
    shDatos.getRange('C73').setValue(up(d.condicion_egreso));
    shDatos.getRange('F73').setValue(d.fecha_fallecimiento || '');
    shDatos.getRange('C74').setValue(up(d.lugar_viaje || d.canton_residencia || d.canton_establecimiento));

    // Vacunas y Viajes
    shDatos.getRange('C80').setValue(up(d.antecedente_vacunal));
    shDatos.getRange('F80').setValue(d.fecha_ultima_dosis || '');
    shDatos.getRange('C81').setValue(d.num_dosis || '');
    shDatos.getRange('F81').setValue(d.fuente_info || '');

    shDatos.getRange('C83:C86').setValues([[Boolean(d.bcg)], [Boolean(d.penta)], [Boolean(d.fa)], [Boolean(d.srp)]]);
    shDatos.getRange('F83:F86').setValues([[Boolean(d.hb)], [Boolean(d.influenza)], [Boolean(d.dt)], [Boolean(d.varicela)]]);
    shDatos.getRange('I83:I86').setValues([[Boolean(d.rota)], [Boolean(d.neumococo_conj)], [Boolean(d.dpt)], [Boolean(d.neumococo_poli)]]);
    shDatos.getRange('N83:N85').setValues([[Boolean(d.opv)], [Boolean(d.sr)], [Boolean(d.dt_adulto)]]);
    shDatos.getRange('D87').setValue(up(d.otras_vacunas));

    shDatos.getRange('C88').setValue(up(d.realizo_viaje));
    shDatos.getRange('C89').setValue(up(d.lugar_viaje));
    if (d.fecha_desde && up(d.realizo_viaje) === 'SI') {
      shDatos.getRange('C90').setValue(d.fecha_desde);
      shDatos.getRange('D90:F90').setValues([[fvdDia, fvdMes, fvdAno]]);
    }
    shDatos.getRange('C91').setValue(up(d.realizo_viaje) === 'SI' ? (d.fecha_hasta || '') : '');

    // Exposiciones (incluye Metales pesados en Q97 y Solventes en Q98)
    const expNinguno = Boolean(d.exp_ninguno);
    shDatos.getRange('C97').setValue(!expNinguno && Boolean(d.exp_animal_vivo));
    shDatos.getRange('F97').setValue(!expNinguno && Boolean(d.exp_animal_muerto));
    shDatos.getRange('I97').setValue(!expNinguno && Boolean(d.exp_persona_sint));
    shDatos.getRange('N97').setValue(!expNinguno && Boolean(d.exp_agua_suelo));
    shDatos.getRange('Q97').setValue(!expNinguno && Boolean(d.exp_metales_pesados));

    shDatos.getRange('C98').setValue(!expNinguno && Boolean(d.exp_alimentos));
    shDatos.getRange('F98').setValue(!expNinguno && Boolean(d.exp_basurales));
    shDatos.getRange('I98').setValue(!expNinguno && Boolean(d.exp_plaguicidas));
    shDatos.getRange('N98').setValue(!expNinguno && Boolean(d.exp_metanol));
    shDatos.getRange('Q98').setValue(!expNinguno && Boolean(d.exp_solventes));

    shDatos.getRange('C99').setValue(expNinguno);
    shDatos.getRange('G99').setValue(!expNinguno ? up(d.exp_otros) : '');

    shDatos.getRange('C100').setValue(!expNinguno ? up(d.lugar_contacto) : '');
    shDatos.getRange('F100').setValue(!expNinguno ? up(d.forma_contacto) : '');
    shDatos.getRange('M100').setValue(!expNinguno ? up(d.origen_objeto) : '');
    if (!expNinguno && d.fecha_contacto) {
      shDatos.getRange('C101').setValue(d.fecha_contacto);
      shDatos.getRange('D101:F101').setValues([[fcDia, fcMes, fcAno]]);
    }
    shDatos.getRange('I101').setValue(!expNinguno ? (d.hora_contacto || '') : '');
    shDatos.getRange('C102').setValue(!expNinguno ? (d.procedencia_agua === 'Otro' ? up(d.procedencia_agua_otro) : up(d.procedencia_agua)) : '');
    shDatos.getRange('C103').setValue(!expNinguno ? (d.tipo_exposicion === 'Otras' ? up(d.tipo_exposicion_otro) : up(d.tipo_exposicion)) : '');
    shDatos.getRange('C104').setValue(up(d.transfusion));
    shDatos.getRange('C105').setValue(up(d.quimioterapia));

    // Epidemiología y Laboratorio
    shDatos.getRange('C108').setValue(up(d.otros_enfermos));
    shDatos.getRange('F108').setValue(up(d.donde_enfermos));
    shDatos.getRange('C109').setValue(d.tipo_caso || '');
    shDatos.getRange('C110').setValue(up(d.comorbilidades));
    shDatos.getRange('G110').setValue(up(d.especificar_comor));
    shDatos.getRange('C111').setValue(up(d.carac_factores));
    shDatos.getRange('C112').setValue(up(d.obs_epidemiologicas));

    shDatos.getRange('C116').setValue(up(d.muestra));
    shDatos.getRange('F116').setValue(d.fecha_muestra || '');
    shDatos.getRange('I116').setValue(up(d.muestra_adecuada));
    shDatos.getRange('C117').setValue(up(d.tipo_muestra));
    shDatos.getRange('F117').setValue(up(d.tecnica));
    shDatos.getRange('L117').setValue(up(d.antes_tratamiento));
    shDatos.getRange('C118').setValue(up(d.resultado));
    shDatos.getRange('F118').setValue(up(d.agente));

    // C119 (Diagnóstico definitivo) y C121 (Fecha de cierre) quedan vacíos para Epidemiología
    shDatos.getRange('C119').setValue('');
    shDatos.getRange('H119').setValue(up(d.confirmado_por));
    shDatos.getRange('C120').setValue(up(d.tipo_caso_brote));
    shDatos.getRange('C121:F121').setValues([['', '', '', '']]);

    SpreadsheetApp.flush();

    const urlExport = 'https://docs.google.com/spreadsheets/d/' + tempId + '/export?format=xlsx';
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(urlExport, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });

    const blob = response.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    const fileName = 'FichasEPI_' + ced + '_' + up(d.primer_apellido) + '_' + up(d.primer_nombre) + '.xlsx';

    return { base64: base64, fileName: fileName };
  } finally {
    try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e) {}
  }
}

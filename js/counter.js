// js/counter.js - Sistema de Conteo y Estadísticas (Local, Offline y Nube Apps Script)
import { API_URL } from './constants.js';

const STORAGE_KEY_STATS = 'fichas_contador_stats';

function getFechaHoyISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFechaHoraFormateada() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function obtenerEstadisticasLocales() {
  const hoyISO = getFechaHoyISO();
  let stats = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_STATS);
      if (raw) stats = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error leyendo estadísticas locales:', e);
  }

  if (!stats || typeof stats !== 'object') {
    stats = {
      total: 0,
      hoy: { fecha: hoyISO, cantidad: 0 },
      porModo: { epi: 0, sppat: 0, epicrisis: 0 },
      porFormato: { pdf: 0, excel: 0 },
      porEstablecimiento: {},
      historial: [],
      pendientesSync: []
    };
  }

  // Normalización y retrocompatibilidad de datos
  if (typeof stats.total !== 'number') stats.total = 0;
  if (!stats.hoy || typeof stats.hoy !== 'object') stats.hoy = { fecha: hoyISO, cantidad: 0 };
  if (stats.hoy.fecha !== hoyISO) {
    stats.hoy.fecha = hoyISO;
    stats.hoy.cantidad = 0;
  }
  if (!stats.porModo || typeof stats.porModo !== 'object') stats.porModo = { epi: 0, sppat: 0, epicrisis: 0 };
  stats.porModo.epi = stats.porModo.epi || 0;
  stats.porModo.sppat = stats.porModo.sppat || 0;
  stats.porModo.epicrisis = stats.porModo.epicrisis || 0;

  if (!stats.porFormato || typeof stats.porFormato !== 'object') stats.porFormato = { pdf: 0, excel: 0 };
  stats.porFormato.pdf = stats.porFormato.pdf || 0;
  stats.porFormato.excel = stats.porFormato.excel || 0;

  if (!stats.porEstablecimiento || typeof stats.porEstablecimiento !== 'object') {
    stats.porEstablecimiento = {};
  }
  if (!Array.isArray(stats.historial)) stats.historial = [];
  if (!Array.isArray(stats.pendientesSync)) stats.pendientesSync = [];

  return stats;
}

export function guardarEstadisticasLocales(stats) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
    }
  } catch (e) {
    console.warn('Error guardando estadísticas locales:', e);
  }
}

export function registrarFichaGenerada(datos = {}) {
  const stats = obtenerEstadisticasLocales();
  const modo = (datos.modo || 'epi').toLowerCase();
  const formato = (datos.formato || 'pdf').toLowerCase();
  const est = (datos.establecimiento || 'HOSPITAL GENERAL PORTOVIEJO').trim().toUpperCase();
  const paciente = (datos.paciente || 'PACIENTE').trim().toUpperCase();
  const cedula = (datos.cedula || '').trim();
  const diagnostico = (datos.diagnostico || '').trim();
  const institucion = (datos.institucion || 'IESS').trim();
  const medico = (datos.medico || '').trim();

  // 1. Incrementar conteo total y del día
  stats.total = (stats.total || 0) + 1;
  stats.hoy.cantidad = (stats.hoy.cantidad || 0) + 1;

  // 2. Desglose por modo
  if (modo === 'sppat') stats.porModo.sppat = (stats.porModo.sppat || 0) + 1;
  else if (modo === 'epicrisis') stats.porModo.epicrisis = (stats.porModo.epicrisis || 0) + 1;
  else stats.porModo.epi = (stats.porModo.epi || 0) + 1;

  // 3. Desglose por formato
  if (formato === 'excel' || formato === 'xlsx') {
    stats.porFormato.excel = (stats.porFormato.excel || 0) + 1;
  } else {
    stats.porFormato.pdf = (stats.porFormato.pdf || 0) + 1;
  }

  // 4. Desglose por establecimiento
  stats.porEstablecimiento[est] = (stats.porEstablecimiento[est] || 0) + 1;

  // 5. Historial reciente (máximo 50 entradas)
  const entry = {
    id: Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    fechaStr: getFechaHoraFormateada(),
    modo,
    formato: (formato === 'excel' || formato === 'xlsx') ? 'Excel' : 'PDF',
    paciente: paciente || 'PACIENTE',
    cedula: cedula || 'S/N',
    establecimiento: est,
    diagnostico: diagnostico || 'NO ESPECIFICADO'
  };

  stats.historial.unshift(entry);
  if (stats.historial.length > 50) {
    stats.historial = stats.historial.slice(0, 50);
  }

  // 6. Guardar localmente
  guardarEstadisticasLocales(stats);
  actualizarBadgesContador();

  // 7. Disparar evento para componentes UI reactivos
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('fichas-counter-updated', { detail: { stats, ultimaFicha: entry } }));
    } catch (e) {}
  }

  // 8. Preparar datos de telemetría para Google Apps Script
  const partesNom = paciente.split(' ');
  const payloadSync = {
    cedula: cedula,
    primer_apellido: datos.primer_apellido || partesNom[0] || '',
    segundo_apellido: datos.segundo_apellido || (partesNom.length > 2 ? partesNom[1] : ''),
    primer_nombre: datos.primer_nombre || (partesNom.length > 2 ? partesNom[2] : (partesNom[1] || '')),
    diagnostico_cie10: diagnostico,
    establecimiento: est,
    institucion: institucion,
    medico_tratante: medico,
    tipoDocumento: modo,
    formato: formato,
    soloRegistroEstadistico: true
  };

  // Enviar asíncronamente a Apps Script (fire-and-forget)
  enviarTelemetriaAppsScript(payloadSync, stats);

  return stats;
}

async function enviarTelemetriaAppsScript(payload, statsRef) {
  if (!API_URL || API_URL.includes('PEGA_AQUI')) return;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    encolarPendiente(payload, statsRef);
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      encolarPendiente(payload, statsRef);
    }
  } catch (err) {
    encolarPendiente(payload, statsRef);
  }
}

function encolarPendiente(payload, statsRef) {
  try {
    const stats = statsRef || obtenerEstadisticasLocales();
    if (!Array.isArray(stats.pendientesSync)) stats.pendientesSync = [];
    if (stats.pendientesSync.length < 100) {
      stats.pendientesSync.push(payload);
      guardarEstadisticasLocales(stats);
    }
  } catch (e) {}
}

export async function sincronizarFichasPendientes() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (!API_URL || API_URL.includes('PEGA_AQUI')) return;

  const stats = obtenerEstadisticasLocales();
  if (!stats.pendientesSync || stats.pendientesSync.length === 0) return;

  const pendientes = [...stats.pendientesSync];
  stats.pendientesSync = [];
  guardarEstadisticasLocales(stats);

  for (let i = 0; i < pendientes.length; i++) {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(pendientes[i])
      });
    } catch (e) {
      // Re-encolar los restantes si falla la conexión
      const restantes = pendientes.slice(i);
      stats.pendientesSync.push(...restantes);
      guardarEstadisticasLocales(stats);
      break;
    }
  }
}

export function actualizarBadgesContador() {
  if (typeof document === 'undefined') return;
  const stats = obtenerEstadisticasLocales();
  const total = stats.total || 0;

  // 1. Badge superior en el Header
  const badgeHeader = document.getElementById('badgeTotalFichas');
  if (badgeHeader) {
    badgeHeader.textContent = total > 999 ? (total / 1000).toFixed(1) + 'k' : total.toLocaleString();
    badgeHeader.title = `${total.toLocaleString()} fichas generadas en total`;
  }

  // 2. Etiqueta en el footer de firma
  const lblFooter = document.getElementById('lblConteoFooter');
  if (lblFooter) {
    const txt = total === 1 ? '1 ficha generada' : `${total.toLocaleString()} fichas generadas`;
    lblFooter.textContent = txt;
  }

  // 3. Etiqueta en el menú lateral
  const lblMenu = document.getElementById('lblConteoMenu');
  if (lblMenu) {
    const txt = total === 1 ? '1 ficha' : `${total.toLocaleString()} fichas`;
    lblMenu.textContent = txt;
  }
}

export function mostrarModalEstadisticas() {
  const stats = obtenerEstadisticasLocales();
  const estaOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;

  // Renderizar filas de establecimientos
  const estabEntries = Object.entries(stats.porEstablecimiento || {}).sort((a, b) => b[1] - a[1]);
  let estabHtml = '';
  if (estabEntries.length > 0) {
    estabHtml = estabEntries.map(([nombre, cant]) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--apple-border); font-size: 0.84rem;">
        <span style="color: var(--apple-text); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px;" title="${nombre}">🏥 ${nombre}</span>
        <span style="font-weight: 700; color: var(--apple-blue); white-space: nowrap;">${cant}</span>
      </div>
    `).join('');
  } else {
    estabHtml = `<div style="text-align: center; color: var(--apple-text-muted); padding: 12px; font-size: 0.82rem;">Aún no hay registros detallados por establecimiento.</div>`;
  }

  // Renderizar historial reciente
  let historialHtml = '';
  if (stats.historial && stats.historial.length > 0) {
    historialHtml = stats.historial.slice(0, 10).map(h => {
      const badgeClass = h.modo === 'epicrisis' ? 'bg-success' : (h.modo === 'sppat' ? 'bg-danger' : 'bg-primary');
      const badgeModo = h.modo === 'epicrisis' ? 'EPICRISIS' : (h.modo === 'sppat' ? 'SPPAT' : 'EPI');
      return `
        <tr style="border-bottom: 1px solid var(--apple-border); font-size: 0.8rem;">
          <td style="padding: 6px 8px; white-space: nowrap; color: var(--apple-text-muted);">${h.fechaStr}</td>
          <td style="padding: 6px 8px; text-align: center;">
            <span class="badge ${badgeClass} text-white" style="font-size: 0.68rem; padding: 3px 6px;">${badgeModo}</span>
            <span class="badge bg-secondary text-white ms-1" style="font-size: 0.65rem; padding: 3px 5px;">${h.formato}</span>
          </td>
          <td style="padding: 6px 8px; text-align: left; font-weight: 600; color: var(--apple-text); max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${h.paciente}">
            ${h.paciente}
            <div style="font-weight: normal; font-size: 0.72rem; color: var(--apple-text-muted);">C.I. ${h.cedula}</div>
          </td>
        </tr>
      `;
    }).join('');
  } else {
    historialHtml = `<tr><td colspan="3" style="text-align: center; padding: 14px; color: var(--apple-text-muted); font-size: 0.82rem;">No hay documentos registrados aún en este dispositivo.</td></tr>`;
  }

  const numPendientes = stats.pendientesSync ? stats.pendientesSync.length : 0;
  const statusConexion = estaOnline 
    ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.76rem; color: #34c759; font-weight: 600;">● Online (Sincronizado)</span>` 
    : `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.76rem; color: #ff9500; font-weight: 600;">● Modo Offline Local</span>`;

  const bannerPendientes = numPendientes > 0
    ? `<div style="background: rgba(255, 149, 0, 0.1); border: 1px solid rgba(255, 149, 0, 0.3); border-radius: 8px; padding: 6px 12px; margin-bottom: 12px; font-size: 0.8rem; color: #d97706; display: flex; justify-content: space-between; align-items: center;">
         <span>🔄 Hay <b>${numPendientes}</b> ficha(s) pendientes de sincronizar con Google Sheets.</span>
         <button type="button" class="btn btn-sm btn-outline-warning py-0 px-2" style="font-size: 0.72rem;" onclick="window.sincronizarFichasPendientes().then(() => Swal.close())">Sincronizar</button>
       </div>`
    : '';

  const modalHtml = `
    <div style="text-align: left; color: var(--apple-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${bannerPendientes}

      <!-- TARJETAS PRINCIPALES DE RESUMEN -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="background: var(--apple-subcard-bg); border: 1px solid var(--apple-border); border-radius: 12px; padding: 12px 10px; text-align: center;">
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--apple-text-muted); font-weight: 700;">Total Local</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: var(--apple-blue); line-height: 1.1; margin-top: 4px;">${stats.total.toLocaleString()}</div>
          <div style="font-size: 0.7rem; color: var(--apple-text-muted); margin-top: 2px;">En este equipo</div>
        </div>

        <div style="background: var(--apple-subcard-bg); border: 1px solid var(--apple-border); border-radius: 12px; padding: 12px 10px; text-align: center;">
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--apple-text-muted); font-weight: 700;">Hoy</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: #34c759; line-height: 1.1; margin-top: 4px;">${stats.hoy.cantidad.toLocaleString()}</div>
          <div style="font-size: 0.7rem; color: var(--apple-text-muted); margin-top: 2px;">Fichas hoy</div>
        </div>

        <div style="background: var(--apple-subcard-bg); border: 1px solid var(--apple-border); border-radius: 12px; padding: 12px 10px; text-align: center;">
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--apple-text-muted); font-weight: 700;">Global Nube</div>
          <div id="lblStatsGlobalNube" style="font-size: 1.6rem; font-weight: 800; color: #af52de; line-height: 1.1; margin-top: 4px;">
            ${estaOnline ? '<span class="spinner-border spinner-border-sm" style="width: 1.2rem; height: 1.2rem;" role="status"></span>' : 'Local'}
          </div>
          <div style="font-size: 0.7rem; color: var(--apple-text-muted); margin-top: 2px;">Todas las unidades</div>
        </div>
      </div>

      <!-- DESGLOSE POR MODOS Y FORMATOS -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
        <div style="background: var(--apple-subcard-bg); border: 1px solid var(--apple-border); border-radius: 10px; padding: 10px 12px;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--apple-text-muted); text-transform: uppercase; margin-bottom: 6px;">Por Formulario</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
            <span>🩺 Fichas EPI / TB:</span>
            <b style="color: var(--apple-blue);">${stats.porModo.epi}</b>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
            <span>🚗 Expediente SPPAT:</span>
            <b style="color: #ff3b30;">${stats.porModo.sppat}</b>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
            <span>📋 Epicrisis (006):</span>
            <b style="color: #34c759;">${stats.porModo.epicrisis}</b>
          </div>
        </div>

        <div style="background: var(--apple-subcard-bg); border: 1px solid var(--apple-border); border-radius: 10px; padding: 10px 12px;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--apple-text-muted); text-transform: uppercase; margin-bottom: 6px;">Por Formato</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
            <span>📄 Documentos PDF:</span>
            <b style="color: var(--apple-text);">${stats.porFormato.pdf}</b>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
            <span>📊 Hojas Excel:</span>
            <b style="color: var(--apple-text);">${stats.porFormato.excel}</b>
          </div>
        </div>
      </div>

      <!-- DESGLOSE POR ESTABLECIMIENTO -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 0.78rem; font-weight: 700; color: var(--apple-text-muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Establecimientos de Salud</div>
        <div style="max-height: 130px; overflow-y: auto; background: var(--apple-subcard-bg); border-radius: 10px; border: 1px solid var(--apple-border);">
          ${estabHtml}
        </div>
      </div>

      <!-- HISTORIAL RECIENTE -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 0.78rem; font-weight: 700; color: var(--apple-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Últimas Fichas Generadas</span>
          ${statusConexion}
        </div>
        <div style="max-height: 180px; overflow-y: auto; background: var(--apple-subcard-bg); border-radius: 10px; border: 1px solid var(--apple-border);">
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              ${historialHtml}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: '📊 Estadísticas de Fichas',
      html: modalHtml,
      width: '620px',
      showCloseButton: true,
      confirmButtonText: 'Entendido',
      confirmButtonColor: 'var(--apple-blue)',
      didOpen: () => {
        // Consultar estadísticas globales de Apps Script en segundo plano si está online
        if (estaOnline && API_URL && !API_URL.includes('PEGA_AQUI')) {
          fetch(API_URL + '?action=stats')
            .then(res => res.json())
            .then(data => {
              const el = document.getElementById('lblStatsGlobalNube');
              if (el) {
                const totalG = data.totalGlobal !== undefined ? data.totalGlobal : stats.total;
                el.textContent = totalG.toLocaleString();
              }
            })
            .catch(() => {
              const el = document.getElementById('lblStatsGlobalNube');
              if (el) el.textContent = 'Local';
            });
        }
      }
    });
  }
}

export function inicializarContador() {
  actualizarBadgesContador();

  // Escuchar cuando el usuario recupere la conexión a internet para sincronizar pendientes
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      sincronizarFichasPendientes();
    });
  }

  // Exponer globalmente para fácil acceso desde HTML
  if (typeof window !== 'undefined') {
    window.mostrarModalEstadisticas = mostrarModalEstadisticas;
    window.registrarFichaGenerada = registrarFichaGenerada;
    window.obtenerEstadisticasLocales = obtenerEstadisticasLocales;
    window.sincronizarFichasPendientes = sincronizarFichasPendientes;
  }
}

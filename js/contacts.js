// js/contacts.js
import { toggleElementos, toggleDondeEnfermos } from './formLogic.js';
import { enfocarElementoSeguro } from './ui.js';

export function toggleContactoRow(trElement) {
  if (window.innerWidth <= 768) {
    const isExpanded = trElement.classList.contains('expanded');
    document.querySelectorAll('#tablaContactos tbody tr').forEach(r => r.classList.remove('expanded'));
    if (!isExpanded) {
      trElement.classList.add('expanded');
    }
  }
}

export function updSummary(el) {
  const tr = el.closest('tr');
  const nom = tr.querySelector('.c-nombre').value.trim() || 'Nuevo Contacto';
  const rel = tr.querySelector('.c-relacion').value || 'Sin relación';
  const sumName = tr.querySelector('.sum-name');
  const sumRel = tr.querySelector('.sum-rel');
  if (sumName) sumName.textContent = nom;
  if (sumRel) sumRel.textContent = rel;
}

export function agregarContacto() {
  const tbody = document.getElementById('contactsBody');

  if (tbody.children.length >= 14) { 
    Swal.fire('Límite alcanzado', 'Se ha alcanzado el límite máximo de 14 contactos.', 'warning'); 
    return; 
  }

  const defaultParr = document.getElementById('parroquia_residencia') ? document.getElementById('parroquia_residencia').value : '';
  const defVal = (defaultParr === 'Seleccione Parroquia...' || !defaultParr) ? '' : defaultParr;
  const escAttr = (v) => String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
      <td data-label="Dirección/Teléf"><input type="text" class="form-control c-dir save-state" value="${escAttr(defVal)}" style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
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
      <td data-label="Observaciones"><input type="text" class="form-control c-obs save-state" style="font-size:0.85rem" placeholder="Observaciones..." onclick="event.stopPropagation()"></td>
      <td data-label="Acción" class="text-center align-middle">
        <button type="button" class="btn btn-sm btn-del-contacto p-1 border-0" onclick="eliminarContacto(this, event)" title="Eliminar este contacto">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    </tr>
  `;
  tbody.insertAdjacentHTML('beforeend', rowHTML);
  const trs = tbody.querySelectorAll('tr');
  toggleContactoRow(trs[trs.length - 1]);
}

export function agregarContactoRestaurado(c, isFirst) {
  const tbody = document.getElementById('contactsBody');
  const escAttr = (v) => String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Lógica para pre-seleccionar opciones de Relación
  let optionsRelacion = `<option value="" ${!c.relacion ? 'selected disabled' : ''}>Sel. Sexo</option>`;
  if (c.sexo === 'M') {
    ['PADRE', 'HERMANO', 'HIJO', 'TÍO', 'PRIMO', 'SOBRINO', 'ABUELO', 'NIETO', 'ESPOSO', 'SUEGRO', 'YERNO', 'CUÑADO', 'CONCUÑADO', 'PADRASTRO', 'HIJASTRO', 'AMIGO', 'COMPAÑERO', 'OTRO'].forEach(o => {
      optionsRelacion += `<option value="${o}" ${c.relacion === o ? 'selected' : ''}>${o}</option>`;
    });
  } else if (c.sexo === 'F') {
    ['MADRE', 'HERMANA', 'HIJA', 'TÍA', 'PRIMA', 'SOBRINA', 'ABUELA', 'NIETA', 'ESPOSA', 'SUEGRA', 'NUERA', 'CUÑADA', 'CONCUÑADA', 'MADRASTRA', 'HIJASTRA', 'AMIGA', 'COMPAÑERA', 'OTRA'].forEach(o => {
      optionsRelacion += `<option value="${o}" ${c.relacion === o ? 'selected' : ''}>${o}</option>`;
    });
  }

  const dirVal = c.dir !== undefined ? c.dir : (c.direccion || '');

  const rowHTML = `
    <tr class="${isFirst ? 'expanded' : ''}" onclick="toggleContactoRow(this)">
      <td data-label="Nombre">
        <div class="contact-summary" style="display: none; pointer-events: none;">
          <span class="sum-name">${escAttr(c.nombre) || 'Nuevo Contacto'}</span>&nbsp;-&nbsp;<span class="sum-rel">${escAttr(c.relacion) || 'Sin relación'}</span>
        </div>
        <div class="contact-input-wrapper">
          <input type="text" class="form-control c-nombre save-state" value="${escAttr(c.nombre)}" style="font-size:0.85rem" oninput="updSummary(this)" onclick="event.stopPropagation()">
        </div>
      </td>
      <td data-label="Edad"><input type="number" class="form-control c-edad save-state numeric-input" value="${escAttr(c.edad)}" style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
      <td data-label="Sexo">
        <select class="form-select c-sexo save-state" onchange="updRelacion(this)" style="font-size:0.85rem" onclick="event.stopPropagation()">
          <option value="" ${!c.sexo ? 'selected disabled' : ''}>Sel</option>
          <option value="M" ${c.sexo === 'M' ? 'selected' : ''}>M</option>
          <option value="F" ${c.sexo === 'F' ? 'selected' : ''}>F</option>
        </select>
      </td>
      <td data-label="Relación">
        <select class="form-select c-relacion save-state" style="font-size:0.85rem" onchange="updSummary(this)" onclick="event.stopPropagation()">
          ${optionsRelacion}
        </select>
      </td>
      <td data-label="Dirección/Teléf"><input type="text" class="form-control c-dir save-state" value="${escAttr(dirVal)}" style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
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
      <td data-label="Fecha Sínt."><input type="date" class="form-control c-fecha save-state" value="${escAttr(c.fecha)}" ${c.enfermo !== 'SI' ? 'disabled' : ''} style="font-size:0.85rem" onclick="event.stopPropagation()"></td>
      <td data-label="Observaciones"><input type="text" class="form-control c-obs save-state" value="${escAttr(c.obs)}" style="font-size:0.85rem" placeholder="Observaciones..." onclick="event.stopPropagation()"></td>
      <td data-label="Acción" class="text-center align-middle">
        <button type="button" class="btn btn-sm btn-del-contacto p-1 border-0" onclick="eliminarContacto(this, event)" title="Eliminar este contacto">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    </tr>
  `;
  tbody.insertAdjacentHTML('beforeend', rowHTML);
}

export function eliminarContacto(btn, e) {
  if (e) e.stopPropagation();
  const tr = btn.closest('tr');
  if (!tr) return;
  const tbody = document.getElementById('contactsBody');

  if (tbody.children.length <= 1) {
    tr.querySelectorAll('input').forEach(inp => inp.value = '');
    tr.querySelectorAll('select').forEach(sel => sel.selectedIndex = 0);
    const sumName = tr.querySelector('.sum-name');
    const sumRel = tr.querySelector('.sum-rel');
    if (sumName) sumName.textContent = 'Nuevo Contacto';
    if (sumRel) sumRel.textContent = 'Sin relación';
    const fecha = tr.querySelector('.c-fecha');
    const obs = tr.querySelector('.c-obs');
    if (fecha) { fecha.value = ''; fecha.disabled = true; }
    if (obs) { obs.value = ''; obs.disabled = false; }
  } else {
    tr.remove();
  }

  let enfermos = 0;
  document.querySelectorAll('.c-enfermo').forEach(s => { if (s.value === 'SI') enfermos++; });
  const selectOtrosEnf = document.getElementById('otros_enfermos');
  if (selectOtrosEnf) {
    selectOtrosEnf.value = enfermos > 0 ? 'SI' : 'NO';
    toggleDondeEnfermos(selectOtrosEnf.value);
  }

  document.getElementById('epiForm')?.dispatchEvent(new Event('input', { bubbles: true }));
}

export function updRelacion(sel) {
  const row = sel.closest('tr'); const relSelect = row.querySelector('.c-relacion');
  const fragRel = document.createDocumentFragment();
  let op = document.createElement('option'); op.value = ""; op.text = "Seleccione..."; op.selected = true; op.disabled = true; fragRel.appendChild(op);

  if (sel.value === 'M') {
    ['PADRE', 'HERMANO', 'HIJO', 'TÍO', 'PRIMO', 'SOBRINO', 'ABUELO', 'NIETO', 'ESPOSO', 'SUEGRO', 'YERNO', 'CUÑADO', 'CONCUÑADO', 'PADRASTRO', 'HIJASTRO', 'AMIGO', 'COMPAÑERO', 'OTRO'].forEach(o => fragRel.appendChild(new Option(o, o)));
  } else if (sel.value === 'F') {
    ['MADRE', 'HERMANA', 'HIJA', 'TÍA', 'PRIMA', 'SOBRINA', 'ABUELA', 'NIETA', 'ESPOSA', 'SUEGRA', 'NUERA', 'CUÑADA', 'CONCUÑADA', 'MADRASTRA', 'HIJASTRA', 'AMIGA', 'COMPAÑERA', 'OTRA'].forEach(o => fragRel.appendChild(new Option(o, o)));
  }
  relSelect.innerHTML = ""; relSelect.appendChild(fragRel);
  updSummary(sel);
}

export function updCont(sel) {
  const row = sel.closest('tr'); const isSi = sel.value === 'SI';
  toggleElementos([row.querySelector('.c-fecha')], isSi);
  if (!isSi) { row.querySelector('.c-fecha').value = ''; }
  const obsInput = row.querySelector('.c-obs');
  if (obsInput) toggleElementos([obsInput], true);

  let enfermos = 0; document.querySelectorAll('.c-enfermo').forEach(s => { if (s.value === 'SI') enfermos++; });
  const selectOtrosEnf = document.getElementById('otros_enfermos');
  selectOtrosEnf.value = enfermos > 0 ? 'SI' : 'NO'; toggleDondeEnfermos(selectOtrosEnf.value);
}

// CRÍTICO: Exponer funciones a Window para los eventos inline inyectados
window.toggleContactoRow = toggleContactoRow;
window.updSummary = updSummary;
window.agregarContacto = agregarContacto;
window.agregarContactoRestaurado = agregarContactoRestaurado;
window.eliminarContacto = eliminarContacto;
window.updRelacion = updRelacion;
window.updCont = updCont;

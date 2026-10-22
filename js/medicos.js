// js/medicos.js - Base de Datos Inteligente y Autocompletado de Médicos

const STORAGE_KEY = 'epiMedicosDB';

// Médicos precargados iniciales basados en los expedientes del hospital
const MEDICOS_INICIALES = [
  {
    id: '1311851735',
    nombreCompleto: 'DR. YANDRY ALBERTO SALTOS MEZA',
    primerNombre: 'YANDRY',
    segundoNombre: 'ALBERTO',
    primerApellido: 'SALTOS',
    segundoApellido: 'MEZA',
    cedula: '1311851735',
    registroMsp: '1311851735',
    especialidad: 'MEDICO RESIDENTE',
    institucion: 'IESS',
    establecimiento: 'HOSPITAL GENERAL PORTOVIEJO'
  },
  {
    id: '1312124991',
    nombreCompleto: 'DRA. MAYRA ALEJANDRA CEDEÑO MERA',
    primerNombre: 'MAYRA',
    segundoNombre: 'ALEJANDRA',
    primerApellido: 'CEDEÑO',
    segundoApellido: 'MERA',
    cedula: '1312124991',
    registroMsp: '1312124991',
    especialidad: 'MEDICO RESIDENTE',
    institucion: 'IESS',
    establecimiento: 'HOSPITAL GENERAL PORTOVIEJO'
  }
];

export function obtenerMedicos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(MEDICOS_INICIALES));
      return [...MEDICOS_INICIALES];
    }
    const lista = JSON.parse(raw);
    return Array.isArray(lista) ? lista : [...MEDICOS_INICIALES];
  } catch (e) {
    return [...MEDICOS_INICIALES];
  }
}

export function guardarMedicos(lista) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch (e) {
    console.error('Error guardando médicos:', e);
  }
}

export function registrarOActualizarMedico(medico) {
  if (!medico) return;
  const cedula = (medico.cedula || medico.id || '').trim();
  const nombre = (medico.nombreCompleto || `${medico.primerNombre || ''} ${medico.primerApellido || ''}`.trim()).toUpperCase();
  
  if (!cedula && !nombre) return;

  const lista = obtenerMedicos();
  const index = lista.findIndex(m => (cedula && m.cedula === cedula) || (nombre && m.nombreCompleto === nombre));

  const nuevo = {
    id: cedula || `med_${Date.now()}`,
    nombreCompleto: nombre || (cedula ? `DR. ${cedula}` : 'MÉDICO'),
    primerNombre: (medico.primerNombre || '').toUpperCase(),
    segundoNombre: (medico.segundoNombre || '').toUpperCase(),
    primerApellido: (medico.primerApellido || '').toUpperCase(),
    segundoApellido: (medico.segundoApellido || '').toUpperCase(),
    cedula: cedula,
    registroMsp: (medico.registroMsp || cedula).trim(),
    especialidad: (medico.especialidad || 'MEDICO RESIDENTE').toUpperCase(),
    institucion: (medico.institucion || 'IESS').toUpperCase(),
    establecimiento: (medico.establecimiento || 'HOSPITAL GENERAL PORTOVIEJO').toUpperCase()
  };

  // Si no se desglosaron primer/segundo nombre, intentar derivarlos del nombreCompleto
  if (!nuevo.primerApellido && nuevo.nombreCompleto) {
    const limpio = nuevo.nombreCompleto.replace(/^(DR\.|DRA\.|MED\.)\s+/i, '').trim();
    const partes = limpio.split(/\s+/);
    if (partes.length >= 4) {
      nuevo.primerNombre = partes[0];
      nuevo.segundoNombre = partes[1];
      nuevo.primerApellido = partes[2];
      nuevo.segundoApellido = partes[3];
    } else if (partes.length === 3) {
      nuevo.primerNombre = partes[0];
      nuevo.primerApellido = partes[1];
      nuevo.segundoApellido = partes[2];
    } else if (partes.length === 2) {
      nuevo.primerNombre = partes[0];
      nuevo.primerApellido = partes[1];
    }
  }

  if (index >= 0) {
    lista[index] = { ...lista[index], ...nuevo };
  } else {
    lista.unshift(nuevo);
  }

  guardarMedicos(lista);
  actualizarDatalistMedicos();
  return nuevo;
}

export function eliminarMedico(idOCedula) {
  const lista = obtenerMedicos().filter(m => m.id !== idOCedula && m.cedula !== idOCedula);
  guardarMedicos(lista);
  actualizarDatalistMedicos();
}

export function actualizarDatalistMedicos() {
  let datalist = document.getElementById('listaMedicosDatalist');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'listaMedicosDatalist';
    document.body.appendChild(datalist);
  }
  
  const medicos = obtenerMedicos();
  datalist.innerHTML = medicos.map(m => {
    const label = `${m.nombreCompleto} - C.I: ${m.cedula || 'S/N'} (${m.especialidad || 'Médico'})`;
    return `<option value="${m.nombreCompleto}" data-cedula="${m.cedula}" data-esp="${m.especialidad}">${label}</option>`;
  }).join('');
}

export function configurarAutocompletadoMedicos(inputId, opciones = {}) {
  const input = document.getElementById(inputId);
  if (!input) return;

  actualizarDatalistMedicos();
  input.setAttribute('list', 'listaMedicosDatalist');

  input.addEventListener('change', () => {
    const val = input.value.trim().toUpperCase();
    const medicos = obtenerMedicos();
    const encontrado = medicos.find(m => 
      m.nombreCompleto.toUpperCase() === val || 
      (m.cedula && m.cedula === val) ||
      m.nombreCompleto.toUpperCase().includes(val)
    );

    if (encontrado) {
      input.value = encontrado.nombreCompleto;
      if (opciones.onSelect) opciones.onSelect(encontrado);
    }
  });
}

// Modal interactivo para administrar médicos guardados
export function abrirGestionMedicos() {
  const medicos = obtenerMedicos();
  
  let html = `
    <div class="text-start" style="font-size: 0.9rem; max-height: 380px; overflow-y: auto;">
      <p class="text-muted mb-2">Los médicos se guardan automáticamente al escribir en el formulario, o puedes agregar y editar aquí:</p>
      <div class="list-group mb-3">
  `;

  if (medicos.length === 0) {
    html += `<div class="p-3 text-center text-muted">No hay médicos registrados aún.</div>`;
  } else {
    medicos.forEach(m => {
      html += `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <strong>${m.nombreCompleto}</strong><br>
            <small class="text-muted">C.I: ${m.cedula || 'S/N'} | ${m.especialidad || 'General'}</small>
          </div>
          <button class="btn btn-sm btn-outline-danger btn-borrar-medico" data-id="${m.id}" title="Eliminar">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;
    });
  }

  html += `
      </div>
      <div class="card p-2 bg-light border">
        <h6 class="mb-2" style="font-size: 0.85rem; font-weight: bold;">+ Agregar Médico Nuevo:</h6>
        <div class="row g-2">
          <div class="col-12"><input type="text" id="nuevo_med_nombre" class="form-control form-control-sm" placeholder="Nombre Completo (Ej: DR. YANDRY SALTOS MEZA)"></div>
          <div class="col-6"><input type="text" id="nuevo_med_cedula" class="form-control form-control-sm" placeholder="Cédula / Registro MSP"></div>
          <div class="col-6"><input type="text" id="nuevo_med_esp" class="form-control form-control-sm" placeholder="Especialidad (Ej: MEDICO RESIDENTE)"></div>
        </div>
      </div>
    </div>
  `;

  Swal.fire({
    title: 'Médicos Frecuentes',
    html: html,
    showCancelButton: true,
    confirmButtonText: 'Guardar y Cerrar',
    cancelButtonText: 'Cerrar',
    confirmButtonColor: 'var(--apple-blue)',
    didOpen: () => {
      document.querySelectorAll('.btn-borrar-medico').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          eliminarMedico(id);
          abrirGestionMedicos();
        });
      });
    },
    preConfirm: () => {
      const nom = document.getElementById('nuevo_med_nombre')?.value.trim();
      const ced = document.getElementById('nuevo_med_cedula')?.value.trim();
      const esp = document.getElementById('nuevo_med_esp')?.value.trim();
      if (nom || ced) {
        registrarOActualizarMedico({
          nombreCompleto: nom,
          cedula: ced,
          registroMsp: ced,
          especialidad: esp
        });
      }
    }
  });
}

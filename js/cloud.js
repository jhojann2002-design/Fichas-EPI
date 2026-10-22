// js/cloud.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js";
import { mostrarLoader, ocultarLoader } from "./ui.js";
import { loadFormData, saveFormData, guardarBorradorLocal, obtenerClaveStorage } from "./storage.js";
import { descargarFichaSegura } from "./api.js";

const firebaseConfig = {
  apiKey: "AIzaSyALa05lAoLN42TzACFNkw1-CEbcdEoKxpM",
  authDomain: "fichas-epi-de871.firebaseapp.com",
  projectId: "fichas-epi-de871",
  storageBucket: "fichas-epi-de871.firebasestorage.app",
  messagingSenderId: "673365081030",
  appId: "1:673365081030:web:6037923fc1ddb8715250c7",
  measurementId: "G-NWTSK6LLZ0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;

export function initCloudAuth() {
  onAuthStateChanged(auth, (user) => {
    const btnSave = document.getElementById('btnSaveCloud');
    const btnSaveBottom = document.getElementById('btnSaveCloudBottom'); 
    const btnLoad = document.getElementById('btnLoadCloud');
    const loginText = document.getElementById('loginText');
    const btnLogout = document.getElementById('btnLogout');
    const menuDivider = document.getElementById('menuDivider');

    if (user) {
      currentUser = user;
      const nombreMostrado = user.displayName || user.email.split('@')[0];
      
      if(loginText) loginText.innerText = nombreMostrado;
      
      if(btnLogout) btnLogout.style.display = 'flex';
      if(btnSave) btnSave.style.display = 'flex';
      if(btnSaveBottom) btnSaveBottom.style.display = 'flex';
      if(btnLoad) btnLoad.style.display = 'flex';
      if(menuDivider) menuDivider.style.display = 'block';
      
    } else {
      currentUser = null;
      if(loginText) loginText.innerText = 'Iniciar sesión';
      if(btnLogout) btnLogout.style.display = 'none';
      if(btnSave) btnSave.style.display = 'none';
      if(btnSaveBottom) btnSaveBottom.style.display = 'none';
      if(btnLoad) btnLoad.style.display = 'none';
      if(menuDivider) menuDivider.style.display = 'none';
    }
  });
}

export async function toggleLogin() {
  const menuEl = document.getElementById('menuOpciones');
  if (menuEl) {
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(menuEl);
    if (bsOffcanvas) bsOffcanvas.hide();
  }

  await new Promise(resolve => setTimeout(resolve, 400));

  if (currentUser) {
    const nombreMostrado = currentUser.displayName || currentUser.email.split('@')[0];
    
    const result = await Swal.fire({
      icon: 'info',
      title: 'Sesión Activa',
      text: `Estás conectado como ${nombreMostrado}.`,
      showCancelButton: true,
      confirmButtonText: 'Cambiar Nombre',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: 'var(--apple-blue)'
    });

    if (result.isConfirmed) {
      const { value: nuevoNombre } = await Swal.fire({
        title: 'Actualizar Perfil',
        input: 'text',
        inputLabel: 'Ingresa tu nombre para mostrar en la app',
        inputValue: currentUser.displayName || '',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--apple-blue)',
        didOpen: () => {
          setTimeout(() => Swal.getInput().focus(), 150);
        }
      });

      if (nuevoNombre) {
        mostrarLoader("Actualizando...");
        await updateProfile(currentUser, { displayName: nuevoNombre });
        document.getElementById('loginText').innerText = nuevoNombre;
        ocultarLoader();
        Swal.fire({ icon: 'success', title: '¡Actualizado!', text: 'Tu nombre ha sido cambiado.', timer: 2000, showConfirmButton: false });
      }
    }
    return;
  }

  const ultimaCedula = localStorage.getItem('epiLastDoctorCedula') || '';
  const { value: cedulaMedico } = await Swal.fire({
    title: 'Acceso de Personal',
    input: 'number',
    inputLabel: 'Ingrese su número de cédula',
    inputValue: ultimaCedula,
    inputPlaceholder: 'Ej: 1301234567',
    showCancelButton: true,
    confirmButtonText: 'Acceder',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: 'var(--apple-blue)',
    didOpen: () => {
      setTimeout(() => Swal.getInput().focus(), 150);
    }
  });

  if (!cedulaMedico || cedulaMedico.length < 9) return;
  localStorage.setItem('epiLastDoctorCedula', cedulaMedico);

  mostrarLoader("Verificando acceso...");
  const email = `${cedulaMedico}@fichasepi.com`; 
  const password = cedulaMedico; 

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    ocultarLoader();
    const nombre = userCredential.user.displayName || ('Dr. ' + cedulaMedico);
    const medInput = document.getElementById('medico_tratante');
    if (medInput && !medInput.value) {
      medInput.value = nombre;
      medInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    Swal.fire({ icon: 'success', title: `¡Bienvenido(a), ${nombre}!`, timer: 1500, showConfirmButton: false });
  } catch (error) {
    ocultarLoader();
    try {
      const { value: nombreMedico } = await Swal.fire({
        title: 'Primer Ingreso',
        text: 'Parece que es tu primera vez usando esta función. ¿Cuál es tu nombre corto?',
        input: 'text',
        inputPlaceholder: 'Ej: Dr. Zambrano',
        showCancelButton: true,
        confirmButtonText: 'Comenzar',
        confirmButtonColor: 'var(--apple-blue)',
        didOpen: () => {
          setTimeout(() => Swal.getInput().focus(), 150);
        }
      });

      if(!nombreMedico) return;
      mostrarLoader("Creando cuenta...");

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: nombreMedico });

      const medInput = document.getElementById('medico_tratante');
      if (medInput && !medInput.value) {
        medInput.value = nombreMedico;
        medInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      ocultarLoader();
      Swal.fire('¡Registrado!', `Bienvenido(a), ${nombreMedico}.`, 'success');
    } catch (err2) {
      ocultarLoader();
      Swal.fire('Error', 'No se pudo acceder: ' + err2.message, 'error');
    }
  }
}

export async function confirmarCerrarSesion() {
  const { isConfirmed } = await Swal.fire({
    title: '¿Cerrar sesión?',
    text: "Tendrás que volver a ingresar tu cédula la próxima vez para acceder a tus fichas.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--apple-red)',
    cancelButtonColor: 'var(--apple-text-muted)',
    confirmButtonText: 'Sí, cerrar sesión',
    cancelButtonText: 'Cancelar'
  });

  if (isConfirmed) {
    await signOut(auth);
    Swal.fire({ icon: 'info', title: 'Sesión cerrada', timer: 1500, showConfirmButton: false });
  }
}

export async function guardarFichaNube() {
  const cedula = document.getElementById('cedula').value.trim();
  if (!cedula) return Swal.fire('Falta Cédula', 'Ingrese el número de cédula del paciente antes de guardar.', 'warning');

  // Si no hay conexión a internet, se guarda automáticamente en borradores locales
  if (!navigator.onLine) {
    guardarBorradorLocal();
    Swal.fire({
      icon: 'info',
      title: 'Modo Offline (Sin Internet)',
      html: 'No tienes conexión a internet en este momento.<br>La ficha se guardó de forma segura en tus <b>Borradores Locales</b> en este dispositivo y podrás sincronizarla cuando recuperes señal.',
      confirmButtonColor: 'var(--apple-blue)'
    });
    return;
  }

  if (!currentUser) return Swal.fire('Atención', 'Debes iniciar sesión primero con tu cédula.', 'warning');

  const menuEl = document.getElementById('menuOpciones');
  if (menuEl) {
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(menuEl);
    if(bsOffcanvas) bsOffcanvas.hide();
  }

  mostrarLoader("Guardando datos en la nube...");
  try {
    const modo = window.modoAppActual || 'epi';
    saveFormData(modo);
    const savedData = localStorage.getItem(obtenerClaveStorage(modo));
    if(!savedData) throw new Error("No hay datos para guardar.");

    const datosObj = JSON.parse(savedData);
    datosObj._modoFormulario = modo;
    datosObj.fecha_sincronizacion = new Date().toISOString(); 
    
    // Almacenar SOLO datos en Firestore
    const docRef = doc(db, `usuarios/${currentUser.uid}/fichas/${cedula}`);
    await setDoc(docRef, datosObj);

    ocultarLoader();
    Swal.fire('¡Guardado!', `Los datos de la ficha se guardaron al instante.`, 'success');
  } catch (error) {
    ocultarLoader();
    Swal.fire('Error', 'No se pudo guardar la ficha: ' + error.message, 'error');
  }
}

export async function sincronizarBorradoresNube() {
  if (!navigator.onLine) {
    return Swal.fire('Sin conexión', 'Necesitas conexión a internet para sincronizar tus fichas locales a la nube.', 'warning');
  }
  if (!currentUser) {
    return Swal.fire('Iniciar sesión', 'Debes iniciar sesión con tu cédula médica para subir fichas a tu cuenta.', 'info');
  }

  let borradores = [];
  try {
    borradores = JSON.parse(localStorage.getItem('epiBorradoresLocales') || '[]');
  } catch(e) {
    borradores = [];
  }

  if (borradores.length === 0) {
    return Swal.fire('Sin borradores', 'No tienes borradores locales pendientes en este equipo.', 'info');
  }

  mostrarLoader(`Sincronizando ${borradores.length} ficha(s)...`);
  let sincronizados = 0;
  let errores = 0;

  for (const b of borradores) {
    try {
      const ced = (b.cedula || b.data?.cedula || '').trim();
      if (!ced || ced === 'Sin-CI') continue;
      const docRef = doc(db, `usuarios/${currentUser.uid}/fichas/${ced}`);
      const datosObj = { ...(b.data || {}), fecha_sincronizacion: new Date().toISOString() };
      await setDoc(docRef, datosObj);
      sincronizados++;
    } catch(err) {
      errores++;
    }
  }

  ocultarLoader();
  Swal.fire({
    icon: 'success',
    title: '¡Sincronización Exitosa!',
    html: `Se sincronizaron <b>${sincronizados}</b> ficha(s) a tu cuenta en la nube.${errores > 0 ? `<br><small class="text-danger">${errores} no se pudieron sincronizar.</small>` : ''}`,
    confirmButtonColor: 'var(--apple-blue)'
  });
}


export async function cargarFichaNube() {
  if (!currentUser) return Swal.fire('Atención', 'Debes iniciar sesión primero', 'warning');
  
  const menuEl = document.getElementById('menuOpciones');
  if (menuEl) {
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(menuEl);
    if(bsOffcanvas) bsOffcanvas.hide();
  }

  mostrarLoader("Buscando tus fichas...");
  try {
    const fichasRef = collection(db, `usuarios/${currentUser.uid}/fichas`);
    const querySnapshot = await getDocs(fichasRef);
    
    ocultarLoader();

    if (querySnapshot.empty) {
      return Swal.fire('Sin registros', 'Aún no tienes fichas guardadas en la nube.', 'info');
    }

    const fichasArray = [];
    querySnapshot.forEach((docData) => {
      fichasArray.push({ id: docData.id, ...docData.data() });
    });

    fichasArray.sort((a, b) => new Date(b.fecha_sincronizacion || 0) - new Date(a.fecha_sincronizacion || 0));

    let htmlContent = `
      <div class="mb-3">
        <input type="text" id="filtroFichasNube" class="form-control" placeholder="🔍 Buscar por cédula o nombre..." style="border-radius: 8px;">
      </div>
      <div id="listaFichasNubeCont" class="list-group text-start" style="max-height: 400px; overflow-y: auto;">
    `;

    fichasArray.forEach((data) => {
      const nombre = `${data.primer_apellido || ''} ${data.primer_nombre || ''}`.trim() || 'Sin Nombre';
      const fecha = data.fecha_sincronizacion ? new Date(data.fecha_sincronizacion).toLocaleDateString() + ' ' + new Date(data.fecha_sincronizacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const busqueda = `${data.id} ${nombre}`.toLowerCase();
      
      htmlContent += `
        <div class="list-group-item item-ficha-nube flex-column align-items-start mb-2 p-3" data-busqueda="${busqueda}" style="border-radius: 8px; border: 1px solid var(--apple-border); background: var(--apple-subcard-bg);">
          <div class="d-flex justify-content-between align-items-center w-100 mb-2">
            <div style="line-height: 1.3;">
              <strong style="color: var(--apple-blue); font-size: 1.05rem;">C.I: ${data.id}</strong><br>
              <span style="color: var(--apple-text); font-size: 0.95rem;">${nombre}</span>
              ${fecha ? `<br><small style="color: var(--apple-text-muted); font-size: 0.8rem;">Guardada: ${fecha}</small>` : ''}
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm d-flex align-items-center justify-content-center" style="background: rgba(255, 59, 48, 0.1); color: var(--apple-red); border-radius: 8px; width: 36px; height: 36px; border: 1px solid rgba(255, 59, 48, 0.2);" onclick="eliminarFichaNube('${data.id}')" title="Eliminar Ficha">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
          <div class="d-flex gap-2 pt-3 mt-2" style="border-top: 1px solid var(--apple-border);">
            <button class="btn btn-sm d-flex align-items-center justify-content-center gap-2 flex-grow-1" style="background: var(--apple-input-bg); color: var(--apple-text); border: 1px solid var(--apple-border); border-radius: 6px; font-weight: 500;" onclick="cargarFichaEspecifica('${data.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Editar
            </button>
            <button class="btn btn-sm d-flex align-items-center justify-content-center gap-2 text-white flex-grow-1" style="background: #e53935; border-radius: 6px; font-weight: 500;" onclick="cargarYDescargarPDF('${data.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Descargar PDF
            </button>
          </div>
        </div>
      `;
    });
    htmlContent += '</div>';

    Swal.fire({
      title: 'Mis Fichas Guardadas',
      html: htmlContent,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      cancelButtonColor: 'var(--apple-text-muted)',
      width: '550px',
      didOpen: () => {
        const filtro = document.getElementById('filtroFichasNube');
        if (filtro) {
          filtro.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.item-ficha-nube').forEach(item => {
              const texto = item.getAttribute('data-busqueda') || '';
              item.style.display = texto.includes(q) ? '' : 'none';
            });
          });
        }
      }
    });
  } catch (error) {
    ocultarLoader();
    Swal.fire('Error', 'Hubo un problema cargando la lista: ' + error.message, 'error');
  }
}

// NUEVA FUNCIÓN: Carga los datos y genera el PDF automáticamente
export async function cargarYDescargarPDF(cedula) {
  Swal.close();
  mostrarLoader("Generando PDF desde datos...");
  try {
    const docElegido = await getDoc(doc(db, `usuarios/${currentUser.uid}/fichas/${cedula}`));
    if (docElegido.exists()) {
      const data = docElegido.data();
      const modoDestino = data._modoFormulario || 'epi';
      localStorage.setItem(obtenerClaveStorage(modoDestino), JSON.stringify(data));
      if (typeof window.cambiarModoApp === 'function' && window.modoAppActual !== modoDestino) {
        window.cambiarModoApp(modoDestino);
      } else {
        loadFormData(modoDestino);
      }
      
      // Retardo breve para asegurar que el DOM aplicó los datos antes de generar el PDF
      setTimeout(async () => {
         if (modoDestino === 'sppat' && typeof window.descargarExpedienteSppat === 'function') {
           await window.descargarExpedienteSppat();
         } else {
           await descargarFichaSegura('pdf', false);
         }
      }, 500);
    }
  } catch (error) {
    ocultarLoader();
    Swal.fire('Error', 'No se pudo generar el PDF: ' + error.message, 'error');
  }
}

export async function cargarFichaEspecifica(cedula) {
  Swal.close();
  mostrarLoader("Descargando formulario...");
  try {
    const docElegido = await getDoc(doc(db, `usuarios/${currentUser.uid}/fichas/${cedula}`));
    if (docElegido.exists()) {
      const data = docElegido.data();
      const modoDestino = data._modoFormulario || 'epi';
      localStorage.setItem(obtenerClaveStorage(modoDestino), JSON.stringify(data));
      if (typeof window.cambiarModoApp === 'function' && window.modoAppActual !== modoDestino) {
        window.cambiarModoApp(modoDestino);
      } else {
        loadFormData(modoDestino);
      }
      ocultarLoader();
      Swal.fire('¡Cargado!', `Ficha web de ${cedula} restaurada correctamente.`, 'success');
    }
  } catch (error) {
    ocultarLoader();
    Swal.fire('Error', 'No se pudo descargar la ficha: ' + error.message, 'error');
  }
}

export async function eliminarFichaNube(cedula) {
  const { isConfirmed } = await Swal.fire({
    title: '¿Estás seguro?',
    text: `Se borrarán los datos de la ficha de ${cedula} permanentemente.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--apple-red)',
    cancelButtonColor: 'var(--apple-text-muted)',
    confirmButtonText: 'Sí, borrar',
    cancelButtonText: 'Cancelar'
  });

  if (isConfirmed) {
    mostrarLoader("Borrando registro...");
    try {
      // Solo borramos el documento de datos
      await deleteDoc(doc(db, `usuarios/${currentUser.uid}/fichas/${cedula}`));

      ocultarLoader();
      Swal.fire({ icon: 'success', title: 'Borrada', text: 'La ficha ha sido eliminada.', timer: 1500, showConfirmButton: false });
      setTimeout(cargarFichaNube, 1500);
    } catch (error) {
      ocultarLoader();
      Swal.fire('Error', 'No se pudo borrar: ' + error.message, 'error');
    }
  }
}

window.toggleLogin = toggleLogin;
window.guardarFichaNube = guardarFichaNube;
window.cargarFichaNube = cargarFichaNube;
window.confirmarCerrarSesion = confirmarCerrarSesion;
window.cargarFichaEspecifica = cargarFichaEspecifica;
window.eliminarFichaNube = eliminarFichaNube;
// IMPORTANTE: Exponer la nueva función para que el HTML del modal la pueda invocar
window.cargarYDescargarPDF = cargarYDescargarPDF;
window.sincronizarBorradoresNube = sincronizarBorradoresNube;
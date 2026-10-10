// js/cloud.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { mostrarLoader, ocultarLoader } from "./ui.js";
import { loadFormData, saveFormData } from "./storage.js";

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

let currentUser = null;

export function initCloudAuth() {
  onAuthStateChanged(auth, (user) => {
    const btnSave = document.getElementById('btnSaveCloud');
    const btnLoad = document.getElementById('btnLoadCloud');
    const loginText = document.getElementById('loginText');
    const btnLogout = document.getElementById('btnLogout');
    const menuDivider = document.getElementById('menuDivider');

    if (user) {
      currentUser = user;
      const cedulaMostrada = user.email.split('@')[0];
      
      if(loginText) loginText.innerText = cedulaMostrada;
      
      if(btnLogout) btnLogout.style.display = 'flex';
      if(btnSave) btnSave.style.display = 'flex';
      if(btnLoad) btnLoad.style.display = 'flex';
      if(menuDivider) menuDivider.style.display = 'block';
      
    } else {
      currentUser = null;
      if(loginText) loginText.innerText = 'Iniciar sesión';
      if(btnLogout) btnLogout.style.display = 'none';
      if(btnSave) btnSave.style.display = 'none';
      if(btnLoad) btnLoad.style.display = 'none';
      if(menuDivider) menuDivider.style.display = 'none';
    }
  });
}

export async function toggleLogin() {
  if (currentUser) {
    // Si ya inició sesión, al presionar el botón de la cédula solo informamos, NO cerramos sesión
    Swal.fire({
      icon: 'info',
      title: 'Sesión Activa',
      text: `Estás conectado como ${currentUser.email.split('@')[0]}. Si deseas salir, usa el botón "Cerrar sesión" debajo.`,
      confirmButtonColor: 'var(--apple-blue)'
    });
    return;
  }

  const menuEl = document.getElementById('menuOpciones');
  if (menuEl) {
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(menuEl) || new bootstrap.Offcanvas(menuEl);
    bsOffcanvas.hide();
  }

  const { value: cedulaMedico } = await Swal.fire({
    title: 'Acceso de Personal',
    input: 'number',
    inputLabel: 'Ingrese su número de cédula',
    inputPlaceholder: 'Ej: 1301234567',
    showCancelButton: true,
    confirmButtonText: 'Entrar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: 'var(--apple-blue)'
  });

  if (!cedulaMedico || cedulaMedico.length < 9) return;

  mostrarLoader("Verificando acceso...");
  const email = `${cedulaMedico}@fichasepi.com`; 
  const password = cedulaMedico; 

  try {
    await signInWithEmailAndPassword(auth, email, password);
    ocultarLoader();
    Swal.fire({ icon: 'success', title: '¡Acceso Correcto!', timer: 1500, showConfirmButton: false });
  } catch (error) {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      ocultarLoader();
      Swal.fire('¡Registrado!', 'Es tu primera vez. Tu acceso ha sido creado con éxito.', 'success');
    } catch (err2) {
      ocultarLoader();
      Swal.fire('Error', 'No se pudo acceder: ' + err2.message, 'error');
    }
  }
}

// Nueva función exclusiva para evitar cerrar sesión por accidente
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
  if (!currentUser) return Swal.fire('Atención', 'Debes iniciar sesión primero', 'warning');
  
  const cedula = document.getElementById('cedula').value.trim();
  if (!cedula) return Swal.fire('Falta Cédula', 'Ingrese el número de cédula del paciente antes de guardar.', 'warning');

  const menuEl = document.getElementById('menuOpciones');
  if (menuEl) {
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(menuEl);
    if(bsOffcanvas) bsOffcanvas.hide();
  }

  mostrarLoader("Guardando en la nube...");
  try {
    saveFormData();
    const savedData = localStorage.getItem('epiFormData');
    if(!savedData) throw new Error("No hay datos para guardar.");

    const datosObj = JSON.parse(savedData);
    datosObj.fecha_sincronizacion = new Date().toISOString(); 

    const docRef = doc(db, `usuarios/${currentUser.uid}/fichas/${cedula}`);
    await setDoc(docRef, datosObj);

    ocultarLoader();
    Swal.fire('¡Guardado!', `La ficha del paciente ${cedula} está en la nube.`, 'success');
  } catch (error) {
    ocultarLoader();
    Swal.fire('Error', 'No se pudo guardar: ' + error.message, 'error');
  }
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

    let htmlContent = '<div class="list-group text-start" style="max-height: 400px; overflow-y: auto;">';
    querySnapshot.forEach((docData) => {
      const data = docData.data();
      const nombre = `${data.primer_apellido || ''} ${data.primer_nombre || ''}`.trim() || 'Sin Nombre';
      const fecha = data.fecha_sincronizacion ? new Date(data.fecha_sincronizacion).toLocaleDateString() : '';
      htmlContent += `
        <div class="list-group-item d-flex justify-content-between align-items-center mb-2" style="border-radius: 8px; border: 1px solid var(--apple-border); background: var(--apple-subcard-bg);">
          <div style="line-height: 1.3;">
            <strong style="color: var(--apple-blue); font-size: 1.05rem;">C.I: ${docData.id}</strong><br>
            <span style="color: var(--apple-text); font-size: 0.95rem;">${nombre}</span>
            ${fecha ? `<br><small style="color: var(--apple-text-muted); font-size: 0.8rem;">Guardada: ${fecha}</small>` : ''}
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm d-flex align-items-center justify-content-center" style="background: var(--apple-blue); color: white; border-radius: 8px; width: 36px; height: 36px;" onclick="cargarFichaEspecifica('${docData.id}')" title="Cargar Ficha">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button class="btn btn-sm d-flex align-items-center justify-content-center" style="background: rgba(255, 59, 48, 0.1); color: var(--apple-red); border-radius: 8px; width: 36px; height: 36px; border: 1px solid rgba(255, 59, 48, 0.2);" onclick="eliminarFichaNube('${docData.id}')" title="Eliminar Ficha">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
      width: '550px'
    });
  } catch (error) {
    ocultarLoader();
    Swal.fire('Error', 'Hubo un problema cargando la lista: ' + error.message, 'error');
  }
}

export async function cargarFichaEspecifica(cedula) {
  Swal.close();
  mostrarLoader("Descargando...");
  try {
    const docElegido = await getDoc(doc(db, `usuarios/${currentUser.uid}/fichas/${cedula}`));
    if (docElegido.exists()) {
      localStorage.setItem('epiFormData', JSON.stringify(docElegido.data()));
      loadFormData();
      ocultarLoader();
      Swal.fire('¡Cargado!', `Ficha de ${cedula} restaurada correctamente.`, 'success');
    }
  } catch (error) {
    ocultarLoader();
    Swal.fire('Error', 'No se pudo descargar la ficha: ' + error.message, 'error');
  }
}

export async function eliminarFichaNube(cedula) {
  const { isConfirmed } = await Swal.fire({
    title: '¿Estás seguro?',
    text: `Se borrará la ficha de ${cedula} permanentemente de la nube.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--apple-red)',
    cancelButtonColor: 'var(--apple-text-muted)',
    confirmButtonText: 'Sí, borrar',
    cancelButtonText: 'Cancelar'
  });

  if (isConfirmed) {
    mostrarLoader("Borrando...");
    try {
      await deleteDoc(doc(db, `usuarios/${currentUser.uid}/fichas/${cedula}`));
      ocultarLoader();
      Swal.fire({ icon: 'success', title: 'Borrada', text: 'La ficha ha sido eliminada.', timer: 1500, showConfirmButton: false });
      // Recargamos el panel para actualizar los datos
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
import { SupabaseConfig } from './supabase-config.js';

/**
 * Genera una firma clínica única e invariable para cualquier pregunta
 * basándose en su enunciado y opciones normalizadas (sin tildes, signos ni mayúsculas).
 */
export function getQuestionFingerprint(q) {
  if (!q) return '';
  const stem = (q.enunciado || q.statement || q.pregunta || '').toString();
  const normStem = stem
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  let optText = '';
  if (q.opciones) {
    if (Array.isArray(q.opciones)) {
      optText = q.opciones.map(o => (typeof o === 'string' ? o : o.texto || o.text || '')).sort().join('');
    } else if (typeof q.opciones === 'object') {
      optText = Object.values(q.opciones).map(v => (typeof v === 'string' ? v : v.texto || v.text || '')).sort().join('');
    }
  }
  const normOpt = optText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 60);

  return `${normStem.substring(0, 220)}_${normOpt}`;
}

/**
 * Normaliza las opciones de cualquier pregunta al formato estándar Array:
 * [ { id: 'A', texto: '...' }, { id: 'B', texto: '...' }, ... ]
 */
export function normalizeQuestionOptions(q) {
  if (!q) return q;
  const letters = ['A', 'B', 'C', 'D', 'E'];
  let normalized = [];
  const rawOpts = q.opciones || q.options || q.respuestas || q.answers;

  if (Array.isArray(rawOpts)) {
    rawOpts.forEach((item, i) => {
      if (typeof item === 'string') {
        normalized.push({ id: letters[i] || `${i + 1}`, texto: item.trim() });
      } else if (typeof item === 'object' && item !== null) {
        normalized.push({
          id: (item.id || item.letter || letters[i] || `${i + 1}`).toString().trim().toUpperCase(),
          texto: (item.texto || item.text || item.value || item.answer || '').toString().trim()
        });
      }
    });
  } else if (typeof rawOpts === 'object' && rawOpts !== null) {
    Object.keys(rawOpts).forEach(k => {
      const val = rawOpts[k];
      normalized.push({
        id: k.toString().trim().toUpperCase(),
        texto: (typeof val === 'string' ? val : (val?.texto || val?.text || '')).toString().trim()
      });
    });
  }

  normalized = normalized.filter(o => o && o.texto && o.texto.length > 0);
  while (normalized.length < 4) {
    const nextL = letters[normalized.length];
    normalized.push({ id: nextL, texto: `Opción adicional ${nextL}` });
  }

  return {
    ...q,
    opciones: normalized.slice(0, 4)
  };
}

const ACTIVE_SESSION_STORAGE_KEY = 'caces_active_session_v1';

class StorageManager {
  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.supabaseClient = null;
    this._syncDebounceTimer = null;
    this.initSupabase();

    if (localStorage.getItem('caces_master_db_v4_pro') !== 'true') {
      localStorage.removeItem('caces_force_empty');
      localStorage.removeItem('caces_custom_questions');
      localStorage.removeItem('caces_questions');
      localStorage.removeItem('custom_questions');
      localStorage.removeItem('imported_questions');
      localStorage.removeItem('banco_caces');
      localStorage.setItem('caces_master_db_v4_pro', 'true');
    }
  }

  getOrCreateDeviceId() {
    let id = localStorage.getItem('caces_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem('caces_device_id', id);
    }
    return id;
  }

  initSupabase() {
    if (SupabaseConfig.isConfigured() && window.supabase) {
      try {
        this.supabaseClient = window.supabase.createClient(
          SupabaseConfig.getUrl(),
          SupabaseConfig.getAnonKey()
        );
      } catch (e) {
        console.warn("No se pudo inicializar cliente Supabase:", e);
        this.supabaseClient = null;
      }
    } else {
      this.supabaseClient = null;
    }
  }

  /**
   * Programa una sincronización en segundo plano sin bloquear la interfaz
   */
  scheduleAutoCloudSync(delayMs = 2500) {
    try {
      if (this._syncDebounceTimer) {
        clearTimeout(this._syncDebounceTimer);
      }
      this._syncDebounceTimer = setTimeout(() => {
        this.syncUserProgressToCloud().catch(err => {
          console.warn("Auto-sync en segundo plano omitido:", err);
        });
      }, delayMs);
    } catch (e) {
      console.warn("Error al programar auto-sync:", e);
    }
  }

  // =========================================================================
  // PERSISTENCIA DE SESIÓN ACTIVA INDEPENDIENTE (SIMULADOR vs MODO ESTUDIO)
  // =========================================================================
  getSessionKeyForSlot(slot = 'simulacro') {
    return slot === 'estudio'
      ? 'caces_active_session_estudio_v1'
      : 'caces_active_session_simulacro_v1';
  }

  saveActiveSession(sessionData, explicitSlot = null) {
    try {
      if (!sessionData) return;
      const slot = explicitSlot || (sessionData.mode === 'caces' ? 'simulacro' : 'estudio');
      const payload = JSON.stringify({
        ...sessionData,
        slot,
        savedAt: Date.now()
      });
      localStorage.setItem(this.getSessionKeyForSlot(slot), payload);
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, payload);
      localStorage.setItem('caces_last_active_slot', slot);
    } catch (e) {
      console.warn("No se pudo guardar la sesión activa:", e);
    }
  }

  getActiveSession(explicitSlot = null) {
    try {
      if (explicitSlot) {
        const rawSlot = localStorage.getItem(this.getSessionKeyForSlot(explicitSlot));
        if (rawSlot) {
          const parsedSlot = JSON.parse(rawSlot);
          if (parsedSlot && Array.isArray(parsedSlot.sessionQuestions) && parsedSlot.sessionQuestions.length > 0) {
            return parsedSlot;
          }
        }
        // Compatibilidad con sesión previa única si coincide con el modo
        const rawLegacy = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        if (rawLegacy) {
          const parsedLegacy = JSON.parse(rawLegacy);
          const legacySlot = parsedLegacy?.mode === 'caces' ? 'simulacro' : 'estudio';
          if (legacySlot === explicitSlot && Array.isArray(parsedLegacy?.sessionQuestions) && parsedLegacy.sessionQuestions.length > 0) {
            return parsedLegacy;
          }
        }
        return null;
      }

      const lastSlot = localStorage.getItem('caces_last_active_slot');
      if (lastSlot) {
        const byLast = this.getActiveSession(lastSlot);
        if (byLast) return byLast;
      }

      const simSession = this.getActiveSession('simulacro');
      if (simSession) return simSession;

      const estSession = this.getActiveSession('estudio');
      if (estSession) return estSession;

      const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sessionQuestions) || parsed.sessionQuestions.length === 0) {
        return null;
      }
      return parsed;
    } catch (e) {
      console.warn("Error leyendo sesión activa:", e);
      return null;
    }
  }

  clearActiveSession(explicitSlot = null) {
    try {
      if (explicitSlot === 'simulacro' || explicitSlot === 'estudio') {
        localStorage.removeItem(this.getSessionKeyForSlot(explicitSlot));
        const rawLegacy = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        if (rawLegacy) {
          const parsed = JSON.parse(rawLegacy);
          const legacySlot = parsed?.mode === 'caces' ? 'simulacro' : 'estudio';
          if (legacySlot === explicitSlot) {
            localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
          }
        }
        return;
      }
      localStorage.removeItem('caces_active_session_simulacro_v1');
      localStorage.removeItem('caces_active_session_estudio_v1');
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn("Error limpiando sesión activa:", e);
    }
  }

  // =========================================================================
  // SISTEMA DE PERFIL DE USUARIO Y SINCRONIZACIÓN DE PROGRESO
  // =========================================================================
  getUserProfile() {
    try {
      const raw = localStorage.getItem('caces_user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async loginOrRegisterUser({ name, email, pin = '0000', avatar = null, provider = 'email' }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim() || cleanEmail.split('@')[0] || 'Médico EHEP';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Ingresa un correo electrónico válido.');
    }

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=10b981&color=fff&bold=true`;
    const userKey = `user_${cleanEmail}`;
    const profile = {
      name: cleanName,
      email: cleanEmail,
      avatar: avatar || defaultAvatar,
      provider: provider || 'email',
      userKey,
      updatedAt: new Date().toISOString()
    };

    this.deviceId = `usr_${cleanEmail}`;
    localStorage.setItem('caces_device_id', this.deviceId);
    localStorage.setItem('caces_user_profile', JSON.stringify(profile));

    await this.pullUserProgressFromCloud(cleanEmail);
    await this.syncUserProgressToCloud();

    return profile;
  }

  async loginWithGoogle() {
    if (this.supabaseClient?.auth?.signInWithOAuth && window.location.protocol.startsWith('http')) {
      try {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent'
            }
          }
        });
        if (error) {
          console.warn("Supabase Google OAuth:", error.message);
        } else if (data?.url) {
          window.location.href = data.url;
          return { inProgress: true };
        }
      } catch (err) {
        console.warn("Excepción en Supabase Google OAuth:", err);
      }
    }

    return new Promise((resolve, reject) => {
      const email = prompt("Inicia sesión con tu cuenta de Google:\nIngresa tu correo de Gmail:", "");
      if (email === null) {
        reject(new Error("Inicio de sesión cancelado."));
        return;
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        reject(new Error("Ingresa un correo de Google válido (ej: usuario@gmail.com)."));
        return;
      }

      const defaultName = cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const name = prompt("Nombre o Alias que deseas mostrar en tu credencial médica:", defaultName) || defaultName;
      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff&bold=true`;

      this.loginOrRegisterUser({
        name,
        email: cleanEmail,
        avatar,
        provider: 'google'
      }).then(resolve).catch(reject);
    });
  }

  logoutUser() {
    localStorage.removeItem('caces_user_profile');
    if (this.supabaseClient?.auth?.signOut) {
      this.supabaseClient.auth.signOut().catch(() => {});
    }
  }

  async syncUserProgressToCloud() {
    const profile = this.getUserProfile();
    if (!profile || !this.supabaseClient) return { synced: false };

    const snapshot = {
      xp: parseInt(localStorage.getItem('caces_xp') || '120', 10),
      streak: parseInt(localStorage.getItem('caces_streak') || '1', 10),
      highScoreBlitz: parseInt(localStorage.getItem('caces_blitz_high') || '0', 10),
      errorBank: this.getErrorBank(),
      srsDeck: JSON.parse(localStorage.getItem('caces_srs_deck') || '{}'),
      profileName: profile.name
    };

    try {
      await this.supabaseClient.from('caces_simulacros').insert({
        user_email: profile.email,
        device_id: this.deviceId,
        modo: '__PROFILE_SYNC__',
        puntuacion_obtenida: snapshot.xp,
        total_preguntas: snapshot.streak,
        porcentaje: snapshot.highScoreBlitz,
        tiempo_segundos: 0,
        desglose_especialidades: snapshot
      });
      return { synced: true };
    } catch (e) {
      console.warn('Error sincronizando perfil en la nube:', e);
      return { synced: false };
    }
  }

  async pullUserProgressFromCloud(email) {
    if (!this.supabaseClient || !email) return false;
    try {
      const { data, error } = await this.supabaseClient
        .from('caces_simulacros')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !data || data.length === 0) return false;

      const latestSync = data.find(r => r.modo === '__PROFILE_SYNC__' && r.desglose_especialidades);
      if (latestSync && latestSync.desglose_especialidades) {
        const snap = latestSync.desglose_especialidades;
        const localXp = parseInt(localStorage.getItem('caces_xp') || '0', 10);
        if ((snap.xp || 0) > localXp) {
          localStorage.setItem('caces_xp', String(snap.xp));
        }
        if (snap.highScoreBlitz) {
          const localHigh = parseInt(localStorage.getItem('caces_blitz_high') || '0', 10);
          if (snap.highScoreBlitz > localHigh) {
            localStorage.setItem('caces_blitz_high', String(snap.highScoreBlitz));
          }
        }
        if (snap.errorBank && typeof snap.errorBank === 'object') {
          const mergedErrors = { ...snap.errorBank, ...this.getErrorBank() };
          localStorage.setItem('caces_error_bank', JSON.stringify(mergedErrors));
        }
      }

      const realExams = data.filter(r => r.modo !== '__PROFILE_SYNC__');
      if (realExams.length > 0 && this.getExamHistory().length === 0) {
        const reconstructed = realExams.map(r => ({
          id: r.id,
          modo: r.modo,
          puntuacion: r.puntuacion_obtenida,
          total: r.total_preguntas,
          porcentaje: r.porcentaje,
          tiempo: r.tiempo_segundos,
          desglose: r.desglose_especialidades || {},
          fecha: r.created_at
        }));
        localStorage.setItem('caces_exam_history', JSON.stringify(reconstructed));
      }
      return true;
    } catch (e) {
      console.warn('No se pudo recuperar respaldo de la nube:', e);
      return false;
    }
  }

  async testSupabaseConnection() {
    if (!this.supabaseClient) {
      this.initSupabase();
    }
    if (!this.supabaseClient) {
      return { success: false, message: "Cliente de Supabase no configurado o credenciales inválidas." };
    }
    try {
      const { error } = await this.supabaseClient.from('caces_questions').select('id').limit(1);
      if (error) {
        return { success: false, message: `Error de consulta en Supabase: ${error.message}` };
      }
      return { success: true, message: "Conexión exitosa a Supabase. Base de datos sincronizada." };
    } catch (e) {
      return { success: false, message: `Excepción de red: ${e.message}` };
    }
  }

  deduplicateQuestions(questionsList) {
    if (!Array.isArray(questionsList)) return [];
    const map = new Map();

    questionsList.forEach(q => {
      if (!q) return;
      const fp = getQuestionFingerprint(q);
      const key = fp || q.id;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, q);
      } else {
        const existing = map.get(key);
        const existingScore = (existing.justificacion?.length || 0) + (existing.subtema ? 10 : 0);
        const newScore = (q.justificacion?.length || 0) + (q.subtema ? 10 : 0);
        if (newScore > existingScore) {
          map.set(key, { ...existing, ...q });
        }
      }
    });

    return Array.from(map.values());
  }

  async getAllQuestions() {
    if (localStorage.getItem('caces_force_empty') === 'true') {
      return [];
    }

    let baseQuestions = [];
    try {
      const resp = await fetch(`data/banco_inicial.json?nocache=${Date.now()}`, { cache: 'no-store' });
      if (resp.ok) {
        baseQuestions = await resp.json();
      }
    } catch (e) {
      console.warn("No se pudo cargar data/banco_inicial.json:", e);
    }

    let localCustom = [];
    try {
      const stored = localStorage.getItem('caces_custom_questions');
      if (stored) {
        localCustom = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Error leyendo caces_custom_questions:", e);
    }

    let cloudQuestions = [];
    if (this.supabaseClient) {
      try {
        const { data, error } = await this.supabaseClient
          .from('caces_questions')
          .select('*');
        if (!error && data) {
          cloudQuestions = data;
        }
      } catch (e) {
        console.warn("Error consultando Supabase:", e);
      }
    }

    const combined = [...baseQuestions, ...localCustom, ...cloudQuestions];
    const unique = this.deduplicateQuestions(combined);

    if (localCustom.length > 0) {
      const cleanCustom = this.deduplicateQuestions(localCustom);
      if (cleanCustom.length !== localCustom.length) {
        localStorage.setItem('caces_custom_questions', JSON.stringify(cleanCustom));
      }
    }

    return unique.map(q => normalizeQuestionOptions(q));
  }

  async saveCustomQuestions(newQuestions) {
    if (!Array.isArray(newQuestions) || newQuestions.length === 0) {
      return { added: 0, duplicatesSkipped: 0, total: 0 };
    }

    let existing = [];
    try {
      const stored = localStorage.getItem('caces_custom_questions');
      if (stored) existing = JSON.parse(stored);
    } catch (e) {}

    existing = this.deduplicateQuestions(existing);

    const existingFpMap = new Map();
    existing.forEach(q => {
      const fp = getQuestionFingerprint(q) || q.id;
      if (fp) existingFpMap.set(fp, q);
    });

    const trulyNew = [];
    let duplicatesSkipped = 0;

    newQuestions.forEach(q => {
      const fp = getQuestionFingerprint(q) || q.id;
      if (!fp) return;

      if (!existingFpMap.has(fp)) {
        existingFpMap.set(fp, q);
        trulyNew.push(q);
      } else {
        const oldQ = existingFpMap.get(fp);
        if (oldQ) {
          Object.assign(oldQ, q);
        }
        duplicatesSkipped++;
      }
    });

    const updated = trulyNew.length > 0 ? [...existing, ...trulyNew] : existing;
    localStorage.setItem('caces_custom_questions', JSON.stringify(updated));
    localStorage.removeItem('caces_force_empty');

    if (trulyNew.length > 0 && this.supabaseClient) {
      try {
        const chunkSize = 100;
        for (let i = 0; i < trulyNew.length; i += chunkSize) {
          const slice = trulyNew.slice(i, i + chunkSize);
          await this.supabaseClient
            .from('caces_questions')
            .upsert(slice, { onConflict: 'id' });
        }
      } catch (e) {
        console.error("Excepción al subir a Supabase en lotes:", e);
      }
    }

    return {
      added: trulyNew.length,
      duplicatesSkipped: duplicatesSkipped,
      total: existing.length + trulyNew.length
    };
  }

  async cleanDuplicates() {
    let existing = [];
    try {
      const stored = localStorage.getItem('caces_custom_questions');
      if (stored) existing = JSON.parse(stored);
    } catch (e) {}

    const beforeCount = existing.length;
    const cleanList = this.deduplicateQuestions(existing);
    const removedCount = beforeCount - cleanList.length;

    localStorage.setItem('caces_custom_questions', JSON.stringify(cleanList));
    return {
      before: beforeCount,
      after: cleanList.length,
      removed: removedCount
    };
  }

  async saveExamResult(result) {
    const historyEntry = {
      id: 'sim_' + Date.now(),
      modo: result.modo,
      modeKey: result.modeKey,
      puntuacion: result.puntuacion,
      total: result.total,
      incorrectas: result.incorrectas,
      sinResponder: result.sinResponder,
      porcentaje: result.porcentaje,
      puntajeCaces: result.puntajeCaces,
      aprobado: result.aprobado,
      tiempo: result.tiempo,
      desglose: result.desglose || {},
      respuestasUsuario: result.respuestasUsuario || {},
      fecha: new Date().toISOString(),
      fechaTexto: result.fecha || '',
      deviceId: this.deviceId
    };

    const profile = this.getUserProfile();

    try {
      let history = this.getExamHistory();
      history.unshift(historyEntry);
      if (history.length > 100) history = history.slice(0, 100);
      localStorage.setItem('caces_exam_history', JSON.stringify(history));
    } catch (e) {
      console.warn("Advertencia al guardar historial local:", e);
    }

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('caces_simulacros').insert({
          user_email: profile ? profile.email : null,
          device_id: this.deviceId,
          modo: result.modo || 'Simulacro CACES',
          puntuacion_obtenida: result.puntuacion,
          total_preguntas: result.total,
          porcentaje: result.porcentaje,
          tiempo_segundos: result.tiempo,
          desglose_especialidades: result.desglose || {}
        });
      } catch (e) {
        console.warn("No se pudo guardar historial en Supabase:", e);
      }
    }

    this.scheduleAutoCloudSync(1000);
    return historyEntry;
  }

  getExamHistory() {
    try {
      const data = localStorage.getItem('caces_exam_history');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Registra el resultado de una pregunta en el banco de errores (La Morgue),
   * guardando también la opción errónea seleccionada para mostrar su análisis completo.
   */
  registerAnswer(questionId, isCorrect, selectedOption = null) {
    let errors = this.getErrorBank();
    if (!isCorrect) {
      if (!errors[questionId]) {
        errors[questionId] = {
          fallos: 1,
          aciertos_seguidos: 0,
          ultimo_fallo: Date.now(),
          dominada: false,
          ultima_opcion_erronea: selectedOption || null
        };
      } else {
        errors[questionId].fallos = (errors[questionId].fallos || 0) + 1;
        errors[questionId].aciertos_seguidos = 0;
        errors[questionId].ultimo_fallo = Date.now();
        errors[questionId].dominada = false;
        if (selectedOption) {
          errors[questionId].ultima_opcion_erronea = selectedOption;
        }
      }
    } else {
      if (errors[questionId]) {
        errors[questionId].aciertos_seguidos = (errors[questionId].aciertos_seguidos || 0) + 1;
        if (errors[questionId].aciertos_seguidos >= 2) {
          errors[questionId].dominada = true;
        }
      }
    }
    localStorage.setItem('caces_error_bank', JSON.stringify(errors));
  }

  markErrorMastered(questionId) {
    let errors = this.getErrorBank();
    if (errors[questionId]) {
      errors[questionId].dominada = true;
      errors[questionId].aciertos_seguidos = 2;
      localStorage.setItem('caces_error_bank', JSON.stringify(errors));
    }
  }

  removeError(questionId) {
    let errors = this.getErrorBank();
    if (errors[questionId]) {
      delete errors[questionId];
      localStorage.setItem('caces_error_bank', JSON.stringify(errors));
    }
  }

  clearErrors() {
    localStorage.removeItem('caces_error_bank');
  }

  async clearDatabase() {
    localStorage.removeItem('caces_custom_questions');
    localStorage.removeItem('caces_questions');
    localStorage.removeItem('custom_questions');
    localStorage.removeItem('imported_questions');
    localStorage.removeItem('banco_caces');
    localStorage.removeItem('questions');
    localStorage.setItem('caces_force_empty', 'true');

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('caces_questions').delete().neq('id', '___force_clear___');
      } catch (e) {
        console.warn("Error borrando preguntas de Supabase:", e);
      }
    }
  }

  async resetAll() {
    localStorage.removeItem('caces_custom_questions');
    localStorage.removeItem('caces_questions');
    localStorage.removeItem('custom_questions');
    localStorage.removeItem('imported_questions');
    localStorage.removeItem('banco_caces');
    localStorage.removeItem('questions');
    localStorage.removeItem('caces_exam_history');
    localStorage.removeItem('caces_error_bank');
    localStorage.removeItem('caces_bookmarks');
    this.clearActiveSession();
    localStorage.setItem('caces_force_empty', 'true');

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('caces_questions').delete().neq('id', '___force_clear___');
      } catch (e) {
        console.warn("Error borrando de Supabase:", e);
      }
    }
  }

  getErrorBank() {
    try {
      const data = localStorage.getItem('caces_error_bank');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  toggleBookmark(questionId) {
    let bookmarks = this.getBookmarks();
    if (bookmarks.includes(questionId)) {
      bookmarks = bookmarks.filter(id => id !== questionId);
    } else {
      bookmarks.push(questionId);
    }
    localStorage.setItem('caces_bookmarks', JSON.stringify(bookmarks));
    return bookmarks.includes(questionId);
  }

  isBookmarked(questionId) {
    return this.getBookmarks().includes(questionId);
  }

  getBookmarks() {
    try {
      const data = localStorage.getItem('caces_bookmarks');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }
}

export const Storage = new StorageManager();
import { Storage } from './storage.js';
import { SupabaseConfig } from './supabase-config.js';
import { ExamEngine } from './exam-engine.js';
import { PDFQuestionImporter } from './pdf-importer.js';
import { Analytics } from './analytics.js';
import { Flashcards } from './flashcards.js';
import { ClinicalCalculators } from './calculators.js';
import { aiTutor } from './ai-tutor.js';
import { ArcadeManager } from './games.js';

/**
 * Biblioteca de Vectores Minimalistas SVG (Cero Emojis)
 */
const ICONS = {
  check: `<svg class="w-4 h-4 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  cross: `<svg class="w-4 h-4 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  sparkle: `<svg class="w-4 h-4 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  bookmarkOutline: `<svg class="w-4 h-4 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
  bookmarkFilled: `<svg class="w-4 h-4 inline-block shrink-0" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
  soundOn: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  soundOff: `<svg class="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  diamond: `<svg class="w-3.5 h-3.5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  doc: `<svg class="w-3.5 h-3.5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  target: `<svg class="w-3.5 h-3.5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  bot: `<svg class="w-3.5 h-3.5 inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>`
};

/**
 * Motor Universal de Renderizado Clínico Anti-Asteriscos
 */
export function formatClinicalMarkdown(rawText, { inline = false } = {}) {
  if (rawText === null || rawText === undefined) return '';
  let text = String(rawText).trim();
  if (!text) return '';

  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  text = text.replace(/^```(?:markdown|md|json)?\s*/i, '').replace(/```\s*$/i, '');

  text = text
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([\s\S]+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^\*])\*([^\*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code class="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 font-mono text-sm text-emerald-700 dark:text-emerald-300">$1</code>');

  text = text.replace(/\*\*/g, '');

  if (inline) {
    return text.replace(/^#{1,6}\s*/g, '').replace(/\n+/g, ' ').trim();
  }

  const lines = text.split(/\r?\n/);
  const htmlOut = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (!line) {
      if (inList) {
        htmlOut.push('</ul>');
        inList = false;
      }
      continue;
    }

    const headerMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headerMatch) {
      if (inList) {
        htmlOut.push('</ul>');
        inList = false;
      }
      const level = headerMatch[1].length;
      const content = headerMatch[2].replace(/^\*+|\*+$/g, '').trim();
      if (level <= 3) {
        htmlOut.push(`<h4 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-emerald-400 mt-4 mb-1.5 tracking-tight">${content}</h4>`);
      } else {
        htmlOut.push(`<h5 class="font-mono font-bold text-sm uppercase tracking-wider text-sky-600 dark:text-sky-400 mt-3 mb-1">${content}</h5>`);
      }
      continue;
    }

    if (line.startsWith('&gt;')) {
      if (inList) {
        htmlOut.push('</ul>');
        inList = false;
      }
      const quoteContent = line.replace(/^&gt;\s*/, '').replace(/^\*+|\*+$/g, '').trim();
      htmlOut.push(`<div class="p-4 my-2.5 rounded-xl bg-amber-500/10 border-l-4 border-amber-500 text-sm sm:text-base font-medium text-slate-800 dark:text-slate-200">${quoteContent}</div>`);
      continue;
    }

    const listMatch = line.match(/^(?:[\-\*•]|\d+[\.\)])\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        htmlOut.push('<ul class="space-y-1.5 my-2">');
        inList = true;
      }
      const itemContent = listMatch[1].replace(/^\*+|\*+$/g, '').trim();
      htmlOut.push(`<li class="text-sm sm:text-base leading-relaxed">${itemContent}</li>`);
      continue;
    }

    if (inList) {
      htmlOut.push('</ul>');
      inList = false;
    }
    line = line.replace(/^\*+|\*+$/g, '').trim();
    htmlOut.push(`<p class="mb-2.5 last:mb-0 leading-relaxed">${line}</p>`);
  }

  if (inList) {
    htmlOut.push('</ul>');
  }

  return htmlOut.join('');
}

class AppController {
  constructor() {
    this.engine = new ExamEngine();
    this.pdfImporter = new PDFQuestionImporter();
    this.arcade = new ArcadeManager((txt) => formatClinicalMarkdown(txt, { inline: true }));
    this.currentTab = 'simulacro';
    this.activeDialMode = 'simulacro'; // 'simulacro' | 'estudio'
    this.lastEstudioTab = 'simulacro';
    this.extractedQuestionsPreview = [];
    this.pcSidebarCollapsed = false;

    // Enlazar autoguardado seguro en la nube cada vez que cambie el XP o la racha
    const origAddXP = this.arcade.addXP.bind(this.arcade);
    this.arcade.addXP = (amount, isCorrectStreak = true, triggerToast = true) => {
      const isSimulacro = this.engine && this.engine.mode === 'caces';
      origAddXP(amount, isCorrectStreak, isSimulacro ? false : triggerToast);
      if (typeof Storage.scheduleAutoCloudSync === 'function') {
        Storage.scheduleAutoCloudSync();
      }
    };
  }

  async init() {
    this.bindLeftDrawer();
    this.bindRightExamDrawerAndCollapsibles();
    this.bindModeDial();
    this.bindNavigation();
    this.bindThemeAndSFXToggle();
    this.bindRanksModal();
    this.bindAuthModal();
    this.bindSecretAdminAccess();
    this.bindExamControls();
    this.bindKeyboardShortcuts();
    this.bindPDFImporter();
    this.bindCloudSettings();
    this.bindStudyControls();
    this.bindErrorControls();
    this.bindAITutor();
    this.bindSyllabusModal();
    this.bindExploradorControls();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn("SW error:", err);
        });
      });
    }

    const activeProfile = Storage.getUserProfile();
    if (activeProfile?.email) {
      Storage.pullUserProgressFromCloud(activeProfile.email).then((pulled) => {
        if (pulled) {
          this.arcade.xp = parseInt(localStorage.getItem('caces_xp') || '120', 10);
          this.arcade.highScoreBlitz = parseInt(localStorage.getItem('caces_blitz_high') || '0', 10);
          this.arcade.updateHUD();
        }
      });
    }

    this.arcade.updateHUD();
    this.refreshAuthUI();

    this.engine.onTick = (timeData) => this.renderTimer(timeData);
    this.engine.onStateChange = (state) => this.renderExamState(state);
    this.engine.onFinish = (summary) => this.renderExamSummary(summary);

    try {
      const questions = await this.engine.loadQuestions();
      this.updateQuestionCountBadge(questions.length);
    } catch (e) {
      console.error("Error al cargar banco de preguntas:", e);
    }

    // Restaurar automáticamente simulador o tutor en curso si el usuario recargó o cerró el navegador
    const restoreResult = this.engine.restoreActiveSession();
    if (restoreResult) {
      const restoredDial = this.engine.mode === 'caces' ? 'simulacro' : 'estudio';
      this.syncDialVisualsOnly(restoredDial);
      this.applyEngineStatusToScreens(restoreResult);
    }

    const handleClearToZero = async () => {
      if (confirm("¿Estás seguro de que deseas vaciar todas las preguntas guardadas y dejar el banco en 0?")) {
        await Storage.clearDatabase();
        this.engine.allQuestions = [];
        this.engine.sessionQuestions = [];
        const qList = await this.engine.loadQuestions();
        this.updateQuestionCountBadge(qList.length);
        const statusEl = document.getElementById('pdf-status-text');
        if (statusEl) statusEl.textContent = 'Banco de preguntas vaciado a 0 items.';
        alert("Banco de preguntas restablecido a 0.");
      }
    };
    document.getElementById('btn-quick-clear-db')?.addEventListener('click', handleClearToZero);
    document.getElementById('btn-import-clear-db')?.addEventListener('click', handleClearToZero);

    const urlInput = document.getElementById('supabase-url');
    const keyInput = document.getElementById('supabase-key');
    if (urlInput) urlInput.value = SupabaseConfig.getUrl();
    if (keyInput) keyInput.value = SupabaseConfig.getAnonKey();

    this.checkCloudStatus();

    if (Storage.supabaseClient?.auth) {
      Storage.supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user) {
          const u = session.user;
          const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Médico EHEP';
          const email = u.email;
          const avatar = u.user_metadata?.avatar_url || u.user_metadata?.picture;
          Storage.loginOrRegisterUser({ name, email, avatar, provider: 'google' }).then(() => {
            this.refreshAuthUI();
            this.arcade.updateHUD();
          });
        }
      }).catch(err => console.warn('Supabase session check:', err));

      Storage.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
          const u = session.user;
          const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Médico EHEP';
          const email = u.email;
          const avatar = u.user_metadata?.avatar_url || u.user_metadata?.picture;
          Storage.loginOrRegisterUser({ name, email, avatar, provider: 'google' }).then(() => {
            this.refreshAuthUI();
            this.arcade.updateHUD();
          });
        }
      });
    }

    if (window.location.hash && window.location.hash.includes('access_token')) {
      window.history.replaceState(null, null, window.location.pathname);
    }
  }

  // =========================================================================
  // MENÚ HAMBURGUESA IZQUIERDO Y PANEL DERECHO DEL EXAMEN (PC Y CELULAR)
  // =========================================================================
  bindLeftDrawer() {
    const drawer = document.getElementById('left-drawer');
    const backdrop = document.getElementById('left-drawer-backdrop');
    const btnOpen = document.getElementById('btn-open-drawer');
    const btnClose = document.getElementById('btn-close-drawer');

    const openDrawer = () => {
      if (!drawer || !backdrop) return;
      backdrop.classList.remove('hidden');
      requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        drawer.classList.remove('-translate-x-full');
      });
    };

    const closeDrawer = () => {
      if (!drawer || !backdrop) return;
      backdrop.classList.add('opacity-0');
      drawer.classList.add('-translate-x-full');
      setTimeout(() => backdrop.classList.add('hidden'), 250);
    };

    this.closeLeftDrawer = closeDrawer;

    btnOpen?.addEventListener('click', openDrawer);
    btnClose?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);

    document.getElementById('btn-drawer-go-home')?.addEventListener('click', () => {
      closeDrawer();
      this.switchTab('simulacro');
    });

    document.getElementById('btn-drawer-open-syllabus')?.addEventListener('click', () => {
      closeDrawer();
      document.getElementById('caces-syllabus-modal')?.classList.remove('hidden');
    });
  }

  bindRightExamDrawerAndCollapsibles() {
    const rightSidebar = document.getElementById('exam-sidebar-col');
    const rightBackdrop = document.getElementById('right-exam-drawer-backdrop');
    const btnOpenMobile = document.getElementById('btn-open-right-exam-drawer');
    const btnCloseMobile = document.getElementById('btn-close-right-exam-drawer');

    const openRightDrawer = () => {
      if (!rightSidebar || !rightBackdrop) return;
      rightBackdrop.classList.remove('hidden');
      rightSidebar.classList.remove('translate-x-full');
    };

    const closeRightDrawer = () => {
      if (!rightSidebar || !rightBackdrop) return;
      rightSidebar.classList.add('translate-x-full');
      rightBackdrop.classList.add('hidden');
    };

    this.closeRightExamDrawer = closeRightDrawer;

    btnOpenMobile?.addEventListener('click', openRightDrawer);
    btnCloseMobile?.addEventListener('click', closeRightDrawer);
    rightBackdrop?.addEventListener('click', closeRightDrawer);

    // PC: Botón para colapsar/expandir todo el panel lateral derecho
    const btnTogglePcSidebar = document.getElementById('btn-toggle-pc-sidebar');
    const pcToggleLabel = document.getElementById('pc-sidebar-toggle-label');
    const mainCol = document.getElementById('exam-main-col');

    btnTogglePcSidebar?.addEventListener('click', () => {
      this.pcSidebarCollapsed = !this.pcSidebarCollapsed;
      if (this.pcSidebarCollapsed) {
        rightSidebar?.classList.add('lg:hidden');
        mainCol?.classList.remove('lg:col-span-9');
        mainCol?.classList.add('lg:col-span-12');
        if (pcToggleLabel) pcToggleLabel.textContent = 'Mostrar Mapa y Reloj';
      } else {
        rightSidebar?.classList.remove('lg:hidden');
        mainCol?.classList.remove('lg:col-span-12');
        mainCol?.classList.add('lg:col-span-9');
        if (pcToggleLabel) pcToggleLabel.textContent = 'Ocultar Mapa';
      }
    });

    // Colapsar sección de Clasificación (Modo Tutor)
    const btnCollapseClass = document.getElementById('btn-collapse-classification');
    const bodyClass = document.getElementById('unified-classification-body');
    const iconClass = document.getElementById('classification-collapse-icon');
    btnCollapseClass?.addEventListener('click', () => {
      if (!bodyClass) return;
      const isHidden = bodyClass.classList.toggle('hidden');
      if (iconClass) iconClass.textContent = isHidden ? '+' : '−';
    });

    // Colapsar sección de Mapa de Reactivos
    const btnCollapseMap = document.getElementById('btn-collapse-map-section');
    const bodyMap = document.getElementById('unified-map-body');
    const iconMap = document.getElementById('map-collapse-icon');
    btnCollapseMap?.addEventListener('click', () => {
      if (!bodyMap) return;
      const isHidden = bodyMap.classList.toggle('hidden');
      if (iconMap) iconMap.textContent = isHidden ? '[+]' : '[−]';
    });
  }

  // =========================================================================
  // CONTROL DE VISIBILIDAD DE LA BARRA DE ESTUDIO Y DEL DIAL
  // =========================================================================
  updateStudyNavbarVisibility() {
    const studyNavbar = document.getElementById('study-mode-navbar');
    if (!studyNavbar) return;

    const activeScreen = document.getElementById('exam-active-screen');
    const isDoingQuestionsInTutor =
      this.currentTab === 'simulacro' &&
      activeScreen &&
      !activeScreen.classList.contains('hidden');

    // En Modo Simulador o mientras se está respondiendo en Modo Tutor, ocultar la barra de Arcade/Cards para no saturar
    if (this.activeDialMode !== 'estudio' || isDoingQuestionsInTutor) {
      studyNavbar.classList.add('hidden');
    } else {
      studyNavbar.classList.remove('hidden');
    }
  }

  syncDialVisualsOnly(mode) {
    this.activeDialMode = mode === 'estudio' ? 'estudio' : 'simulacro';

    ['header-mode-dial', 'mobile-mode-dial'].forEach(id => {
      const wrapper = document.getElementById(id);
      if (!wrapper) return;
      wrapper.setAttribute('data-active-mode', this.activeDialMode);
      wrapper.querySelectorAll('[data-dial-mode]').forEach(b => {
        const bMode = b.getAttribute('data-dial-mode');
        if (bMode === this.activeDialMode) {
          b.classList.remove('text-slate-600', 'dark:text-slate-300');
          b.classList.add('text-slate-950');
        } else {
          b.classList.remove('text-slate-950');
          b.classList.add('text-slate-600', 'dark:text-slate-300');
        }
      });
    });

    const simPanel = document.getElementById('setup-panel-simulacro');
    const estPanel = document.getElementById('setup-panel-estudio');
    const sideSimInfo = document.getElementById('setup-side-simulacro-info');
    const sideArcadePromo = document.getElementById('setup-arcade-promo-card');

    if (this.activeDialMode === 'estudio') {
      simPanel?.classList.add('hidden');
      estPanel?.classList.remove('hidden');
      sideSimInfo?.classList.add('hidden');
      sideArcadePromo?.classList.remove('hidden');
    } else {
      estPanel?.classList.add('hidden');
      simPanel?.classList.remove('hidden');
      sideArcadePromo?.classList.add('hidden');
      sideSimInfo?.classList.remove('hidden');
    }

    this.updateStudyNavbarVisibility();
  }

  bindModeDial() {
    const dialBtns = document.querySelectorAll('[data-dial-mode]');
    dialBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-dial-mode');
        this.setDialMode(mode);
      });
    });
  }

  applyEngineStatusToScreens(status) {
    const setupScreen = document.getElementById('exam-setup-screen');
    const activeScreen = document.getElementById('exam-active-screen');
    const resultsScreen = document.getElementById('exam-results-screen');

    if (status === 'finished' && this.engine.lastSummary) {
      setupScreen?.classList.add('hidden');
      activeScreen?.classList.add('hidden');
      this.renderExamSummary(this.engine.lastSummary);
    } else if (status === 'reviewing' || status === true) {
      setupScreen?.classList.add('hidden');
      resultsScreen?.classList.add('hidden');
      activeScreen?.classList.remove('hidden');
    } else {
      activeScreen?.classList.add('hidden');
      resultsScreen?.classList.add('hidden');
      setupScreen?.classList.remove('hidden');
    }
    this.updateStudyNavbarVisibility();
  }

  setDialMode(mode) {
    const targetMode = mode === 'estudio' ? 'estudio' : 'simulacro';
    this.arcade.playTone('beep');

    if (targetMode === this.activeDialMode) {
      this.switchTab('simulacro');
      this.updateStudyNavbarVisibility();
      return;
    }

    // Si estamos saliendo de Modo Estudio, recordar en qué pestaña estaba trabajando el usuario
    if (this.activeDialMode === 'estudio') {
      const studyTabs = ['simulacro', 'temario', 'explorador', 'flashcards', 'errores', 'arcade'];
      if (studyTabs.includes(this.currentTab)) {
        this.lastEstudioTab = this.currentTab;
      }
    }

    // Cambiar de contexto preservando intacto el progreso tanto de Modo Estudio como de Modo Simulador
    const restoredStatus = this.engine.switchModeContext(targetMode);
    this.syncDialVisualsOnly(targetMode);
    this.applyEngineStatusToScreens(restoredStatus);

    if (targetMode === 'estudio') {
      const tabToRestore = this.lastEstudioTab || 'simulacro';
      this.switchTab(tabToRestore, { preserveModuleState: true });
    } else {
      this.switchTab('simulacro', { preserveModuleState: true });
    }
    this.updateStudyNavbarVisibility();
  }

  // =========================================================================
  // MODAL DE EXPLICACIÓN DE LOS 5 RANGOS CLÍNICOS
  // =========================================================================
  bindRanksModal() {
    const modal = document.getElementById('ranks-info-modal');
    const openRanks = () => {
      this.renderRanksModalContent();
      if (this.closeLeftDrawer) this.closeLeftDrawer();
      modal?.classList.remove('hidden');
    };
    const closeRanks = () => modal?.classList.add('hidden');

    document.getElementById('user-xp-hud')?.addEventListener('click', openRanks);
    document.getElementById('arcade-rank-card-trigger')?.addEventListener('click', openRanks);
    document.getElementById('btn-drawer-open-ranks')?.addEventListener('click', openRanks);
    document.getElementById('btn-close-ranks-modal')?.addEventListener('click', closeRanks);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeRanks();
    });
  }

  renderRanksModalContent() {
    const currentXp = this.arcade.xp;
    const rankInfo = this.arcade.getRankInfo(currentXp);

    const curTitleEl = document.getElementById('modal-rank-current-title');
    const curXpEl = document.getElementById('modal-rank-current-xp');
    const nextXpEl = document.getElementById('modal-rank-next-xp');
    const barEl = document.getElementById('modal-rank-progress-bar');

    if (curTitleEl) curTitleEl.textContent = rankInfo.title;
    if (curXpEl) curXpEl.textContent = `${currentXp} XP`;
    if (nextXpEl) nextXpEl.textContent = `Siguiente ascenso: ${rankInfo.next} XP`;
    if (barEl) barEl.style.width = `${rankInfo.progress}%`;

    const allRanks = [
      {
        level: 1,
        title: 'Externo de Guardia',
        range: '0 — 249 XP',
        min: 0,
        desc: 'Inicio de rotación hospitalaria. Aprendizaje de semiología, triaje y signos vitales básicos.'
      },
      {
        level: 2,
        title: 'Interno Rotativo',
        range: '250 — 599 XP',
        min: 250,
        desc: 'Primera línea en emergencia y centro de salud. Dominio de Score MAMÁ, AIEPI y esquemas PAI.'
      },
      {
        level: 3,
        title: 'Residente R1 de Choque',
        range: '600 — 1,199 XP',
        min: 600,
        desc: 'Manejo resolutivo de Claves Obstétricas (Roja, Azul, Amarilla), abdomen agudo y reanimación.'
      },
      {
        level: 4,
        title: 'Jefe de Guardia MSP',
        range: '1,200 — 2,199 XP',
        min: 1200,
        desc: 'Criterio clínico quirúrgico. Descarte inmediato de distractores CACES y dominio de GPC nacionales.'
      },
      {
        level: 5,
        title: 'Leyenda del Hpta CACES',
        range: '2,200+ XP',
        min: 2200,
        desc: 'Nivel Catedrático / Especialista Senior. Precisión superior al 85% y habilitación profesional asegurada.'
      }
    ];

    const listEl = document.getElementById('ranks-hierarchy-list');
    if (!listEl) return;

    listEl.innerHTML = allRanks.map(r => {
      const isUnlocked = currentXp >= r.min;
      const isCurrent = rankInfo.title === r.title;
      return `
        <div class="p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
          isCurrent
            ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
            : isUnlocked
              ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
              : 'border-slate-200/60 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 opacity-60'
        }">
          <div class="w-9 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center shrink-0 ${
            isCurrent
              ? 'bg-emerald-500 text-slate-950'
              : isUnlocked
                ? 'bg-slate-800 text-emerald-400'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
          }">
            R${r.level}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                ${r.title}
                ${isCurrent ? '<span class="ml-2 px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold uppercase">Actual</span>' : ''}
              </span>
              <span class="font-mono text-xs font-bold ${isUnlocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">${r.range}</span>
            </div>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">${r.desc}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // SISTEMA DE INICIO DE SESIÓN CON GOOGLE Y GUARDADO AUTOMÁTICO EN LA NUBE
  // =========================================================================
  bindAuthModal() {
    const modal = document.getElementById('auth-modal');
    const openAuth = () => {
      this.refreshAuthUI();
      if (this.closeLeftDrawer) this.closeLeftDrawer();
      modal?.classList.remove('hidden');
    };
    const closeAuth = () => modal?.classList.add('hidden');

    document.getElementById('btn-open-auth-modal')?.addEventListener('click', openAuth);
    document.getElementById('btn-drawer-open-auth')?.addEventListener('click', openAuth);
    document.getElementById('btn-close-auth-modal')?.addEventListener('click', closeAuth);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeAuth();
    });

    const msgEl = document.getElementById('auth-feedback-msg');
    const showMsg = (txt, isError = false) => {
      if (!msgEl) return;
      msgEl.classList.remove('hidden');
      msgEl.className = `p-3 rounded-xl text-xs font-mono font-bold ${
        isError ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'
      }`;
      msgEl.textContent = txt;
    };

    document.getElementById('btn-login-google')?.addEventListener('click', async () => {
      try {
        showMsg('Conectando con Google...', false);
        const profile = await Storage.loginWithGoogle();
        if (profile && !profile.inProgress) {
          this.arcade.xp = parseInt(localStorage.getItem('caces_xp') || '120', 10);
          this.arcade.highScoreBlitz = parseInt(localStorage.getItem('caces_blitz_high') || '0', 10);
          this.arcade.updateHUD();
          this.refreshAuthUI();
          msgEl?.classList.add('hidden');
          modal?.classList.add('hidden');
        }
      } catch (err) {
        showMsg(err.message || 'Error al autenticar con Google.', true);
      }
    });

    document.getElementById('btn-submit-auth')?.addEventListener('click', async () => {
      const name = document.getElementById('auth-name-input')?.value || '';
      const email = document.getElementById('auth-email-input')?.value || '';
      const pin = document.getElementById('auth-pin-input')?.value || '';

      try {
        showMsg('Activando sincronización en la nube...', false);
        await Storage.loginOrRegisterUser({ name, email, pin });
        this.arcade.xp = parseInt(localStorage.getItem('caces_xp') || '120', 10);
        this.arcade.highScoreBlitz = parseInt(localStorage.getItem('caces_blitz_high') || '0', 10);
        this.arcade.updateHUD();
        this.refreshAuthUI();
        msgEl?.classList.add('hidden');
        modal?.classList.add('hidden');
      } catch (err) {
        showMsg(err.message || 'Error al iniciar sesión.', true);
      }
    });

    document.getElementById('btn-force-sync')?.addEventListener('click', async () => {
      showMsg('Sincronizando datos con la nube...', false);
      const res = await Storage.syncUserProgressToCloud();
      if (res && res.synced) {
        showMsg('Sincronización con la nube completada.', false);
      } else {
        showMsg('Progreso respaldado correctamente.', false);
      }
      setTimeout(() => msgEl?.classList.add('hidden'), 2500);
    });

    document.getElementById('btn-logout-auth')?.addEventListener('click', () => {
      Storage.logoutUser();
      this.refreshAuthUI();
    });
  }

  refreshAuthUI() {
    const profile = Storage.getUserProfile();
    const headerLabel = document.getElementById('header-user-label');
    const headerAvatar = document.getElementById('header-user-avatar');
    const headerIcon = document.getElementById('header-user-default-icon');

    const drawerName = document.getElementById('drawer-user-name');
    const drawerStatus = document.getElementById('drawer-user-status');
    const drawerBtnLabel = document.getElementById('drawer-auth-btn-label');
    const drawerAvatar = document.getElementById('drawer-user-avatar');
    const drawerIcon = document.getElementById('drawer-user-default-icon');

    const loggedOutView = document.getElementById('auth-logged-out-view');
    const loggedInView = document.getElementById('auth-logged-in-view');
    const activeName = document.getElementById('auth-active-name');
    const activeEmail = document.getElementById('auth-active-email');
    const activeAvatarImg = document.getElementById('auth-active-avatar-img');
    const activeAvatarInit = document.getElementById('auth-active-avatar-initial');
    const providerBadge = document.getElementById('auth-provider-badge');

    if (profile) {
      if (headerLabel) headerLabel.textContent = profile.name;
      if (headerAvatar && profile.avatar) {
        headerAvatar.src = profile.avatar;
        headerAvatar.classList.remove('hidden');
        headerIcon?.classList.add('hidden');
      } else {
        headerAvatar?.classList.add('hidden');
        headerIcon?.classList.remove('hidden');
      }

      if (drawerName) drawerName.textContent = profile.name;
      if (drawerStatus) drawerStatus.textContent = `${profile.email} • Cuenta Conectada`;
      if (drawerBtnLabel) drawerBtnLabel.textContent = 'Ver Credencial Médica';
      if (drawerAvatar && profile.avatar) {
        drawerAvatar.src = profile.avatar;
        drawerAvatar.classList.remove('hidden');
        drawerIcon?.classList.add('hidden');
      } else {
        drawerAvatar?.classList.add('hidden');
        drawerIcon?.classList.remove('hidden');
      }

      loggedOutView?.classList.add('hidden');
      loggedInView?.classList.remove('hidden');
      if (activeName) activeName.textContent = profile.name;
      if (activeEmail) activeEmail.textContent = profile.email;
      if (activeAvatarImg && profile.avatar) {
        activeAvatarImg.src = profile.avatar;
        activeAvatarImg.classList.remove('hidden');
        activeAvatarInit?.classList.add('hidden');
      }
      if (providerBadge) {
        providerBadge.textContent = profile.provider === 'google' ? 'Google' : 'Credencial';
      }
    } else {
      if (headerLabel) headerLabel.textContent = 'Acceder';
      headerAvatar?.classList.add('hidden');
      headerIcon?.classList.remove('hidden');
      if (drawerName) drawerName.textContent = 'Médico en Guardia';
      if (drawerStatus) drawerStatus.textContent = 'Autoguardado local activo';
      if (drawerBtnLabel) drawerBtnLabel.textContent = 'Iniciar Sesión con Google';
      drawerAvatar?.classList.add('hidden');
      drawerIcon?.classList.remove('hidden');
      loggedOutView?.classList.remove('hidden');
      loggedInView?.classList.add('hidden');
    }
  }

  // =========================================================================
  // DESBLOQUEO SECRETO DE ADMINISTRADOR
  // =========================================================================
  bindSecretAdminAccess() {
    const adminBox = document.getElementById('admin-only-controls');
    if (sessionStorage.getItem('caces_admin_unlocked') === 'true') {
      adminBox?.classList.remove('hidden');
    }

    const promptAdminUnlock = () => {
      const pass = prompt('Modo Creador CACES — Ingresa tu clave de administrador:');
      if (pass === 'admincaces' || pass === 'jhojann2026' || pass === 'loststudios') {
        sessionStorage.setItem('caces_admin_unlocked', 'true');
        adminBox?.classList.remove('hidden');
        document.getElementById('btn-open-drawer')?.click();
      }
    };

    let clickCount = 0;
    let clickTimer = null;
    document.getElementById('brand-logo-trigger')?.addEventListener('click', () => {
      clickCount++;
      clearTimeout(clickTimer);
      if (clickCount >= 5) {
        clickCount = 0;
        promptAdminUnlock();
      } else {
        clickTimer = setTimeout(() => {
          if (clickCount === 1 && this.currentTab !== 'simulacro') {
            this.switchTab('simulacro');
          }
          clickCount = 0;
        }, 380);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'A') {
        e.preventDefault();
        promptAdminUnlock();
      }
    });
  }

  bindThemeAndSFXToggle() {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('caces_theme', isDark ? 'dark' : 'light');
        if (this.currentTab === 'analitica') {
          Analytics.renderStats();
        }
      });
    }

    const sfxBtn = document.getElementById('btn-sfx-toggle');
    if (sfxBtn) {
      sfxBtn.innerHTML = this.arcade.sfxEnabled ? ICONS.soundOn : ICONS.soundOff;
      sfxBtn.addEventListener('click', () => {
        const enabled = this.arcade.toggleSFX();
        sfxBtn.innerHTML = enabled ? ICONS.soundOn : ICONS.soundOff;
        if (enabled) this.arcade.playTone('beep');
      });
    }
  }

  updateQuestionCountBadge(count) {
    const badge = document.getElementById('total-questions-badge');
    if (badge) badge.textContent = `${count} ITEMS`;
  }

  bindSyllabusModal() {
    const modal = document.getElementById('caces-syllabus-modal');
    const btnNav = document.getElementById('btn-open-syllabus-modal');
    const btnHero = document.getElementById('btn-hero-open-syllabus');
    const btnClose = document.getElementById('btn-close-syllabus-modal');
    const btnStart = document.getElementById('btn-syllabus-start-caces');
    const searchInput = document.getElementById('syllabus-search-input');

    const openModal = () => modal?.classList.remove('hidden');
    const closeModal = () => modal?.classList.add('hidden');

    if (btnNav) btnNav.addEventListener('click', openModal);
    if (btnHero) btnHero.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (btnStart) {
      btnStart.addEventListener('click', () => {
        closeModal();
        this.setDialMode('simulacro');
        const select = document.getElementById('caces-q-count');
        if (select) select.value = '100';
        const specSelect = document.getElementById('caces-specialty-select');
        if (specSelect) specSelect.value = 'Todas';
        const duration = document.getElementById('caces-duration-label');
        if (duration) duration.textContent = '3 Horas';
        document.getElementById('btn-start-caces')?.click();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = document.querySelectorAll('.syllabus-comp-item');
        items.forEach(item => {
          const text = item.textContent.toLowerCase();
          if (!query || text.includes(query)) {
            item.classList.remove('hidden');
            if (query.length > 2) item.setAttribute('open', '');
          } else {
            item.classList.add('hidden');
          }
        });
      });
    }
  }

  bindNavigation() {
    const tabs = document.querySelectorAll('[data-tab-target]');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-tab-target');
        if (this.closeLeftDrawer) this.closeLeftDrawer();
        if (target === 'estudio') {
          this.setDialMode('estudio');
          return;
        }
        this.switchTab(target);
      });
    });
  }

  switchTab(tabId, { preserveModuleState = false } = {}) {
    this.currentTab = tabId;
    if (this.activeDialMode === 'estudio' && ['simulacro', 'temario', 'explorador', 'flashcards', 'errores', 'arcade'].includes(tabId)) {
      this.lastEstudioTab = tabId;
    }

    if (this.arcade.blitzInterval && tabId !== 'arcade') {
      clearInterval(this.arcade.blitzInterval);
    }

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[data-tab-target]').forEach(el => {
      el.classList.remove('nav-tab-active');
    });

    const activeContent = document.getElementById(`tab-${tabId}`);
    if (activeContent) activeContent.classList.remove('hidden');

    const activeBtn = document.querySelector(`nav [data-tab-target="${tabId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('nav-tab-active');
    }

    this.updateStudyNavbarVisibility();

    if (tabId === 'arcade') {
      if (!preserveModuleState || !document.getElementById('arcade-stage')?.innerHTML.trim()) {
        this.arcade.initArcade(this.engine.allQuestions);
      }
    } else if (tabId === 'temario') {
      if (!preserveModuleState || !document.getElementById('temario-cards-container')?.children.length) {
        this.renderTemarioHub();
      }
    } else if (tabId === 'analitica') {
      Analytics.renderStats();
    } else if (tabId === 'errores') {
      this.renderErrorsList();
    } else if (tabId === 'flashcards') {
      if (!preserveModuleState || !Flashcards.deck || Flashcards.deck.length === 0) {
        this.initFlashcards();
      } else {
        this.renderFlashcard();
      }
    } else if (tabId === 'calculadoras') {
      this.initCalculators();
    } else if (tabId === 'explorador') {
      if (!preserveModuleState || !document.getElementById('exp-questions-container')?.children.length) {
        this.renderExplorador();
      }
    }
  }

  bindExamControls() {
    const qCountSelect = document.getElementById('caces-q-count');
    const durationLabel = document.getElementById('caces-duration-label');
    if (qCountSelect && durationLabel) {
      qCountSelect.addEventListener('change', () => {
        const val = parseInt(qCountSelect.value, 10);
        if (val === 100) durationLabel.textContent = "3 Horas";
        else if (val === 50) durationLabel.textContent = "1h 30m";
        else if (val === 25) durationLabel.textContent = "45 Min";
        else if (val === 10) durationLabel.textContent = "18 Min";
      });
    }

    document.getElementById('btn-start-caces')?.addEventListener('click', () => {
      const count = parseInt(document.getElementById('caces-q-count')?.value || '100', 10);
      const specialty = document.getElementById('caces-specialty-select')?.value || 'Todas';
      this.startSessionWrapper({ mode: 'caces', count, specialty });
    });

    const handleFinishAttempt = async () => {
      if (this.closeRightExamDrawer) this.closeRightExamDrawer();
      if (this.engine.isReviewing) {
        this.engine.exitReview();
        document.getElementById('exam-active-screen')?.classList.add('hidden');
        document.getElementById('exam-results-screen')?.classList.remove('hidden');
        this.updateStudyNavbarVisibility();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      await this.engine.finishExam();
    };

    this.handleFinishAttempt = handleFinishAttempt;

    document.getElementById('btn-prev-q')?.addEventListener('click', () => this.engine.prevQuestion());
    document.getElementById('btn-next-q')?.addEventListener('click', async () => {
      const isLastQuestion = this.engine.currentIndex >= this.engine.sessionQuestions.length - 1;
      if (isLastQuestion) {
        await handleFinishAttempt();
      } else {
        this.engine.nextQuestion();
      }
    });
    document.getElementById('btn-mark-q')?.addEventListener('click', () => this.engine.toggleCurrentMark());
    document.getElementById('btn-jump-unanswered')?.addEventListener('click', () => {
      this.engine.goToFirstUnanswered();
      if (this.closeRightExamDrawer) this.closeRightExamDrawer();
    });

    document.getElementById('btn-finish-exam')?.addEventListener('click', handleFinishAttempt);
    document.getElementById('btn-sidebar-finish-exam')?.addEventListener('click', handleFinishAttempt);

    document.getElementById('btn-restart-exam')?.addEventListener('click', () => {
      this.engine.abandonSession();
      document.getElementById('exam-results-screen')?.classList.add('hidden');
      document.getElementById('exam-active-screen')?.classList.add('hidden');
      document.getElementById('exam-setup-screen')?.classList.remove('hidden');
      this.updateStudyNavbarVisibility();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('btn-review-exam')?.addEventListener('click', () => {
      document.getElementById('exam-results-screen')?.classList.add('hidden');
      document.getElementById('exam-active-screen')?.classList.remove('hidden');
      this.engine.startReview('all');
      this.updateStudyNavbarVisibility();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('btn-review-exit')?.addEventListener('click', () => {
      this.engine.exitReview();
      document.getElementById('exam-active-screen')?.classList.add('hidden');
      document.getElementById('exam-results-screen')?.classList.remove('hidden');
      this.updateStudyNavbarVisibility();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('btn-review-filter-all')?.addEventListener('click', () => {
      this.engine.reviewFilter = 'all';
      this.engine.goToQuestion(0);
    });

    document.getElementById('btn-review-filter-wrong')?.addEventListener('click', () => {
      this.engine.reviewFilter = 'wrong';
      const firstWrong = this.engine.sessionQuestions.findIndex(q => this.engine.userAnswers[q.id] !== q.correcta);
      if (firstWrong !== -1) this.engine.goToQuestion(firstWrong);
    });

    document.getElementById('btn-results-go-morgue')?.addEventListener('click', () => {
      this.engine.abandonSession();
      document.getElementById('exam-results-screen')?.classList.add('hidden');
      document.getElementById('exam-setup-screen')?.classList.remove('hidden');
      this.syncDialVisualsOnly('estudio');
      this.switchTab('errores');
    });

    // Filtros de la revisión detallada en la pantalla de resultados
    document.getElementById('btn-res-filter-all')?.addEventListener('click', () => {
      this.setResultsReviewFilterUI('all');
      if (this.engine.lastSummary) this.renderDetailedReviewList(this.engine.lastSummary, 'all');
    });
    document.getElementById('btn-res-filter-wrong')?.addEventListener('click', () => {
      this.setResultsReviewFilterUI('wrong');
      if (this.engine.lastSummary) this.renderDetailedReviewList(this.engine.lastSummary, 'wrong');
    });
    document.getElementById('btn-res-filter-correct')?.addEventListener('click', () => {
      this.setResultsReviewFilterUI('correct');
      if (this.engine.lastSummary) this.renderDetailedReviewList(this.engine.lastSummary, 'correct');
    });

    // Botones Descargar PDF de la Revisión del Examen
    const triggerDownloadReviewPdf = () => {
      if (this.engine.lastSummary) {
        this.downloadExamReviewPDF(this.engine.lastSummary);
      }
    };
    document.getElementById('btn-download-review-pdf')?.addEventListener('click', triggerDownloadReviewPdf);
    document.getElementById('btn-download-review-pdf-secondary')?.addEventListener('click', triggerDownloadReviewPdf);
    document.getElementById('btn-review-banner-pdf')?.addEventListener('click', triggerDownloadReviewPdf);
  }

  setResultsReviewFilterUI(activeFilter) {
    const map = {
      all: document.getElementById('btn-res-filter-all'),
      wrong: document.getElementById('btn-res-filter-wrong'),
      correct: document.getElementById('btn-res-filter-correct')
    };
    Object.entries(map).forEach(([key, btn]) => {
      if (!btn) return;
      if (key === activeFilter) {
        btn.className = 'px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold bg-emerald-500 text-slate-950';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-xl font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      }
    });
  }

  bindStudyControls() {
    document.getElementById('btn-start-study')?.addEventListener('click', () => {
      const specialty = document.getElementById('study-specialty-select')?.value || 'Todas';
      const count = parseInt(document.getElementById('study-q-count')?.value || '20', 10);
      this.startSessionWrapper({ mode: 'study', count, specialty });
    });
  }

  startSessionWrapper(options) {
    if (!this.engine.allQuestions || this.engine.allQuestions.length === 0) {
      alert("El banco de preguntas está vacío.");
      return;
    }
    try {
      this.engine.startSession(options);
      this.switchTab('simulacro');
      document.getElementById('exam-setup-screen')?.classList.add('hidden');
      document.getElementById('exam-results-screen')?.classList.add('hidden');
      document.getElementById('exam-active-screen')?.classList.remove('hidden');
      this.updateStudyNavbarVisibility();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert(err.message || "Error al iniciar sesión.");
    }
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (this.currentTab === 'flashcards') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          Flashcards.flipCard();
          this.renderFlashcard();
        } else if (e.key === '1') {
          Flashcards.rateCard('hard');
          this.renderFlashcard();
        } else if (e.key === '2') {
          Flashcards.rateCard('good');
          this.renderFlashcard();
        } else if (e.key === '3') {
          this.arcade.addXP(15, true);
          this.arcade.playTone('correct');
          Flashcards.rateCard('easy');
          this.renderFlashcard();
        } else if (e.key === 'ArrowRight') {
          Flashcards.nextCard();
          this.renderFlashcard();
        } else if (e.key === 'ArrowLeft') {
          Flashcards.prevCard();
          this.renderFlashcard();
        }
        return;
      }

      const activeScreen = document.getElementById('exam-active-screen');
      if (!activeScreen || activeScreen.classList.contains('hidden')) return;

      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key)) {
        this.handleOptionSelectionWithXP(key);
      } else if (e.key === 'ArrowRight') {
        this.engine.nextQuestion();
      } else if (e.key === 'ArrowLeft') {
        this.engine.prevQuestion();
      } else if (e.key === ' ' || key === 'M') {
        e.preventDefault();
        this.engine.toggleCurrentMark();
      }
    });
  }

  /**
   * Otorga XP y felicitación en Modo Tutor ÚNICAMENTE una vez por pregunta
   * y SOLO si el primer clic en esa pregunta fue la opción correcta.
   */
  handleOptionSelectionWithXP(optionId) {
    const q = this.engine.getCurrentQuestion();
    if (!q || this.engine.isReviewing) return;

    const result = this.engine.selectAnswer(optionId);

    if (this.engine.mode === 'caces') {
      if (result.changed) {
        this.arcade.playTone('beep');
      }
      return;
    }

    // Modo Tutor / La Morgue: Solo cuenta el PRIMER clic sobre la pregunta
    if (result.isFirstClickOnQuestion) {
      if (result.isFirstClickCorrect) {
        this.arcade.playTone('correct');
        const prevStreak = this.arcade.streak;
        this.arcade.addXP(10, true, true);
        if (prevStreak === 0) {
          this.arcade.triggerTutorCelebration();
        }
      } else {
        this.arcade.playTone('wrong');
        this.arcade.addXP(0, false, false);
      }
    }
  }

  renderTimer(timeData) {
    const timerEl = document.getElementById('exam-timer');
    const mobileTimerEl = document.getElementById('mobile-exam-timer');

    if (timerEl) {
      timerEl.textContent = timeData.formatted;
      if (timeData.isUrgent) {
        timerEl.classList.add('text-rose-500', 'animate-pulse');
      } else {
        timerEl.classList.remove('text-rose-500', 'animate-pulse');
      }
    }

    if (mobileTimerEl) {
      mobileTimerEl.textContent = timeData.formatted;
      if (timeData.isUrgent) {
        mobileTimerEl.classList.add('text-rose-500', 'animate-pulse');
      } else {
        mobileTimerEl.classList.remove('text-rose-500', 'animate-pulse');
      }
    }
  }

  renderExamState(state) {
    const q = state.question;
    if (!q) return;

    const modeBadge = document.getElementById('exam-mode-badge');
    if (modeBadge) {
      if (state.isReviewing) {
        modeBadge.textContent = 'Auditoría';
        modeBadge.className = 'px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-mono text-[11px] sm:text-xs font-bold uppercase shrink-0';
      } else if (state.mode === 'caces') {
        modeBadge.textContent = 'Simulador';
        modeBadge.className = 'px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono text-[11px] sm:text-xs font-bold uppercase shrink-0';
      } else if (state.mode === 'errors') {
        modeBadge.textContent = 'La Morgue';
        modeBadge.className = 'px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 font-mono text-[11px] sm:text-xs font-bold uppercase shrink-0';
      } else {
        modeBadge.textContent = 'Modo Tutor';
        modeBadge.className = 'px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-mono text-[11px] sm:text-xs font-bold uppercase shrink-0';
      }
    }

    // Ocultar botones de ayuda IA en Modo Simulador estricto
    const isStrictSimulator = state.mode === 'caces' && !state.isFinished && !state.isReviewing;
    document.getElementById('btn-open-ai-tutor-top')?.classList.toggle('hidden', isStrictSimulator);
    document.getElementById('btn-open-ai-tutor-inline')?.classList.toggle('hidden', isStrictSimulator);

    // Ocultar la clasificación de la pregunta en Modo Simulador; incluirla en Modo Tutor/Auditoría dentro del panel unificado
    const classificationBox = document.getElementById('unified-classification-section');
    if (classificationBox) {
      classificationBox.classList.toggle('hidden', isStrictSimulator);
    }

    const reviewBanner = document.getElementById('exam-review-banner');
    if (reviewBanner) {
      reviewBanner.classList.toggle('hidden', !state.isReviewing);
    }

    const progressText = document.getElementById('exam-progress-text');
    if (progressText) {
      progressText.textContent = `ÍTEM ${state.index + 1} / ${state.total}`;
    }

    const progressBar = document.getElementById('exam-progress-bar');
    if (progressBar) {
      const pct = Math.round(((state.index + 1) / state.total) * 100);
      progressBar.style.width = `${pct}%`;
    }

    const matrixCount = document.getElementById('matrix-answered-count');
    if (matrixCount) {
      matrixCount.textContent = `${state.answeredCount}/${state.total}`;
    }

    const badgeSpec = document.getElementById('q-specialty-badge');
    if (badgeSpec) badgeSpec.textContent = q.especialidad || 'Medicina Interna';
    const badgeSub = document.getElementById('q-subtema-badge');
    if (badgeSub) badgeSub.innerHTML = formatClinicalMarkdown(q.subtema || '', { inline: true });

    const bodyEl = document.getElementById('q-enunciado');
    if (bodyEl) bodyEl.innerHTML = formatClinicalMarkdown(q.enunciado);

    const askEl = document.getElementById('q-pregunta');
    if (askEl) askEl.innerHTML = formatClinicalMarkdown(q.pregunta || "¿Cuál es la conducta diagnóstica o terapéutica adecuada?", { inline: true });

    const optionsContainer = document.getElementById('q-options-container');
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      const selected = state.selectedAnswer;
      // En modo tutor/La Morgue, mostrar feedback desde el primer intento registrado,
      // aunque el usuario haya navegado y vuelto. En revisión, siempre mostrar.
      const hasFirstAttempt = !!(state.firstAttemptAnswer);
      const showFeedback = (state.mode === 'study' || state.mode === 'errors' || state.isFinished || state.isReviewing) && (selected || hasFirstAttempt || state.isReviewing);
      const opts = Array.isArray(q.opciones) ? q.opciones : [];

      opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full text-left p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 ';

        // En modo tutor con feedback, resaltar el primer intento (no el actual selectedAnswer)
        // para que el usuario vea siempre qué eligió realmente
        const effectiveSelected = showFeedback && (state.mode === 'study' || state.mode === 'errors') && state.firstAttemptAnswer
          ? state.firstAttemptAnswer
          : selected;
        const isOptionSelected = effectiveSelected === opt.id;
        const isCorrectOption = opt.id === q.correcta;

        if (showFeedback) {
          // Deshabilitar clics visualmente cuando ya hay feedback (modo tutor o revisión)
          btn.className += 'cursor-default ';
          if (isCorrectOption) {
            btn.className += 'border-emerald-500 bg-emerald-500/15 text-slate-900 dark:text-white font-bold ring-2 ring-emerald-500/30';
          } else if (isOptionSelected && !isCorrectOption) {
            btn.className += 'border-rose-500 bg-rose-500/15 text-slate-900 dark:text-white font-medium ring-2 ring-rose-500/30';
          } else {
            btn.className += 'border-slate-200 dark:border-slate-800 opacity-60 text-slate-600 dark:text-slate-400';
          }
        } else {
          if (isOptionSelected) {
            btn.className += 'border-emerald-500 bg-emerald-500/15 text-slate-900 dark:text-white font-bold ring-2 ring-emerald-500/30';
          } else {
            btn.className += 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 bg-slate-50/60 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200';
          }
        }

        const cleanOptHtml = formatClinicalMarkdown(opt.texto, { inline: true });

        btn.innerHTML = `
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl font-mono font-bold text-sm shrink-0 border ${
            isOptionSelected
              ? 'bg-emerald-500 text-slate-950 border-emerald-500'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
          }">${opt.id}</span>
          <span class="clinical-prose text-base sm:text-lg leading-relaxed pt-0.5">${cleanOptHtml}</span>
        `;

        btn.addEventListener('click', () => {
          if (!state.isReviewing) {
            this.handleOptionSelectionWithXP(opt.id);
          }
        });

        optionsContainer.appendChild(btn);
      });
    }

    const justBox = document.getElementById('q-justification-box');
    if (justBox) {
      const selected = state.selectedAnswer;
      // En modo tutor/La Morgue, mostrar feedback desde el primer intento registrado,
      // aunque el usuario haya navegado y vuelto. En revisión, siempre mostrar.
      const hasFirstAttempt = !!(state.firstAttemptAnswer);
      const showFeedback = (state.mode === 'study' || state.mode === 'errors' || state.isFinished || state.isReviewing) && (selected || hasFirstAttempt || state.isReviewing);
      // En modo tutor, usar el primer intento para mostrar el análisis de distractor correcto
      const effectiveSelectedForFeedback = (state.mode === 'study' || state.mode === 'errors') && state.firstAttemptAnswer
        ? state.firstAttemptAnswer
        : selected;
      if (showFeedback) {
        justBox.classList.remove('hidden');
        const correctLetterEl = document.getElementById('q-correct-letter');
        if (correctLetterEl) correctLetterEl.textContent = q.correcta || 'A';

        const isUnansweredReview = state.isReviewing && !effectiveSelectedForFeedback;

        const perlaBox = document.getElementById('q-perla-box');
        const perlaText = document.getElementById('q-perla-text');
        const fuenteEl = document.getElementById('q-fuente-text');
        const effectivePearlContent = q.perla_caces || (isUnansweredReview ? (q.por_que_es || q.justificacion || '') : '');
        if (perlaBox && perlaText) {
          if (effectivePearlContent) {
            perlaBox.classList.remove('hidden');
            perlaText.innerHTML = formatClinicalMarkdown(effectivePearlContent);
          } else {
            perlaBox.classList.add('hidden');
          }
        }
        if (fuenteEl) {
          const rawFuente = q.fuente ? `Fuente / GPC: ${q.fuente}` : (q.guia_msp ? `Normativa: ${q.guia_msp}` : '');
          fuenteEl.innerHTML = formatClinicalMarkdown(rawFuente, { inline: true });
        }

        const toggleJustBtn = document.getElementById('btn-toggle-justification');
        const justSectionWrap = toggleJustBtn ? toggleJustBtn.parentElement : null;
        const justDetail = document.getElementById('q-justification-detail');
        const arrowJust = document.getElementById('arrow-justification');
        if (justDetail) justDetail.classList.add('hidden');
        if (arrowJust) arrowJust.textContent = '+';

        if (justSectionWrap) {
          justSectionWrap.classList.toggle('hidden', isUnansweredReview);
        }

        const justEl = document.getElementById('q-justification-text');
        if (justEl) {
          justEl.innerHTML = formatClinicalMarkdown(q.justificacion || q.por_que_es || 'Justificación clínica basada en protocolo MSP.');
        }

        const distractorsContainer = document.getElementById('q-distractors-container');
        const distractorsList = document.getElementById('q-distractors-list');
        const breakdown = q.desglose_opciones || q.distractores || {};

        if (distractorsList && distractorsContainer) {
          distractorsList.innerHTML = '';

          if (!isUnansweredReview && effectiveSelectedForFeedback && effectiveSelectedForFeedback !== q.correcta) {
            distractorsContainer.classList.remove('hidden');
            const opts = Array.isArray(q.opciones) ? q.opciones : [];
            const chosenOpt = opts.find(o => o && o.id === effectiveSelectedForFeedback);
            const optTxt = chosenOpt ? formatClinicalMarkdown(chosenOpt.texto || chosenOpt.text || '', { inline: true }) : `Opción ${effectiveSelectedForFeedback}`;
            const whyNot = breakdown[effectiveSelectedForFeedback] || `No constituye la conducta de primera elección según la guía del MSP. La respuesta correcta es la opción ${q.correcta}.`;

            const item = document.createElement('div');
            item.className = 'p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5';
            item.innerHTML = `
              <div class="flex items-center gap-2 font-mono text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                ${ICONS.cross}
                <span>TU ELECCIÓN (OPCIÓN ${effectiveSelectedForFeedback}): ${optTxt}</span>
              </div>
              <div class="clinical-prose text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed pl-6">${formatClinicalMarkdown(whyNot)}</div>
            `;
            distractorsList.appendChild(item);
          } else {
            distractorsContainer.classList.add('hidden');
          }
        }
      } else {
        justBox.classList.add('hidden');
      }
    }

    const markBtn = document.getElementById('btn-mark-q');
    if (markBtn) {
      if (state.isMarked) {
        markBtn.className = 'bto-btn px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold border-transparent flex items-center gap-1.5';
        markBtn.innerHTML = `${ICONS.bookmarkFilled} <span class="hidden md:inline">En Duda</span>`;
      } else {
        markBtn.className = 'bto-btn px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs sm:text-sm font-semibold flex items-center gap-1.5';
        markBtn.innerHTML = `${ICONS.bookmarkOutline} <span class="hidden md:inline">Duda</span>`;
      }
    }

    const finishBtnTop = document.getElementById('btn-finish-exam');
    if (finishBtnTop) {
      if (state.isReviewing) {
        finishBtnTop.textContent = 'Ver Informe y PDF';
        finishBtnTop.className = 'bto-btn px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs sm:text-sm font-bold border-transparent';
      } else {
        finishBtnTop.textContent = 'Terminar Intento';
        finishBtnTop.className = 'bto-btn px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm font-bold border-transparent';
      }
    }

    const prevBtn = document.getElementById('btn-prev-q');
    if (prevBtn) {
      prevBtn.disabled = state.index <= 0;
      prevBtn.classList.toggle('opacity-50', state.index <= 0);
    }

    const nextBtn = document.getElementById('btn-next-q');
    if (nextBtn) {
      const isLast = state.index >= state.total - 1;
      if (isLast) {
        if (state.isReviewing) {
          nextBtn.textContent = 'Volver al Informe →';
          nextBtn.className = 'bto-btn px-6 sm:px-7 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-sm sm:text-base font-bold border-transparent';
        } else {
          nextBtn.textContent = 'Terminar Intento y Revisar ✓';
          nextBtn.className = 'bto-btn px-6 sm:px-7 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm sm:text-base font-bold border-transparent shadow-md shadow-rose-500/25';
        }
      } else {
        nextBtn.textContent = 'Siguiente →';
        nextBtn.className = 'bto-btn px-6 sm:px-7 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-sm sm:text-base font-bold border-transparent';
      }
    }

    this.renderQuestionMatrix(state);
  }

  renderQuestionMatrix(state) {
    const matrix = document.getElementById('exam-matrix-grid');
    if (!matrix) return;
    matrix.innerHTML = '';

    this.engine.sessionQuestions.forEach((q, idx) => {
      const isCurrent = idx === state.index;
      const isAnswered = Boolean(state.userAnswers[q.id]);
      const isMarked = state.markedQuestions.includes(q.id);
      const isCorrect = state.userAnswers[q.id] === q.correcta;

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'h-9 rounded-xl text-xs sm:text-sm font-mono font-bold flex items-center justify-center transition-all border ';

      if (state.isReviewing) {
        if (isCurrent) cell.className += 'ring-2 ring-emerald-400 font-black ';
        if (isCorrect) cell.className += 'bg-emerald-500 text-slate-950 border-emerald-600 ';
        else if (isAnswered && !isCorrect) cell.className += 'bg-rose-500 text-white border-rose-600 ';
        else cell.className += 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-transparent ';
      } else {
        if (isCurrent) cell.className += 'bg-emerald-500 text-slate-950 border-emerald-600 font-black shadow-md shadow-emerald-500/20 ';
        else if (isMarked) cell.className += 'bg-amber-400 text-slate-950 border-amber-500 ';
        else if (isAnswered) cell.className += 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 ';
        else cell.className += 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 border-transparent hover:border-slate-400 ';
      }

      cell.textContent = idx + 1;
      cell.addEventListener('click', () => {
        this.engine.goToQuestion(idx);
        if (this.closeRightExamDrawer) this.closeRightExamDrawer();
      });
      matrix.appendChild(cell);
    });
  }

  // =========================================================================
  // INFORME DE RESULTADOS + REVISIÓN COMPLETA DE PREGUNTAS + PDF
  // =========================================================================
  renderExamSummary(summary) {
    document.getElementById('exam-active-screen')?.classList.add('hidden');
    const resultsScreen = document.getElementById('exam-results-screen');
    if (!resultsScreen) return;
    resultsScreen.classList.remove('hidden');
    this.updateStudyNavbarVisibility();

    document.getElementById('res-score').textContent = `${summary.puntuacion} / ${summary.total}`;
    document.getElementById('res-percentage').textContent = `${summary.porcentaje}%`;

    const cacesPts = summary.puntajeCaces || (summary.porcentaje < 60
      ? Math.round((summary.porcentaje / 60) * 700)
      : Math.round(700 + ((summary.porcentaje - 60) / 40) * 300));
    const cacesPtsEl = document.getElementById('res-caces-points');
    if (cacesPtsEl) cacesPtsEl.textContent = `${cacesPts} / 1000 PTS`;

    const minutesSpent = Math.max(1, Math.round(summary.tiempo / 60));
    const timeSpentEl = document.getElementById('res-time-spent');
    if (timeSpentEl) timeSpentEl.textContent = `${minutesSpent} min`;

    const statusBadge = document.getElementById('res-status-badge');
    if (statusBadge) {
      if (summary.aprobado) {
        this.arcade.addXP(100, false, false);
        statusBadge.className = 'inline-block px-5 py-2 rounded-full font-mono text-xs sm:text-sm font-bold bg-emerald-500 text-slate-950';
        statusBadge.textContent = `HABILITADO CACES: ${cacesPts} / 1000 PTS (≥ 700 pts requeridos • +100 XP)`;
      } else {
        statusBadge.className = 'inline-block px-5 py-2 rounded-full font-mono text-xs sm:text-sm font-bold bg-rose-500 text-white';
        statusBadge.textContent = `NO ALCANZA UMBRAL: ${cacesPts} / 1000 PTS (Se requiere ≥ 700 pts)`;
      }
    }

    const container = document.getElementById('res-specialties-container');
    if (container && summary.desglose) {
      container.innerHTML = '';
      Object.keys(summary.desglose).forEach(spec => {
        const item = summary.desglose[spec];
        if (item.total === 0) return;
        const isPassed = item.pct >= 60;
        const row = document.createElement('div');
        row.className = 'p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800';
        row.innerHTML = `
          <div class="flex items-center justify-between mb-2 font-mono">
            <div>
              <span class="font-sans font-bold text-base text-slate-900 dark:text-white">${spec}</span>
              <span class="text-sm text-slate-500 ml-2">[${item.correct}/${item.total}]</span>
            </div>
            <span class="text-base font-black ${isPassed ? 'text-emerald-500' : 'text-rose-500'}">
              ${item.pct}%
            </span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div class="${isPassed ? 'bg-emerald-500' : 'bg-rose-500'} h-full transition-all duration-500" style="width: ${item.pct}%"></div>
          </div>
        `;
        container.appendChild(row);
      });
    }

    // Renderizar revisión completa pregunta por pregunta inmediatamente debajo
    this.setResultsReviewFilterUI('all');
    this.renderDetailedReviewList(summary, 'all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderDetailedReviewList(summary, filter = 'all') {
    const listContainer = document.getElementById('res-detailed-review-list');
    if (!listContainer) return;

    const questions = summary.preguntasSesion || this.engine.sessionQuestions || [];
    const userAnswers = summary.respuestasUsuario || this.engine.userAnswers || {};

    const filteredItems = questions
      .map((q, idx) => ({ q, idx, userAns: userAnswers[q.id] || null }))
      .filter(item => {
        const isCorrect = item.userAns === item.q.correcta;
        if (filter === 'wrong') return !isCorrect;
        if (filter === 'correct') return isCorrect;
        return true;
      });

    if (filteredItems.length === 0) {
      listContainer.innerHTML = `
        <div class="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium">
          No hay preguntas en esta categoría para mostrar.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';

    filteredItems.forEach(({ q, idx, userAns }) => {
      const isCorrect = userAns === q.correcta;
      const isUnanswered = !userAns;
      const breakdown = q.desglose_opciones || q.distractores || {};
      const opts = Array.isArray(q.opciones) ? q.opciones : [];

      let statusBadgeHtml = '';
      if (isCorrect) {
        statusBadgeHtml = `<span class="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono text-xs font-bold">CORRECTA</span>`;
      } else if (isUnanswered) {
        statusBadgeHtml = `<span class="px-3 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono text-xs font-bold">SIN RESPONDER</span>`;
      } else {
        statusBadgeHtml = `<span class="px-3 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-mono text-xs font-bold">INCORRECTA (Marcaste ${userAns})</span>`;
      }

      const optionsHtml = opts.map(opt => {
        const isOptCorrect = opt.id === q.correcta;
        const isOptSelected = opt.id === userAns;
        const optText = formatClinicalMarkdown(opt.texto || opt.text || '', { inline: true });

        let boxStyle = 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300';
        let badgeStyle = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
        let tagLabel = '';

        if (isOptCorrect) {
          boxStyle = 'border-emerald-500 bg-emerald-500/15 text-slate-900 dark:text-white font-semibold';
          badgeStyle = 'bg-emerald-500 text-slate-950';
          tagLabel = `<span class="ml-2 px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold uppercase">Clave Oficial</span>`;
        } else if (isOptSelected && !isOptCorrect) {
          boxStyle = 'border-rose-500 bg-rose-500/15 text-slate-900 dark:text-white font-semibold';
          badgeStyle = 'bg-rose-500 text-white';
          tagLabel = `<span class="ml-2 px-2 py-0.5 rounded bg-rose-500 text-white font-mono text-[10px] font-bold uppercase">Tu Respuesta</span>`;
        }

        return `
          <div class="p-3.5 rounded-xl border ${boxStyle} flex items-start gap-3 text-xs sm:text-sm">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-lg font-mono font-bold shrink-0 ${badgeStyle}">${opt.id}</span>
            <div class="flex-1 leading-relaxed">${optText} ${tagLabel}</div>
          </div>
        `;
      }).join('');

      let wrongExplanationHtml = '';
      let officialJustificationHtml = '';
      let perlaHtml = '';

      if (isUnanswered) {
        // Cuando la pregunta está sin responder: mostrar únicamente la Perla CACES y nada más
        const perlaContent = q.perla_caces || q.por_que_es || q.justificacion || 'Revisa este tema en la Guía de Práctica Clínica del MSP Ecuador.';
        perlaHtml = `
          <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
            <span class="font-mono text-xs font-bold uppercase text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              ${ICONS.diamond}
              <span>Perla CACES:</span>
            </span>
            <div class="clinical-prose text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium">${formatClinicalMarkdown(perlaContent)}</div>
            ${q.guia_msp || q.fuente ? `<div class="font-mono text-[11px] text-slate-500 pt-1">Normativa: ${formatClinicalMarkdown(q.guia_msp || q.fuente, { inline: true })}</div>` : ''}
          </div>
        `;
      } else {
        if (!isCorrect) {
          const chosenOptObj = opts.find(o => o.id === userAns);
          const chosenText = chosenOptObj ? formatClinicalMarkdown(chosenOptObj.texto || chosenOptObj.text || '', { inline: true }) : '';
          const specificWhyNot = breakdown[userAns]
            || (q.por_que_es || q.justificacion || `La conducta correcta corresponde a la opción ${q.correcta} según protocolo oficial del MSP.`);

          wrongExplanationHtml = `
            <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1.5">
              <div class="font-mono text-xs font-bold uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                ${ICONS.cross}
                <span>Por qué la opción ${userAns} no es correcta:</span>
              </div>
              ${chosenText ? `<div class="text-xs font-semibold text-slate-600 dark:text-slate-300 italic">"${chosenText}"</div>` : ''}
              <div class="clinical-prose text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">${formatClinicalMarkdown(specificWhyNot)}</div>
            </div>
          `;
        }

        officialJustificationHtml = `
          <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
            <span class="font-mono text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300 block">Fundamento Clínico (Clave ${q.correcta}):</span>
            <div class="clinical-prose text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">${formatClinicalMarkdown(q.por_que_es || q.justificacion || 'Respaldado por la Guía de Práctica Clínica del MSP Ecuador.')}</div>
          </div>
        `;

        if (q.perla_caces) {
          perlaHtml = `
            <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <span class="font-mono text-xs font-bold uppercase text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                ${ICONS.diamond}
                <span>Perla CACES:</span>
              </span>
              <div class="clinical-prose text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium">${formatClinicalMarkdown(q.perla_caces)}</div>
              ${q.guia_msp || q.fuente ? `<div class="font-mono text-[11px] text-slate-500 pt-1">Normativa: ${formatClinicalMarkdown(q.guia_msp || q.fuente, { inline: true })}</div>` : ''}
            </div>
          `;
        }
      }

      const card = document.createElement('div');
      card.className = 'p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-4';
      card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono font-black text-sm text-slate-900 dark:text-white">PREGUNTA #${idx + 1}</span>
            <span class="px-2.5 py-0.5 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono text-xs font-bold">${q.especialidad || 'Medicina'}</span>
            ${q.subtema ? `<span class="text-xs text-slate-500 font-medium">• ${formatClinicalMarkdown(q.subtema, { inline: true })}</span>` : ''}
          </div>
          ${statusBadgeHtml}
        </div>

        <div class="clinical-prose text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed">
          ${formatClinicalMarkdown(q.enunciado)}
        </div>

        <div class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border-l-4 border-emerald-500 font-bold text-sm sm:text-base text-slate-900 dark:text-white">
          ${formatClinicalMarkdown(q.pregunta || '¿Cuál es la conducta diagnóstica o terapéutica de elección?', { inline: true })}
        </div>

        <div class="grid grid-cols-1 gap-2">
          ${optionsHtml}
        </div>

        ${wrongExplanationHtml}
        ${officialJustificationHtml}
        ${perlaHtml}
      `;

      listContainer.appendChild(card);
    });
  }

  /**
   * Limpia etiquetas HTML y Markdown para texto plano en exportación PDF directa
   */
  cleanPlainTextForPDF(raw) {
    if (!raw) return '';
    return String(raw)
      .replace(/```(?:markdown|md|json)?/gi, '')
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
      .replace(/__([\s\S]+?)__/g, '$1')
      .replace(/\*([^\*\n]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generador binario PDF 1.4 nativo de respaldo (sin depender de window.print ni de CDN)
   */
  downloadBinaryPdfFallback(filename, textBlocks) {
    const toWinAnsi = (str) => {
      return String(str || '')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2022/g, '-')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
    };
    const escPdf = (s) => toWinAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

    const wrapLine = (text, maxChars = 90) => {
      const words = String(text || '').split(/\s+/);
      const lines = [];
      let cur = '';
      words.forEach(w => {
        if (!cur) cur = w;
        else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
        else {
          lines.push(cur);
          cur = w;
        }
      });
      if (cur) lines.push(cur);
      return lines.length ? lines : [''];
    };

    const allLines = [];
    textBlocks.forEach(b => {
      const wrapped = wrapLine(b.text, b.bold ? 84 : 92);
      wrapped.forEach(line => {
        allLines.push({ text: line, bold: Boolean(b.bold), gapAfter: 0 });
      });
      if (b.gapAfter) {
        allLines.push({ text: '', bold: false, gapAfter: b.gapAfter });
      }
    });

    const linesPerPage = 48;
    const pages = [];
    for (let i = 0; i < allLines.length; i += linesPerPage) {
      pages.push(allLines.slice(i, i + linesPerPage));
    }
    if (pages.length === 0) pages.push([{ text: 'Sin contenido', bold: false }]);

    const objects = [];
    const addObj = (body) => {
      objects.push(body);
      return objects.length;
    };

    const fontRegularId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontBoldId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    const pageIds = [];
    const contentIds = [];

    pages.forEach((pLines, pIdx) => {
      let y = 790;
      const cmds = ['BT'];
      pLines.forEach(item => {
        if (!item.text) {
          y -= (item.gapAfter || 8);
          return;
        }
        cmds.push(`/${item.bold ? 'F2' : 'F1'} ${item.bold ? 10.5 : 9.5} Tf`);
        cmds.push(`1 0 0 1 42 ${y} Tm (${escPdf(item.text)}) Tj`);
        y -= 14;
      });
      cmds.push(`/F1 8.5 Tf 1 0 0 1 42 28 Tm (Pagina ${pIdx + 1} de ${pages.length} - EL HPTA CACES) Tj`);
      cmds.push('ET');
      const stream = cmds.join('\n');
      const cId = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      contentIds.push(cId);
    });

    const pagesRootPlaceholderIndex = objects.length;
    objects.push('');
    const pagesRootId = pagesRootPlaceholderIndex + 1;

    contentIds.forEach(cId => {
      const pId = addObj(`<< /Type /Page /Parent ${pagesRootId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${cId} 0 R >>`);
      pageIds.push(pId);
    });

    objects[pagesRootPlaceholderIndex] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`);

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((body, idx) => {
      offsets.push(pdf.length);
      pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /**
   * Genera y descarga un archivo .PDF real directamente sin usar window.print()
   */
  downloadExamReviewPDF(summary) {
    const questions = summary.preguntasSesion || this.engine.sessionQuestions || [];
    const userAnswers = summary.respuestasUsuario || this.engine.userAnswers || {};

    if (questions.length === 0) {
      alert("No hay preguntas en la sesión para exportar.");
      return;
    }

    const clean = (txt) => this.cleanPlainTextForPDF(txt);
    const filename = `Revision_CACES_${summary.porcentaje || 0}pct_${Date.now().toString().slice(-5)}.pdf`;

    const JsPDFClass = window.jspdf?.jsPDF;
    if (!JsPDFClass) {
      // Respaldo binario directo si no cargó el CDN de jsPDF
      const blocks = [
        { text: `EL HPTA CACES - REVISION DE EXAMEN (${summary.modo || 'Simulador'})`, bold: true },
        { text: `Fecha: ${clean(summary.fechaTexto || summary.fecha || '')} | Calificacion: ${summary.porcentaje}% (${summary.puntajeCaces} / 1000 pts) | Aciertos: ${summary.puntuacion}/${summary.total}`, bold: true, gapAfter: 8 }
      ];
      questions.forEach((q, idx) => {
        const userAns = userAnswers[q.id] || null;
        const isCorrect = userAns === q.correcta;
        const isUnanswered = !userAns;
        const statusLabel = isCorrect
          ? `CORRECTA (Clave ${q.correcta})`
          : isUnanswered
            ? `SIN RESPONDER (Clave ${q.correcta})`
            : `INCORRECTA (Elegiste ${userAns} - Clave ${q.correcta})`;

        blocks.push({ text: `PREGUNTA #${idx + 1} [${clean(q.especialidad || 'Medicina')} - ${clean(q.subtema || 'General')}] - ${statusLabel}`, bold: true });
        blocks.push({ text: `Caso: ${clean(q.enunciado)}` });
        blocks.push({ text: `Pregunta: ${clean(q.pregunta || '¿Cuál es la conducta de elección?')}`, bold: true });
        (Array.isArray(q.opciones) ? q.opciones : []).forEach(o => {
          const tag = o.id === q.correcta ? ' [CLAVE OFICIAL]' : (o.id === userAns ? ' [TU RESPUESTA]' : '');
          blocks.push({ text: `  ${o.id}) ${clean(o.texto || o.text || '')}${tag}`, bold: o.id === q.correcta });
        });
        if (isUnanswered) {
          const perlaTxt = clean(q.perla_caces || q.por_que_es || q.justificacion || '');
          if (perlaTxt) blocks.push({ text: `Perla CACES: ${perlaTxt}`, bold: true, gapAfter: 8 });
        } else {
          const breakdown = q.desglose_opciones || q.distractores || {};
          if (!isCorrect && userAns) {
            const whyNot = clean(breakdown[userAns] || q.por_que_es || q.justificacion || '');
            if (whyNot) blocks.push({ text: `Por que ${userAns} es incorrecta: ${whyNot}` });
          }
          const fundTxt = clean(q.por_que_es || q.justificacion || '');
          if (fundTxt) blocks.push({ text: `Fundamento Clave ${q.correcta}: ${fundTxt}` });
          if (q.perla_caces) blocks.push({ text: `Perla CACES: ${clean(q.perla_caces)}`, bold: true });
          blocks.push({ text: '', gapAfter: 8 });
        }
      });
      this.downloadBinaryPdfFallback(filename, blocks);
      return;
    }

    const doc = new JsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 16;

    const ensureSpace = (neededMm = 16) => {
      if (y + neededMm > pageHeight - 16) {
        doc.addPage();
        y = 16;
      }
    };

    const writeWrapped = (text, { fontSize = 9.5, style = 'normal', color = [15, 23, 42], indent = 0, lineHeight = 4.6 } = {}) => {
      const str = clean(text);
      if (!str) return;
      doc.setFont('helvetica', style);
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(str, contentWidth - indent);
      lines.forEach(line => {
        ensureSpace(lineHeight + 2);
        doc.text(line, margin + indent, y);
        y += lineHeight;
      });
    };

    // Cabecera del PDF
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y - 4, contentWidth, 24, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('EL HPTA CACES — INFORME Y REVISION DE PREGUNTAS', margin + 5, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(16, 185, 129);
    doc.text(
      clean(`Modalidad: ${summary.modo || 'Simulador'}  |  Fecha: ${summary.fechaTexto || summary.fecha || ''}`),
      margin + 5,
      y + 10.5
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(
      clean(`Calificacion: ${summary.porcentaje}% (${summary.puntajeCaces} / 1000 PTS)  |  Aciertos: ${summary.puntuacion}/${summary.total}  |  Incorrectas: ${summary.incorrectas}  |  Sin responder: ${summary.sinResponder}`),
      margin + 5,
      y + 16.5
    );
    y += 27;

    questions.forEach((q, idx) => {
      ensureSpace(32);

      const userAns = userAnswers[q.id] || null;
      const isCorrect = userAns === q.correcta;
      const isUnanswered = !userAns;
      const breakdown = q.desglose_opciones || q.distractores || {};
      const opts = Array.isArray(q.opciones) ? q.opciones : [];

      // Encabezado de la pregunta
      if (isCorrect) {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(16, 185, 129);
      } else if (isUnanswered) {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
      } else {
        doc.setFillColor(255, 241, 242);
        doc.setDrawColor(244, 63, 94);
      }
      doc.roundedRect(margin, y - 3.5, contentWidth, 8, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const headerLeft = clean(`PREGUNTA #${idx + 1}  •  ${q.especialidad || 'Medicina'} (${q.subtema || 'General'})`);
      doc.text(headerLeft.substring(0, 72), margin + 3, y + 1.5);

      const statusRight = isCorrect
        ? `CORRECTA (Clave ${q.correcta})`
        : isUnanswered
          ? `SIN RESPONDER (Clave ${q.correcta})`
          : `INCORRECTA (Marcaste ${userAns} | Clave ${q.correcta})`;

      if (isCorrect) doc.setTextColor(4, 120, 87);
      else if (isUnanswered) doc.setTextColor(180, 83, 9);
      else doc.setTextColor(190, 18, 60);
      doc.text(clean(statusRight), pageWidth - margin - 3, y + 1.5, { align: 'right' });
      y += 9;

      // Enunciado y pregunta
      writeWrapped(`Caso Clinico: ${clean(q.enunciado)}`, { fontSize: 9.2, style: 'normal', color: [30, 41, 59] });
      y += 1;
      writeWrapped(clean(q.pregunta || '¿Cuál es la conducta diagnóstica o terapéutica de elección?'), { fontSize: 9.5, style: 'bold', color: [15, 23, 42] });
      y += 1.5;

      // Opciones
      opts.forEach(o => {
        const isKey = o.id === q.correcta;
        const isChosen = o.id === userAns;
        const suffix = isKey ? '  [CLAVE OFICIAL]' : (isChosen && !isKey ? '  [TU RESPUESTA]' : '');
        const optColor = isKey
          ? [4, 120, 87]
          : (isChosen && !isKey ? [190, 18, 60] : [51, 65, 85]);
        writeWrapped(`${o.id}) ${clean(o.texto || o.text || '')}${suffix}`, {
          fontSize: 9,
          style: isKey || isChosen ? 'bold' : 'normal',
          color: optColor,
          indent: 3,
          lineHeight: 4.3
        });
      });
      y += 1.5;

      if (isUnanswered) {
        // Si la pregunta está sin responder: mostrar únicamente la Perla CACES y nada más
        const perlaOnly = clean(q.perla_caces || q.por_que_es || q.justificacion || 'Revisa este tema en la Guía de Práctica Clínica del MSP Ecuador.');
        writeWrapped(`PERLA CACES: ${perlaOnly}`, {
          fontSize: 9,
          style: 'bold',
          color: [146, 64, 14],
          indent: 2,
          lineHeight: 4.4
        });
      } else {
        if (!isCorrect && userAns) {
          const whyNot = clean(breakdown[userAns] || q.por_que_es || q.justificacion || '');
          if (whyNot) {
            writeWrapped(`Por que la opcion ${userAns} no es correcta: ${whyNot}`, {
              fontSize: 8.8,
              style: 'normal',
              color: [159, 18, 57],
              indent: 2,
              lineHeight: 4.3
            });
            y += 1;
          }
        }

        const fundText = clean(q.por_que_es || q.justificacion || '');
        if (fundText) {
          writeWrapped(`Fundamento Clinico (Clave ${q.correcta}): ${fundText}`, {
            fontSize: 8.8,
            style: 'normal',
            color: [6, 95, 70],
            indent: 2,
            lineHeight: 4.3
          });
          y += 1;
        }

        if (q.perla_caces) {
          writeWrapped(`PERLA CACES: ${clean(q.perla_caces)}`, {
            fontSize: 8.8,
            style: 'bold',
            color: [146, 64, 14],
            indent: 2,
            lineHeight: 4.3
          });
        }
      }

      y += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 3;
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`EL HPTA CACES — Pagina ${p} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    doc.save(filename);
  }

  // =========================================================================
  // LA MORGUE (PREGUNTAS COMPLETAS, OPCIONES, OPCIÓN ERRÓNEA Y PERLA CACES)
  // =========================================================================
  bindErrorControls() {
    document.getElementById('btn-clear-errors')?.addEventListener('click', () => {
      if (confirm("¿Vaciar La Morgue de errores?")) {
        Storage.clearErrors();
        this.renderErrorsList();
      }
    });
  }

  renderErrorsList() {
    const container = document.getElementById('errors-list-container');
    const badgeCount = document.getElementById('badge-error-count');
    if (!container) return;

    const errorBank = Storage.getErrorBank();
    const allQ = this.engine.allQuestions || [];
    const errorIds = Object.keys(errorBank).filter(id => !errorBank[id].dominada);

    if (badgeCount) badgeCount.textContent = `${errorIds.length} pendientes`;

    if (errorIds.length === 0) {
      container.innerHTML = `
        <div class="bto-card text-center py-14 bg-white dark:bg-bto-panel rounded-3xl p-8">
          <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            ${ICONS.check}
          </div>
          <div class="font-display font-bold text-2xl">La Morgue está vacía</div>
          <p class="text-sm sm:text-base text-slate-500 max-w-md mx-auto mt-2">No tienes preguntas falladas pendientes. Realiza un simulacro o entra a la Guardia Arcade para ponerte a prueba.</p>
        </div>
      `;
      document.getElementById('btn-study-errors')?.classList.add('hidden');
      return;
    }

    document.getElementById('btn-study-errors')?.classList.remove('hidden');
    container.innerHTML = '';

    // Buscar también la última opción errónea en el historial de simulacros si no estaba registrada aún
    const history = Storage.getExamHistory();

    errorIds.forEach((id, idx) => {
      const q = allQ.find(item => item.id === id);
      if (!q) return;
      const stats = errorBank[id] || {};
      let wrongOptId = stats.ultima_opcion_erronea || null;

      if (!wrongOptId) {
        for (const h of history) {
          const ans = h.respuestasUsuario?.[id];
          if (ans && ans !== q.correcta) {
            wrongOptId = ans;
            break;
          }
        }
      }

      const opts = Array.isArray(q.opciones) ? q.opciones : [];
      const breakdown = q.desglose_opciones || q.distractores || {};

      const optionsHtml = opts.map(opt => {
        const isCorrectOpt = opt.id === q.correcta;
        const isWrongChosen = wrongOptId && opt.id === wrongOptId;
        const optText = formatClinicalMarkdown(opt.texto || opt.text || '', { inline: true });

        let boxStyle = 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300';
        let badgeStyle = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
        let tagHtml = '';

        if (isCorrectOpt) {
          boxStyle = 'border-emerald-500 bg-emerald-500/15 text-slate-900 dark:text-white font-semibold';
          badgeStyle = 'bg-emerald-500 text-slate-950';
          tagHtml = `<span class="ml-2 px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold uppercase">Clave Correcta</span>`;
        } else if (isWrongChosen) {
          boxStyle = 'border-rose-500 bg-rose-500/15 text-slate-900 dark:text-white font-semibold';
          badgeStyle = 'bg-rose-500 text-white';
          tagHtml = `<span class="ml-2 px-2 py-0.5 rounded bg-rose-500 text-white font-mono text-[10px] font-bold uppercase">Tu Opción Errónea</span>`;
        }

        return `
          <div class="p-3.5 rounded-xl border ${boxStyle} flex items-start gap-3 text-xs sm:text-sm">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-lg font-mono font-bold shrink-0 ${badgeStyle}">${opt.id}</span>
            <div class="flex-1 leading-relaxed">${optText} ${tagHtml}</div>
          </div>
        `;
      }).join('');

      const chosenWrongObj = wrongOptId ? opts.find(o => o.id === wrongOptId) : null;
      const chosenWrongText = chosenWrongObj ? formatClinicalMarkdown(chosenWrongObj.texto || chosenWrongObj.text || '', { inline: true }) : '';
      const whyWrongExplanation = (wrongOptId && breakdown[wrongOptId])
        ? breakdown[wrongOptId]
        : `Esta opción constituye un distractor clínico y no corresponde a la conducta de primera línea. Revisa el fundamento oficial de la clave ${q.correcta}.`;

      const card = document.createElement('div');
      card.className = 'bto-card p-6 sm:p-7 rounded-3xl bg-white dark:bg-bto-panel space-y-4';
      card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono font-black text-sm text-rose-500">CASO #${idx + 1}</span>
            <span class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-xs font-bold">${q.especialidad} // ${formatClinicalMarkdown(q.subtema || 'CACES', { inline: true })}</span>
          </div>
          <div class="flex items-center gap-2 font-mono text-xs">
            <span class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-500 font-bold">Fallos: ${stats.fallos || 1}</span>
            <button type="button" class="btn-master-error px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors">Dar de Alta (+10 XP)</button>
          </div>
        </div>

        <!-- Enunciado Completo -->
        <div class="clinical-prose text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed">
          ${formatClinicalMarkdown(q.enunciado)}
        </div>

        <!-- Pregunta Completa -->
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-l-4 border-rose-500 font-bold text-sm sm:text-base text-slate-900 dark:text-white">
          ${formatClinicalMarkdown(q.pregunta || '¿Cuál es la conducta diagnóstica o terapéutica de elección?', { inline: true })}
        </div>

        <!-- Opciones de Respuesta Completas -->
        <div class="grid grid-cols-1 gap-2">
          ${optionsHtml}
        </div>

        <!-- Explicación de por qué la opción errónea escogida no es correcta -->
        <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1.5">
          <span class="font-mono text-xs font-bold uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            ${ICONS.cross}
            <span>${wrongOptId ? `Por qué tu opción escogida (${wrongOptId}) no es correcta:` : 'Análisis del Error Clínico:'}</span>
          </span>
          ${chosenWrongText ? `<div class="text-xs font-semibold text-slate-600 dark:text-slate-300 italic">"${chosenWrongText}"</div>` : ''}
          <div class="clinical-prose text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">${formatClinicalMarkdown(whyWrongExplanation)}</div>
        </div>

        <!-- Fundamento de la Respuesta Correcta -->
        <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
          <span class="font-mono text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 block">CLAVE OFICIAL [${q.correcta}] — Fundamento Clínico:</span>
          <div class="clinical-prose text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">${formatClinicalMarkdown(q.justificacion || q.por_que_es || '')}</div>
        </div>

        <!-- Perla CACES -->
        ${q.perla_caces ? `
        <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
          <span class="font-mono text-xs font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            ${ICONS.diamond}
            <span>Perla CACES de Alto Rendimiento:</span>
          </span>
          <div class="clinical-prose text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium">${formatClinicalMarkdown(q.perla_caces)}</div>
          ${q.guia_msp || q.fuente ? `<div class="font-mono text-[11px] text-slate-500 pt-1">Normativa: ${formatClinicalMarkdown(q.guia_msp || q.fuente, { inline: true })}</div>` : ''}
        </div>` : ''}
      `;

      card.querySelector('.btn-master-error').addEventListener('click', () => {
        this.arcade.playTone('correct');
        this.arcade.addXP(10, true);
        Storage.markErrorMastered(id);
        this.renderErrorsList();
      });

      container.appendChild(card);
    });

    const btnStudyErrors = document.getElementById('btn-study-errors');
    if (btnStudyErrors) {
      btnStudyErrors.onclick = () => {
        this.startSessionWrapper({ mode: 'errors', count: 50, onlyErrors: true });
      };
    }
  }

  // =========================================================================
  // IMPORTADOR PDF / JSON Y CONFIGURACIÓN NUBE
  // =========================================================================
  bindPDFImporter() {
    const fileInput = document.getElementById('pdf-file-input');
    const dropZone = document.getElementById('pdf-drop-zone');
    const previewContainer = document.getElementById('pdf-preview-container');
    const btnSaveImported = document.getElementById('btn-save-imported-questions');
    const btnSamplePdf = document.getElementById('btn-load-sample-pdf');
    const btnCopyScript = document.getElementById('btn-copy-extractor-script');
    const btnProcessJson = document.getElementById('btn-process-json-paste');

    if (btnCopyScript) btnCopyScript.addEventListener('click', () => this.copyExtractorScript());
    if (btnProcessJson) btnProcessJson.addEventListener('click', () => this.processPastedJSON());

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-emerald-500');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-emerald-500');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-emerald-500');
        if (e.dataTransfer.files?.length > 0) {
          this.processAnyFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files?.length > 0) {
          this.processAnyFile(e.target.files[0]);
        }
      });
    }

    if (btnSamplePdf) {
      btnSamplePdf.addEventListener('click', async () => {
        const sampleUrl = 'banco_caces/ilide.info-caces-banco-preguntas-carrera-medicina-jun-20221-1-pr_765f6870914a669c292360d08d54dcd3.pdf';
        const statusEl = document.getElementById('pdf-status-text');
        if (statusEl) statusEl.textContent = 'Cargando PDF oficial CACES...';

        try {
          const resp = await fetch(sampleUrl);
          if (!resp.ok) throw new Error("No se encontró el archivo PDF local.");
          const blob = await resp.blob();
          const file = new File([blob], "CACES-Banco-Medicina-Junio-2022.pdf", { type: "application/pdf" });
          await this.processPDFFile(file);
        } catch (e) {
          if (statusEl) statusEl.textContent = 'Error: ' + e.message;
        }
      });
    }

    if (btnSaveImported) {
      btnSaveImported.addEventListener('click', async () => {
        if (this.extractedQuestionsPreview.length === 0) return;
        const res = await Storage.saveCustomQuestions(this.extractedQuestionsPreview);
        alert(`Se inyectaron ${res.added} preguntas nuevas (${res.duplicatesSkipped} repetidas omitidas).`);
        this.extractedQuestionsPreview = [];
        previewContainer?.classList.add('hidden');
        const qList = await this.engine.loadQuestions();
        this.updateQuestionCountBadge(qList.length);
      });
    }
  }

  async copyExtractorScript() {
    try {
      const resp = await fetch('scripts/caces_extractor.js');
      if (!resp.ok) throw new Error("No se pudo cargar scripts/caces_extractor.js");
      const scriptCode = await resp.text();
      await navigator.clipboard.writeText(scriptCode);
      alert("Script copiado al portapapeles.");
    } catch (e) {
      alert("Error al copiar script: " + e.message);
    }
  }

  processAnyFile(file) {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.json') || file.type === 'application/json') {
      this.processJSONFile(file);
    } else if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      this.processPDFFile(file);
    } else {
      this.processMarkdownFile(file);
    }
  }

  processMarkdownFile(file) {
    const reader = new FileReader();
    const statusEl = document.getElementById('pdf-status-text');
    if (statusEl) statusEl.textContent = `Analizando "${file.name}"...`;

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        let questions = this.pdfImporter.parseMarkdownQuestions(text, file.name);
        if (questions.length === 0) {
          questions = this.pdfImporter.parseQuestionsFromText(text);
        }
        if (questions.length === 0) {
          alert(`No se detectaron preguntas estructuradas en "${file.name}".`);
          return;
        }
        this.extractedQuestionsPreview = questions;
        this.renderPDFPreview(questions, file.name);
        if (statusEl) statusEl.textContent = `${questions.length} preguntas extraídas correctamente.`;
      } catch (err) {
        alert("Error: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  processJSONFile(file) {
    const reader = new FileReader();
    const statusEl = document.getElementById('pdf-status-text');
    reader.onload = (e) => {
      try {
        const rawData = JSON.parse(e.target.result);
        const questions = this.normalizeImportedQuestions(rawData);
        this.extractedQuestionsPreview = questions;
        this.renderPDFPreview(questions, file.name);
        if (statusEl) statusEl.textContent = `${questions.length} preguntas listas.`;
      } catch (err) {
        alert("Error leyendo JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  processPastedJSON() {
    const input = document.getElementById('json-paste-input');
    if (!input || !input.value.trim()) return;
    try {
      let rawText = input.value.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/g, '').trim();
      const rawData = JSON.parse(rawText);
      const questions = this.normalizeImportedQuestions(rawData);
      this.extractedQuestionsPreview = questions;
      this.renderPDFPreview(questions, "JSON Directo");
    } catch (e) {
      alert("JSON inválido: " + e.message);
    }
  }

  normalizeImportedQuestions(jsonArray) {
    let data = Array.isArray(jsonArray) ? jsonArray : (jsonArray?.questions || [jsonArray]);
    const letters = ['A', 'B', 'C', 'D'];

    const result = data.map((raw, idx) => {
      if (!raw || typeof raw !== 'object') return null;
      const statement = (raw.enunciado || raw.statement || raw.pregunta || raw.question || '').toString().trim();
      let normalizedOptions = [];
      const rawOpts = raw.opciones || raw.options || raw.respuestas || [];

      if (Array.isArray(rawOpts)) {
        rawOpts.forEach((item, i) => {
          if (typeof item === 'string') {
            normalizedOptions.push({ id: letters[i] || 'A', texto: item.trim() });
          } else if (item && typeof item === 'object') {
            normalizedOptions.push({
              id: (item.id || letters[i] || 'A').toString().toUpperCase(),
              texto: (item.texto || item.text || '').toString().trim()
            });
          }
        });
      } else if (rawOpts && typeof rawOpts === 'object') {
        Object.keys(rawOpts).forEach(k => {
          normalizedOptions.push({
            id: k.toUpperCase(),
            texto: String(rawOpts[k]?.texto || rawOpts[k] || '').trim()
          });
        });
      }

      while (normalizedOptions.length < 4) {
        normalizedOptions.push({ id: letters[normalizedOptions.length], texto: `Opción ${letters[normalizedOptions.length]}` });
      }

      return {
        id: raw.id || `caces_imp_${Date.now()}_${idx}`,
        enunciado: statement,
        pregunta: raw.pregunta || "¿Cuál es la conducta diagnóstica o terapéutica de elección?",
        opciones: normalizedOptions.slice(0, 4),
        correcta: (raw.correcta || 'A').toString().toUpperCase(),
        justificacion: raw.justificacion || raw.por_que_es || '',
        por_que_es: raw.por_que_es || raw.justificacion || '',
        desglose_opciones: raw.desglose_opciones || raw.distractores || {},
        perla_caces: raw.perla_caces || '',
        guia_msp: raw.guia_msp || '',
        especialidad: raw.especialidad || this.pdfImporter.detectSpecialty(statement),
        subtema: raw.subtema || 'General',
        fuente: raw.fuente || 'Banco Importado'
      };
    }).filter(q => q && q.enunciado.length > 5);

    return Storage.deduplicateQuestions(result);
  }

  async processPDFFile(file) {
    const statusEl = document.getElementById('pdf-status-text');
    try {
      const fullText = await this.pdfImporter.extractTextFromPDF(file, (cur, tot) => {
        if (statusEl) statusEl.textContent = `Extrayendo PDF: pág ${cur}/${tot}...`;
      });
      const questions = this.pdfImporter.parseQuestionsFromText(fullText);
      if (questions.length === 0) {
        alert("No se detectaron preguntas estructuradas en el PDF.");
        return;
      }
      this.extractedQuestionsPreview = questions;
      this.renderPDFPreview(questions, file.name);
      if (statusEl) statusEl.textContent = `${questions.length} preguntas extraídas.`;
    } catch (e) {
      alert("Error procesando PDF: " + e.message);
    }
  }

  renderPDFPreview(questions, fileName, limit = 20) {
    const previewContainer = document.getElementById('pdf-preview-container');
    const listEl = document.getElementById('pdf-preview-list');
    const badgeEl = document.getElementById('pdf-detected-count');

    if (!previewContainer || !listEl) return;
    previewContainer.classList.remove('hidden');
    if (badgeEl) badgeEl.textContent = `${questions.length} detectadas`;
    listEl.innerHTML = '';

    questions.slice(0, limit).forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm space-y-2';
      card.innerHTML = `
        <div class="flex items-center justify-between font-mono">
          <span class="font-bold text-emerald-600 dark:text-emerald-400">#${idx + 1} [${q.especialidad}]</span>
          <span class="px-2.5 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-bold">Clave: ${q.correcta}</span>
        </div>
        <div class="clinical-prose text-slate-800 dark:text-slate-200">${formatClinicalMarkdown(q.enunciado, { inline: true })}</div>
      `;
      listEl.appendChild(card);
    });
  }

  bindCloudSettings() {
    const btnSaveCloud = document.getElementById('btn-save-supabase');
    const alertEl = document.getElementById('cloud-test-alert');

    btnSaveCloud?.addEventListener('click', async () => {
      const url = document.getElementById('supabase-url')?.value;
      const key = document.getElementById('supabase-key')?.value;
      SupabaseConfig.saveCredentials(url, key);
      Storage.initSupabase();

      const res = await Storage.testSupabaseConnection();
      this.checkCloudStatus();
      if (alertEl) {
        alertEl.classList.remove('hidden');
        alertEl.textContent = res.message;
      }
    });

    document.getElementById('btn-copy-sql')?.addEventListener('click', () => {
      navigator.clipboard.writeText(SupabaseConfig.getSchemaSQL());
      alert("SQL copiado al portapapeles.");
    });

    document.getElementById('btn-deduplicate-db')?.addEventListener('click', async () => {
      const res = await Storage.cleanDuplicates();
      const qList = await this.engine.loadQuestions();
      this.updateQuestionCountBadge(qList.length);
      alert(`Limpieza lista: ${res.removed} duplicadas eliminadas. Total actual: ${res.after}.`);
    });

    document.getElementById('btn-export-db-json')?.addEventListener('click', async () => {
      const qList = await this.engine.loadQuestions();
      const blob = new Blob([JSON.stringify(qList, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `el_hpta_caces_${qList.length}_items.json`;
      a.click();
    });

    document.getElementById('btn-clear-questions-db')?.addEventListener('click', async () => {
      if (confirm("¿Vaciar el banco a 0 preguntas?")) {
        await Storage.clearDatabase();
        const qList = await this.engine.loadQuestions();
        this.updateQuestionCountBadge(qList.length);
      }
    });

    document.getElementById('btn-reset-all-data')?.addEventListener('click', async () => {
      if (confirm("¿Reiniciar todo el progreso, historial y preguntas?")) {
        await Storage.resetAll();
        window.location.reload();
      }
    });
  }

  checkCloudStatus() {
    const dot = document.getElementById('cloud-status-dot');
    const txt = document.getElementById('cloud-status-text');
    if (!dot || !txt) return;
    if (SupabaseConfig.isConfigured()) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
      txt.textContent = 'ONLINE';
    } else {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500';
      txt.textContent = 'LOCAL';
    }
  }

  // =========================================================================
  // FLASHCARDS, CALCULADORAS, TUTOR IA, TEMARIO Y EXPLORADOR
  // =========================================================================
  async initFlashcards() {
    this.bindFlashcardsControls();
    const source = document.getElementById('fc-source-select')?.value || 'all';
    const spec = document.getElementById('fc-specialty-select')?.value || 'Todas';
    await Flashcards.loadDeck({ specialty: spec, source });
    this.renderFlashcard();
  }

  bindFlashcardsControls() {
    if (this._flashcardsBound) return;
    this._flashcardsBound = true;

    const toggleFlip = () => {
      this.arcade.playTone('beep');
      Flashcards.flipCard();
      this.renderFlashcard();
    };

    document.getElementById('fc-card-wrapper')?.addEventListener('click', toggleFlip);
    document.getElementById('btn-fc-flip')?.addEventListener('click', toggleFlip);

    document.getElementById('btn-fc-next')?.addEventListener('click', () => {
      Flashcards.nextCard();
      this.renderFlashcard();
    });

    document.getElementById('btn-fc-prev')?.addEventListener('click', () => {
      Flashcards.prevCard();
      this.renderFlashcard();
    });

    document.getElementById('btn-fc-hard')?.addEventListener('click', () => {
      this.arcade.playTone('wrong');
      Flashcards.rateCard('hard');
      this.renderFlashcard();
    });

    document.getElementById('btn-fc-good')?.addEventListener('click', () => {
      this.arcade.playTone('beep');
      Flashcards.rateCard('good');
      this.renderFlashcard();
    });

    document.getElementById('btn-fc-easy')?.addEventListener('click', () => {
      this.arcade.playTone('correct');
      this.arcade.addXP(15, true);
      Flashcards.rateCard('easy');
      this.renderFlashcard();
    });

    const sourceSelect = document.getElementById('fc-source-select');
    const specSelect = document.getElementById('fc-specialty-select');

    sourceSelect?.addEventListener('change', async () => {
      await Flashcards.loadDeck({ specialty: specSelect?.value || 'Todas', source: sourceSelect.value });
      this.renderFlashcard();
    });

    specSelect?.addEventListener('change', async () => {
      await Flashcards.loadDeck({ specialty: specSelect.value, source: sourceSelect?.value || 'all' });
      this.renderFlashcard();
    });
  }

  renderFlashcard() {
    const card = Flashcards.getCurrentCard();
    const badgeProgress = document.getElementById('fc-progress-badge');
    const specBadge = document.getElementById('fc-specialty-badge');
    const subtemaBadge = document.getElementById('fc-subtema-badge');
    const sideIndicator = document.getElementById('fc-side-indicator');
    const questionText = document.getElementById('fc-question-text');
    const answerText = document.getElementById('fc-answer-text');
    const justText = document.getElementById('fc-justification-text');
    const frontEl = document.getElementById('fc-content-front');
    const backEl = document.getElementById('fc-content-back');
    const masteredLabel = document.getElementById('fc-mastered-label');

    if (masteredLabel) masteredLabel.textContent = `${Flashcards.masteredCount} dominadas`;

    if (!card) {
      if (badgeProgress) badgeProgress.textContent = "0/0";
      if (questionText) questionText.innerHTML = "No hay tarjetas disponibles con este filtro.";
      frontEl?.classList.remove('hidden');
      backEl?.classList.add('hidden');
      return;
    }

    if (badgeProgress) badgeProgress.textContent = `${Flashcards.currentIndex + 1} / ${Flashcards.deck.length}`;
    if (specBadge) specBadge.textContent = card.especialidad;
    if (subtemaBadge) subtemaBadge.innerHTML = formatClinicalMarkdown(card.subtema || 'CACES MSP', { inline: true });

    if (Flashcards.isFlipped) {
      if (sideIndicator) sideIndicator.textContent = "REVERSO // CLAVE OFICIAL";
      frontEl?.classList.add('hidden');
      backEl?.classList.remove('hidden');
      if (answerText) answerText.innerHTML = formatClinicalMarkdown(card.respuesta);
      if (justText) justText.innerHTML = formatClinicalMarkdown(card.justificacion);

      const perlaContainer = document.getElementById('fc-perla-container');
      const perlaText = document.getElementById('fc-perla-text');
      const guiaText = document.getElementById('fc-guia-text');
      if (perlaContainer) {
        if (card.perla_caces) {
          perlaContainer.classList.remove('hidden');
          if (perlaText) perlaText.innerHTML = formatClinicalMarkdown(card.perla_caces);
          if (guiaText) guiaText.innerHTML = formatClinicalMarkdown(card.guia_msp ? `Normativa MSP: ${card.guia_msp}` : '', { inline: true });
        } else {
          perlaContainer.classList.add('hidden');
        }
      }
    } else {
      if (sideIndicator) sideIndicator.textContent = "ANVERSO // CASO CLÍNICO";
      frontEl?.classList.remove('hidden');
      backEl?.classList.add('hidden');
      if (questionText) questionText.innerHTML = formatClinicalMarkdown(card.pregunta);
    }
  }

  initCalculators() {
    if (this._calculatorsBound) return;
    this._calculatorsBound = true;

    const subtabBtns = document.querySelectorAll('.calc-subtab-btn');
    subtabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-calc');
        subtabBtns.forEach(b => {
          b.classList.remove('bg-emerald-500', 'text-slate-950', 'font-bold');
          b.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        });
        e.currentTarget.classList.add('bg-emerald-500', 'text-slate-950', 'font-bold');
        e.currentTarget.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');

        document.querySelectorAll('.calc-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById(`calc-panel-${target}`)?.classList.remove('hidden');
      });
    });

    const mamaInputs = ['mama-fc', 'mama-pas', 'mama-pad', 'mama-fr', 'mama-temp', 'mama-sat', 'mama-conciencia', 'mama-proteinuria'];
    const updateMama = () => {
      const res = ClinicalCalculators.calculateScoreMama({
        fc: document.getElementById('mama-fc')?.value || 80,
        pas: document.getElementById('mama-pas')?.value || 110,
        pad: document.getElementById('mama-pad')?.value || 70,
        fr: document.getElementById('mama-fr')?.value || 18,
        temp: document.getElementById('mama-temp')?.value || 36.5,
        sat: document.getElementById('mama-sat')?.value || 98,
        conciencia: document.getElementById('mama-conciencia')?.value || 0,
        proteinuria: document.getElementById('mama-proteinuria')?.value || 0
      });
      const badge = document.getElementById('mama-score-badge');
      const rec = document.getElementById('mama-recommendation-text');
      if (badge) {
        badge.textContent = `${res.score} Puntos`;
        badge.className = res.score === 0
          ? 'px-4 py-1.5 rounded-full font-mono text-base font-black bg-emerald-500 text-slate-950'
          : res.score >= 5
            ? 'px-4 py-1.5 rounded-full font-mono text-base font-black bg-rose-500 text-white animate-pulse'
            : 'px-4 py-1.5 rounded-full font-mono text-base font-black bg-amber-400 text-slate-950';
      }
      if (rec) rec.textContent = res.recommendation;
    };
    mamaInputs.forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateMama);
      document.getElementById(id)?.addEventListener('change', updateMama);
    });
    updateMama();

    const fppInput = document.getElementById('fpp-fur-input');
    if (fppInput) {
      const def = new Date();
      def.setDate(def.getDate() - 140);
      fppInput.value = def.toISOString().split('T')[0];
      const updateFpp = () => {
        const res = ClinicalCalculators.calculateFPP(fppInput.value);
        if (res) {
          document.getElementById('fpp-naegele-text').textContent = res.fppNaegele;
          document.getElementById('fpp-wahl-text').textContent = res.fppWahl;
          document.getElementById('fpp-eg-text').textContent = res.gestationalAge;
        }
      };
      fppInput.addEventListener('change', updateFpp);
      updateFpp();
    }

    const aiepiInputs = ['aiepi-peso', 'aiepi-estado', 'aiepi-ojos', 'aiepi-sed', 'aiepi-pliegue'];
    const updateAiepi = () => {
      const res = ClinicalCalculators.classifyAIEPIDehydration({
        pesoKg: document.getElementById('aiepi-peso')?.value || 10,
        estado: document.getElementById('aiepi-estado')?.value || 'alerta',
        ojos: document.getElementById('aiepi-ojos')?.value || 'normales',
        sed: document.getElementById('aiepi-sed')?.value || 'normal',
        pliegue: document.getElementById('aiepi-pliegue')?.value || 'inmediato'
      });
      const diagBadge = document.getElementById('aiepi-diag-badge');
      const planBadge = document.getElementById('aiepi-plan-badge');
      const conducta = document.getElementById('aiepi-conducta-text');
      if (diagBadge) diagBadge.textContent = res.clasificacion;
      if (planBadge) planBadge.textContent = res.plan;
      if (conducta) conducta.textContent = res.conducta;
    };
    aiepiInputs.forEach(id => {
      document.getElementById(id)?.addEventListener('change', updateAiepi);
      document.getElementById(id)?.addEventListener('input', updateAiepi);
    });
    updateAiepi();

    const alvIds = ['alv-migratorio', 'alv-anorexia', 'alv-nauseas', 'alv-dolorFID', 'alv-blumberg', 'alv-fiebre', 'alv-leucocitosis', 'alv-desviacion'];
    const updateAlvarado = () => {
      const res = ClinicalCalculators.calculateAlvarado({
        migratorio: document.getElementById('alv-migratorio')?.checked || false,
        anorexia: document.getElementById('alv-anorexia')?.checked || false,
        nauseas: document.getElementById('alv-nauseas')?.checked || false,
        dolorFID: document.getElementById('alv-dolorFID')?.checked || false,
        blumberg: document.getElementById('alv-blumberg')?.checked || false,
        fiebre: document.getElementById('alv-fiebre')?.checked || false,
        leucocitosis: document.getElementById('alv-leucocitosis')?.checked || false,
        desviacionIzquierda: document.getElementById('alv-desviacion')?.checked || false
      });
      const badge = document.getElementById('alv-score-badge');
      const interp = document.getElementById('alv-interpretation-text');
      if (badge) badge.textContent = `${res.score} PUNTOS - ${res.interpretation}`;
      if (interp) interp.textContent = res.action;
    };
    alvIds.forEach(id => document.getElementById(id)?.addEventListener('change', updateAlvarado));
    updateAlvarado();

    const curbIds = ['curb-c', 'curb-u', 'curb-r', 'curb-b', 'curb-65'];
    const updateCurb = () => {
      const res = ClinicalCalculators.calculateCURB65({
        confusion: document.getElementById('curb-c')?.checked || false,
        ureaBUN: document.getElementById('curb-u')?.checked || false,
        frElevada: document.getElementById('curb-r')?.checked || false,
        presionBaja: document.getElementById('curb-b')?.checked || false,
        edad65: document.getElementById('curb-65')?.checked || false
      });
      document.getElementById('curb-score-badge').textContent = res.riesgo;
      document.getElementById('curb-lugar-badge').textContent = res.lugarManejo;
      document.getElementById('curb-tratamiento-text').textContent = res.esquemaTerapeutico;
    };
    curbIds.forEach(id => document.getElementById(id)?.addEventListener('change', updateCurb));
    updateCurb();
  }

  bindAITutor() {
    const modal = document.getElementById('ai-tutor-modal');
    const btnOpen = document.getElementById('btn-open-ai-tutor');
    const btnOpenTop = document.getElementById('btn-open-ai-tutor-top');
    const btnOpenInline = document.getElementById('btn-open-ai-tutor-inline');
    const btnClose = document.getElementById('btn-close-ai-tutor');
    const btnConfigToggle = document.getElementById('btn-ai-config-toggle');
    const configPanel = document.getElementById('ai-config-panel');
    const providerSelect = document.getElementById('ai-provider-select');
    const modelSelect = document.getElementById('ai-model-select');
    const keyInput = document.getElementById('ai-key-input');
    const btnSaveKey = document.getElementById('btn-save-ai-key');
    const chatMessages = document.getElementById('ai-chat-messages');
    const chatInput = document.getElementById('ai-chat-input');
    const btnSend = document.getElementById('btn-send-ai-chat');
    const contextEl = document.getElementById('ai-current-q-context');
    const btnAiGenerateBreakdown = document.getElementById('btn-ai-generate-breakdown');

    if (providerSelect) providerSelect.value = aiTutor.provider || 'gemini';
    if (modelSelect) modelSelect.value = aiTutor.model || 'gemini-flash-lite-latest';
    if (keyInput) keyInput.value = aiTutor.apiKey || '';

    btnConfigToggle?.addEventListener('click', () => configPanel?.classList.toggle('hidden'));

    btnSaveKey?.addEventListener('click', () => {
      aiTutor.saveCredentials(providerSelect?.value, keyInput?.value, modelSelect?.value);
      configPanel?.classList.add('hidden');
      alert("Motor IA actualizado.");
    });

    let lastQuestionId = null;

    const openTutor = (customQuestion = null) => {
      let q = customQuestion;
      let state = null;
      if (!q) {
        state = this.engine.getState();
        q = state.question;
      }
      if (!q) {
        alert("Inicia una pregunta primero o selecciona un caso.");
        return;
      }
      this._activeTutorQuestion = q;

      modal?.classList.remove('hidden');
      if (contextEl) {
        contextEl.textContent = state ? `ÍTEM #${state.index + 1} [${q.especialidad}] — ${q.subtema || 'General'}` : `CASO [${q.especialidad}] — ${q.subtema || 'General'}`;
      }

      if (chatMessages && (chatMessages.children.length === 0 || lastQuestionId !== q.id)) {
        lastQuestionId = q.id;
        chatMessages.innerHTML = '';

        const hasAnswered = state ? Boolean(state.selectedAnswer || state.isReviewing || state.isFinished) : true;
        const correctOpt = Array.isArray(q.opciones) ? q.opciones.find(o => o.id === q.correcta) : null;
        const correctText = correctOpt ? (correctOpt.texto || '') : '';

        if (hasAnswered) {
          this.appendAIMessage('tutor', `**Clave oficial: Opción ${q.correcta}** — ${correctText}\n\n¿Qué quieres profundizar o aclarar de este caso? Usa los accesos rápidos o escribe tu consulta médica.`);
        } else {
          this.appendAIMessage('tutor', `**Tutor Clínico — ${q.especialidad}**\n\n¿Tienes dudas antes de responder? Pregúntame sobre la sospecha diagnóstica, estudios de primera línea o protocolos del MSP.`);
        }
      }
    };

    this.openAITutor = openTutor;

    btnOpen?.addEventListener('click', () => openTutor());
    btnOpenTop?.addEventListener('click', () => openTutor());
    btnOpenInline?.addEventListener('click', () => openTutor());
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest('.btn-trigger-ai-tutor')) {
        openTutor();
      }
    });

    btnClose?.addEventListener('click', () => modal?.classList.add('hidden'));

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    const sendUserQuery = async (queryText) => {
      const text = (queryText || chatInput?.value || '').trim();
      if (!text) return;

      const q = this._activeTutorQuestion || this.engine.getState().question;
      if (!q) return;

      this.appendAIMessage('user', text);
      if (chatInput) chatInput.value = '';

      const loadingMsg = this.appendAIMessage('tutor', 'Consultando guías clínicas del MSP...');

      try {
        const reply = await aiTutor.askTutor({ question: q, prompt: text });
        loadingMsg.innerHTML = formatClinicalMarkdown(reply);
      } catch (err) {
        const localReply = aiTutor.localClinicalEngine({ question: q, prompt: text });
        loadingMsg.innerHTML = formatClinicalMarkdown(localReply);
      }
    };

    btnSend?.addEventListener('click', () => sendUserQuery());
    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendUserQuery();
      }
    });

    document.querySelectorAll('.ai-chip').forEach(chip => {
      chip.addEventListener('click', () => sendUserQuery(chip.getAttribute('data-prompt')));
    });

    btnAiGenerateBreakdown?.addEventListener('click', async () => {
      const q = this._activeTutorQuestion || this.engine.getState().question;
      if (!q) return;

      btnAiGenerateBreakdown.disabled = true;
      btnAiGenerateBreakdown.textContent = 'Auditando...';

      try {
        const breakdown = await aiTutor.generateOptionBreakdown(q);
        if (breakdown.desglose_opciones) q.desglose_opciones = breakdown.desglose_opciones;
        if (breakdown.por_que_es) q.justificacion = breakdown.por_que_es;
        if (breakdown.perla_caces) q.perla_caces = breakdown.perla_caces;
        if (breakdown.guia_msp) q.guia_msp = breakdown.guia_msp;

        await Storage.saveCustomQuestions([q]);
        this.renderExamState(this.engine.getState());
      } catch (e) {
        alert("Error generando desglose: " + e.message);
      } finally {
        btnAiGenerateBreakdown.disabled = false;
        btnAiGenerateBreakdown.innerHTML = `${ICONS.sparkle} <span>Auditar con IA</span>`;
      }
    });
  }

  appendAIMessage(sender, text) {
    const chatMessages = document.getElementById('ai-chat-messages');
    if (!chatMessages) return null;

    const div = document.createElement('div');
    if (sender === 'user') {
      div.className = 'p-4 rounded-2xl bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 font-semibold ml-8 text-sm sm:text-base border border-emerald-500/30';
      div.textContent = text;
    } else {
      div.className = 'clinical-prose p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mr-4 text-sm sm:text-base space-y-2';
      div.innerHTML = formatClinicalMarkdown(text);
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  bindTemarioControls() {
    if (this._temarioBound) return;
    this._temarioBound = true;

    this.activeTemarioComp = 'Todas';
    this.temarioSearchTerm = '';
    this._selectedTopicCount = 20;

    const searchInput = document.getElementById('temario-search-input');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.temarioSearchTerm = e.target.value;
          this.renderTemarioHub();
        }, 150);
      });
    }

    const pills = document.querySelectorAll('.temario-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        pills.forEach(p => {
          p.classList.remove('active', 'bg-emerald-500', 'text-slate-950', 'font-bold');
          p.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        });
        this.activeTemarioComp = e.currentTarget.getAttribute('data-comp');
        e.currentTarget.classList.add('active', 'bg-emerald-500', 'text-slate-950', 'font-bold');
        e.currentTarget.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        this.renderTemarioHub();
      });
    });

    document.getElementById('btn-open-caces-acronyms-hub')?.addEventListener('click', () => {
      document.getElementById('caces-syllabus-modal')?.classList.remove('hidden');
    });

    const tpModal = document.getElementById('temario-practice-modal');
    document.getElementById('btn-close-tp-modal')?.addEventListener('click', () => tpModal?.classList.add('hidden'));

    document.querySelectorAll('.tp-count-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tp-count-opt').forEach(b => {
          b.classList.remove('active', 'border-emerald-500', 'bg-emerald-500/15');
        });
        e.currentTarget.classList.add('active', 'border-emerald-500', 'bg-emerald-500/15');
        this._selectedTopicCount = parseInt(e.currentTarget.getAttribute('data-count') || '20', 10);
      });
    });

    document.getElementById('btn-start-topic-practice')?.addEventListener('click', () => {
      if (!this.currentTopicPractice) return;
      const total = this.currentTopicPractice.total || 20;
      const chosen = Math.min(this._selectedTopicCount || 20, total);
      tpModal?.classList.add('hidden');
      this.startSessionWrapper({
        mode: 'study',
        count: chosen,
        specialty: this.currentTopicPractice.spec,
        subtema: this.currentTopicPractice.subtema
      });
    });

    const tpearlModal = document.getElementById('temario-pearls-modal');
    document.getElementById('btn-close-tpearl-modal')?.addEventListener('click', () => tpearlModal?.classList.add('hidden'));
    document.getElementById('tpearl-search-input')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.tpearl-card-item').forEach(it => {
        it.style.display = it.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    document.getElementById('btn-tpearl-start-practice')?.addEventListener('click', () => {
      tpearlModal?.classList.add('hidden');
      if (this.currentTopicPractice) {
        this.openTopicPracticeModal(this.currentTopicPractice.spec, this.currentTopicPractice.subtema, this.currentTopicPractice.total);
      }
    });

    const tsummaryModal = document.getElementById('temario-summary-modal');
    document.getElementById('btn-close-tsummary-modal')?.addEventListener('click', () => tsummaryModal?.classList.add('hidden'));
    document.getElementById('btn-tsummary-practice')?.addEventListener('click', () => {
      tsummaryModal?.classList.add('hidden');
      if (this.currentTopicPractice) {
        this.openTopicPracticeModal(this.currentTopicPractice.spec, this.currentTopicPractice.subtema, this.currentTopicPractice.total);
      }
    });
  }

  async renderTemarioHub() {
    this.bindTemarioControls();
    const container = document.getElementById('temario-cards-container');
    if (!container) return;

    const allQuestions = await Storage.getAllQuestions();
    if (!allQuestions || allQuestions.length === 0) {
      container.innerHTML = `<div class="col-span-full p-10 text-center text-base text-slate-500">No hay preguntas cargadas en el banco.</div>`;
      return;
    }

    const topicMap = new Map();
    allQuestions.forEach(q => {
      const spec = q.especialidad || 'Medicina Interna';
      const sub = formatClinicalMarkdown(q.subtema || 'General', { inline: true }).replace(/<[^>]+>/g, '');
      const key = `${spec}:::${sub}`;
      if (!topicMap.has(key)) {
        topicMap.set(key, { key, especialidad: spec, subtema: sub, questions: [], pearls: [], guidelines: new Set(), sampleQuestions: [] });
      }
      const item = topicMap.get(key);
      item.questions.push(q);
      if (q.perla_caces && !item.pearls.includes(q.perla_caces)) item.pearls.push(q.perla_caces);
      if (q.guia_msp) item.guidelines.add(q.guia_msp);
      if (item.sampleQuestions.length < 3) item.sampleQuestions.push(q);
    });

    const totalQEl = document.getElementById('temario-stat-total-q');
    if (totalQEl) totalQEl.textContent = `${allQuestions.length} Ítems`;
    const subtemasEl = document.getElementById('temario-stat-subtemas');
    if (subtemasEl) subtemasEl.textContent = `${topicMap.size} Subtemas`;

    let topics = Array.from(topicMap.values());
    if (this.activeTemarioComp && this.activeTemarioComp !== 'Todas') {
      topics = topics.filter(t => t.especialidad === this.activeTemarioComp);
    }
    if (this.temarioSearchTerm) {
      const s = this.temarioSearchTerm.toLowerCase().trim();
      topics = topics.filter(t => t.subtema.toLowerCase().includes(s) || t.especialidad.toLowerCase().includes(s) || t.pearls.some(p => p.toLowerCase().includes(s)));
    }

    topics.sort((a, b) => b.questions.length - a.questions.length);
    container.innerHTML = '';

    topics.forEach(t => {
      const qCount = t.questions.length;
      const pearlCount = t.pearls.length;
      const firstPearlHtml = formatClinicalMarkdown(t.pearls[0] || 'Conducta estandarizada según GPC del MSP Ecuador.', { inline: true });
      const mainGuide = Array.from(t.guidelines)[0] || 'GPC MSP Ecuador';

      const card = document.createElement('div');
      card.className = 'bto-card p-6 rounded-3xl bg-white dark:bg-bto-panel flex flex-col justify-between space-y-5';
      card.innerHTML = `
        <div class="space-y-3.5">
          <div class="flex items-center justify-between gap-2 font-mono text-xs sm:text-sm">
            <span class="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">${t.especialidad}</span>
            <span class="font-bold text-slate-500">${qCount} casos • ${pearlCount} perlas</span>
          </div>
          <h3 class="font-display font-bold text-lg sm:text-xl leading-snug text-slate-900 dark:text-white">${t.subtema}</h3>
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span class="font-mono text-xs font-bold uppercase text-amber-500 flex items-center gap-1.5">${ICONS.diamond} Perla CACES:</span>
            <div class="clinical-prose text-sm sm:text-base text-slate-700 dark:text-slate-300 line-clamp-3">${firstPearlHtml}</div>
          </div>
          <div class="font-mono text-xs text-slate-400 truncate flex items-center gap-1.5">${ICONS.doc} ${formatClinicalMarkdown(mainGuide, { inline: true })}</div>
        </div>

        <div class="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <button type="button" class="btn-topic-practice bto-btn w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm uppercase border-transparent">
            Entrenar Tema (${qCount})
          </button>
          <div class="grid grid-cols-3 gap-2 font-mono text-xs sm:text-sm">
            <button type="button" class="btn-topic-pearls bto-btn py-2 rounded-xl bg-slate-100 dark:bg-slate-900 font-semibold">Perlas</button>
            <button type="button" class="btn-topic-flashcards bto-btn py-2 rounded-xl bg-slate-100 dark:bg-slate-900 font-semibold">Cartas</button>
            <button type="button" class="btn-topic-summary bto-btn py-2 rounded-xl bg-slate-100 dark:bg-slate-900 font-semibold">Guía</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-topic-practice').addEventListener('click', () => this.openTopicPracticeModal(t.especialidad, t.subtema, qCount));
      card.querySelector('.btn-topic-pearls').addEventListener('click', () => this.openTopicPearlsModal(t.subtema, t.pearls, t.especialidad));
      card.querySelector('.btn-topic-flashcards').addEventListener('click', () => this.openTopicFlashcards(t.subtema, t.especialidad));
      card.querySelector('.btn-topic-summary').addEventListener('click', () => this.openTopicSummaryModal(t.subtema, t.especialidad, t.sampleQuestions));

      container.appendChild(card);
    });
  }

  openTopicPracticeModal(spec, subtema, totalQuestions) {
    this.currentTopicPractice = { spec, subtema, total: totalQuestions };
    document.getElementById('tp-modal-title').textContent = subtema;
    document.getElementById('tp-modal-spec').textContent = `${spec} • ${totalQuestions} ítems`;
    document.getElementById('tp-count-all-label').textContent = totalQuestions;
    document.getElementById('temario-practice-modal')?.classList.remove('hidden');
  }

  openTopicPearlsModal(subtema, pearls, spec) {
    this.currentTopicPractice = { spec, subtema, total: pearls.length };
    document.getElementById('tpearl-modal-subtema').textContent = subtema;
    document.getElementById('tpearl-modal-count').textContent = `${pearls.length} perlas clínicas`;
    const listEl = document.getElementById('tpearl-list-container');
    if (listEl) {
      listEl.innerHTML = '';
      pearls.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = 'tpearl-card-item p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm sm:text-base space-y-1.5';
        div.innerHTML = `
          <span class="font-mono text-xs sm:text-sm font-bold text-amber-500 block">PERLA #${idx + 1}</span>
          <div class="clinical-prose text-slate-800 dark:text-slate-200">${formatClinicalMarkdown(p)}</div>
        `;
        listEl.appendChild(div);
      });
    }
    document.getElementById('temario-pearls-modal')?.classList.remove('hidden');
  }

  async openTopicFlashcards(subtema, spec) {
    await Flashcards.loadDeck({ specialty: spec, subtema, source: 'all' });
    this.switchTab('flashcards');
    this.renderFlashcard();
  }

  openTopicSummaryModal(subtema, spec, sampleQuestions = []) {
    this.currentTopicPractice = { spec, subtema, total: sampleQuestions.length };
    const firstQ = sampleQuestions[0] || {};
    document.getElementById('tsummary-modal-subtema').textContent = `${subtema} (${spec})`;
    const contentEl = document.getElementById('tsummary-modal-content');
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <span class="font-mono text-xs sm:text-sm font-bold text-emerald-500 uppercase block">Conducta Oficial EHEP:</span>
          <div class="clinical-prose text-base">${formatClinicalMarkdown(firstQ.por_que_es || firstQ.justificacion || '')}</div>
        </div>
        <div class="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <span class="font-mono text-xs sm:text-sm font-bold text-amber-500 uppercase block">Regla de Oro:</span>
          <div class="clinical-prose text-base">${formatClinicalMarkdown(firstQ.perla_caces || '')}</div>
        </div>
      `;
    }
    document.getElementById('temario-summary-modal')?.classList.remove('hidden');
  }

  bindExploradorControls() {
    if (this._exploradorBound) return;
    this._exploradorBound = true;

    this.expSearchTerm = '';
    this.expSpecialty = 'Todas';
    this.expStatus = 'all';
    this.expPage = 1;
    this.expPageSize = 20;

    const searchInput = document.getElementById('exp-search-input');
    if (searchInput) {
      let debounce = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.expSearchTerm = e.target.value.toLowerCase().trim();
          this.expPage = 1;
          this.renderExplorador();
        }, 250);
      });
    }

    const statusSelect = document.getElementById('exp-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.expStatus = e.target.value;
        this.expPage = 1;
        this.renderExplorador();
      });
    }

    const pills = document.querySelectorAll('#exp-specialty-pills .exp-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        pills.forEach(p => {
          p.classList.remove('active', 'bg-cyan-500', 'text-slate-950');
          p.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        });
        const currentPill = e.currentTarget;
        currentPill.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
        currentPill.classList.add('active', 'bg-cyan-500', 'text-slate-950');
        this.expSpecialty = currentPill.getAttribute('data-spec') || 'Todas';
        this.expPage = 1;
        this.renderExplorador();
      });
    });

    document.getElementById('btn-exp-prev')?.addEventListener('click', () => {
      if (this.expPage > 1) {
        this.expPage--;
        this.renderExplorador();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    document.getElementById('btn-exp-next')?.addEventListener('click', () => {
      if (this.expPage < this._expTotalPages) {
        this.expPage++;
        this.renderExplorador();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    document.getElementById('btn-export-study-pdf')?.addEventListener('click', () => {
      this.exportStudyPDF();
    });
  }

  async renderExplorador() {
    this.bindExploradorControls();
    const container = document.getElementById('exp-questions-container');
    if (!container) return;

    if (!this.engine.allQuestions || this.engine.allQuestions.length === 0) {
      await this.engine.loadQuestions();
    }

    const allQuestions = this.engine.allQuestions || [];
    const totalCount = allQuestions.length;
    const statTotal = document.getElementById('exp-stat-total');
    if (statTotal) statTotal.textContent = `${totalCount} Preguntas`;

    if (totalCount === 0) {
      container.innerHTML = `<div class="p-12 text-center text-slate-500 font-medium">Banco en 0 preguntas.</div>`;
      return;
    }

    const errorBank = Storage.getErrorBank();
    const examHistory = Storage.getExamHistory();
    const answeredCorrectlyIds = new Set();
    const allAnsweredIds = new Set();

    examHistory.forEach(h => {
      if (h.respuestasUsuario) {
        Object.entries(h.respuestasUsuario).forEach(([id, ans]) => {
          allAnsweredIds.add(id);
          const q = allQuestions.find(item => item.id === id);
          if (q && q.correcta === ans) answeredCorrectlyIds.add(id);
        });
      }
    });

    let filtered = allQuestions.filter(q => {
      if (this.expSpecialty && this.expSpecialty !== 'Todas' && q.especialidad !== this.expSpecialty) {
        return false;
      }

      if (this.expStatus === 'unanswered' && allAnsweredIds.has(q.id)) {
        return false;
      }
      if (this.expStatus === 'errors' && (!errorBank[q.id] || errorBank[q.id].dominada)) {
        return false;
      }
      if (this.expStatus === 'correct' && !answeredCorrectlyIds.has(q.id) && !errorBank[q.id]?.dominada) {
        return false;
      }

      if (this.expSearchTerm) {
        const s = this.expSearchTerm;
        const inEnunciado = (q.enunciado || '').toLowerCase().includes(s);
        const inPregunta = (q.pregunta || '').toLowerCase().includes(s);
        const inSubtema = (q.subtema || '').toLowerCase().includes(s);
        const inPerla = (q.perla_caces || '').toLowerCase().includes(s);
        const inGuia = (q.guia_msp || q.fuente || '').toLowerCase().includes(s);
        const inId = (q.id || '').toLowerCase().includes(s);
        const inOpts = Array.isArray(q.opciones) && q.opciones.some(o => (o.texto || o.text || '').toLowerCase().includes(s));
        const inWhy = (q.por_que_es || q.justificacion || '').toLowerCase().includes(s);

        if (!inEnunciado && !inPregunta && !inSubtema && !inPerla && !inGuia && !inId && !inOpts && !inWhy) {
          return false;
        }
      }

      return true;
    });

    const statFiltered = document.getElementById('exp-stat-filtered');
    if (statFiltered) statFiltered.textContent = `Mostrando ${filtered.length} de ${totalCount}`;

    this._expTotalPages = Math.max(1, Math.ceil(filtered.length / this.expPageSize));
    if (this.expPage > this._expTotalPages) this.expPage = this._expTotalPages;

    const pageIndicator = document.getElementById('exp-page-indicator');
    if (pageIndicator) pageIndicator.textContent = `Página ${this.expPage} de ${this._expTotalPages}`;

    const prevBtn = document.getElementById('btn-exp-prev');
    const nextBtn = document.getElementById('btn-exp-next');
    if (prevBtn) prevBtn.disabled = this.expPage <= 1;
    if (nextBtn) nextBtn.disabled = this.expPage >= this._expTotalPages;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bto-card text-center py-12 bg-white dark:bg-bto-panel rounded-3xl p-6">
          <div class="font-display font-bold text-xl">Sin preguntas encontradas</div>
          <p class="text-sm text-slate-500 mt-1">Prueba con otros términos de búsqueda o selecciona "Todas" en especialidades.</p>
        </div>
      `;
      return;
    }

    const startIndex = (this.expPage - 1) * this.expPageSize;
    const pageSlice = filtered.slice(startIndex, startIndex + this.expPageSize);

    container.innerHTML = '';

    pageSlice.forEach(q => {
      const isError = errorBank[q.id] && !errorBank[q.id].dominada;
      const isCorrect = answeredCorrectlyIds.has(q.id);

      let statusBadge = '<span class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-mono font-semibold">Sin Responder</span>';
      if (isError) {
        statusBadge = '<span class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-mono font-bold">En La Morgue</span>';
      } else if (isCorrect) {
        statusBadge = '<span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">Dominada</span>';
      }

      const opts = Array.isArray(q.opciones) ? q.opciones : [];
      const renderedOptions = opts.map(opt => {
        const isOptCorrect = opt.id === q.correcta;
        const optText = formatClinicalMarkdown(opt.texto || opt.text || '', { inline: true });
        return `
          <div class="p-3 rounded-xl border ${isOptCorrect ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold' : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'} flex items-start gap-2.5 text-xs sm:text-sm">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-lg font-mono font-bold shrink-0 ${isOptCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}">${opt.id}</span>
            <div class="pt-0.5 leading-snug flex-1">${optText} ${isOptCorrect ? ' <span class="text-emerald-600 dark:text-emerald-400 font-bold">Clave</span>' : ''}</div>
          </div>
        `;
      }).join('');

      const card = document.createElement('div');
      card.className = 'bto-card p-6 sm:p-7 rounded-3xl bg-white dark:bg-bto-panel border border-slate-200 dark:border-slate-800 space-y-4';
      card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div class="flex flex-wrap items-center gap-2.5">
            <span class="px-3 py-1 rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-mono text-xs font-bold uppercase">${q.especialidad || 'Medicina Interna'}</span>
            <span class="font-mono text-xs font-bold text-slate-400">#${q.id}</span>
            ${q.subtema ? `<span class="text-xs font-semibold text-slate-600 dark:text-slate-300">› ${formatClinicalMarkdown(q.subtema, { inline: true })}</span>` : ''}
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="clinical-prose text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed font-normal">
          ${formatClinicalMarkdown(q.enunciado)}
        </div>

        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-l-4 border-cyan-500 font-bold text-sm sm:text-base text-slate-900 dark:text-white">
          ${formatClinicalMarkdown(q.pregunta || "¿Cuál es la conducta diagnóstica o terapéutica de elección?", { inline: true })}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          ${renderedOptions}
        </div>

        ${q.perla_caces ? `
        <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
          <span class="font-mono text-xs font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            ${ICONS.diamond}
            <span>Perla Oficial CACES:</span>
          </span>
          <div class="clinical-prose text-xs sm:text-sm text-slate-800 dark:text-slate-200">${formatClinicalMarkdown(q.perla_caces)}</div>
        </div>` : ''}

        <div class="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono text-slate-500">
          <span class="truncate max-w-md flex items-center gap-1.5">${ICONS.doc} ${formatClinicalMarkdown(q.guia_msp || q.fuente || 'GPC MSP Ecuador', { inline: true })}</span>
          <div class="flex items-center gap-2 ml-auto">
            <button type="button" class="btn-exp-tutor bto-btn px-3.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center gap-1.5">
              ${ICONS.bot}
              <span>Interconsulta IA</span>
            </button>
            <button type="button" class="btn-exp-train bto-btn px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs uppercase border-transparent flex items-center gap-1.5">
              ${ICONS.target}
              <span>Entrenar Pregunta</span>
            </button>
          </div>
        </div>
      `;

      card.querySelector('.btn-exp-train').addEventListener('click', () => {
        this.startSessionWrapper({ mode: 'study', count: 1, questionIds: [q.id] });
      });

      card.querySelector('.btn-exp-tutor').addEventListener('click', () => {
        if (typeof this.openAITutor === 'function') {
          this.openAITutor(q);
        }
      });

      container.appendChild(card);
    });
  }

  exportStudyPDF() {
    const allQuestions = this.engine.allQuestions || [];
    if (allQuestions.length === 0) {
      alert("No hay preguntas cargadas para exportar.");
      return;
    }

    let listToExport = allQuestions;
    if (this.expSpecialty && this.expSpecialty !== 'Todas') {
      listToExport = allQuestions.filter(q => q.especialidad === this.expSpecialty);
    }
    const exportBatch = listToExport.slice(0, 50);
    const clean = (txt) => this.cleanPlainTextForPDF(txt);
    const filename = `Cuaderno_CACES_${(this.expSpecialty || 'Todas').replace(/\s+/g, '_')}.pdf`;

    const JsPDFClass = window.jspdf?.jsPDF;
    if (!JsPDFClass) {
      const blocks = [
        { text: `CACES MedPrep - Cuaderno de Estudio (${this.expSpecialty || 'Todas'})`, bold: true },
        { text: `${exportBatch.length} Preguntas de Alto Rendimiento`, bold: true, gapAfter: 8 }
      ];
      exportBatch.forEach((q, idx) => {
        blocks.push({ text: `PREGUNTA #${idx + 1} [${clean(q.especialidad)} - ${clean(q.subtema || 'General')}]`, bold: true });
        blocks.push({ text: `Caso: ${clean(q.enunciado)}` });
        blocks.push({ text: `Pregunta: ${clean(q.pregunta || '¿Cuál es la conducta de elección?')}`, bold: true });
        (q.opciones || []).forEach(o => {
          const isKey = o.id === q.correcta;
          blocks.push({ text: `  ${o.id}) ${clean(o.texto || o.text || '')}${isKey ? ' [CLAVE OFICIAL]' : ''}`, bold: isKey });
        });
        if (q.perla_caces) blocks.push({ text: `Perla CACES: ${clean(q.perla_caces)}`, bold: true });
        blocks.push({ text: '', gapAfter: 8 });
      });
      this.downloadBinaryPdfFallback(filename, blocks);
      return;
    }

    const doc = new JsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 16;

    const ensureSpace = (neededMm = 16) => {
      if (y + neededMm > pageHeight - 16) {
        doc.addPage();
        y = 16;
      }
    };

    const writeWrapped = (text, { fontSize = 9.5, style = 'normal', color = [15, 23, 42], indent = 0, lineHeight = 4.6 } = {}) => {
      const str = clean(text);
      if (!str) return;
      doc.setFont('helvetica', style);
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(str, contentWidth - indent);
      lines.forEach(line => {
        ensureSpace(lineHeight + 2);
        doc.text(line, margin + indent, y);
        y += lineHeight;
      });
    };

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y - 4, contentWidth, 20, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('EL HPTA CACES — CUADERNO DE PREGUNTAS Y PERLAS', margin + 5, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text(clean(`Especialidad: ${this.expSpecialty || 'Todas'}  •  ${exportBatch.length} Preguntas`), margin + 5, y + 11);
    y += 23;

    exportBatch.forEach((q, idx) => {
      ensureSpace(28);
      writeWrapped(`PREGUNTA #${idx + 1}  •  ${clean(q.especialidad)} (${clean(q.subtema || 'General')})`, {
        fontSize: 9.5,
        style: 'bold',
        color: [4, 120, 87]
      });
      y += 1;
      writeWrapped(`Caso Clinico: ${clean(q.enunciado)}`, { fontSize: 9.2, style: 'normal', color: [30, 41, 59] });
      y += 1;
      writeWrapped(clean(q.pregunta || '¿Cuál es la conducta de elección?'), { fontSize: 9.4, style: 'bold', color: [15, 23, 42] });
      y += 1;
      (q.opciones || []).forEach(o => {
        const isKey = o.id === q.correcta;
        writeWrapped(`${o.id}) ${clean(o.texto || o.text || '')}${isKey ? '  [CLAVE OFICIAL]' : ''}`, {
          fontSize: 9,
          style: isKey ? 'bold' : 'normal',
          color: isKey ? [4, 120, 87] : [51, 65, 85],
          indent: 3,
          lineHeight: 4.3
        });
      });
      if (q.perla_caces) {
        y += 1;
        writeWrapped(`PERLA CACES: ${clean(q.perla_caces)}`, {
          fontSize: 8.8,
          style: 'bold',
          color: [146, 64, 14],
          indent: 2,
          lineHeight: 4.3
        });
      }
      y += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 3;
    });

    doc.save(filename);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
// js/ui.js

export function enfocarElementoSeguro(elemento) {
  if (!elemento) return;
  const headerOffset = document.querySelector('.glass-header') ? document.querySelector('.glass-header').offsetHeight : 0;
  const acordeon = elemento.closest('.accordion-collapse');
  
  const hacerScroll = () => {
      setTimeout(() => {
          const rect = elemento.getBoundingClientRect();
          const absoluteTop = window.scrollY + rect.top;
          window.scrollTo({ top: Math.max(0, absoluteTop - headerOffset - 20), behavior: 'smooth' });
          
          setTimeout(() => {
              elemento.focus({ preventScroll: true }); 
          }, 150); 
      }, 400); 
  };

  if (acordeon && !acordeon.classList.contains('show')) {
      const bsCollapse = new bootstrap.Collapse(acordeon, { toggle: false });
      bsCollapse.show();
      acordeon.addEventListener('shown.bs.collapse', hacerScroll, { once: true });
  } else {
      hacerScroll();
  }
}

export function mostrarLoader(msg) { 
  document.getElementById('loader-text').innerText = msg || "Procesando..."; 
  document.getElementById('loader').style.display = 'flex'; 
}

export function ocultarLoader() { 
  document.getElementById('loader').style.display = 'none'; 
}

export function initTheme() {
  const themeToggleBtn = document.getElementById('themeToggle');
  const moonIcon = document.getElementById('moonIcon');
  const sunIcon = document.getElementById('sunIcon');
  const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (moonIcon) moonIcon.style.display = 'none'; 
    if (sunIcon) sunIcon.style.display = 'block';
  }
  
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      let theme = document.documentElement.getAttribute('data-theme');
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        if (moonIcon) moonIcon.style.display = 'block'; 
        if (sunIcon) sunIcon.style.display = 'none';
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (moonIcon) moonIcon.style.display = 'none'; 
        if (sunIcon) sunIcon.style.display = 'block';
      }
    });
  }
}
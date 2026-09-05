import { state, setState } from '../state.js';

export const moonSVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
export const sunSVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

export const initTheme = () => {
    const themeToggle = document.getElementById('theme-toggle');
    const isDark = state.theme !== 'light';

    if (isDark) {
        document.body.classList.add('dark-mode');
        if (themeToggle) {
            themeToggle.innerHTML = moonSVG;
            themeToggle.setAttribute('data-tooltip', 'Switch to Light Mode');
            themeToggle.setAttribute('aria-label', 'Switch to Light Mode');
        }
    } else {
        document.body.classList.remove('dark-mode');
        if (themeToggle) {
            themeToggle.innerHTML = sunSVG;
            themeToggle.setAttribute('data-tooltip', 'Switch to Dark Mode');
            themeToggle.setAttribute('aria-label', 'Switch to Dark Mode');
        }
    }

    if (themeToggle && !themeToggle._bound) {
        themeToggle._bound = true;
        themeToggle.addEventListener('click', toggleTheme);
    }
};

export const toggleTheme = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('simpledash-theme', newTheme);
    setState({ theme: newTheme });

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = isDark ? moonSVG : sunSVG;
        themeToggle.setAttribute('data-tooltip', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        themeToggle.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }

    // Refresh logos in tooltips for theme changes
    document.querySelectorAll('.widget-card').forEach(wCard => {
        const tooltipBox = wCard.querySelector('.tooltip-box');
        if (tooltipBox && tooltipBox.getAttribute('data-name')) {
            updateTooltipContent(tooltipBox, tooltipBox.getAttribute('data-name'));
        }
    });
};

export const updateTooltipContent = (tooltipEl, name) => {
    if (!tooltipEl || !name) return;
    tooltipEl.setAttribute('data-name', name);
    tooltipEl.innerHTML = '';

    const target = name.trim().toLowerCase();
    const config = state.config;
    const matchedService = config && config.services ? config.services.find(s => s.name && s.name.trim().toLowerCase() === target) : null;
    const matchedWidget = (!matchedService && config && config.widgets) ? config.widgets.find(w => w.name && w.name.trim().toLowerCase() === target) : null;
    const source = matchedService || matchedWidget;

    if (source) {
        const isDark = document.body.classList.contains('dark-mode');
        let logoSrc = null;
        if (isDark && source.logo_dark) {
            logoSrc = source.logo_dark;
        } else if (!isDark && source.logo_light) {
            logoSrc = source.logo_light;
        } else if (source.logo) {
            logoSrc = source.logo;
        }

        if (logoSrc) {
            const img = document.createElement('img');
            img.className = 'tooltip-logo';
            img.src = '/logos/' + encodeURIComponent(logoSrc);
            img.alt = '';
            tooltipEl.appendChild(img);
        } else if (source.icon) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'tooltip-icon';
            iconSpan.textContent = source.icon;
            tooltipEl.appendChild(iconSpan);
        }
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = name;
    tooltipEl.appendChild(textSpan);
};

export const updateTooltipBounds = (target) => {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    let tooltipWidth = 120;
    const tbox = target.querySelector('.tooltip-box');
    if (tbox) {
        tooltipWidth = tbox.offsetWidth;
    } else {
        const text = target.getAttribute('data-tooltip') || '';
        tooltipWidth = Math.min(250, text.length * 7 + 26);
    }

    let translateX = '-50%';
    let leftPos = '50%';
    const centerX = rect.left + rect.width / 2;
    const padding = 10;

    if (centerX - tooltipWidth / 2 < padding) {
        translateX = '0';
        leftPos = '0';
    } else if (centerX + tooltipWidth / 2 > window.innerWidth - padding) {
        translateX = '-100%';
        leftPos = '100%';
    }

    target.style.setProperty('--tooltip-x', translateX);
    target.style.setProperty('--tooltip-left', leftPos);
};

export const updateAllTooltips = () => {
    document.querySelectorAll('[data-tooltip], .service-card').forEach(updateTooltipBounds);
};

let tooltipTimeout;
export const debouncedUpdateTooltips = () => {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(updateAllTooltips, 50);
};

export const initTooltips = () => {
    window.addEventListener('resize', debouncedUpdateTooltips, { passive: true });
    new MutationObserver(debouncedUpdateTooltips).observe(document.body, { childList: true, subtree: true });

    const handleTooltipInteraction = (e) => {
        const target = e.target.closest('[data-tooltip], .service-card');
        if (target) {
            target.classList.remove('hide-tooltip');
            updateTooltipBounds(target);
        }
    };

    document.addEventListener('mouseover', handleTooltipInteraction, { passive: true });
    document.addEventListener('touchstart', handleTooltipInteraction, { passive: true });
    document.addEventListener('focusin', handleTooltipInteraction, { passive: true });

    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-tooltip], .service-card');
        if (target) {
            target.classList.add('hide-tooltip');
            target.blur();
        }
    }, { passive: true, capture: true });
};

export const initMobileMenu = () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const headerRight = document.getElementById('header-right');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileMenuBtn && closeMenuBtn && headerRight && sidebarOverlay) {
        const toggleMenu = (e) => {
            if (e) e.stopPropagation();
            const isOpen = headerRight.classList.contains('show');
            if (isOpen) {
                headerRight.classList.remove('show');
                sidebarOverlay.classList.remove('show');
            } else {
                headerRight.classList.add('show');
                sidebarOverlay.classList.add('show');
            }
        };

        mobileMenuBtn.addEventListener('click', toggleMenu);
        closeMenuBtn.addEventListener('click', toggleMenu);
        sidebarOverlay.addEventListener('click', toggleMenu);
    }
};

import { state } from '../state.js';
import { updateTooltipContent } from './theme.js';

const widgetCardsMap = new Map();
const widgetMetricElsMap = new Map();
let cachedWidgetsContainer = null;

export const getWidgetsContainer = () => {
    if (cachedWidgetsContainer && document.body.contains(cachedWidgetsContainer)) return cachedWidgetsContainer;
    let wc = document.getElementById('widgets-container');
    if (!wc) {
        const sc = document.getElementById('services-container');
        if (sc) {
            wc = document.createElement('div');
            wc.id = 'widgets-container';
            wc.className = 'widgets-container';
            sc.parentNode.insertBefore(wc, sc);
        }
    }
    cachedWidgetsContainer = wc;
    return wc;
};

export const getMetricSVG = (iconName) => {
    const k = (iconName || '').toLowerCase();
    const svgWrap = (paths) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

    if (k.includes('running') || k === 'play') return svgWrap(`<polygon points="5 3 19 12 5 21 5 3"></polygon>`);
    if (k.includes('stopped') || k === 'pause-circle') return svgWrap(`<circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line>`);
    if (k.includes('shield') || k.includes('blocked')) return svgWrap(`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`);
    if (k.includes('percent')) return svgWrap(`<line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle>`);
    if (k.includes('cpu')) return svgWrap(`<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>`);
    if (k.includes('ram')) return svgWrap(`<line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line><path d="M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"></path>`);
    if (k.includes('clock') || k.includes('uptime') || k.includes('time')) return svgWrap(`<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>`);
    if (k.includes('download') || k === 'down') return svgWrap(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>`);
    if (k.includes('upload') || k === 'up') return svgWrap(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>`);
    if (k.includes('activity') || k.includes('ping')) return svgWrap(`<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>`);
    if (k.includes('users') || k.includes('clients')) return svgWrap(`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>`);
    if (k.includes('file') || k.includes('torrent')) return svgWrap(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>`);
    if (k.includes('server') || k.includes('vm')) return svgWrap(`<rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line>`);
    if (k.includes('layers') || k.includes('state')) return svgWrap(`<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>`);
    if (k.includes('help') || k.includes('queries')) return svgWrap(`<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>`);
    return svgWrap(`<circle cx="12" cy="12" r="4"></circle>`);
};

export const getMetricColors = (metric) => {
    if (!metric || !metric.threshold) return null;
    const { warning, danger, inverted } = metric.threshold;
    const val = typeof metric.value === 'number' ? metric.value : parseFloat(metric.value);
    if (isNaN(val)) return null;

    if (!inverted) {
        if (danger !== undefined && val >= danger) return { base: '#d64242', flash: '#eaa0a0' };
        if (warning !== undefined && val >= warning) return { base: '#f59e0b', flash: '#face85' };
        if (val > 0) return { base: '#39c55c', flash: '#9ce2ad' };
    } else {
        if (danger !== undefined && val <= danger) return { base: '#d64242', flash: '#eaa0a0' };
        if (warning !== undefined && val <= warning) return { base: '#f59e0b', flash: '#face85' };
        return { base: '#39c55c', flash: '#9ce2ad' };
    }
    return null;
};

export const updateSlotGeneric = (el, id, formattedStr, isFirstLoad) => {
    let slot = el.querySelector('.slot-machine');
    if (slot && slot.getAttribute('data-len') !== formattedStr.length.toString()) {
        slot.remove();
        slot = null;
    }

    if (!slot) {
        el.innerHTML = '';
        slot = document.createElement('div');
        slot.className = 'slot-machine';
        slot.setAttribute('data-len', formattedStr.length);

        for (let i = 0; i < formattedStr.length; i++) {
            const char = formattedStr[i];
            if ((char >= '0' && char <= '9') || char === ' ') {
                const d = document.createElement('div');
                d.className = 'slot-digit';
                d.id = `slot-${id}-${i}`;
                let chars = `<div class="slot-char">&nbsp;</div>`;
                for (let j = 0; j <= 9; j++) chars += `<div class="slot-char">${j}</div>`;
                d.innerHTML = chars;
                slot.appendChild(d);
            } else {
                const suff = document.createElement('div');
                suff.className = 'slot-char';
                suff.innerHTML = char;
                slot.appendChild(suff);
            }
        }
        el.appendChild(slot);
    }

    for (let i = 0; i < formattedStr.length; i++) {
        const char = formattedStr[i];
        if ((char >= '0' && char <= '9') || char === ' ') {
            const d = document.getElementById(`slot-${id}-${i}`);
            if (!d) continue;

            const idx = char === ' ' ? 0 : parseInt(char, 10) + 1;

            if (isFirstLoad) {
                d.style.transition = 'none';
            } else {
                d.style.transition = 'transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
            }
            d.style.transform = `translateY(calc(-100% / 11 * ${idx}))`;
        }
    }
};

export const animateMetric = (el, id, targetStr, colors) => {
    const currentStr = el.getAttribute('data-val');
    if (currentStr === targetStr) return;

    const isFirstLoad = currentStr === null;
    el.setAttribute('data-val', targetStr);

    if (colors !== null) {
        el.style.transition = 'none';
        if (!isFirstLoad) {
            el.style.transform = 'scale(1.08)';
        }
        el.style.color = colors.base;

        updateSlotGeneric(el, id, targetStr, isFirstLoad);
        void el.offsetWidth;

        if (!isFirstLoad) {
            el.style.transition = 'transform 0.4s ease-out';
            el.style.transform = 'scale(1)';
        }
    } else {
        updateSlotGeneric(el, id, targetStr, isFirstLoad);
        el.style.color = '';
    }
};

export const renderWidgets = (widgetsData) => {
    const wContainer = getWidgetsContainer();
    const config = state.config;
    if (!wContainer || !config || !config.widgets) return;

    config.widgets.forEach(wConfig => {
        if (!wConfig.id) return;
        const wId = wConfig.id;
        const widgetResult = widgetsData[wId];
        if (!widgetResult || !widgetResult.metrics) return;

        let wCard = widgetCardsMap.get(wId);
        if (!wCard) {
            wCard = document.getElementById(wId);
            if (!wCard) {
                wCard = document.createElement('div');
                wCard.id = wId;
                wCard.className = 'widget-card stagger-in';

                const tooltipBox = document.createElement('div');
                tooltipBox.className = 'tooltip-box';
                updateTooltipContent(tooltipBox, wConfig.name || 'Widget');
                wCard.appendChild(tooltipBox);

                const metricsWrapper = document.createElement('div');
                metricsWrapper.className = 'widget-metrics';
                wCard.appendChild(metricsWrapper);

                wContainer.appendChild(wCard);
            }
            widgetCardsMap.set(wId, wCard);
        }

        const mWrapper = wCard.querySelector('.widget-metrics');
        widgetResult.metrics.forEach(metric => {
            const metricKey = `${wId}-${metric.key}`;
            let valEl = widgetMetricElsMap.get(metricKey);

            if (!valEl) {
                let item = mWrapper.querySelector(`.metric-item[data-key="${metric.key}"]`);
                if (!item) {
                    item = document.createElement('div');
                    item.className = 'metric-item';
                    item.setAttribute('data-key', metric.key);

                    const icon = document.createElement('span');
                    icon.className = 'metric-icon';
                    icon.innerHTML = getMetricSVG(metric.icon || metric.key);

                    const label = document.createElement('span');
                    label.className = 'metric-label';
                    label.textContent = metric.label;

                    valEl = document.createElement('span');
                    valEl.className = 'metric-value';

                    item.appendChild(icon);
                    item.appendChild(label);
                    item.appendChild(valEl);
                    mWrapper.appendChild(item);
                } else {
                    valEl = item.querySelector('.metric-value');
                }
                widgetMetricElsMap.set(metricKey, valEl);
            }

            const colors = getMetricColors(metric);
            animateMetric(valEl, metricKey, metric.formatted, colors);
        });
    });
};

export const clearWidgetsCache = () => {
    widgetCardsMap.clear();
    widgetMetricElsMap.clear();
    cachedWidgetsContainer = null;
    const wc = document.getElementById('widgets-container');
    if (wc) wc.remove();
};

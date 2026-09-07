import { state, setState } from './state.js';
import { initTheme } from './components/theme.js';
import { initClock, fetchWeather } from './components/weather.js';
import { initSearch, applySearchFilter } from './components/search.js';
import { initTooltips, initMobileMenu } from './components/tooltips.js';
import { renderServices, checkUrlVisibility, createThemedLogo } from './components/services.js';
import { clearWidgetsCache } from './components/widgets.js';
import { initSSE } from './sse.js';

const headerTitle = document.getElementById('header-title');
const announcementsContainer = document.getElementById('announcements');
const buttonsContainer = document.getElementById('buttons');
const groupToggle = document.getElementById('group-toggle');
const layoutToggle = document.getElementById('layout-toggle');

const showErrorToast = (message) => {
    const toast = document.createElement('div');
    toast.className = 'announcement outage toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
};

export const updateGroupToggleButton = () => {
    if (!groupToggle) return;
    const iconFolder = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    const iconAZ = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M20 8h-5"/><path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10"/><path d="M15 14h5l-5 6h5"/></svg>`;
    const text = state.groupBy === 'category' ? 'A-Z Sort' : 'Categories';
    const svg = state.groupBy === 'category' ? iconAZ : iconFolder;
    groupToggle.innerHTML = `${svg}<span>${text}</span>`;
    groupToggle.setAttribute('data-tooltip', state.groupBy === 'category' ? 'Sort Alphabetically' : 'Group by Categories');
};

export const updateLayoutToggleButton = () => {
    if (!layoutToggle) return;
    const iconList = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
    const iconGrid = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
    const text = state.layout === 'grid' ? 'List' : 'Groups';
    const svg = state.layout === 'grid' ? iconList : iconGrid;
    layoutToggle.innerHTML = `${svg}<span>${text}</span>`;
    layoutToggle.setAttribute('data-tooltip', state.layout === 'grid' ? 'Switch to List View' : 'Switch to Groups View');

    if (state.layout === 'list') {
        document.body.classList.add('list-view');
        if (groupToggle) groupToggle.style.display = 'none';
    } else {
        document.body.classList.remove('list-view');
        if (groupToggle) groupToggle.style.display = 'flex';
    }
};

const renderHeader = (config) => {
    if (config.header && headerTitle) {
        headerTitle.textContent = config.header;
        document.title = config.header;
    }

    if (config.header_colors && config.header_colors.length >= 2) {
        document.documentElement.style.setProperty('--header-color-1', config.header_colors[0]);
        document.documentElement.style.setProperty('--header-color-2', config.header_colors[1]);
    } else {
        document.documentElement.style.removeProperty('--header-color-1');
        document.documentElement.style.removeProperty('--header-color-2');
    }
};

const renderAnnouncements = (config) => {
    if (!announcementsContainer) return;
    announcementsContainer.innerHTML = '';
    if (config.announcements && config.announcements.length > 0) {
        config.announcements.forEach(ann => {
            const el = document.createElement('div');
            el.className = `announcement ${ann.type || 'default'}`;
            el.textContent = ann.text;
            announcementsContainer.appendChild(el);
        });
    }
};

const renderButtons = (config) => {
    if (!buttonsContainer) return;
    buttonsContainer.innerHTML = '';
    if (config.buttons && config.buttons.length > 0) {
        config.buttons.forEach(btn => {
            const el = document.createElement('a');
            el.className = 'btn';
            el.href = btn.url;
            if (config.new_tabs !== false) {
                el.target = '_blank';
                el.rel = 'noopener noreferrer';
            }

            if (btn.name) {
                el.setAttribute('data-tooltip', btn.name);
            }

            const btnLight = btn.logo_light || btn.logo;
            const btnDark = btn.logo_dark || btn.logo;
            const logo = createThemedLogo(btnLight, btnDark, btn.name, 'btn-logo', 'btn-logo-wrapper', btn.icon, 'margin-right: 0.3rem;');
            if (logo) {
                el.appendChild(logo);
            } else if (btn.icon) {
                const iconSpan = document.createElement('span');
                iconSpan.style.marginRight = '0.3rem';
                iconSpan.textContent = btn.icon;
                el.appendChild(iconSpan);
            }
            const nameSpan = document.createElement('span');
            nameSpan.textContent = btn.name;
            el.appendChild(nameSpan);

            buttonsContainer.appendChild(el);
        });
    }
};

const renderFooter = (config) => {
    const footerEl = document.getElementById('footer');
    if (!footerEl) return;

    let footerText = config.footer || '';
    const versionMeta = document.querySelector('meta[name="version"]');
    const version = versionMeta && versionMeta.content !== '{{VERSION}}' ? versionMeta.content : 'dev';

    let displayVersion = version;
    if (version === 'dev') {
        displayVersion = 'vdev';
    } else if (version.includes('.')) {
        displayVersion = version.startsWith('v') ? version : `v${version}`;
    }

    if (footerText) {
        footerText += ` \u2022 [${displayVersion}](https://github.com/BuzzMoody/Simple-Dash)`;
    } else {
        footerText = `[${displayVersion}](https://github.com/BuzzMoody/Simple-Dash)`;
    }

    const parseMarkdownLinks = (text) => {
        const frag = document.createDocumentFragment();
        text = text.replace(/&copy;/gi, '\u00a9').replace(/&bull;/gi, '\u2022').replace(/&middot;/gi, '\u00b7').replace(/&mdash;/gi, '\u2014').replace(/&ndash;/gi, '\u2013');
        const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIdx = 0, match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIdx) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));
            }
            const a = document.createElement('a');
            a.href = match[2];
            a.target = '_blank';
            a.textContent = match[1];
            frag.appendChild(a);
            lastIdx = regex.lastIndex;
        }
        if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.substring(lastIdx)));
        return frag;
    };

    footerEl.innerHTML = '';
    const footerTextSpan = document.createElement('span');
    footerTextSpan.id = 'footer-text';
    footerTextSpan.style.opacity = '0.7';
    footerTextSpan.appendChild(parseMarkdownLinks(footerText));
    footerEl.appendChild(footerTextSpan);

    const changelogContainer = document.createElement('span');
    changelogContainer.id = 'changelog-container';
    changelogContainer.style.position = 'relative';
    changelogContainer.style.display = 'inline-block';
    footerEl.appendChild(changelogContainer);

    const updateIndicator = document.createElement('span');
    updateIndicator.id = 'update-indicator';
    footerEl.appendChild(updateIndicator);

    if (version !== 'dev') {
        const fetchReleases = async () => {
            try {
                const response = await fetch('/api/releases');
                if (!response.ok) return;
                const releases = await response.json();
                if (releases && releases.length > 0) {
                    const latestRelease = releases[0];
                    const currentVersionNumber = version.replace(/^v/, '');
                    const latestVersionNumber = latestRelease.tag_name.replace(/^v/, '');

                    if (latestVersionNumber !== currentVersionNumber) {
                        updateIndicator.innerHTML = '';
                        const updateA = document.createElement('a');
                        updateA.href = latestRelease.html_url;
                        updateA.target = '_blank';
                        updateA.className = 'update-indicator';
                        updateA.setAttribute('data-tooltip', `Update Available: ${displayVersion} \u2192 v${latestVersionNumber}`);
                        updateA.textContent = 'Update';
                        updateIndicator.appendChild(updateA);
                    }

                    const currentRelease = releases.find(r => r.tag_name.replace(/^v/, '') === currentVersionNumber) || latestRelease;

                    if (changelogContainer) {
                        const btn = document.createElement('button');
                        btn.className = 'changelog-btn';
                        btn.setAttribute('data-tooltip', 'Changelog');
                        btn.setAttribute('aria-label', 'Changelog');
                        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;

                        const popup = document.createElement('div');
                        popup.className = 'changelog-popup';

                        const header4 = document.createElement('h4');
                        const clSpan = document.createElement('span');
                        clSpan.textContent = 'Changelog';
                        const tagSpan = document.createElement('span');
                        tagSpan.textContent = currentRelease.tag_name;
                        header4.appendChild(clSpan);
                        header4.appendChild(document.createTextNode(' '));
                        header4.appendChild(tagSpan);
                        popup.appendChild(header4);

                        const contentWrapper = document.createElement('div');
                        contentWrapper.className = 'changelog-content-wrapper';

                        let bodyText = currentRelease.body || 'No release notes available.';
                        bodyText = bodyText.replace(/\*\*Full Changelog\*\*: .*/g, '');

                        const ul = document.createElement('ul');
                        ul.className = 'changelog-list';
                        bodyText.split('\n').forEach(line => {
                            line = line.trim();
                            if (line) {
                                let itemText = line.replace(/^[\*\-]\s+/, '');
                                const li = document.createElement('li');

                                const match = itemText.match(/\b([a-f0-9]{7,40})\b/i);
                                if (match) {
                                    const before = itemText.substring(0, match.index);
                                    const hash = match[0];
                                    const after = itemText.substring(match.index + hash.length);
                                    li.appendChild(document.createTextNode(before));
                                    const i = document.createElement('i');
                                    i.textContent = hash;
                                    li.appendChild(i);
                                    li.appendChild(document.createTextNode(after));
                                } else {
                                    li.textContent = itemText;
                                }
                                ul.appendChild(li);
                            }
                        });
                        contentWrapper.appendChild(ul);
                        popup.appendChild(contentWrapper);

                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const isVisible = popup.style.display === 'block';
                            document.querySelectorAll('.changelog-popup').forEach(p => p.style.display = 'none');
                            popup.style.display = isVisible ? 'none' : 'block';
                            if (!isVisible) {
                                const rect = popup.getBoundingClientRect();
                                if (rect.right > window.innerWidth) {
                                    popup.style.right = '0';
                                }
                            }
                        });

                        document.addEventListener('click', () => {
                            popup.style.display = 'none';
                        });

                        popup.addEventListener('click', (e) => {
                            e.stopPropagation();
                        });

                        changelogContainer.appendChild(btn);
                        changelogContainer.appendChild(popup);
                    }
                }
            } catch (e) {
                console.error("Error fetching releases:", e);
            }
        };
        fetchReleases();
    }
};

const renderDashboard = (config) => {
    renderHeader(config);
    renderAnnouncements(config);
    renderButtons(config);
    renderFooter(config);

    if (config.favicon && config.favicon.endsWith('.svg')) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = `logos/${config.favicon}`;
        link.type = 'image/svg+xml';
    }

    renderServices(config.services || []);
};

export const fetchConfig = async () => {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error(`Network error (${response.status})`);
        const data = await response.json();
        setState({ config: data });

        if (data.show_weather) {
            fetchWeather();
        }

        renderDashboard(data);
    } catch (error) {
        console.error("fetchConfig error:", error);
        setState({ config: false });
        showErrorToast('Could not fetch configuration from the server.');
    }
};

// Bootstrap the application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initClock();
    initSearch();
    initTooltips();
    initMobileMenu();

    updateGroupToggleButton();
    updateLayoutToggleButton();

    if (groupToggle) {
        groupToggle.addEventListener('click', () => {
            const nextGroup = state.groupBy === 'category' ? 'none' : 'category';
            localStorage.setItem('simpledash-groupby', nextGroup);
            setState({ groupBy: nextGroup });
            updateGroupToggleButton();
            if (state.config) {
                renderServices(state.config.services || []);
            }
        });
    }

    if (layoutToggle) {
        layoutToggle.addEventListener('click', () => {
            const nextLayout = state.layout === 'grid' ? 'list' : 'grid';
            localStorage.setItem('simpledash-layout', nextLayout);
            setState({ layout: nextLayout });
            updateLayoutToggleButton();
            if (state.config) {
                renderServices(state.config.services || []);
            }
        });
    }

    let isDesktop = window.innerWidth >= 1200;
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const nowDesktop = window.innerWidth >= 1200;
            if (nowDesktop !== isDesktop) {
                isDesktop = nowDesktop;
                if (state.layout === 'list' && state.config) {
                    renderServices(state.config.services || []);
                }
            } else {
                checkUrlVisibility();
            }
        }, 50);
    });

    fetchConfig().then(() => {
        initSSE(() => {
            clearWidgetsCache();
            fetchConfig();
        });
    });
});

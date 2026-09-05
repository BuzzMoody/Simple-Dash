import { state } from '../state.js';
import { applySearchFilter } from './search.js';

export const serviceCardsMap = new Map();

export const createThemedLogo = (lightSrc, darkSrc, altName = '', className = '', wrapperClass = null) => {
    if (lightSrc && darkSrc && lightSrc !== darkSrc) {
        const container = wrapperClass ? document.createElement('span') : document.createDocumentFragment();
        if (wrapperClass) container.className = wrapperClass;

        const imgLight = document.createElement('img');
        imgLight.src = `logos/${lightSrc}`;
        if (altName) imgLight.alt = altName;
        imgLight.loading = 'lazy';
        imgLight.className = className ? `${className} light-theme-logo` : 'light-theme-logo';
        imgLight.onerror = () => { imgLight.style.display = 'none'; };

        const imgDark = document.createElement('img');
        imgDark.src = `logos/${darkSrc}`;
        if (altName) imgDark.alt = altName;
        imgDark.loading = 'lazy';
        imgDark.className = className ? `${className} dark-theme-logo` : 'dark-theme-logo';
        imgDark.onerror = () => { imgDark.style.display = 'none'; };

        container.appendChild(imgLight);
        container.appendChild(imgDark);
        return container;
    } else if (lightSrc || darkSrc) {
        const img = document.createElement('img');
        img.src = `logos/${lightSrc || darkSrc}`;
        if (altName) img.alt = altName;
        img.loading = 'lazy';
        if (className) img.className = className;
        img.onerror = () => { img.style.display = 'none'; };
        return img;
    }
    return null;
};

export const getCategoryHue = (category) => {
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
};

export const checkUrlVisibility = () => {
    if (state.layout !== 'list') return;
    const table = document.querySelector('.list-table');
    if (!table) return;

    table.classList.remove('hide-urls');
    void table.offsetWidth;

    let isOverflowing = false;
    const descCols = table.querySelectorAll('.list-col.desc');
    for (const col of descCols) {
        if (col.scrollWidth > col.clientWidth) {
            isOverflowing = true;
            break;
        }
    }

    if (isOverflowing) {
        table.classList.add('hide-urls');
    }
};

export const createServiceCard = (service, groupKey) => {
    const config = state.config;
    const card = document.createElement('a');
    card.className = 'service-card';
    card.href = service.url;

    if (config && config.category_colors && config.category_colors.enabled) {
        const hue = getCategoryHue(groupKey);
        card.style.setProperty('--hover-color-1', `hsl(${hue}, 90%, 65%)`);
        card.style.setProperty('--hover-color-2', `hsl(${hue}, 90%, 35%)`);
        card.style.setProperty('--hover-shadow-color', `hsla(${hue}, 90%, 50%, 0.25)`);
    }
    if (config && config.new_tabs !== false) {
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
    }
    card.setAttribute('data-url', service.url);
    if (service.description) {
        card.setAttribute('data-desc', service.description);
    }

    const tooltipBox = document.createElement('div');
    tooltipBox.className = 'tooltip-box';
    if (service.description) tooltipBox.textContent = service.description;
    card.appendChild(tooltipBox);

    const shimmerBox = document.createElement('div');
    shimmerBox.className = 'shimmer-box';
    card.appendChild(shimmerBox);

    const iconContainer = document.createElement('div');
    iconContainer.className = 'service-icon';

    const sLight = service.logo_light || service.logo;
    const sDark = service.logo_dark || service.logo;
    const logo = createThemedLogo(sLight, sDark, service.name);
    if (logo) {
        iconContainer.appendChild(logo);
    } else {
        iconContainer.textContent = service.icon || '🔗';
    }

    const name = document.createElement('div');
    name.className = 'service-name';
    name.textContent = service.name;

    card.appendChild(iconContainer);
    card.appendChild(name);

    serviceCardsMap.set(service.url, card);

    if (service.pinned) {
        card.classList.add('pinned-card');
        const flare = document.createElement('div');
        flare.className = 'flare-wrapper';
        flare.innerHTML = '<div class="flare-spin"></div><div class="flare-mask"></div>';
        card.appendChild(flare);
    }

    let hoverFrame;
    card.addEventListener('mousemove', (e) => {
        if (hoverFrame) cancelAnimationFrame(hoverFrame);
        hoverFrame = requestAnimationFrame(() => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -10;
            const rotateY = ((x - centerX) / centerX) * 10;

            card.style.setProperty('--rx', `${rotateX}deg`);
            card.style.setProperty('--ry', `${rotateY}deg`);
        });
    });

    card.addEventListener('mouseleave', () => {
        if (hoverFrame) cancelAnimationFrame(hoverFrame);
        card.style.setProperty('--rx', `0deg`);
        card.style.setProperty('--ry', `0deg`);
    });

    return card;
};

export const updateCardStatus = (card, isUp, latency, dot) => {
    const config = state.config;
    const layout = state.layout;
    const targetContainer = layout === 'list' && card.querySelector('.list-col.status') ? card.querySelector('.list-col.status') : card;
    const showPing = config && config.show_ping && isUp && latency !== null;
    const showDot = isUp ? !(config && config.show_only_down) : true;

    if (!showDot && !(layout === 'list' && showPing)) {
        if (dot) { dot.remove(); dot = null; }
    } else {
        if (!dot) {
            dot = document.createElement('div');
            targetContainer.appendChild(dot);
        }
    }

    let tbox = null;
    if (layout !== 'list') {
        tbox = card.querySelector('.tooltip-box');
        const desc = card.getAttribute('data-desc') || '';
        if (tbox && !showPing) {
            if (tbox.textContent !== desc) tbox.textContent = desc;
        }
    }

    if (showPing) {
        let pingColor = '#39c55c';
        if (latency > 300) {
            pingColor = '#d64242';
        } else if (latency > 150) {
            pingColor = '#f59e0b';
        } else if (latency > 50) {
            pingColor = '#eab308';
        }

        if (layout === 'list') {
            if (dot) {
                if (dot.className !== 'status-ping') dot.className = 'status-ping';
                const pingText = latency + ' ms';
                if (dot.textContent !== pingText) dot.textContent = pingText;
                if (dot.style.color !== pingColor) dot.style.color = pingColor;
            }
        } else {
            const desc = card.getAttribute('data-desc') || '';
            if (tbox) {
                let pingSpan = tbox.querySelector('.ping-span');
                if (!pingSpan) {
                    tbox.innerHTML = '';
                    if (desc) {
                        tbox.appendChild(document.createTextNode(desc + ' \u2022 '));
                    }
                    pingSpan = document.createElement('span');
                    pingSpan.className = 'ping-span';
                    tbox.appendChild(pingSpan);
                }
                const pingText = latency + ' ms';
                if (pingSpan.textContent !== pingText) pingSpan.textContent = pingText;
                if (pingSpan.style.color !== pingColor) {
                    pingSpan.style.color = pingColor;
                    pingSpan.style.webkitTextFillColor = pingColor;
                }
            }
            if (dot && showDot) {
                dot.className = 'status-dot up';
            }
        }
    } else {
        if (dot && showDot) {
            dot.className = isUp ? 'status-dot up' : 'status-dot down';
        }
    }
};

export const updateStatusIndicators = (incomingStatus) => {
    let prev = state.previousServiceStatus;
    if (incomingStatus) {
        prev = state.serviceStatus;
        state.previousServiceStatus = state.serviceStatus;
        state.serviceStatus = incomingStatus;
    }

    setTimeout(() => {
        const changedCards = [];
        const currentStatus = state.serviceStatus || {};

        serviceCardsMap.forEach((card, configUrl) => {
            let dot = card.querySelector('.status-dot, .status-ping');
            if (currentStatus.hasOwnProperty(configUrl)) {
                let statusObj = currentStatus[configUrl];
                let isUp = false;
                let latency = null;
                if (statusObj && typeof statusObj === 'object') {
                    isUp = statusObj.is_up;
                    if ('latency' in statusObj) {
                        latency = statusObj.latency;
                    }
                }

                let prevIsUp = false;
                if (prev && prev.hasOwnProperty(configUrl)) {
                    let prevObj = prev[configUrl];
                    prevIsUp = (typeof prevObj === 'boolean') ? prevObj : (prevObj && prevObj.is_up);
                }

                if (prev && prev.hasOwnProperty(configUrl) && prevIsUp !== isUp) {
                    card.classList.remove('shimmer-up', 'shimmer-down', 'shimmer-active');
                    changedCards.push({ card, isUp });
                }

                updateCardStatus(card, isUp, latency, dot);
            }
        });

        if (changedCards.length > 0) {
            void document.body.offsetWidth;
            changedCards.forEach(({ card, isUp }) => {
                const shimmerClass = isUp ? 'shimmer-up' : 'shimmer-down';
                card.classList.add(shimmerClass, 'shimmer-active');
                setTimeout(() => card.classList.remove('shimmer-active'), 4000);
                setTimeout(() => card.classList.remove(shimmerClass), 4500);
            });
        }
    }, 10);
};

export const renderServices = (services) => {
    serviceCardsMap.clear();
    const servicesContainer = document.getElementById('services-container');
    if (!servicesContainer) return;
    servicesContainer.innerHTML = '';

    const config = state.config;
    const layout = state.layout;
    const groupBy = state.groupBy;
    const isDesktop = window.innerWidth >= 1200;

    let sortedServices = [...services].sort((a, b) => {
        if (layout === 'list') {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
        }
        return a.name.localeCompare(b.name);
    });

    if (layout === 'list') {
        const showPing = config && config.show_ping;

        const buildTable = (forceSingleCol) => {
            const table = document.createElement('div');
            table.className = `list-table simple-fade-in${forceSingleCol ? ' single-col' : ''}`;

            const createHeader = (isDesktopOnly) => {
                const headerRow = document.createElement('div');
                headerRow.className = `list-row list-header ${isDesktopOnly ? 'desktop-only-header' : ''}`;
                let html = '<div class="list-col name">Name</div><div class="list-col desc">Description</div><div class="list-col url">URL</div>';
                html += `<div class="list-col status">${showPing ? 'PING' : ''}</div>`;
                headerRow.innerHTML = html;
                return headerRow;
            };

            table.appendChild(createHeader());

            let displayServices = [];
            if (isDesktop && sortedServices.length > 1 && !forceSingleCol) {
                const totalCells = sortedServices.length + 1;
                const leftItemsCount = Math.ceil(totalCells / 2) - 1;
                const rightItemsCount = sortedServices.length - leftItemsCount;
                const maxRows = Math.max(leftItemsCount, rightItemsCount);

                for (let i = 0; i < maxRows; i++) {
                    if (i < rightItemsCount) {
                        const rightIndex = leftItemsCount + i;
                        displayServices.push({
                            service: sortedServices[rightIndex],
                            side: 'right',
                            isLast: (rightIndex === sortedServices.length - 1),
                            rowIndex: rightIndex
                        });
                    }
                    if (i < leftItemsCount) {
                        displayServices.push({
                            service: sortedServices[i],
                            side: 'left',
                            isLast: (i === leftItemsCount - 1),
                            rowIndex: i
                        });
                    }
                }
            } else {
                displayServices = sortedServices.map((s, i) => ({
                    service: s,
                    side: 'left',
                    isLast: i === sortedServices.length - 1,
                    rowIndex: i
                }));
            }

            displayServices.forEach(item => {
                const service = item.service;
                const row = document.createElement('a');
                row.className = `list-row`;
                if (item.side === 'left') row.classList.add('left-column');
                if (item.isLast) row.classList.add('last-in-column');
                row.style.setProperty('--row-index', item.rowIndex);
                row.href = service.url;
                row.setAttribute('data-url', service.url);
                serviceCardsMap.set(service.url, row);
                if (service.description) {
                    row.setAttribute('data-desc', service.description);
                }
                if (service.category) {
                    row.setAttribute('data-category', service.category);
                }
                if (config && config.new_tabs !== false) {
                    row.target = '_blank';
                    row.rel = 'noopener noreferrer';
                }

                const nameCol = document.createElement('div');
                nameCol.className = 'list-col name simple-fade-in';
                nameCol.style.animationDelay = `${item.rowIndex * 0.03}s`;
                if (item.side === 'left') {
                    nameCol.style.gridColumn = '1';
                }
                const sLight = service.logo_light || service.logo;
                const sDark = service.logo_dark || service.logo;
                const logo = createThemedLogo(sLight, sDark, '', '');
                if (logo) {
                    nameCol.appendChild(logo);
                } else {
                    const iconSpan = document.createElement('span');
                    iconSpan.style.fontSize = '1.1em';
                    iconSpan.textContent = service.icon || '🌍';
                    nameCol.appendChild(iconSpan);
                }

                nameCol.appendChild(document.createTextNode(' '));

                const nameSpan = document.createElement('span');
                nameSpan.textContent = service.name;
                nameCol.appendChild(nameSpan);

                if (service.pinned) {
                    const pinnedSpan = document.createElement('span');
                    pinnedSpan.className = 'list-pinned-star';
                    pinnedSpan.style.background = 'none';
                    pinnedSpan.style.webkitBackgroundClip = 'unset';
                    pinnedSpan.style.webkitTextFillColor = 'unset';
                    pinnedSpan.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="url(#pin-gradient)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom;"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5-1.5l1.5-4l4-4"/><line x1="9" y1="15" x2="4.5" y2="19.5"/><line x1="14.5" y1="4" x2="20" y2="9.5"/></svg>`;
                    nameCol.appendChild(pinnedSpan);
                }

                const descCol = document.createElement('div');
                descCol.className = 'list-col desc simple-fade-in';
                descCol.style.animationDelay = `${item.rowIndex * 0.03}s`;
                descCol.textContent = service.description || '';

                const urlCol = document.createElement('div');
                urlCol.className = 'list-col url simple-fade-in';
                urlCol.style.animationDelay = `${item.rowIndex * 0.03}s`;
                urlCol.textContent = service.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

                row.appendChild(nameCol);
                row.appendChild(descCol);
                row.appendChild(urlCol);

                const statusCol = document.createElement('div');
                statusCol.className = 'list-col status simple-fade-in';
                statusCol.style.animationDelay = `${item.rowIndex * 0.03}s`;
                row.appendChild(statusCol);

                table.appendChild(row);
            });

            return table;
        };

        let table = buildTable(isDesktop);
        servicesContainer.appendChild(table);

        if (isDesktop && sortedServices.length > 1) {
            if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
                table.remove();
                table = buildTable(false);
                servicesContainer.appendChild(table);
            }

            requestAnimationFrame(() => {
                let maxNameWidth = 0;
                const nameCols = table.querySelectorAll('.list-col.name');
                nameCols.forEach(col => {
                    const w = col.getBoundingClientRect().width;
                    if (w > maxNameWidth) maxNameWidth = w;
                });
                if (maxNameWidth > 0) {
                    table.style.setProperty('--name-col-width', `${Math.ceil(maxNameWidth)}px`);
                }
                checkUrlVisibility();
            });
        } else {
            requestAnimationFrame(checkUrlVisibility);
        }

        updateStatusIndicators();
        return;
    }

    const groups = {};
    let hasPinned = false;

    sortedServices.forEach(service => {
        let groupKey;
        if (service.pinned) {
            groupKey = 'Pinned';
            hasPinned = true;
        } else if (groupBy === 'category') {
            groupKey = service.category || 'Uncategorized';
        } else {
            groupKey = (service.name.charAt(0) || '#').toUpperCase();
            if (!/[A-Z]/.test(groupKey)) {
                groupKey = '#';
            }
        }

        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(service);
    });

    let sortedGroupKeys = Object.keys(groups).sort();

    if (hasPinned) {
        sortedGroupKeys = sortedGroupKeys.filter(k => k !== 'Pinned');
        sortedGroupKeys.unshift('Pinned');
    }

    let cardIndex = 0;
    const fragment = document.createDocumentFragment();

    sortedGroupKeys.forEach(key => {
        const groupEl = document.createElement('div');
        groupEl.className = 'group';
        if (key === 'Pinned') {
            groupEl.classList.add('favorites');
        }

        const titleEl = document.createElement('h2');
        titleEl.className = 'group-title stagger-in';
        titleEl.style.animationDelay = `${cardIndex * 0.03}s`;

        const titleSpan = document.createElement('span');

        if (key === 'Pinned') {
            titleSpan.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="url(#pin-gradient)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5-1.5l1.5-4l4-4"/><line x1="9" y1="15" x2="4.5" y2="19.5"/><line x1="14.5" y1="4" x2="20" y2="9.5"/></svg> <span>${key}</span>`;
        } else {
            titleSpan.textContent = key;
        }

        if (config && config.category_colors && config.category_colors.enabled) {
            const hue = getCategoryHue(key);
            const gradient = `linear-gradient(to right, hsl(${hue}, 90%, 65%), hsl(${hue}, 90%, 35%))`;
            titleEl.style.setProperty('--title-border-img', `${gradient} 1`);

            if (config.category_colors.titles) {
                titleSpan.style.color = `hsl(${hue}, 90%, 65%)`;
            }
        }

        cardIndex++;
        titleEl.appendChild(titleSpan);
        groupEl.appendChild(titleEl);

        const gridEl = document.createElement('div');
        gridEl.className = 'services-grid';

        groups[key].forEach(service => {
            const card = createServiceCard(service, key);
            card.classList.add('stagger-in');
            card.style.animationDelay = `${cardIndex * 0.03}s`;
            cardIndex++;
            gridEl.appendChild(card);
        });

        groupEl.appendChild(gridEl);
        fragment.appendChild(groupEl);
    });

    servicesContainer.appendChild(fragment);

    updateStatusIndicators();
    applySearchFilter();
};

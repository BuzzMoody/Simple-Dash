document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const groupToggle = document.getElementById('group-toggle');
    const headerTitle = document.getElementById('header-title');
    const headerDesc = document.getElementById('header-desc');
    const announcementsContainer = document.getElementById('announcements');
    const buttonsContainer = document.getElementById('buttons');
    const servicesContainer = document.getElementById('services-container');
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    let currentConfig = null;
    let currentSearchTerm = '';
    let groupBy = localStorage.getItem('dashy-groupby') || 'category'; // 'category' or 'none'
    let layout = localStorage.getItem('dashy-layout') || 'grid'; // 'grid' or 'list'
    const layoutToggle = document.getElementById('layout-toggle');

    const updateClock = () => {
        if (!headerDesc) return;
        const d = new Date();
        let h = d.getHours();
        const ampm = h >= 12 ? 'PM' : 'AM';
        if (h === 0) h = '00';
        else if (h > 12) h -= 12;
        const m = d.getMinutes().toString().padStart(2, '0');
        const s = d.getSeconds().toString().padStart(2, '0');
        const timeString = `${h}:${m}:${s} ${ampm}`;
        let descText = 'Loading...';
        if (currentConfig && currentConfig.description) {
            descText = currentConfig.description;
        } else if (currentConfig === false) {
            descText = 'Failed to load configuration.';
        }
        headerDesc.innerHTML = `${timeString} &bull; ${descText}`;
    };
    setInterval(updateClock, 1000); // 1s interval to update seconds
    updateClock();

    const moonSVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    const sunSVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

    const initTheme = () => {
        const savedTheme = localStorage.getItem('dashy-theme');
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
            themeToggle.innerHTML = sunSVG;
        } else {
            document.body.classList.add('dark-mode');
            themeToggle.innerHTML = moonSVG;
        }
    };

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('dashy-theme', isDark ? 'dark' : 'light');
        themeToggle.innerHTML = isDark ? moonSVG : sunSVG;
    });

    initTheme();

    // Grouping Toggle
    const updateGroupToggleButton = () => {
        if (!groupToggle) return;
        const iconFolder = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
        const iconAZ = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5M11 7h4M11 13h8l-8 8h8M4 15l3 3 3-3M7 4v14"/></svg>`;
        const text = groupBy === 'category' ? 'A-Z Sort' : 'Categories';
        const svg = groupBy === 'category' ? iconAZ : iconFolder;
        groupToggle.innerHTML = `${svg}<span>${text}</span>`;
        groupToggle.setAttribute('data-tooltip', groupBy === 'category' ? 'Sort Alphabetically' : 'Group by Categories');
    };
    
    updateGroupToggleButton();

    groupToggle.addEventListener('click', () => {
        groupBy = groupBy === 'category' ? 'none' : 'category';
        localStorage.setItem('dashy-groupby', groupBy);
        updateGroupToggleButton();
        if (currentConfig) {
            renderServices(currentConfig.services || []);
        }
    });

    const updateLayoutToggleButton = () => {
        if (!layoutToggle) return;
        const iconList = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
        const iconGrid = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
        const text = layout === 'grid' ? 'List' : 'Groups';
        const svg = layout === 'grid' ? iconList : iconGrid;
        layoutToggle.innerHTML = `${svg}<span>${text}</span>`;
        layoutToggle.setAttribute('data-tooltip', layout === 'grid' ? 'Switch to List View' : 'Switch to Groups View');
        
        if (layout === 'list') {
            document.body.classList.add('list-view');
            if (groupToggle) groupToggle.style.display = 'none';
        } else {
            document.body.classList.remove('list-view');
            if (groupToggle) groupToggle.style.display = 'flex';
        }
    };

    let isDesktop = window.innerWidth >= 1200;
    window.addEventListener('resize', () => {
        const nowDesktop = window.innerWidth >= 1200;
        if (nowDesktop !== isDesktop) {
            isDesktop = nowDesktop;
            if (layout === 'list' && currentConfig) {
                renderServices(currentConfig.services || []);
            }
        }
    });

    if (layoutToggle) {
        updateLayoutToggleButton();
        layoutToggle.addEventListener('click', () => {
            layout = layout === 'grid' ? 'list' : 'grid';
            localStorage.setItem('dashy-layout', layout);
            updateLayoutToggleButton();
            if (currentConfig) {
                renderServices(currentConfig.services || []);
            }
        });
    }

    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
            searchInput.focus();
        });
    }

    let searchTimeout = null;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (searchClear) {
                searchClear.style.display = e.target.value.length > 0 ? 'flex' : 'none';
            }
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearchTerm = e.target.value.toLowerCase();
                if (currentConfig) {
                    renderServices(currentConfig.services || []);
                }
            }, 150);
        });
    }

    let currentStatus = {};
    let previousStatus = null;

    let statusSource = null;

    const initStatusStream = () => {
        if (statusSource) {
            statusSource.close();
        }
        statusSource = new EventSource('/api/status/stream');

        statusSource.onopen = () => {
            document.querySelectorAll('.status-dot').forEach(dot => dot.classList.remove('disconnected'));
        };

        statusSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                updateStatusIndicators(data);
            } catch (error) {
                console.error("Error parsing SSE data", error);
            }
        };

        statusSource.onerror = (error) => {
            console.error("SSE Error:", error);
            statusSource.close();
            
            document.querySelectorAll('.status-dot').forEach(dot => dot.classList.add('disconnected'));
            
            setTimeout(initStatusStream, 5000);
        };
    };

    const updateStatusIndicators = (incomingStatus) => {
        let prev = previousStatus;
        if (incomingStatus) {
            prev = currentStatus;
            currentStatus = incomingStatus;
            previousStatus = incomingStatus;
        }
        setTimeout(() => {
            const cards = document.querySelectorAll('[data-url]');
            cards.forEach(card => {
                const configUrl = card.getAttribute('data-url');
                if (!configUrl) return;

                let dot = card.querySelector('.status-dot');
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
                        void card.offsetWidth; // trigger reflow
                        const shimmerClass = isUp ? 'shimmer-up' : 'shimmer-down';
                        card.classList.add(shimmerClass, 'shimmer-active');
                        
                        // Fade out opacity after 4s (allows 4 full 1s cycles)
                        setTimeout(() => card.classList.remove('shimmer-active'), 4000);
                        // Clean up base classes after transition finishes (4.5s)
                        setTimeout(() => card.classList.remove(shimmerClass), 4500);
                    }

                    const targetContainer = layout === 'list' && card.querySelector('.list-col.status') ? card.querySelector('.list-col.status') : card;
                    if (currentConfig && currentConfig.show_only_down) {
                        if (isUp) {
                            if (dot) dot.remove();
                        } else {
                            if (!dot) {
                                dot = document.createElement('div');
                                dot.className = 'status-dot down';
                                targetContainer.appendChild(dot);
                            } else {
                                dot.className = 'status-dot down';
                                dot.textContent = '';
                                dot.style.color = '';
                            }
                        }
                    } else {
                        if (!dot) {
                            dot = document.createElement('div');
                            targetContainer.appendChild(dot);
                        }
                        
                        if (currentConfig && currentConfig.show_ping && isUp && latency !== null) {
                            dot.className = 'status-ping';
                            dot.textContent = latency + 'ms';
                            let pingColor = '#39c55c';
                            if (latency > 300) {
                                pingColor = '#d64242';
                            } else if (latency > 150) {
                                pingColor = '#f59e0b';
                            } else if (latency > 50) {
                                pingColor = '#eab308';
                            }
                            dot.style.color = pingColor;
                        } else {
                            dot.textContent = '';
                            dot.style.color = '';
                            dot.className = isUp ? 'status-dot up' : 'status-dot down';
                        }
                    }


                }
            });
        }, 10);
    };

    const showErrorToast = (message) => {
        const toast = document.createElement('div');
        toast.className = 'announcement outage';
        toast.style.position = 'fixed';
        toast.style.top = '1rem';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.zIndex = '9999';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    };



    // Fetch config
    const fetchConfig = async () => {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error(`Network error (${response.status})`);
            const data = await response.json();
            currentConfig = data;
            renderDashboard(data);
            initStatusStream();
        } catch (error) {
            currentConfig = false;
            updateClock();
            showErrorToast('Could not fetch configuration from the server.');
        }
    };

    const renderDashboard = (config) => {
        if (config.header) {
            headerTitle.textContent = config.header;
            document.title = config.header;
        }
        updateClock();

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

        const footerEl = document.getElementById('footer');
        if (footerEl) {
            let footerHtml = config.footer || '';
            const versionMeta = document.querySelector('meta[name="version"]');
            const version = versionMeta && versionMeta.content !== '{{VERSION}}' ? versionMeta.content : 'dev';
            
            if (footerHtml) {
                footerHtml += ` &bull; <a href="https://github.com/BuzzMoody/Simple-Dash" target="_blank">${version}</a>`;
            } else {
                footerHtml = `<a href="https://github.com/BuzzMoody/Simple-Dash" target="_blank">${version}</a>`;
            }
            
            footerEl.innerHTML = `<span style="opacity: 0.7">${footerHtml}</span>`;
        }

        // Header Colors
        if (config.header_colors && config.header_colors.length >= 2) {
            document.documentElement.style.setProperty('--header-color-1', config.header_colors[0]);
            document.documentElement.style.setProperty('--header-color-2', config.header_colors[1]);
        } else {
            document.documentElement.style.removeProperty('--header-color-1');
            document.documentElement.style.removeProperty('--header-color-2');
        }

        // Announcements
        announcementsContainer.innerHTML = '';
        if (config.announcements && config.announcements.length > 0) {
            config.announcements.forEach(ann => {
                const el = document.createElement('div');
                el.className = `announcement ${ann.type || 'default'}`;
                el.textContent = ann.text;
                announcementsContainer.appendChild(el);
            });
        }

        // Buttons
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
                
                let content = '';
                const btnLight = btn.logo_light || btn.logo;
                const btnDark = btn.logo_dark || btn.logo;

                if (btnLight && btnDark && btnLight !== btnDark) {
                    content = `
                        <span class="btn-logo-wrapper">
                            <img src="logos/${btnLight}" alt="${btn.name}" class="btn-logo light-theme-logo" onerror="this.style.display='none'">
                            <img src="logos/${btnDark}" alt="${btn.name}" class="btn-logo dark-theme-logo" onerror="this.style.display='none'">
                        </span>
                    `;
                } else if (btnLight) {
                    content = `<img src="logos/${btnLight}" alt="${btn.name}" class="btn-logo" onerror="this.style.display='none'">`;
                } else if (btn.icon) {
                    content = `<span style="margin-right:0.3rem">${btn.icon}</span>`;
                }
                el.innerHTML = `${content}${btn.name}`;
                
                buttonsContainer.appendChild(el);
            });
        }

        renderServices(config.services || []);
    };

    const getCategoryHue = (category) => {
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash) % 360;
    };

    const createServiceCard = (service, groupKey) => {
        const card = document.createElement('a');
        card.className = 'service-card';
        card.href = service.url;

        if (currentConfig && currentConfig.category_colors && currentConfig.category_colors.enabled) {
            const hue = getCategoryHue(groupKey);
            card.style.setProperty('--hover-color-1', `hsl(${hue}, 90%, 65%)`);
            card.style.setProperty('--hover-color-2', `hsl(${hue}, 90%, 35%)`);
            card.style.setProperty('--hover-shadow-color', `hsla(${hue}, 90%, 50%, 0.25)`);
        }
        if (currentConfig && currentConfig.new_tabs !== false) {
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
        }
        card.setAttribute('data-url', service.url);
        // Removed data-tooltip attribute, we'll render it inside api-tooltip instead

        const shimmerBox = document.createElement('div');
        shimmerBox.className = 'shimmer-box';
        card.appendChild(shimmerBox);

        const iconContainer = document.createElement('div');
        iconContainer.className = 'service-icon';
        
        if (service.logo || service.logo_light || service.logo_dark) {
            const sLight = service.logo_light || service.logo;
            const sDark = service.logo_dark || service.logo;

            if (sLight && sDark && sLight !== sDark) {
                const imgL = document.createElement('img');
                imgL.src = `logos/${sLight}`;
                imgL.alt = service.name;
                imgL.className = 'light-theme-logo';
                imgL.onerror = () => { imgL.style.display = 'none'; };
                
                const imgD = document.createElement('img');
                imgD.src = `logos/${sDark}`;
                imgD.alt = service.name;
                imgD.className = 'dark-theme-logo';
                imgD.onerror = () => { imgD.style.display = 'none'; };
                
                
                iconContainer.appendChild(imgL);
                iconContainer.appendChild(imgD);
            } else {
                const img = document.createElement('img');
                img.src = `logos/${sLight || sDark}`;
                img.alt = service.name;
                img.onerror = () => { iconContainer.textContent = service.icon || '🔗'; };
                iconContainer.appendChild(img);
            }
        } else {
            iconContainer.textContent = service.icon || '🔗';
        }

        const name = document.createElement('div');
        name.className = 'service-name';
        name.textContent = service.name;

        card.appendChild(iconContainer);
        card.appendChild(name);

        if (service.pinned) {
            card.classList.add('pinned-card');
            const flare = document.createElement('div');
            flare.className = 'flare-wrapper';
            flare.innerHTML = '<div class="flare-spin"></div><div class="flare-mask"></div>';
            card.appendChild(flare);
        }

        if (service.description) {
            card.setAttribute('data-tooltip', service.description);
        }

        card.addEventListener('mousemove', (e) => {
            requestAnimationFrame(() => {
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
            card.style.setProperty('--rx', `0deg`);
            card.style.setProperty('--ry', `0deg`);
        });

        return card;
    };

    const renderServices = (services) => {
        servicesContainer.innerHTML = '';
        
        let filteredServices = services;
        if (currentSearchTerm) {
            filteredServices = services.filter(s => 
                s.name.toLowerCase().includes(currentSearchTerm) || 
                (s.description && s.description.toLowerCase().includes(currentSearchTerm)) ||
                (s.category && s.category.toLowerCase().includes(currentSearchTerm))
            );
        }

        if (filteredServices.length === 0 && currentSearchTerm) {
            servicesContainer.innerHTML = '<div style="text-align:center; opacity:0.6; padding: 2rem;">No services match your search.</div>';
            return;
        }

        const sortedServices = [...filteredServices].sort((a, b) => a.name.localeCompare(b.name));
        
        if (layout === 'list') {
            const table = document.createElement('div');
            const showPing = currentConfig && currentConfig.show_ping;
            const hasPingClass = showPing ? 'has-ping' : '';
            table.className = `list-table stagger-in ${hasPingClass}`;

            const createHeader = (isDesktopOnly) => {
                const headerRow = document.createElement('div');
                headerRow.className = `list-row list-header ${isDesktopOnly ? 'desktop-only-header' : ''} ${hasPingClass}`;
                let html = '<div class="list-col name">Name</div><div class="list-col desc">Description</div><div class="list-col url">URL</div>';
                if (showPing) html += '<div class="list-col status"></div>';
                headerRow.innerHTML = html;
                return headerRow;
            };

            table.appendChild(createHeader());

            let displayServices = [];
            if (isDesktop && sortedServices.length > 1) {
                const totalCells = sortedServices.length + 1; // +1 for the header
                const leftItemsCount = Math.ceil(totalCells / 2) - 1;
                const rightItemsCount = sortedServices.length - leftItemsCount;
                const maxRows = Math.max(leftItemsCount, rightItemsCount);

                for (let i = 0; i < maxRows; i++) {
                    if (i < rightItemsCount) {
                        const rightIndex = leftItemsCount + i;
                        displayServices.push({ 
                            service: sortedServices[rightIndex], 
                            side: 'right', 
                            isLast: (rightIndex === sortedServices.length - 1) 
                        });
                    }
                    if (i < leftItemsCount) {
                        displayServices.push({ 
                            service: sortedServices[i], 
                            side: 'left', 
                            isLast: (i === leftItemsCount - 1) 
                        });
                    }
                }
            } else {
                displayServices = sortedServices.map((s, i) => ({ 
                    service: s, 
                    side: 'left', 
                    isLast: i === sortedServices.length - 1 
                }));
            }

            displayServices.forEach(item => {
                const service = item.service;
                const row = document.createElement('a');
                row.className = `list-row ${hasPingClass}`;
                if (item.side === 'left') row.classList.add('left-column');
                if (item.isLast) row.classList.add('last-in-column');
                row.href = service.url;
                row.setAttribute('data-url', service.url);
                if (currentConfig && currentConfig.new_tabs !== false) {
                    row.target = '_blank';
                    row.rel = 'noopener noreferrer';
                }

                // name col
                const nameCol = document.createElement('div');
                nameCol.className = 'list-col name';
                if (item.side === 'left') {
                    nameCol.style.gridColumn = '1';
                }
                let iconHtml = '';
                if (service.logo || service.logo_light || service.logo_dark) {
                    const sLight = service.logo_light || service.logo;
                    const sDark = service.logo_dark || service.logo;
                    if (sLight && sDark && sLight !== sDark) {
                        iconHtml = `<img src="logos/${sLight}" class="light-theme-logo" loading="lazy" alt=""><img src="logos/${sDark}" class="dark-theme-logo" loading="lazy" alt="">`;
                    } else if (sLight) {
                        iconHtml = `<img src="logos/${sLight}" loading="lazy" alt="">`;
                    }
                } else if (service.icon) {
                    iconHtml = `<span style="font-size: 1.1em">${service.icon}</span>`;
                } else {
                    iconHtml = `<span style="font-size: 1.1em">🌍</span>`;
                }
                let pinnedHtml = '';
                if (service.pinned) {
                    pinnedHtml = ` <span class="list-pinned-star" style="background: none; -webkit-background-clip: unset; -webkit-text-fill-color: unset;"><svg viewBox="0 0 24 24" width="16" height="16" stroke="url(#pin-gradient)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom;"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5-1.5l1.5-4l4-4"/><line x1="9" y1="15" x2="4.5" y2="19.5"/><line x1="14.5" y1="4" x2="20" y2="9.5"/></svg></span>`;
                }
                nameCol.innerHTML = `${iconHtml} <span>${service.name}</span>${pinnedHtml}`;

                // desc col
                const descCol = document.createElement('div');
                descCol.className = 'list-col desc';
                descCol.textContent = service.description || '';

                // url col
                const urlCol = document.createElement('div');
                urlCol.className = 'list-col url';
                urlCol.textContent = service.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

                row.appendChild(nameCol);
                row.appendChild(descCol);
                row.appendChild(urlCol);
                
                if (showPing) {
                    const statusCol = document.createElement('div');
                    statusCol.className = 'list-col status';
                    row.appendChild(statusCol);
                }
                
                table.appendChild(row);
            });

            servicesContainer.appendChild(table);

            if (isDesktop && sortedServices.length > 1) {
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
                });
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
        
        // Ensure Pinned is always first
        if (hasPinned) {
            sortedGroupKeys = sortedGroupKeys.filter(k => k !== 'Pinned');
            sortedGroupKeys.unshift('Pinned');
        }

        let cardIndex = 0;

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
            titleSpan.style.display = 'inline-flex';
            titleSpan.style.alignItems = 'center';
            titleSpan.style.gap = '0.5rem';
            
            if (key === 'Pinned') {
                titleSpan.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="url(#pin-gradient)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5-1.5l1.5-4l4-4"/><line x1="9" y1="15" x2="4.5" y2="19.5"/><line x1="14.5" y1="4" x2="20" y2="9.5"/></svg> <span>${key}</span>`;
            } else {
                titleSpan.textContent = key;
            }
            
            if (currentConfig && currentConfig.category_colors && currentConfig.category_colors.enabled) {
                const hue = getCategoryHue(key);
                const gradient = `linear-gradient(to right, hsl(${hue}, 90%, 65%), hsl(${hue}, 90%, 35%))`;
                titleEl.style.setProperty('--title-border-img', `${gradient} 1`);
                
                if (currentConfig.category_colors.titles) {
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
            servicesContainer.appendChild(groupEl);
        });

        updateStatusIndicators();
    };

    fetchConfig();

    // Mobile Sidebar Logic
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

    // Global keyboard navigation and search handling
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
            return;
        }

        const isCardFocused = document.activeElement && document.activeElement.hasAttribute('data-url');
        
        if (document.activeElement === searchInput && e.key === 'ArrowDown') {
            e.preventDefault();
            const firstCard = document.querySelector('[data-url]');
            if (firstCard) firstCard.focus();
            return;
        }

        if (isCardFocused) {
            const cards = Array.from(document.querySelectorAll('[data-url]'));
            const currentIndex = cards.indexOf(document.activeElement);
            if (currentIndex === -1) return;

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentIndex + 1 < cards.length) cards[currentIndex + 1].focus();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentIndex - 1 >= 0) {
                    cards[currentIndex - 1].focus();
                } else {
                    searchInput.focus();
                }
            }
            return;
        }

        const isInputFocused = document.activeElement === searchInput;

        if (e.key === 'Escape') {
            if (searchInput && searchInput.value !== '') {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            }
            if (isInputFocused) {
                searchInput.blur();
            }
            return;
        }

        if (e.key === '/') {
            if (!isInputFocused && searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
            return;
        }

        // Capture alphanumeric typing to search box
        if (!isInputFocused && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1 && searchInput) {
            // Ignore spacebar if focused on a button or link to allow native click
            if (e.key === ' ' && (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'A')) {
                return;
            }
            searchInput.value += e.key;
            searchInput.dispatchEvent(new Event('input'));
            return;
        }

        // Capture backspace
        if (!isInputFocused && e.key === 'Backspace' && searchInput) {
            if (searchInput.value.length > 0) {
                searchInput.value = searchInput.value.slice(0, -1);
                searchInput.dispatchEvent(new Event('input'));
            }
            return;
        }

        // Grid navigation
        if (!isInputFocused) {
            const cards = Array.from(document.querySelectorAll('[data-url]')).filter(c => c.style.display !== 'none');
            if (cards.length === 0) return;

            let currentIndex = cards.indexOf(document.activeElement);

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const next = currentIndex < cards.length - 1 ? currentIndex + 1 : 0;
                cards[next].focus();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const next = currentIndex > 0 ? currentIndex - 1 : cards.length - 1;
                cards[next].focus();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentIndex === -1) {
                    cards[0].focus();
                    return;
                }

                let rowItemCount = 0;
                let firstOffsetTop = cards[0].offsetTop;
                for (let i = 0; i < cards.length; i++) {
                    if (cards[i].offsetTop === firstOffsetTop) {
                        rowItemCount++;
                    } else {
                        break;
                    }
                }

                if (e.key === 'ArrowDown') {
                    let next = currentIndex + rowItemCount;
                    if (next >= cards.length) next = cards.length - 1;
                    cards[next].focus();
                } else if (e.key === 'ArrowUp') {
                    let next = currentIndex - rowItemCount;
                    if (next < 0) next = 0;
                    cards[next].focus();
                }
            }
        }
    });

});

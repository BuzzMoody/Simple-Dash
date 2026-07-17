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

    const updateClock = () => {
        if (!headerDesc) return;
        const timeString = new Date().toLocaleTimeString([], {hour: 'numeric', minute: '2-digit', second: '2-digit'});
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
        const span = groupToggle.querySelector('span');
        if (span) {
            span.textContent = groupBy === 'category' ? 'A-Z Sort' : 'Categories';
        }
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
            const cards = document.querySelectorAll('.service-card');
            cards.forEach(card => {
                const configUrl = card.getAttribute('data-url');
                if (!configUrl) return;

                let dot = card.querySelector('.status-dot');
                if (currentStatus.hasOwnProperty(configUrl)) {
                    let statusObj = currentStatus[configUrl];
                    let isUp = false;
                    if (typeof statusObj === 'boolean') {
                        isUp = statusObj;
                    } else if (statusObj && typeof statusObj === 'object') {
                        isUp = statusObj.is_up;
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

                    if (currentConfig && currentConfig.show_only_down) {
                        if (isUp) {
                            if (dot) dot.remove();
                        } else {
                            if (!dot) {
                                dot = document.createElement('div');
                                dot.className = 'status-dot down';
                                card.appendChild(dot);
                            } else {
                                dot.className = 'status-dot down';
                            }
                        }
                    } else {
                        if (!dot) {
                            dot = document.createElement('div');
                            dot.className = isUp ? 'status-dot up' : 'status-dot down';
                            card.appendChild(dot);
                        } else {
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

        if (currentConfig && currentConfig.category_colors) {
            const hue = getCategoryHue(groupKey);
            card.style.setProperty('--hover-color', `hsl(${hue}, 90%, 60%)`);
            card.style.setProperty('--hover-hue', hue);
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

        if (service.description) {
            card.setAttribute('data-tooltip', service.description);
        }

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
        
        const groups = {};
        sortedServices.forEach(service => {
            let groupKey;
            if (groupBy === 'category') {
                groupKey = service.category || 'Uncategorized';
            } else {
                groupKey = (service.name.charAt(0) || '#').toUpperCase();
                // Group numbers and symbols together
                if (!/[A-Z]/.test(groupKey)) {
                    groupKey = '#';
                }
            }
            
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(service);
        });

        const sortedGroupKeys = Object.keys(groups).sort();

        let cardIndex = 0;

        sortedGroupKeys.forEach(key => {
            const groupEl = document.createElement('div');
            groupEl.className = 'group';

            const titleEl = document.createElement('h2');
            titleEl.className = 'group-title stagger-in';
            titleEl.style.animationDelay = `${cardIndex * 0.03}s`;
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = key;
            
            if (currentConfig && currentConfig.category_colors) {
                const hue = getCategoryHue(key);
                const gradient = `linear-gradient(to right, hsl(${hue}, 90%, 65%), hsl(${hue}, 90%, 35%))`;
                titleEl.style.setProperty('--title-border-img', `${gradient} 1`);
                
                titleSpan.style.color = `hsl(${hue}, 90%, 65%)`;
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

        const isCardFocused = document.activeElement && document.activeElement.classList.contains('service-card');
        
        if (document.activeElement === searchInput && e.key === 'ArrowDown') {
            e.preventDefault();
            const firstCard = document.querySelector('.service-card');
            if (firstCard) firstCard.focus();
            return;
        }

        if (isCardFocused) {
            const cards = Array.from(document.querySelectorAll('.service-card'));
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
            const cards = Array.from(document.querySelectorAll('.service-card')).filter(c => c.style.display !== 'none');
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

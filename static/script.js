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
    let weatherHtml = '';
    let renderedWeatherHtml = '';
    let currentSearchTerm = '';
    let serviceCardsMap = new Map();
    let widgetCardsMap = new Map();
    let widgetMetricElsMap = new Map();
    let cachedWidgetsContainer = null;

    const createThemedLogo = (lightSrc, darkSrc, altName = '', className = '', wrapperClass = null) => {
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
    let groupBy = localStorage.getItem('dashy-groupby') || 'category'; // 'category' or 'none'
    let layout = localStorage.getItem('dashy-layout') || 'grid'; // 'grid' or 'list'
    const layoutToggle = document.getElementById('layout-toggle');

    const checkUrlVisibility = () => {
        if (layout !== 'list') return;
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

    let isDesktop = window.innerWidth >= 1200;
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const nowDesktop = window.innerWidth >= 1200;
            if (nowDesktop !== isDesktop) {
                isDesktop = nowDesktop;
                if (layout === 'list' && currentConfig) {
                    renderServices(currentConfig.services || []);
                }
            } else {
                checkUrlVisibility();
            }
        }, 50);
    });

    const clockTime = document.getElementById('clock-time');
    const clockDesc = document.getElementById('clock-desc');
    let lastDesc = '';
    
    const getWeatherSVG = (code, isDay) => {
        const anim = (currentConfig && currentConfig.weather_animate !== false) ? ' animated' : '';
        
        const sun = `<svg class="weather-icon sun${anim}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5" class="sun-core"></circle><g class="sun-rays"><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></g></svg>`;
        
        const moon = `<svg class="weather-icon moon${anim}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" class="moon-core"></path></svg>`;
        
        const partlyCloudyDay = `<svg class="weather-icon partly-cloudy-day${anim}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g class="sun-rays"><circle cx="12" cy="12" r="4" class="sun-core"></circle><path d="M12 2v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="M2 12h2"></path><path d="m4.93 19.07 1.41-1.41"></path><path d="M20 12h2"></path><path d="m19.07 4.93-1.41 1.41"></path></g><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" class="cloud-path"></path></svg>`;
        
        const partlyCloudyNight = `<svg class="weather-icon partly-cloudy-night${anim}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.1 3.1C8 4.2 6.5 6.3 6.5 9c0 3.6 2.9 6.5 6.5 6.5.9 0 1.8-.2 2.6-.5" class="moon-core"></path><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" class="cloud-path"></path></svg>`;

        const fog = `<svg class="weather-icon fog${anim}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" class="cloud-path"></path><path d="M16 17H7" class="fog-1"></path><path d="M17 21H9" class="fog-2"></path></svg>`;
        
        const cloud = `<svg class="weather-icon cloud${anim}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9.9 4.5 4.5 0 0 1 1.79 8.9z" class="cloud-path"></path></svg>`;
        
        const rain = `<svg class="weather-icon rain${anim}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g class="rain-drops"><path d="M8 19v2" class="drop-1"></path><path d="M12 19v2" class="drop-2"></path><path d="M16 19v2" class="drop-3"></path></g><path d="M16.5 16H9a7 7 0 1 1 6.71-9.9 4.5 4.5 0 0 1 1.79 8.9z" class="cloud-path"></path></svg>`;
        
        const snow = `<svg class="weather-icon snow${anim}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g class="snow-flakes"><path d="M8 16h.01" class="flake-1"></path><path d="M8 20h.01" class="flake-2"></path><path d="M12 18h.01" class="flake-3"></path><path d="M12 22h.01" class="flake-4"></path><path d="M16 16h.01" class="flake-5"></path><path d="M16 20h.01" class="flake-6"></path></g><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" class="cloud-path"></path></svg>`;
        
        const storm = `<svg class="weather-icon storm${anim}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 11 9 17 15 17 11 23" class="lightning-bolt"></polyline><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" class="cloud-path"></path></svg>`;

        const day = (isDay !== 0 && isDay !== false); 

        if (code <= 1) return day ? sun : moon;
        if (code === 2) return day ? partlyCloudyDay : partlyCloudyNight;
        if (code === 3) return cloud;
        if (code <= 48) return fog;
        if (code <= 67 || (code >= 80 && code <= 82)) return rain;
        if (code <= 77 || (code >= 85 && code <= 86)) return snow;
        if (code >= 95) return storm;
        return cloud;
    };

    const fetchWeather = async () => {
        const cached = localStorage.getItem('dashy-weather');
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < 30 * 60 * 1000) {
                    weatherHtml = ` <span id="clock-sep">&bull;</span> <span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;margin-top:-2px;">${data.temp}&deg; ${getWeatherSVG(data.code, data.isDay)}</span>`;
                    updateClock();
                    return;
                }
            } catch (e) {}
        }

        const getWeatherFromCoords = async (lat, lon) => {
            try {
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                if (!response.ok) return;
                const data = await response.json();
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                const isDay = data.current_weather.is_day;
                
                localStorage.setItem('dashy-weather', JSON.stringify({ temp, code, isDay, timestamp: Date.now() }));
                weatherHtml = ` <span id="clock-sep">&bull;</span> <span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;margin-top:-2px;">${temp}&deg; ${getWeatherSVG(code, isDay)}</span>`;
                updateClock();
            } catch (error) {
                console.error("Error fetching weather:", error);
            }
        };

        if (currentConfig.weather_coords && typeof currentConfig.weather_coords === 'string') {
            const parts = currentConfig.weather_coords.split(',');
            if (parts.length === 2) {
                const lat = parseFloat(parts[0].trim());
                const lon = parseFloat(parts[1].trim());
                if (!isNaN(lat) && !isNaN(lon)) {
                    getWeatherFromCoords(lat, lon);
                    return;
                }
            }
        }

        try {
            const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
            const data = await res.json();
            if (data.latitude && data.longitude) {
                getWeatherFromCoords(data.latitude, data.longitude);
            }
        } catch (e) {
            console.error("IP geolocation fallback failed:", e);
        }
    };
    
    const updateClock = () => {
        if (!clockTime) return;
        const d = new Date();
        let h = d.getHours();
        const ampm = h >= 12 ? 'PM' : 'AM';
        if (h === 0) h = 12;
        else if (h > 12) h -= 12;
        const m = d.getMinutes().toString().padStart(2, '0');
        const s = d.getSeconds().toString().padStart(2, '0');
        const timeString = `${h}:${m}:${s} ${ampm}`;
        
        if (clockTime.textContent !== timeString) {
            clockTime.textContent = timeString;
        }

        const weatherContainer = document.getElementById('weather-container');
        if (clockDesc) {
            let descText = 'Loading...';
            if (currentConfig && currentConfig.description) {
                descText = currentConfig.description;
            } else if (currentConfig === false) {
                descText = 'Failed to load configuration.';
            }
            
            if (descText !== lastDesc) {
                clockDesc.textContent = descText;
                lastDesc = descText;
            }
        }
        
        if (weatherContainer) {
            if (currentConfig && currentConfig.show_weather && weatherHtml) {
                if (renderedWeatherHtml !== weatherHtml) {
                    weatherContainer.innerHTML = weatherHtml;
                    renderedWeatherHtml = weatherHtml;
                }
            } else {
                if (renderedWeatherHtml !== '') {
                    weatherContainer.innerHTML = '';
                    renderedWeatherHtml = '';
                }
            }
        }
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
            themeToggle.setAttribute('data-tooltip', 'Switch to Dark Mode');
            themeToggle.setAttribute('aria-label', 'Switch to Dark Mode');
        } else {
            document.body.classList.add('dark-mode');
            themeToggle.innerHTML = moonSVG;
            themeToggle.setAttribute('data-tooltip', 'Switch to Light Mode');
            themeToggle.setAttribute('aria-label', 'Switch to Light Mode');
        }
    };

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('dashy-theme', isDark ? 'dark' : 'light');
        themeToggle.innerHTML = isDark ? moonSVG : sunSVG;
        themeToggle.setAttribute('data-tooltip', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        themeToggle.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        refreshTooltipLogos();
    });

    const findMatchingService = (name) => {
        if (!name || !currentConfig || !currentConfig.services) return null;
        const target = name.trim().toLowerCase();
        return currentConfig.services.find(s => s.name && s.name.trim().toLowerCase() === target) || null;
    };

    const updateTooltipContent = (tooltipEl, name) => {
        if (!tooltipEl || !name) return;
        tooltipEl.setAttribute('data-name', name);
        tooltipEl.innerHTML = '';

        const matchedService = findMatchingService(name);
        if (matchedService) {
            const isDark = document.body.classList.contains('dark-mode');
            let logoSrc = null;
            if (isDark && matchedService.logo_dark) {
                logoSrc = matchedService.logo_dark;
            } else if (!isDark && matchedService.logo_light) {
                logoSrc = matchedService.logo_light;
            } else if (matchedService.logo) {
                logoSrc = matchedService.logo;
            }

            if (logoSrc) {
                const img = document.createElement('img');
                img.className = 'tooltip-logo';
                img.src = '/logos/' + encodeURIComponent(logoSrc);
                img.alt = '';
                tooltipEl.appendChild(img);
            } else if (matchedService.icon) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'tooltip-icon';
                iconSpan.textContent = matchedService.icon;
                tooltipEl.appendChild(iconSpan);
            }
        }

        const textSpan = document.createElement('span');
        textSpan.textContent = name;
        tooltipEl.appendChild(textSpan);
    };

    const refreshTooltipLogos = () => {
        document.querySelectorAll('.widget-card').forEach(wCard => {
            const tooltipBox = wCard.querySelector('.tooltip-box');
            if (tooltipBox && tooltipBox.getAttribute('data-name')) {
                updateTooltipContent(tooltipBox, tooltipBox.getAttribute('data-name'));
            }
        });
    };

    initTheme();

    // Grouping Toggle
    const updateGroupToggleButton = () => {
        if (!groupToggle) return;
        const iconFolder = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
        const iconAZ = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M20 8h-5"/><path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10"/><path d="M15 14h5l-5 6h5"/></svg>`;
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
                if (currentConfig && typeof window.applySearchFilter === 'function') {
                    window.applySearchFilter();
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
                if (data.services !== undefined) {
                    updateStatusIndicators(data.services);
                    if (data.widgets) {
                        renderStandaloneWidgets(data.widgets);
                    }
                } else {
                    updateStatusIndicators(data);
                }
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

    const getWidgetsContainer = () => {
        if (cachedWidgetsContainer) return cachedWidgetsContainer;
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

    const getMetricIcon = (key) => {
        const k = key.toLowerCase();
        const svgWrap = (paths) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
        
        if (k.includes('running')) return svgWrap(`<rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect><polygon points="10 9 15 12 10 15 10 9"></polygon>`);
        if (k.includes('stopped')) return svgWrap(`<rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect><rect x="10" y="10" width="4" height="4"></rect>`);
        if (k.includes('active')) return svgWrap(`<polygon points="5 3 19 12 5 21 5 3"></polygon>`);
        if (k.includes('quer') || k.includes('client')) return svgWrap(`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>`);
        if (k.includes('blocked')) return svgWrap(`<circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>`);
        if (k.includes('percent')) return svgWrap(`<line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line>`);
        if (k.includes('state')) return svgWrap(`<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>`);
        if (k.includes('cpu')) return svgWrap(`<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>`);
        if (k.includes('ram')) return svgWrap(`<line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line><path d="M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"></path>`);
        if (k.includes('down')) return svgWrap(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>`);
        if (k.includes('up')) return svgWrap(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>`);
        if (k.includes('ping')) return svgWrap(`<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>`);
        if (k.includes('total') || k.includes('node') || k.includes('vm') || k.includes('lxc')) return svgWrap(`<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>`);
        if (k.includes('torrent')) return svgWrap(`<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>`);
        return svgWrap(`<circle cx="12" cy="12" r="4"></circle>`);
    };
    const getWidgetMetricColours = (key, value) => {
        if (key === 'CPU' || key === 'RAM' || key === 'Percent') {
            let v = parseFloat(value);
            if (v > 90) return { base: '#d64242', flash: '#eaa0a0' };
            if (v > 75) return { base: '#f59e0b', flash: '#face85' };
            if (v > 60) return { base: '#eab308', flash: '#f4d983' };
            return { base: '#39c55c', flash: '#9ce2ad' };
        }
        
        if (key === 'Ping') {
            let v = parseFloat(value);
            if (v > 300) return { base: '#d64242', flash: '#eaa0a0' };
            if (v > 150) return { base: '#f59e0b', flash: '#face85' };
            if (v > 50) return { base: '#eab308', flash: '#f4d983' };
            return { base: '#39c55c', flash: '#9ce2ad' };
        }

        if (key === 'Stopped' || key === 'Missing' || key === 'Blocked') {
            let v = parseFloat(value);
            if (v > 0) return { base: '#d64242', flash: '#eaa0a0' };
            return null;
        }
        
        if (key === 'Running') {
            return { base: '#39c55c', flash: '#9ce2ad' };
        }
        
        return null;
    };

    const updateSlotGeneric = (el, id, formattedStr, isFirstLoad) => {
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
                    for(let j=0; j<=9; j++) chars += `<div class="slot-char">${j}</div>`;
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

    const animateMetric = (el, id, targetStr, colors) => {
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

    const standaloneWidgetElsMap = new Map();

    const renderStandaloneWidgets = (widgetsData) => {
        const wContainer = getWidgetsContainer();
        if (!wContainer || !currentConfig || !currentConfig.widgets) return;

        currentConfig.widgets.forEach(wConfig => {
            if (!wConfig.id) return;
            const wId = wConfig.id;
            const widgetData = widgetsData[wId];
            if (!widgetData) return;

            let wCard = standaloneWidgetElsMap.get(wId);
            if (!wCard) {
                wCard = document.getElementById(wId);
                if (!wCard) {
                    wCard = document.createElement('div');
                    wCard.id = wId;
                    wCard.className = 'widget-card stagger-in standalone-widget-card';

                    const tooltipBox = document.createElement('div');
                    tooltipBox.className = 'tooltip-box';
                    updateTooltipContent(tooltipBox, wConfig.name || 'Widget');
                    wCard.appendChild(tooltipBox);

                    const metricsWrapper = document.createElement('div');
                    metricsWrapper.className = 'widget-metrics';
                    wCard.appendChild(metricsWrapper);

                    wContainer.appendChild(wCard);
                }
                standaloneWidgetElsMap.set(wId, wCard);
            }

            const mWrapper = wCard.querySelector('.widget-metrics');
            const metricOrder = ['active', 'state', 'cpu', 'ram', 'ping', 'total', 'running', 'stopped', 'missing', 'torrents', 'download', 'down', 'upload', 'up', 'streams', 'clients', 'queries', 'blocked', 'percentage'];
            const entries = Object.entries(widgetData).sort((a, b) => {
                let idxA = metricOrder.indexOf(a[0].toLowerCase());
                let idxB = metricOrder.indexOf(b[0].toLowerCase());
                if (idxA === -1) idxA = 999;
                if (idxB === -1) idxB = 999;
                if (idxA === 999 && idxB === 999) return a[0].localeCompare(b[0]);
                return idxA - idxB;
            });

            for (const [key, value] of entries) {
                const metricKey = wId + '-' + key.replace(/[^a-z0-9]/gi, '-');
                let valEl = widgetMetricElsMap.get(metricKey);

                if (!valEl) {
                    let item = mWrapper.querySelector(`.metric-item[data-key="${key}"]`);
                    if (!item) {
                        item = document.createElement('div');
                        item.className = 'metric-item';
                        item.setAttribute('data-key', key);

                        const icon = document.createElement('span');
                        icon.className = 'metric-icon';
                        icon.innerHTML = getMetricIcon(key);

                        const label = document.createElement('span');
                        label.className = 'metric-label';
                        const lowerKey = key.toLowerCase();
                        if (lowerKey !== 'down' && lowerKey !== 'up') {
                            label.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        }

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

                const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
                const colors = getWidgetMetricColours(key, value);
                animateMetric(valEl, metricKey, String(displayValue), colors);
            }
        });
    };

    const updateCardStatus = (card, isUp, latency, dot) => {
        const targetContainer = layout === 'list' && card.querySelector('.list-col.status') ? card.querySelector('.list-col.status') : card;
        const showPing = currentConfig && currentConfig.show_ping && isUp && latency !== null;
        const showDot = isUp ? !(currentConfig && currentConfig.show_only_down) : true;
        
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

    const updateWidgetMetrics = (configUrl, card, widgetData) => {
        let wContainer = getWidgetsContainer();
        if (!wContainer) return;

        let wCard = widgetCardsMap.get(configUrl);
        let wId = 'widget-' + configUrl.replace(/[^a-z0-9]/gi, '-');

        if (!wCard) {
            wCard = document.getElementById(wId);
            if (!wCard) {
                wCard = document.createElement('div');
                wCard.id = wId;
                wCard.className = 'widget-card stagger-in';
                
                const serviceName = card.querySelector('.service-name')?.textContent || 'Service';
                
                const tooltipBox = document.createElement('div');
                tooltipBox.className = 'tooltip-box';
                updateTooltipContent(tooltipBox, serviceName);
                wCard.appendChild(tooltipBox);
                
                const metricsWrapper = document.createElement('div');
                metricsWrapper.className = 'widget-metrics';
                wCard.appendChild(metricsWrapper);
                
                wContainer.appendChild(wCard);
            }
            widgetCardsMap.set(configUrl, wCard);
        }
        
        const mWrapper = wCard.querySelector('.widget-metrics');
        
        const metricOrder = ['active', 'state', 'cpu', 'ram', 'ping', 'total', 'running', 'stopped', 'missing', 'torrents', 'download', 'down', 'upload', 'up', 'streams', 'clients', 'queries', 'blocked', 'percentage'];
        const entries = Object.entries(widgetData).sort((a, b) => {
            let idxA = metricOrder.indexOf(a[0].toLowerCase());
            let idxB = metricOrder.indexOf(b[0].toLowerCase());
            if (idxA === -1) idxA = 999;
            if (idxB === -1) idxB = 999;
            if (idxA === 999 && idxB === 999) return a[0].localeCompare(b[0]);
            return idxA - idxB;
        });

        for (const [key, value] of entries) {
            const metricKey = wId + '-' + key.replace(/[^a-z0-9]/gi, '-');
            let valEl = widgetMetricElsMap.get(metricKey);

            if (!valEl) {
                let item = mWrapper.querySelector(`.metric-item[data-key="${key}"]`);
                if (!item) {
                    item = document.createElement('div');
                    item.className = 'metric-item';
                    item.setAttribute('data-key', key);
                    
                    const icon = document.createElement('span');
                    icon.className = 'metric-icon';
                    icon.innerHTML = getMetricIcon(key);
                    
                    const label = document.createElement('span');
                    label.className = 'metric-label';
                    const lowerKey = key.toLowerCase();
                    if (lowerKey !== 'down' && lowerKey !== 'up') {
                        label.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    }
                    
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

            const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
            const colors = getWidgetMetricColours(key, value);
            animateMetric(valEl, metricKey, String(displayValue), colors);
        }
    };

    const updateStatusIndicators = (incomingStatus) => {
        let prev = previousStatus;
        if (incomingStatus) {
            prev = currentStatus;
            currentStatus = incomingStatus;
            previousStatus = incomingStatus;
        }
        setTimeout(() => {
            const changedCards = [];
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

                    let widgetData = null;
                    if (statusObj && typeof statusObj === 'object') {
                        widgetData = statusObj.widget_data;
                    }
                    
                    if (widgetData) {
                        updateWidgetMetrics(configUrl, card, widgetData);
                    }
                }
            });
            
            if (changedCards.length > 0) {
                void document.body.offsetWidth; // single reflow
                changedCards.forEach(({card, isUp}) => {
                    const shimmerClass = isUp ? 'shimmer-up' : 'shimmer-down';
                    card.classList.add(shimmerClass, 'shimmer-active');
                    setTimeout(() => card.classList.remove('shimmer-active'), 4000);
                    setTimeout(() => card.classList.remove(shimmerClass), 4500);
                });
            }
        }, 10);
    };
    const showErrorToast = (message) => {
        const toast = document.createElement('div');
        toast.className = 'announcement outage toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    };

    let weatherInterval = null;

    // Fetch config
    const fetchConfig = async () => {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error(`Network error (${response.status})`);
            const data = await response.json();
            currentConfig = data;
            if (currentConfig.show_weather) {
                fetchWeather();
                if (!weatherInterval) {
                    weatherInterval = setInterval(fetchWeather, 30 * 60 * 1000);
                }
            } else if (weatherInterval) {
                clearInterval(weatherInterval);
                weatherInterval = null;
            }
            renderDashboard(data);
            initStatusStream();
        } catch (error) {
            console.error("fetchConfig error:", error);
            currentConfig = false;
            updateClock();
            showErrorToast('Could not fetch configuration from the server.');
        }
    };


    const renderHeader = (config) => {
        if (config.header) {
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

    const renderDashboard = (config) => {
        renderHeader(config);
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
                                        
                                        // Simple regex to find commit hashes and wrap them in <i> safely
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
                                        // Update tooltip bounds to avoid being offscreen
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
        }



        renderAnnouncements(config);

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
                
                if (btn.name) {
                    el.setAttribute('data-tooltip', btn.name);
                }
                
                el.innerHTML = '';
                const btnLight = btn.logo_light || btn.logo;
                const btnDark = btn.logo_dark || btn.logo;

                const logo = createThemedLogo(btnLight, btnDark, btn.name, 'btn-logo', 'btn-logo-wrapper');
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

    const renderServices = (services) => {
        serviceCardsMap.clear();
        widgetCardsMap.clear();
        widgetMetricElsMap.clear();
        cachedWidgetsContainer = null;
        servicesContainer.innerHTML = '';
        
        let sortedServices = [...services].sort((a, b) => {
            if (layout === 'list') {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
            }
            return a.name.localeCompare(b.name);
        });
        
        if (layout === 'list') {
            const showPing = currentConfig && currentConfig.show_ping;
            
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
                if (currentConfig && currentConfig.new_tabs !== false) {
                    row.target = '_blank';
                    row.rel = 'noopener noreferrer';
                }

                // name col
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
                
                // Add space before name
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

                // desc col
                const descCol = document.createElement('div');
                descCol.className = 'list-col desc simple-fade-in';
                descCol.style.animationDelay = `${item.rowIndex * 0.03}s`;
                descCol.textContent = service.description || '';

                // url col
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
            // Check if 1-column layout causes vertical overflow on the page
            if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
                table.remove();
                table = buildTable(false); // Rebuild as 2-column fallback
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
        
        // Ensure Pinned is always first
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
            fragment.appendChild(groupEl);
        });

        servicesContainer.appendChild(fragment);

        updateStatusIndicators();
        if (typeof window.applySearchFilter === 'function') {
            window.applySearchFilter();
        }
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
            e.preventDefault();
            searchInput.focus();
            searchInput.value += e.key;
            searchInput.dispatchEvent(new Event('input'));
            return;
        }

        // Capture backspace
        if (!isInputFocused && e.key === 'Backspace' && searchInput) {
            e.preventDefault();
            searchInput.focus();
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


    window.applySearchFilter = () => {
        const term = currentSearchTerm;
        let visibleCount = 0;
        
        document.querySelectorAll('.service-card, .list-row:not(.list-header)').forEach(card => {
            const desc = card.getAttribute('data-desc') || '';
            const nameEl = card.querySelector('.service-name, .list-col.name');
            const text = ((nameEl ? nameEl.textContent : card.textContent) + ' ' + desc).toLowerCase();
            
            let category = (card.getAttribute('data-category') || '').toLowerCase();
            const group = card.closest('.group');
            if (group && !category) {
                const titleSpan = group.querySelector('.group-title span');
                if (titleSpan) category = titleSpan.textContent.toLowerCase();
            }
            
            if (!term || text.includes(term) || category.includes(term)) {
                if (card.classList.contains('search-hidden') || card.style.display === 'none') {
                    card.style.display = '';
                    card.classList.remove('search-hidden');
                    
                    if (card.classList.contains('list-row')) {
                        Array.from(card.children).forEach(child => {
                            child.style.animation = 'none';
                            void child.offsetWidth;
                            child.style.animation = 'simple-fade-in 0.3s forwards';
                        });
                    } else {
                        card.style.animation = 'none';
                        void card.offsetWidth;
                        card.style.animation = 'simple-fade-in 0.3s forwards';
                    }
                }
                visibleCount++;
            } else {
                if (!card.classList.contains('search-hidden')) {
                    if (card.classList.contains('list-row')) {
                        Array.from(card.children).forEach(child => {
                            child.style.animation = 'fade-out-shrink 0.3s forwards';
                        });
                    } else {
                        card.style.animation = 'fade-out-shrink 0.3s forwards';
                    }
                    card.classList.add('search-hidden');
                    setTimeout(() => {
                        if (card.classList.contains('search-hidden')) {
                            card.style.display = 'none';
                        }
                    }, 300);
                }
            }
        });
        
        if (layout === 'list') {
            const evaluateLayout = (isDelayed) => {
                if (window.innerWidth < 1200) return;
                const table = document.querySelector('.list-table');
                if (!table) return;
                
                table.classList.add('single-col');
                if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
                    table.classList.remove('single-col');
                    
                    if (isDelayed) {
                        const visibleRows = Array.from(table.querySelectorAll('.list-row:not(.list-header)')).filter(row => row.style.display !== 'none' && !row.classList.contains('search-hidden'));
                        visibleRows.sort((a, b) => {
                            const indexA = parseInt(a.style.getPropertyValue('--row-index') || 0);
                            const indexB = parseInt(b.style.getPropertyValue('--row-index') || 0);
                            return indexA - indexB;
                        });
                        
                        const hasHeader = table.querySelector('.list-header') ? 1 : 0;
                        const totalCells = visibleRows.length + hasHeader;
                        const leftItemsCount = Math.max(0, Math.ceil(totalCells / 2) - hasHeader);
                        const rightItemsCount = visibleRows.length - leftItemsCount;
                        const maxRows = Math.max(leftItemsCount, rightItemsCount);
                        
                        visibleRows.forEach(row => row.classList.remove('left-column', 'last-in-column'));
                        
                        for (let i = 0; i < leftItemsCount; i++) {
                            visibleRows[i].classList.add('left-column');
                            if (i === leftItemsCount - 1) visibleRows[i].classList.add('last-in-column');
                        }
                        for (let i = 0; i < rightItemsCount; i++) {
                            const rightIndex = leftItemsCount + i;
                            if (i === rightItemsCount - 1) visibleRows[rightIndex].classList.add('last-in-column');
                        }
                        
                        const interleaved = [];
                        for (let i = 0; i < maxRows; i++) {
                            if (i < rightItemsCount) interleaved.push(visibleRows[leftItemsCount + i]);
                            if (i < leftItemsCount) interleaved.push(visibleRows[i]);
                        }
                        
                        interleaved.forEach(row => {
                            Array.from(row.children).forEach(child => {
                                if (child.style.animation.includes('simple-fade-in')) {
                                    child.style.animation = 'none';
                                }
                            });
                            table.appendChild(row);
                        });
                    }
                }
                if (typeof checkUrlVisibility === 'function') checkUrlVisibility();
            };
            evaluateLayout(false);
            clearTimeout(window.listLayoutTimeout);
            window.listLayoutTimeout = setTimeout(() => evaluateLayout(true), 320);
        }
        
        document.querySelectorAll('.group').forEach(group => {
            const visibleCards = Array.from(group.querySelectorAll('.service-card')).filter(c => !c.classList.contains('search-hidden'));
            if (visibleCards.length > 0 || !term) {
                if (group.classList.contains('search-hidden') || group.style.display === 'none') {
                    group.style.display = '';
                    group.classList.remove('search-hidden');
                    group.style.animation = 'none';
                    void group.offsetWidth;
                    group.style.animation = 'simple-fade-in 0.3s forwards';
                }
            } else {
                if (!group.classList.contains('search-hidden')) {
                    group.style.animation = 'fade-out-shrink 0.3s forwards';
                    group.classList.add('search-hidden');
                    setTimeout(() => {
                        if (group.classList.contains('search-hidden')) {
                            group.style.display = 'none';
                        }
                    }, 300);
                }
            }
        });

        let noRes = document.getElementById('no-results-msg');
        if (visibleCount === 0 && term) {
            if (!noRes) {
                noRes = document.createElement('div');
                noRes.id = 'no-results-msg';
                noRes.innerHTML = `
                    <div class="empty-state-icon">
                        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="2" width="18" height="20" rx="2" ry="2"></rect>
                            <line x1="3" y1="8" x2="21" y2="8"></line>
                            <line x1="3" y1="15" x2="21" y2="15"></line>
                            <circle cx="7" cy="5" r="1"></circle>
                            <line x1="11" y1="5" x2="17" y2="5"></line>
                            <circle cx="7" cy="11.5" r="1"></circle>
                            <line x1="11" y1="11.5" x2="17" y2="11.5"></line>
                            <circle cx="7" cy="18" r="1"></circle>
                            <line x1="11" y1="18" x2="17" y2="18"></line>
                        </svg>
                    </div>
                    <div class="empty-state-text">No services match your search</div>
                `;
                servicesContainer.appendChild(noRes);
            }
            noRes.style.display = 'flex';
        } else if (noRes) {
            noRes.style.display = 'none';
        }
    };

    const updateTooltipBounds = (target) => {
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

    const updateAllTooltips = () => {
        document.querySelectorAll('[data-tooltip], .service-card').forEach(updateTooltipBounds);
    };

    let tooltipTimeout;
    const debouncedUpdateTooltips = () => {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = setTimeout(updateAllTooltips, 50);
    };

    window.addEventListener('resize', debouncedUpdateTooltips, { passive: true });
    new MutationObserver(debouncedUpdateTooltips).observe(document.body, { childList: true, subtree: true });

    // Fallbacks for immediate interaction
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
});

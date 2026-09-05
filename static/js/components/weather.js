import { state } from '../state.js';

export const getWeatherSVG = (code, isDay) => {
    const config = state.config;
    const anim = (config && config.weather_animate !== false) ? ' animated' : '';

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

let weatherHtml = '';
let renderedWeatherHtml = '';
let lastDesc = '';

export const fetchWeather = async () => {
    const config = state.config;
    if (!config || !config.show_weather) return;

    const cached = localStorage.getItem('simpledash-weather');
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

            localStorage.setItem('simpledash-weather', JSON.stringify({ temp, code, isDay, timestamp: Date.now() }));
            weatherHtml = ` <span id="clock-sep">&bull;</span> <span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;margin-top:-2px;">${temp}&deg; ${getWeatherSVG(code, isDay)}</span>`;
            updateClock();
        } catch (error) {
            console.error("Error fetching weather:", error);
        }
    };

    if (config.weather_coords && typeof config.weather_coords === 'string') {
        const parts = config.weather_coords.split(',');
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

export const updateClock = () => {
    const clockTime = document.getElementById('clock-time');
    const clockDesc = document.getElementById('clock-desc');
    const weatherContainer = document.getElementById('weather-container');
    const config = state.config;

    if (clockTime) {
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
    }

    if (clockDesc) {
        let descText = 'Loading...';
        if (config && config.description) {
            descText = config.description;
        } else if (config === false) {
            descText = 'Failed to load configuration.';
        }

        if (descText !== lastDesc) {
            clockDesc.textContent = descText;
            lastDesc = descText;
        }
    }

    if (weatherContainer) {
        if (config && config.show_weather && weatherHtml) {
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

let clockInterval = null;
let weatherPollInterval = null;

export const initClock = () => {
    updateClock();
    if (!clockInterval) {
        clockInterval = setInterval(updateClock, 1000);
    }
    if (!weatherPollInterval) {
        weatherPollInterval = setInterval(fetchWeather, 30 * 60 * 1000);
    }
};

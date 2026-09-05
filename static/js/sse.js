import { updateStatusIndicators } from './components/services.js';
import { renderWidgets } from './components/widgets.js';

let statusSource = null;

export const initSSE = (onConfigReload) => {
    if (statusSource) {
        statusSource.close();
    }
    statusSource = new EventSource('/api/status/stream');

    statusSource.onopen = () => {
        document.querySelectorAll('.status-dot').forEach(dot => dot.classList.remove('disconnected'));
    };

    statusSource.addEventListener('init', (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.services) updateStatusIndicators(data.services);
            if (data.widgets) renderWidgets(data.widgets);
        } catch (e) {
            console.error("SSE init parse error:", e);
        }
    });

    statusSource.addEventListener('services', (event) => {
        try {
            const services = JSON.parse(event.data);
            updateStatusIndicators(services);
        } catch (e) {
            console.error("SSE services parse error:", e);
        }
    });

    statusSource.addEventListener('widgets', (event) => {
        try {
            const widgets = JSON.parse(event.data);
            renderWidgets(widgets);
        } catch (e) {
            console.error("SSE widgets parse error:", e);
        }
    });

    statusSource.addEventListener('config_reload', () => {
        if (typeof onConfigReload === 'function') {
            onConfigReload();
        }
    });

    // Fallback for standard message events
    statusSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'config_reload') {
                if (typeof onConfigReload === 'function') onConfigReload();
                return;
            }
            if (data.services !== undefined) {
                updateStatusIndicators(data.services);
                if (data.widgets) renderWidgets(data.widgets);
            } else {
                updateStatusIndicators(data);
            }
        } catch (e) {
            // Ignored if non-JSON heartbeat
        }
    };

    statusSource.onerror = (error) => {
        console.error("SSE Error:", error);
        statusSource.close();
        document.querySelectorAll('.status-dot').forEach(dot => dot.classList.add('disconnected'));
        setTimeout(() => initSSE(onConfigReload), 5000);
    };
};

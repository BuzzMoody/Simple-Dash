// Centralised reactive state management for Simple Dash

const getStorageItem = (key, fallback) => {
    return localStorage.getItem(key) || fallback;
};

export const state = {
    config: null,
    theme: getStorageItem('simpledash-theme', 'dark'),
    groupBy: getStorageItem('simpledash-groupby', 'category'), // 'category' | 'none'
    layout: getStorageItem('simpledash-layout', 'grid'),       // 'grid' | 'list'
    searchQuery: '',
    serviceStatus: {},
    previousServiceStatus: null,
    widgetsData: {},
    weatherData: null,
};

const listeners = new Map();

export const subscribe = (key, callback) => {
    if (!listeners.has(key)) {
        listeners.set(key, new Set());
    }
    listeners.get(key).add(callback);
    return () => listeners.get(key).delete(callback);
};

export const setState = (updates) => {
    const changedKeys = [];
    for (const [key, value] of Object.entries(updates)) {
        if (state[key] !== value) {
            state[key] = value;
            changedKeys.push(key);
        }
    }
    changedKeys.forEach(key => {
        if (listeners.has(key)) {
            listeners.get(key).forEach(cb => cb(state[key], state));
        }
    });
};

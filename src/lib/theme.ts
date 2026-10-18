import { readLocal, writeLocal } from './storage';

export type ThemePreference = 'system' | 'dark' | 'light';

const KEY = 'br:theme';
const media = () => window.matchMedia?.('(prefers-color-scheme: light)');

export const getThemePreference = (): ThemePreference => {
    const v = readLocal(KEY);
    return v === 'dark' || v === 'light' || v === 'system' ? v : 'system';
};

export function applyTheme(pref: ThemePreference = getThemePreference()) {
    const light = pref === 'light' || (pref === 'system' && !!media()?.matches);
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f2f2f7' : '#000000');
}

export function setThemePreference(pref: ThemePreference) {
    writeLocal(KEY, pref);
    applyTheme(pref);
}

/** Applies the saved theme now and follows the OS setting while on "system". */
export function initTheme() {
    applyTheme();
    media()?.addEventListener?.('change', () => {
        if (getThemePreference() === 'system') applyTheme('system');
    });
}

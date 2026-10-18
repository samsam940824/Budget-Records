import { readLocal, writeLocal } from './storage';

// The passcode is a device-local privacy screen, like an app lock on a phone.
// It is not account security: the data itself is protected by Supabase auth and RLS.

const KEY = 'br:lock';

export interface LockConfig {
    salt: string;
    hash: string;
    /** Minutes in the background before the lock shows again. 0 locks every time. */
    timeoutMinutes: number;
}

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

async function digest(salt: string, code: string): Promise<string> {
    const data = new TextEncoder().encode(`${salt}:${code}`);
    return toHex(await crypto.subtle.digest('SHA-256', data));
}

export function getLockConfig(): LockConfig | null {
    const raw = readLocal(KEY);
    if (!raw) return null;
    try {
        const v = JSON.parse(raw) as LockConfig;
        return typeof v.salt === 'string' && typeof v.hash === 'string' ? { ...v, timeoutMinutes: Number(v.timeoutMinutes) || 0 } : null;
    } catch {
        return null;
    }
}

export async function setPasscode(code: string, timeoutMinutes: number) {
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    writeLocal(KEY, JSON.stringify({ salt, hash: await digest(salt, code), timeoutMinutes }));
}

export function setLockTimeout(timeoutMinutes: number) {
    const cfg = getLockConfig();
    if (cfg) writeLocal(KEY, JSON.stringify({ ...cfg, timeoutMinutes }));
}

export function clearPasscode() {
    writeLocal(KEY, null);
}

export async function verifyPasscode(code: string): Promise<boolean> {
    const cfg = getLockConfig();
    if (!cfg) return true;
    return (await digest(cfg.salt, code)) === cfg.hash;
}

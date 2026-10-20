// Pure logic for the quick-entry Edge Function. No Deno or Supabase APIs here,
// so the browser app and vitest can import it too.

export const TRANSFER_LABEL = '↔️ 轉帳';
export const INCOME_PREFIX = '💰 ';
export const MAX_AMOUNT = 100_000_000;
export const MAX_NOTE_LENGTH = 200;
// Shortcut entries are stamped with the user's wall-clock date, which is
// Taiwan for this app; records store local dates, not UTC instants.
export const ENTRY_TIME_ZONE = 'Asia/Taipei';

export interface MenuAccount {
    id: string;
    name: string;
    sort_order: number;
    archived: boolean;
    currency_code: string;
}

export interface MenuCategory {
    id: string;
    name: string;
    sort_order: number;
    type: 'expense' | 'income';
}

export interface UsageRow {
    category_id: string | null;
    payment_method_id: string | null;
}

export interface Menu {
    accounts: string[];
    categories: string[];
}

export interface EntryRecord {
    type: 'expense' | 'income' | 'transfer';
    amount: number;
    category_id: string | null;
    payment_method_id: string;
    to_payment_method_id: string | null;
    description: string;
    location: string;
    currency_code: string;
    date: string;
    time: string;
}

export type EntryResult = { ok: true; record: EntryRecord; message: string } | { ok: false; error: string };

const categoryLabel = (c: MenuCategory) => (c.type === 'income' ? INCOME_PREFIX + c.name : c.name);

function countBy(rows: UsageRow[], key: keyof UsageRow): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const id = row[key];
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
}

function byUsage<T extends { id: string; sort_order: number }>(items: T[], usage: Map<string, number>): T[] {
    return [...items].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.sort_order - b.sort_order);
}

/**
 * Builds the shortcut's pick lists: open accounts and expense categories by
 * recent use, then income categories, then the transfer option.
 */
export function buildMenu(accounts: MenuAccount[], categories: MenuCategory[], recentUsage: UsageRow[]): Menu {
    const accountUse = countBy(recentUsage, 'payment_method_id');
    const categoryUse = countBy(recentUsage, 'category_id');
    return {
        accounts: byUsage(accounts.filter(a => !a.archived), accountUse).map(a => a.name),
        categories: [
            ...byUsage(categories.filter(c => c.type === 'expense'), categoryUse).map(categoryLabel),
            ...byUsage(categories.filter(c => c.type === 'income'), categoryUse).map(categoryLabel),
            TRANSFER_LABEL,
        ],
    };
}

/** Accepts numbers or numeric strings such as "1,200"; at most two decimals. */
export function parseEntryAmount(raw: unknown): number | null {
    const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim().replace(/,/g, '') : '';
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
    const amount = Number(text);
    return amount > 0 && amount <= MAX_AMOUNT ? amount : null;
}

/** Local date and HH:MM in the given IANA time zone. */
export function localDateTime(now: Date, timeZone: string = ENTRY_TIME_ZONE): { date: string; time: string } {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(now).map(p => [p.type, p.value]),
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

const text = (raw: unknown) => (typeof raw === 'string' ? raw.trim() : '');
const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;

/** Validates a shortcut submission and turns it into a record for one user. */
export function resolveEntry(
    input: { [key: string]: unknown },
    accounts: MenuAccount[],
    categories: MenuCategory[],
    now: Date,
): EntryResult {
    const open = accounts.filter(a => !a.archived);
    const account = open.find(a => a.name === text(input.account));
    if (!account) return { ok: false, error: `找不到帳戶「${text(input.account)}」` };

    const amount = parseEntryAmount(input.amount);
    if (amount === null) return { ok: false, error: '金額必須是大於 0 的數字，最多兩位小數' };

    const note = text(input.note);
    if (note.length > MAX_NOTE_LENGTH) return { ok: false, error: `備註最多 ${MAX_NOTE_LENGTH} 字` };

    const { date, time } = localDateTime(now);
    const base = { amount, description: note, location: '', currency_code: account.currency_code, date, time, payment_method_id: account.id };
    const label = text(input.category);

    if (label === TRANSFER_LABEL) {
        const target = open.find(a => a.name === text(input.to_account));
        if (!target) return { ok: false, error: `找不到轉入帳戶「${text(input.to_account)}」` };
        if (target.id === account.id) return { ok: false, error: '轉出與轉入帳戶不能相同' };
        return {
            ok: true,
            record: { ...base, type: 'transfer', category_id: null, to_payment_method_id: target.id },
            message: `已轉帳：${account.name} → ${target.name} ${money(amount)}`,
        };
    }

    const category = categories.find(c => categoryLabel(c) === label || c.name === label);
    if (!category) return { ok: false, error: `找不到分類「${label}」` };
    return {
        ok: true,
        record: { ...base, type: category.type, category_id: category.id, to_payment_method_id: null },
        message: `已記帳：${category.name} ${money(amount)}（${account.name}）`,
    };
}

/** Hex SHA-256 of a UTF-8 string; tokens are stored only as this hash. */
export async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

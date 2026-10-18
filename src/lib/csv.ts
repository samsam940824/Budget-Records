import { Category, PaymentMethod, Record, RecordType } from '../types/database.types';

// ---------- Generic CSV ----------

const needsQuotes = /[",\r\n]/;

export function toCsv(rows: (string | number | null | undefined)[][]): string {
    return rows
        .map(row =>
            row
                .map(cell => {
                    const s = cell === null || cell === undefined ? '' : String(cell);
                    return needsQuotes.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                })
                .join(','),
        )
        .join('\r\n');
}

/** RFC 4180 parser: quoted fields, escaped quotes, CRLF and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
    const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQuotes) {
            if (c === '"') {
                if (src[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
            continue;
        }
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && src[i + 1] === '\n') i++;
            row.push(field); field = '';
            rows.push(row); row = [];
        } else field += c;
    }
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

// ---------- Export ----------

export const EXPORT_HEADERS = [
    'date', 'time', 'type', 'amount', 'currency', 'category',
    'account', 'to_account', 'description', 'location',
] as const;

export function recordsToCsv(
    records: Record[],
    categories: Pick<Category, 'id' | 'name'>[],
    accounts: Pick<PaymentMethod, 'id' | 'name'>[],
): string {
    const catName = new Map(categories.map(c => [c.id, c.name]));
    const accName = new Map(accounts.map(a => [a.id, a.name]));
    const sorted = [...records].sort((a, b) =>
        a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : a.date.localeCompare(b.date),
    );
    const rows = sorted.map(r => [
        r.date,
        r.time ? r.time.slice(0, 5) : '',
        r.type,
        Number(r.amount),
        r.currency_code,
        r.category_id ? catName.get(r.category_id) ?? '' : '',
        r.payment_method_id ? accName.get(r.payment_method_id) ?? '' : '',
        r.to_payment_method_id ? accName.get(r.to_payment_method_id) ?? '' : '',
        r.description ?? '',
        r.location ?? '',
    ]);
    // A byte-order mark lets Excel open the UTF-8 file with Chinese text intact.
    return '﻿' + toCsv([[...EXPORT_HEADERS], ...rows]);
}

// ---------- Import ----------

type Field = (typeof EXPORT_HEADERS)[number];

const HEADER_ALIASES: { [K in Field]: string[] } = {
    date: ['date', '日期', 'transaction date', '交易日期'],
    time: ['time', '時間'],
    type: ['type', '類型', '種類', '收支'],
    amount: ['amount', '金額', 'value', 'sum'],
    currency: ['currency', 'currency_code', '幣別', '貨幣'],
    category: ['category', '分類', '類別'],
    account: ['account', '帳戶', '账户', 'payment method', 'payment_method', '支付方式', '付款方式'],
    to_account: ['to_account', 'to account', '轉入帳戶', '目標帳戶'],
    description: ['description', 'note', 'notes', 'memo', '備註', '描述', '說明', 'title', '名稱'],
    location: ['location', '地點'],
};

const TYPE_ALIASES: { [key: string]: RecordType } = {
    expense: 'expense', '支出': 'expense', out: 'expense', debit: 'expense',
    income: 'income', '收入': 'income', in: 'income', credit: 'income',
    transfer: 'transfer', '轉帳': 'transfer', '转账': 'transfer',
};

export interface ImportRow {
    line: number;
    date: string;
    time: string | null;
    type: RecordType;
    amount: number;
    currency: string | null;
    categoryName: string;
    accountName: string;
    toAccountName: string;
    description: string;
    location: string;
}

export interface ImportError {
    line: number;
    message: string;
}

export interface ImportPreview {
    rows: ImportRow[];
    errors: ImportError[];
    missingColumns: Field[];
}

export function parseAmount(raw: string): number | null {
    let s = raw.trim();
    if (!s) return null;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    s = s.replace(/[^\d.,\-]/g, '');
    if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
    // "1.234,56" uses a decimal comma; "1,234.56" uses thousands commas.
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    if (!/^\d*\.?\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? (negative ? -n : n) : null;
}

export function parseDateCell(raw: string): string | null {
    const m = raw.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (!m) return null;
    const [, y, mo, d] = m;
    const month = Number(mo);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const probe = new Date(Number(y), month - 1, day);
    if (probe.getMonth() !== month - 1) return null;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseTimeCell(raw: string): string | null {
    const m = raw.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function previewImport(text: string): ImportPreview {
    const table = parseCsv(text);
    const errors: ImportError[] = [];
    if (table.length === 0) return { rows: [], errors: [{ line: 1, message: '檔案是空的' }], missingColumns: [] };

    const header = table[0].map(h => h.trim().toLowerCase());
    const index = {} as { [K in Field]: number };
    for (const field of EXPORT_HEADERS) {
        index[field] = header.findIndex(h => HEADER_ALIASES[field].includes(h));
    }
    const missingColumns = (['date', 'amount'] as Field[]).filter(f => index[f] < 0);
    if (missingColumns.length > 0) return { rows: [], errors: [], missingColumns };

    const cell = (row: string[], f: Field) => (index[f] >= 0 ? (row[index[f]] ?? '').trim() : '');
    const rows: ImportRow[] = [];

    table.slice(1).forEach((row, i) => {
        const line = i + 2;
        const date = parseDateCell(cell(row, 'date'));
        if (!date) { errors.push({ line, message: `無法辨識日期「${cell(row, 'date')}」` }); return; }
        const signed = parseAmount(cell(row, 'amount'));
        if (signed === null) { errors.push({ line, message: `無法辨識金額「${cell(row, 'amount')}」` }); return; }

        const rawType = cell(row, 'type').toLowerCase();
        let type: RecordType;
        if (rawType) {
            const t = TYPE_ALIASES[rawType];
            if (!t) { errors.push({ line, message: `無法辨識類型「${cell(row, 'type')}」` }); return; }
            type = t;
        } else {
            // Bank exports usually sign the amount instead of naming the type.
            type = signed < 0 ? 'expense' : 'income';
        }

        const toAccountName = cell(row, 'to_account');
        if (type === 'transfer' && (!cell(row, 'account') || !toAccountName)) {
            errors.push({ line, message: '轉帳需要轉出與轉入帳戶' });
            return;
        }

        rows.push({
            line,
            date,
            time: parseTimeCell(cell(row, 'time')),
            type,
            amount: Math.abs(signed),
            currency: cell(row, 'currency').toUpperCase() || null,
            categoryName: type === 'transfer' ? '' : cell(row, 'category'),
            accountName: cell(row, 'account'),
            toAccountName,
            description: cell(row, 'description'),
            location: cell(row, 'location'),
        });
    });

    return { rows, errors, missingColumns: [] };
}

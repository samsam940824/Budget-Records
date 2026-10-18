import { Category, Record, RecordType } from '../../types/database.types';

export interface RecordFilters {
    start: string;
    end: string;
    query: string;
    type: '' | RecordType;
    categoryId: string;
    accountId: string;
    minAmount: string;
    maxAmount: string;
}

export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export function filterRecords(records: Record[], f: RecordFilters, categories: Category[]): Record[] {
    const q = f.query.trim().toLowerCase();
    const min = f.minAmount === '' ? null : Number(f.minAmount);
    const max = f.maxAmount === '' ? null : Number(f.maxAmount);
    const catName = new Map(categories.map(c => [c.id, c.name.toLowerCase()]));
    return records.filter(r => {
        if (r.date < f.start || r.date > f.end) return false;
        if (f.type && r.type !== f.type) return false;
        if (f.categoryId && r.category_id !== f.categoryId) return false;
        if (f.accountId && r.payment_method_id !== f.accountId && r.to_payment_method_id !== f.accountId) return false;
        const amount = Number(r.amount);
        if (min !== null && Number.isFinite(min) && amount < min) return false;
        if (max !== null && Number.isFinite(max) && amount > max) return false;
        if (q) {
            const hit =
                (r.description ?? '').toLowerCase().includes(q) ||
                (r.location ?? '').toLowerCase().includes(q) ||
                (r.category_id ? catName.get(r.category_id) ?? '' : '').includes(q) ||
                String(r.amount).includes(q);
            if (!hit) return false;
        }
        return true;
    });
}

export function sortRecords(records: Record[], sort: SortKey): Record[] {
    const copy = [...records];
    const byDate = (a: Record, b: Record) =>
        a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : a.date.localeCompare(b.date);
    switch (sort) {
        case 'date-asc': return copy.sort(byDate);
        case 'date-desc': return copy.sort((a, b) => byDate(b, a));
        case 'amount-desc': return copy.sort((a, b) => Number(b.amount) - Number(a.amount));
        case 'amount-asc': return copy.sort((a, b) => Number(a.amount) - Number(b.amount));
    }
}

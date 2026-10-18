import { Budget, Record } from '../types/database.types';
import { daysInMonth, formatDate, parseDate } from './dates';

export interface Period {
    start: string;
    end: string;
}

/**
 * The cycle of a budget that contains `today`. Monthly budgets start on the
 * user's reset day, clamped to the last day of shorter months.
 */
export function budgetPeriod(
    budget: Pick<Budget, 'repeat' | 'start_date' | 'end_date'>,
    resetDay: number,
    today: string,
): Period {
    const t = parseDate(today);
    const y = t.getFullYear();
    const m = t.getMonth();
    let start: Date;
    let end: Date;

    switch (budget.repeat) {
        case 'daily':
            start = new Date(y, m, t.getDate());
            end = start;
            break;
        case 'weekly': {
            const day = t.getDay();
            start = new Date(y, m, t.getDate() - day);
            end = new Date(y, m, t.getDate() - day + 6);
            break;
        }
        case 'yearly':
            start = new Date(y, 0, 1);
            end = new Date(y, 11, 31);
            break;
        case 'none':
            start = parseDate(budget.start_date);
            end = budget.end_date ? parseDate(budget.end_date) : new Date(2999, 11, 31);
            break;
        case 'monthly':
        default: {
            const resetIn = (yy: number, mm: number) => {
                const norm = new Date(yy, mm, 1);
                const ny = norm.getFullYear();
                const nm = norm.getMonth();
                return new Date(ny, nm, Math.min(resetDay, daysInMonth(ny, nm)));
            };
            const thisReset = resetIn(y, m);
            if (t >= thisReset) {
                start = thisReset;
                const next = resetIn(y, m + 1);
                end = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
            } else {
                start = resetIn(y, m - 1);
                end = new Date(y, m, thisReset.getDate() - 1);
            }
            break;
        }
    }

    const budgetStart = parseDate(budget.start_date);
    if (start < budgetStart) start = budgetStart;
    if (budget.end_date) {
        const budgetEnd = parseDate(budget.end_date);
        if (end > budgetEnd) end = budgetEnd;
    }
    return { start: formatDate(start), end: formatDate(end) };
}

export function budgetSpent(
    budget: Pick<Budget, 'category_id'>,
    records: Pick<Record, 'type' | 'amount' | 'date' | 'category_id'>[],
    period: Period,
): number {
    return records
        .filter(r =>
            r.type === 'expense' &&
            (!budget.category_id || r.category_id === budget.category_id) &&
            r.date >= period.start &&
            r.date <= period.end,
        )
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

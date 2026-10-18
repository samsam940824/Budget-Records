import { RecurringTransaction, RepeatFrequency } from '../types/database.types';
import { addDays, addMonthsClamped, minDate, parseDate } from './dates';

type Schedule = Pick<RecurringTransaction, 'frequency' | 'interval_count' | 'start_date'>;

/**
 * The n-th occurrence (0-based) of a schedule. Each occurrence is computed
 * from start_date rather than from the previous one, so a rule starting on
 * the 31st returns to the 31st after passing through shorter months.
 */
export function occurrence(rule: Schedule, n: number): string {
    const step = n * Math.max(1, rule.interval_count);
    switch (rule.frequency) {
        case 'daily':
            return addDays(rule.start_date, step);
        case 'weekly':
            return addDays(rule.start_date, step * 7);
        case 'monthly':
            return addMonthsClamped(rule.start_date, step, parseDate(rule.start_date).getDate());
        case 'yearly':
            return addMonthsClamped(rule.start_date, step * 12, parseDate(rule.start_date).getDate());
    }
}

const MAX_OCCURRENCES = 100_000;

export interface DueResult {
    /** Dates that should exist as records now, oldest first. */
    dates: string[];
    /** The first occurrence after today; becomes the rule's next_date. */
    nextDate: string;
    /** True when the rule has no occurrences left before its end date. */
    finished: boolean;
}

/** Occurrences from the rule's next_date up to and including today. */
export function dueOccurrences(
    rule: Pick<RecurringTransaction, 'frequency' | 'interval_count' | 'start_date' | 'end_date' | 'next_date'>,
    today: string,
): DueResult {
    const until = rule.end_date ? minDate(today, rule.end_date) : today;
    const dates: string[] = [];
    let n = 0;
    let d = occurrence(rule, 0);
    while (d <= until && n < MAX_OCCURRENCES) {
        if (d >= rule.next_date) dates.push(d);
        n += 1;
        d = occurrence(rule, n);
    }
    // next_date never moves backwards, even if the schedule was edited.
    while (d < rule.next_date && n < MAX_OCCURRENCES) {
        n += 1;
        d = occurrence(rule, n);
    }
    const finished = !!rule.end_date && d > rule.end_date;
    return { dates, nextDate: d, finished };
}

export const FREQUENCY_LABELS: { [K in RepeatFrequency]: string } = {
    daily: '每日',
    weekly: '每週',
    monthly: '每月',
    yearly: '每年',
};

export function describeSchedule(rule: Pick<RecurringTransaction, 'frequency' | 'interval_count'>): string {
    if (rule.interval_count <= 1) return FREQUENCY_LABELS[rule.frequency];
    const unit = { daily: '天', weekly: '週', monthly: '個月', yearly: '年' }[rule.frequency];
    return `每 ${rule.interval_count} ${unit}`;
}

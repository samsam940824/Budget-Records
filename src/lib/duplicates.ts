// Duplicate checks done in the browser: CSV imports against existing records,
// and a manual entry against one a notification already created.

import { Record, RecordType } from '../types/database.types';

/** Bank statements post a few days after the purchase (Cathay debit cards). */
export const IMPORT_MATCH_DAYS = 3;
/** Same window the notify endpoint uses for manual entries. */
export const MANUAL_MATCH_MINUTES = 30;

const DAY_MS = 86_400_000;

export interface ImportCandidate {
    line: number;
    type: RecordType;
    amount: number;
    date: string;
    /** Resolved existing account, or null when the name is new or empty. */
    accountId: string | null;
    toAccountId: string | null;
}

type RecordRef = Pick<Record, 'id' | 'type' | 'amount' | 'date' | 'payment_method_id' | 'to_payment_method_id'>;

const dayGap = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;

function sameMovement(row: ImportCandidate, r: RecordRef): boolean {
    return row.type === r.type
        && row.amount === Number(r.amount)
        && row.accountId !== null
        && row.accountId === r.payment_method_id
        && (row.type !== 'transfer' || row.toAccountId === r.to_payment_method_id);
}

/**
 * Pairs CSV rows with existing records describing the same movement within
 * IMPORT_MATCH_DAYS, one-to-one and closest dates first, so two identical
 * purchases in the file only skip as many rows as there are existing records.
 * Returns line number -> matched record id.
 */
export function findImportDuplicates(rows: ImportCandidate[], existing: RecordRef[]): Map<number, string> {
    const pairs: { line: number; id: string; gap: number }[] = [];
    for (const row of rows) {
        for (const r of existing) {
            if (!sameMovement(row, r)) continue;
            const gap = dayGap(row.date, r.date);
            if (gap <= IMPORT_MATCH_DAYS) pairs.push({ line: row.line, id: r.id, gap });
        }
    }
    pairs.sort((a, b) => a.gap - b.gap || a.line - b.line);

    const matches = new Map<number, string>();
    const used = new Set<string>();
    for (const p of pairs) {
        if (matches.has(p.line) || used.has(p.id)) continue;
        matches.set(p.line, p.id);
        used.add(p.id);
    }
    return matches;
}

type DraftRecord = Pick<Record, 'type' | 'amount' | 'date' | 'time' | 'payment_method_id'>;

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * An automatically entered record that a new manual entry probably repeats:
 * same type and amount, same account when both have one, and within
 * MANUAL_MATCH_MINUTES (or the same day when either has no time).
 */
export function findLikelyAutoDuplicate(draft: DraftRecord, records: Record[]): Record | undefined {
    return records.find(r =>
        r.source === 'notification'
        && r.type === draft.type
        && Number(r.amount) === draft.amount
        && r.date === draft.date
        && (!draft.payment_method_id || !r.payment_method_id || r.payment_method_id === draft.payment_method_id)
        && (!draft.time || !r.time || Math.abs(minutesOf(r.time) - minutesOf(draft.time)) <= MANUAL_MATCH_MINUTES));
}

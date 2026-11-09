// Duplicate detection for notification events. Pure functions.
//
// Core rule: a bank sends one notification per transaction, so two events
// from the same source are always two transactions. Only different sources
// describing one purchase are merged, and each record absorbs at most one
// event per source (also enforced by a unique index in the database).

import { localDateTime } from '../quick-entry/logic.ts';
import type { EventKind, ParsedEvent } from './parsers.ts';

/** Identical text this close together is most likely iOS firing twice. */
export const REPLAY_WINDOW_MS = 90 * 1000;
/** Wallet app and bank notifications for one payment arrive within minutes. */
export const NOTIFICATION_MERGE_WINDOW_MS = 10 * 60 * 1000;
/** A manual entry may be typed a while before or after paying. */
export const MANUAL_MERGE_WINDOW_MS = 30 * 60 * 1000;
/** The user pays each card purchase soon after making it. */
export const CARD_PAYMENT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
/** Sources whose records are purchases charged to a credit card. */
export const CARD_SOURCES = ['esun_card', 'cathay_card', 'utaggo'];

const TAIPEI_OFFSET = '+08:00';

export type RecordSource = 'manual' | 'quick_entry' | 'notification' | 'import';

export interface CandidateRecord {
    id: string;
    type: 'expense' | 'income' | 'transfer';
    amount: number;
    payment_method_id: string | null;
    to_payment_method_id: string | null;
    /** Local Taiwan date and time as stored, e.g. '2026-11-07' and '10:05:00'. */
    date: string;
    time: string | null;
    source: RecordSource;
    is_distinct: boolean;
    /** Sources of the notification events already merged into this record. */
    linkedSources: string[];
}

export interface PendingEvent {
    id: string;
    source: string;
    kind: EventKind | null;
    amount: number | null;
    merchant: string | null;
    occurredAt: Date;
}

export type MergeResult =
    | { kind: 'none' }
    | { kind: 'merge'; recordId: string }
    | { kind: 'ambiguous'; recordIds: string[] };

/** Records store Taiwan wall-clock time; returns the instant it denotes. */
export function recordInstant(date: string, time: string): Date {
    return new Date(`${date}T${time.slice(0, 5)}:00${TAIPEI_OFFSET}`);
}

export function isPossibleReplay(rawHash: string, receivedAt: Date, recent: { raw_hash: string; received_at: Date }[]): boolean {
    return recent.some(r => r.raw_hash === rawHash && Math.abs(receivedAt.getTime() - r.received_at.getTime()) <= REPLAY_WINDOW_MS);
}

/** Whether the record has the type and account this event would produce. */
function sameMovement(kind: EventKind, accountId: string | null, r: CandidateRecord): boolean {
    const matches = (id: string | null) => accountId === null || id === accountId;
    switch (kind) {
        case 'expense': return r.type === 'expense' && matches(r.payment_method_id);
        case 'income': return r.type === 'income' && matches(r.payment_method_id);
        case 'transfer_out':
            return (r.type === 'expense' || r.type === 'transfer') && matches(r.payment_method_id);
        case 'transfer_in':
            return (r.type === 'income' && matches(r.payment_method_id)) || (r.type === 'transfer' && matches(r.to_payment_method_id));
    }
}

function windowFor(r: CandidateRecord): number {
    return r.source === 'notification' ? NOTIFICATION_MERGE_WINDOW_MS : MANUAL_MERGE_WINDOW_MS;
}

/**
 * Finds the existing record this event describes. `accountId` is the account
 * the event resolved to, or null when unknown (then any account matches).
 * Records without a time are never auto-merged: they can only make a match
 * ambiguous, which sends the event to review.
 */
export function findMergeTarget(event: ParsedEvent, accountId: string | null, candidates: CandidateRecord[]): MergeResult {
    const eligible = candidates.filter(r =>
        !r.is_distinct
        && !r.linkedSources.includes(event.source)
        // A bank debit can pay a card purchase but never is one.
        && !(event.kind === 'transfer_out' && r.linkedSources.some(s => CARD_SOURCES.includes(s)))
        && r.amount === event.amount
        && sameMovement(event.kind, accountId, r));

    const timed: { record: CandidateRecord; gap: number }[] = [];
    const untimed: CandidateRecord[] = [];
    for (const r of eligible) {
        if (r.time === null) {
            if (r.date === localDateTime(event.occurredAt).date) untimed.push(r);
            continue;
        }
        const gap = Math.abs(recordInstant(r.date, r.time).getTime() - event.occurredAt.getTime());
        if (gap <= windowFor(r)) timed.push({ record: r, gap });
    }

    if (timed.length === 0) {
        return untimed.length > 0 ? { kind: 'ambiguous', recordIds: untimed.map(r => r.id) } : { kind: 'none' };
    }
    // Several equal-looking records in one account (two 65 coffees) are
    // interchangeable, so take the closest; different accounts are a real
    // question for the user.
    const accounts = new Set(timed.map(t => t.record.payment_method_id));
    if (accounts.size > 1) return { kind: 'ambiguous', recordIds: timed.map(t => t.record.id) };
    timed.sort((a, b) => a.gap - b.gap);
    return { kind: 'merge', recordId: timed[0].record.id };
}

/**
 * Pending events from other sources that describe the same payment, e.g. a
 * LINE Pay notice waiting for an account when the card notice arrives. They
 * are merged into the record the new event creates, one per source.
 */
export function findPendingPartners(event: ParsedEvent, pending: PendingEvent[]): PendingEvent[] {
    const bySource = new Map<string, { partner: PendingEvent; gap: number }>();
    for (const p of pending) {
        if (p.source === event.source || p.kind !== event.kind || p.amount !== event.amount) continue;
        const gap = Math.abs(p.occurredAt.getTime() - event.occurredAt.getTime());
        if (gap > NOTIFICATION_MERGE_WINDOW_MS) continue;
        const best = bySource.get(p.source);
        if (!best || gap < best.gap) bySource.set(p.source, { partner: p, gap });
    }
    return [...bySource.values()].map(v => v.partner);
}

/**
 * Card accounts holding a purchase of the debit's amount that no transfer
 * into the card has paid yet. Each payment settles one purchase.
 */
export function unpaidCardAccounts(purchaseAccountIds: string[], paymentAccountIds: string[]): string[] {
    const open = new Map<string, number>();
    for (const id of purchaseAccountIds) open.set(id, (open.get(id) ?? 0) + 1);
    for (const id of paymentAccountIds) if (open.has(id)) open.set(id, open.get(id)! - 1);
    return [...open].filter(([, count]) => count > 0).map(([id]) => id);
}

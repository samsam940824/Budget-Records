// Database access for the notify endpoint: loads what decide() needs and
// applies its decision. Every query filters by the token's user because the
// client uses the service role key.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { localDateTime } from '../quick-entry/logic.ts';
import type { AutoEntryMode, Decision, DecisionContext, ReviewReason } from './decide.ts';
import {
    CandidateRecord, CARD_PAYMENT_WINDOW_MS, CARD_SOURCES, NOTIFICATION_MERGE_WINDOW_MS, PendingEvent, REPLAY_WINDOW_MS, unpaidCardAccounts,
} from './matching.ts';
import type { ParsedEvent } from './parsers.ts';

/** Raw notification text is cleared this long after an event is resolved. */
export const RAW_TEXT_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;
const UNIQUE_VIOLATION = '23505';

/** Fields of a notification_events row known before the decision. */
export interface EventBase {
    source: string;
    raw_text: string;
    raw_hash: string;
    kind: ParsedEvent['kind'] | null;
    amount: number | null;
    currency_code: string;
    merchant: string | null;
    last4: string | null;
    occurred_at: string | null;
}

export type Outcome =
    | { status: 'recorded'; recordId: string }
    | { status: 'merged'; recordId: string }
    | { status: 'pending'; reason: ReviewReason };

export function eventBase(event: ParsedEvent, rawText: string, rawHash: string): EventBase {
    return {
        source: event.source, raw_text: rawText, raw_hash: rawHash, kind: event.kind, amount: event.amount,
        currency_code: event.currencyCode, merchant: event.merchant, last4: event.last4, occurred_at: event.occurredAt.toISOString(),
    };
}

function shiftDate(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
    if (result.error) throw new Error(result.error.message);
    return result.data as NonNullable<T>;
}

/** Records with the event's amount from the day before to the day after. */
async function loadCandidates(db: SupabaseClient, userId: string, event: ParsedEvent): Promise<CandidateRecord[]> {
    const day = localDateTime(event.occurredAt).date;
    const records = unwrap(await db.from('records')
        .select('id, type, amount, payment_method_id, to_payment_method_id, date, time, source, is_distinct')
        .eq('user_id', userId).eq('amount', event.amount)
        .gte('date', shiftDate(day, -1)).lte('date', shiftDate(day, 1)));
    if (records.length === 0) return [];

    const links = unwrap(await db.from('notification_events').select('record_id, source')
        .eq('user_id', userId).in('record_id', records.map(r => r.id)));
    return records.map(r => ({
        ...r,
        amount: Number(r.amount),
        linkedSources: links.filter(l => l.record_id === r.id).map(l => l.source),
    }));
}

async function loadPending(db: SupabaseClient, userId: string, event: ParsedEvent): Promise<PendingEvent[]> {
    const at = event.occurredAt.getTime();
    const rows = unwrap(await db.from('notification_events')
        .select('id, source, kind, amount, merchant, occurred_at')
        .eq('user_id', userId).eq('status', 'pending').eq('amount', event.amount)
        .gte('occurred_at', new Date(at - NOTIFICATION_MERGE_WINDOW_MS).toISOString())
        .lte('occurred_at', new Date(at + NOTIFICATION_MERGE_WINDOW_MS).toISOString()));
    return rows.map(r => ({ ...r, amount: Number(r.amount), occurredAt: new Date(r.occurred_at) }));
}

/**
 * For a bank debit: card accounts with a purchase of the same amount from
 * the last two days (filed from a card notification) that is still unpaid.
 */
async function loadUnpaidCardAccounts(db: SupabaseClient, userId: string, event: ParsedEvent): Promise<string[]> {
    if (event.kind !== 'transfer_out') return [];
    const since = new Date(event.occurredAt.getTime() - CARD_PAYMENT_WINDOW_MS);
    const cardEvents = unwrap(await db.from('notification_events').select('record_id')
        .eq('user_id', userId).in('source', CARD_SOURCES).in('status', ['recorded', 'merged']).eq('amount', event.amount)
        .gte('occurred_at', since.toISOString()).lte('occurred_at', event.occurredAt.toISOString()).not('record_id', 'is', null));
    if (cardEvents.length === 0) return [];

    const purchases = unwrap(await db.from('records').select('payment_method_id, date')
        .eq('user_id', userId).eq('type', 'expense').in('id', cardEvents.map(e => e.record_id)));
    const cards = [...new Set(purchases.map(p => p.payment_method_id).filter((id): id is string => id !== null))];
    if (cards.length === 0) return [];

    const firstDate = purchases.map(p => p.date).sort()[0];
    const payments = unwrap(await db.from('records').select('to_payment_method_id')
        .eq('user_id', userId).eq('type', 'transfer').eq('amount', event.amount).in('to_payment_method_id', cards).gte('date', firstDate));
    return unpaidCardAccounts(purchases.map(p => p.payment_method_id ?? ''), payments.map(p => p.to_payment_method_id ?? ''))
        .filter(id => id !== '');
}

export async function loadContext(db: SupabaseClient, userId: string, event: ParsedEvent, rawHash: string, now: Date): Promise<DecisionContext> {
    const [settings, accounts, categories, rules, replays, candidates, pending, unpaidCards] = await Promise.all([
        db.from('user_settings').select('auto_entry_mode').eq('user_id', userId).maybeSingle(),
        db.from('payment_methods').select('id, match_last4, archived, currency_code').eq('user_id', userId),
        db.from('categories').select('id, type').eq('user_id', userId),
        db.from('auto_entry_rules').select('source, match_key, payment_method_id, category_id').eq('user_id', userId).eq('source', event.source),
        db.from('notification_events').select('raw_hash, received_at').eq('user_id', userId).eq('raw_hash', rawHash)
            .gte('received_at', new Date(now.getTime() - REPLAY_WINDOW_MS).toISOString()),
        loadCandidates(db, userId, event),
        loadPending(db, userId, event),
        loadUnpaidCardAccounts(db, userId, event),
    ]);
    // No settings row yet means the defaults apply.
    if (settings.error) throw new Error(settings.error.message);
    return {
        mode: (settings.data?.auto_entry_mode ?? 'auto') as AutoEntryMode,
        accounts: unwrap(accounts),
        categories: unwrap(categories),
        rules: unwrap(rules),
        isReplay: unwrap(replays).length > 0,
        candidates,
        pending,
        unpaidCardAccounts: unpaidCards,
    };
}

export async function storePending(db: SupabaseClient, userId: string, base: EventBase, reason: ReviewReason): Promise<Outcome> {
    unwrap(await db.from('notification_events').insert({ ...base, user_id: userId, status: 'pending', review_reason: reason }).select('id'));
    return { status: 'pending', reason };
}

async function applyMerge(db: SupabaseClient, userId: string, base: EventBase, decision: Extract<Decision, { action: 'merge' }>): Promise<Outcome> {
    const now = new Date().toISOString();
    const inserted = await db.from('notification_events')
        .insert({ ...base, user_id: userId, status: 'merged', record_id: decision.recordId, resolved_at: now });
    // Another event from this source claimed the record first: let the user decide.
    if (inserted.error?.code === UNIQUE_VIOLATION) return storePending(db, userId, base, 'ambiguous_match');
    if (inserted.error) throw new Error(inserted.error.message);

    if (decision.fill.description) {
        unwrap(await db.from('records').update({ description: decision.fill.description })
            .eq('user_id', userId).eq('id', decision.recordId).or('description.is.null,description.eq.').select('id'));
    }
    return { status: 'merged', recordId: decision.recordId };
}

async function applyRecord(db: SupabaseClient, userId: string, base: EventBase, decision: Extract<Decision, { action: 'record' }>): Promise<Outcome> {
    const now = new Date().toISOString();
    const record = unwrap(await db.from('records').insert({ ...decision.record, user_id: userId }).select('id').single());
    const event = await db.from('notification_events')
        .insert({ ...base, user_id: userId, status: 'recorded', record_id: record.id, resolved_at: now });
    if (event.error) {
        // Without its event the record could be entered again; undo it.
        await db.from('records').delete().eq('user_id', userId).eq('id', record.id);
        throw new Error(event.error.message);
    }

    for (const id of decision.mergePendingIds) {
        const merged = await db.from('notification_events')
            .update({ status: 'merged', record_id: record.id, resolved_at: now, review_reason: null })
            .eq('user_id', userId).eq('id', id).eq('status', 'pending');
        if (merged.error) console.error(JSON.stringify({ event: 'merge_pending_failed', id, error: merged.error.message }));
    }
    return { status: 'recorded', recordId: record.id };
}

export function applyDecision(db: SupabaseClient, userId: string, base: EventBase, decision: Decision): Promise<Outcome> {
    switch (decision.action) {
        case 'review': return storePending(db, userId, base, decision.reason);
        case 'merge': return applyMerge(db, userId, base, decision);
        case 'record': return applyRecord(db, userId, base, decision);
    }
}

/** Clears raw text of events resolved more than RAW_TEXT_RETENTION_DAYS ago. */
export async function purgeRawText(db: SupabaseClient, userId: string, now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - RAW_TEXT_RETENTION_DAYS * DAY_MS).toISOString();
    unwrap(await db.from('notification_events').update({ raw_text: null })
        .eq('user_id', userId).neq('status', 'pending').not('raw_text', 'is', null).lt('resolved_at', cutoff).select('id'));
}

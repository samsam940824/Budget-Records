// Decides what happens to one parsed notification: create a record, merge it
// into an existing one, or hold it for review. Pure; the Edge Function loads
// the context and applies the decision.

import { localDateTime } from '../quick-entry/logic.ts';
import type { ParsedEvent } from './parsers.ts';
import { CandidateRecord, findMergeTarget, findPendingPartners, PendingEvent } from './matching.ts';

export type AutoEntryMode = 'auto' | 'review';

/**
 * 'needs_purpose': a bank account movement whose purpose (card payment,
 * withdrawal, transfer) the text does not say.
 */
export type ReviewReason = 'unparsed' | 'unknown_account' | 'possible_replay' | 'ambiguous_match' | 'review_mode' | 'needs_purpose';

export const REVIEW_REASON_LABELS: { [R in ReviewReason]: string } = {
    unparsed: '看不懂的格式',
    unknown_account: '需要選帳戶',
    needs_purpose: '需要選用途',
    possible_replay: '疑似重複送出',
    ambiguous_match: '可能和既有記錄重複',
    review_mode: '待確認模式',
};

export interface AccountRef {
    id: string;
    match_last4: string[];
    archived: boolean;
    currency_code: string;
}

export interface CategoryRef {
    id: string;
    type: 'expense' | 'income';
}

export interface Rule {
    source: string;
    match_key: string;
    payment_method_id: string | null;
    category_id: string | null;
}

export interface DecisionContext {
    mode: AutoEntryMode;
    accounts: AccountRef[];
    categories: CategoryRef[];
    rules: Rule[];
    /** Recent records near the event's time, with their merged sources. */
    candidates: CandidateRecord[];
    /** Unresolved events from the last few minutes. */
    pending: PendingEvent[];
    /** For a bank debit: cards with an unpaid purchase of the same amount. */
    unpaidCardAccounts: string[];
    isReplay: boolean;
}

export interface NewRecord {
    type: 'expense' | 'income' | 'transfer';
    amount: number;
    category_id: string | null;
    payment_method_id: string;
    to_payment_method_id: string | null;
    description: string;
    currency_code: string;
    date: string;
    time: string;
    source: 'notification';
}

export type Decision =
    | { action: 'review'; reason: ReviewReason; accountId: string | null }
    /** `fill` is only applied to fields the record leaves empty. */
    | { action: 'merge'; recordId: string; fill: { description?: string } }
    | { action: 'record'; record: NewRecord; mergePendingIds: string[] };

export const MERCHANT_PREFIX = 'm:';
export const KIND_PREFIX = 'k:';

/**
 * Key a remembered choice is stored under: the merchant when known, else the
 * kind of notification (e.g. every 玉山 card notice has no merchant).
 */
export function ruleKey(event: Pick<ParsedEvent, 'merchant' | 'kind'>): string {
    const merchant = event.merchant?.trim().toLowerCase();
    return merchant ? MERCHANT_PREFIX + merchant : KIND_PREFIX + event.kind;
}

/**
 * Account and category for an event: a card suffix wins, then a remembered
 * rule. A category is only taken from merchant rules, so one choice for a
 * merchant-less card notice does not stamp every later purchase.
 */
export function resolveAccount(event: ParsedEvent, accounts: AccountRef[], rules: Rule[]): { accountId: string | null; categoryId: string | null } {
    const open = accounts.filter(a => !a.archived);
    const key = ruleKey(event);
    const find = (matchKey: string) => rules.find(r => r.source === event.source && r.match_key === matchKey);
    // A new shop or parking lot falls back to the account last used for this source.
    const rule = find(key) ?? find(KIND_PREFIX + event.kind);
    const byLast4 = event.last4 ? open.find(a => a.match_last4.includes(event.last4!)) : undefined;
    const ruleAccount = open.find(a => a.id === rule?.payment_method_id);
    return {
        accountId: byLast4?.id ?? ruleAccount?.id ?? null,
        categoryId: key.startsWith(MERCHANT_PREFIX) && rule?.match_key === key ? rule.category_id ?? null : null,
    };
}

/**
 * Record type for an event. Bank account movements only become records when
 * a remembered merchant rule says what they are (e.g. a debit card purchase).
 */
function recordType(event: ParsedEvent, category: CategoryRef | undefined): 'expense' | 'income' | null {
    if (event.kind === 'expense' || event.kind === 'income') return event.kind;
    if (!category) return null;
    if (event.kind === 'transfer_out' && category.type === 'expense') return 'expense';
    if (event.kind === 'transfer_in' && category.type === 'income') return 'income';
    return null;
}

export function decide(event: ParsedEvent, ctx: DecisionContext): Decision {
    if (ctx.isReplay) return { action: 'review', reason: 'possible_replay', accountId: null };

    const { accountId, categoryId } = resolveAccount(event, ctx.accounts, ctx.rules);
    const match = findMergeTarget(event, accountId, ctx.candidates);
    if (match.kind === 'merge') {
        return { action: 'merge', recordId: match.recordId, fill: event.merchant ? { description: event.merchant } : {} };
    }
    if (match.kind === 'ambiguous') return { action: 'review', reason: 'ambiguous_match', accountId };

    const type = recordType(event, ctx.categories.find(c => c.id === categoryId));
    if (type === null) {
        const card = cardPaid(event, accountId, ctx.unpaidCardAccounts);
        if (card === null) return { action: 'review', reason: 'needs_purpose', accountId };
        if (ctx.mode === 'review') return { action: 'review', reason: 'review_mode', accountId };
        return recordDecision(event, ctx, accountId!, { type: 'transfer', category_id: null, to_payment_method_id: card, description: '' });
    }
    if (accountId === null) return { action: 'review', reason: 'unknown_account', accountId };
    if (ctx.mode === 'review') return { action: 'review', reason: 'review_mode', accountId };

    const partners = findPendingPartners(event, ctx.pending);
    // A waiting LINE Pay / Apple Pay notice usually names the shop the card notice lacks.
    const description = event.merchant ?? partners.find(p => p.merchant)?.merchant ?? '';
    return recordDecision(event, ctx, accountId, { type, category_id: categoryId, to_payment_method_id: null, description }, partners);
}

/**
 * The card a bank debit pays: exactly one other card has an unpaid purchase
 * of this amount. Needs the debited account, so the transfer has both ends.
 */
function cardPaid(event: ParsedEvent, accountId: string | null, unpaid: string[]): string | null {
    if (event.kind !== 'transfer_out' || accountId === null) return null;
    const cards = unpaid.filter(id => id !== accountId);
    return cards.length === 1 ? cards[0] : null;
}

function recordDecision(
    event: ParsedEvent,
    ctx: DecisionContext,
    accountId: string,
    fields: Pick<NewRecord, 'type' | 'category_id' | 'to_payment_method_id' | 'description'>,
    partners: PendingEvent[] = [],
): Decision {
    const account = ctx.accounts.find(a => a.id === accountId)!;
    const { date, time } = localDateTime(event.occurredAt);
    return {
        action: 'record',
        record: { ...fields, amount: event.amount, payment_method_id: accountId, currency_code: account.currency_code, date, time, source: 'notification' },
        mergePendingIds: partners.map(p => p.id),
    };
}

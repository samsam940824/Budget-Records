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
 * 'card_payment': a bank debit equal to an unpaid card purchase that does not
 * say it is a card payment, or whose debited account is uncertain.
 */
export type ReviewReason = 'unparsed' | 'unknown_account' | 'possible_replay' | 'ambiguous_match' | 'review_mode' | 'needs_purpose' | 'card_payment';

export const REVIEW_REASON_LABELS: { [R in ReviewReason]: string } = {
    unparsed: '看不懂的格式',
    unknown_account: '需要選帳戶',
    needs_purpose: '需要選用途',
    card_payment: '疑似繳卡費，請選扣款帳戶',
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
    /** `suggestedCardId`: the card a bank debit most likely pays, prefilled in review. */
    | { action: 'review'; reason: ReviewReason; accountId: string | null; suggestedCardId?: string }
    /** `fill` is only applied to fields the record leaves empty. */
    | { action: 'merge'; recordId: string; fill: { description?: string } }
    | { action: 'record'; record: NewRecord; mergePendingIds: string[] };

export const MERCHANT_PREFIX = 'm:';
export const KIND_PREFIX = 'k:';

/** A bank debit labelled as a card payment, e.g. 國泰「信用卡款」. */
const CARD_PAYMENT_LABEL = /信用卡/;

export function namesCardPayment(merchant: string | null): boolean {
    return merchant !== null && CARD_PAYMENT_LABEL.test(merchant);
}

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
    if (type === null) return decideMovement(event, ctx, accountId);
    if (accountId === null) return { action: 'review', reason: 'unknown_account', accountId };
    if (ctx.mode === 'review') return { action: 'review', reason: 'review_mode', accountId };

    const partners = findPendingPartners(event, ctx.pending);
    // A waiting LINE Pay / Apple Pay notice usually names the shop the card notice lacks.
    const description = event.merchant ?? partners.find(p => p.merchant)?.merchant ?? '';
    return recordDecision(event, ctx, accountId, { type, category_id: categoryId, to_payment_method_id: null, description }, partners);
}

/**
 * A bank movement with no remembered purpose. A debit equal to an unpaid
 * purchase on exactly one card is booked as paying that card only when the
 * text says it is a card payment and the debited account is known; otherwise
 * the card is suggested for review (玉山 debits may come from two accounts).
 */
function decideMovement(event: ParsedEvent, ctx: DecisionContext, accountId: string | null): Decision {
    const card = cardPaid(event, accountId, ctx.unpaidCardAccounts);
    if (card === null) return { action: 'review', reason: 'needs_purpose', accountId };
    if (accountId === null || !namesCardPayment(event.merchant)) {
        return { action: 'review', reason: 'card_payment', accountId, suggestedCardId: card };
    }
    if (ctx.mode === 'review') return { action: 'review', reason: 'review_mode', accountId, suggestedCardId: card };
    return recordDecision(event, ctx, accountId, { type: 'transfer', category_id: null, to_payment_method_id: card, description: '' });
}

/** The card a bank debit pays: exactly one other card has an unpaid purchase of this amount. */
function cardPaid(event: ParsedEvent, accountId: string | null, unpaid: string[]): string | null {
    if (event.kind !== 'transfer_out') return null;
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

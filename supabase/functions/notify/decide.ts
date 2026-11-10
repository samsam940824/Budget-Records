// Decides what happens to one parsed notification: create a record, merge it
// into an existing one, or hold it for review. Pure; the Edge Function loads
// the context and applies the decision.

import { localDateTime } from '../quick-entry/logic.ts';
import type { ParsedEvent } from './parsers.ts';
import { CandidateRecord, CARD_SOURCES, findMergeTarget, findPendingPartners, PendingEvent } from './matching.ts';

export type AutoEntryMode = 'auto' | 'review';

/**
 * 'needs_purpose': a bank account movement whose purpose (card payment,
 * withdrawal, transfer) the text does not say.
 * 'card_payment': a bank debit equal to an unpaid card purchase that does not
 * say it is a card payment, or whose debited account is uncertain.
 * 'needs_merchant': a card purchase no notice named the shop of (玉山).
 */
export type ReviewReason =
    | 'unparsed' | 'unknown_account' | 'possible_replay' | 'ambiguous_match' | 'review_mode' | 'needs_purpose' | 'card_payment' | 'needs_merchant';

export const REVIEW_REASON_LABELS: { [R in ReviewReason]: string } = {
    unparsed: '看不懂的格式',
    unknown_account: '需要選帳戶',
    needs_purpose: '需要選用途',
    card_payment: '疑似繳卡費，請選扣款帳戶',
    needs_merchant: '需要補店名',
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
    name: string;
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
    /**
     * Prefilled when the user files it: `suggestedAccountId` is the account a
     * card purchase is charged to, `suggestedCardId` the card a bank debit most
     * likely pays. Bank debits get no account: it may be 生活費 or 簽約金.
     */
    | { action: 'review'; reason: ReviewReason; accountId: string | null; suggestedAccountId?: string; suggestedCardId?: string }
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

/** Gas station shop names, e.g. LINE Pay「台灣中油…」. */
const FUEL_MERCHANT = /中油|加油/;
const FUEL_CATEGORY = '加油';
/** Note for a fuel purchase, e.g. 1110汽車加油, matching the user's own entries. */
const FUEL_NOTE = '汽車加油';

/**
 * Key a remembered choice is stored under: the merchant when known, else the
 * kind of notification (e.g. every 玉山 card notice has no merchant).
 */
export function ruleKey(event: Pick<ParsedEvent, 'merchant' | 'kind'>): string {
    const merchant = event.merchant?.trim().toLowerCase();
    return merchant ? MERCHANT_PREFIX + merchant : KIND_PREFIX + event.kind;
}

/**
 * LINE Pay payments are charged to a card or the LINE Pay balance and the
 * text does not say which. The card notice they merge with supplies the
 * account, so a remembered account would book card payments twice.
 */
const FUNDING_UNKNOWN_SOURCES = ['linepay'];

/** Whether a remembered choice may set the account for this kind of notification. */
export function remembersAccount(source: string, kind: ParsedEvent['kind']): boolean {
    return !(kind === 'expense' && FUNDING_UNKNOWN_SOURCES.includes(source));
}

/**
 * Account and category for an event: a card suffix wins, then a remembered
 * rule. A category is only taken from merchant rules, so one choice for a
 * merchant-less card notice does not stamp every later purchase.
 */
export function resolveAccount(
    event: Pick<ParsedEvent, 'source' | 'kind' | 'merchant' | 'last4'>, accounts: AccountRef[], rules: Rule[],
): { accountId: string | null; categoryId: string | null } {
    const open = accounts.filter(a => !a.archived);
    const key = ruleKey(event);
    const find = (matchKey: string) => rules.find(r => r.source === event.source && r.match_key === matchKey);
    // A new shop or parking lot falls back to the account last used for this source.
    const rule = remembersAccount(event.source, event.kind) ? find(key) ?? find(KIND_PREFIX + event.kind) : undefined;
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
    return decidePurchase(event, ctx, type, accountId, categoryId);
}

/**
 * A payment no account is known for yet, e.g. LINE Pay: the card notice of
 * the same payment often arrives in the same second and is still being
 * processed, so the caller decides once more after a short wait. Only this
 * side waits; if both did, they would miss each other again.
 */
export function waitsForPartner(decision: Decision): boolean {
    return decision.action === 'review' && decision.reason === 'unknown_account';
}

/**
 * A card or wallet payment. Notices about one payment from different sources
 * complete each other: the card notice knows the account, a wallet notice
 * (LINE Pay, 全盈+PAY) names the shop the 玉山 card notice lacks. A card
 * purchase still without a shop name waits for the user to fill it in.
 */
function decidePurchase(event: ParsedEvent, ctx: DecisionContext, type: 'expense' | 'income', accountId: string | null, categoryId: string | null): Decision {
    const partners = findPendingPartners(event, ctx.pending);
    const account = accountId ?? partnerAccount(partners, ctx);
    if (account === null) return { action: 'review', reason: 'unknown_account', accountId: null };
    const merchant = event.merchant ?? partners.find(p => p.merchant)?.merchant ?? null;
    if (merchant === null && CARD_SOURCES.includes(event.source)) {
        return { action: 'review', reason: 'needs_merchant', accountId: account, suggestedAccountId: account };
    }
    if (ctx.mode === 'review') return { action: 'review', reason: 'review_mode', accountId: account };

    const fields = { type, category_id: categoryId, to_payment_method_id: null, description: merchant ?? '' };
    return recordDecision(event, ctx, account, merchant !== null && FUEL_MERCHANT.test(merchant) ? fuel(event, ctx, fields) : fields, partners);
}

/** The account a waiting notice of the same payment resolves to, e.g. the 玉山 card notice for a LINE Pay payment. */
function partnerAccount(partners: PendingEvent[], ctx: DecisionContext): string | null {
    for (const partner of partners) {
        if (partner.kind === null) continue;
        const { accountId } = resolveAccount({ ...partner, kind: partner.kind }, ctx.accounts, ctx.rules);
        if (accountId !== null) return accountId;
    }
    return null;
}

type RecordFields = Pick<NewRecord, 'type' | 'category_id' | 'to_payment_method_id' | 'description'>;

/** A gas station purchase is filed as 加油 with the user's usual note. */
function fuel(event: ParsedEvent, ctx: DecisionContext, fields: RecordFields): RecordFields {
    const category = ctx.categories.find(c => c.type === 'expense' && c.name === FUEL_CATEGORY);
    const { date } = localDateTime(event.occurredAt);
    return { ...fields, category_id: category?.id ?? fields.category_id, description: `${date.slice(5, 7)}${date.slice(8, 10)}${FUEL_NOTE}` };
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
    fields: RecordFields,
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

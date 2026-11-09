import { describe, expect, it } from 'vitest';
import { AccountRef, decide, DecisionContext, ruleKey } from './decide';
import { CandidateRecord, findMergeTarget, isPossibleReplay, PendingEvent, unpaidCardAccounts } from './matching';
import type { ParsedEvent } from './parsers';

const ESUN_CARD = 'acc-esun-card';
const CATHAY_CARD = 'acc-cathay-card';
const LIVING = 'acc-living';

const accounts: AccountRef[] = [
    { id: ESUN_CARD, match_last4: ['1234'], archived: false, currency_code: 'TWD' },
    { id: CATHAY_CARD, match_last4: [], archived: false, currency_code: 'TWD' },
    { id: LIVING, match_last4: [], archived: false, currency_code: 'TWD' },
];

/** An event at Taiwan time hh:mm on 2026-11-07. */
function event(source: string, amount: number, at: string, extra: Partial<ParsedEvent> = {}): ParsedEvent {
    return {
        source, amount, kind: 'expense', currencyCode: 'TWD', merchant: null, last4: null,
        occurredAt: new Date(`2026-11-07T${at}:00+08:00`), ...extra,
    };
}

function record(id: string, amount: number, time: string | null, extra: Partial<CandidateRecord> = {}): CandidateRecord {
    return {
        id, amount, time, type: 'expense', payment_method_id: ESUN_CARD, to_payment_method_id: null,
        date: '2026-11-07', source: 'manual', is_distinct: false, linkedSources: [], ...extra,
    };
}

/** From a notification: its own source is already linked. */
const notified = (id: string, amount: number, time: string, source: string, extra: Partial<CandidateRecord> = {}) =>
    record(id, amount, time, { source: 'notification', linkedSources: [source], ...extra });

const esunCardRule = { source: 'esun_card', match_key: 'k:expense', payment_method_id: ESUN_CARD, category_id: null };

function ctx(overrides: Partial<DecisionContext> = {}): DecisionContext {
    return { mode: 'auto', accounts, categories: [], rules: [esunCardRule], candidates: [], pending: [], unpaidCardAccounts: [], isReplay: false, ...overrides };
}

describe('① same source, different notifications', () => {
    it('two 65 coffees a minute apart are two records', () => {
        const first = notified('r1', 65, '10:00', 'esun_card');
        const decision = decide(event('esun_card', 65, '10:01'), ctx({ candidates: [first] }));
        expect(decision.action).toBe('record');
    });
});

describe('② the same notification delivered twice', () => {
    const at = new Date('2026-11-07T02:00:00Z');
    const recent = [{ raw_hash: 'h1', received_at: at }];

    it('flags identical text within 90 seconds', () => {
        expect(isPossibleReplay('h1', new Date(at.getTime() + 60_000), recent)).toBe(true);
    });

    it('treats identical text minutes apart, or different text, as new', () => {
        expect(isPossibleReplay('h1', new Date(at.getTime() + 120_000), recent)).toBe(false);
        expect(isPossibleReplay('h2', at, recent)).toBe(false);
    });

    it('sends a suspected replay to review instead of dropping it', () => {
        expect(decide(event('esun_card', 65, '10:00'), ctx({ isReplay: true }))).toMatchObject({ action: 'review', reason: 'possible_replay' });
    });
});

describe('③ different sources, one purchase', () => {
    const cardRecord = notified('r1', 40, '12:00', 'esun_card');

    it('merges LINE Pay into the card record and fills the shop name', () => {
        const decision = decide(event('linepay', 40, '12:03', { merchant: '50嵐' }), ctx({ candidates: [cardRecord] }));
        expect(decision).toEqual({ action: 'merge', recordId: 'r1', fill: { description: '50嵐' } });
    });

    it('does not merge notifications more than 10 minutes apart', () => {
        expect(findMergeTarget(event('linepay', 40, '12:11'), null, [cardRecord])).toEqual({ kind: 'none' });
    });

    it('does not merge different amounts or income into expense', () => {
        expect(findMergeTarget(event('linepay', 41, '12:01'), null, [cardRecord]).kind).toBe('none');
        expect(findMergeTarget(event('linepay', 40, '12:01', { kind: 'income' }), null, [cardRecord]).kind).toBe('none');
    });

    it('a card notice arriving after LINE Pay absorbs the waiting LINE Pay event', () => {
        const pending: PendingEvent[] = [
            { id: 'e-linepay', source: 'linepay', kind: 'expense', amount: 40, merchant: '50嵐', occurredAt: new Date('2026-11-07T12:00:00+08:00') },
            { id: 'e-other-card', source: 'esun_card', kind: 'expense', amount: 40, merchant: null, occurredAt: new Date('2026-11-07T12:00:00+08:00') },
            { id: 'e-old', source: 'wallet', kind: 'expense', amount: 40, merchant: null, occurredAt: new Date('2026-11-07T11:00:00+08:00') },
        ];
        const decision = decide(event('esun_card', 40, '12:01'), ctx({ pending }));
        expect(decision).toMatchObject({ action: 'record', record: { description: '50嵐' }, mergePendingIds: ['e-linepay'] });
    });
});

describe('④ a notification for something already entered by hand', () => {
    const manual = record('m1', 65, '10:00');

    it('links to the manual record within 30 minutes', () => {
        expect(decide(event('esun_card', 65, '10:20'), ctx({ candidates: [manual] }))).toMatchObject({ action: 'merge', recordId: 'm1' });
    });

    it('records separately after 30 minutes', () => {
        expect(decide(event('esun_card', 65, '10:45'), ctx({ candidates: [manual] })).action).toBe('record');
    });

    it('never merges into a record marked as a separate purchase', () => {
        const distinct = record('m1', 65, '10:00', { is_distinct: true });
        expect(decide(event('esun_card', 65, '10:01'), ctx({ candidates: [distinct] })).action).toBe('record');
    });

    it('does not merge into a record in a different account', () => {
        const otherCard = record('m1', 65, '10:00', { payment_method_id: CATHAY_CARD });
        expect(decide(event('esun_card', 65, '10:01'), ctx({ candidates: [otherCard] })).action).toBe('record');
    });
});

describe('⑥ several candidates', () => {
    it('two identical manual coffees and two notifications pair off one-to-one', () => {
        const a = record('m1', 65, '10:00');
        const b = record('m2', 65, '10:05');
        const first = decide(event('esun_card', 65, '10:04'), ctx({ candidates: [a, b] }));
        expect(first).toMatchObject({ action: 'merge', recordId: 'm2' });

        const bLinked = { ...b, linkedSources: ['esun_card'] };
        const second = decide(event('esun_card', 65, '10:06'), ctx({ candidates: [a, bLinked] }));
        expect(second).toMatchObject({ action: 'merge', recordId: 'm1' });
    });

    it('asks when the matches are in different accounts and the event has no account', () => {
        const candidates = [record('m1', 65, '10:00'), record('m2', 65, '10:02', { payment_method_id: LIVING })];
        expect(decide(event('linepay', 65, '10:01'), ctx({ candidates }))).toMatchObject({ action: 'review', reason: 'ambiguous_match' });
    });

    it('asks rather than merging into a same-day record without a time', () => {
        const untimed = record('m1', 65, null);
        expect(decide(event('esun_card', 65, '10:00'), ctx({ candidates: [untimed] }))).toMatchObject({ action: 'review', reason: 'ambiguous_match' });
    });
});

describe('accounts, categories and modes', () => {
    it('asks for the account the first time, then remembers it', () => {
        expect(decide(event('esun_card', 59, '10:00'), ctx({ rules: [] }))).toMatchObject({ action: 'review', reason: 'unknown_account' });
        expect(decide(event('esun_card', 59, '10:00'), ctx())).toMatchObject({
            action: 'record',
            record: { type: 'expense', amount: 59, payment_method_id: ESUN_CARD, category_id: null, date: '2026-11-07', time: '10:00', source: 'notification' },
        });
    });

    it('routes by card suffix without any rule', () => {
        const decision = decide(event('wallet', 120, '10:00', { last4: '1234' }), ctx({ rules: [] }));
        expect(decision).toMatchObject({ action: 'record', record: { payment_method_id: ESUN_CARD } });
    });

    it('applies a remembered category only for a merchant', () => {
        const rules = [
            { source: 'esun_card', match_key: 'k:expense', payment_method_id: ESUN_CARD, category_id: 'cat-lunch' },
            { source: 'linepay', match_key: 'm:50嵐', payment_method_id: ESUN_CARD, category_id: 'cat-drink' },
        ];
        expect(decide(event('esun_card', 59, '10:00'), ctx({ rules }))).toMatchObject({ record: { category_id: null } });
        expect(decide(event('linepay', 40, '10:00', { merchant: '50嵐' }), ctx({ rules }))).toMatchObject({ record: { category_id: 'cat-drink' } });
        expect(ruleKey(event('linepay', 40, '10:00', { merchant: ' 50嵐 ' }))).toBe('m:50嵐');
    });

    it('holds bank account movements until their purpose is known', () => {
        const withdrawal = event('esun_account', 1000, '10:00', { kind: 'transfer_out' });
        const rules = [{ source: 'esun_account', match_key: 'k:transfer_out', payment_method_id: LIVING, category_id: null }];
        expect(decide(withdrawal, ctx({ rules }))).toMatchObject({ action: 'review', reason: 'needs_purpose', accountId: LIVING });
    });

    it('records a debit card purchase once its channel has an expense category', () => {
        const debit = event('cathay_account', 65, '10:00', { kind: 'transfer_out', merchant: '金融卡消費' });
        const rules = [{ source: 'cathay_account', match_key: 'm:金融卡消費', payment_method_id: LIVING, category_id: 'cat-food' }];
        const decision = decide(debit, ctx({ rules, categories: [{ id: 'cat-food', type: 'expense' }] }));
        expect(decision).toMatchObject({ action: 'record', record: { type: 'expense', payment_method_id: LIVING, category_id: 'cat-food' } });
    });

    it('ignores rules pointing at an archived account', () => {
        const archived = accounts.map(a => (a.id === ESUN_CARD ? { ...a, archived: true } : a));
        expect(decide(event('esun_card', 59, '10:00'), ctx({ accounts: archived }))).toMatchObject({ reason: 'unknown_account' });
    });

    it('review mode holds even fully resolved events', () => {
        expect(decide(event('esun_card', 59, '10:00'), ctx({ mode: 'review' }))).toMatchObject({ action: 'review', reason: 'review_mode' });
    });
});

describe('⑦ paying a card right after buying', () => {
    const livingDebitRule = { source: 'cathay_account', match_key: 'k:transfer_out', payment_method_id: LIVING, category_id: null };
    const debit = (amount: number) => event('cathay_account', amount, '12:30', { kind: 'transfer_out', merchant: '電支交易' });

    it('records a debit equal to an unpaid card purchase as a transfer to that card', () => {
        const decision = decide(debit(223), ctx({ rules: [livingDebitRule], unpaidCardAccounts: [ESUN_CARD] }));
        expect(decision).toMatchObject({
            action: 'record',
            record: { type: 'transfer', amount: 223, payment_method_id: LIVING, to_payment_method_id: ESUN_CARD, category_id: null },
        });
    });

    it('asks when two cards could be the one paid, or none', () => {
        expect(decide(debit(223), ctx({ rules: [livingDebitRule], unpaidCardAccounts: [ESUN_CARD, CATHAY_CARD] })))
            .toMatchObject({ action: 'review', reason: 'needs_purpose' });
        expect(decide(debit(223), ctx({ rules: [livingDebitRule] }))).toMatchObject({ action: 'review', reason: 'needs_purpose' });
    });

    it('asks when the debited account is not known yet', () => {
        expect(decide(debit(223), ctx({ rules: [], unpaidCardAccounts: [ESUN_CARD] }))).toMatchObject({ action: 'review', reason: 'needs_purpose' });
    });

    it('never merges the debit into the card purchase it pays', () => {
        const purchase = notified('r1', 223, '12:25', 'esun_card');
        expect(findMergeTarget(debit(223), null, [purchase])).toEqual({ kind: 'none' });
    });

    it('counts each earlier payment against one purchase', () => {
        expect(unpaidCardAccounts([ESUN_CARD, ESUN_CARD], [ESUN_CARD])).toEqual([ESUN_CARD]);
        expect(unpaidCardAccounts([ESUN_CARD], [ESUN_CARD])).toEqual([]);
        expect(unpaidCardAccounts([ESUN_CARD], [CATHAY_CARD])).toEqual([ESUN_CARD]);
    });
});

describe('⑧ a source with a new shop name each time', () => {
    const utaggoRule = { source: 'utaggo', match_key: 'k:expense', payment_method_id: ESUN_CARD, category_id: null };

    it('uses the account remembered for the source', () => {
        const decision = decide(event('utaggo', 175, '15:43', { merchant: '日月亭桃園藝文南' }), ctx({ rules: [utaggoRule] }));
        expect(decision).toMatchObject({ action: 'record', record: { payment_method_id: ESUN_CARD, description: '日月亭桃園藝文南', category_id: null } });
    });
});

import { describe, expect, it } from 'vitest';
import { AccountRef, decide, DecisionContext, ruleKey, waitsForPartner } from './decide';
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

/** A card notice whose shop is known, e.g. completed by a LINE Pay notice. */
const SHOP = { merchant: '咖啡店' };

const esunCardRule = { source: 'esun_card', match_key: 'k:expense', payment_method_id: ESUN_CARD, category_id: null };

function ctx(overrides: Partial<DecisionContext> = {}): DecisionContext {
    return { mode: 'auto', accounts, categories: [], rules: [esunCardRule], candidates: [], pending: [], unpaidCardAccounts: [], isReplay: false, ...overrides };
}

describe('① same source, different notifications', () => {
    it('two 65 coffees a minute apart are two records', () => {
        const first = notified('r1', 65, '10:00', 'esun_card');
        const decision = decide(event('esun_card', 65, '10:01', SHOP), ctx({ candidates: [first] }));
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
            { id: 'e-linepay', source: 'linepay', kind: 'expense', amount: 40, merchant: '50嵐', last4: null, occurredAt: new Date('2026-11-07T12:00:00+08:00') },
            { id: 'e-other-card', source: 'esun_card', kind: 'expense', amount: 40, merchant: null, last4: null, occurredAt: new Date('2026-11-07T12:00:00+08:00') },
            { id: 'e-old', source: 'wallet', kind: 'expense', amount: 40, merchant: null, last4: null, occurredAt: new Date('2026-11-07T11:00:00+08:00') },
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
        expect(decide(event('esun_card', 65, '10:45', SHOP), ctx({ candidates: [manual] })).action).toBe('record');
    });

    it('never merges into a record marked as a separate purchase', () => {
        const distinct = record('m1', 65, '10:00', { is_distinct: true });
        expect(decide(event('esun_card', 65, '10:01', SHOP), ctx({ candidates: [distinct] })).action).toBe('record');
    });

    it('does not merge into a record in a different account', () => {
        const otherCard = record('m1', 65, '10:00', { payment_method_id: CATHAY_CARD });
        expect(decide(event('esun_card', 65, '10:01', SHOP), ctx({ candidates: [otherCard] })).action).toBe('record');
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
        expect(decide(event('esun_card', 59, '10:00', SHOP), ctx())).toMatchObject({
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
            { source: 'cathay_card', match_key: 'm:50嵐', payment_method_id: CATHAY_CARD, category_id: 'cat-drink' },
        ];
        expect(decide(event('esun_card', 59, '10:00', SHOP), ctx({ rules }))).toMatchObject({ record: { category_id: null } });
        expect(decide(event('cathay_card', 40, '10:00', { merchant: '50嵐' }), ctx({ rules }))).toMatchObject({ record: { category_id: 'cat-drink' } });
        expect(ruleKey(event('cathay_card', 40, '10:00', { merchant: ' 50嵐 ' }))).toBe('m:50嵐');
    });

    it('holds bank account movements until their purpose is known', () => {
        const withdrawal = event('esun_account', 1000, '10:00', { kind: 'transfer_out' });
        const rules = [{ source: 'esun_account', match_key: 'k:transfer_out', payment_method_id: LIVING, category_id: null }];
        expect(decide(withdrawal, ctx({ rules }))).toMatchObject({ action: 'review', reason: 'needs_purpose', accountId: LIVING });
    });

    it('records a debit card purchase once its channel has an expense category', () => {
        const debit = event('cathay_account', 65, '10:00', { kind: 'transfer_out', merchant: '金融卡消費' });
        const rules = [{ source: 'cathay_account', match_key: 'm:金融卡消費', payment_method_id: LIVING, category_id: 'cat-food' }];
        const decision = decide(debit, ctx({ rules, categories: [{ id: 'cat-food', name: '餐飲', type: 'expense' }] }));
        expect(decision).toMatchObject({ action: 'record', record: { type: 'expense', payment_method_id: LIVING, category_id: 'cat-food' } });
    });

    it('ignores rules pointing at an archived account', () => {
        const archived = accounts.map(a => (a.id === ESUN_CARD ? { ...a, archived: true } : a));
        expect(decide(event('esun_card', 59, '10:00'), ctx({ accounts: archived }))).toMatchObject({ reason: 'unknown_account' });
    });

    it('review mode holds even fully resolved events', () => {
        expect(decide(event('esun_card', 59, '10:00', SHOP), ctx({ mode: 'review' }))).toMatchObject({ action: 'review', reason: 'review_mode' });
    });
});

describe('⑦ paying a card right after buying', () => {
    const livingDebitRule = { source: 'cathay_account', match_key: 'k:transfer_out', payment_method_id: LIVING, category_id: null };
    const debit = (amount: number, merchant: string | null = '信用卡款', source = 'cathay_account') =>
        event(source, amount, '12:30', { kind: 'transfer_out', merchant });

    it('records a debit labelled as a card payment as a transfer to the unpaid card', () => {
        const decision = decide(debit(223), ctx({ rules: [livingDebitRule], unpaidCardAccounts: [ESUN_CARD] }));
        expect(decision).toMatchObject({
            action: 'record',
            record: { type: 'transfer', amount: 223, payment_method_id: LIVING, to_payment_method_id: ESUN_CARD, category_id: null },
        });
    });

    it('only suggests the card when the debit does not say it pays a card', () => {
        expect(decide(debit(223, '網銀轉帳'), ctx({ rules: [livingDebitRule], unpaidCardAccounts: [ESUN_CARD] })))
            .toEqual({ action: 'review', reason: 'card_payment', accountId: LIVING, suggestedCardId: ESUN_CARD });
    });

    it('suggests the card for a 玉山 debit, which may come from either 玉山 account', () => {
        const esunDebitRule = { source: 'esun_account', match_key: 'k:transfer_out', payment_method_id: LIVING, category_id: null };
        expect(decide(debit(223, null, 'esun_account'), ctx({ rules: [esunDebitRule], unpaidCardAccounts: [ESUN_CARD] })))
            .toMatchObject({ action: 'review', reason: 'card_payment', suggestedCardId: ESUN_CARD });
    });

    it('suggests the card when the debited account is not known yet', () => {
        expect(decide(debit(223), ctx({ rules: [], unpaidCardAccounts: [ESUN_CARD] })))
            .toEqual({ action: 'review', reason: 'card_payment', accountId: null, suggestedCardId: ESUN_CARD });
    });

    it('asks for the purpose when two cards could be the one paid, or none', () => {
        expect(decide(debit(223), ctx({ rules: [livingDebitRule], unpaidCardAccounts: [ESUN_CARD, CATHAY_CARD] })))
            .toMatchObject({ action: 'review', reason: 'needs_purpose' });
        expect(decide(debit(223), ctx({ rules: [livingDebitRule] }))).toMatchObject({ action: 'review', reason: 'needs_purpose' });
    });

    it('keeps the suggestion in review mode', () => {
        expect(decide(debit(223), ctx({ mode: 'review', rules: [livingDebitRule], unpaidCardAccounts: [ESUN_CARD] })))
            .toMatchObject({ action: 'review', reason: 'review_mode', suggestedCardId: ESUN_CARD });
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

describe('⑨ LINE Pay charged to a card', () => {
    const linepay = (at: string) => event('linepay', 253, at, { merchant: '全都雞拉麵 西湖店' });

    it('waits for the card notice when LINE Pay arrives first', () => {
        expect(decide(linepay('12:06'), ctx())).toMatchObject({ action: 'review', reason: 'unknown_account', accountId: null });
    });

    it('the card notice takes the waiting LINE Pay shop name', () => {
        const waiting: PendingEvent = { id: 'e1', source: 'linepay', kind: 'expense', amount: 253, merchant: '全都雞拉麵 西湖店', last4: null, occurredAt: linepay('12:06').occurredAt };
        expect(decide(event('esun_card', 253, '12:07'), ctx({ pending: [waiting] }))).toMatchObject({
            action: 'record', record: { payment_method_id: ESUN_CARD, description: '全都雞拉麵 西湖店' }, mergePendingIds: ['e1'],
        });
    });

    it('LINE Pay arriving after the card notice fills in the shop name', () => {
        const card = notified('r1', 253, '12:06', 'esun_card');
        expect(decide(linepay('12:07'), ctx({ candidates: [card] })))
            .toEqual({ action: 'merge', recordId: 'r1', fill: { description: '全都雞拉麵 西湖店' } });
    });

    it('ignores a remembered account, which could book a card payment twice', () => {
        const walletRule = { source: 'linepay', match_key: 'k:expense', payment_method_id: LIVING, category_id: null };
        const card = notified('r1', 253, '12:06', 'esun_card');
        expect(decide(linepay('12:07'), ctx({ rules: [walletRule], candidates: [card] }))).toMatchObject({ action: 'merge', recordId: 'r1' });
    });
});

describe('⑩ a card purchase with no shop name', () => {
    const waiting = (source: string, merchant: string | null): PendingEvent =>
        ({ id: `e-${source}`, source, kind: 'expense', amount: 76, merchant, last4: null, occurredAt: new Date('2026-11-07T12:00:00+08:00') });

    it('waits for the shop name with the card already chosen', () => {
        expect(decide(event('esun_card', 76, '12:01'), ctx()))
            .toEqual({ action: 'review', reason: 'needs_merchant', accountId: ESUN_CARD, suggestedAccountId: ESUN_CARD });
    });

    it('a waiting 全盈+PAY notice names the shop', () => {
        expect(decide(event('esun_card', 76, '12:01'), ctx({ pending: [waiting('pluspay', '全家便利商店')] }))).toMatchObject({
            action: 'record', record: { payment_method_id: ESUN_CARD, description: '全家便利商店' }, mergePendingIds: ['e-pluspay'],
        });
    });

    it('a wallet notice arriving later files the waiting card notice under the card', () => {
        const decision = decide(event('pluspay', 76, '12:02', { merchant: '全家便利商店' }), ctx({ pending: [waiting('esun_card', null)] }));
        expect(decision).toMatchObject({
            action: 'record', record: { payment_method_id: ESUN_CARD, description: '全家便利商店' }, mergePendingIds: ['e-esun_card'],
        });
    });

    it('a LINE Pay notice arriving later does the same', () => {
        const decision = decide(event('linepay', 76, '12:02', { merchant: '全都雞拉麵 西湖店' }), ctx({ pending: [waiting('esun_card', null)] }));
        expect(decision).toMatchObject({ action: 'record', record: { payment_method_id: ESUN_CARD }, mergePendingIds: ['e-esun_card'] });
    });

    it('keeps purchases from sources that never name a shop as before', () => {
        expect(decide(event('wallet', 120, '10:00', { last4: '1234' }), ctx({ rules: [] }))).toMatchObject({ action: 'record' });
    });
});

describe('⑪ fuel paid with LINE Pay', () => {
    const FUEL = { id: 'cat-fuel', name: '加油', type: 'expense' as const };
    const waitingCard: PendingEvent = { id: 'e-card', source: 'esun_card', kind: 'expense', amount: 1200, merchant: null, last4: null, occurredAt: new Date('2026-11-10T08:00:00+08:00') };
    const linepay = (merchant: string) => event('linepay', 1200, '08:01', { merchant, occurredAt: new Date('2026-11-10T08:01:00+08:00') });

    it('files a 中油 purchase as 加油 with the usual note', () => {
        expect(decide(linepay('台灣中油 中壢站'), ctx({ categories: [FUEL], pending: [waitingCard] }))).toMatchObject({
            action: 'record', record: { payment_method_id: ESUN_CARD, category_id: 'cat-fuel', description: '1110汽車加油' },
        });
    });

    it('leaves other shops uncategorised', () => {
        expect(decide(linepay('全都雞拉麵 西湖店'), ctx({ categories: [FUEL], pending: [waitingCard] })))
            .toMatchObject({ record: { category_id: null, description: '全都雞拉麵 西湖店' } });
    });
});

describe('⑫ wallet and card notices arriving in the same second', () => {
    it('the LINE Pay side waits and decides again; the card side does not', () => {
        expect(waitsForPartner(decide(event('linepay', 299, '20:12', { merchant: 'POPEYES 瑞光門市(線上點餐)' }), ctx()))).toBe(true);
        expect(waitsForPartner(decide(event('esun_card', 299, '20:12'), ctx()))).toBe(false);
    });

    it('after the wait it finds the card notice stored meanwhile', () => {
        const waitingCard: PendingEvent = { id: 'e-card', source: 'esun_card', kind: 'expense', amount: 299, merchant: null, last4: null, occurredAt: new Date('2026-11-07T20:12:00+08:00') };
        expect(decide(event('linepay', 299, '20:12', { merchant: 'POPEYES 瑞光門市(線上點餐)' }), ctx({ pending: [waitingCard] }))).toMatchObject({
            action: 'record', record: { payment_method_id: ESUN_CARD, description: 'POPEYES 瑞光門市(線上點餐)' }, mergePendingIds: ['e-card'],
        });
    });
});

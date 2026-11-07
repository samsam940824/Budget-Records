import { describe, expect, it } from 'vitest';
import { findImportDuplicates, findLikelyAutoDuplicate, ImportCandidate } from './duplicates';
import { Record } from '../types/database.types';

const CARD = 'acc-card';
const LIVING = 'acc-living';

function record(id: string, amount: number, date: string, extra: Partial<Record> = {}): Record {
    return {
        id, amount, date, user_id: 'u', type: 'expense', category_id: null, time: null, description: '',
        currency_code: 'TWD', location: '', payment_method_id: CARD, to_payment_method_id: null, ...extra,
    };
}

const row = (line: number, amount: number, date: string, extra: Partial<ImportCandidate> = {}): ImportCandidate =>
    ({ line, amount, date, type: 'expense', accountId: CARD, toAccountId: null, ...extra });

describe('findImportDuplicates', () => {
    it('skips a statement row posted a few days after the recorded purchase', () => {
        expect(findImportDuplicates([row(2, 65, '2026-10-31')], [record('r1', 65, '2026-10-28')])).toEqual(new Map([[2, 'r1']]));
    });

    it('keeps rows more than 3 days away, with another amount, account or type', () => {
        const existing = [record('r1', 65, '2026-10-28')];
        expect(findImportDuplicates([
            row(2, 65, '2026-11-01'),
            row(3, 66, '2026-10-28'),
            row(4, 65, '2026-10-28', { accountId: LIVING }),
            row(5, 65, '2026-10-28', { type: 'income' }),
        ], existing).size).toBe(0);
    });

    it('never matches rows whose account does not exist yet', () => {
        expect(findImportDuplicates([row(2, 65, '2026-10-28', { accountId: null })], [record('r1', 65, '2026-10-28', { payment_method_id: null })]).size).toBe(0);
    });

    it('pairs one-to-one: two identical coffees in the file, one already recorded', () => {
        const result = findImportDuplicates([row(2, 65, '2026-10-28'), row(3, 65, '2026-10-28')], [record('r1', 65, '2026-10-28')]);
        expect(result.size).toBe(1);
    });

    it('gives each record to the closest row', () => {
        const result = findImportDuplicates([row(2, 65, '2026-10-30'), row(3, 65, '2026-10-28')], [record('r1', 65, '2026-10-28')]);
        expect(result).toEqual(new Map([[3, 'r1']]));
    });

    it('matches transfers only with the same destination', () => {
        const transfer = record('r1', 9371, '2026-11-05', { type: 'transfer', payment_method_id: LIVING, to_payment_method_id: CARD });
        expect(findImportDuplicates([row(2, 9371, '2026-11-05', { type: 'transfer', accountId: LIVING, toAccountId: CARD })], [transfer]).size).toBe(1);
        expect(findImportDuplicates([row(2, 9371, '2026-11-05', { type: 'transfer', accountId: LIVING, toAccountId: 'other' })], [transfer]).size).toBe(0);
    });
});

describe('findLikelyAutoDuplicate', () => {
    const auto = record('a1', 65, '2026-11-07', { source: 'notification', time: '10:00:00' });
    const draft = { type: 'expense' as const, amount: 65, date: '2026-11-07', time: '10:20', payment_method_id: CARD };

    it('warns about an automatic record within 30 minutes', () => {
        expect(findLikelyAutoDuplicate(draft, [auto])?.id).toBe('a1');
    });

    it('does not warn after 30 minutes, for manual records or other accounts', () => {
        expect(findLikelyAutoDuplicate({ ...draft, time: '10:31' }, [auto])).toBeUndefined();
        expect(findLikelyAutoDuplicate(draft, [{ ...auto, source: 'manual' }])).toBeUndefined();
        expect(findLikelyAutoDuplicate({ ...draft, payment_method_id: LIVING }, [auto])).toBeUndefined();
    });

    it('compares by day when the draft has no time', () => {
        expect(findLikelyAutoDuplicate({ ...draft, time: null }, [auto])?.id).toBe('a1');
    });
});

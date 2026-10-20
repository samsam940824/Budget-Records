import { describe, expect, it } from 'vitest';
import {
    buildMenu, INCOME_PREFIX, localDateTime, MenuAccount, MenuCategory, parseEntryAmount, resolveEntry, sha256Hex, TRANSFER_LABEL,
} from './logic';

const account = (id: string, name: string, sort_order: number, archived = false): MenuAccount =>
    ({ id, name, sort_order, archived, currency_code: 'TWD' });
const category = (id: string, name: string, sort_order: number, type: 'expense' | 'income' = 'expense'): MenuCategory =>
    ({ id, name, sort_order, type });

const accounts = [account('a1', '生活費', 1), account('a2', '玉山信用卡', 2), account('a3', '現金', 3, true)];
const categories = [category('c1', '午餐', 1), category('c2', '加油', 2), category('c3', '薪資', 101, 'income')];
// 2026-10-20 23:30 in Taiwan, already the 20th there but 15:30 UTC.
const now = new Date('2026-10-20T15:30:00Z');

describe('buildMenu', () => {
    it('hides archived accounts and sorts by recent use, then sort order', () => {
        const menu = buildMenu(accounts, categories, [
            { category_id: 'c2', payment_method_id: 'a2' },
            { category_id: 'c2', payment_method_id: 'a2' },
            { category_id: 'c1', payment_method_id: 'a1' },
        ]);
        expect(menu.accounts).toEqual(['玉山信用卡', '生活費']);
        expect(menu.categories).toEqual(['加油', '午餐', `${INCOME_PREFIX}薪資`, TRANSFER_LABEL]);
    });
});

describe('parseEntryAmount', () => {
    it('accepts numbers and grouped numeric strings', () => {
        expect(parseEntryAmount(120)).toBe(120);
        expect(parseEntryAmount('1,200')).toBe(1200);
        expect(parseEntryAmount(' 59.5 ')).toBe(59.5);
    });

    it('rejects zero, negatives, junk, too many decimals and absurd amounts', () => {
        for (const bad of [0, -5, '', 'abc', '1.234', '1e5', null, undefined, 100_000_001]) {
            expect(parseEntryAmount(bad)).toBeNull();
        }
    });
});

describe('localDateTime', () => {
    it('uses the Taiwan wall clock, not UTC', () => {
        expect(localDateTime(now)).toEqual({ date: '2026-10-20', time: '23:30' });
        expect(localDateTime(new Date('2026-10-20T16:05:00Z'))).toEqual({ date: '2026-10-21', time: '00:05' });
    });
});

describe('resolveEntry', () => {
    it('records an expense on the chosen account', () => {
        const result = resolveEntry({ account: '玉山信用卡', category: '午餐', amount: '120', note: ' 便當 ' }, accounts, categories, now);
        expect(result).toEqual({
            ok: true,
            record: {
                type: 'expense', amount: 120, category_id: 'c1', payment_method_id: 'a2', to_payment_method_id: null,
                description: '便當', location: '', currency_code: 'TWD', date: '2026-10-20', time: '23:30',
            },
            message: '已記帳：午餐 $120（玉山信用卡）',
        });
    });

    it('takes the income type from an income category label', () => {
        const result = resolveEntry({ account: '生活費', category: `${INCOME_PREFIX}薪資`, amount: 50000 }, accounts, categories, now);
        expect(result.ok && result.record.type).toBe('income');
        expect(result.ok && result.record.category_id).toBe('c3');
    });

    it('records a transfer such as a card payment', () => {
        const result = resolveEntry({ account: '生活費', category: TRANSFER_LABEL, to_account: '玉山信用卡', amount: 5000 }, accounts, categories, now);
        expect(result).toMatchObject({
            ok: true,
            record: { type: 'transfer', category_id: null, payment_method_id: 'a1', to_payment_method_id: 'a2', amount: 5000 },
            message: '已轉帳：生活費 → 玉山信用卡 $5,000',
        });
    });

    it('rejects unknown or archived accounts, bad targets, categories and amounts', () => {
        const cases = [
            { account: '不存在', category: '午餐', amount: 1 },
            { account: '現金', category: '午餐', amount: 1 },
            { account: '生活費', category: '不存在', amount: 1 },
            { account: '生活費', category: '午餐', amount: 0 },
            { account: '生活費', category: TRANSFER_LABEL, amount: 1 },
            { account: '生活費', category: TRANSFER_LABEL, to_account: '生活費', amount: 1 },
            { account: '生活費', category: '午餐', amount: 1, note: 'x'.repeat(201) },
        ];
        for (const input of cases) expect(resolveEntry(input, accounts, categories, now).ok).toBe(false);
    });
});

describe('sha256Hex', () => {
    it('matches the standard test vector', async () => {
        expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
});

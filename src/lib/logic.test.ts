import { describe, expect, it } from 'vitest';
import { accountBalances, netWorth, periodTotals } from './balances';
import { budgetPeriod, budgetSpent } from './budget';
import { parseAmount, parseCsv, previewImport, recordsToCsv, toCsv } from './csv';
import { addMonthsClamped, todayString } from './dates';
import { dueOccurrences, occurrence } from './recurring';
import { Record } from '../types/database.types';

const rec = (over: Partial<Record>): Record => ({
    id: 'r', user_id: 'u', type: 'expense', amount: 0, category_id: null,
    date: '2026-01-01', time: null, description: '', currency_code: 'TWD',
    location: '', payment_method_id: null, to_payment_method_id: null, ...over,
});

describe('dates', () => {
    it('uses the local calendar day', () => {
        expect(todayString(new Date(2026, 9, 18, 7, 30))).toBe('2026-10-18');
    });
    it('clamps month-end days', () => {
        expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
        expect(addMonthsClamped('2026-01-31', 2, 31)).toBe('2026-03-31');
        expect(addMonthsClamped('2026-03-15', -3)).toBe('2025-12-15');
    });
});

describe('recurring', () => {
    const monthly = { frequency: 'monthly' as const, interval_count: 1, start_date: '2026-01-31' };

    it('keeps the anchor day across short months', () => {
        expect([0, 1, 2, 3].map(n => occurrence(monthly, n)))
            .toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    });

    it('generates every missed occurrence up to today', () => {
        const r = dueOccurrences({ ...monthly, end_date: null, next_date: '2026-01-31' }, '2026-04-15');
        expect(r.dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
        expect(r.nextDate).toBe('2026-04-30');
        expect(r.finished).toBe(false);
    });

    it('does not regenerate occurrences before next_date', () => {
        const r = dueOccurrences({ ...monthly, end_date: null, next_date: '2026-03-31' }, '2026-04-15');
        expect(r.dates).toEqual(['2026-03-31']);
    });

    it('keeps a future next_date', () => {
        const r = dueOccurrences(
            { frequency: 'weekly', interval_count: 2, start_date: '2026-11-01', end_date: null, next_date: '2026-11-01' },
            '2026-10-18',
        );
        expect(r.dates).toEqual([]);
        expect(r.nextDate).toBe('2026-11-01');
    });

    it('finishes after the end date', () => {
        const r = dueOccurrences(
            { frequency: 'daily', interval_count: 1, start_date: '2026-10-01', end_date: '2026-10-03', next_date: '2026-10-01' },
            '2026-10-18',
        );
        expect(r.dates).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
        expect(r.finished).toBe(true);
    });
});

describe('balances', () => {
    const accounts = [
        { id: 'cash', initial_balance: 1000, include_in_total: true, archived: false },
        { id: 'bank', initial_balance: 5000, include_in_total: true, archived: false },
        { id: 'card', initial_balance: 0, include_in_total: false, archived: false },
    ];
    const records = [
        rec({ type: 'expense', amount: 200, payment_method_id: 'cash', date: '2026-10-01' }),
        rec({ type: 'income', amount: 30000, payment_method_id: 'bank', date: '2026-10-05' }),
        rec({ type: 'transfer', amount: 2000, payment_method_id: 'bank', to_payment_method_id: 'cash', date: '2026-10-06' }),
        rec({ type: 'expense', amount: 999, payment_method_id: 'cash', date: '2026-12-01' }),
    ];

    it('applies income, expenses and transfers up to the date', () => {
        const b = accountBalances(accounts, records, '2026-10-18');
        expect(b.get('cash')).toBe(2800);
        expect(b.get('bank')).toBe(33000);
        expect(netWorth(accounts, b)).toBe(35800);
    });

    it('excludes transfers from income and expense totals', () => {
        expect(periodTotals(records.slice(0, 3))).toEqual({ income: 30000, expense: 200, net: 29800, count: 2 });
    });
});

describe('budget periods', () => {
    const base = { start_date: '2020-01-01', end_date: null };

    it('starts monthly budgets on the reset day', () => {
        expect(budgetPeriod({ ...base, repeat: 'monthly' }, 25, '2026-10-18')).toEqual({ start: '2026-09-25', end: '2026-10-24' });
        expect(budgetPeriod({ ...base, repeat: 'monthly' }, 25, '2026-10-26')).toEqual({ start: '2026-10-25', end: '2026-11-24' });
    });

    it('clamps a reset day of 31 in short months', () => {
        expect(budgetPeriod({ ...base, repeat: 'monthly' }, 31, '2026-02-28')).toEqual({ start: '2026-02-28', end: '2026-03-30' });
    });

    it('counts all expense categories when category is empty', () => {
        const records = [
            rec({ type: 'expense', amount: 100, category_id: 'food', date: '2026-10-02' }),
            rec({ type: 'expense', amount: 50, category_id: 'bus', date: '2026-10-03' }),
            rec({ type: 'income', amount: 9999, category_id: 'food', date: '2026-10-03' }),
        ];
        const period = { start: '2026-10-01', end: '2026-10-31' };
        expect(budgetSpent({ category_id: null }, records, period)).toBe(150);
        expect(budgetSpent({ category_id: 'food' }, records, period)).toBe(100);
    });
});

describe('csv', () => {
    it('round-trips quotes, commas and newlines', () => {
        const rows = [['a', 'b,c', 'say "hi"', 'line1\nline2']];
        expect(parseCsv(toCsv(rows))).toEqual(rows);
    });

    it('parses common amount formats', () => {
        expect(parseAmount('NT$1,234')).toBe(1234);
        expect(parseAmount('-12.5')).toBe(-12.5);
        expect(parseAmount('(80)')).toBe(-80);
        expect(parseAmount('1.234,56')).toBe(1234.56);
        expect(parseAmount('12,50')).toBe(12.5);
        expect(parseAmount('abc')).toBeNull();
    });

    it('imports its own export', () => {
        const csv = recordsToCsv(
            [
                rec({ type: 'expense', amount: 120, category_id: 'c1', payment_method_id: 'a1', date: '2026-10-01', time: '08:30:00', description: '早餐, 咖啡' }),
                rec({ type: 'transfer', amount: 500, payment_method_id: 'a1', to_payment_method_id: 'a2', date: '2026-10-02' }),
            ],
            [{ id: 'c1', name: '餐飲' }],
            [{ id: 'a1', name: '現金' }, { id: 'a2', name: '銀行' }],
        );
        const p = previewImport(csv);
        expect(p.errors).toEqual([]);
        expect(p.rows.map(r => [r.date, r.time, r.type, r.amount, r.categoryName, r.accountName, r.toAccountName, r.description]))
            .toEqual([
                ['2026-10-01', '08:30', 'expense', 120, '餐飲', '現金', '', '早餐, 咖啡'],
                ['2026-10-02', null, 'transfer', 500, '', '現金', '銀行', ''],
            ]);
    });

    it('reads Chinese headers and signed bank amounts', () => {
        const p = previewImport('日期,金額,備註\n2026/10/3,-250,午餐\n2026/10/5,"32,000",薪水\n2026/13/1,5,壞日期');
        expect(p.rows.map(r => [r.date, r.type, r.amount])).toEqual([
            ['2026-10-03', 'expense', 250],
            ['2026-10-05', 'income', 32000],
        ]);
        expect(p.errors).toHaveLength(1);
        expect(p.errors[0].line).toBe(4);
    });

    it('reports missing required columns', () => {
        expect(previewImport('name,value\nx,1').missingColumns).toEqual(['date']);
    });
});

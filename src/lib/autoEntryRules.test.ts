import { describe, expect, it } from 'vitest';
import { previewRemember, rememberedAccountId, ruleAutoRecords, ruleKeyLabel } from './autoEntryRules';

const OTHER_INCOME = { name: '其他收入', type: 'income' as const };
const FOOD = { name: '餐飲', type: 'expense' as const };

describe('ruleKeyLabel', () => {
    it('shows the merchant or the kind of notification', () => {
        expect(ruleKeyLabel('m:電支交易')).toBe('電支交易');
        expect(ruleKeyLabel('k:expense')).toBe('消費');
        expect(ruleKeyLabel('k:transfer_out')).toBe('出帳');
    });
});

describe('rememberedAccountId', () => {
    const transfer = { type: 'transfer' as const, payment_method_id: 'linepay', to_payment_method_id: 'living' };

    it('remembers the destination for money coming in', () => {
        expect(rememberedAccountId('transfer_in', transfer)).toBe('living');
    });

    it('remembers the source account otherwise', () => {
        expect(rememberedAccountId('transfer_out', transfer)).toBe('linepay');
        expect(rememberedAccountId('transfer_in', { ...transfer, type: 'income' })).toBe('linepay');
    });
});

describe('ruleAutoRecords', () => {
    it('always records purchases', () => {
        expect(ruleAutoRecords('expense', undefined)).toBe(true);
    });

    it('records account movements only with a category of the same direction', () => {
        expect(ruleAutoRecords('transfer_in', undefined)).toBe(false);
        expect(ruleAutoRecords('transfer_in', FOOD)).toBe(false);
        expect(ruleAutoRecords('transfer_in', OTHER_INCOME)).toBe(true);
        expect(ruleAutoRecords('transfer_out', FOOD)).toBe(true);
    });
});

describe('previewRemember', () => {
    it('warns when an income category makes every deposit automatic income', () => {
        const preview = previewRemember({ kind: 'transfer_in', merchant: '電支交易' }, '國泰帳戶通知', '生活費', OTHER_INCOME);
        expect(preview.warn).toBe(true);
        expect(preview.text).toBe('之後「國泰帳戶通知・電支交易」的入帳都會自動記成收入「其他收入」，記到「生活費」，不會再問你。');
    });

    it('keeps asking about account movements filed as transfers', () => {
        const preview = previewRemember({ kind: 'transfer_in', merchant: '電支交易' }, '國泰帳戶通知', '生活費', undefined);
        expect(preview).toEqual({ text: '會記住帳戶「生活費」；之後「國泰帳戶通知・電支交易」的入帳仍會請你確認用途。', warn: false });
    });

    it('explains that a labelled card payment is booked automatically', () => {
        const preview = previewRemember({ kind: 'transfer_out', merchant: '信用卡款' }, '國泰帳戶通知', '生活費', undefined);
        expect(preview.text).toBe('之後「國泰帳戶通知・信用卡款」的出帳金額對得上兩天內還沒繳的刷卡時，會自動記成「生活費 → 那張卡」；對不上的仍會請你確認。');
    });

    it('says the category is not remembered for card notices without a merchant', () => {
        const preview = previewRemember({ kind: 'expense', merchant: null }, '玉山信用卡通知', '玉山信用卡', FOOD);
        expect(preview.text).toBe('之後「玉山信用卡通知」的消費會自動記到「玉山信用卡」，分類要自己補。');
    });

    it('remembers the category for a named merchant', () => {
        const preview = previewRemember({ kind: 'expense', merchant: '7-ELEVEN' }, '國泰信用卡通知', '國泰信用卡', FOOD);
        expect(preview.text).toBe('之後「國泰信用卡通知・7-ELEVEN」的消費會自動記到「國泰信用卡」，分類「餐飲」。國泰信用卡通知其他店家的消費也會記到這個帳戶。');
    });
});

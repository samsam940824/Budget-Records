import { describe, expect, it } from 'vitest';
import { normalizeText, parseNotification, ParsedEvent } from './parsers';

const received = new Date('2026-11-07T02:05:00Z'); // 10:05 in Taiwan

function parsed(text: string): ParsedEvent {
    const result = parseNotification(text, received);
    if (result.status !== 'parsed') throw new Error(`expected parsed, got ${result.status}`);
    return result.event;
}

describe('玉山', () => {
    it('reads a card purchase, timed when it was received', () => {
        expect(parsed('玉山銀行\n信用卡消費59元通知')).toMatchObject({
            source: 'esun_card', kind: 'expense', amount: 59, merchant: null, occurredAt: received,
        });
    });

    it('reads account withdrawals and deposits with grouped amounts', () => {
        expect(parsed('玉山銀行\n台幣帳戶金額異動～提台幣1,000元')).toMatchObject({ source: 'esun_account', kind: 'transfer_out', amount: 1000 });
        expect(parsed('玉山銀行 台幣帳戶金額異動~存台幣 50 元')).toMatchObject({ source: 'esun_account', kind: 'transfer_in', amount: 50 });
    });

    it('needs the 玉山 sender line for a card purchase', () => {
        expect(parseNotification('信用卡消費59元通知', received).status).toBe('unparsed');
    });
});

describe('國泰', () => {
    it('reads the account debit with its own timestamp and channel', () => {
        expect(parsed('國泰世華\n【帳戶出帳通知】您於 2026/10/19 18:00:30 網銀轉帳,金額為 NT$1元')).toMatchObject({
            source: 'cathay_account', kind: 'transfer_out', amount: 1, merchant: '網銀轉帳',
            occurredAt: new Date('2026-10-19T10:00:30Z'),
        });
    });

    it('reads the account credit', () => {
        expect(parsed('【帳戶入帳通知】您於 2026/1/5 9:03:00 跨行轉入，金額為 NT$2,500元')).toMatchObject({
            kind: 'transfer_in', amount: 2500, occurredAt: new Date('2026-01-05T01:03:00Z'),
        });
    });
});

describe('not transactions', () => {
    it.each([
        ['card payment received', '玉山銀行\n信用卡繳款入帳通知'],
        ['Cathay LINE duplicate', '你有一筆存款入帳囉'],
        ['OTP', '您的驗證碼為 123456，交易金額 NT$500'],
        ['promotion quoting a percentage and amount', '國泰世華 最高可折抵 30%，滿千送 100 元'],
        ['bill reminder', '您本期帳單已出，應繳金額 NT$9,371 元'],
        ['chat', '今天晚上吃什麼？'],
    ])('drops a %s', (_, text) => {
        expect(parseNotification(text, received).status).toBe('ignored');
    });
});

describe('needs review', () => {
    it('keeps unknown formats that mention money', () => {
        expect(parseNotification('某某支付 付款 NT$120', received).status).toBe('unparsed');
    });

    it('keeps refunds even when they look like a purchase', () => {
        expect(parseNotification('玉山銀行\n信用卡消費59元 交易取消', received).status).toBe('unparsed');
    });
});

describe('normalizeText', () => {
    it('makes whitespace variants identical so replays hash the same', () => {
        expect(normalizeText(' 玉山銀行\n  信用卡消費59元通知 ')).toBe(normalizeText('玉山銀行 信用卡消費59元通知'));
    });
});

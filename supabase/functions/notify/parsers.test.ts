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

describe('國泰信用卡', () => {
    it('reads amount, card suffix, time and merchant despite the points promotion', () => {
        const text = '國泰世華\n【刷卡通知】金額NT$59元\n卡號末四碼6322於 2026/11/09 20:30在連加刷卡。立即以點數即時折抵，最高可折抵消費金額30%，點擊查看消費明細';
        expect(parsed(text)).toMatchObject({
            source: 'cathay_card', kind: 'expense', amount: 59, last4: '6322', merchant: '連加',
            occurredAt: new Date('2026-11-09T12:30:00Z'),
        });
    });
});

describe('uTagGo', () => {
    it('reads the parking fee on exit', () => {
        const text = 'uTagGo\nBGW-6189於 2026/11/08 15:43自日月亭桃園藝文南離場，費用175元將為您自動代扣，使用uTagGo App查詢明細最方便。';
        expect(parsed(text)).toMatchObject({
            source: 'utaggo', kind: 'expense', amount: 175, merchant: '日月亭桃園藝文南',
            occurredAt: new Date('2026-11-08T07:43:00Z'),
        });
    });

    it('drops the entry notice', () => {
        const text = 'uTagGo\nBGW-6189於 2026/11/08 16:18進入力揚中壢中原國小，提醒您，本車採用「eTag停車扣繳」自動扣款，離場前請無須再至繳費機繳費即可直接出場，謝謝您的愛用。';
        expect(parseNotification(text, received).status).toBe('ignored');
    });
});

describe('LINE Pay', () => {
    it('reads the amount and shop name of a payment', () => {
        const text = 'LINE Pay 付款 NT$ 253 付款完成。 商店名稱: 全都雞拉麵 西湖店';
        expect(parsed(text)).toMatchObject({ source: 'linepay', kind: 'expense', amount: 253, merchant: '全都雞拉麵 西湖店', occurredAt: received });
    });

    it('keeps a payment without a shop name', () => {
        expect(parsed('LINE Pay 付款 NT$ 1,280 付款完成。')).toMatchObject({ source: 'linepay', amount: 1280, merchant: null });
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

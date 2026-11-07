// Turns forwarded notification text into a structured event. Pure functions,
// no Deno or Supabase APIs, so vitest can import them.
//
// Parsers match on the text itself rather than the sending app, because one
// iOS automation forwards several apps and the text is what it reliably has.

import { parseEntryAmount } from '../quick-entry/logic.ts';

/**
 * 'expense' / 'income' are card or wallet payments. 'transfer_out' /
 * 'transfer_in' are bank account movements whose purpose (card payment,
 * withdrawal, transfer) the notification does not say.
 */
export type EventKind = 'expense' | 'income' | 'transfer_out' | 'transfer_in';

export interface ParsedEvent {
    /** Channel such as 'esun_card'; two events from one source are never merged. */
    source: string;
    kind: EventKind;
    amount: number;
    currencyCode: string;
    merchant: string | null;
    last4: string | null;
    occurredAt: Date;
}

export type ParseResult =
    | { status: 'parsed'; event: ParsedEvent }
    /** Not a transaction (OTP, promotion, chat); dropped without storing. */
    | { status: 'ignored' }
    /** Mentions money but no parser understood it; kept for review. */
    | { status: 'unparsed' };

/** Taiwan has no DST, so bank timestamps are a fixed UTC+8. */
const TAIPEI_OFFSET = '+08:00';
const AMOUNT = '([0-9][0-9,]*(?:\\.[0-9]{1,2})?)';

/** Notifications that are about money but must not become records. */
const IGNORE_PATTERNS: RegExp[] = [
    /信用卡繳款入帳通知/, // card payment received; the bank debit is recorded instead
    /你有一筆存款入帳囉/, // Cathay LINE duplicate of the app's 入帳 notice
    /驗證碼|OTP/i,
];

/** Cancellations and refunds reverse an earlier record, so a human decides. */
const REVERSAL = /取消交易|交易取消|取消付款|退款|退貨|刷退/;

/**
 * Promotions, bill reminders and loan offers quote amounts but are not
 * transactions. Only consulted for text no parser understood.
 */
const NOT_A_TRANSACTION = /優惠|免運|折扣|折價|限時|特價|活動期間|即日起|滿\s*\S{0,6}\s*(?:送|折)|紅利|點數|帳單已出|應繳|繳款截止|到期|貸款|申貸|額度/;

/** Anything else still mentioning an amount is worth a human look. */
const MONEY_HINT = /NT\$\s*[0-9]|\$\s*[0-9]|[0-9][0-9,]*\s*元/;

interface Parser {
    source: string;
    pattern: RegExp;
    build: (match: RegExpMatchArray, receivedAt: Date) => Omit<ParsedEvent, 'source' | 'currencyCode' | 'last4'> | null;
}

function cathayTime(m: RegExpMatchArray): Date {
    const [, y, mo, d, h, mi, s] = m;
    const pad = (v: string) => v.padStart(2, '0');
    return new Date(`${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${mi}:${s}${TAIPEI_OFFSET}`);
}

function simple(kind: EventKind) {
    return (m: RegExpMatchArray, receivedAt: Date) => {
        const amount = parseEntryAmount(m[1]);
        return amount === null ? null : { kind, amount, merchant: null, occurredAt: receivedAt };
    };
}

function cathayAccount(kind: EventKind) {
    return (m: RegExpMatchArray) => {
        const amount = parseEntryAmount(m[8]);
        const channel = m[7].trim();
        return amount === null ? null : { kind, amount, merchant: channel || null, occurredAt: cathayTime(m) };
    };
}

const CATHAY_ACCOUNT = (label: string) => new RegExp(
    `【帳戶${label}通知】\\s*您於\\s*(\\d{4})/(\\d{1,2})/(\\d{1,2})\\s+(\\d{1,2}):(\\d{2}):(\\d{2})\\s*(.*?)[,，]\\s*金額為\\s*NT\\$\\s*${AMOUNT}\\s*元`,
);

// Samples: 玉山銀行「信用卡消費59元通知」「台幣帳戶金額異動～提台幣1,000元」;
// 國泰「【帳戶出帳通知】您於 2026/10/19 18:00:30 網銀轉帳,金額為 NT$1元」.
const PARSERS: Parser[] = [
    { source: 'esun_card', pattern: new RegExp(`玉山[\\s\\S]*信用卡消費\\s*${AMOUNT}\\s*元`), build: simple('expense') },
    { source: 'esun_account', pattern: new RegExp(`金額異動\\s*[～~]?\\s*提台幣\\s*${AMOUNT}\\s*元`), build: simple('transfer_out') },
    { source: 'esun_account', pattern: new RegExp(`金額異動\\s*[～~]?\\s*存台幣\\s*${AMOUNT}\\s*元`), build: simple('transfer_in') },
    { source: 'cathay_account', pattern: CATHAY_ACCOUNT('出帳'), build: cathayAccount('transfer_out') },
    { source: 'cathay_account', pattern: CATHAY_ACCOUNT('入帳'), build: cathayAccount('transfer_in') },
];

/** Collapses whitespace so the same notification always hashes the same. */
export function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parses one forwarded notification. `text` is everything the shortcut
 * captured (sender line plus body); `receivedAt` is used when the text has
 * no timestamp of its own.
 */
export function parseNotification(text: string, receivedAt: Date): ParseResult {
    const normalized = normalizeText(text);
    if (IGNORE_PATTERNS.some(p => p.test(normalized))) return { status: 'ignored' };
    if (REVERSAL.test(normalized)) return { status: 'unparsed' };

    for (const parser of PARSERS) {
        const match = normalized.match(parser.pattern);
        if (!match) continue;
        const built = parser.build(match, receivedAt);
        if (built) return { status: 'parsed', event: { ...built, source: parser.source, currencyCode: 'TWD', last4: null } };
    }
    if (NOT_A_TRANSACTION.test(normalized)) return { status: 'ignored' };
    return MONEY_HINT.test(normalized) ? { status: 'unparsed' } : { status: 'ignored' };
}

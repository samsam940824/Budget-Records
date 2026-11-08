// Pure helpers for remembered auto-entry choices (table auto_entry_rules).
// They mirror how supabase/functions/notify/decide.ts applies a rule, so the
// web app can say what remembering a choice will do before it is saved.

import { Category, NotificationKind, Record } from '../types/database.types';
import { KIND_PREFIX, MERCHANT_PREFIX } from '../../supabase/functions/notify/decide';

/** One remembered choice, see supabase/migrations/0004_notification_inbox.sql. */
export interface AutoEntryRule {
    id: string;
    source: string;
    match_key: string;
    payment_method_id: string | null;
    category_id: string | null;
    hit_count: number;
    updated_at: string;
}

const KIND_LABELS: { [K in NotificationKind]: string } = {
    expense: '消費', income: '入帳', transfer_out: '出帳', transfer_in: '入帳',
};

/** What a rule matches, e.g. "電支交易" for a merchant rule or "消費" for a kind rule. */
export function ruleKeyLabel(matchKey: string): string {
    if (matchKey.startsWith(MERCHANT_PREFIX)) return matchKey.slice(MERCHANT_PREFIX.length);
    const kind = matchKey.slice(KIND_PREFIX.length) as NotificationKind;
    return KIND_LABELS[kind] ?? matchKey;
}

/**
 * The bank account a notification is about. Money coming in lands in the
 * transfer's destination, e.g. a LINE Pay withdrawal arriving in 生活費.
 */
export function rememberedAccountId(
    kind: NotificationKind,
    record: Pick<Record, 'type' | 'payment_method_id' | 'to_payment_method_id'>,
): string | null {
    if (kind === 'transfer_in' && record.type === 'transfer') return record.to_payment_method_id ?? null;
    return record.payment_method_id ?? null;
}

type CategoryRef = Pick<Category, 'name' | 'type'>;

/**
 * Whether later notifications filed by this rule skip review. Purchases always
 * do; account movements only when a merchant rule names a category of the
 * matching direction (decide.ts recordType).
 */
export function ruleAutoRecords(kind: NotificationKind, category: CategoryRef | undefined): boolean {
    if (kind === 'expense' || kind === 'income') return true;
    if (!category) return false;
    return (kind === 'transfer_out' && category.type === 'expense') || (kind === 'transfer_in' && category.type === 'income');
}

export interface RememberPreview {
    text: string;
    /** True when the rule turns account movements into automatic income or expenses. */
    warn: boolean;
}

/**
 * Plain-language effect of remembering a choice. A category is only stored
 * for notifications that name a merchant, matching InboxService.remember.
 */
export function previewRemember(
    event: { kind: NotificationKind; merchant: string | null },
    sourceName: string,
    accountName: string,
    category: CategoryRef | undefined,
): RememberPreview {
    const stored = event.merchant ? category : undefined;
    const subject = `「${event.merchant ? `${sourceName}・${event.merchant}` : sourceName}」的${KIND_LABELS[event.kind]}`;
    const isMovement = event.kind === 'transfer_out' || event.kind === 'transfer_in';

    if (!ruleAutoRecords(event.kind, stored)) {
        return { text: `會記住帳戶「${accountName}」；之後${subject}仍會請你確認用途。`, warn: false };
    }
    if (isMovement && stored) {
        const direction = stored.type === 'income' ? '收入' : '支出';
        return { text: `之後${subject}都會自動記成${direction}「${stored.name}」，記到「${accountName}」，不會再問你。`, warn: true };
    }
    const categoryText = stored ? `，分類「${stored.name}」` : '，分類要自己補';
    return { text: `之後${subject}會自動記到「${accountName}」${categoryText}。`, warn: false };
}

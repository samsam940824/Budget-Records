import { supabase } from '../lib/supabaseClient';
import { NotificationEvent } from '../types/database.types';
import { localDateTime } from '../../supabase/functions/quick-entry/logic';
import { REVIEW_REASON_LABELS, ReviewReason, ruleKey } from '../../supabase/functions/notify/decide';

const UNIQUE_VIOLATION = '23505';

const SOURCE_LABELS: { [source: string]: string } = {
    esun_card: '玉山信用卡通知',
    esun_account: '玉山帳戶通知',
    cathay_card: '國泰信用卡通知',
    cathay_account: '國泰帳戶通知',
    linepay: 'LINE Pay',
    wallet: 'Apple Pay',
    unknown: '未知來源',
};

const APP_PREFIX = 'app:';

export function sourceLabel(source: string): string {
    if (source.startsWith(APP_PREFIX)) return source.slice(APP_PREFIX.length);
    return SOURCE_LABELS[source] ?? source;
}

export function reasonLabel(reason: string | null): string {
    return reason && reason in REVIEW_REASON_LABELS ? REVIEW_REASON_LABELS[reason as ReviewReason] : '';
}

/** Taiwan date and HH:MM the notification refers to. */
export function eventDateTime(event: NotificationEvent): { date: string; time: string } {
    return localDateTime(new Date(event.occurred_at ?? event.received_at));
}

function friendly(error: { code?: string; message: string }): Error {
    if (error.code === UNIQUE_VIOLATION) return new Error('這筆記錄已經合併過同一個來源的通知了，請選另一筆');
    return new Error(error.message);
}

export const InboxService = {
    async listPending(userId: string): Promise<NotificationEvent[]> {
        const { data, error } = await supabase
            .from('notification_events')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('received_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    /** Notifications merged into or recorded as this record. */
    async listForRecord(userId: string, recordId: string): Promise<NotificationEvent[]> {
        const { data, error } = await supabase
            .from('notification_events')
            .select('*')
            .eq('user_id', userId)
            .eq('record_id', recordId)
            .order('received_at');
        if (error) throw error;
        return data || [];
    },

    async resolve(userId: string, eventId: string, status: 'recorded' | 'merged' | 'ignored', recordId: string | null) {
        const { error } = await supabase
            .from('notification_events')
            .update({ status, record_id: recordId, review_reason: null, resolved_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('id', eventId);
        if (error) throw friendly(error);
    },

    /**
     * Remembers the account (and, for a known merchant, the category) so the
     * next notification of this kind is filed automatically.
     */
    async remember(userId: string, event: NotificationEvent, accountId: string, categoryId: string | null) {
        if (!event.kind) return;
        const key = ruleKey({ merchant: event.merchant, kind: event.kind });
        const { error } = await supabase.from('auto_entry_rules').upsert({
            user_id: userId,
            source: event.source,
            match_key: key,
            payment_method_id: accountId,
            category_id: event.merchant ? categoryId : null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,source,match_key' });
        if (error) throw error;
    },
};

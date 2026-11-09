export type RecordType = 'expense' | 'income' | 'transfer';
export type CategoryType = 'expense' | 'income';
export type RepeatFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecordSource = 'manual' | 'quick_entry' | 'notification' | 'import';
export type AutoEntryMode = 'auto' | 'review';

export interface Category {
    id: string;
    user_id: string;
    name: string;
    icon: string;
    color: string;
    sort_order: number;
    type: CategoryType;
}

/** Stored in the payment_methods table and shown in the UI as an account. */
export interface PaymentMethod {
    id: string;
    user_id: string;
    name: string;
    icon: string;
    sort_order: number;
    color: string;
    initial_balance: number;
    currency_code: string;
    include_in_total: boolean;
    archived: boolean;
    /** Card / account number suffixes that route notifications here. */
    match_last4?: string[];
}

export interface Record {
    id: string;
    user_id: string;
    type: RecordType;
    amount: number;
    category_id: string | null;
    date: string;
    time: string | null;
    description: string;
    currency_code: string;
    location: string;
    payment_method_id: string | null;
    to_payment_method_id?: string | null;
    recurring_id?: string | null;
    source?: RecordSource;
    /** Marked as a separate purchase: notifications are never merged into it. */
    is_distinct?: boolean;
}

export interface Budget {
    id: string;
    user_id: string;
    /** null means the budget covers every expense category. */
    category_id: string | null;
    amount: number;
    currency_code: string;
    repeat: 'none' | RepeatFrequency;
    start_date: string;
    end_date: string | null;
    note: string | null;
}

export interface RecurringTransaction {
    id: string;
    user_id: string;
    type: RecordType;
    amount: number;
    category_id: string | null;
    payment_method_id: string | null;
    to_payment_method_id: string | null;
    description: string | null;
    location: string | null;
    currency_code: string;
    frequency: RepeatFrequency;
    interval_count: number;
    start_date: string;
    end_date: string | null;
    next_date: string;
    active: boolean;
}

export type DashboardWidgetId =
    | 'summary'
    | 'accounts'
    | 'categories'
    | 'trend'
    | 'budgets'
    | 'upcoming'
    | 'recent';

export interface DashboardWidget {
    id: DashboardWidgetId;
    visible: boolean;
}

export interface UserSettings {
    user_id: string;
    default_currency: string;
    budget_reset_day: number;
    dashboard_widgets?: DashboardWidget[] | null;
    auto_entry_mode?: AutoEntryMode;
}

export type NotificationKind = 'expense' | 'income' | 'transfer_out' | 'transfer_in';
export type NotificationStatus = 'pending' | 'recorded' | 'merged' | 'ignored';

/** One forwarded notification, see supabase/migrations/0004_notification_inbox.sql. */
export interface NotificationEvent {
    id: string;
    user_id: string;
    received_at: string;
    source: string;
    raw_text: string | null;
    kind: NotificationKind | null;
    amount: number | null;
    currency_code: string;
    merchant: string | null;
    last4: string | null;
    occurred_at: string | null;
    status: NotificationStatus;
    review_reason: string | null;
    /** The card a bank debit most likely pays (migration 0006). */
    suggested_to_payment_method_id: string | null;
    record_id: string | null;
}

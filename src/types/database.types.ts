export interface Category {
    id: string;
    user_id: string;
    name: string;
    icon: string;
    color: string;
    sort_order: number;
}

export interface PaymentMethod {
    id: string;
    user_id: string;
    name: string;
    icon: string;
    sort_order: number;
}

export interface Record {
    id: string;
    user_id: string;
    type: 'expense' | 'income';
    amount: number;
    category_id: string;
    date: string;
    time: string;
    description: string;
    currency_code: string;
    location: string;
    payment_method_id: string;
}

export interface Budget {
    id: string;
    user_id: string;
    category_id: string;
    amount: number;
    currency_code: string;
    repeat: 'none' | 'monthly' | 'yearly';
    start_date: string;
    end_date: string;
    note: string;
}

export interface UserSettings {
    user_id: string;
    default_currency: string;
    budget_reset_day: number;
}

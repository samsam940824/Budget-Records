import { supabase } from '../lib/supabaseClient';
import { Category, PaymentMethod } from '../types/database.types';

export type NewCategory = Omit<Category, 'id' | 'user_id'>;
export type NewAccount = Omit<PaymentMethod, 'id' | 'user_id'>;

const DEFAULT_EXPENSE_CATEGORIES: NewCategory[] = [
    { name: '餐飲', icon: 'Utensils', color: '#f59e0b', sort_order: 1, type: 'expense' },
    { name: '交通', icon: 'Train', color: '#3b82f6', sort_order: 2, type: 'expense' },
    { name: '購物', icon: 'ShoppingBag', color: '#ec4899', sort_order: 3, type: 'expense' },
    { name: '居住', icon: 'Home', color: '#10b981', sort_order: 4, type: 'expense' },
    { name: '娛樂', icon: 'Gamepad2', color: '#8b5cf6', sort_order: 5, type: 'expense' },
    { name: '醫療', icon: 'HeartPulse', color: '#ef4444', sort_order: 6, type: 'expense' },
];

const DEFAULT_INCOME_CATEGORIES: NewCategory[] = [
    { name: '薪資', icon: 'Briefcase', color: '#10b981', sort_order: 101, type: 'income' },
    { name: '獎金', icon: 'Gift', color: '#f59e0b', sort_order: 102, type: 'income' },
    { name: '投資', icon: 'TrendingUp', color: '#3b82f6', sort_order: 103, type: 'income' },
    { name: '其他收入', icon: 'Coins', color: '#a1a1aa', sort_order: 104, type: 'income' },
];

const ACCOUNT_DEFAULTS = {
    color: '#3b82f6',
    initial_balance: 0,
    currency_code: 'TWD',
    include_in_total: true,
    archived: false,
};

const DEFAULT_ACCOUNTS: NewAccount[] = [
    { ...ACCOUNT_DEFAULTS, name: '現金', icon: 'Banknote', sort_order: 1, color: '#10b981' },
    { ...ACCOUNT_DEFAULTS, name: '信用卡', icon: 'CreditCard', sort_order: 2, color: '#f59e0b' },
];

export const newAccountDefaults = (name: string, sort_order: number): NewAccount => ({
    ...ACCOUNT_DEFAULTS,
    name,
    icon: 'Wallet',
    sort_order,
});

// Concurrent loads (StrictMode double effects, overlapping refreshes) must
// share one seeding run, or each would insert its own copy of the defaults.
const seedingByUser = new Map<string, Promise<void>>();

export const OptionsService = {
    async getCategories(userId: string): Promise<Category[]> {
        const { data, error } = await supabase.from('categories').select('*').eq('user_id', userId).order('sort_order');
        if (error) throw error;
        return data || [];
    },

    async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
        const { data, error } = await supabase.from('payment_methods').select('*').eq('user_id', userId).order('sort_order');
        if (error) throw error;
        return data || [];
    },

    async addCategory(userId: string, category: NewCategory): Promise<Category> {
        const { data, error } = await supabase.from('categories').insert([{ ...category, user_id: userId }]).select().single();
        if (error) throw error;
        return data;
    },

    async updateCategory(userId: string, id: string, category: Partial<Category>): Promise<Category> {
        const { data, error } = await supabase.from('categories').update(category).eq('id', id).eq('user_id', userId).select().single();
        if (error) throw error;
        return data;
    },

    async deleteCategory(userId: string, id: string) {
        const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
    },

    async addPaymentMethod(userId: string, account: NewAccount): Promise<PaymentMethod> {
        const { data, error } = await supabase.from('payment_methods').insert([{ ...account, user_id: userId }]).select().single();
        if (error) throw error;
        return data;
    },

    async updatePaymentMethod(userId: string, id: string, account: Partial<PaymentMethod>): Promise<PaymentMethod> {
        const { data, error } = await supabase.from('payment_methods').update(account).eq('id', id).eq('user_id', userId).select().single();
        if (error) throw error;
        return data;
    },

    async deletePaymentMethod(userId: string, id: string) {
        const { error } = await supabase.from('payment_methods').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
    },

    /**
     * Seeds starter categories and accounts. Income categories are also added
     * for users who signed up before income categories existed, unless they
     * already record income under some category.
     */
    initializeDefaultsIfMissing(userId: string, hasIncomeRecords: boolean): Promise<void> {
        const inFlight = seedingByUser.get(userId);
        if (inFlight) return inFlight;
        const run = this.seedDefaults(userId, hasIncomeRecords).finally(() => seedingByUser.delete(userId));
        seedingByUser.set(userId, run);
        return run;
    },

    async seedDefaults(userId: string, hasIncomeRecords: boolean) {
        const [cats, pays] = await Promise.all([
            this.getCategories(userId),
            this.getPaymentMethods(userId),
        ]);

        const candidates: NewCategory[] = [];
        if (cats.length === 0) candidates.push(...DEFAULT_EXPENSE_CATEGORIES);
        if (!cats.some(c => c.type === 'income') && !hasIncomeRecords) candidates.push(...DEFAULT_INCOME_CATEGORIES);
        // Plain insert of missing names: older databases may lack the
        // UNIQUE(user_id, name) constraint that ON CONFLICT would need.
        const existingNames = new Set(cats.map(c => c.name));
        const toInsert = candidates.filter(c => !existingNames.has(c.name));
        if (toInsert.length > 0) {
            const { error } = await supabase.from('categories').insert(toInsert.map(c => ({ ...c, user_id: userId })));
            if (error) throw error;
        }
        if (pays.length === 0) {
            const { error } = await supabase.from('payment_methods').insert(DEFAULT_ACCOUNTS.map(p => ({ ...p, user_id: userId })));
            if (error) throw error;
        }
    },
};

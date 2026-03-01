import { supabase } from '../lib/supabaseClient';
import { Category, PaymentMethod } from '../types/database.types';

const DEFAULT_CATEGORIES = [
    { name: '餐飲', icon: 'Coffee', color: '#f59e0b', sort_order: 1 },
    { name: '交通', icon: 'Train', color: '#3b82f6', sort_order: 2 },
    { name: '購物', icon: 'ShoppingBag', color: '#ec4899', sort_order: 3 },
    { name: '居住', icon: 'Umbrella', color: '#10b981', sort_order: 4 },
];

const DEFAULT_PAYMENT_METHODS = [
    { name: '現金', icon: 'Banknote', sort_order: 1 },
    { name: '信用卡', icon: 'CreditCard', sort_order: 2 },
];

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

    async addCategory(userId: string, category: Omit<Category, 'id' | 'user_id'>) {
        const { data, error } = await supabase.from('categories').insert([{ ...category, user_id: userId }]).select().single();
        if (error) throw error;
        return data;
    },

    async updateCategory(userId: string, id: string, category: Partial<Category>) {
        const { data, error } = await supabase.from('categories').update(category).eq('id', id).eq('user_id', userId).select().single();
        if (error) throw error;
        return data;
    },

    async deleteCategory(userId: string, id: string) {
        const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
    },

    async addPaymentMethod(userId: string, paymentMethod: Omit<PaymentMethod, 'id' | 'user_id'>) {
        const { data, error } = await supabase.from('payment_methods').insert([{ ...paymentMethod, user_id: userId }]).select().single();
        if (error) throw error;
        return data;
    },

    async updatePaymentMethod(userId: string, id: string, paymentMethod: Partial<PaymentMethod>) {
        const { data, error } = await supabase.from('payment_methods').update(paymentMethod).eq('id', id).eq('user_id', userId).select().single();
        if (error) throw error;
        return data;
    },

    async deletePaymentMethod(userId: string, id: string) {
        const { error } = await supabase.from('payment_methods').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
    },

    async initializeDefaultsIfMissing(userId: string) {
        const [cats, pays] = await Promise.all([
            this.getCategories(userId),
            this.getPaymentMethods(userId)
        ]);

        if (cats.length === 0) {
            const catsToInsert = DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: userId }));
            await supabase.from('categories').upsert(catsToInsert, { onConflict: 'user_id,name', ignoreDuplicates: true });
        }
        if (pays.length === 0) {
            const paysToInsert = DEFAULT_PAYMENT_METHODS.map(p => ({ ...p, user_id: userId }));
            await supabase.from('payment_methods').upsert(paysToInsert, { onConflict: 'user_id,name', ignoreDuplicates: true });
        }
    }
};

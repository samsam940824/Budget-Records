import { supabase } from '../lib/supabaseClient';
import { RecurringTransaction } from '../types/database.types';

export type NewRecurring = Omit<RecurringTransaction, 'id' | 'user_id'>;

export const RecurringService = {
    async getRules(userId: string): Promise<RecurringTransaction[]> {
        const { data, error } = await supabase
            .from('recurring_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('next_date', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async addRule(userId: string, rule: NewRecurring): Promise<RecurringTransaction> {
        const { data, error } = await supabase
            .from('recurring_transactions')
            .insert([{ ...rule, user_id: userId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateRule(userId: string, id: string, rule: Partial<RecurringTransaction>): Promise<RecurringTransaction> {
        const { data, error } = await supabase
            .from('recurring_transactions')
            .update(rule)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteRule(userId: string, id: string) {
        const { error } = await supabase
            .from('recurring_transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        if (error) throw error;
    },
};

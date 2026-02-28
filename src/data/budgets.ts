import { supabase } from '../lib/supabaseClient';
import { Budget } from '../types/database.types';

export const BudgetsService = {
    async getBudgets(userId: string): Promise<Budget[]> {
        const { data, error } = await supabase
            .from('budgets')
            .select('*')
            .eq('user_id', userId)
            .order('start_date', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async addBudget(userId: string, budget: Omit<Budget, 'id' | 'user_id'>) {
        const { data, error } = await supabase
            .from('budgets')
            .insert([{ ...budget, user_id: userId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateBudget(userId: string, id: string, budget: Partial<Budget>) {
        const { data, error } = await supabase
            .from('budgets')
            .update(budget)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteBudget(userId: string, id: string) {
        const { error } = await supabase
            .from('budgets')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        if (error) throw error;
    }
};

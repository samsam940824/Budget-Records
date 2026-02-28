import { supabase } from '../lib/supabaseClient';
import { Record } from '../types/database.types';

export const RecordsService = {
    async getRecords(userId: string): Promise<Record[]> {
        const { data, error } = await supabase
            .from('records')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .order('time', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async addRecord(userId: string, record: Omit<Record, 'id' | 'user_id'>) {
        const { data, error } = await supabase
            .from('records')
            .insert([{ ...record, user_id: userId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateRecord(userId: string, id: string, record: Partial<Record>) {
        const { data, error } = await supabase
            .from('records')
            .update(record)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteRecord(userId: string, id: string) {
        const { error } = await supabase
            .from('records')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        if (error) throw error;
    }
};

import { supabase } from '../lib/supabaseClient';
import { Record } from '../types/database.types';

export type NewRecord = Omit<Record, 'id' | 'user_id'>;

const CHUNK = 500;

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

    async addRecord(userId: string, record: NewRecord): Promise<Record> {
        const { data, error } = await supabase
            .from('records')
            .insert([{ ...record, user_id: userId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async addRecords(userId: string, records: NewRecord[]): Promise<Record[]> {
        const saved: Record[] = [];
        for (let i = 0; i < records.length; i += CHUNK) {
            const { data, error } = await supabase
                .from('records')
                .insert(records.slice(i, i + CHUNK).map(r => ({ ...r, user_id: userId })))
                .select();
            if (error) throw error;
            saved.push(...(data || []));
        }
        return saved;
    },

    /**
     * Inserts generated recurring occurrences. The (recurring_id, date) unique
     * key turns a second insert of the same occurrence into a no-op, and only
     * newly inserted rows are returned.
     */
    async addRecurringOccurrences(userId: string, records: NewRecord[]): Promise<Record[]> {
        if (records.length === 0) return [];
        const { data, error } = await supabase
            .from('records')
            .upsert(records.map(r => ({ ...r, user_id: userId })), {
                onConflict: 'recurring_id,date',
                ignoreDuplicates: true,
            })
            .select();
        if (error) throw error;
        return data || [];
    },

    async updateRecord(userId: string, id: string, record: Partial<Record>): Promise<Record> {
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
    },

    async deleteRecordsByRecurring(userId: string, recurringId: string) {
        const { error } = await supabase
            .from('records')
            .delete()
            .eq('recurring_id', recurringId)
            .eq('user_id', userId);
        if (error) throw error;
    },
};

import { supabase } from '../lib/supabaseClient';
import { UserSettings } from '../types/database.types';

export const SettingsService = {
    async getSettings(userId: string): Promise<UserSettings | null> {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        // RLS might throw PGRST116 if no rows exist, which is normal for first login
        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching settings:', error);
            return null;
        }
        return data;
    },

    async updateSettings(userId: string, settings: Partial<UserSettings>) {
        const { data, error } = await supabase
            .from('user_settings')
            .upsert({ user_id: userId, ...settings })
            .select()
            .single();

        if (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
        return data;
    },

    async initializeSettingsIfMissing(userId: string) {
        const existing = await this.getSettings(userId);
        if (!existing) {
            await this.updateSettings(userId, { default_currency: 'TWD', budget_reset_day: 1 });
        }
    }
};

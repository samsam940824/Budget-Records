import { supabase } from '../lib/supabaseClient';
import { UserSettings } from '../types/database.types';

export const SettingsService = {
    async getSettings(userId: string): Promise<UserSettings | null> {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async updateSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
        const { data, error } = await supabase
            .from('user_settings')
            .upsert({ user_id: userId, ...settings })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getOrCreateSettings(userId: string): Promise<UserSettings> {
        const existing = await this.getSettings(userId);
        if (existing) return existing;
        return this.updateSettings(userId, { default_currency: 'TWD', budget_reset_day: 1 });
    },
};

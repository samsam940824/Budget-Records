import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { SettingsService } from '../data/settings';
import { UserSettings } from '../types/database.types';

export function useSettings() {
    const { user } = useAuth();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSettings = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            await SettingsService.initializeSettingsIfMissing(user.id);
            const data = await SettingsService.getSettings(user.id);
            setSettings(data);
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const updateSettings = async (updates: Partial<UserSettings>) => {
        if (!user) return null;
        try {
            const data = await SettingsService.updateSettings(user.id, updates);
            if (data) {
                setSettings(data);
                return data;
            }
        } catch (error) {
            console.error('Error updating settings:', error);
        }
        return null;
    };

    return {
        settings,
        loading,
        updateSettings,
        refreshSettings: fetchSettings
    };
}

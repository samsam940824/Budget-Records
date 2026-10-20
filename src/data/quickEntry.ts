import { supabase } from '../lib/supabaseClient';
import { sha256Hex } from '../../supabase/functions/quick-entry/logic';

export interface QuickEntryTokenInfo {
    created_at: string;
    last_used_at: string | null;
}

const TOKEN_BYTES = 32;

export const QUICK_ENTRY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quick-entry`;

/** 256 random bits, base64url encoded so it can be pasted into a header. */
function generateToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const QuickEntryService = {
    async getToken(userId: string): Promise<QuickEntryTokenInfo | null> {
        const { data, error } = await supabase
            .from('quick_entry_tokens')
            .select('created_at, last_used_at')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /** Replaces any existing token; the plain value is returned only here. */
    async createToken(userId: string): Promise<string> {
        // Browsers expose crypto.subtle only on HTTPS (and localhost).
        if (!globalThis.crypto?.subtle) throw new Error('需要 HTTPS 連線才能產生 token，請用正式網站操作');
        const token = generateToken();
        const { error } = await supabase
            .from('quick_entry_tokens')
            .upsert({ user_id: userId, token_hash: await sha256Hex(token), created_at: new Date().toISOString(), last_used_at: null });
        if (error) throw error;
        return token;
    },

    async revokeToken(userId: string) {
        const { error } = await supabase.from('quick_entry_tokens').delete().eq('user_id', userId);
        if (error) throw error;
    },
};

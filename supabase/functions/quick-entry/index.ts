// Quick-entry endpoint for the iOS shortcut.
//
//   GET  -> { accounts: string[], categories: string[] }   pick lists
//   POST { account, category, amount, note?, to_account? } -> { message }
//
// Authenticates with the personal shortcut token (see _shared/http.ts), so
// deploy with JWT verification off. Every query is scoped to the token's
// user; the service role key never leaves this function.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { authenticate, HttpError, json, readJsonObject, serve, supabase } from '../_shared/http.ts';
import { buildMenu, MenuAccount, MenuCategory, resolveEntry } from './logic.ts';

const MAX_BODY_BYTES = 4096;
const USAGE_WINDOW_DAYS = 90;

async function loadOptions(db: SupabaseClient, userId: string): Promise<{ accounts: MenuAccount[]; categories: MenuCategory[] }> {
    const [accounts, categories] = await Promise.all([
        db.from('payment_methods').select('id, name, sort_order, archived, currency_code').eq('user_id', userId),
        db.from('categories').select('id, name, sort_order, type').eq('user_id', userId),
    ]);
    if (accounts.error) throw accounts.error;
    if (categories.error) throw categories.error;
    return { accounts: accounts.data, categories: categories.data };
}

async function handleMenu(userId: string): Promise<Response> {
    const since = new Date(Date.now() - USAGE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
    const [{ accounts, categories }, usage] = await Promise.all([
        loadOptions(supabase, userId),
        supabase.from('records').select('category_id, payment_method_id').eq('user_id', userId).gte('date', since),
    ]);
    if (usage.error) throw usage.error;
    return json(buildMenu(accounts, categories, usage.data));
}

async function handleEntry(req: Request, userId: string): Promise<Response> {
    const input = await readJsonObject(req, MAX_BODY_BYTES);
    const { accounts, categories } = await loadOptions(supabase, userId);
    const result = resolveEntry(input, accounts, categories, new Date());
    if (!result.ok) throw new HttpError(400, result.error);

    const { error } = await supabase.from('records').insert({ ...result.record, user_id: userId, source: 'quick_entry' });
    if (error) throw error;
    return json({ message: result.message });
}

serve('quick_entry', async req => {
    if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, '只支援 GET 與 POST');
    const userId = await authenticate(req);
    return req.method === 'GET' ? handleMenu(userId) : handleEntry(req, userId);
});

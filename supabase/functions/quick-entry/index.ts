// Quick-entry endpoint for the iOS shortcut.
//
//   GET  -> { accounts: string[], categories: string[] }   pick lists
//   POST { account, category, amount, note?, to_account? } -> { message }
//
// Authenticates with the personal token from Settings -> 快速記帳 as
// "Authorization: Bearer <token>", so deploy with JWT verification off.
// Every query is scoped to the token's user; the service role key never
// leaves this function.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { buildMenu, MenuAccount, MenuCategory, resolveEntry, sha256Hex } from './logic.ts';

const MAX_BODY_BYTES = 4096;
const USAGE_WINDOW_DAYS = 90;

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
});

class HttpError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

async function authenticate(req: Request): Promise<string> {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/)?.[1];
    if (!token) throw new HttpError(401, '缺少捷徑 token');
    const { data, error } = await supabase
        .from('quick_entry_tokens')
        .select('user_id')
        .eq('token_hash', await sha256Hex(token))
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(401, '捷徑 token 無效，請到設定重新產生');
    return data.user_id;
}

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
    const body = await req.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) throw new HttpError(413, '資料太大');
    let input: unknown;
    try {
        input = JSON.parse(body);
    } catch (err) {
        if (err instanceof SyntaxError) throw new HttpError(400, '資料格式錯誤，需要 JSON');
        throw err;
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new HttpError(400, '資料格式錯誤');

    const { accounts, categories } = await loadOptions(supabase, userId);
    const result = resolveEntry(input as { [key: string]: unknown }, accounts, categories, new Date());
    if (!result.ok) throw new HttpError(400, result.error);

    const { error } = await supabase.from('records').insert({ ...result.record, user_id: userId });
    if (error) throw error;
    return json({ message: result.message });
}

Deno.serve(async req => {
    try {
        if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, '只支援 GET 與 POST');
        const userId = await authenticate(req);
        const response = req.method === 'GET' ? await handleMenu(userId) : await handleEntry(req, userId);
        const touched = await supabase
            .from('quick_entry_tokens')
            .update({ last_used_at: new Date().toISOString() })
            .eq('user_id', userId);
        if (touched.error) console.error(JSON.stringify({ event: 'touch_token_failed', error: touched.error.message }));
        return response;
    } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        console.error(JSON.stringify({ event: 'quick_entry_failed', error: err instanceof Error ? err.message : JSON.stringify(err) }));
        return json({ error: '伺服器錯誤，請稍後再試' }, 500);
    }
});

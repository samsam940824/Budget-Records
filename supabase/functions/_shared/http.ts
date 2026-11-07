// HTTP plumbing shared by the shortcut endpoints. Both authenticate with the
// personal token from Settings -> 快速記帳 as "Authorization: Bearer <token>",
// so they are deployed with JWT verification off.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sha256Hex } from '../quick-entry/logic.ts';

/** Service-role client; every query must still filter by the token's user. */
export const supabase: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
});

export class HttpError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

export const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** Resolves the bearer token to its user id and records when it was used. */
export async function authenticate(req: Request): Promise<string> {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/)?.[1];
    if (!token) throw new HttpError(401, '缺少捷徑 token');
    const { data, error } = await supabase
        .from('quick_entry_tokens')
        .select('user_id')
        .eq('token_hash', await sha256Hex(token))
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(401, '捷徑 token 無效，請到設定重新產生');

    const touched = await supabase.from('quick_entry_tokens').update({ last_used_at: new Date().toISOString() }).eq('user_id', data.user_id);
    if (touched.error) console.error(JSON.stringify({ event: 'touch_token_failed', error: touched.error.message }));
    return data.user_id;
}

/** Reads a JSON object body no larger than `maxBytes`. */
export async function readJsonObject(req: Request, maxBytes: number): Promise<{ [key: string]: unknown }> {
    const body = await req.text();
    if (new TextEncoder().encode(body).length > maxBytes) throw new HttpError(413, '資料太大');
    let input: unknown;
    try {
        input = JSON.parse(body);
    } catch (err) {
        if (err instanceof SyntaxError) throw new HttpError(400, '資料格式錯誤，需要 JSON');
        throw err;
    }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new HttpError(400, '資料格式錯誤');
    return input as { [key: string]: unknown };
}

/** Wraps a handler with the shared error responses and structured logging. */
export function serve(name: string, handler: (req: Request) => Promise<Response>): void {
    Deno.serve(async req => {
        try {
            return await handler(req);
        } catch (err) {
            if (err instanceof HttpError) return json({ error: err.message }, err.status);
            console.error(JSON.stringify({ event: `${name}_failed`, error: err instanceof Error ? err.message : JSON.stringify(err) }));
            return json({ error: '伺服器錯誤，請稍後再試' }, 500);
        }
    });
}

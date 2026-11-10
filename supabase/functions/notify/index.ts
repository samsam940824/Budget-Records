// Notification auto-entry endpoint for the iOS "when I get a notification"
// automation.
//
//   POST { text, app? } -> { status, message }
//
// `text` is everything the shortcut captured from the notification; `app` is
// an optional sender label used only to tag notifications no parser knows.
// Authenticates with the personal shortcut token (see _shared/http.ts), so
// deploy with JWT verification off.

import { authenticate, HttpError, json, readJsonObject, serve, supabase } from '../_shared/http.ts';
import { sha256Hex } from '../quick-entry/logic.ts';
import { decide, Decision, REVIEW_REASON_LABELS, waitsForPartner } from './decide.ts';
import { normalizeText, ParsedEvent, parseNotification } from './parsers.ts';
import { applyDecision, eventBase, loadContext, Outcome, purgeRawText, storePending } from './store.ts';

const MAX_BODY_BYTES = 8192;
const MAX_TEXT_LENGTH = 2000;
const MAX_APP_LENGTH = 40;
const UNKNOWN_SOURCE = 'unknown';
/** Long enough for a card notice arriving alongside a wallet notice to be stored. */
const PARTNER_WAIT_MS = 5000;

function readInput(input: { [key: string]: unknown }): { text: string; app: string | null } {
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text) throw new HttpError(400, '缺少通知內容 text');
    if (text.length > MAX_TEXT_LENGTH) throw new HttpError(413, `通知內容最多 ${MAX_TEXT_LENGTH} 字`);
    const app = typeof input.app === 'string' ? input.app.trim().slice(0, MAX_APP_LENGTH) : '';
    return { text, app: app || null };
}

function describe(outcome: Outcome): string {
    switch (outcome.status) {
        case 'recorded': return '已自動記帳';
        case 'merged': return '已合併到既有記錄';
        case 'pending': return `已放入待確認（${REVIEW_REASON_LABELS[outcome.reason]}）`;
    }
}

async function decideEvent(event: ParsedEvent, rawHash: string, userId: string, now: Date): Promise<Decision> {
    const first = decide(event, await loadContext(supabase, userId, event, rawHash, now));
    if (!waitsForPartner(first)) return first;
    await new Promise(resolve => setTimeout(resolve, PARTNER_WAIT_MS));
    return decide(event, await loadContext(supabase, userId, event, rawHash, now));
}

async function handle(text: string, app: string | null, userId: string): Promise<Response> {
    const now = new Date();
    const result = parseNotification(text, now);
    if (result.status === 'ignored') return json({ status: 'ignored', message: '略過：不是消費通知' });

    const rawHash = await sha256Hex(normalizeText(text));
    let outcome: Outcome;
    if (result.status === 'unparsed') {
        outcome = await storePending(supabase, userId, {
            source: app ? `app:${app}` : UNKNOWN_SOURCE, raw_text: text, raw_hash: rawHash, kind: null, amount: null,
            currency_code: 'TWD', merchant: null, last4: null, occurred_at: now.toISOString(),
        }, 'unparsed');
    } else {
        const decision = await decideEvent(result.event, rawHash, userId, now);
        outcome = await applyDecision(supabase, userId, eventBase(result.event, text, rawHash), decision);
    }

    try {
        await purgeRawText(supabase, userId, now);
    } catch (err) {
        // Retention cleanup must not fail the entry itself; it reruns on the next call.
        if (!(err instanceof Error)) throw err;
        console.error(JSON.stringify({ event: 'purge_raw_text_failed', error: err.message }));
    }
    return json({ status: outcome.status, message: describe(outcome) });
}

serve('notify', async req => {
    if (req.method !== 'POST') throw new HttpError(405, '只支援 POST');
    const userId = await authenticate(req);
    const { text, app } = readInput(await readJsonObject(req, MAX_BODY_BYTES));
    return handle(text, app, userId);
});

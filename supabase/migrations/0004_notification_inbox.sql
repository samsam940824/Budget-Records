-- Budget Records 0004: notification-based auto entry.
--
-- Run this once in the Supabase SQL editor after 0003. Safe to run again.
-- To undo it, run supabase/rollback/0004_notification_inbox_down.sql.
--
-- An iOS shortcut forwards bank / LINE Pay / Apple Pay notifications to the
-- notify Edge Function. Each notification becomes one notification_events
-- row; it either creates a record, is merged into an existing record, waits
-- for review, or is ignored.
--
-- Duplicate rule: a bank sends one notification per transaction, so two
-- events from the same source are always two transactions. Only events from
-- different sources (e.g. LINE Pay + the card it charged, or a notification
-- + a manually entered record) are merged, and always one-to-one. The
-- partial unique index on (record_id, source) enforces that a record absorbs
-- at most one event per source.

-- ------------------------------------------
-- Accounts: card / account number suffixes used to route notifications
-- ------------------------------------------
-- An array because one account can cover several numbers, e.g. 生活費 is an
-- E.SUN account, a Cathay account and a Cathay debit card.
ALTER TABLE public.payment_methods
    ADD COLUMN IF NOT EXISTS match_last4 TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_match_last4_check;
ALTER TABLE public.payment_methods
    ADD CONSTRAINT payment_methods_match_last4_check
    CHECK (array_to_string(match_last4, ',') ~ '^([0-9]{4}(,[0-9]{4})*)?$');

-- ------------------------------------------
-- Records: origin and the "this is a separate purchase" override
-- ------------------------------------------
ALTER TABLE public.records
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
    -- TRUE means the user marked this as intentionally separate, so no
    -- notification or import is ever merged into it.
    ADD COLUMN IF NOT EXISTS is_distinct BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_source_check;
ALTER TABLE public.records
    ADD CONSTRAINT records_source_check
    CHECK (source IN ('manual', 'quick_entry', 'notification', 'import'));

-- ------------------------------------------
-- Settings: auto-entry mode
-- ------------------------------------------
-- 'auto': confidently parsed events become records, the rest wait for review.
-- 'review': every event waits for review.
ALTER TABLE public.user_settings
    ADD COLUMN IF NOT EXISTS auto_entry_mode TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_auto_entry_mode_check;
ALTER TABLE public.user_settings
    ADD CONSTRAINT user_settings_auto_entry_mode_check
    CHECK (auto_entry_mode IN ('auto', 'review'));

-- ------------------------------------------
-- Received notifications (inbox + record sources)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- Parser-defined channel such as 'esun_card', 'cathay_account',
    -- 'linepay', 'wallet'. Finer than the app so one app's card and account
    -- notifications can still merge with each other.
    source TEXT NOT NULL,
    -- Cleared 30 days after the event is resolved; only the parsed fields stay.
    raw_text TEXT,
    -- SHA-256 of the normalised text, kept after raw_text is cleared, to
    -- spot iOS delivering the same notification twice.
    raw_hash TEXT NOT NULL,
    kind TEXT CHECK (kind IN ('expense', 'income', 'transfer_out', 'transfer_in')),
    amount NUMERIC CHECK (amount > 0),
    currency_code TEXT NOT NULL DEFAULT 'TWD',
    merchant TEXT,
    last4 TEXT CHECK (last4 ~ '^[0-9]{4}$'),
    occurred_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'recorded', 'merged', 'ignored')),
    -- Why a pending event needs review.
    review_reason TEXT
        CHECK (review_reason IN ('unparsed', 'unknown_account', 'possible_replay', 'ambiguous_match', 'review_mode')),
    record_id UUID REFERENCES public.records(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- A recorded or merged event must point at its record.
    CONSTRAINT notification_events_record_check
        CHECK (status NOT IN ('recorded', 'merged') OR record_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_one_per_source
    ON public.notification_events (record_id, source)
    WHERE record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_events_user_status
    ON public.notification_events (user_id, status, received_at DESC);

CREATE INDEX IF NOT EXISTS notification_events_replay
    ON public.notification_events (user_id, raw_hash, received_at DESC);

-- Deleting a record would otherwise leave its events 'recorded' with no
-- record. Marking them ignored also stops them being entered again.
CREATE OR REPLACE FUNCTION public.release_notification_events()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.notification_events
    SET status = 'ignored', record_id = NULL, resolved_at = NOW()
    WHERE record_id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS records_release_notification_events ON public.records;
CREATE TRIGGER records_release_notification_events
    BEFORE DELETE ON public.records
    FOR EACH ROW EXECUTE FUNCTION public.release_notification_events();

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own notification events" ON public.notification_events;
CREATE POLICY "Users can manage their own notification events"
ON public.notification_events
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------
-- Remembered choices
-- ------------------------------------------
-- When the user files an event from a source + key (merchant, or the
-- notification kind when there is no merchant), the next matching event
-- reuses that account and category.
CREATE TABLE IF NOT EXISTS public.auto_entry_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    match_key TEXT NOT NULL,
    payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    hit_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, source, match_key)
);

ALTER TABLE public.auto_entry_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own auto entry rules" ON public.auto_entry_rules;
CREATE POLICY "Users can manage their own auto entry rules"
ON public.auto_entry_rules
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

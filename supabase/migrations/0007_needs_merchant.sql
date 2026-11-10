-- Budget Records 0007: card purchases waiting for a shop name.
--
-- Run this once in the Supabase SQL editor after 0006. Safe to run again.
-- To undo it, run supabase/rollback/0007_needs_merchant_down.sql.
--
-- 'needs_merchant' marks a card purchase whose notice names no shop (玉山)
-- and no wallet notice (LINE Pay, 全盈+PAY) supplied one.
-- suggested_payment_method_id is the account it is charged to, prefilled
-- when the user files it.

ALTER TABLE public.notification_events
    ADD COLUMN IF NOT EXISTS suggested_payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL;

ALTER TABLE public.notification_events DROP CONSTRAINT IF EXISTS notification_events_review_reason_check;
ALTER TABLE public.notification_events
    ADD CONSTRAINT notification_events_review_reason_check
    CHECK (review_reason IN ('unparsed', 'unknown_account', 'needs_purpose', 'card_payment', 'needs_merchant', 'possible_replay', 'ambiguous_match', 'review_mode'));

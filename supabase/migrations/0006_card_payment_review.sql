-- Budget Records 0006: card payment suggestions for bank debits.
--
-- Run this once in the Supabase SQL editor after 0005. Safe to run again.
-- To undo it, run supabase/rollback/0006_card_payment_review_down.sql.
--
-- 'card_payment' marks a bank debit equal to an unpaid card purchase whose
-- debited account is uncertain (e.g. 玉山「提台幣」 from 生活費 or 汽車).
-- suggested_to_payment_method_id is the card it most likely pays, prefilled
-- when the user files it.

ALTER TABLE public.notification_events
    ADD COLUMN IF NOT EXISTS suggested_to_payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL;

ALTER TABLE public.notification_events DROP CONSTRAINT IF EXISTS notification_events_review_reason_check;
ALTER TABLE public.notification_events
    ADD CONSTRAINT notification_events_review_reason_check
    CHECK (review_reason IN ('unparsed', 'unknown_account', 'needs_purpose', 'card_payment', 'possible_replay', 'ambiguous_match', 'review_mode'));

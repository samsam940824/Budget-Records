-- Budget Records 0005: review reason for bank account movements.
--
-- Run this once in the Supabase SQL editor after 0004. Safe to run again.
-- To undo it, run supabase/rollback/0005_needs_purpose_down.sql.
--
-- 'needs_purpose' marks a bank debit or credit (e.g. 玉山「提台幣」) whose
-- purpose - card payment, withdrawal, transfer - the notification omits.

ALTER TABLE public.notification_events DROP CONSTRAINT IF EXISTS notification_events_review_reason_check;
ALTER TABLE public.notification_events
    ADD CONSTRAINT notification_events_review_reason_check
    CHECK (review_reason IN ('unparsed', 'unknown_account', 'needs_purpose', 'possible_replay', 'ambiguous_match', 'review_mode'));

-- Undo 0005_needs_purpose.sql. Pending events waiting for a purpose are
-- relabelled 'unknown_account' so they stay in the review list.

BEGIN;

UPDATE public.notification_events SET review_reason = 'unknown_account' WHERE review_reason = 'needs_purpose';

ALTER TABLE public.notification_events DROP CONSTRAINT IF EXISTS notification_events_review_reason_check;
ALTER TABLE public.notification_events
    ADD CONSTRAINT notification_events_review_reason_check
    CHECK (review_reason IN ('unparsed', 'unknown_account', 'possible_replay', 'ambiguous_match', 'review_mode'));

COMMIT;

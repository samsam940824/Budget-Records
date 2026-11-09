-- Undo 0006_card_payment_review.sql. Pending card payment suggestions are
-- relabelled 'needs_purpose' so they stay in the review list.

BEGIN;

UPDATE public.notification_events SET review_reason = 'needs_purpose' WHERE review_reason = 'card_payment';

ALTER TABLE public.notification_events DROP CONSTRAINT IF EXISTS notification_events_review_reason_check;
ALTER TABLE public.notification_events
    ADD CONSTRAINT notification_events_review_reason_check
    CHECK (review_reason IN ('unparsed', 'unknown_account', 'needs_purpose', 'possible_replay', 'ambiguous_match', 'review_mode'));

ALTER TABLE public.notification_events DROP COLUMN IF EXISTS suggested_to_payment_method_id;

COMMIT;

-- Undo 0007_needs_merchant.sql. Pending card purchases waiting for a shop
-- name are relabelled 'review_mode' so they stay in the review list.

BEGIN;

UPDATE public.notification_events SET review_reason = 'review_mode' WHERE review_reason = 'needs_merchant';

ALTER TABLE public.notification_events DROP CONSTRAINT IF EXISTS notification_events_review_reason_check;
ALTER TABLE public.notification_events
    ADD CONSTRAINT notification_events_review_reason_check
    CHECK (review_reason IN ('unparsed', 'unknown_account', 'needs_purpose', 'card_payment', 'possible_replay', 'ambiguous_match', 'review_mode'));

ALTER TABLE public.notification_events DROP COLUMN IF EXISTS suggested_payment_method_id;

COMMIT;

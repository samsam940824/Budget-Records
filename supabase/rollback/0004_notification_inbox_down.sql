-- Undo 0004_notification_inbox.sql.
--
-- Deletes every received notification and remembered rule, and the
-- match_last4 / source / is_distinct / auto_entry_mode columns. Records
-- themselves are kept, including ones created from notifications.

BEGIN;

DROP TABLE IF EXISTS public.auto_entry_rules;
DROP TABLE IF EXISTS public.notification_events;
DROP TRIGGER IF EXISTS records_release_notification_events ON public.records;
DROP FUNCTION IF EXISTS public.release_notification_events();

ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_auto_entry_mode_check;
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS auto_entry_mode;

ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_source_check;
ALTER TABLE public.records DROP COLUMN IF EXISTS is_distinct;
ALTER TABLE public.records DROP COLUMN IF EXISTS source;

ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_match_last4_check;
ALTER TABLE public.payment_methods DROP COLUMN IF EXISTS match_last4;

COMMIT;

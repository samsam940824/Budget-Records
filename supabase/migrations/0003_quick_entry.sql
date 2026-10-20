-- Budget Records 0003: personal tokens for the iOS quick-entry shortcut.
--
-- Run this once in the Supabase SQL editor after 0002. Safe to run again.
--
-- The shortcut cannot hold a Supabase session, so it authenticates to the
-- quick-entry Edge Function with a random token instead. Only the SHA-256
-- hash is stored; the plain token is shown to the user once.

CREATE TABLE IF NOT EXISTS public.quick_entry_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.quick_entry_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own quick entry token" ON public.quick_entry_tokens;
CREATE POLICY "Users can manage their own quick entry token"
ON public.quick_entry_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

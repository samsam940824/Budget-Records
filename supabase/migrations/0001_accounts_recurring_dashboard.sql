-- Budget Records 0001: accounts, transfers, recurring transactions,
-- income categories and a configurable dashboard.
--
-- Run this once in the Supabase SQL editor after 0000_schema.sql.
-- Every statement is idempotent, so running it again is safe.

-- ------------------------------------------
-- Categories: expense or income
-- ------------------------------------------
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE public.categories
    ADD CONSTRAINT categories_type_check CHECK (type IN ('expense', 'income'));

-- ------------------------------------------
-- Payment methods become accounts with balances
-- ------------------------------------------
ALTER TABLE public.payment_methods
    ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#3b82f6',
    ADD COLUMN IF NOT EXISTS initial_balance NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'TWD',
    ADD COLUMN IF NOT EXISTS include_in_total BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

-- ------------------------------------------
-- Recurring transaction rules
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
    to_payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
    description TEXT,
    location TEXT,
    currency_code TEXT NOT NULL DEFAULT 'TWD',
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
    start_date DATE NOT NULL,
    end_date DATE,
    next_date DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own recurring transactions" ON public.recurring_transactions;
CREATE POLICY "Users can manage their own recurring transactions"
ON public.recurring_transactions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------
-- Records: transfers and links to recurring rules
-- ------------------------------------------
ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_type_check;
ALTER TABLE public.records
    ADD CONSTRAINT records_type_check CHECK (type IN ('expense', 'income', 'transfer'));

ALTER TABLE public.records
    ADD COLUMN IF NOT EXISTS to_payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;

-- One generated record per rule per date, so two open tabs cannot
-- create the same recurring occurrence twice. NULL recurring_id rows
-- never conflict with each other.
ALTER TABLE public.records DROP CONSTRAINT IF EXISTS records_recurring_occurrence_key;
ALTER TABLE public.records
    ADD CONSTRAINT records_recurring_occurrence_key UNIQUE (recurring_id, date);

-- ------------------------------------------
-- Settings: dashboard widget layout
-- ------------------------------------------
ALTER TABLE public.user_settings
    ADD COLUMN IF NOT EXISTS dashboard_widgets JSONB;

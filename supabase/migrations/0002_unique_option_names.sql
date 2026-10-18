-- Budget Records 0002: enforce unique category / account names per user.
--
-- 0000_schema.sql declares UNIQUE(user_id, name), but databases created
-- before that constraint existed lack it, which let concurrent loads seed
-- duplicate default categories. Unreferenced duplicates are removed first
-- so the constraint can be added. Safe to run more than once.

DELETE FROM public.categories c
USING (
    SELECT id, row_number() OVER (PARTITION BY user_id, name ORDER BY sort_order, id) AS rn
    FROM public.categories
) d
WHERE c.id = d.id
  AND d.rn > 1
  AND NOT EXISTS (SELECT 1 FROM public.records r WHERE r.category_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.budgets b WHERE b.category_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.recurring_transactions t WHERE t.category_id = c.id);

-- Constraints are added only when no duplicates remain; referenced
-- duplicates need a manual merge and are reported instead of failing.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.categories'::regclass AND contype = 'u'
                   AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.categories'::regclass AND attname = 'user_id'),
                                      (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.categories'::regclass AND attname = 'name')]::int2[]) THEN
        IF EXISTS (SELECT 1 FROM public.categories GROUP BY user_id, name HAVING count(*) > 1) THEN
            RAISE NOTICE 'categories still has duplicate names in use; merge them, then rerun';
        ELSE
            ALTER TABLE public.categories ADD CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name);
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.payment_methods'::regclass AND contype = 'u'
                   AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.payment_methods'::regclass AND attname = 'user_id'),
                                      (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.payment_methods'::regclass AND attname = 'name')]::int2[]) THEN
        IF EXISTS (SELECT 1 FROM public.payment_methods GROUP BY user_id, name HAVING count(*) > 1) THEN
            RAISE NOTICE 'payment_methods has duplicate names; merge them, then rerun';
        ELSE
            ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_user_id_name_key UNIQUE (user_id, name);
        END IF;
    END IF;
END $$;

ALTER TABLE public.plan_config ADD COLUMN IF NOT EXISTS addon_price_cents INT NOT NULL DEFAULT 0 CHECK (addon_price_cents >= 0);

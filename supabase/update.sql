-- ============================================
-- Panel WhatsApp - Update incremental
-- ============================================
-- Aplicado: REGLA DE NEGOCIO — todos los planes
-- incluyen 1 instancia base (max_instances = 1).
-- Los bots extra se contratan como add-ons.
-- Idempotente: se puede ejecutar mas de una vez.
-- ============================================

-- 1. Enum para estado de add-ons
DO $$ BEGIN
  CREATE TYPE public.addon_status AS ENUM ('active', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Garantizar 1 instancia base en todos los planes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_max_instances_min'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_max_instances_min CHECK (max_instances >= 1);
  END IF;
END $$;

-- Backfill: normalizar suscripciones existentes a 1 base
UPDATE public.subscriptions SET max_instances = 1 WHERE max_instances <> 1;

-- 3. Tabla de add-ons (bots extra contratados)
CREATE TABLE IF NOT EXISTS public.instance_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status public.addon_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instance_addons_user_id ON instance_addons(user_id);

-- 4. Limite efectivo de instancias:
--    bot base del plan (1) + add-ons activos
CREATE OR REPLACE FUNCTION public.get_effective_max_instances(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_base INT;
  v_addons INT;
BEGIN
  SELECT COALESCE(max_instances, 1) INTO v_base
  FROM subscriptions WHERE user_id = p_user_id;

  SELECT COALESCE(SUM(quantity), 0) INTO v_addons
  FROM instance_addons
  WHERE user_id = p_user_id AND status = 'active';

  RETURN v_base + v_addons;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS en instance_addons
ALTER TABLE public.instance_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own instance_addons" ON public.instance_addons;
CREATE POLICY "Users view own instance_addons"
  ON public.instance_addons FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manage instance_addons" ON public.instance_addons;
CREATE POLICY "Admin manage instance_addons"
  ON public.instance_addons FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
-- Drop Community feature — tablas y enum obsoletos
-- Ejecutar: supabase db push (o psql)

-- 2) Drop tablas community (CASCADE borra policies, triggers, indexes)
-- IF NOT EXISTS para que sea idempotente
DROP TABLE IF EXISTS public.broadcast_recipients CASCADE;
DROP TABLE IF EXISTS public.broadcasts CASCADE;
DROP TABLE IF EXISTS public.group_settings CASCADE;
DROP TABLE IF EXISTS public.discovered_groups CASCADE;
DROP TABLE IF EXISTS public.group_discovery_cache CASCADE;

-- 3) Quitar columnas owner_jid/owner_lid de instances si existen
ALTER TABLE public.instances DROP COLUMN IF EXISTS owner_jid;
ALTER TABLE public.instances DROP COLUMN IF EXISTS owner_lid;

-- 4) Fix enum plan_type: quitar 'community' SI existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'community' AND enumtypid = 'plan_type'::regtype) THEN
      -- Mover community -> pro ANTES de recrear el enum
      UPDATE public.subscriptions SET plan_type = 'pro' WHERE plan_type = 'community';
      -- Quitar default que bloquea el cast (42804)
      ALTER TABLE public.subscriptions ALTER COLUMN plan_type DROP DEFAULT;
      ALTER TYPE public.plan_type RENAME TO plan_type_old;
      CREATE TYPE public.plan_type AS ENUM ('starter', 'pro');
      ALTER TABLE public.subscriptions ALTER COLUMN plan_type TYPE public.plan_type USING plan_type::text::public.plan_type;
      ALTER TABLE public.subscriptions ALTER COLUMN plan_type SET DEFAULT 'starter'::public.plan_type;
      DROP TYPE public.plan_type_old;
    END IF;
  END IF;
END $$;

-- 5) Grants se limpian automaticamente con DROP CASCADE.
-- Los grants vigentes (instances, profiles, subscriptions, etc) se re-aplican en schema.sql/update.sql en próximo deploy.

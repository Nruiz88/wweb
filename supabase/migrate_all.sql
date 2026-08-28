-- ============================================
-- Migración consolidada: Todas las features nuevas
-- Pegar en Supabase SQL Editor y ejecutar
-- ============================================

-- 1. business_hours (Pro: calendario)
CREATE TABLE IF NOT EXISTS business_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  slot_duration_min INT NOT NULL DEFAULT 30 CHECK (slot_duration_min BETWEEN 10 AND 120),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, day_of_week)
);

-- 2. appointments (Pro: turnos)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_min INT NOT NULL DEFAULT 30,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'canceled', 'completed')),
  notes TEXT,
  reminder_24h_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. group_settings (Community: bienvenida + anti-spam)
CREATE TABLE IF NOT EXISTS group_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  picture_url TEXT,
  welcome_enabled BOOLEAN DEFAULT false,
  welcome_message TEXT DEFAULT NULL,
  spam_filter_enabled BOOLEAN DEFAULT false,
  block_all_links BOOLEAN DEFAULT true,
  allowed_domains TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, group_jid)
);

-- 4. broadcasts (Community: comunicados)
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'completed', 'failed')),
  scheduled_at TIMESTAMPTZ DEFAULT NULL,
  sent_at TIMESTAMPTZ DEFAULT NULL,
  total_groups INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. broadcast_recipients
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID REFERENCES broadcasts(id) ON DELETE CASCADE NOT NULL,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT DEFAULT NULL,
  sent_at TIMESTAMPTZ DEFAULT NULL
);

-- 6. Agregar columnas a instances (welcome + outside hours)
DO $$ BEGIN
  ALTER TABLE instances ADD COLUMN welcome_message TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE instances ADD COLUMN outside_hours_message TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 7. Agregar columnas a auto_responses (menú botones)
DO $$ BEGIN
  ALTER TABLE auto_responses ADD COLUMN response_type TEXT DEFAULT 'text' CHECK (response_type IN ('text', 'menu'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE auto_responses ADD COLUMN menu_config JSONB;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 7c. discovered_groups (Community: auto-capture de grupos)
CREATE TABLE IF NOT EXISTS discovered_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  group_picture TEXT,
  is_admin BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, group_jid)
);

-- 7c1b. group_discovery_cache (Community: caché temporal de "Buscar grupos")
CREATE TABLE IF NOT EXISTS group_discovery_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_discovery_cache_instance ON group_discovery_cache(instance_id);

-- 7c2. Moderación por palabras prohibidas (por grupo)
DO $$ BEGIN
  ALTER TABLE group_settings ADD COLUMN banned_words_enabled BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE group_settings ADD COLUMN banned_words TEXT[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE group_settings ADD COLUMN banned_words_action TEXT DEFAULT 'delete_and_reply'
    CHECK (banned_words_action IN ('delete', 'delete_and_reply'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE group_settings ADD COLUMN banned_words_reply TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 7d. onboarding_completed en profiles
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 7e. owner_jid en instances (JID del bot persistido para no consultar Evolution)
DO $$ BEGIN
  ALTER TABLE instances ADD COLUMN owner_jid TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 8. RLS
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discovered_groups access" ON discovered_groups;
CREATE POLICY "discovered_groups access" ON discovered_groups FOR ALL
  USING (
    EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = discovered_groups.instance_id AND user_id = auth.uid())
  );

ALTER TABLE group_discovery_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_discovery_cache access" ON group_discovery_cache;
CREATE POLICY "group_discovery_cache access" ON group_discovery_cache FOR ALL
  USING (
    EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = group_discovery_cache.instance_id AND user_id = auth.uid())
  );

-- Policies
DROP POLICY IF EXISTS "business_hours owner" ON business_hours;
CREATE POLICY "business_hours access" ON business_hours FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = business_hours.instance_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "appointments access" ON appointments;
CREATE POLICY "appointments access" ON appointments FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = appointments.instance_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "group_settings access" ON group_settings;
CREATE POLICY "group_settings access" ON group_settings FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
  );

DROP POLICY IF EXISTS "broadcasts access" ON broadcasts;
CREATE POLICY "broadcasts access" ON broadcasts FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
  );

DROP POLICY IF EXISTS "broadcast_recipients access" ON broadcast_recipients;
CREATE POLICY "broadcast_recipients access" ON broadcast_recipients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM broadcasts WHERE id = broadcast_id
      AND (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
      )
    )
  );

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_business_hours_instance ON business_hours(instance_id);
CREATE INDEX IF NOT EXISTS idx_appointments_instance ON appointments(instance_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder ON appointments(status, appointment_date, reminder_24h_sent) WHERE status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_group_settings_instance ON group_settings(instance_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_instance ON broadcasts(instance_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_discovered_groups_instance ON discovered_groups(instance_id);

-- 10. Grants (so service_role can access new tables)
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.instance_addons TO service_role;
GRANT ALL ON public.instances TO service_role;
GRANT ALL ON public.user_instances TO service_role;
GRANT ALL ON public.auto_responses TO service_role;
GRANT ALL ON public.response_logs TO service_role;
GRANT ALL ON public.business_hours TO service_role;
GRANT ALL ON public.appointments TO service_role;
GRANT ALL ON public.group_settings TO service_role;
GRANT ALL ON public.broadcasts TO service_role;
GRANT ALL ON public.broadcast_recipients TO service_role;
GRANT ALL ON public.discovered_groups TO service_role;
GRANT ALL ON public.group_discovery_cache TO service_role;

-- 11. Triggers
DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS group_settings_updated_at ON public.group_settings;
CREATE TRIGGER group_settings_updated_at
  BEFORE UPDATE ON public.group_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

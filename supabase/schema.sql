-- ============================================
-- Panel WhatsApp - Schema consolidado (v3)
-- Multi-usuario con admin + planes + auto-assign
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ENUMS
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.plan_type AS ENUM ('starter', 'pro', 'community');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.instance_status AS ENUM ('disconnected', 'qr_ready', 'connected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.addon_status AS ENUM ('active', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- 2. Profiles (extends auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  business_name TEXT,
  phone TEXT,
  address TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile + subscription starter on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );

  INSERT INTO public.subscriptions (user_id, plan_type, status, max_instances)
  VALUES (NEW.id, 'starter', 'active', 1);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. Subscriptions (1:1 con auth.users)
--    REGLA DE NEGOCIO: todos los planes incluyen
--    1 instancia base (max_instances = 1). Los bots
--    adicionales se contratan como add-ons y se
--    registran en instance_addons.
-- ============================================
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_type public.plan_type DEFAULT 'starter',
  status public.subscription_status DEFAULT 'active',
  max_instances INT DEFAULT 1 CHECK (max_instances >= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================
-- 3b. Instance Add-ons (bots extra contratados)
--      La unica forma de superar el bot base.
-- ============================================
CREATE TABLE instance_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status public.addon_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Limite efectivo de instancias de un usuario:
-- bot base del plan (1) + add-ons activos
CREATE OR REPLACE FUNCTION get_effective_max_instances(p_user_id UUID)
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

-- ============================================
-- 4. Instances (server Railway: url+key)
-- ============================================
CREATE TABLE instances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  instance_name TEXT NOT NULL,
  evolution_api_url TEXT NOT NULL,
  evolution_api_key TEXT NOT NULL,
  status TEXT DEFAULT 'close' CHECK (status IN ('open', 'close', 'connecting', 'qrcode')),
  welcome_message TEXT DEFAULT NULL,
  outside_hours_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. User-Instance assignments
-- ============================================
CREATE TABLE user_instances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instance_id)
);

-- Auto-assign: cada usuario recibe SU PROPIA instancia
-- en el server menos cargado (max 10 conexiones por server).
-- Funcion reutilizable: tambien se usa para backfill de usuarios existentes.
CREATE OR REPLACE FUNCTION public.assign_instance_for_user(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_role text;
  v_max_per_server CONSTANT integer := 10;
  v_server_url text;
  v_server_key text;
  v_admin uuid;
  v_base_name text;
  v_count integer;
  v_instance_name text;
  v_instance_id uuid;
BEGIN
  -- Solo usuarios regulares (el admin gestiona manualmente)
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  IF v_role IS DISTINCT FROM 'user' THEN
    RETURN NULL;
  END IF;

  -- Ya tiene instancia asignada
  IF EXISTS (
    SELECT 1 FROM public.user_instances WHERE user_id = p_user_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Limite efectivo del plan: bot base (1) + add-ons activos
  IF public.get_effective_max_instances(p_user_id) <= (
    SELECT COUNT(*) FROM public.user_instances WHERE user_id = p_user_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT i.evolution_api_url, i.evolution_api_key, i.admin_id
    INTO v_server_url, v_server_key, v_admin
    FROM instances i
   GROUP BY i.evolution_api_url, i.evolution_api_key, i.admin_id
  HAVING COUNT(*) < v_max_per_server
   ORDER BY COUNT(*) ASC, MAX(i.created_at) ASC
   LIMIT 1;

  IF v_server_url IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT instance_name INTO v_base_name
    FROM instances
   WHERE evolution_api_url = v_server_url
     AND evolution_api_key = v_server_key
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_base_name IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) + 1 INTO v_count
    FROM instances
   WHERE evolution_api_url = v_server_url
     AND evolution_api_key = v_server_key;

  v_instance_name := v_base_name || '-' || v_count;

  INSERT INTO instances (admin_id, instance_name, evolution_api_url, evolution_api_key, status)
  VALUES (v_admin, v_instance_name, v_server_url, v_server_key, 'close')
  RETURNING id INTO v_instance_id;

  INSERT INTO user_instances (user_id, instance_id)
  VALUES (p_user_id, v_instance_id);

  RETURN v_instance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.auto_assign_instance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assign_instance_for_user(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_instance ON public.profiles;
CREATE TRIGGER trg_auto_assign_instance
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_instance();

-- ============================================
-- 6. Auto Responses (keyword-based replies)
-- ============================================
CREATE TABLE auto_responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT,
  regex_pattern TEXT,
  response_text TEXT NOT NULL,
  response_media_url TEXT,
  response_type TEXT DEFAULT 'text' CHECK (response_type IN ('text', 'menu')),
  menu_config JSONB,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  schedule JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (keyword IS NOT NULL OR regex_pattern IS NOT NULL)
);

-- ============================================
-- 7. Response Logs (activity history)
-- ============================================
CREATE TABLE response_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  auto_response_id UUID REFERENCES auto_responses(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  incoming_phone TEXT NOT NULL,
  incoming_message TEXT NOT NULL,
  matched_keyword TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7b. Business Hours (Pro feature)
-- ============================================
CREATE TABLE business_hours (
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

-- ============================================
-- 7c. Appointments (Pro feature)
-- ============================================
CREATE TABLE appointments (
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

DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================
-- 8. Indexes for performance
-- ============================================
CREATE INDEX idx_instances_admin_id ON instances(admin_id);
CREATE INDEX idx_user_instances_user_id ON user_instances(user_id);
CREATE INDEX idx_user_instances_instance_id ON user_instances(instance_id);
CREATE INDEX idx_auto_responses_instance_id ON auto_responses(instance_id);
CREATE INDEX idx_auto_responses_user_id ON auto_responses(user_id);
CREATE INDEX idx_auto_responses_instance_active ON auto_responses(instance_id, is_active);
CREATE INDEX idx_response_logs_instance_id ON response_logs(instance_id);
CREATE INDEX idx_response_logs_sent_at ON response_logs(sent_at DESC);
CREATE INDEX idx_instance_addons_user_id ON instance_addons(user_id);
CREATE INDEX idx_business_hours_instance ON business_hours(instance_id);
CREATE INDEX idx_appointments_instance ON appointments(instance_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_reminder ON appointments(status, appointment_date, reminder_24h_sent) WHERE status IN ('pending', 'confirmed');

-- ============================================
-- 9. Row Level Security (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instance_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Revocar escalada de privilegios y exposicion de claves
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (evolution_api_key) ON public.instances FROM anon, authenticated;
REVOKE SELECT (evolution_api_url) ON public.instances FROM anon, authenticated;

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Subscriptions: cada usuario ve/actualiza la suya
CREATE POLICY "Users view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Instance Add-ons: usuario ve los suyos; admin gestiona todos
CREATE POLICY "Users view own instance_addons"
  ON instance_addons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin manage instance_addons"
  ON instance_addons FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Instances: admin puede CRUD las suyas, usuarios ven asignadas
CREATE POLICY "Admin can manage own instances"
  ON instances FOR ALL
  USING (auth.uid() = admin_id);

CREATE POLICY "Users can view assigned instances"
  ON instances FOR SELECT
  USING (
    id IN (
      SELECT instance_id FROM user_instances WHERE user_id = auth.uid()
    )
  );

-- User Instances: admin gestiona, usuario ve las suyas
CREATE POLICY "Admin can manage assignments"
  ON user_instances FOR ALL
  USING (
    instance_id IN (
      SELECT id FROM instances WHERE admin_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own assignments"
  ON user_instances FOR SELECT
  USING (auth.uid() = user_id);

-- Auto Responses: solo sobre instancias propias o asignadas
CREATE POLICY "Users can manage own auto_responses"
  ON auto_responses FOR ALL
  USING (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM instances WHERE id = auto_responses.instance_id AND admin_id = auth.uid())
      OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = auto_responses.instance_id AND user_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM instances WHERE id = auto_responses.instance_id AND admin_id = auth.uid())
      OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = auto_responses.instance_id AND user_id = auth.uid())
    )
  );

-- Response Logs: usuario ve/inserta los suyos
CREATE POLICY "Users can view own response_logs"
  ON response_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own response_logs"
  ON response_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Business Hours: owner or instance admin can manage, assigned users read
CREATE POLICY "business_hours access"
  ON business_hours FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = business_hours.instance_id AND user_id = auth.uid())
  );

-- Appointments: instance owner or assigned user can manage
CREATE POLICY "appointments access"
  ON appointments FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = appointments.instance_id AND user_id = auth.uid())
  );

ALTER TABLE group_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_settings access"
  ON group_settings FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
  );

CREATE POLICY "broadcasts access"
  ON broadcasts FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
  );

CREATE POLICY "broadcast_recipients access"
  ON broadcast_recipients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM broadcasts WHERE id = broadcast_id
      AND (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
      )
    )
  );

-- ============================================
-- 8b. Group Settings (Community feature)
-- ============================================
CREATE TABLE group_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  welcome_enabled BOOLEAN DEFAULT false,
  welcome_message TEXT DEFAULT NULL,
  spam_filter_enabled BOOLEAN DEFAULT false,
  block_all_links BOOLEAN DEFAULT true,
  allowed_domains TEXT[] DEFAULT '{}',
  banned_words_enabled BOOLEAN DEFAULT false,
  banned_words TEXT[] DEFAULT '{}',
  banned_words_action TEXT DEFAULT 'delete_and_reply' CHECK (banned_words_action IN ('delete', 'delete_and_reply')),
  banned_words_reply TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, group_jid)
);

DROP TRIGGER IF EXISTS group_settings_updated_at ON public.group_settings;
CREATE TRIGGER group_settings_updated_at
  BEFORE UPDATE ON public.group_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================
-- 8c. Broadcasts (Community feature)
-- ============================================
CREATE TABLE broadcasts (
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

CREATE TABLE broadcast_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID REFERENCES broadcasts(id) ON DELETE CASCADE NOT NULL,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT DEFAULT NULL,
  sent_at TIMESTAMPTZ DEFAULT NULL
);

-- ============================================
-- 10. Helper functions
-- ============================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- Get instance for user (first assigned)
CREATE OR REPLACE FUNCTION get_user_instance(user_id UUID)
RETURNS TABLE (
  instance_id UUID,
  instance_name TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.instance_name, i.status
  FROM instances i
  JOIN user_instances ui ON i.id = ui.instance_id
  WHERE ui.user_id = get_user_instance.user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Check if within schedule
CREATE OR REPLACE FUNCTION is_within_schedule(schedule JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  now_time TIME;
  from_time TIME;
  to_time TIME;
BEGIN
  IF schedule IS NULL THEN
    RETURN TRUE;
  END IF;

  now_time := CURRENT_TIME;
  from_time := (schedule->>'from')::TIME;
  to_time := (schedule->>'to')::TIME;

  IF from_time > to_time THEN
    RETURN now_time >= from_time OR now_time <= to_time;
  ELSE
    RETURN now_time >= from_time AND now_time <= to_time;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Match auto-responses
CREATE OR REPLACE FUNCTION match_auto_response(
  p_instance_id UUID,
  p_message TEXT
)
RETURNS TABLE (
  response_id UUID,
  response_text TEXT,
  response_media_url TEXT,
  matched_keyword TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.response_text,
    ar.response_media_url,
    CASE
      WHEN ar.keyword IS NOT NULL AND p_message ILIKE '%' || ar.keyword || '%'
        THEN ar.keyword
      WHEN ar.regex_pattern IS NOT NULL AND p_message ~* ar.regex_pattern
        THEN ar.regex_pattern
      ELSE NULL
    END as matched
  FROM auto_responses ar
  WHERE ar.instance_id = p_instance_id
    AND ar.is_active = true
    AND (
      (ar.keyword IS NOT NULL AND p_message ILIKE '%' || ar.keyword || '%')
      OR
      (ar.regex_pattern IS NOT NULL AND p_message ~* ar.regex_pattern)
    )
    AND is_within_schedule(ar.schedule)
  ORDER BY ar.priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Grants (service_role) — permite a createServerClient
-- leer/escribir todas las tablas (bypass de RLS).
-- ============================================
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
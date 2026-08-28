-- ============================================
-- Panel WhatsApp - Update incremental
-- ============================================
-- Aplicado: FIX deteccion de rol admin (layout usa
-- /api/auth/me con service role) + politica RLS de
-- profiles reforzada. Idempotente.
-- ============================================

-- 1. Garantizar politica RLS de profiles: usuario ve/edita el suyo
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2b. onboarding_completed en profiles
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3. Seguridad: role solo via service_role (evita auto-promocion)
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (evolution_api_key) ON public.instances FROM anon, authenticated;
REVOKE SELECT (evolution_api_url) ON public.instances FROM anon, authenticated;

-- 3. Verificar el rol de todos los perfiles (diagnostico)
SELECT id, email, role FROM public.profiles ORDER BY created_at ASC;

-- ============================================
-- Menú de botones interactivos (Starter feature)
-- ============================================
-- Agrega response_type y menu_config a auto_responses.
-- response_type: 'text' (default) o 'menu'
-- menu_config: JSONB con título, descripción, footer y hasta 3 botones
-- Cada botón apunta a otra auto_response (submenu) o envía texto directo.
-- ============================================

DO $$ BEGIN
  ALTER TABLE auto_responses
    ADD COLUMN response_type TEXT DEFAULT 'text'
    CHECK (response_type IN ('text', 'menu'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE auto_responses ADD COLUMN menu_config JSONB;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- Botón tap: cuando el usuario toca un botón, Evolution API
-- envía un mensaje tipo buttonsResponseMessage o
-- listResponseMessage. El webhook debe extraer el texto del
-- botón y buscar una auto_response con keyword == texto_botón.
-- ============================================================

-- ============================================
-- Calendario / Turnos (Pro feature)
-- ============================================
-- business_hours: horarios del negocio por día de la semana
-- appointments: citas/turnos agendados vía WhatsApp
-- ============================================

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

-- RLS
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- business_hours: owner or instance admin can manage, assigned users read
DROP POLICY IF EXISTS "business_hours owner" ON business_hours;
DROP POLICY IF EXISTS "business_hours access" ON business_hours;
CREATE POLICY "business_hours access" ON business_hours FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = business_hours.instance_id AND user_id = auth.uid())
  );

-- appointments: instance owner or assigned user can manage
DROP POLICY IF EXISTS "appointments access" ON appointments;
CREATE POLICY "appointments access" ON appointments FOR ALL
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = appointments.instance_id AND user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_instance ON appointments(instance_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder ON appointments(status, appointment_date, reminder_24h_sent) WHERE status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_business_hours_instance ON business_hours(instance_id);

-- Touch trigger
DROP TRIGGER IF EXISTS appointments_updated_at ON public.appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================
-- Bienvenida + Fuera de horario (Starter features)
-- ============================================
-- welcome_message: se envía al primer mensaje de cada teléfono nuevo
-- outside_hours_message: se envía cuando escriben fuera del horario laboral
-- ============================================

DO $$ BEGIN
  ALTER TABLE instances
    ADD COLUMN welcome_message TEXT DEFAULT NULL,
    ADD COLUMN outside_hours_message TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================
-- Community: Grupos, Bienvenida, Anti-spam, Broadcasts
-- ============================================

CREATE TABLE IF NOT EXISTS group_settings (
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, group_jid)
);

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

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID REFERENCES broadcasts(id) ON DELETE CASCADE NOT NULL,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT DEFAULT NULL,
  sent_at TIMESTAMPTZ DEFAULT NULL
);

-- RLS
ALTER TABLE group_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_settings_instance ON group_settings(instance_id);
CREATE INDEX IF NOT EXISTS idx_group_settings_jid ON group_settings(instance_id, group_jid);
CREATE INDEX IF NOT EXISTS idx_broadcasts_instance ON broadcasts(instance_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id);

-- Touch trigger for group_settings
DROP TRIGGER IF EXISTS group_settings_updated_at ON public.group_settings;
CREATE TRIGGER group_settings_updated_at
  BEFORE UPDATE ON public.group_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
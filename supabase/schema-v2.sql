-- ============================================
-- Panel WhatsApp v2 - Multi-usuario con Admin
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Profiles (extends auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. Instances (admin creates, users connect)
-- ============================================
CREATE TABLE instances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  instance_name TEXT NOT NULL,
  evolution_api_url TEXT NOT NULL,
  evolution_api_key TEXT NOT NULL,
  status TEXT DEFAULT 'close' CHECK (status IN ('open', 'close', 'connecting', 'qrcode')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. User-Instance assignments
-- ============================================
CREATE TABLE user_instances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instance_id)
);

-- ============================================
-- 4. Auto Responses (keyword-based replies)
-- ============================================
CREATE TABLE auto_responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT,
  regex_pattern TEXT,
  response_text TEXT NOT NULL,
  response_media_url TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  schedule JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (keyword IS NOT NULL OR regex_pattern IS NOT NULL)
);

-- ============================================
-- 5. Response Logs (activity history)
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
-- 6. Indexes for performance
-- ============================================
CREATE INDEX idx_instances_admin_id ON instances(admin_id);
CREATE INDEX idx_user_instances_user_id ON user_instances(user_id);
CREATE INDEX idx_user_instances_instance_id ON user_instances(instance_id);
CREATE INDEX idx_auto_responses_instance_id ON auto_responses(instance_id);
CREATE INDEX idx_auto_responses_user_id ON auto_responses(user_id);
CREATE INDEX idx_response_logs_instance_id ON response_logs(instance_id);
CREATE INDEX idx_response_logs_sent_at ON response_logs(sent_at DESC);

-- ============================================
-- 7. Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Instances: admin can CRUD their own, users can view assigned
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

-- User Instances: admin can assign/unassign
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

-- Auto Responses: users can CRUD for their assigned instances
CREATE POLICY "Users can manage own auto_responses"
  ON auto_responses FOR ALL
  USING (auth.uid() = user_id);

-- Response Logs: users can view logs for their assigned instances
CREATE POLICY "Users can view own response_logs"
  ON response_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own response_logs"
  ON response_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 8. Helper functions
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

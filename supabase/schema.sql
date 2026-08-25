-- ============================================
-- Panel WhatsApp - Supabase Schema
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
-- 2. Instances (WhatsApp instances per user)
-- ============================================
CREATE TABLE instances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  instance_name TEXT NOT NULL,
  evolution_api_url TEXT NOT NULL,
  evolution_api_key TEXT NOT NULL,
  status TEXT DEFAULT 'close' CHECK (status IN ('open', 'close', 'connecting', 'qrcode')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instance_name)
);

-- ============================================
-- 3. Auto Responses (keyword-based replies)
-- ============================================
CREATE TABLE auto_responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
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
-- 4. Response Logs (activity history)
-- ============================================
CREATE TABLE response_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  auto_response_id UUID REFERENCES auto_responses(id) ON DELETE SET NULL,
  incoming_phone TEXT NOT NULL,
  incoming_message TEXT NOT NULL,
  matched_keyword TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Indexes for performance
-- ============================================
CREATE INDEX idx_instances_user_id ON instances(user_id);
CREATE INDEX idx_auto_responses_instance_id ON auto_responses(instance_id);
CREATE INDEX idx_auto_responses_instance_active ON auto_responses(instance_id, is_active);
CREATE INDEX idx_response_logs_instance_id ON response_logs(instance_id);
CREATE INDEX idx_response_logs_sent_at ON response_logs(sent_at DESC);

-- ============================================
-- 6. Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Instances: users can CRUD their own instances
CREATE POLICY "Users can view own instances"
  ON instances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own instances"
  ON instances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instances"
  ON instances FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instances"
  ON instances FOR DELETE
  USING (auth.uid() = user_id);

-- Auto Responses: users can CRUD responses for their instances
CREATE POLICY "Users can view own auto_responses"
  ON auto_responses FOR SELECT
  USING (
    instance_id IN (
      SELECT id FROM instances WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own auto_responses"
  ON auto_responses FOR INSERT
  WITH CHECK (
    instance_id IN (
      SELECT id FROM instances WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own auto_responses"
  ON auto_responses FOR UPDATE
  USING (
    instance_id IN (
      SELECT id FROM instances WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own auto_responses"
  ON auto_responses FOR DELETE
  USING (
    instance_id IN (
      SELECT id FROM instances WHERE user_id = auth.uid()
    )
  );

-- Response Logs: users can view logs for their instances
CREATE POLICY "Users can view own response_logs"
  ON response_logs FOR SELECT
  USING (
    instance_id IN (
      SELECT id FROM instances WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own response_logs"
  ON response_logs FOR INSERT
  WITH CHECK (
    instance_id IN (
      SELECT id FROM instances WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 7. Function to check if within schedule
-- ============================================
CREATE OR REPLACE FUNCTION is_within_schedule(schedule JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  now_time TIME;
  from_time TIME;
  to_time TIME;
BEGIN
  -- If no schedule, always active
  IF schedule IS NULL THEN
    RETURN TRUE;
  END IF;

  now_time := CURRENT_TIME;
  from_time := (schedule->>'from')::TIME;
  to_time := (schedule->>'to')::TIME;

  -- Handle overnight schedules (e.g., 22:00 to 06:00)
  IF from_time > to_time THEN
    RETURN now_time >= from_time OR now_time <= to_time;
  ELSE
    RETURN now_time >= from_time AND now_time <= to_time;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Function to match auto-responses
-- ============================================
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

-- discovered_groups: captura automática de grupos desde webhook
-- Pegar en Supabase SQL Editor y ejecutar

CREATE TABLE IF NOT EXISTS discovered_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, group_jid)
);

ALTER TABLE discovered_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discovered_groups access" ON discovered_groups;
CREATE POLICY "discovered_groups access" ON discovered_groups FOR ALL
  USING (
    EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = discovered_groups.instance_id AND user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_discovered_groups_instance ON discovered_groups(instance_id);

GRANT ALL ON public.discovered_groups TO service_role;

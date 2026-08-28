-- group_discovery_cache: caché temporal del resultado de "Buscar grupos"
-- El panel consulta Evolution al clickear "Buscar grupos", guarda el JSON acá
-- y lo consume desde la DB (sin re-consultar). Expira en minutos (expires_at)
-- para no acumularse.
-- Pegar en Supabase SQL Editor y ejecutar

CREATE TABLE IF NOT EXISTS group_discovery_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instances(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE group_discovery_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_discovery_cache access" ON group_discovery_cache;
CREATE POLICY "group_discovery_cache access" ON group_discovery_cache FOR ALL
  USING (
    EXISTS (SELECT 1 FROM instances WHERE id = instance_id AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_instances WHERE instance_id = group_discovery_cache.instance_id AND user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_group_discovery_cache_instance ON group_discovery_cache(instance_id);

GRANT ALL ON public.group_discovery_cache TO service_role;

-- discovered_groups: persistencia del estado admin verificado (para que "Buscar
-- grupos" no dependa de que findGroupInfos responda siempre a tiempo).
ALTER TABLE discovered_groups ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE discovered_groups ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE discovered_groups ADD COLUMN IF NOT EXISTS group_picture TEXT;

-- group_settings: imagen del grupo (para mostrar el logo en la lista).
ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS picture_url TEXT;

-- instances: JID del dueño/bot (persistido para no consultar Evolution en cada
-- "Buscar grupos"). Solo cambia si se re-vincula WhatsApp.
ALTER TABLE instances ADD COLUMN IF NOT EXISTS owner_jid TEXT;
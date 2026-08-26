-- ============================================
-- Panel WhatsApp - Update incremental
-- ============================================
-- Aplicado: BACKFILL de instancias para usuarios
-- existentes sin instancia asignada + refactor de
-- auto_assign_instance a funcion reutilizable.
-- Idempotente: se puede ejecutar mas de una vez.
-- ============================================

-- 1. Funcion reutilizable: asigna una instancia propia a un usuario
--    (server Railway menos cargado, max 10 conexiones por server).
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

  -- Servidor (url+key) con menos instancias y con cupo (< 10 conexiones)
  SELECT i.evolution_api_url, i.evolution_api_key, i.admin_id
    INTO v_server_url, v_server_key, v_admin
    FROM instances i
   GROUP BY i.evolution_api_url, i.evolution_api_key, i.admin_id
  HAVING COUNT(*) < v_max_per_server
   ORDER BY COUNT(*) ASC, MAX(i.created_at) ASC
   LIMIT 1;

  -- Sin server con cupo: el admin debe levantar otro server en Railway
  IF v_server_url IS NULL THEN
    RETURN NULL;
  END IF;

  -- Nombre base: la instancia mas reciente de ese server
  SELECT instance_name INTO v_base_name
    FROM instances
   WHERE evolution_api_url = v_server_url
     AND evolution_api_key = v_server_key
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_base_name IS NULL THEN
    RETURN NULL;
  END IF;

  -- Nombre unico: <base>-<n+1>
  SELECT COUNT(*) + 1 INTO v_count
    FROM instances
   WHERE evolution_api_url = v_server_url
     AND evolution_api_key = v_server_key;

  v_instance_name := v_base_name || '-' || v_count;

  -- Crear la instancia (numero de WhatsApp) para este usuario
  INSERT INTO instances (admin_id, instance_name, evolution_api_url, evolution_api_key, status)
  VALUES (v_admin, v_instance_name, v_server_url, v_server_key, 'close')
  RETURNING id INTO v_instance_id;

  -- Asignarla al usuario
  INSERT INTO user_instances (user_id, instance_id)
  VALUES (p_user_id, v_instance_id);

  RETURN v_instance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Trigger: usa la funcion reutilizable
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

-- 3. BACKFILL: asigna instancia a usuarios existentes sin ninguna
DO $$
DECLARE
  r RECORD;
  v_assigned uuid;
  v_ok integer := 0;
  v_skip integer := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.email
    FROM public.profiles p
    WHERE p.role = 'user'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_instances ui WHERE ui.user_id = p.id
      )
  LOOP
    v_assigned := public.assign_instance_for_user(r.id);
    IF v_assigned IS NOT NULL THEN
      v_ok := v_ok + 1;
    ELSE
      v_skip := v_skip + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill completado: % asignadas, % sin cupo', v_ok, v_skip;
END $$;
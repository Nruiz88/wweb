-- ============================================
-- Asignacion por usuario con su propio WhatsApp
-- "Instancia" = server de Railway (url+key).
-- Cada usuario nuevo recibe SU PROPIA instancia
-- (su numero de WhatsApp) en el server menos
-- cargado, con un maximo de 10 conexiones por
-- server para acotar la RAM de Railway.
--
-- Reemplaza la funcion anterior (que compartia
-- una sola instancia entre 10 usuarios).
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_assign_instance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  IF NEW.role <> 'user' THEN
    RETURN NEW;
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
    RETURN NEW;
  END IF;

  -- Nombre base: la instancia mas reciente de ese server
  SELECT instance_name INTO v_base_name
    FROM instances
   WHERE evolution_api_url = v_server_url
     AND evolution_api_key = v_server_key
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_base_name IS NULL THEN
    RETURN NEW;
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
  VALUES (NEW.id, v_instance_id);

  RETURN NEW;
END;
$$;
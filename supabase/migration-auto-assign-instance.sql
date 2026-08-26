-- ============================================
-- Auto-assign nuevos usuarios a instancias
-- Regla: maximo 10 usuarios por instancia.
-- Si todas las instancias estan llenas, se
-- auto-crea una nueva copiando la configuracion
-- de la instancia mas reciente.
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_assign_instance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_per_instance CONSTANT integer := 10;
  v_target_id uuid;
  v_last_instance instances%ROWTYPE;
  v_new_name text;
  v_count integer;
BEGIN
  -- Solo asignamos a usuarios regulares (el admin gestiona manualmente)
  IF NEW.role <> 'user' THEN
    RETURN NEW;
  END IF;

  -- Instancia con menos usuarios asignados que todavia tenga cupo
  SELECT i.id
    INTO v_target_id
    FROM instances i
    LEFT JOIN user_instances ui ON ui.instance_id = i.id
   GROUP BY i.id
  HAVING COUNT(ui.id) < v_max_per_instance
   ORDER BY COUNT(ui.id) ASC, i.created_at ASC
   LIMIT 1;

  -- Sin cupo en ninguna: auto-crear una nueva basada en la mas reciente
  IF v_target_id IS NULL THEN
    SELECT * INTO v_last_instance
      FROM instances
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_last_instance.id IS NOT NULL THEN
      SELECT COUNT(*) + 1 INTO v_count FROM instances;
      v_new_name := v_last_instance.instance_name || '-' || v_count;

      INSERT INTO instances (admin_id, instance_name, evolution_api_url, evolution_api_key, status)
      VALUES (
        v_last_instance.admin_id,
        v_new_name,
        v_last_instance.evolution_api_url,
        v_last_instance.evolution_api_key,
        'close'
      )
      RETURNING id INTO v_target_id;
    END IF;
  END IF;

  -- Asignar al usuario a la instancia elegida
  IF v_target_id IS NOT NULL THEN
    INSERT INTO user_instances (user_id, instance_id)
    VALUES (NEW.id, v_target_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_instance ON public.profiles;
CREATE TRIGGER trg_auto_assign_instance
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_instance();
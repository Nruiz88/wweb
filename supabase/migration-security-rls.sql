-- ============================================
-- Seguridad: endurecer RLS y privilegios
-- ============================================

-- 1) ESCALADA DE PRIVILEGIOS:
--    Un usuario autenticado podia auto-promoverse a admin actualizando
--    su propio perfil (RLS permitia UPDATE sobre toda la fila).
--    Ahora solo service_role (backend) puede modificar "role".
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;

-- 2) EXPOSICION DE CLAVES:
--    La RLS de "instances" permitia a usuarios asignados SELECT sobre
--    toda la fila, incluyendo evolution_api_key (clave global de Evolution).
--    Se revoca la lectura de esa columna y de la URL del servidor para
--    roles publicos.
REVOKE SELECT (evolution_api_key) ON public.instances FROM anon, authenticated;
REVOKE SELECT (evolution_api_url) ON public.instances FROM anon, authenticated;

-- 3) POLLUCION ENTRE INSTANCIAS:
--    La politica de auto_responses solo verificaba user_id, permitiendo
--    insertar reglas sobre instancias ajenas. Ahora exige ser admin de la
--    instancia o estar asignado a ella.
DROP POLICY IF EXISTS "Users can manage own auto_responses" ON public.auto_responses;

CREATE POLICY "Users can manage own auto_responses"
  ON public.auto_responses FOR ALL
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
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

-- 2. Seguridad: role solo via service_role (evita auto-promocion)
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (evolution_api_key) ON public.instances FROM anon, authenticated;
REVOKE SELECT (evolution_api_url) ON public.instances FROM anon, authenticated;

-- 3. Verificar el rol de todos los perfiles (diagnostico)
SELECT id, email, role FROM public.profiles ORDER BY created_at ASC;
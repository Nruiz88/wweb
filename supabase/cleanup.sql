-- ============================================================
-- Limpieza automática de datos temporales/históricos (multitenant)
-- Limpia SOLO las tablas de NUESTRA app en Postgres (Supabase).
-- NO toca la MongoDB de Evolution (los mensajes de WhatsApp son del servidor
-- de Evolution, se manejan aparte a nivel de instancia/operador).
--
-- Uso:
--   1) Habilitar la extensión pg_cron en Supabase (Database → Extensions,
--      o correr: create extension if not exists pg_cron;)
--   2) Programar (ej. todos los días 03:00 UTC):
--        select cron.schedule('cleanup-daily', '0 3 * * *', $$ select public.run_cleanup(); $$);
--   3) Para probar manualmente: select public.run_cleanup();
-- ============================================================

CREATE OR REPLACE FUNCTION public.run_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1) Logs de respuestas del bot > 30 días
  DELETE FROM public.response_logs WHERE sent_at < now() - interval '30 days';

  -- 2) Pedidos completados/cancelados > 90 días
  DELETE FROM public.orders
  WHERE status IN ('completed', 'canceled') AND created_at < now() - interval '90 days';
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_cleanup() TO service_role;

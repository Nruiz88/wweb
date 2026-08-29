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
  -- 1) Caché temporal del "Buscar grupos" vencido
  DELETE FROM public.group_discovery_cache WHERE expires_at < now();

  -- 2) Logs de respuestas del bot > 30 días
  DELETE FROM public.response_logs WHERE sent_at < now() - interval '30 days';

  -- 3) Grupos descubiertos sin actividad en 30 días (y que NO estén configurados)
  DELETE FROM public.discovered_groups dg
  WHERE dg.last_seen_at < now() - interval '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.group_settings gs
      WHERE gs.instance_id = dg.instance_id AND gs.group_jid = dg.group_jid
    );

  -- 4) Destinatarios de broadcasts (enviados/fallidos) > 30 días
  DELETE FROM public.broadcast_recipients
  WHERE status IN ('sent', 'failed') AND sent_at < now() - interval '30 days';

  -- 5) Broadcasts completados/fallidos > 90 días (se conservan borradores)
  DELETE FROM public.broadcasts
  WHERE status IN ('completed', 'failed') AND created_at < now() - interval '90 days';
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_cleanup() TO service_role;
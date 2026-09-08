-- Marca de frescura del estado vivo de Evolution.
-- /api/instances sirve el status de la DB si checked_at < 60s y evita
-- llamar a Evolution en cada request (el caché en memoria no sirve en serverless).
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS status_checked_at TIMESTAMPTZ DEFAULT NULL;

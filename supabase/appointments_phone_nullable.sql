-- appointments.customer_phone nullable
-- Motivo: el booking público (link /agendar) no siempre tiene teléfono del
-- cliente → sin esto el insert fallaba con NOT NULL (el turno "no se tomaba").
-- Pegar en Supabase SQL Editor y ejecutar.

ALTER TABLE appointments ALTER COLUMN customer_phone DROP NOT NULL;
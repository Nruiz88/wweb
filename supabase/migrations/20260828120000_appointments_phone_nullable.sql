-- appointments.customer_phone nullable (booking público por link sin teléfono)
ALTER TABLE appointments ALTER COLUMN customer_phone DROP NOT NULL;
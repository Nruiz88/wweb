-- ============================================
-- Migracion: Agregar campos de perfil de negocio
-- ============================================

-- Agregar columnas nuevas
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Migrar datos existentes de auth.users
UPDATE profiles p
SET
  full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name'),
  phone = COALESCE(p.phone, u.phone)
FROM auth.users u
WHERE p.id = u.id AND (p.full_name IS NULL OR p.phone IS NULL);

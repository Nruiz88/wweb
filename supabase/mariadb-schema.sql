-- ============================================
-- Panel WhatsApp - MariaDB Schema (v3)
-- Migración de Supabase -> MariaDB/Coolify
-- ============================================

-- 1. Profiles (usuarios: admin + user)
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  business_name VARCHAR(255),
  phone VARCHAR(60),
  address VARCHAR(500),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin','user')),
  onboarding_completed BOOLEAN DEFAULT false,
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

-- 2. Subscriptions (plan de usuario)
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  plan_type VARCHAR(20) DEFAULT 'pending' CHECK (plan_type IN ('pending','starter','pro')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','canceled')),
  max_instances INT DEFAULT 0 CHECK (max_instances >= 0),
  paid_until TIMESTAMP NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- 3. Instance Add-ons (bots extra)
CREATE TABLE IF NOT EXISTS instance_addons (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','canceled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_instance_addons_user ON instance_addons(user_id);

-- 4. Instances (configuración del servidor WhatsApp)
CREATE TABLE IF NOT EXISTS instances (
  id VARCHAR(36) PRIMARY KEY,
  admin_id VARCHAR(36) NOT NULL,
  instance_name VARCHAR(255) NOT NULL,
  evolution_api_url VARCHAR(500) NOT NULL,
  evolution_api_key VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'close' CHECK (status IN ('open','close','connecting','qrcode')),
  status_checked_at TIMESTAMP NULL,
  welcome_message TEXT,
  outside_hours_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_instances_admin ON instances(admin_id);

-- 5. User-Instance assignments
CREATE TABLE IF NOT EXISTS user_instances (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  instance_id VARCHAR(36) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_instance (user_id, instance_id),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_instances_user ON user_instances(user_id);
CREATE INDEX idx_user_instances_instance ON user_instances(instance_id);

-- 6. Auto Responses (respuestas automáticas por keyword)
CREATE TABLE IF NOT EXISTS auto_responses (
  id VARCHAR(36) PRIMARY KEY,
  instance_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  keyword VARCHAR(255),
  regex_pattern TEXT,
  response_text TEXT NOT NULL,
  response_media_url VARCHAR(500),
  response_type VARCHAR(20) DEFAULT 'text' CHECK (response_type IN ('text','menu')),
  menu_config JSON,
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  schedule JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CHECK (keyword IS NOT NULL OR regex_pattern IS NOT NULL)
);

CREATE INDEX idx_auto_responses_instance ON auto_responses(instance_id);
CREATE INDEX idx_auto_responses_user ON auto_responses(user_id);
CREATE INDEX idx_auto_responses_active ON auto_responses(instance_id, is_active);

-- 7. Response Logs (historial de actividad)
CREATE TABLE IF NOT EXISTS response_logs (
  id VARCHAR(36) PRIMARY KEY,
  instance_id VARCHAR(36) NOT NULL,
  auto_response_id VARCHAR(36),
  user_id VARCHAR(36),
  incoming_phone VARCHAR(60) NOT NULL,
  incoming_message TEXT NOT NULL,
  matched_keyword VARCHAR(255),
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
  FOREIGN KEY (auto_response_id) REFERENCES auto_responses(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_response_logs_instance ON response_logs(instance_id);
CREATE INDEX idx_response_logs_sent_at ON response_logs(sent_at DESC);

-- 8. Business Hours (horario de atención)
CREATE TABLE IF NOT EXISTS business_hours (
  id VARCHAR(36) PRIMARY KEY,
  instance_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  slot_duration_min INT NOT NULL DEFAULT 30 CHECK (slot_duration_min BETWEEN 10 AND 120),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE KEY unique_instance_day (instance_id, day_of_week)
);

CREATE INDEX idx_business_hours_instance ON business_hours(instance_id);

-- 9. Appointments (reservas del calendario)
CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(36) PRIMARY KEY,
  instance_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  customer_phone VARCHAR(60),
  customer_name VARCHAR(255),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_min INT NOT NULL DEFAULT 30,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','canceled','completed')),
  notes TEXT,
  reminder_24h_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_appointments_instance ON appointments(instance_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_reminder ON appointments(status, appointment_date, reminder_24h_sent);

-- 10. Catalog items (productos del catálogo)
CREATE TABLE IF NOT EXISTS catalog_items (
  id VARCHAR(36) PRIMARY KEY,
  instance_id VARCHAR(36) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  price_cents INT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  category VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_catalog_items_instance ON catalog_items(instance_id);
CREATE INDEX idx_catalog_items_active ON catalog_items(instance_id, active, sort_order);

-- 11. Orders (órdenes genéricas)
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  instance_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  customer_phone VARCHAR(60),
  customer_name VARCHAR(255),
  catalog_item_id VARCHAR(36),
  option_label VARCHAR(255) NOT NULL,
  price_cents INT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','canceled')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id) ON DELETE SET NULL
);

CREATE INDEX idx_orders_instance ON orders(instance_id);
CREATE INDEX idx_orders_date ON orders(instance_id, created_at);
CREATE INDEX idx_orders_status ON orders(status);

-- 12. Mercado Pago config
CREATE TABLE IF NOT EXISTS mercado_pago_config (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  access_token TEXT,
  public_key TEXT,
  webhook_secret TEXT,
  addon_price_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- 13. Payments (registro de pagos)
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  external_id VARCHAR(255) NOT NULL UNIQUE,
  mp_payment_id VARCHAR(255) NULL,
  amount_cents INT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  plan_activated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_payments_external ON payments(external_id);
CREATE INDEX idx_payments_user_status ON payments(user_id, status);

-- 14. Plan Config (precios base por plan)
CREATE TABLE IF NOT EXISTS plan_config (
  plan_type VARCHAR(20) PRIMARY KEY CHECK (plan_type IN ('starter','pro')),
  amount_cents INT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  label VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT,
  max_instances INT NOT NULL DEFAULT 1 CHECK (max_instances >= 1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_plan_config_plan ON plan_config(plan_type);

-- 15. Discovered groups (grupos detectados por webhook)
CREATE TABLE IF NOT EXISTS discovered_groups (
  id VARCHAR(36) PRIMARY KEY,
  instance_id VARCHAR(36) NOT NULL,
  jid VARCHAR(255) NOT NULL,
  group_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_discovered_groups_instance ON discovered_groups(instance_id);

-- 16. Invitations (invitaciones de instancias)
CREATE TABLE IF NOT EXISTS invitations (
  id VARCHAR(36) PRIMARY KEY,
  instance_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_invitations_instance ON invitations(instance_id);
CREATE INDEX idx_invitations_token ON invitations(token);

-- 17. Webhook logs (audit de eventos entrantes)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id VARCHAR(36) PRIMARY KEY,
  event_type VARCHAR(255) NOT NULL,
  instance_id VARCHAR(36),
  user_id VARCHAR(36),
  payload JSON,
  status VARCHAR(20) DEFAULT 'processed' CHECK (status IN ('processed','failed','skipped')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_webhook_logs_event ON webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- ============================================
-- Estado inicial: registro de plan_config + sin usuarios
-- (En prod, el primer admin se crea por invitación o manual)
-- ============================================
INSERT IGNORE INTO plan_config (plan_type, amount_cents, label, description, max_instances)
VALUES
  ('starter', 0, 'Starter', 'Para pymes pequeñas', 1),
  ('pro', 15000, 'Pro', 'Para negocios en crecimiento', 3);

-- ============================================
-- Stored procedure: asigna una instancia libre al usuario.
-- Llamada por el webhook de MercadoPago y por onboarding/confirm-plan.
-- Idempotente: si el usuario ya tiene instancia, no hace nada.
-- ============================================
DROP PROCEDURE IF EXISTS assign_instance_for_user;
DELIMITER //
CREATE PROCEDURE assign_instance_for_user(IN p_user_id VARCHAR(36))
BEGIN
  DECLARE v_already VARCHAR(36);
  DECLARE v_instance_id VARCHAR(36);

  -- ¿Ya tiene instancia asignada? No hacer nada.
  SELECT instance_id INTO v_already
  FROM user_instances
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_already IS NULL THEN
    -- Primera instancia sin usuario asignado, prefiriendo las conectadas.
    SELECT i.id INTO v_instance_id
    FROM instances i
    LEFT JOIN user_instances ui ON ui.instance_id = i.id
    WHERE ui.id IS NULL
    ORDER BY (i.status = 'connected') DESC
    LIMIT 1;

    IF v_instance_id IS NOT NULL THEN
      INSERT INTO user_instances (id, user_id, instance_id, assigned_at)
      VALUES (REPLACE(UUID(), '-', ''), p_user_id, v_instance_id, NOW());
    END IF;
  END IF;
END//
DELIMITER ;

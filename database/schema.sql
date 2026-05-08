-- ===========================================
-- SKYVORA AVIATION — PostgreSQL Schema
-- ===========================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- USERS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'pilot', 'copilot')),
  initials VARCHAR(4),
  active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- PILOTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS pilots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('pilot', 'copilot')),
  aircraft_assigned VARCHAR(30),
  phone VARCHAR(30),
  total_hours INTEGER DEFAULT 0,
  hours_aw169 INTEGER DEFAULT 0,

  -- Documents
  license_number VARCHAR(50),
  license_type VARCHAR(20),        -- ATPL/H, CPL/H
  license_expiry DATE,
  medical_class1_expiry DATE,
  huet_expiry DATE,
  bosiet_expiry DATE,
  annual_check_expiry DATE,

  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- AIRCRAFT TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS aircraft (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration VARCHAR(20) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  mtow_lbs INTEGER NOT NULL DEFAULT 10560,
  empty_weight_lbs INTEGER DEFAULT 6834,
  crew_equip_lbs INTEGER DEFAULT 1074,
  operating_weight_lbs INTEGER DEFAULT 7908,
  max_passengers INTEGER DEFAULT 12,
  max_fuel_lbs INTEGER DEFAULT 2200,
  cruise_speed_kts INTEGER DEFAULT 155,
  pax_std_weight_lbs INTEGER DEFAULT 187,

  -- Documents
  airworthiness_expiry DATE,
  insurance_expiry DATE,
  registration_expiry DATE,
  last_100h_check DATE,
  next_100h_check DATE,
  hours_since_check INTEGER DEFAULT 0,

  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- DESTINATIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('Base', 'Offshore', 'FPSO', 'Other')),
  coordinates VARCHAR(60),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- DISTANCES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS distances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_dest_id UUID REFERENCES destinations(id) ON DELETE CASCADE,
  to_dest_id UUID REFERENCES destinations(id) ON DELETE CASCADE,
  distance_nm INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_dest_id, to_dest_id)
);

-- ===========================================
-- DAY OPERATIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS day_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  commander_id UUID REFERENCES pilots(id),
  copilot_id UUID REFERENCES pilots(id),
  aircraft_id UUID REFERENCES aircraft(id),
  motor_on_time TIME,
  motor_off_time TIME,
  initial_fuel_lbs INTEGER DEFAULT 0,
  final_fuel_lbs INTEGER DEFAULT 0,
  total_block_minutes INTEGER DEFAULT 0,
  total_nm INTEGER DEFAULT 0,
  total_fuel_burn_lbs INTEGER DEFAULT 0,
  total_passengers INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'signed')),
  signed_by_commander BOOLEAN DEFAULT FALSE,
  signed_by_copilot BOOLEAN DEFAULT FALSE,
  signed_by_admin BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- FLIGHTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS flights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_op_id UUID REFERENCES day_operations(id) ON DELETE CASCADE,
  flight_number INTEGER NOT NULL,
  from_dest_id UUID REFERENCES destinations(id),
  to_dest_id UUID REFERENCES destinations(id),
  departure_time TIME NOT NULL,
  arrival_time TIME,
  duration_minutes INTEGER,
  distance_nm INTEGER DEFAULT 0,

  -- Passengers
  passengers_on_board INTEGER DEFAULT 0,
  passengers_drop INTEGER DEFAULT 0,
  passengers_pickup INTEGER DEFAULT 0,
  passengers_weight_lbs INTEGER DEFAULT 0,

  -- Fuel
  fuel_remain_lbs INTEGER DEFAULT 0,
  fuel_uplift_lbs INTEGER DEFAULT 0,
  fuel_total_lbs INTEGER DEFAULT 0,
  fuel_burn_lbs INTEGER DEFAULT 0,
  fuel_after_lbs INTEGER DEFAULT 0,

  -- Cargo
  cargo_on_lbs INTEGER DEFAULT 0,
  cargo_off_lbs INTEGER DEFAULT 0,
  cargo_net_lbs INTEGER DEFAULT 0,

  -- Weight
  total_weight_lbs INTEGER DEFAULT 0,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- EDIT LOG TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS edit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  user_name VARCHAR(120),
  entity_type VARCHAR(30) NOT NULL,   -- 'flight', 'day_operation', 'pilot'
  entity_id UUID NOT NULL,
  field_name VARCHAR(60) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- ALERTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(40) NOT NULL,    -- 'doc_expiry', 'hours_limit', 'weight_exceed', 'maintenance'
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'warning', 'danger')),
  title VARCHAR(150) NOT NULL,
  message TEXT,
  pilot_id UUID REFERENCES pilots(id),
  aircraft_id UUID REFERENCES aircraft(id),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_flights_day_op ON flights(day_op_id);
CREATE INDEX IF NOT EXISTS idx_flights_from ON flights(from_dest_id);
CREATE INDEX IF NOT EXISTS idx_flights_to ON flights(to_dest_id);
CREATE INDEX IF NOT EXISTS idx_day_ops_date ON day_operations(date);
CREATE INDEX IF NOT EXISTS idx_day_ops_commander ON day_operations(commander_id);
CREATE INDEX IF NOT EXISTS idx_edit_logs_entity ON edit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_edit_logs_user ON edit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_distances_from ON distances(from_dest_id);
CREATE INDEX IF NOT EXISTS idx_distances_to ON distances(to_dest_id);

-- ===========================================
-- UPDATED_AT TRIGGER
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_pilots_updated
  BEFORE UPDATE ON pilots FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_aircraft_updated
  BEFORE UPDATE ON aircraft FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_day_ops_updated
  BEFORE UPDATE ON day_operations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_flights_updated
  BEFORE UPDATE ON flights FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_distances_updated
  BEFORE UPDATE ON distances FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- VIEWS
-- ===========================================

-- Pilot document status view
CREATE OR REPLACE VIEW pilot_doc_status AS
SELECT
  p.id,
  p.name,
  p.role,
  p.aircraft_assigned,
  p.active,
  p.license_type,
  p.license_expiry,
  p.medical_class1_expiry,
  p.huet_expiry,
  p.bosiet_expiry,
  p.annual_check_expiry,
  CASE
    WHEN p.license_expiry < NOW() OR p.medical_class1_expiry < NOW()
      OR p.huet_expiry < NOW() OR p.bosiet_expiry < NOW()
      OR p.annual_check_expiry < NOW() THEN 'not_apt'
    WHEN p.license_expiry < NOW() + INTERVAL '30 days'
      OR p.medical_class1_expiry < NOW() + INTERVAL '30 days'
      OR p.huet_expiry < NOW() + INTERVAL '30 days'
      OR p.bosiet_expiry < NOW() + INTERVAL '30 days'
      OR p.annual_check_expiry < NOW() + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'apt'
  END AS flight_status
FROM pilots p
WHERE p.active = TRUE;

-- Daily summary view
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  d.id,
  d.date,
  u_cmd.name AS commander_name,
  u_cop.name AS copilot_name,
  a.registration AS aircraft_reg,
  a.type AS aircraft_type,
  d.motor_on_time,
  d.motor_off_time,
  d.total_block_minutes,
  d.total_nm,
  d.total_fuel_burn_lbs,
  d.total_passengers,
  d.status,
  COUNT(f.id) AS flight_count
FROM day_operations d
LEFT JOIN pilots cmd ON d.commander_id = cmd.id
LEFT JOIN users u_cmd ON cmd.user_id = u_cmd.id
LEFT JOIN pilots cop ON d.copilot_id = cop.id
LEFT JOIN users u_cop ON cop.user_id = u_cop.id
LEFT JOIN aircraft a ON d.aircraft_id = a.id
LEFT JOIN flights f ON f.day_op_id = d.id
GROUP BY d.id, u_cmd.name, u_cop.name, a.registration, a.type;

-- ===========================================
-- REFRESH TOKENS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

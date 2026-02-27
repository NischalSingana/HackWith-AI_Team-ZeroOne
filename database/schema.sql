-- ============================================================
-- FIR Analysis System — Database Schema (NeonDB)
-- ============================================================

-- Core accident records
CREATE TABLE accidents (
    id              SERIAL PRIMARY KEY,
    fir_number      VARCHAR(100) NOT NULL,
    incident_date   TIMESTAMP,
    reported_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cause           TEXT,
    severity        VARCHAR(20) CHECK (severity IN ('Fatal', 'Grievous', 'Non-Fatal', 'Unknown')),
    pdf_url         TEXT,
    status          VARCHAR(30) DEFAULT 'Processed',
    confidence_score FLOAT DEFAULT 0.0,
    raw_text        TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Location data (one per accident)
CREATE TABLE locations (
    id              SERIAL PRIMARY KEY,
    accident_id     INTEGER NOT NULL REFERENCES accidents(id) ON DELETE CASCADE,
    address         TEXT,
    area            VARCHAR(200),
    city            VARCHAR(100) DEFAULT 'Vijayawada',
    landmark        VARCHAR(200),
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8)
);

-- Victim data (multiple per accident)
CREATE TABLE victims (
    id              SERIAL PRIMARY KEY,
    accident_id     INTEGER NOT NULL REFERENCES accidents(id) ON DELETE CASCADE,
    name            VARCHAR(200),
    age             INTEGER,
    gender          VARCHAR(20),
    injury_severity VARCHAR(100),
    is_fatality     BOOLEAN DEFAULT FALSE
);

-- Vehicle data (multiple per accident)
CREATE TABLE vehicles (
    id              SERIAL PRIMARY KEY,
    accident_id     INTEGER NOT NULL REFERENCES accidents(id) ON DELETE CASCADE,
    vehicle_type    VARCHAR(50),
    vehicle_number  VARCHAR(30),
    driver_name     VARCHAR(200)
);

-- Cached AI insights
CREATE TABLE ai_insights (
    id              SERIAL PRIMARY KEY,
    input_stats     JSONB NOT NULL,
    summary         TEXT,
    key_insights    JSONB,
    policy_recs     JSONB,
    public_tips     JSONB,
    provider        VARCHAR(50),
    model           VARCHAR(100),
    latency_ms      INTEGER,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_accidents_fir        ON accidents(fir_number);
CREATE INDEX idx_accidents_date       ON accidents(incident_date);
CREATE INDEX idx_accidents_severity   ON accidents(severity);
CREATE INDEX idx_accidents_cause      ON accidents(cause);
CREATE INDEX idx_accidents_created    ON accidents(created_at DESC);
CREATE INDEX idx_locations_area       ON locations(area);
CREATE INDEX idx_locations_city       ON locations(city);
CREATE INDEX idx_locations_coords     ON locations(latitude, longitude);
CREATE INDEX idx_victims_age          ON victims(age);
CREATE INDEX idx_victims_gender       ON victims(gender);
CREATE INDEX idx_vehicles_type        ON vehicles(vehicle_type);
CREATE INDEX idx_vehicles_number      ON vehicles(vehicle_number);
CREATE INDEX idx_insights_created     ON ai_insights(created_at DESC);

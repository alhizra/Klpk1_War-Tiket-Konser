CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS events (
  event_id      SERIAL PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  artist        VARCHAR(150) NOT NULL,
  venue         VARCHAR(200) NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  sales_opens_at TIMESTAMPTZ NOT NULL,
  quota_total   INT NOT NULL CHECK (quota_total > 0),
  price_idr     BIGINT NOT NULL CHECK (price_idr >= 0),
  status        VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  order_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      INT NOT NULL REFERENCES events(event_id),
  qty           INT NOT NULL CHECK (qty > 0 AND qty <= 4),
  amount_idr    BIGINT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  client_ip     VARCHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_event ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_events_audit (
  audit_id      BIGSERIAL PRIMARY KEY,
  order_id      UUID,
  event_id      INT NOT NULL,
  action        VARCHAR(40) NOT NULL,
  detail        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_event ON order_events_audit(event_id);

-- Seed catalog: 1 event, 500 kursi (sesuai skenario P1 modul)
INSERT INTO events (event_id, title, artist, venue, starts_at, sales_opens_at, quota_total, price_idr, status)
VALUES (
  1,
  'Coldplay Music of the Spheres — Jakarta',
  'Coldplay',
  'Stadion Gelora Bung Karno',
  '2026-09-20 19:00:00+07',
  '2026-08-20 10:00:00+07',
  500,
  1500000,
  'PUBLISHED'
)
ON CONFLICT (event_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('events', 'event_id'), GREATEST((SELECT MAX(event_id) FROM events), 1));

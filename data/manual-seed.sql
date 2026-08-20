-- Alternatif data manual via SQL (jalankan di Postgres)
-- docker exec -i wtk-pg psql -U wtk -d wtk < data/manual-seed.sql

INSERT INTO events (event_id, title, artist, venue, starts_at, sales_opens_at, quota_total, price_idr, status)
VALUES
  (1, 'Coldplay Music of the Spheres — Jakarta', 'Coldplay', 'Stadion Gelora Bung Karno',
   '2026-09-20 19:00:00+07', '2026-08-20 10:00:00+07', 500, 1500000, 'PUBLISHED'),
  (2, 'Tulus Tur Manusia — Malam Bandung', 'Tulus', 'ICE BSD Hall',
   '2026-10-05 20:00:00+07', '2026-09-01 12:00:00+07', 120, 750000, 'PUBLISHED')
ON CONFLICT (event_id) DO UPDATE SET
  title = EXCLUDED.title,
  artist = EXCLUDED.artist,
  venue = EXCLUDED.venue,
  starts_at = EXCLUDED.starts_at,
  sales_opens_at = EXCLUDED.sales_opens_at,
  quota_total = EXCLUDED.quota_total,
  price_idr = EXCLUDED.price_idr,
  status = EXCLUDED.status;

-- Tabel kursi (dibuat loader JS juga; SQL ini backup)
CREATE TABLE IF NOT EXISTS seats (
  event_id     INT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  seat_code    VARCHAR(20) NOT NULL,
  category     VARCHAR(40) NOT NULL DEFAULT 'REG',
  row_label    VARCHAR(10) NOT NULL,
  seat_number  INT NOT NULL,
  price_idr    BIGINT,
  PRIMARY KEY (event_id, seat_code)
);

-- Contoh insert manual beberapa kursi event 1
INSERT INTO seats (event_id, seat_code, category, row_label, seat_number, price_idr) VALUES
  (1, 'A01', 'VIP', 'A', 1, 3500000),
  (1, 'A02', 'VIP', 'A', 2, 3500000),
  (1, 'B01', 'CAT1', 'B', 1, 2500000),
  (1, 'B02', 'CAT1', 'B', 2, 2500000)
ON CONFLICT (event_id, seat_code) DO UPDATE SET
  category = EXCLUDED.category,
  price_idr = EXCLUDED.price_idr;

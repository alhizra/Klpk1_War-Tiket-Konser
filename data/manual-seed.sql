-- Alternatif SQL (backup). Sumber utama: DATA_WAR_TIKET_KONSER.xlsx
-- Prefer: npm run data:excel  ATAU  db/init.sql (Docker first boot)
-- docker exec -i wtk-pg psql -U wtk -d wtk < data/manual-seed.sql
--
-- Events: TREASURE, LYKN, BLACKPINK, NCT DREAM, EXO, ATEEZ, BUS (7 / 2480 seats)
-- Denah lengkap ada di seats.manual.csv / db/init.sql — file ini hanya catalog ringkas.

INSERT INTO events (event_id, title, artist, venue, starts_at, sales_opens_at, quota_total, price_idr, status)
VALUES
  (1, 'TREASURE (트레저) Live', 'TREASURE (트레저)', 'KSPO DOME, Olympic Park',
   '2026-09-12 18:00:00+09', '2026-08-01 20:00:00+09', 400, 1700000, 'PUBLISHED'),
  (2, 'LYKN (ไลแคน) Live', 'LYKN (ไลแคน)', 'Impact Arena, Muang Thong Thani',
   '2026-10-18 19:00:00+07', '2026-09-05 10:00:00+07', 280, 1200000, 'PUBLISHED'),
  (3, 'BLACKPINK (블랙핑크) Live', 'BLACKPINK (블랙핑크)', 'Seoul World Cup Stadium (Sangam)',
   '2026-11-07 19:00:00+09', '2026-09-20 20:00:00+09', 500, 1900000, 'PUBLISHED'),
  (4, 'NCT DREAM (엔시티 드림) Live', 'NCT DREAM (엔시티 드림)', 'Gocheok Sky Dome',
   '2026-12-05 18:00:00+09', '2026-10-25 20:00:00+09', 350, 1600000, 'PUBLISHED'),
  (5, 'EXO (엑소) Live', 'EXO (엑소)', 'Jamsil Indoor Stadium',
   '2027-01-16 18:00:00+09', '2026-11-28 20:00:00+09', 320, 1800000, 'PUBLISHED'),
  (6, 'ATEEZ (에이티즈) Live', 'ATEEZ (에이티즈)', 'BEXCO Auditorium',
   '2027-02-21 18:00:00+09', '2026-12-20 20:00:00+09', 380, 1500000, 'PUBLISHED'),
  (7, 'BUS (บัส) Live', 'BUS (บัส)', 'Thunder Dome, Muang Thong Thani',
   '2027-03-14 19:00:00+07', '2027-01-20 10:00:00+07', 250, 1100000, 'PUBLISHED')
ON CONFLICT (event_id) DO UPDATE SET
  title = EXCLUDED.title,
  artist = EXCLUDED.artist,
  venue = EXCLUDED.venue,
  starts_at = EXCLUDED.starts_at,
  sales_opens_at = EXCLUDED.sales_opens_at,
  quota_total = EXCLUDED.quota_total,
  price_idr = EXCLUDED.price_idr,
  status = EXCLUDED.status;

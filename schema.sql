-- Vollständiges Schema für eine neue, leere Datenbank (gymtracker-db).
-- Bestehende Datenbank: nur die Dateien in migrations/ ausführen.

CREATE TABLE IF NOT EXISTS uebungen (
  name     TEXT PRIMARY KEY,
  schritt  REAL NOT NULL,
  start    REAL NOT NULL,
  aktiv    INTEGER NOT NULL DEFAULT 1,
  einheit  TEXT NOT NULL DEFAULT 'kg',        -- 'kg' | 'min'
  gruppe   TEXT NOT NULL DEFAULT 'Sonstiges'  -- Beine | Torso | Arme | Cardio | Sonstiges
);

CREATE TABLE IF NOT EXISTS log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL,   -- ISO-8601 UTC, z. B. 2026-07-25T18:30:00.000Z
  person     TEXT NOT NULL,   -- 'Kratos' | 'Atreus'
  uebung     TEXT NOT NULL,
  gewicht    REAL NOT NULL,
  wdh        REAL NOT NULL,
  client_id  TEXT             -- vom Client vergeben, verhindert doppelte Offline-Sätze
);

CREATE INDEX IF NOT EXISTS idx_log_person ON log(person);
CREATE INDEX IF NOT EXISTS idx_log_uebung ON log(uebung);
CREATE INDEX IF NOT EXISTS idx_log_ts ON log(ts);
CREATE UNIQUE INDEX IF NOT EXISTS idx_log_client_id ON log(client_id);

INSERT OR IGNORE INTO uebungen (name, schritt, start, aktiv, einheit, gruppe) VALUES
  ('Upper Back', 5, 50, 1, 'kg', 'Torso'),
  ('Low Row', 5, 60, 1, 'kg', 'Torso'),
  ('Chest Press', 5, 60, 1, 'kg', 'Torso'),
  ('Lat Machine', 5, 60, 1, 'kg', 'Torso'),
  ('Shoulder Press', 2.5, 25, 1, 'kg', 'Arme'),
  ('Leg Press', 10, 110, 1, 'kg', 'Beine'),
  ('Stairclimber', 1, 6, 1, 'min', 'Cardio'),
  ('Treadmill', 1, 10, 1, 'min', 'Cardio');

-- Duplikatschutz für Sätze, die offline gespeichert und später nachgereicht werden.
ALTER TABLE log ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_log_client_id ON log(client_id);

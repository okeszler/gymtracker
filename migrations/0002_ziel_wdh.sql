-- Ziel-Wiederholungen pro Gerät für den Steigerungs-Tipp (Standard 3 × 10).
ALTER TABLE uebungen ADD COLUMN ziel_wdh INTEGER NOT NULL DEFAULT 10;

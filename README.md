# Kratos' GymTracker

Trainings-Log für Kratos & Atreus: Sätze erfassen, Pausen-Timer, Rekorde, Fortschritt.

**Live:** https://olivers-gymtracker.pages.dev (`?person=Atreus` an die URL hängen für Vorauswahl)

Cloudflare Pages + Pages Functions + D1, wie die anderen Apps. Jeder Push auf `main` wird automatisch
deployt, andere Branches bekommen eine Vorschau-URL.

```
public/                 ← statische App (index.html, Service Worker, Manifest, Icons)
functions/api/[[route]].js  ← API (Pages Function), D1-Binding "DB"
schema.sql              ← vollständiges Schema für eine leere Datenbank
migrations/             ← Änderungen an der bestehenden Datenbank (gymtracker-db)
wrangler.toml           ← Projekt- und D1-Konfiguration
```

## Funktionen

- **Training**: Geräte nach Muskelgruppe, letzter Satz + „vor X Tagen", Häkchen/Satzzahl für heute,
  Live-Karte fürs heutige Training (Geräte, Sätze, Volumen, Dauer).
- **Satz erfassen**: große Anzeige, ± Schritte (gedrückt halten = schnell zählen), Zahl antippen zum
  direkten Eingeben, Sätze des letzten Trainings, Schutz gegen Doppel-Tipp.
- **Steigerungs-Tipp**: zweimal in Folge mind. 2 Sätze mit dem Top-Gewicht auf Ziel-Wiederholungen
  (Standard 10, pro Gerät einstellbar) → Vorschlag „+1 Schritt". Nach dem ersten sauberen Training ein Hinweis,
  was noch fehlt. Nur aus Trainings der letzten 3 Wochen.
- **Comeback-Modus**: nach 3+ Wochen Pause an einem Gerät startet es automatisch 10 % leichter, nach 6+ Wochen
  20 % (ein Tipp stellt das alte Gewicht wieder her).
- **Training abschließen**: Zusammenfassung mit Volumen, Dauer, Sätzen und Geräten im Vergleich zum letzten
  Training, Rekorden und Entwicklung pro Gerät.
- **Pausen-Timer** nach jedem Satz (±15 s, wird gemerkt), mit Vibration und Ton.
- **Rekord-Animation** bei neuem Bestgewicht.
- **Offline-fest**: Sätze werden sofort lokal gespeichert und nachgereicht (Client-ID verhindert Duplikate);
  dank Service Worker startet die App auch ohne Netz.
- **Geräte verwalten** direkt in der App: anlegen, umbenennen (Verlauf wandert mit), ausblenden.
- **Fortschritt**: Wochen-Serie, Trainings/Sätze/Volumen der letzten 7 Tage, Kalender, Muskelgruppen,
  Wochenvolumen, neue Bestleistungen; pro Gerät Max-Gewicht + geschätztes 1RM, Volumen, letzte Trainings.

## Lokal entwickeln

```bash
npx wrangler d1 execute gymtracker-db --local --file schema.sql   # einmalig
npx wrangler pages dev public
```

## Datenbank ändern

Neue Datei in `migrations/` anlegen und gegen die Produktion ausführen:

```bash
npx wrangler d1 execute gymtracker-db --remote --file migrations/000X_name.sql
```

`0001_client_id.sql` und `0002_ziel_wdh.sql` sind bereits angewendet.

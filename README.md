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
  direkten Eingeben, Sätze des letzten Trainings, Steigerungs-Tipp (alle Sätze ≥ 12 Wdh → mehr Gewicht),
  Schutz gegen Doppel-Tipp.
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

`0001_client_id.sql` ist bereits angewendet.

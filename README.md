# Kratos' GymTracker

Trainings-Log für Kratos & Atreus: Sätze erfassen, Pausen-Timer, Rekorde, Fortschritt.
Die Logik läuft in **Google Apps Script** (Daten im Google Sheet), **GitHub Pages** liefert einen
Wrapper mit kurzer URL, Icon, Splash und Homescreen-Installation.

```
index.html          ← GitHub-Pages-Wrapper (bettet die Apps-Script-App im iframe ein)
manifest.json       ← PWA-Manifest (Homescreen)
icons/              ← favicon.svg, favicon-32.png, icon-192/512.png, maskable-512.png, apple-touch-icon.png
apps-script/
  Code.gs           ← Backend (in den Apps-Script-Editor kopieren)
  Index.html        ← App-Oberfläche (im Apps-Script-Editor als HTML-Datei "Index" anlegen)
```

## Funktionen

- **Training**: Geräte nach Muskelgruppe, letzter Satz + „vor X Tagen", Häkchen/Satzzahl für heute,
  Live-Session-Karte (Geräte, Sätze, Volumen, Dauer).
- **Satz erfassen**: große Anzeige, ± Schritte (gedrückt halten = schnell zählen), Zahl antippen zum
  direkten Eingeben, Sätze des letzten Trainings, **Progressions-Tipp** (alle Sätze ≥ 12 Wdh → mehr Gewicht).
- **Pausen-Timer** startet automatisch nach jedem Satz (±15 s, die Länge wird gemerkt), mit Vibration und Ton.
- **Rekord-Feier** bei neuem Bestgewicht.
- **Offline-fest**: Sätze werden sofort lokal gespeichert und im Hintergrund gesendet; eine ID pro
  Satz verhindert doppelte Einträge. Der Badge oben zeigt offene Sätze.
- **Sätze löschen**: jeden heutigen Satz (zweimal tippen zum Bestätigen).
- **Personenwechsel** am selben Gerät (Vater/Sohn teilen sich die Maschine); die zuletzt gewählte Person wird gemerkt.
- **Fortschritt**: Wochen-Serie, Trainings/Sätze/Volumen der letzten 7 Tage, Kalender (12 Wochen, Mo–So),
  Muskelgruppen, Wochenvolumen, neue Bestleistungen; pro Gerät Max-Gewicht + geschätztes 1RM, Volumen,
  letzte Trainings.

## Setup Apps Script

1. Google Sheet → Erweiterungen → Apps Script. `apps-script/Code.gs` als `Code.gs` einfügen,
   `apps-script/Index.html` als HTML-Datei **`Index`** anlegen.
2. Einmalig `setup()` ausführen (legt die Tabs `Log` und `Uebungen` an).
   Bestehendes Sheet aus älteren Versionen: je nach Stand `upgradeV2()` / `upgradeV3()` einmal ausführen.
   Die neue Spalte `ID` im Log wird automatisch ergänzt.
3. Bereitstellen → Bereitstellungen verwalten → **neue Version** der bestehenden Web-App-Bereitstellung
   (so bleibt die `.exec`-URL gleich).

## Setup GitHub Pages

1. In `index.html` `EXEC_URL` auf die `.exec`-URL setzen.
2. Repo-Einstellungen → **Pages** → Branch `main`, Ordner `/ (root)`.
3. Für Personen-Vorauswahl `?person=Kratos` bzw. `?person=Atreus` an die Pages-URL hängen und als
   Homescreen-Icon speichern. Ohne Parameter wird die zuletzt gewählte Person genommen.

## Hinweise

- `doGet` setzt `XFrameOptionsMode.ALLOWALL` — sonst blockiert Google die Einbettung im Wrapper.
- Geräte verwaltet ihr direkt im Sheet `Uebungen` (Name, Schritt, Startgewicht, Aktiv, Einheit `kg`/`min`, Muskelgruppe).
- Gewicht 0 ist bei kg-Geräten erlaubt (Körpergewicht).

# Kratos' GymTracker — GitHub-Pages-Wrapper

Diese Dateien sind der **Wrapper** um die eigentliche Apps-Script-Web-App (analog zur Watchlist-App):
GitHub Pages hostet eine stabile URL mit eigenem Icon, Splash-Animation und Homescreen-Installation;
die eigentliche Logik läuft weiterhin in Google Apps Script.

## Setup

1. Neues GitHub-Repo anlegen (z. B. `kratos-gymtracker`), diese Dateien reinlegen:
   ```
   index.html
   manifest.json
   icons/
     favicon.svg
     favicon-32.png
     icon-192.png
     icon-512.png
     maskable-512.png
     apple-touch-icon.png
   ```
2. In `index.html` die Konstante `EXEC_URL` auf eure aktuelle Apps-Script-Bereitstellungs-URL setzen
   (die `.../exec`-URL aus Bereitstellen → Web-App).
3. Repo-Einstellungen → **Pages** → Branch `main`, Ordner `/ (root)` → Speichern.
4. Nach ein bis zwei Minuten ist die Seite unter `https://DEIN-USERNAME.github.io/kratos-gymtracker/` erreichbar.
5. Für Personen-Vorauswahl: `?person=Kratos` bzw. `?person=Atreus` an die GitHub-Pages-URL anhängen
   (wird automatisch an die Apps-Script-URL durchgereicht) — als Homescreen-Icon speichern.

## Bei künftigen Code-Änderungen

- Änderungen an `Code.gs` / `Index.html` (Apps Script) → neue Bereitstellungsversion in Apps Script erzeugen.
  Die `.exec`-URL bleibt dabei **gleich**, solange ihr keine komplett neue Bereitstellung anlegt — dann
  müsste `EXEC_URL` im Wrapper aktualisiert werden.
- Änderungen am Wrapper selbst (Icon, Splash, Manifest) → einfach ins GitHub-Repo pushen, Pages baut automatisch neu.

## Warum der Umweg über GitHub Pages?

Apps-Script-`.exec`-URLs zeigen beim ersten Öffnen manchmal eine Google-Warnmeldung
("diese App wurde nicht verifiziert") und die URL ist unhandlich lang. Der Wrapper:
- bettet die App in ein iframe ein und umgeht damit die Warnmeldung im Alltag,
- gibt euch eine kurze, merkbare, dauerhafte URL,
- ermöglicht ein eigenes Icon + "Zum Homescreen hinzufügen" wie eine echte App,
- zeigt eine kurze Lade-Animation statt eines leeren weißen Bildschirms,
- fängt Verbindungsfehler ab und bietet einen Direktlink als Fallback.

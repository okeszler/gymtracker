/**
 * GYM TRACKER — Google Apps Script Web App
 *
 * Setup:
 * 1. Neues Google Sheet anlegen → Erweiterungen → Apps Script
 * 2. Diesen Code in Code.gs einfügen, Index.html als HTML-Datei anlegen
 * 3. Einmalig die Funktion setup() ausführen (erzeugt Tabs + Startdaten)
 * 4. Bereitstellen → Neue Bereitstellung → Web-App
 *    - Ausführen als: Ich
 *    - Zugriff: Nur ich
 * 5. URL am Handy als Lesezeichen / Homescreen-Icon speichern
 */

const SHEET_LOG = 'Log';
const SHEET_UEBUNGEN = 'Uebungen';
const TZ = Session.getScriptTimeZone();

// Namen hier anpassen, falls gewünscht — wird überall in der App verwendet.
const PERSONEN = ['Kratos', 'Atreus'];

// Reihenfolge + Farben der Muskelgruppen (für Übersicht/Charts).
const GRUPPEN = ['Beine', 'Torso', 'Arme', 'Cardio'];
const GRUPPEN_FARBEN = { Beine: '#ffc53d', Torso: '#4fd1c5', Arme: '#f472b6', Cardio: '#8a949c', Sonstiges: '#5b6570' };

/** Einmalig manuell ausführen: erzeugt Tabs und Standard-Übungen. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let log = ss.getSheetByName(SHEET_LOG);
  if (!log) {
    log = ss.insertSheet(SHEET_LOG);
    log.appendRow(['Timestamp', 'Person', 'Uebung', 'Gewicht', 'Wdh']);
    log.setFrozenRows(1);
  }

  let ueb = ss.getSheetByName(SHEET_UEBUNGEN);
  if (!ueb) {
    ueb = ss.insertSheet(SHEET_UEBUNGEN);
    ueb.appendRow(['Name', 'Schritt', 'Startgewicht', 'Aktiv', 'Einheit', 'Muskelgruppe']);
    ueb.setFrozenRows(1);
    const start = [
      ['Upper Back', 5, 50, true, 'kg', 'Torso'],
      ['Low Row', 5, 60, true, 'kg', 'Torso'],
      ['Chest Press', 5, 60, true, 'kg', 'Torso'],
      ['Lat Machine', 5, 60, true, 'kg', 'Torso'],
      ['Shoulder Press', 2.5, 25, true, 'kg', 'Arme'],
      ['Leg Press', 10, 110, true, 'kg', 'Beine'],
      ['Lower Back', 5, 50, true, 'kg', 'Torso'],
      ['Total Abdominal', 5, 75, true, 'kg', 'Torso'],
      ['Delts', 2.5, 35, true, 'kg', 'Arme'],
      ['Stairclimber', 1, 6, true, 'min', 'Cardio'],
      ['Treadmill', 1, 10, true, 'min', 'Cardio'],
    ];
    ueb.getRange(2, 1, start.length, 6).setValues(start);
  }
}

/**
 * Einmalig ausführen, wenn das Sheet schon aus v1 existiert:
 * ergänzt die Spalten "Einheit" und "Muskelgruppe" sowie die beiden Cardio-Geräte.
 */
function upgradeV2() {
  const ueb = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_UEBUNGEN);
  if (String(ueb.getRange(1, 5).getValue()) !== 'Einheit') {
    ueb.getRange(1, 5).setValue('Einheit');
    const n = ueb.getLastRow() - 1;
    if (n > 0) ueb.getRange(2, 5, n, 1).setValue('kg');
  }
  if (String(ueb.getRange(1, 6).getValue()) !== 'Muskelgruppe') {
    ueb.getRange(1, 6).setValue('Muskelgruppe');
    // Beste Schätzung für bestehende Standardgeräte, alles andere → "Sonstiges".
    const rateGruppe = {
      'Upper Back': 'Torso', 'Low Row': 'Torso', 'Chest Press': 'Torso', 'Lat Machine': 'Torso',
      'Lower Back': 'Torso', 'Total Abdominal': 'Torso', 'Shoulder Press': 'Arme', 'Delts': 'Arme',
      'Leg Press': 'Beine', 'Stairclimber': 'Cardio', 'Treadmill': 'Cardio',
    };
    const n = ueb.getLastRow() - 1;
    if (n > 0) {
      const namen = ueb.getRange(2, 1, n, 1).getValues().flat().map(String);
      ueb.getRange(2, 6, n, 1).setValues(namen.map(name => [rateGruppe[name] || 'Sonstiges']));
    }
  }
  const namen = ueb.getRange(2, 1, ueb.getLastRow() - 1, 1).getValues().flat().map(String);
  if (namen.indexOf('Stairclimber') < 0) ueb.appendRow(['Stairclimber', 1, 6, true, 'min', 'Cardio']);
  if (namen.indexOf('Treadmill') < 0) ueb.appendRow(['Treadmill', 1, 10, true, 'min', 'Cardio']);
}

/**
 * Einmalig ausführen, wenn das Log-Sheet noch aus v1/v2 existiert (ohne Person-Spalte):
 * fügt Spalte "Person" nach dem Timestamp ein und ordnet bestehende Einträge
 * PERSONEN[0] zu (das warst bisher du).
 */
function upgradeV3() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  if (header.indexOf('Person') >= 0) return; // schon migriert

  const last = sh.getLastRow();
  const n = last - 1;
  const alteDaten = n > 0 ? sh.getRange(2, 1, n, header.length).getValues() : [];

  sh.clear();
  sh.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Person', 'Uebung', 'Gewicht', 'Wdh']]);
  sh.setFrozenRows(1);
  if (n > 0) {
    const neu = alteDaten.map(r => [r[0], PERSONEN[0], r[1], r[2], r[3]]);
    sh.getRange(2, 1, neu.length, 5).setValues(neu);
  }
}

function doGet(e) {
  const t = HtmlService.createTemplateFromFile('Index');
  const gewuenscht = e && e.parameter && e.parameter.person;
  t.personen = PERSONEN;
  t.startPerson = PERSONEN.indexOf(gewuenscht) >= 0 ? gewuenscht : PERSONEN[0];
  return t.evaluate()
    .setTitle('Kratos\' GymTracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

/** Holt ein Sheet und wirft eine klare Fehlermeldung, falls es fehlt. */
function _sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" fehlt. Bitte setup() im Editor ausführen.');
  return sh;
}

/** Alle Log-Zeilen als Objekte (Timestamp als Date). */
function _readLog_() {
  const sh = _sheet_(SHEET_LOG);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 5).getValues().map(r => ({
    ts: r[0], person: String(r[1]), uebung: String(r[2]), gewicht: Number(r[3]), wdh: Number(r[4]),
  }));
}

function _tag_(date) {
  return Utilities.formatDate(new Date(date), TZ, 'yyyy-MM-dd');
}

/**
 * Initialdaten für die App: Übungsliste mit letztem Eintrag pro Übung
 * und alle heutigen Sätze — jeweils für eine Person.
 */
function getInitData(person) {
  if (PERSONEN.indexOf(person) < 0) throw new Error('Unbekannte Person: ' + person);
  const uebSheet = _sheet_(SHEET_UEBUNGEN);
  const lastU = uebSheet.getLastRow();
  const uebungen = lastU < 2 ? [] :
    uebSheet.getRange(2, 1, lastU - 1, 6).getValues()
      .filter(r => r[3] === true || r[3] === 'TRUE')
      .map(r => ({
        name: String(r[0]),
        schritt: Number(r[1]) || 2.5,
        start: Number(r[2]) || 20,
        einheit: String(r[4]).toLowerCase().trim() === 'min' ? 'min' : 'kg',
        gruppe: GRUPPEN.indexOf(String(r[5]).trim()) >= 0 ? String(r[5]).trim() : 'Sonstiges',
      }));

  const log = _readLog_().filter(e => e.person === person);
  const heuteTag = _tag_(new Date());

  // Letzter Satz je Übung (Log ist chronologisch — letzter Treffer gewinnt)
  const letzte = {};
  log.forEach(e => { letzte[e.uebung] = { gewicht: e.gewicht, wdh: e.wdh, tag: _tag_(e.ts) }; });

  const heute = log
    .filter(e => _tag_(e.ts) === heuteTag)
    .map(e => ({
      zeit: Utilities.formatDate(new Date(e.ts), TZ, 'HH:mm'),
      uebung: e.uebung, gewicht: e.gewicht, wdh: e.wdh,
    }));

  return {
    personen: PERSONEN,
    person: person,
    uebungen: uebungen.map(u => ({ ...u, letztes: letzte[u.name] || null })),
    heute: heute,
  };
}

/** Einen Satz speichern. */
function logSet(person, uebung, gewicht, wdh) {
  if (PERSONEN.indexOf(person) < 0) throw new Error('Unbekannte Person: ' + person);
  if (!uebung || !(gewicht > 0) || !(wdh > 0)) throw new Error('Ungültige Eingabe.');
  _sheet_(SHEET_LOG).appendRow([new Date(), person, uebung, gewicht, wdh]);
  return getInitData(person);
}

/** Letzten Satz von heute (dieser Person) löschen (Tippfehler-Korrektur). */
function undoLastSet(person) {
  const sh = _sheet_(SHEET_LOG);
  const last = sh.getLastRow();
  if (last >= 2) {
    const row = sh.getRange(last, 1, 1, 2).getValues()[0];
    if (String(row[1]) === person && _tag_(row[0]) === _tag_(new Date())) sh.deleteRow(last);
  }
  return getInitData(person);
}

/**
 * Verlauf einer Übung für eine Person, aggregiert pro Trainingstag:
 * Max-Gewicht, Volumen (Summe Gewicht×Wdh), Satzanzahl.
 */
function getVerlauf(person, uebung) {
  const log = _readLog_().filter(e => e.person === person && e.uebung === uebung);
  const proTag = {};
  log.forEach(e => {
    const t = _tag_(e.ts);
    if (!proTag[t]) proTag[t] = { tag: t, max: 0, volumen: 0, saetze: 0 };
    proTag[t].max = Math.max(proTag[t].max, e.gewicht);
    proTag[t].volumen += e.gewicht * e.wdh;
    proTag[t].saetze += 1;
  });
  return Object.values(proTag).sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Map: Übungsname → { einheit, gruppe }. */
function _uebungsInfo_() {
  const sh = _sheet_(SHEET_UEBUNGEN);
  const last = sh.getLastRow();
  const map = {};
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, 6).getValues().forEach(r => {
      const gruppe = String(r[5] || '').trim();
      map[String(r[0])] = {
        einheit: String(r[4]).toLowerCase().trim() === 'min' ? 'min' : 'kg',
        gruppe: GRUPPEN.indexOf(gruppe) >= 0 ? gruppe : 'Sonstiges',
      };
    });
  }
  return map;
}

/**
 * Überblick: Trainingstage der letzten 12 Wochen + Gesamtvolumen pro Woche,
 * für eine Person. Cardio-Einheiten (min) zählen für die Trainingstage,
 * nicht für das kg-Volumen.
 */
function getWochenUebersicht(person) {
  const info = _uebungsInfo_();
  const log = _readLog_().filter(e => e.person === person);
  const proWoche = {};
  log.forEach(e => {
    const w = Utilities.formatDate(new Date(e.ts), TZ, 'YYYY-ww');
    if (!proWoche[w]) proWoche[w] = { woche: w, volumen: 0, tage: new Set() };
    if ((info[e.uebung] || {}).einheit !== 'min') proWoche[w].volumen += e.gewicht * e.wdh;
    proWoche[w].tage.add(_tag_(e.ts));
  });
  return Object.values(proWoche)
    .map(w => ({ woche: w.woche, volumen: w.volumen, tage: w.tage.size }))
    .sort((a, b) => a.woche.localeCompare(b.woche))
    .slice(-12);
}

/**
 * Gesamtübersicht für eine Person: Kennzahlen, Trainings-Kalender (12 Wochen),
 * Muskelgruppen-Verteilung, Wochenvolumen nach Gruppe gestapelt, und aktuelle
 * persönliche Bestleistungen (letzte 30 Tage).
 */
function getUebersicht(person) {
  const info = _uebungsInfo_();
  const log = _readLog_().filter(e => e.person === person);
  const heute = new Date();
  const heuteTag = _tag_(heute);

  // ---- Kalender: letzte 12 Wochen (84 Tage), Sätze pro Tag ----
  const tageMitSaetzen = {};
  log.forEach(e => {
    const t = _tag_(e.ts);
    tageMitSaetzen[t] = (tageMitSaetzen[t] || 0) + 1;
  });
  const kalender = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(heute);
    d.setDate(d.getDate() - i);
    const t = _tag_(d);
    kalender.push({ tag: t, saetze: tageMitSaetzen[t] || 0 });
  }

  // ---- Streak: aktuelle Serie an aufeinanderfolgenden Trainingstagen ----
  const trainiertSet = new Set(Object.keys(tageMitSaetzen));
  let streak = 0;
  let cursor = new Date(heute);
  if (!trainiertSet.has(heuteTag)) cursor.setDate(cursor.getDate() - 1); // heute noch nicht trainiert? ok, gestern zählen
  while (trainiertSet.has(_tag_(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // ---- Kennzahlen letzte 7 / 30 Tage ----
  const vor7 = new Date(heute); vor7.setDate(vor7.getDate() - 6);
  const vor30 = new Date(heute); vor30.setDate(vor30.getDate() - 29);
  const tag7 = _tag_(vor7), tag30 = _tag_(vor30);
  const log7 = log.filter(e => _tag_(e.ts) >= tag7);
  const log30 = log.filter(e => _tag_(e.ts) >= tag30);
  const tageWoche = new Set(log7.map(e => _tag_(e.ts))).size;

  // ---- Muskelgruppen-Verteilung (Volumen, letzte 30 Tage, nur kg-Übungen) ----
  const volumenProGruppe = {};
  let cardioMinuten30 = 0;
  log30.forEach(e => {
    const inf = info[e.uebung] || { einheit: 'kg', gruppe: 'Sonstiges' };
    if (inf.einheit === 'min') { cardioMinuten30 += e.gewicht; return; }
    volumenProGruppe[inf.gruppe] = (volumenProGruppe[inf.gruppe] || 0) + e.gewicht * e.wdh;
  });
  const gruppenVerteilung = Object.keys(volumenProGruppe)
    .map(g => ({ gruppe: g, volumen: Math.round(volumenProGruppe[g]), farbe: GRUPPEN_FARBEN[g] || GRUPPEN_FARBEN.Sonstiges }))
    .sort((a, b) => b.volumen - a.volumen);
  const topGruppe = gruppenVerteilung.length ? gruppenVerteilung[0].gruppe : null;

  // ---- Wochenvolumen gestapelt nach Gruppe (letzte 12 Wochen, kg-Übungen) ----
  const alleGruppen = ['Beine', 'Torso', 'Arme', 'Sonstiges'];
  const proWocheGruppe = {};
  log.forEach(e => {
    const inf = info[e.uebung] || { einheit: 'kg', gruppe: 'Sonstiges' };
    if (inf.einheit === 'min') return;
    const w = Utilities.formatDate(new Date(e.ts), TZ, 'YYYY-ww');
    if (!proWocheGruppe[w]) proWocheGruppe[w] = { woche: w, Beine: 0, Torso: 0, Arme: 0, Sonstiges: 0 };
    const g = alleGruppen.indexOf(inf.gruppe) >= 0 ? inf.gruppe : 'Sonstiges';
    proWocheGruppe[w][g] += e.gewicht * e.wdh;
  });
  const wochenGruppen = Object.values(proWocheGruppe)
    .sort((a, b) => a.woche.localeCompare(b.woche))
    .slice(-12)
    .map(w => ({ ...w, woche: w.woche.slice(5) }));

  // ---- Persönliche Bestleistungen der letzten 30 Tage ----
  // Für jede Übung: bisheriger Bestwert VOR dem jeweiligen Satz vs. neuer Satz.
  const proUebungChron = {};
  log.slice().sort((a, b) => a.ts - b.ts).forEach(e => {
    if (!proUebungChron[e.uebung]) proUebungChron[e.uebung] = { bestVorher: 0 };
    const state = proUebungChron[e.uebung];
    if (e.gewicht > state.bestVorher) {
      if (_tag_(e.ts) >= tag30 && state.bestVorher > 0) {
        state.neuePR = { uebung: e.uebung, gewicht: e.gewicht, vorher: state.bestVorher, tag: _tag_(e.ts) };
      }
      state.bestVorher = e.gewicht;
    }
  });
  const bestleistungen = Object.values(proUebungChron)
    .filter(s => s.neuePR)
    .map(s => s.neuePR)
    .sort((a, b) => b.tag.localeCompare(a.tag));

  return {
    kennzahlen: {
      saetzeWoche: log7.length,
      tageWoche: tageWoche,
      streak: streak,
      topGruppe: topGruppe,
      cardioMinuten30: Math.round(cardioMinuten30),
    },
    kalender: kalender,
    gruppenVerteilung: gruppenVerteilung,
    wochenGruppen: wochenGruppen,
    bestleistungen: bestleistungen,
    gruppenFarben: GRUPPEN_FARBEN,
  };
}

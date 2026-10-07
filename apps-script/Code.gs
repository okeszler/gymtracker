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
const LOG_HEADER = ['Timestamp', 'Person', 'Uebung', 'Gewicht', 'Wdh', 'ID'];

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
    log.appendRow(LOG_HEADER);
    log.setFrozenRows(1);
  }
  _sicherIdSpalte_(log);

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
  const ueb = _sheet_(SHEET_UEBUNGEN);
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
  const n = ueb.getLastRow() - 1;
  const namen = n > 0 ? ueb.getRange(2, 1, n, 1).getValues().flat().map(String) : [];
  if (namen.indexOf('Stairclimber') < 0) ueb.appendRow(['Stairclimber', 1, 6, true, 'min', 'Cardio']);
  if (namen.indexOf('Treadmill') < 0) ueb.appendRow(['Treadmill', 1, 10, true, 'min', 'Cardio']);
}

/**
 * Einmalig ausführen, wenn das Log-Sheet noch aus v1/v2 existiert (ohne Person-Spalte):
 * fügt Spalte "Person" nach dem Timestamp ein und ordnet bestehende Einträge
 * PERSONEN[0] zu (das warst bisher du).
 */
function upgradeV3() {
  const sh = _sheet_(SHEET_LOG);
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  if (header.indexOf('Person') >= 0) return; // schon migriert

  const last = sh.getLastRow();
  const n = last - 1;
  const alteDaten = n > 0 ? sh.getRange(2, 1, n, header.length).getValues() : [];

  sh.clear();
  sh.getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER]);
  sh.setFrozenRows(1);
  if (n > 0) {
    const neu = alteDaten.map(r => [r[0], PERSONEN[0], r[1], r[2], r[3], '']);
    sh.getRange(2, 1, neu.length, LOG_HEADER.length).setValues(neu);
  }
}

function doGet(e) {
  const t = HtmlService.createTemplateFromFile('Index');
  const gewuenscht = e && e.parameter && e.parameter.person;
  const ausUrl = PERSONEN.indexOf(gewuenscht) >= 0;
  t.personen = PERSONEN;
  t.startPerson = ausUrl ? gewuenscht : PERSONEN[0];
  t.personAusUrl = ausUrl;
  t.gruppenFarben = GRUPPEN_FARBEN;
  t.gruppenReihe = GRUPPEN.concat('Sonstiges');
  return t.evaluate()
    .setTitle('Kratos\' GymTracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
    // Nötig, damit der GitHub-Pages-Wrapper die App im iframe einbetten darf.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ───────────────────────── Hilfsfunktionen ─────────────────────────

/** Holt ein Sheet und wirft eine klare Fehlermeldung, falls es fehlt. */
function _sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" fehlt. Bitte setup() im Editor ausführen.');
  return sh;
}

function _pruefePerson_(person) {
  if (PERSONEN.indexOf(person) < 0) throw new Error('Ungültig: unbekannte Person "' + person + '".');
}

/** Ergänzt die ID-Spalte (Duplikatschutz für Offline-Sätze), falls sie fehlt. */
function _sicherIdSpalte_(sh) {
  if (String(sh.getRange(1, 6).getValue()) !== 'ID') sh.getRange(1, 6).setValue('ID');
}

function _parseZeile_(r, row) {
  const ts = r[0] instanceof Date ? r[0] : new Date(r[0]);
  return {
    row: row, ts: ts, person: String(r[1]), uebung: String(r[2]),
    gewicht: Number(r[3]) || 0, wdh: Number(r[4]) || 0, id: String(r[5] || ''),
  };
}

/** Alle gültigen Log-Zeilen als Objekte, chronologisch sortiert, mit Tag (yyyy-MM-dd). */
function _readLog_() {
  const sh = _sheet_(SHEET_LOG);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const cols = Math.min(6, sh.getMaxColumns());
  return sh.getRange(2, 1, last - 1, cols).getValues()
    .map((r, i) => _parseZeile_(r, i + 2))
    .filter(e => !isNaN(e.ts.getTime()) && e.uebung)
    .map(e => { e.tag = _tag_(e.ts); return e; })
    .sort((a, b) => a.ts - b.ts);
}

/** Alle Übungen aus dem Sheet (auch inaktive). */
function _leseUebungen_() {
  const sh = _sheet_(SHEET_UEBUNGEN);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 6).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => {
      const gruppe = String(r[5] || '').trim();
      return {
        name: String(r[0]),
        schritt: Number(r[1]) > 0 ? Number(r[1]) : 2.5,
        start: r[2] !== '' && Number(r[2]) >= 0 ? Number(r[2]) : 20,
        aktiv: r[3] === true || String(r[3]).toUpperCase() === 'TRUE',
        einheit: String(r[4]).toLowerCase().trim() === 'min' ? 'min' : 'kg',
        gruppe: GRUPPEN.indexOf(gruppe) >= 0 ? gruppe : 'Sonstiges',
      };
    });
}

/** Map: Übungsname → { einheit, gruppe }. */
function _uebungsInfo_() {
  const map = {};
  _leseUebungen_().forEach(u => { map[u.name] = { einheit: u.einheit, gruppe: u.gruppe }; });
  return map;
}

function _tag_(date) {
  return Utilities.formatDate(new Date(date), TZ, 'yyyy-MM-dd');
}

// Kalender-Arithmetik auf Tag-Strings (zeitzonenneutral über UTC).
function _tagMs_(tag) {
  const p = tag.split('-');
  return Date.UTC(+p[0], +p[1] - 1, +p[2]);
}
function _plusTage_(tag, n) {
  return new Date(_tagMs_(tag) + n * 864e5).toISOString().slice(0, 10);
}
/** Montag der Woche, in der der Tag liegt. */
function _wochenStart_(tag) {
  const wt = (new Date(_tagMs_(tag)).getUTCDay() + 6) % 7; // 0 = Montag
  return _plusTage_(tag, -wt);
}
/** ISO-Kalenderwoche zu einem Montag. */
function _isoWoche_(montag) {
  const donnerstag = _tagMs_(_plusTage_(montag, 3));
  const jahr = new Date(donnerstag).getUTCFullYear();
  return Math.floor((donnerstag - Date.UTC(jahr, 0, 1)) / 864e5 / 7) + 1;
}

/** Geschätztes 1RM nach Epley. */
function _e1rm_(gewicht, wdh) {
  if (!(gewicht > 0) || !(wdh > 0)) return 0;
  const wert = wdh === 1 ? gewicht : gewicht * (1 + wdh / 30);
  return Math.round(wert * 2) / 2;
}

function _mitLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ───────────────────────── API für die App ─────────────────────────

/**
 * Initialdaten für die App: Übungsliste mit letztem Satz, Bestwert (vor heute) und den
 * Sätzen des letzten Trainingstags (vor heute) pro Übung, plus alle heutigen
 * Sätze — jeweils für eine Person.
 */
function getInitData(person) {
  _pruefePerson_(person);
  const uebungen = _leseUebungen_().filter(u => u.aktiv);
  const log = _readLog_().filter(e => e.person === person);
  const heuteTag = _tag_(new Date());

  const stat = {};
  log.forEach(e => {
    let s = stat[e.uebung];
    if (!s) s = stat[e.uebung] = { letztes: null, best: 0, vorherTag: null, vorher: [] };
    s.letztes = { gewicht: e.gewicht, wdh: e.wdh, tag: e.tag };
    if (e.tag < heuteTag) {
      if (e.gewicht > s.best) s.best = e.gewicht;
      if (s.vorherTag !== e.tag) { s.vorherTag = e.tag; s.vorher = []; }
      s.vorher.push({ gewicht: e.gewicht, wdh: e.wdh });
    }
  });

  const heute = log
    .filter(e => e.tag === heuteTag)
    .map(e => ({
      row: e.row, id: e.id, ms: e.ts.getTime(),
      zeit: Utilities.formatDate(e.ts, TZ, 'HH:mm'),
      uebung: e.uebung, gewicht: e.gewicht, wdh: e.wdh,
    }));

  return {
    person: person,
    heuteTag: heuteTag,
    uebungen: uebungen.map(u => {
      const s = stat[u.name];
      return {
        name: u.name, schritt: u.schritt, start: u.start, einheit: u.einheit, gruppe: u.gruppe,
        letztes: s ? s.letztes : null,
        best: s ? s.best : 0, // Bestwert vor heute (Basis für die Rekord-Erkennung)
        vorher: s && s.vorherTag ? { tag: s.vorherTag, saetze: s.vorher } : null,
      };
    }),
    heute: heute,
  };
}

/**
 * Einen Satz speichern.
 * opts.id: Client-ID gegen Doppelbuchung (z. B. wenn ein Offline-Satz nachgereicht wird)
 * opts.ts: Zeitpunkt (ms) des Satzes laut Client — max. 7 Tage alt, sonst "jetzt".
 */
function logSet(person, uebung, gewicht, wdh, opts) {
  _pruefePerson_(person);
  opts = opts || {};
  const info = _uebungsInfo_()[uebung];
  if (!info) throw new Error('Ungültig: Gerät "' + uebung + '" gibt es nicht (mehr).');
  gewicht = Math.round(Number(gewicht) * 100) / 100;
  wdh = Math.round(Number(wdh));
  const minGewicht = info.einheit === 'min' ? 0.01 : 0;
  if (!isFinite(gewicht) || gewicht < minGewicht || gewicht > 2000 || !(wdh >= 1) || wdh > 1000) {
    throw new Error('Ungültig: Eingabe außerhalb des erlaubten Bereichs.');
  }

  _mitLock_(() => {
    const sh = _sheet_(SHEET_LOG);
    _sicherIdSpalte_(sh);
    const id = String(opts.id || '');
    if (id && _idExistiert_(sh, id)) return; // schon gespeichert

    const jetzt = Date.now();
    let ts = new Date(jetzt);
    const clientTs = Number(opts.ts);
    if (clientTs && clientTs <= jetzt + 5 * 60e3 && clientTs >= jetzt - 7 * 864e5) ts = new Date(Math.min(clientTs, jetzt));
    sh.appendRow([ts, person, uebung, gewicht, wdh, id]);
  });
  return getInitData(person);
}

function _idExistiert_(sh, id) {
  const last = sh.getLastRow();
  const n = Math.min(500, last - 1);
  if (n < 1) return false;
  return sh.getRange(last - n + 1, 6, n, 1).getValues().some(v => String(v[0]) === id);
}

/**
 * Einen heutigen Satz löschen. satz = { row, id, ms, uebung, gewicht, wdh }.
 * Die Zeilennummer ist nur ein Hinweis — sie wird gegen die Daten geprüft,
 * weil sich Zeilen durch andere Löschungen verschoben haben können.
 */
function deleteSet(person, satz) {
  _pruefePerson_(person);
  satz = satz || {};
  _mitLock_(() => {
    const sh = _sheet_(SHEET_LOG);
    const heuteTag = _tag_(new Date());
    const passt = e => {
      if (e.person !== person || _tag_(e.ts) !== heuteTag) return false;
      if (satz.id) return e.id === String(satz.id);
      return e.uebung === satz.uebung && e.gewicht === Number(satz.gewicht) && e.wdh === Number(satz.wdh) &&
        (!satz.ms || Math.abs(e.ts.getTime() - Number(satz.ms)) < 2000);
    };

    let zeile = null;
    const row = Number(satz.row);
    if (row >= 2 && row <= sh.getLastRow()) {
      const e = _parseZeile_(sh.getRange(row, 1, 1, 6).getValues()[0], row);
      if (!isNaN(e.ts.getTime()) && passt(e)) zeile = row;
    }
    if (!zeile) {
      const treffer = _readLog_().filter(passt);
      if (treffer.length) zeile = treffer[treffer.length - 1].row;
    }
    if (zeile) sh.deleteRow(zeile);
  });
  return getInitData(person);
}

/** Letzten heutigen Satz dieser Person löschen (auch wenn danach jemand anderes geloggt hat). */
function undoLastSet(person) {
  _pruefePerson_(person);
  _mitLock_(() => {
    const sh = _sheet_(SHEET_LOG);
    const last = sh.getLastRow();
    if (last < 2) return;
    const heuteTag = _tag_(new Date());
    const n = Math.min(300, last - 1);
    const rows = sh.getRange(last - n + 1, 1, n, 2).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][1]) === person && rows[i][0] && _tag_(rows[i][0]) === heuteTag) {
        sh.deleteRow(last - n + 1 + i);
        return;
      }
    }
  });
  return getInitData(person);
}

/**
 * Verlauf einer Übung für eine Person, aggregiert pro Trainingstag:
 * Max-Gewicht, geschätztes 1RM, Volumen (Summe Gewicht×Wdh), Sätze.
 */
function getVerlauf(person, uebung) {
  _pruefePerson_(person);
  const proTag = {};
  const tage = [];
  _readLog_().filter(e => e.person === person && e.uebung === uebung).forEach(e => {
    let t = proTag[e.tag];
    if (!t) { t = proTag[e.tag] = { tag: e.tag, max: 0, e1rm: 0, volumen: 0, saetze: [] }; tage.push(t); }
    t.max = Math.max(t.max, e.gewicht);
    t.e1rm = Math.max(t.e1rm, _e1rm_(e.gewicht, e.wdh));
    t.volumen += e.gewicht * e.wdh;
    t.saetze.push({ gewicht: e.gewicht, wdh: e.wdh });
  });
  tage.forEach(t => { t.volumen = Math.round(t.volumen * 10) / 10; });
  return tage;
}

/**
 * Gesamtübersicht für eine Person: Kennzahlen, Trainings-Kalender (12 volle
 * Wochen, Mo–So), Muskelgruppen-Verteilung, Wochenvolumen nach Gruppe gestapelt
 * und persönliche Bestleistungen (letzte 30 Tage).
 */
function getUebersicht(person) {
  _pruefePerson_(person);
  const info = _uebungsInfo_();
  const log = _readLog_().filter(e => e.person === person);
  const heuteTag = _tag_(new Date());
  const einheitVon = e => (info[e.uebung] || {}).einheit || 'kg';
  const gruppeVon = e => (info[e.uebung] || {}).gruppe || 'Sonstiges';

  const saetzeProTag = {};
  log.forEach(e => { saetzeProTag[e.tag] = (saetzeProTag[e.tag] || 0) + 1; });

  // ---- Kalender: 12 Wochen, Spalten = Wochen, Zeilen = Mo…So ----
  const aktWoche = _wochenStart_(heuteTag);
  const kalStart = _plusTage_(aktWoche, -77);
  const kalender = [];
  for (let i = 0; i < 84; i++) {
    const t = _plusTage_(kalStart, i);
    kalender.push({ tag: t, saetze: saetzeProTag[t] || 0, zukunft: t > heuteTag });
  }

  // ---- Wochen-Serie: aufeinanderfolgende Wochen mit mind. einem Training ----
  // Die laufende Woche bricht die Serie nicht, solange sie noch nicht vorbei ist.
  const trainingsWochen = new Set(Object.keys(saetzeProTag).map(_wochenStart_));
  let serie = 0;
  let w = trainingsWochen.has(aktWoche) ? aktWoche : _plusTage_(aktWoche, -7);
  while (trainingsWochen.has(w)) { serie++; w = _plusTage_(w, -7); }

  // ---- Kennzahlen letzte 7 / 30 Tage ----
  const tag7 = _plusTage_(heuteTag, -6);
  const tag30 = _plusTage_(heuteTag, -29);
  const log7 = log.filter(e => e.tag >= tag7);
  const log30 = log.filter(e => e.tag >= tag30);
  const volumen7 = log7.filter(e => einheitVon(e) === 'kg').reduce((s, e) => s + e.gewicht * e.wdh, 0);

  // ---- Muskelgruppen-Verteilung (Volumen, letzte 30 Tage, nur kg-Übungen) ----
  const volumenProGruppe = {};
  let cardioMinuten30 = 0;
  log30.forEach(e => {
    if (einheitVon(e) === 'min') { cardioMinuten30 += e.gewicht * e.wdh; return; }
    const g = gruppeVon(e);
    volumenProGruppe[g] = (volumenProGruppe[g] || 0) + e.gewicht * e.wdh;
  });
  const gruppenVerteilung = Object.keys(volumenProGruppe)
    .filter(g => volumenProGruppe[g] > 0)
    .map(g => ({ gruppe: g, volumen: Math.round(volumenProGruppe[g]), farbe: GRUPPEN_FARBEN[g] || GRUPPEN_FARBEN.Sonstiges }))
    .sort((a, b) => b.volumen - a.volumen);

  // ---- Wochenvolumen gestapelt nach Gruppe (12 Wochen, auch leere) ----
  const wochen = [];
  const wochenIndex = {};
  for (let i = 11; i >= 0; i--) {
    const ws = _plusTage_(aktWoche, -7 * i);
    const zeile = { woche: ws, label: 'KW' + _isoWoche_(ws), Beine: 0, Torso: 0, Arme: 0, Sonstiges: 0 };
    wochenIndex[ws] = zeile;
    wochen.push(zeile);
  }
  log.forEach(e => {
    if (einheitVon(e) === 'min') return;
    const zeile = wochenIndex[_wochenStart_(e.tag)];
    if (!zeile) return;
    const g = zeile.hasOwnProperty(gruppeVon(e)) ? gruppeVon(e) : 'Sonstiges';
    zeile[g] += e.gewicht * e.wdh;
  });
  wochen.forEach(z => ['Beine', 'Torso', 'Arme', 'Sonstiges'].forEach(g => { z[g] = Math.round(z[g]); }));

  // ---- Persönliche Bestleistungen der letzten 30 Tage ----
  // Pro Übung: neuer Höchstwert gegenüber dem Bestwert vor diesem Trainingstag.
  const best = {};
  const prs = {};
  log.forEach(e => {
    const b = best[e.uebung] || 0;
    if (e.gewicht > b) {
      if (b > 0 && e.tag >= tag30) {
        const vorher = prs[e.uebung] && prs[e.uebung].tag === e.tag ? prs[e.uebung].vorher : b;
        prs[e.uebung] = { uebung: e.uebung, gewicht: e.gewicht, vorher: vorher, tag: e.tag, einheit: einheitVon(e) };
      }
      best[e.uebung] = e.gewicht;
    }
  });
  const bestleistungen = Object.keys(prs).map(k => prs[k]).sort((a, b) => b.tag.localeCompare(a.tag));

  return {
    heuteTag: heuteTag,
    kennzahlen: {
      serieWochen: serie,
      saetzeWoche: log7.length,
      tageWoche: new Set(log7.map(e => e.tag)).size,
      volumenWoche: Math.round(volumen7),
      cardioMinuten30: Math.round(cardioMinuten30),
      trainingsGesamt: Object.keys(saetzeProTag).length,
    },
    kalender: kalender,
    gruppenVerteilung: gruppenVerteilung,
    wochenGruppen: wochen,
    bestleistungen: bestleistungen,
    gruppenFarben: GRUPPEN_FARBEN,
  };
}

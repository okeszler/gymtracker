/**
 * GymTracker API — Cloudflare Pages Function mit D1 (Binding "DB").
 *
 *   GET  /api/init?person=…              Geräte + heutige Sätze einer Person
 *   POST /api/log                        { person, uebung, gewicht, wdh, id, ts }
 *   POST /api/delete                     { person, id }            (id = DB-ID des Satzes)
 *   GET  /api/verlauf?person=…&uebung=…  Verlauf eines Geräts pro Trainingstag
 *   GET  /api/uebersicht?person=…        Kennzahlen, Kalender, Gruppen, Wochen, Rekorde
 *   GET  /api/uebungen                   alle Geräte (auch inaktive)
 *   POST /api/uebungen                   { alterName?, name, schritt, start, aktiv, einheit, gruppe }
 */

const TZ = 'Europe/Vienna';
const PERSONEN = ['Kratos', 'Atreus'];
const GRUPPEN = ['Beine', 'Torso', 'Arme', 'Cardio'];
const GRUPPEN_FARBEN = { Beine: '#ffc53d', Torso: '#4fd1c5', Arme: '#f472b6', Cardio: '#8a949c', Sonstiges: '#5b6570' };

class Ungueltig extends Error {}

// ───────────────────────── Datum (Europe/Vienna) ─────────────────────────

const tagFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const zeitFormat = new Intl.DateTimeFormat('de-AT', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const tagVon = ms => tagFormat.format(new Date(ms));          // yyyy-MM-dd
const zeitVon = ms => zeitFormat.format(new Date(ms));        // HH:mm

// Kalender-Arithmetik auf Tag-Strings (zeitzonenneutral über UTC).
const tagMs = tag => { const p = tag.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
const plusTage = (tag, n) => new Date(tagMs(tag) + n * 864e5).toISOString().slice(0, 10);
const wochenStart = tag => plusTage(tag, -((new Date(tagMs(tag)).getUTCDay() + 6) % 7));
function isoWoche(montag) {
  const donnerstag = tagMs(plusTage(montag, 3));
  const jahr = new Date(donnerstag).getUTCFullYear();
  return Math.floor((donnerstag - Date.UTC(jahr, 0, 1)) / 864e5 / 7) + 1;
}

/** Geschätztes 1RM nach Epley. */
function e1rm(gewicht, wdh) {
  if (!(gewicht > 0) || !(wdh > 0)) return 0;
  return Math.round((wdh === 1 ? gewicht : gewicht * (1 + wdh / 30)) * 2) / 2;
}

// ───────────────────────── Datenzugriff ─────────────────────────

function pruefePerson(person) {
  if (!PERSONEN.includes(person)) throw new Ungueltig(`Ungültig: unbekannte Person "${person}".`);
}

async function leseUebungen(db) {
  const { results } = await db.prepare('SELECT name, schritt, start, aktiv, einheit, gruppe FROM uebungen ORDER BY rowid').all();
  return results.map(r => ({
    name: r.name,
    schritt: r.schritt > 0 ? r.schritt : 2.5,
    start: r.start >= 0 ? r.start : 20,
    aktiv: !!r.aktiv,
    einheit: r.einheit === 'min' ? 'min' : 'kg',
    gruppe: GRUPPEN.includes(r.gruppe) ? r.gruppe : 'Sonstiges',
  }));
}

/** Log-Einträge (chronologisch) mit Millisekunden und Tag. */
async function leseLog(db, person, uebung) {
  let sql = 'SELECT id, ts, person, uebung, gewicht, wdh, client_id FROM log WHERE person = ?';
  const args = [person];
  if (uebung) { sql += ' AND uebung = ?'; args.push(uebung); }
  const { results } = await db.prepare(sql + ' ORDER BY ts, id').bind(...args).all();
  return results.map(r => {
    const ms = Date.parse(r.ts);
    return { id: r.id, ms, tag: tagVon(ms), uebung: r.uebung, gewicht: Number(r.gewicht), wdh: Number(r.wdh), clientId: r.client_id || '' };
  }).filter(e => !isNaN(e.ms));
}

// ───────────────────────── Endpunkte ─────────────────────────

async function initDaten(db, person) {
  pruefePerson(person);
  const [uebungen, log] = await Promise.all([leseUebungen(db), leseLog(db, person)]);
  const heuteTag = tagVon(Date.now());

  const stat = {};
  for (const e of log) {
    const s = stat[e.uebung] || (stat[e.uebung] = { letztes: null, best: 0, vorherTag: null, vorher: [] });
    s.letztes = { gewicht: e.gewicht, wdh: e.wdh, tag: e.tag };
    if (e.tag < heuteTag) {
      if (e.gewicht > s.best) s.best = e.gewicht;
      if (s.vorherTag !== e.tag) { s.vorherTag = e.tag; s.vorher = []; }
      s.vorher.push({ gewicht: e.gewicht, wdh: e.wdh });
    }
  }

  return {
    person,
    heuteTag,
    uebungen: uebungen.filter(u => u.aktiv).map(u => {
      const s = stat[u.name];
      return {
        name: u.name, schritt: u.schritt, start: u.start, einheit: u.einheit, gruppe: u.gruppe,
        letztes: s ? s.letztes : null,
        best: s ? s.best : 0, // Bestwert vor heute (Basis für die Rekord-Erkennung)
        vorher: s && s.vorherTag ? { tag: s.vorherTag, saetze: s.vorher } : null,
      };
    }),
    heute: log.filter(e => e.tag === heuteTag).map(e => ({
      dbId: e.id, id: e.clientId, ms: e.ms, zeit: zeitVon(e.ms), uebung: e.uebung, gewicht: e.gewicht, wdh: e.wdh,
    })),
  };
}

async function logSatz(db, body) {
  const { person, uebung } = body;
  pruefePerson(person);
  const info = await db.prepare('SELECT einheit FROM uebungen WHERE name = ?').bind(String(uebung || '')).first();
  if (!info) throw new Ungueltig(`Ungültig: Gerät "${uebung}" gibt es nicht (mehr).`);
  const gewicht = Math.round(Number(body.gewicht) * 100) / 100;
  const wdh = Math.round(Number(body.wdh));
  const minGewicht = info.einheit === 'min' ? 0.01 : 0;
  if (!isFinite(gewicht) || gewicht < minGewicht || gewicht > 2000 || !(wdh >= 1) || wdh > 1000) {
    throw new Ungueltig('Ungültig: Eingabe außerhalb des erlaubten Bereichs.');
  }
  // Zeitpunkt laut Client (für nachgereichte Offline-Sätze), max. 7 Tage alt.
  const jetzt = Date.now();
  const clientTs = Number(body.ts);
  const ms = clientTs && clientTs <= jetzt + 5 * 60e3 && clientTs >= jetzt - 7 * 864e5 ? Math.min(clientTs, jetzt) : jetzt;
  const clientId = body.id ? String(body.id).slice(0, 64) : null;

  // Die Client-ID verhindert Doppelbuchungen, wenn eine Antwort verloren ging.
  await db.prepare('INSERT OR IGNORE INTO log (ts, person, uebung, gewicht, wdh, client_id) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(new Date(ms).toISOString(), person, uebung, gewicht, wdh, clientId).run();
  return initDaten(db, person);
}

async function loescheSatz(db, body) {
  pruefePerson(body.person);
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new Ungueltig('Ungültig: Satz-ID fehlt.');
  await db.prepare('DELETE FROM log WHERE id = ? AND person = ?').bind(id, body.person).run();
  return initDaten(db, body.person);
}

async function verlauf(db, person, uebung) {
  pruefePerson(person);
  const proTag = {};
  const tage = [];
  for (const e of await leseLog(db, person, uebung)) {
    let t = proTag[e.tag];
    if (!t) { t = proTag[e.tag] = { tag: e.tag, max: 0, e1rm: 0, volumen: 0, saetze: [] }; tage.push(t); }
    t.max = Math.max(t.max, e.gewicht);
    t.e1rm = Math.max(t.e1rm, e1rm(e.gewicht, e.wdh));
    t.volumen += e.gewicht * e.wdh;
    t.saetze.push({ gewicht: e.gewicht, wdh: e.wdh });
  }
  tage.forEach(t => { t.volumen = Math.round(t.volumen * 10) / 10; });
  return tage;
}

async function uebersicht(db, person) {
  pruefePerson(person);
  const [uebungen, log] = await Promise.all([leseUebungen(db), leseLog(db, person)]);
  const info = Object.fromEntries(uebungen.map(u => [u.name, u]));
  const einheitVon = e => (info[e.uebung] || {}).einheit || 'kg';
  const gruppeVon = e => (info[e.uebung] || {}).gruppe || 'Sonstiges';
  const heuteTag = tagVon(Date.now());

  const saetzeProTag = {};
  log.forEach(e => { saetzeProTag[e.tag] = (saetzeProTag[e.tag] || 0) + 1; });

  // Kalender: 12 Wochen, Spalten = Wochen, Zeilen = Mo…So
  const aktWoche = wochenStart(heuteTag);
  const kalStart = plusTage(aktWoche, -77);
  const kalender = [];
  for (let i = 0; i < 84; i++) {
    const t = plusTage(kalStart, i);
    kalender.push({ tag: t, saetze: saetzeProTag[t] || 0, zukunft: t > heuteTag });
  }

  // Wochen-Serie: die laufende Woche bricht die Serie nicht, solange sie nicht vorbei ist.
  const trainingsWochen = new Set(Object.keys(saetzeProTag).map(wochenStart));
  let serie = 0;
  let w = trainingsWochen.has(aktWoche) ? aktWoche : plusTage(aktWoche, -7);
  while (trainingsWochen.has(w)) { serie++; w = plusTage(w, -7); }

  const tag7 = plusTage(heuteTag, -6);
  const tag30 = plusTage(heuteTag, -29);
  const log7 = log.filter(e => e.tag >= tag7);
  const log30 = log.filter(e => e.tag >= tag30);
  const volumen7 = log7.filter(e => einheitVon(e) === 'kg').reduce((s, e) => s + e.gewicht * e.wdh, 0);

  // Muskelgruppen (Volumen, 30 Tage, nur kg-Geräte)
  const volumenProGruppe = {};
  let cardioMinuten30 = 0;
  for (const e of log30) {
    if (einheitVon(e) === 'min') { cardioMinuten30 += e.gewicht * e.wdh; continue; }
    const g = gruppeVon(e);
    volumenProGruppe[g] = (volumenProGruppe[g] || 0) + e.gewicht * e.wdh;
  }
  const gruppenVerteilung = Object.keys(volumenProGruppe)
    .filter(g => volumenProGruppe[g] > 0)
    .map(g => ({ gruppe: g, volumen: Math.round(volumenProGruppe[g]), farbe: GRUPPEN_FARBEN[g] || GRUPPEN_FARBEN.Sonstiges }))
    .sort((a, b) => b.volumen - a.volumen);

  // Wochenvolumen gestapelt nach Gruppe (12 Wochen, auch leere)
  const wochen = [];
  const wochenIndex = {};
  for (let i = 11; i >= 0; i--) {
    const ws = plusTage(aktWoche, -7 * i);
    const zeile = { woche: ws, label: 'KW' + isoWoche(ws), Beine: 0, Torso: 0, Arme: 0, Sonstiges: 0 };
    wochenIndex[ws] = zeile;
    wochen.push(zeile);
  }
  for (const e of log) {
    if (einheitVon(e) === 'min') continue;
    const zeile = wochenIndex[wochenStart(e.tag)];
    if (!zeile) continue;
    const g = gruppeVon(e) in zeile ? gruppeVon(e) : 'Sonstiges';
    zeile[g] += e.gewicht * e.wdh;
  }
  wochen.forEach(z => ['Beine', 'Torso', 'Arme', 'Sonstiges'].forEach(g => { z[g] = Math.round(z[g]); }));

  // Neue Bestleistungen (30 Tage) gegenüber dem Bestwert vor dem jeweiligen Trainingstag
  const best = {};
  const prs = {};
  for (const e of log) {
    const b = best[e.uebung] || 0;
    if (e.gewicht > b) {
      if (b > 0 && e.tag >= tag30) {
        const vorher = prs[e.uebung] && prs[e.uebung].tag === e.tag ? prs[e.uebung].vorher : b;
        prs[e.uebung] = { uebung: e.uebung, gewicht: e.gewicht, vorher, tag: e.tag, einheit: einheitVon(e) };
      }
      best[e.uebung] = e.gewicht;
    }
  }

  return {
    heuteTag,
    kennzahlen: {
      serieWochen: serie,
      saetzeWoche: log7.length,
      tageWoche: new Set(log7.map(e => e.tag)).size,
      volumenWoche: Math.round(volumen7),
      cardioMinuten30: Math.round(cardioMinuten30),
      trainingsGesamt: Object.keys(saetzeProTag).length,
    },
    kalender,
    gruppenVerteilung,
    wochenGruppen: wochen,
    bestleistungen: Object.values(prs).sort((a, b) => b.tag.localeCompare(a.tag)),
    gruppenFarben: GRUPPEN_FARBEN,
  };
}

/** Gerät anlegen oder ändern; beim Umbenennen wandert der Verlauf mit. */
async function speichereUebung(db, body) {
  const name = String(body.name || '').trim();
  const alterName = body.alterName ? String(body.alterName) : null;
  const schritt = Number(body.schritt);
  const start = Number(body.start);
  const einheit = body.einheit === 'min' ? 'min' : 'kg';
  const gruppe = GRUPPEN.includes(body.gruppe) ? body.gruppe : 'Sonstiges';
  const aktiv = body.aktiv === false ? 0 : 1;
  if (!name || name.length > 60) throw new Ungueltig('Ungültig: Name fehlt oder ist zu lang.');
  if (!(schritt > 0 && schritt <= 100) || !(start >= 0 && start <= 2000)) throw new Ungueltig('Ungültig: Schritt oder Startwert.');

  const vorhanden = await db.prepare('SELECT name FROM uebungen WHERE name = ?').bind(name).first();
  if (alterName && alterName !== name) {
    if (vorhanden) throw new Ungueltig(`Ungültig: "${name}" gibt es schon.`);
    await db.batch([
      db.prepare('UPDATE uebungen SET name = ?, schritt = ?, start = ?, aktiv = ?, einheit = ?, gruppe = ? WHERE name = ?')
        .bind(name, schritt, start, aktiv, einheit, gruppe, alterName),
      db.prepare('UPDATE log SET uebung = ? WHERE uebung = ?').bind(name, alterName),
    ]);
  } else if (alterName || vorhanden) {
    if (!alterName && vorhanden) throw new Ungueltig(`Ungültig: "${name}" gibt es schon.`);
    await db.prepare('UPDATE uebungen SET schritt = ?, start = ?, aktiv = ?, einheit = ?, gruppe = ? WHERE name = ?')
      .bind(schritt, start, aktiv, einheit, gruppe, name).run();
  } else {
    await db.prepare('INSERT INTO uebungen (name, schritt, start, aktiv, einheit, gruppe) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(name, schritt, start, aktiv, einheit, gruppe).run();
  }
  return leseUebungen(db);
}

// ───────────────────────── Routing ─────────────────────────

const json = (daten, status = 200) => new Response(JSON.stringify(daten), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export async function onRequest({ request, env, params }) {
  const db = env.DB;
  const route = [].concat(params.route || []).join('/');
  const url = new URL(request.url);
  const q = k => url.searchParams.get(k) || '';
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : null;

  try {
    if (request.method === 'GET') {
      if (route === 'init') return json(await initDaten(db, q('person')));
      if (route === 'verlauf') return json(await verlauf(db, q('person'), q('uebung')));
      if (route === 'uebersicht') return json(await uebersicht(db, q('person')));
      if (route === 'uebungen') return json(await leseUebungen(db));
    } else if (request.method === 'POST') {
      if (route === 'log') return json(await logSatz(db, body));
      if (route === 'delete') return json(await loescheSatz(db, body));
      if (route === 'uebungen') return json(await speichereUebung(db, body));
    }
    return json({ error: 'Nicht gefunden' }, 404);
  } catch (e) {
    if (e instanceof Ungueltig) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Serverfehler: ' + e.message }, 500);
  }
}

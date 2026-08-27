# Flugbuch

Persönliches digitales Flugbuch für Gleitschirmflüge. Läuft auf PC und Handy.

**Der Besitzer dieses Projekts programmiert nicht.** Erkläre Änderungen in Alltagssprache,
nicht in Fachbegriffen, und mach nie eine Änderung, ohne kurz zu sagen, was sie bewirkt.

## Aufbau

Bewusst simpel gehalten: **eine einzige Datei**, `index.html`, mit HTML, CSS und JavaScript darin.
Kein Build-Schritt, kein npm, kein Framework. Wer hier etwas ändert, ändert genau diese Datei.

- **Hosting:** Vercel, verbunden mit diesem Repository. Jeder Push wird automatisch veröffentlicht.
- **Datenbank und Login:** Supabase (Gratis-Tarif).
- **Karte:** Leaflet mit OpenStreetMap, ohne Schlüssel und ohne Konto.
- **Externe Bibliotheken** werden per CDN geladen (Leaflet, supabase-js). Nichts wird installiert.

Ganz oben im `<script type="module">`-Block stehen `SUPABASE_URL` und `SUPABASE_KEY`.
Der Schlüssel ist der öffentliche „anon key" und gehört dort hin — das ist so vorgesehen.
Der `service_role`-Schlüssel darf **niemals** in diese Datei.

## Datenbank

Drei Tabellen in Supabase, jede mit `user_id` und aktiviertem Row Level Security,
sodass jedes Konto nur eigene Zeilen sieht.

**`places`** — Start- und Landeplätze
`id, user_id, name, type, lat, lng, created_at`
`type`: `start` | `land` | `both` | `ground` (Übungsgelände)

**`gear`** — Ausrüstung
`id, user_id, kind, name, created_at` · `kind`: `glider` | `harness`
Flüge speichern den Namen als Text, nicht die id.

**`flights`** — Flüge
`id, user_id, flight_date, start_time, kind, start_place, land_place, mins,
asc_m, asc_min, glider, harness, note, reminder, created_at`
`kind`: `hikefly` | `thermik` | `schule` | `siv` | `gh` (Groundhandling)

`start_place` und `land_place` verweisen auf `places` mit `on delete restrict`:
Ein Ort, an dem noch Flüge hängen, lässt sich nicht löschen.

## Festgelegte Regeln

Diese Entscheidungen sind bewusst getroffen. Nicht ohne Rückfrage ändern:

- **Groundhandling zählt nicht zur Flugzeit.** Eigene Kennzahl, nicht im Monatsprofil,
  nicht in der Flugzahl. Grund: offizielle Flugbücher zählen es nicht als Luftzeit.
- **Aufstiegszeit zählt nicht zur Flugzeit.** Gleicher Grund.
- Bei `kind = 'gh'` wird nur *ein* Ort erfasst; er steht in `start_place`, `land_place` bleibt leer.
- Aufstiegsfelder dürfen leer sein — das bedeutet: mit Bahn oder Auto zum Startplatz.
- **Vor jedem Löschen kommt eine Rückfrage.** Ausnahmslos.
- Reminder hängen fest am Flug. Es gibt keine eigenständigen Reminder.
- Notizen sind tagebuchlang und erscheinen nur in der Detailansicht, nie in der Liste.

## Sicherung

Der Gratis-Tarif von Supabase hat **keine automatischen Sicherungen**.
Der Reiter „Sicherung" lädt das komplette Flugbuch als JSON herunter und kann es
wieder einlesen. Das ist die einzige Absicherung gegen Datenverlust —
entsprechend vorsichtig damit umgehen.

Der CSV-Export ist zum Auswerten in Excel gedacht, **nicht** zum Wiederherstellen.

## Offene Ideen

- IGC-Dateien importieren (Vario/XCTrack), damit Flugzeit und Koordinaten automatisch entstehen
- Reminder abhaken können
- Höhenmeter-Feld nur bei Hike & Fly einblenden
- Orte nachträglich auf der Karte verschieben

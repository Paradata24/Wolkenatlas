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
`id, user_id, kind, name, gclass, created_at` · `kind`: `glider` | `harness`
`gclass`: Schirmklasse `A` | `B low` | `B high` | `C` | `D` | `CCC` — nur bei Schirmen,
darf leer sein. Steht bei einem Schirm noch eine Klasse, die es in der Liste nicht mehr
gibt, bleibt sie erhalten, bis du sie selbst umstellst.
Flüge speichern den Namen als Text, nicht die id. Die Klasse hängt am Schirm, nicht am
Flug: einmal eingestellt, gilt sie für jeden Flug mit diesem Schirm.

**`flights`** — Flüge
`id, user_id, flight_date, start_time, kind, start_place, land_place, mins,
dist_km, ascent, asc_m, asc_min, glider, harness, note, reminder, created_at`
`kind`: `hikefly` | `thermik` | `schule` (heißt in der Anzeige **Ausbildung**) |
`siv` | `comp` (Wettkampf) | `gh` (Groundhandling)
`ascent`: `foot` (zu Fuß) | `car` (Auto) | `lift` (Bahn) — leer heißt: nicht erfasst

`dist_km` und `ascent` sind später dazugekommen. Fehlen sie in der Datenbank, lässt das
Flugbuch die beiden Felder von selbst weg (siehe „Flugstrecke und Aufstiegsart“).

`start_place` und `land_place` verweisen auf `places` mit `on delete restrict`:
Ein Ort, an dem noch Flüge hängen, lässt sich nicht löschen.

### Leere Felder

Beim Eintragen eines Flugs ist **kein Feld Pflicht**. Alles, was leer bleibt, wird als
leerer Wert (`null`) gespeichert; `mins` wird zu `0`. Damit das funktioniert, müssen
`flight_date` und `start_place` in Supabase leere Werte erlauben. Falls beim Speichern
die Meldung erscheint, dass die Datenbank ein Feld noch nicht leer lässt: In Supabase
unter **SQL Editor** einmalig ausführen:

```sql
alter table flights alter column flight_date drop not null;
alter table flights alter column start_place drop not null;
```

Danach lässt sich ein Flug auch halb ausgefüllt speichern.

### Später dazugekommene Felder

Drei Angaben kamen erst später dazu: die geflogene **Strecke in Kilometern**, die
**Aufstiegsart** (zu Fuß, Auto, Bahn) und die **Schirmklasse**. Solange die passenden
Spalten in Supabase fehlen, zeigt das Flugbuch unter der Flugtabelle einen Hinweis und
lässt die betroffenen Felder einfach weg — alles andere funktioniert normal weiter.
Zum Freischalten in Supabase unter **SQL Editor** einmalig ausführen:

```sql
alter table flights add column if not exists dist_km numeric;
alter table flights add column if not exists ascent text;
alter table gear    add column if not exists gclass text;
```

Danach die Seite neu laden. Ohne die Spalte `ascent` erkennt das Flugbuch „zu Fuß“
daran, dass Höhenmeter oder Aufstiegsdauer eingetragen sind.

**Falls die Art „Wettkampf“ beim Speichern abgelehnt wird:** Manche Datenbanken lassen
für `kind` nur eine feste Liste von Werten zu, in der `comp` noch fehlt. Erscheint beim
Speichern die Meldung, die Datenbank kenne „Wettkampf“ noch nicht, dann einmalig:

```sql
alter table flights drop constraint if exists flights_kind_check;
alter table flights add constraint flights_kind_check
  check (kind in ('hikefly','thermik','schule','siv','comp','gh'));
```

Ohne diese Meldung ist nichts zu tun.

## Die Startseite

Oben die Kennzahlen, darunter **eine Tabelle mit allen Flügen** — eine Zeile pro Flug.
Damit sie kompakt bleibt, stehen zusammengehörende Angaben **übereinander** in einer Zelle
(oben die wichtigere, darunter kleiner und grau die zweite):

| Spalte | oben | darunter |
| --- | --- | --- |
| Datum | Datum | Startzeit |
| Art | Art des Flugs, mittig | — |
| Strecke | Startplatz | Landeplatz, mit `↳` davor |
| Flug | Flugdauer | Flugstrecke in km |
| Aufstieg | Symbol: zu Fuß, Auto oder Bahn | bei „zu Fuß“ Höhenmeter und Dauer |
| Ausrüstung | Schirm, dahinter die Schirmklasse | Gurtzeug |
| Notiz | Knopf für den Kommentar | roter Knopf für den Reminder |

Sortiert nach Datum und Startzeit, neueste zuerst; Flüge ohne Datum stehen ganz oben.
Fehlt eine Angabe, bleibt die Zelle leer. Lange Namen bei der Ausrüstung werden
abgeschnitten — der ganze Name steht im Fenster, das ein Klick auf die Zeile öffnet.

Die **Schirmklasse** wird nicht pro Flug eingetragen, sondern einmal beim Schirm im
Reiter „Ausrüstung“. In der Flugtabelle steht sie als kleines Kürzel hinter dem
Schirmnamen und lässt sich dort nicht ändern.

Oben rechts an der Tabelle sitzen zwei Knöpfe:

- **Stift** — alle Zellen werden zu Eingabefeldern. Ändern, was du willst, dann *Speichern*.
  *Abbrechen* verwirft alles Ungespeicherte (mit Rückfrage). Im Bearbeiten-Zustand
  steht am Zeilenende auch das × zum Löschen des Flugs.
- **Plus** — legt oben eine leere Zeile an, in die du einen neuen Flug einträgst.
  Ein eigenes Eingabeformular gibt es nicht mehr, die Tabelle *ist* das Formular.

In der Spalte **Notiz** ganz rechts stehen zwei runde Knöpfe übereinander: oben der
**Kommentar** (in der Datenbank die Spalte `note`), darunter der **rote** für den Reminder.
Ein Kreis mit `+` heißt leer, ein Punkt heißt: da steht schon etwas drin. Bei einem
gespeicherten Flug wird der Text sofort gespeichert, bei einer neuen Zeile zusammen mit
der Zeile.

Der Reiter **Reminder** ist das Tagebuch: dort stehen alle Kommentare und Reminder
untereinander, jeweils mit Datum, Uhrzeit und Strecke darüber, neueste zuerst.

## Festgelegte Regeln

Diese Entscheidungen sind bewusst getroffen. Nicht ohne Rückfrage ändern:

- **Groundhandling zählt nicht zur Flugzeit.** Eigene Kennzahl, nicht im Monatsprofil,
  nicht in der Flugzahl. Grund: offizielle Flugbücher zählen es nicht als Luftzeit.
- **Aufstiegszeit zählt nicht zur Flugzeit.** Gleicher Grund.
- Bei `kind = 'gh'` wird nur *ein* Ort erfasst; er steht in `start_place`, `land_place` bleibt leer.
- Höhenmeter und Aufstiegsdauer gibt es nur bei „zu Fuß“. Wer Auto oder Bahn wählt,
  bei dem werden beide Felder ausgeblendet und beim Speichern geleert.
- **Jede Angabe darf leer bleiben, auch Datum, Orte und Dauer.** Ein Flug wird immer
  gespeichert und kann später ergänzt werden. Leere Werte lassen die Zelle in der
  Flugtabelle einfach leer, Flüge ohne Datum stehen ganz oben und tauchen in der
  Jahresstatistik nicht auf, weil sie keinem Jahr zugeordnet werden können.
- **Vor jedem Löschen kommt eine Rückfrage.** Ausnahmslos.
- Reminder hängen fest am Flug. Es gibt keine eigenständigen Reminder.
- Kommentare und Reminder sind tagebuchlang. In der Flugtabelle steht dafür nur ein
  kleiner Knopf, der ganze Text steht im Reiter „Reminder“ und im Detailfenster.

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

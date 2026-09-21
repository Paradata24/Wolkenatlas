# Flugbuch

Persönliches digitales Flugbuch für Gleitschirmflüge. Läuft auf PC und Handy.

**Der Besitzer dieses Projekts programmiert nicht.** Erkläre Änderungen in Alltagssprache,
nicht in Fachbegriffen, und mach nie eine Änderung, ohne kurz zu sagen, was sie bewirkt.

## Aufbau

Bewusst simpel gehalten: **eine einzige Datei**, `index.html`, mit HTML, CSS und JavaScript darin.
Kein Build-Schritt, kein npm, kein Framework. Wer hier etwas ändert, ändert genau diese Datei.

- **Hosting:** Vercel, verbunden mit diesem Repository. Jeder Push wird automatisch veröffentlicht.
- **Datenbank und Login:** Supabase (Gratis-Tarif).
- **Karte:** Leaflet mit OpenTopoMap, im Browser entfärbt — ohne Schlüssel und ohne Konto.
- **Höhen der Orte:** Open Topo Data, ebenfalls ohne Schlüssel und ohne Konto.
- **Externe Bibliotheken** werden per CDN geladen (Leaflet, supabase-js). Nichts wird installiert.

Ganz oben im `<script type="module">`-Block stehen `SUPABASE_URL` und `SUPABASE_KEY`.
Der Schlüssel ist der öffentliche „anon key" und gehört dort hin — das ist so vorgesehen.
Der `service_role`-Schlüssel darf **niemals** in diese Datei.

## Datenbank

Drei Tabellen in Supabase, jede mit `user_id` und aktiviertem Row Level Security,
sodass jedes Konto nur eigene Zeilen sieht.

**`places`** — Start- und Landeplätze
`id, user_id, name, type, lat, lng, dirs, elev, info, created_at`
`type`: `start` | `land` | `ground` (Übungsgelände)
Eine frühere Version kannte zusätzlich `both` („Start und Landung“). Die Art gibt es nicht
mehr — siehe „Von ‚Start und Landung‘ zu zwei Punkten“.
`dirs`: mögliche Startrichtungen als Text, durch Komma getrennt — zum Beispiel `N,NO,SO`.
Erlaubt sind die acht Richtungen `N`, `NO`, `O`, `SO`, `S`, `SW`, `W`, `NW`. Gibt es nur
bei `start`; bei `land` und `ground` wird das Feld geleert.
`elev`: Höhe über dem Meer in ganzen Metern. Wird nicht von Hand eingetragen, sondern
aus `lat` und `lng` berechnet und beim Speichern mitgeschrieben (siehe „Höhe über dem Meer“).
`info`: freier Text zum Ort — Zufahrt, Gebühren, Besonderheiten und so viele Links, wie du
willst, mitten im Text. Darf leer sein.
`dirs`, `elev` und `info` sind später dazugekommen (siehe „Später dazugekommene Felder“).

Eine frühere Version hatte für den Link eine eigene Spalte `link`. Die gibt es nicht mehr —
Links stehen jetzt mitten im Text in `info`. Wer sie schon angelegt hat, kann sie in Supabase
unter **SQL Editor** wieder loswerden. Nötig ist das nicht — sie stört nicht, wenn sie stehen bleibt:

```sql
alter table places drop column if exists link;
```

Ein Ort braucht **keinen Flug**. Orte, an denen du noch nie warst, gehören ausdrücklich
hier hinein — sie sind auf der Karte orange statt farbig.

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

Sechs Angaben kamen erst später dazu: die geflogene **Strecke in Kilometern**, die
**Aufstiegsart** (zu Fuß, Auto, Bahn), die **Schirmklasse**, die **Startrichtungen**,
die **Höhe** und die **Infos** an einem Ort. Solange die passenden Spalten in Supabase fehlen, zeigt das Flugbuch unter
der Flugtabelle einen Hinweis und lässt die betroffenen Felder einfach weg — alles andere
funktioniert normal weiter.
Zum Freischalten in Supabase unter **SQL Editor** einmalig ausführen:

```sql
alter table flights add column if not exists dist_km numeric;
alter table flights add column if not exists ascent text;
alter table gear    add column if not exists gclass text;
alter table places  add column if not exists dirs text;
alter table places  add column if not exists elev numeric;
alter table places  add column if not exists info text;
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

Oben die **Kennzahlenleiste** mit sechs Feldern, in dieser Reihenfolge:

| Feld | zeigt |
| --- | --- |
| Flüge diesen Monat | Anzahl der Flüge im laufenden Monat |
| Flüge dieses Jahr | Anzahl der Flüge im laufenden Jahr |
| Flüge insgesamt | Anzahl aller erfassten Flüge |
| Flugzeit dieses Jahr | Zeit in der Luft im laufenden Jahr |
| Groundhandling dieses Jahr | Groundhandling-Zeit im laufenden Jahr |
| Groundhandling insgesamt | Groundhandling-Zeit über alles |

Groundhandling ist nie ein Flug und zählt darum in keinem der drei Flüge-Felder und
nicht zur Flugzeit — siehe *Festgelegte Regeln*. Flüge **ohne Datum** gehören zu keinem
Monat und zu keinem Jahr; sie zählen nur bei *Flüge insgesamt* mit. Die Beschriftungen
sind verschieden lang und brechen in schmalen Fenstern um; die Zahl sitzt darum immer
unten im Feld, damit alle Zahlen auf einer Linie stehen.

Darunter **eine Tabelle mit allen Flügen** — eine Zeile pro Flug.
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

Die **Liste rollt in sich selbst**: Sie bekommt genau die Höhe, die unter den Kennzahlen
noch auf den Schirm passt. Beim Blättern bleiben darum die Zahlen oben und die
Spaltenüberschriften stehen, egal wie viele Flüge drinstehen. Auf sehr flachen Fenstern
und auf dem Handy behält die Liste mindestens 260 Pixel Höhe — dort rollt dann auch die
Seite selbst noch ein Stück.

Die **Schirmklasse** wird nicht pro Flug eingetragen, sondern einmal beim Schirm im
Reiter „Ausrüstung“. In der Flugtabelle steht sie als kleines Kürzel hinter dem
Schirmnamen und lässt sich dort nicht ändern.

Oben rechts an der Tabelle sitzt das **Plus**: Es legt oben eine leere Zeile an, in die du
einen neuen Flug einträgst. Ein eigenes Eingabeformular gibt es nicht mehr, die Tabelle
*ist* das Formular.

**Einen bestehenden Flug änderst du über die Zeile selbst:** ein Klick darauf öffnet das
Fenster mit allen Angaben, dort führt *Bearbeiten* zurück in die Tabelle und springt zu
genau dieser Zeile. Einen eigenen Stift-Knopf über der Tabelle gibt es dafür nicht mehr.

Sobald bearbeitet wird — durch das Plus oder über eine Zeile — werden alle Zellen zu
Eingabefeldern, und oben rechts stehen *Speichern* und *Abbrechen*. *Abbrechen* verwirft
alles Ungespeicherte (mit Rückfrage). In diesem Zustand steht am Zeilenende auch das
× zum Löschen des Flugs.

In der Spalte **Notiz** ganz rechts stehen zwei runde Knöpfe übereinander: oben der
**Kommentar** (in der Datenbank die Spalte `note`), darunter der **rote** für den Reminder.
Ein Kreis mit `+` heißt leer, ein Punkt heißt: da steht schon etwas drin. Bei einem
gespeicherten Flug wird der Text sofort gespeichert, bei einer neuen Zeile zusammen mit
der Zeile.

Der Reiter **Reminder** ist das Tagebuch: dort stehen alle Kommentare und Reminder
untereinander, jeweils mit Datum, Uhrzeit und Strecke darüber, neueste zuerst.

## Der Reiter „Orte“

Der Ortsteil ist die **Sammlung aller Plätze** — die geflogenen und die, die noch auf der
Liste stehen. Er steht darum gleich hinter „Flüge“. Links die Karte, rechts Formular,
Suche, Filter und die Liste aller Orte.

Solange dieser Reiter offen ist, zeigt die **Kennzahlenleiste oben** die Zahlen zu den Orten
statt zu den Flügen: wie viele Orte es gibt, an wie vielen schon geflogen wurde, wie viele
noch offen sind und wie hoch der höchste Startplatz liegt.

Es gibt **genau eine Ansicht**: die Topo-Karte mit Höhenlinien und Geländeschattierung,
**in Grau**. Einen Umschalter braucht es dafür nicht mehr.

Höhenlinien, Schummerung, Wege, Straßen und alle Beschriftungen bleiben vollständig
erhalten — nur die bunten Wald-, Fels- und Wasserflächen treten zurück. Dadurch sind die
Ortspunkte die einzigen Farbflecken auf der Karte und stechen sofort ins Auge.

Technisch ist das **keine eigene Karte**: Es werden dieselben Kacheln geladen wie in Farbe,
die Farbe wird erst beim Anzeigen im Browser herausgerechnet. Das kostet keine zusätzlichen
Abrufe beim Kartendienst, und die Ortspunkte darüber behalten ihre Farbe, weil die
Entfärbung nur auf den Kartenbildern liegt.

Gezoomt wird mit dem **Scrollrad**, sobald die Maus über der Karte ist — oder mit den
Knöpfen + und −. Kacheln gibt es bis Zoomstufe 17; eine Stufe näher geht trotzdem, dann
wird die letzte Kachel vergrössert. Das ist etwas unschärfer, hilft aber beim genauen
Setzen eines Punktes.

**Der Ausschnitt bleibt, wo du ihn hingeschoben hast.** Beim ersten Öffnen zoomt die Karte
einmal so, dass *alle* Orte hineinpassen — danach ändert ihn nur noch, wer es selbst
verlangt:

- ein **Klick auf einen Ort in der Liste** schiebt die Karte auf diesen Ort,
- der **Knopf mit der Kartennadel** (links unter Zoom und Vollbild) holt alle gerade
  sichtbaren Orte ins Bild.

**Filtern und Suchen verändern den Ausschnitt nicht.** Es verschwinden nur die Punkte, die
nicht mehr passen; Zoom und Mitte bleiben stehen. Liegen die Treffer außerhalb des Bildes,
holt sie der Knopf mit der Kartennadel mit einem Klick herbei.

### Die Art des Orts

Ein Ort ist entweder **Startplatz**, **Landeplatz** oder **Übungsgelände** (fürs
Groundhandling). Mehr Arten gibt es nicht.

Wer an einem Platz startet *und* landet, legt dafür **zwei Punkte** an — einen Startplatz
oben und einen Landeplatz unten. Das ist genauer als ein gemeinsamer Punkt: In der Karte
steht jeder Punkt da, wo er wirklich ist, und in den Auswahllisten beim Flug erscheint
jeweils nur, was dort auch passt.

#### Von „Start und Landung“ zu zwei Punkten

Früher gab es zusätzlich die Art **„Start und Landung“** (`both` in der Datenbank). Sie ist
weggefallen. Stehen noch Orte dieser Art in der Datenbank, stellt das Flugbuch sie **beim
Laden von selbst um** — einmalig, ohne Nachfrage:

- Der Ort ist im Flugbuch **nur als Landung** eingetragen → er wird **Landeplatz**
  (Startrichtungen werden dabei geleert, ein Landeplatz hat keine).
- **Sonst** → er wird **Startplatz**. Das gilt auch für Orte, an denen noch kein Flug steht.
- Der Ort ist bei Flügen **als Start und als Landung** eingetragen → er bleibt als
  **Startplatz** stehen, und rund **60 Meter südöstlich** entsteht ein neuer **Landeplatz**
  mit dem Namen „*Name* Landeplatz“. Alle Landungen zeigen danach auf diesen neuen Punkt,
  die Starts bleiben beim alten. Der Infotext wird auf den neuen Punkt mitkopiert, die Höhe
  holt er sich selbst.

Danach steht kurz eine Meldung wie „3 Orte von ‚Start und Landung‘ umgestellt · 1 neuer
Landeplatz.“ Den neuen Landeplatz danach bitte einmal ansehen: Name und Stelle lassen sich
wie bei jedem anderen Ort über *Bearbeiten* richtigstellen.

Ist nichts umzustellen, passiert nichts. Die Umstellung läuft bei jedem Laden mit und greift
darum auch dann noch, wenn später einmal eine **alte Sicherung** wiederhergestellt wird, in
der die alte Art noch vorkommt.

### Die Farbe der Punkte

Die Farbe sagt, ob an dem Ort schon ein Flug im Flugbuch steht:

| Farbe | heißt |
| --- | --- |
| **Orange, gestrichelt** | an diesem Ort steht **noch kein Flug** — egal, welche Art er hat |
| **Rot** | Startplatz, an dem schon geflogen wurde |
| **Blau** | Landeplatz mit Eintrag |
| **Grün** | Übungsgelände mit Eintrag |

Ein orangener Punkt wird also von selbst rot (beziehungsweise blau, gold, grün), sobald der
erste Flug an diesem Ort eingetragen ist. Unter der Karte steht die Legende dazu — sie ist
zugleich ein Filter, siehe „Suchen, filtern, sortieren“. Dieselben
Farben stehen als kleiner Punkt vor dem Namen in der Liste.

Orte ohne Eintrag sind zusätzlich **gestrichelt** gezeichnet, geflogene durchgezogen. So
hängt der Unterschied nicht allein an der Farbe — Rot und Orange liegen nah beieinander, und
nicht jedes Auge trennt sie zuverlässig.

### Das Symbol der Startplätze

Ein **Startplatz zeigt seine möglichen Startrichtungen gleich auf der Karte** — man sieht
also schon beim Hinschauen, ob ein Platz zum heutigen Wind passt, ohne ihn erst anzuklicken.

Rund um den Punkt steht dafür je ein **Tortenstück** für jede Richtung, bei der sich hier
starten lässt. Gezeichnet wird wie die Windrose im Formular: **Norden oben, Osten rechts.**
Nebeneinanderliegende Richtungen ergeben zusammen einen Fächer — aus *N, NO, O* wird also
ein Viertelkranz von oben nach rechts. Richtungen, bei denen nicht gestartet werden kann,
werden gar nicht gezeichnet.

**Unverändert bleiben:** Landeplätze, Übungsgelände und Startplätze, bei denen noch keine
Richtung eingetragen ist. Sie sind weiter der schlichte Punkt. Auch Farbe und Strichart
bleiben, wie sie waren: Die Farbe sagt die Art des Orts, gestrichelt heißt „noch kein Flug“
(siehe „Die Farbe der Punkte“) — das gilt für das Symbol genauso wie für den Punkt.

### Auf einen Ort klicken

Ein **Klick auf einen Punkt** öffnet sein **Infofeld** in der Karte: Name, Art, Höhe, wie
viele Flüge daran hängen, die Startrichtungen und der gespeicherte Text mit seinen
anklickbaren Links. Jeder Link öffnet sich in einem neuen Fenster. Darin sitzen zwei Knöpfe:

- **Bearbeiten** — öffnet rechts das Formular mit allen Angaben. Von dort aus lässt sich der
  Ort umbenennen, seine Art und den Text ändern, und ein **Klick in die Karte verschiebt
  ihn** an eine neue Stelle.
- **Schließen** — das Feld geht zu. Das tut auch ein Klick irgendwo in die Karte oder Escape.

Unten im Infofeld stehen die **Koordinaten** mit einem kleinen **Kopier-Knopf** daneben. Ein
Klick legt sie als `46.43454, 11.85043` in die Zwischenablage — in dieser Form versteht sie
Google Maps, Komoot und fast jede Karten-App direkt. Der Knopf zeigt kurz ein grünes Häkchen,
und eine Meldung bestätigt, was kopiert wurde. Im Vollbild funktioniert er genauso.

Ein Klick auf den **Namen in der Liste** schiebt die Karte auf den Ort und öffnet dasselbe
Infofeld. Umgekehrt wird die Zeile in der Liste hervorgehoben (heller Streifen am linken
Rand), solange das Infofeld eines Orts offen ist — Karte und Liste zeigen immer auf dasselbe.

Damit dabei die Karte nicht aus dem Bild rutscht, **scrollt die Liste in sich selbst**,
solange sie neben der Karte steht: Liegt der angeklickte Ort weiter unten, rollt nur die
Liste dorthin, die Seite bleibt stehen. Die Spaltenüberschriften bleiben beim Scrollen oben
kleben. Auf dem Handy, wo die Liste unter der Karte steht, scrollt wie gewohnt die Seite.

- **Neu anlegen:** „Ort hinzufügen“, dann in die Karte klicken, Name und Art eintragen, speichern.
  Das Formular geht sofort auf, damit sich die Stelle auch über die Koordinaten eintragen lässt.
- **Ändern:** der **Stift** in der Liste oder *Bearbeiten* im Infofeld. Solange du bearbeitest,
  ist der Ort in der Karte gestrichelt eingekreist. *Änderungen speichern* übernimmt alles,
  *Abbrechen* verwirft es.
- **Löschen:** das × — nur, wenn keine Flüge mehr an dem Ort hängen, und immer mit Rückfrage.

### Die Stelle setzen: ziehen, klicken oder eintippen

Drei Wege führen zum selben Ergebnis, während ein Ort angelegt oder bearbeitet wird:

Unter der Karte erscheint dabei eine rosa Zeile, die sagt, was gerade dran ist; wenn nichts
angelegt oder verschoben wird, steht dort nichts.

- **Ziehen** — den gestrichelten Punkt in der Karte anfassen und an die neue Stelle ziehen.
  Das ist der bequemste Weg für kleine Korrekturen.
- **Klicken** — irgendwo in die Karte klicken setzt den Punkt dorthin.
- **Eintippen** — ins Feld *Koordinaten* schreiben oder hineinkopieren, etwa
  `46.50000, 11.35000` aus einer Karten-App. Komma oder Leerzeichen als Trenner, Dezimalpunkt
  oder Dezimalkomma — beides geht. Enter übernimmt, und die Karte springt hin. Das ist der
  Weg für Orte, an denen du noch nie warst und die du aus einer fremden Quelle übernimmst.

### Nicht gespeicherte Änderungen

Wer am Formular etwas ändert und dann woanders hinklickt — auf den Stift eines anderen Orts,
auf „Ort hinzufügen“ oder auf *Abbrechen* —, bekommt eine **Rückfrage**, bevor die Eingaben
verloren gehen. Erst *Ja, verwerfen* wirft sie weg.

### Infos und Links

Zu jedem Ort gibt es **ein einziges Textfeld** für alles, was du dir merken willst: Zufahrt,
Parkplatz, Gebühren, Besonderheiten — und mittendrin so viele Links, wie du magst.

Adressen im Text werden beim Anzeigen **von selbst erkannt und anklickbar**, ohne dass du
etwas markieren musst. Erkannt wird alles, was mit `http://`, `https://` oder `www.` anfängt,
dazu `youtube.com/…` und `youtu.be/…` auch ohne Vorsatz. Ein Punkt oder Komma direkt hinter
der Adresse gehört zum Satz und nicht mehr zum Link. Angeklickt öffnet sich der Link in einem
neuen Fenster; angezeigt wird er gekürzt (ohne `https://`) mit einem kleinen ↗ dahinter.

Der Text steht im Infofeld am Kartenpunkt; in der Liste steht unter dem Namen nur der kurze
Hinweis „Infos“, damit die Tabelle schmal bleibt.

Fehlt die Spalte `info` in der Datenbank noch, steht das Feld gar nicht da und an seiner
Stelle ein Hinweis — alles andere funktioniert unverändert weiter. Eine zweite Spalte braucht
es dafür nicht; die frühere Spalte `link` wird nirgends mehr verwendet.

### Suchen, filtern, sortieren

**Suche und Filter sitzen unter der Karte**, gleich hinter der Legende — dort, wo sie beides
im Blick haben: die Karte darüber und die Liste daneben.

Im **Suchfeld** wird alles sofort angewendet, was du hineintippst, und zwar auf Karte *und*
Liste. Gesucht wird im **Namen und im Infotext** — „seilbahn“ findet also auch den Ort, bei
dem das nur in den Infos steht.

Darunter der Knopf **Filter**; rechts daneben steht immer, wie viele Orte gerade
zu sehen sind („alle 23 Orte“ oder „7 von 23 Orten“). Ein Klick klappt ihn auf. Auf breiten
Bildschirmen steht die Windrose dabei neben den übrigen Einstellungen. Gefiltert
werden kann nach:

- **Höhenlage** — „Höhe ab“ und „Höhe bis“ in Metern. Eines von beiden genügt.
  Orte, deren Höhe noch nicht bekannt ist, fallen dabei heraus.
- **Art des Orts** — nicht im aufgeklappten Filter, sondern direkt in der **Legende unter
  der Karte**: Ein Klick auf *Startplatz* lässt nur noch Startplätze stehen, ein Klick auf
  *Landeplatz* nur noch Landeplätze, und so weiter. Der angeklickte Eintrag wird rosa
  hinterlegt; nochmal klicken nimmt ihn wieder weg. Mehrere gleichzeitig heißen „oder“:
  *Startplatz* und *Übungsgelände* zusammen zeigen beides. Die drei Arten stehen links,
  hinter dem Trennstrich folgen die beiden Knöpfe zum Eintrag im Flugbuch.
- **Eintrag im Flugbuch** — egal / nur Orte, an denen ich schon geflogen bin /
  nur Orte, an denen ich noch nicht war. Dafür stehen **rechts in der Legende**, hinter
  einem Trennstrich, zwei eigene Knöpfe: *schon geflogen* und *noch kein Flug*. Ein Klick
  schaltet den Filter, ein zweiter Klick auf denselben Knopf hebt ihn wieder auf, und ein
  Klick auf den anderen wechselt direkt hinüber. Dieselbe Einstellung steht auch als
  Auswahlliste im aufgeklappten Filter — beide zeigen immer denselben Stand.

  Die beiden **Gruppen in der Legende wirken zusammen** („und“). Genau so kommt man an die
  Fragen, die man beim Planen hat:

  | Klick | zeigt |
  | --- | --- |
  | *Startplatz* + *schon geflogen* | nur die Startplätze, an denen schon ein Flug im Flugbuch steht |
  | *Startplatz* + *noch kein Flug* | nur die Startplätze, an denen ich noch nicht war |
  | *Landeplatz* + *noch kein Flug* | dasselbe für Landeplätze — die Knöpfe gelten für jede Art |
- **Startrichtung** — dieselbe Windrose wie im Formular. Angetippt heißt: zeig mir Orte,
  an denen bei dieser Richtung gestartet werden kann. Mehrere gleichzeitig heißen
  **„oder“**: Es bleibt jeder Ort stehen, an dem *mindestens eine* der angetippten
  Richtungen geht. Je mehr du antippst, desto mehr Orte kommen also dazu.

  Das ist auf die Windvorhersage gemünzt: Steht für morgen **Ostwind** an, tippst du
  **NO, O und SO** an und siehst jeden Platz, der bei einer dieser Richtungen startbar ist —
  auch den, der nur SO kann. Plätze, die ausschließlich nach Westen schauen, fallen weg.

  Weil nur Start- und Start-und-Landeplätze Startrichtungen haben, fallen reine Landeplätze
  und Übungsgelände heraus, sobald hier etwas angetippt ist.

Ein aktiver Filter färbt die Kopfzeile rosa, und unter ihr stehen **kleine Kärtchen** mit
dem, was gerade eingestellt ist — „ab 1500 m“, „noch nicht geflogen“, „Start bei S / SW“.
Jedes lässt sich mit dem × einzeln wegnehmen, ohne den Filter aufklappen zu müssen.

Er gilt für Karte **und** Liste: **auf der Karte bleiben nur die gefilterten Orte übrig**,
alle anderen verschwinden, bis *Filter zurücksetzen* gedrückt wird. Gespeichert wird der
Filter nicht — beim nächsten Laden der Seite sind wieder alle Orte da.

Filterst du nach Höhe und es gibt Orte, deren Höhe noch nicht bekannt ist, sagt ein kurzer
Satz, wie viele dabei ausgeblendet sind — sonst würden sie unbemerkt fehlen.

**Sortiert** wird die Liste per Klick auf eine Spaltenüberschrift: *Name*, *Art*, *Höhe* oder
*Flüge*. Nochmal klicken dreht die Reihenfolge um; ein kleines Dreieck zeigt, wonach gerade
sortiert ist.

### Vollbild

Links unter den Zoomknöpfen sitzt der **Vollbildknopf**. Er legt die Karte über den ganzen
Bildschirm; derselbe Knopf bringt sie wieder zurück, ebenso Escape. Auch im Vollbild öffnet
ein Klick auf einen Ort sein Infofeld, und ein Klick irgendwo in die Karte schließt es
wieder. *Bearbeiten* beendet das Vollbild, weil das Formular neben der Karte steht.

Kann ein Browser kein Vollbild für einen einzelnen Ausschnitt (ältere iPhones), wird die
Karte stattdessen über die ganze Seite gelegt — das sieht gleich aus und kann dasselbe.

### Startrichtungen — die Windrose

Sobald die Art **Startplatz** gewählt ist, erscheint im Formular
eine **Windrose mit acht Feldern** (N, NO, O, SO, S, SW, W, NW, im Uhrzeigersinn ab Norden
oben). Jedes angetippte Feld heißt: bei diesem Wind lässt sich hier starten. Nochmal
antippen nimmt die Richtung wieder weg, mehrere gleichzeitig sind der Normalfall. Unter der
Windrose steht die aktuelle Auswahl noch einmal als Text. Gespeichert wird sie zusammen mit
dem Ort über *Ort speichern* beziehungsweise *Änderungen speichern*.

Die gewählten Richtungen stehen danach in der Ortsliste unter der Art, im Kästchen, das
beim Zeigen auf den Punkt in der Karte aufgeht, und im Infofeld des Orts. Über dieselbe
Windrose lässt sich im Filter suchen, wo bei einer bestimmten Richtung gestartet werden kann. Wird ein Ort auf **Landeplatz** oder
**Übungsgelände** umgestellt, verschwindet die Windrose und die Richtungen werden beim
Speichern geleert — dort gibt es keine Startrichtung.

Fehlt die Spalte `dirs` in der Datenbank noch, steht an der Stelle der Windrose ein Hinweis,
und alles andere funktioniert unverändert weiter.

Flüge merken sich den Ort über seine `id`, nicht über den Namen. Ein umbenannter oder
verschobener Ort ändert sich deshalb sofort überall mit, auch in alten Flügen — es geht
nichts verloren und nichts muss nachgetragen werden.

Wird die **Art** so geändert, dass sie nicht mehr zu vorhandenen Flügen passt (etwa ein
Startplatz, der nur noch Landeplatz sein soll, obwohl er in Flügen als Start steht), kommt
eine Rückfrage. Sagst du ja, bleiben die alten Flüge unverändert; der Ort steht dort weiter
drin und ist nur bei neuen Flügen an dieser Stelle nicht mehr in der Auswahl.

### Höhe über dem Meer

Jeder Ort hat eine **Höhe über dem Meer**. Sie wird nicht eingetippt, sondern aus den
Koordinaten berechnet und in der Spalte `elev` der Tabelle `places` gespeichert — zusammen
mit Name, Art und Koordinaten. Sie steht damit auch in der Sicherung und im JSON-Export.

- In der **Ortsliste** steht sie in einer eigenen Spalte „Höhe“.
- Im **Kästchen am Kartenpunkt** steht sie hinter der Art des Orts.
- Beim **Anlegen und Bearbeiten** steht unter den Koordinaten „Höhe: etwa 1.412 m über dem
  Meer.“ — sie ändert sich sofort mit, wenn der Ort in der Karte verschoben wird.

Wann sie geschrieben wird:

- **Neuer Ort:** beim Speichern, passend zur angeklickten Stelle.
- **Verschobener Ort:** beim Speichern neu berechnet, passend zur neuen Stelle.
- **Nur umbenannt oder Art geändert:** die Höhe bleibt, wie sie war.
- **Orte von früher:** beim nächsten Laden werden alle Orte ohne Höhe in *einer* Anfrage
  nachgetragen; eine kurze Meldung sagt, bei wie vielen. Danach steht die Höhe fest in der
  Datenbank und wird nicht mehr abgefragt.
- **Nach einem Wechsel des Höhenmodells:** einmalig werden *alle* Höhen neu berechnet und
  die alten, gröberen Werte überschrieben — ebenfalls mit einer kurzen Meldung. Danach
  passiert das nicht wieder. Woran das Flugbuch erkennt, ob das schon gelaufen ist, merkt
  es sich im Browser; auf einem zweiten Gerät läuft es deshalb noch einmal, mit demselben
  Ergebnis.

Die Zahl kommt von [Open Topo Data](https://www.opentopodata.org/), kostenlos und ohne
Schlüssel. Gefragt werden **zwei Höhenmodelle nacheinander**:

1. **`eudem25m`** — das europäische Modell mit **25-Meter-Raster**. Für die Alpen das
   genaueste, das ohne Anmeldung zu haben ist.
2. **`srtm30m`** — 30-Meter-Raster, weltweit. Springt überall dort ein, wo das europäische
   Modell nichts weiß, also außerhalb Europas. Es ist dieselbe Grundlage, aus der die
   Höhenlinien der Topo-Karte gezeichnet sind — Zahl und Karte passen damit zusammen.

Trotzdem steht „etwa“ dabei: Ein 25-Meter-Raster mittelt das Gelände über 25 Meter. Auf
einem schmalen Grat kommt die Höhe deshalb eher zu niedrig heraus, in einer Mulde zu hoch.
**Genauer wird sie vor allem dadurch, dass du beim Setzen des Punktes weit hineinzoomst** —
bei Zoomstufe 10 entspricht ein Bildpunkt rund 100 Metern im Gelände, und an einem steilen
Hang sind das schnell 50 Höhenmeter Unterschied.

Der kostenlose Dienst erlaubt **100 Punkte pro Anfrage, eine Anfrage pro Sekunde und
1000 pro Tag**. Das Flugbuch hält den Sekundenabstand von selbst ein. Weil jede Höhe nur
einmal geholt und dann in der Datenbank gespeichert wird, ist das Tageslimit auch bei
vielen Orten kein Thema.

Ist der Dienst gerade nicht erreichbar, etwa ohne Netz, bleibt das Feld leer und wird beim
nächsten Laden nachgetragen; in derselben Sitzung wird nicht dauernd neu gefragt. Bei einem
nur umbenannten Ort bleibt die alte Höhe erhalten. Solange die Spalte `elev` in Supabase
fehlt, zeigt das Flugbuch die Höhe trotzdem an, merkt sie sich aber nur im Browser, statt
sie zu speichern.

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

- Orte nach Gebiet oder Region gruppieren
- Filter auch für die Art des Orts (nur Startplätze, nur Landeplätze)
- Vom Infofeld direkt zu den Flügen an diesem Ort springen
- Bei sehr vielen Orten dicht beieinander: Punkte zusammenfassen

- IGC-Dateien importieren (Vario/XCTrack), damit Flugzeit und Koordinaten automatisch entstehen
- Reminder abhaken können
- Höhenmeter-Feld nur bei Hike & Fly einblenden

# Flugbuch

Persönliches digitales Flugbuch für Gleitschirmflüge. Läuft auf PC und Handy.

**Der Besitzer dieses Projekts programmiert nicht.** Erkläre Änderungen in Alltagssprache,
nicht in Fachbegriffen, und mach nie eine Änderung, ohne kurz zu sagen, was sie bewirkt.

## Aufbau

Bewusst simpel gehalten: **eine einzige Datei**, `index.html`, mit HTML, CSS und JavaScript darin.
Kein Build-Schritt, kein npm, kein Framework. Wer hier etwas ändert, ändert genau diese Datei.

- **Hosting:** Vercel, verbunden mit diesem Repository. Jeder Push wird automatisch veröffentlicht.
- **Datenbank und Login:** Supabase (Gratis-Tarif).
- **Karte:** Leaflet mit OpenTopoMap (Standard) und OpenStreetMap, ohne Schlüssel und ohne Konto.
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
`type`: `start` | `land` | `both` | `ground` (Übungsgelände)
`dirs`: mögliche Startrichtungen als Text, durch Komma getrennt — zum Beispiel `N,NO,SO`.
Erlaubt sind die acht Richtungen `N`, `NO`, `O`, `SO`, `S`, `SW`, `W`, `NW`. Gibt es nur
bei Orten mit Start (`start` und `both`); bei `land` und `ground` wird das Feld geleert.
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

## Der Reiter „Orte“

Der Ortsteil ist die **Sammlung aller Plätze** — die geflogenen und die, die noch auf der
Liste stehen. Er steht darum gleich hinter „Flüge“. Links die Karte, rechts Formular,
Suche, Filter und die Liste aller Orte.

Solange dieser Reiter offen ist, zeigt die **Kennzahlenleiste oben** die Zahlen zu den Orten
statt zu den Flügen: wie viele Orte es gibt, an wie vielen schon geflogen wurde, wie viele
noch offen sind und wie hoch der höchste Startplatz liegt.

Die Karte ist eine **Topo-Karte** mit Höhenlinien und Geländeschattierung. Oben rechts in
der Karte lässt sich auf **Strasse** umschalten, die gewohnte OpenStreetMap-Ansicht. Gezoomt
wird mit dem **Scrollrad**, sobald die Maus über der Karte ist — oder mit den Knöpfen + und −.
Die Topo-Karte reicht eine Zoomstufe weniger weit als die Strassenkarte; wer ganz nah heran
will, schaltet dafür kurz um.

**Der Ausschnitt richtet sich nach der Liste.** Beim ersten Öffnen zoomt die Karte so, dass
*alle* Orte hineinpassen; wird gefiltert oder gesucht, zieht sie auf die übrig gebliebenen
nach. Der Knopf mit dem Kartennadel-Symbol (links unter Zoom und Vollbild) holt jederzeit
alle gerade sichtbaren Orte zurück ins Bild.

### Die Farbe der Punkte

Die Farbe sagt, ob an dem Ort schon ein Flug im Flugbuch steht:

| Farbe | heißt |
| --- | --- |
| **Orange, gestrichelt** | an diesem Ort steht **noch kein Flug** — egal, welche Art er hat |
| **Rot** | Startplatz, an dem schon geflogen wurde |
| **Blau** | Landeplatz mit Eintrag |
| **Gold** | Start und Landung mit Eintrag |
| **Grün** | Übungsgelände mit Eintrag |

Ein orangener Punkt wird also von selbst rot (beziehungsweise blau, gold, grün), sobald der
erste Flug an diesem Ort eingetragen ist. Unter der Karte steht die Legende dazu. Dieselben
Farben stehen als kleiner Punkt vor dem Namen in der Liste.

Orte ohne Eintrag sind zusätzlich **gestrichelt** gezeichnet, geflogene durchgezogen. So
hängt der Unterschied nicht allein an der Farbe — Rot und Orange liegen nah beieinander, und
nicht jedes Auge trennt sie zuverlässig.

### Auf einen Ort klicken

Ein **Klick auf einen Punkt** öffnet sein **Infofeld** in der Karte: Name, Art, Höhe, wie
viele Flüge daran hängen, die Startrichtungen und der gespeicherte Text mit seinen
anklickbaren Links. Jeder Link öffnet sich in einem neuen Fenster. Darin sitzen zwei Knöpfe:

- **Bearbeiten** — öffnet rechts das Formular mit allen Angaben. Von dort aus lässt sich der
  Ort umbenennen, seine Art und den Text ändern, und ein **Klick in die Karte verschiebt
  ihn** an eine neue Stelle.
- **Schließen** — das Feld geht zu. Das tut auch ein Klick irgendwo in die Karte oder Escape.

Ein Klick auf den **Namen in der Liste** schiebt die Karte auf den Ort und öffnet dasselbe
Infofeld. Umgekehrt wird die Zeile in der Liste hervorgehoben (heller Streifen am linken
Rand), solange das Infofeld eines Orts offen ist — Karte und Liste zeigen immer auf dasselbe.

- **Neu anlegen:** „Ort hinzufügen“, dann in die Karte klicken, Name und Art eintragen, speichern.
  Das Formular geht sofort auf, damit sich die Stelle auch über die Koordinaten eintragen lässt.
- **Ändern:** der **Stift** in der Liste oder *Bearbeiten* im Infofeld. Solange du bearbeitest,
  ist der Ort in der Karte gestrichelt eingekreist. *Änderungen speichern* übernimmt alles,
  *Abbrechen* verwirft es.
- **Löschen:** das × — nur, wenn keine Flüge mehr an dem Ort hängen, und immer mit Rückfrage.

### Die Stelle setzen: ziehen, klicken oder eintippen

Drei Wege führen zum selben Ergebnis, während ein Ort angelegt oder bearbeitet wird:

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

Über der Liste steht ein **Suchfeld**. Was du hineintippst, wird sofort auf Karte und Liste
angewendet und sucht im **Namen und im Infotext** — „seilbahn“ findet also auch den Ort, bei
dem das nur in den Infos steht.

Darunter der Knopf **Filter**; rechts daneben steht immer, wie viele Orte gerade
zu sehen sind („alle 23 Orte“ oder „7 von 23 Orten“). Ein Klick klappt ihn auf. Gefiltert
werden kann nach:

- **Höhenlage** — „Höhe ab“ und „Höhe bis“ in Metern. Eines von beiden genügt.
  Orte, deren Höhe noch nicht bekannt ist, fallen dabei heraus.
- **Eintrag im Flugbuch** — egal / nur Orte, an denen ich schon geflogen bin /
  nur Orte, an denen ich noch nicht war.
- **Startrichtung** — dieselbe Windrose wie im Formular. Angetippt heißt: zeig mir Orte,
  an denen bei dieser Richtung gestartet werden kann. Mehrere gleichzeitig heißen
  „oder“. Weil nur Start- und Start-und-Landeplätze Startrichtungen haben, fallen
  reine Landeplätze und Übungsgelände heraus, sobald hier etwas angetippt ist.

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

Sobald die Art **Startplatz** oder **Start und Landung** gewählt ist, erscheint im Formular
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

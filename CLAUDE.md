# Hinweise für Claude Code

Die vollständige Beschreibung des Flugbuchs steht in `README.md` — zuerst dort lesen.
Der Besitzer programmiert nicht: Antworten auf Deutsch und in Alltagssprache.

## Datenbank (Supabase)

- **Flugbuch-Projekt:** „Flugtagebuch“, ID `vlxkivzgmfrdifxqtlxu`, in der Supabase-Organisation
  **„Wolkenatlas“** — `https://vlxkivzgmfrdifxqtlxu.supabase.co` (dasselbe wie `SUPABASE_URL`
  in `index.html`). Tabellen `places`, `gear`, `flights`; ein einziges Konto
  (`user_id` `d559f787-0e97-44ee-b69c-fdf82b67bf61`).
- **Nicht das Flugbuch:** Projekt „sisosig“ (`jevjyfaazmoemczimzhe`, Organisation
  „Paradata24's Org“) enthält nur Winddaten (`wind_measurements`, `wind_forecasts`).
  Dort nichts für das Flugbuch schreiben.
- **Zugriff:** Der Supabase-Connector sieht immer nur die Organisation, die beim Verbinden
  freigegeben wurde. Seit 16.10.2026 ist das „Wolkenatlas“ — damit lässt sich die Datenbank
  direkt lesen und ändern (`execute_sql` mit der Projekt-ID oben). Listet das Werkzeug nur
  „sisosig“ oder meldet „You do not have permission“, ist wieder die falsche Organisation
  verbunden. Abhilfe für den Besitzer: unter https://claude.ai/customize/connectors Supabase
  neu verbinden, dabei „Wolkenatlas“ wählen, danach neue Sitzung.
- **Solange der Zugriff fehlt:** Änderungen an Daten als fertigen SQL-Block liefern, den der
  Besitzer in Supabase → **SQL Editor** ausführt. Für neue Orte bewährt:
  `user_id` aus `places` übernehmen (`select user_id from places group by user_id order by
  count(*) desc limit 1`), `elev` leer lassen (die App rechnet die Höhe beim Öffnen nach)
  und Doppelte überspringen (gleicher Name oder < 600 m neben einem bestehenden Startplatz).
  Nie etwas löschen, ohne ausdrücklich darauf hinzuweisen.

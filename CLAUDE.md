# Hinweise für Claude Code

Die vollständige Beschreibung des Flugbuchs steht in `README.md` — zuerst dort lesen.
Der Besitzer programmiert nicht: Antworten auf Deutsch und in Alltagssprache.

## Datenbank (Supabase)

- **Flugbuch-Projekt:** `vlxkivzgmfrdifxqtlxu` — `https://vlxkivzgmfrdifxqtlxu.supabase.co`
  (dasselbe wie `SUPABASE_URL` in `index.html`). Tabellen `places`, `gear`, `flights`.
- **Nicht das Flugbuch:** Projekt „sisosig“ (`jevjyfaazmoemczimzhe`, Organisation
  „Paradata24's Org“) enthält nur Winddaten (`wind_measurements`, `wind_forecasts`).
  Dort nichts für das Flugbuch schreiben.
- **Zugriff:** Stand 16.10.2026 listet das Supabase-Werkzeug nur „sisosig“; Abfragen an
  `vlxkivzgmfrdifxqtlxu` enden mit „You do not have permission“. Das Flugbuch-Projekt liegt
  also in einer Organisation, die für den Supabase-Connector nicht freigegeben ist. Abhilfe
  für den Besitzer: unter https://claude.ai/customize/connectors den Supabase-Connector neu
  verbinden, dabei die Organisation mit dem Flugbuch-Projekt freigeben, danach neue Sitzung.
- **Solange der Zugriff fehlt:** Änderungen an Daten als fertigen SQL-Block liefern, den der
  Besitzer in Supabase → **SQL Editor** ausführt. Für neue Orte bewährt:
  `user_id` aus `places` übernehmen (`select user_id from places group by user_id order by
  count(*) desc limit 1`), `elev` leer lassen (die App rechnet die Höhe beim Öffnen nach)
  und Doppelte überspringen (gleicher Name oder < 600 m neben einem bestehenden Startplatz).
  Nie etwas löschen, ohne ausdrücklich darauf hinzuweisen.

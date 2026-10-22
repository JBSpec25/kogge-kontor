# Übersetzung (Englisch, Spanisch)

Das Spiel wird auf Deutsch geschrieben. Die englische und spanische Fassung entstehen daraus maschinell:

1. `extract.js` liest das Hauptskript mit acorn und sammelt alle Texte für Menschen (Zeichenketten und Vorlagen; Ausdrücke werden zu `{0}`, `{1}` …). Schlüssel ist sha1(Text)[:8].
2. `tr/c*.json` enthält je Schlüssel `[englisch, spanisch]`. Gleicher deutscher Text, anderer Sinn: `tr/ctx.json` (Schlüssel + Regex auf die Quelltextzeile).
3. `tr/srcfix.json`: Ersetzungen im übersetzten Quelltext für Stellen, die keine Textbausteine sind (Datumsformat, Bezeichner, Satzbau). `tr/html.json`: statisches HTML außerhalb des Skripts.
4. `build2.js SPIEL.html UNITS.json AUS.html en|es` setzt alles zusammen; `check.py` prüft Platzhalter, Tags und Ränder; `parsecheck.js` prüft, ob das Ergebnis gültiges JavaScript ist.

Ablauf bei einer neuen Spielversion: `rebuild.sh` (Pfade darin anpassen) baut Einheiten und beide Sprachen. Neue Schlüssel ohne Übersetzung meldet build2.js als „fehlend“; diese in eine neue `tr/cNN.json` eintragen. Begriffe stehen in `glossar.md`.

Die Übersetzung wurde von einem zweiten Modell (Claude Sonnet) gegen das Deutsche geprüft (`PRUEFAUFTRAG.md`); 134 Befunde sind eingearbeitet.

Sprachwahl im Spiel: „Spielstände und Einstellungen“ → „Sprache“. Web und App liefern `index.html` (Deutsch), `en.html`, `es.html`; beim ersten Start entscheidet die Gerätesprache (Deutsch → Deutsch, Spanisch → Spanisch, sonst Englisch), danach die gespeicherte Wahl (`kogge-kontor-sprache`).

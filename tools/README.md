# Werkzeuge

Alles wird aus der deutschen Quelle `src/kogge-kontor.html` gebaut. Von Hand geändert wird nur sie (und die Übersetzungen in `i18n/tr/`).

| Befehl (im Wurzelordner) | Wirkung |
|---|---|
| `npm ci --prefix tools` | einmalig: Parser und Playwright für Bau und Tests |
| `python3 tools/build.py` | Englisch und Spanisch (`src/kogge-kontor.en.html`, `.es.html`) und die Beta (`beta/`) |
| `python3 tools/build.py --check` | wie oben, aber nur prüfen, ob die Dateien im Repository aktuell sind |
| `python3 tools/build.py --haupt` | zusätzlich die Hauptseite in der Wurzel (erst zum Start) |
| `python3 tools/build.py --probe DIR --app-url URL` | Browser-Fassung mit Probezeit und Link zur App |
| `python3 tools/build.py --app` | App-Ordner `app/www` (vorher `npm ci --prefix app`, danach `npm run native --prefix app`) |
| `node tools/test/smoke.js` | Rauchtest aller vorhandenen Fassungen in drei Sprachen; Bericht und Bilder in `tools/out/smoke/` |
| `node tools/test/gefecht.js [--bilder]` | Seegefecht (ab Version 54: Fernkampf in Dritteln, Entern mit Karten) auf dem kleinsten iPhone (375 × 667) in drei Sprachen: Zeiger ohne Spannen, Waffe wechseln, je Rotte ein Tipp, Enterkampf mit Karten in drei Abschnitten, Kapitän entscheiden lassen, Übungskampf am ersten Seeräuber; Karten mindestens 56 px hoch, nichts verdeckt; Bilder in `tools/out/gefecht/` |
| `node tools/test/haus.js [--bilder]` | Haus im Stil Kontorbuch (ab Version 53) auf 375 × 667 in drei Sprachen: Spielstart ohne Hausmarke, Truhe und Haussiegel im Kopf, jede Kachel öffnet ein Blatt und schließt wieder, Verband mit Seekarte und Regeln je Hafen; eine Regel mit Menge und Preisgrenze wird bearbeitet und beim Handeln eingehalten; nichts ragt über den Bildschirm; Bilder in `tools/out/haus/` |
| `python3 tools/sim/mksim.py src/kogge-kontor.html tools/out/sim.html` | Simulationsbau mit dem Spieler-Bot (`sim/bot.js`) |
| `node tools/sim/run.js tools/out/sim.html --spiele 24 --tage 5930 --profil mensch --stammsitz riga --json AUS.json` | Langzeitsimulation bis zum Kampagnenende 1372: Spieltage bis zu jedem Rang und Amt (Median), Verlauf und Schlusswertung im JSON; Profile `mensch` und `bot45` |
| `node tools/sim/kampf.js tools/out/sim.html --tage 400,1100,1800 --staende 10 --n 30 --verbaende [--tune JSON]` | Kampfquoten je Kampfstufe und Seeräuberverband (ab Version 51): von echten Spielständen des Bots aus, mit Juliens Können („gut“) und so, wie ein Kapitän entscheidet („ordentlich“); dazu Ausgänge und gespielte Karten im Nahkampf. `--tune` setzt Kampfwerte zum Abstimmen (siehe `tune` in `sim/bot.js`) |

## Fassungen

- **Hauptseite** (Wurzel, https://jbspec25.github.io/kogge-kontor/): ganzes Spiel, bleibt bis zum Start auf Version 48.
- **Beta** (`beta/`, …/kogge-kontor/beta/): ganzes Spiel in der neuesten Fassung, eigene Spielstände (`kogge-kontor-beta-…`), eigener Offline-Cache, nicht in Suchmaschinen.
- **Probe**: Probezeit von 60 Spieltagen, danach Hinweis auf die App. Kommt nach der Freigabe im App Store auf die Hauptseite.
- **App** (`app/www`): Probezeit und Kauf der Vollversion, gebaut vom Workflow `ios.yml`.

## Prüfung auf GitHub

`.github/workflows/pruefung.yml` läuft bei jedem Push und Pull Request: gebaute Dateien aktuell, Übersetzung vollständig (Platzhalter, Tags, gültiges JavaScript), dann der Rauchtest. Gearbeitet wird in Zweigen; nach `main` kommt nur, was grün ist, denn `main` geht sofort auf GitHub Pages und in den iPhone-Bau.

Der Rauchtest prüft je Fassung und Sprache: neues Spiel, alle Reiter, Zeit vergehen lassen (Beta bis zum Bankrott ohne Handel, sonst 10 Wochen), Ende der Probezeit und nachgestellter Kauf in der App, Neuladen mit gleichem Spielstand, Sprachwechsel, keine Konsolenfehler, keine deutschen Reste in Englisch und Spanisch (Namen in `test/erlaubt.txt`), kein Knopf ragt über den Bildschirm, gleiche Versionskennung in Seite, `version.txt` und `sw.js`.

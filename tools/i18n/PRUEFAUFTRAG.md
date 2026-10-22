# Prüfauftrag: Übersetzung des Spiels „Kogge & Kontor“

Kogge & Kontor ist ein Handelsspiel zur Hansezeit (1356–1370) für iPhone und Browser. Der deutsche Originaltext wurde ins Englische (britisch) und Spanische (Spanien, tuteo) übersetzt. Du prüfst eine Teilliste.

Jeder Eintrag in der Datei sieht so aus:
```
### <schlüssel>
DE: <deutscher Text>
EN: oder ES: <Übersetzung>
CTX: <Quelltextzeile, in der der Text steht – nur zur Orientierung>
```

Regeln, die die Übersetzung einhalten muss:
- Platzhalter `{0}`, `{1}` … werden im Spiel durch Werte ersetzt (Zahlen, Städtenamen, Warennamen, ganze Satzteile). Sie dürfen umgestellt, aber nicht weggelassen, verdoppelt oder umnummeriert werden. CTX zeigt, was eingesetzt wird.
- HTML-Tags und Attribute (class, data-*, id, type) bleiben genau gleich; nur sichtbarer Text und aria-label/title/placeholder werden übersetzt.
- Leerzeichen am Anfang/Ende bleiben erhalten (Textbausteine werden zusammengesetzt).
- Begriffe nach dem Glossar `/home/claude/i18n/glossar.md` (lies es zuerst).
- Kurze Knopftexte bleiben kurz (Handybildschirm 375 px breit).
- Spanisch: tuteo; „ihr“ (die Mannschaft) als vosotros. Englisch: britische Schreibweise.

Was du suchen sollst (nur echte Fehler, keine Geschmacksfragen):
1. Sinnfehler oder falsch verstandene Stellen gegenüber dem Deutschen.
2. Grammatikfehler, auch solche, die erst nach dem Einsetzen der Platzhalter entstehen (Genus, Numerus, Artikel, Präpositionen wie „de el“ statt „del“).
3. Abweichungen vom Glossar oder uneinheitliche Begriffe.
4. Stehen gebliebene deutsche Wörter.
5. Verletzte Regeln (Platzhalter, Tags, Ränder).
6. Unnatürliche oder holprige Formulierungen, die ein Muttersprachler sofort bemerkt.

Schreibe dein Ergebnis als JSON-Liste nach `/home/claude/i18n/review/out_<datei>.json` (z. B. out_en_0.json für en_0.txt):
```
[{"key": "<schlüssel>", "severity": "hoch|mittel|niedrig", "problem": "<kurz, Deutsch>", "fix": "<vollständige korrigierte Übersetzung des ganzen Eintrags, mit allen Tags und Platzhaltern>"}]
```
„fix“ ist immer der komplette neue Text für diesen Schlüssel, nicht nur das geänderte Stück. Einträge ohne Befund lässt du weg. Erfinde keine Probleme; wenn ein Eintrag in Ordnung ist, schreibe nichts dazu. Antworte zum Schluss nur mit der Zahl der Befunde je Schweregrad.

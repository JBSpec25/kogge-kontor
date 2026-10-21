# Kogge & Kontor in den App Store bringen

Die App wird ohne Mac auf GitHub gebaut (Workflow „iPhone-App“ unter Actions). Jeder Push nach `main`, der `app/` oder `src/` ändert, baut sie neu. Sobald die vier Geheimnisse eingetragen sind, landet jeder Bau automatisch in TestFlight.

## Schritt 1: Bei Apple anmelden (einmalig)

1. Apple Developer Program als Einzelperson, 99 € im Jahr (App „Apple Developer“ auf dem iPhone).
2. App Store Connect → Geschäft: Vereinbarung für kostenpflichtige Apps, Bankkonto, Steuerformular W-8BEN.
3. Händlerstatus nach dem DSA: Adresse (oder Postfach), Telefon, E-Mail. Diese Angaben stehen öffentlich im Store.

## Schritt 2: App und Kauf in App Store Connect anlegen

1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → „+“ → App IDs → App.
   Beschreibung „Kogge und Kontor“, Bundle ID explizit: `io.github.jbspec25.koggekontor`. In-App Purchase ist automatisch dabei.
2. appstoreconnect.apple.com → Apps → „+“ → Neue App: Plattform iOS, Name „Kogge & Kontor“, Hauptsprache Deutsch, die Bundle-ID von oben, SKU `kogge-kontor-ios`, voller Zugriff.
3. In der App → Monetarisierung → In-App-Käufe → „+“: Typ „Nicht verbrauchbar“, Referenzname „Vollversion“, Produkt-ID `kogge_kontor_vollversion`. Preis 2,99 €, Lokalisierung Deutsch mit den Texten aus `store/texte.md`, Prüfbild `store/iap_review.png`.
4. Benutzer und Zugriff → Integrationen → App Store Connect API → Teamschlüssel → „+“: Name „GitHub“, Zugriff **Admin** (nötig, damit GitHub das Zertifikat für die Signatur selbst anlegen darf). Die Datei `AuthKey_….p8` herunterladen (geht nur einmal), Schlüssel-ID und Issuer-ID notieren.
5. developer.apple.com → Account → Mitgliedschaft: die Team-ID notieren (10 Zeichen).

## Schritt 3: Geheimnisse in GitHub eintragen

github.com/JBSpec25/kogge-kontor → Settings → Secrets and variables → Actions → New repository secret:

| Name | Inhalt |
|---|---|
| `APPLE_TEAM_ID` | Team-ID |
| `ASC_KEY_ID` | Schlüssel-ID |
| `ASC_ISSUER_ID` | Issuer-ID |
| `ASC_KEY_P8` | den ganzen Inhalt der .p8-Datei, mit den Zeilen BEGIN und END |

Dann unter Actions → „iPhone-App“ → „Run workflow“. Nach etwa 20 Minuten ist der Bau hochgeladen, nach weiteren 10 bis 30 Minuten steht er in App Store Connect unter TestFlight.

## Schritt 4: Auf dem eigenen iPhone testen

App Store Connect → TestFlight → Interne Tests → Gruppe anlegen, dich selbst hinzufügen. Auf dem iPhone die App „TestFlight“ laden und Kogge & Kontor installieren. Käufe in TestFlight kosten nichts.

## Schritt 5: Einreichen

Texte, Stichwörter, Screenshots, Altersfreigabe, Datenschutzangaben und Hinweise für die Prüfung stehen in `store/texte.md`. Den In-App-Kauf zusammen mit der ersten Version einreichen. Die Prüfung dauert meist ein bis zwei Tage.

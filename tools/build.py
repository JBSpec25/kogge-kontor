#!/usr/bin/env python3
"""Baut alle Fassungen von Kogge & Kontor aus der deutschen Quelle src/kogge-kontor.html.

  python3 tools/build.py                 Englisch und Spanisch (src/*.en.html, *.es.html) und die Beta (beta/)
  python3 tools/build.py --check         baut in einen Zwischenordner und meldet, was von den Dateien im Repository abweicht
  python3 tools/build.py --haupt         zusätzlich die Hauptseite in der Wurzel (erst zum Start, sie bleibt bis dahin Version 48)
  python3 tools/build.py --probe DIR [--app-url URL]
                                         Browser-Fassung mit Probezeit nach DIR (nach der Freigabe im App Store)
  python3 tools/build.py --app           App-Ordner app/www (braucht vorher npm ci in app/)

Gemeinsam für alle Web-Fassungen: Kopf und Fuß aus tools/web/, eigene Schriften statt Google Fonts,
Offline-Cache (sw.js) und Hinweis „Neu laden“ über version.txt. Die Beta speichert unter eigenen Schlüsseln
(kogge-kontor-beta-…), damit sie keine Spielstände der Hauptseite umrechnet.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, 'tools')
I18N = os.path.join(TOOLS, 'i18n')
WEB = os.path.join(TOOLS, 'web')
SRC = os.path.join(ROOT, 'src', 'kogge-kontor.html')
LANGS = {'de': 'index.html', 'en': 'en.html', 'es': 'es.html'}
END = '\n</body>\n</html>\n'

# Die Beta legt alle Schlüssel des Spiels unter einem eigenen Präfix ab (läuft vor allem anderen)
BETA_STORE = ('<meta charset="utf-8">\n'
              "<script>(function(){var P='kogge-kontor-',B='kogge-kontor-beta-',S=Storage.prototype,g=S.getItem,s=S.setItem,r=S.removeItem;"
              "function m(k){k=String(k);return k.indexOf(P)===0&&k.indexOf(B)!==0?B+k.slice(P.length):k;}"
              "S.getItem=function(k){return g.call(this,m(k));};S.setItem=function(k,v){return s.call(this,m(k),v);};"
              "S.removeItem=function(k){return r.call(this,m(k));};})();</script>\n"
              '<meta name="robots" content="noindex, nofollow">\n')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        sys.stderr.write(r.stdout + r.stderr)
        raise SystemExit(f'Fehler bei: {" ".join(cmd)}')
    return r.stdout


# ───────── Übersetzung ─────────
def translate(src, out_dir, tmp):
    """Englisch und Spanisch aus der deutschen Quelle; bricht ab, wenn eine Übersetzung fehlt."""
    raw, units = os.path.join(tmp, 'u_raw.json'), os.path.join(tmp, 'units.json')
    os.makedirs(out_dir, exist_ok=True)
    run(['node', os.path.join(I18N, 'extract.js'), src, raw])
    d = json.load(open(raw, encoding='utf-8'))
    for u in d['units']:
        u['key'] = hashlib.sha1(u['text'].encode()).hexdigest()[:8]
    json.dump(d, open(units, 'w', encoding='utf-8'))
    outs = {}
    for lang in ('en', 'es'):
        out = os.path.join(out_dir, f'kogge-kontor.{lang}.html')
        print('  ' + run(['node', os.path.join(I18N, 'build2.js'), src, units, out, lang]).strip().split('\n')[0])
        outs[lang] = out
    print('  ' + run(['node', os.path.join(I18N, 'parsecheck.js'), *outs.values()]).strip().replace('\n', '\n  '))
    print('  ' + run([sys.executable, os.path.join(I18N, 'check.py'), '--units', units]).strip().split('\n')[-1])
    return outs


# ───────── Web ─────────
def body_of(page_path, beta):
    s = read(page_path)
    body = s[s.index('<title>'):]
    body, n = re.subn(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts\.(?:googleapis|gstatic)\.com[^>]*>\n?', '', body)
    assert n == 3, f'Google-Fonts-Verweise in {page_path}: {n}'
    body = body.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    assert body.endswith(END), page_path
    if beta:
        body = body.replace('<title>Kogge &amp; Kontor</title>', '<title>Kogge &amp; Kontor Beta</title>', 1)
    return body


def web(pages, out, kind='full', app_url='', build_id=None):
    """kind: 'full' (ganzes Spiel), 'beta' (ganzes Spiel unter /beta/), 'probe' (Probezeit, Hinweis auf die App)"""
    beta = kind == 'beta'
    kopf, fuss, texte = read(os.path.join(WEB, 'kopf.html')), read(os.path.join(WEB, 'fuss.html')), json.load(open(os.path.join(WEB, 'texte.json'), encoding='utf-8'))
    nach = ''
    if kind == 'probe':
        nach = "<script>window.KK_TARGET = 'web';" + (f" window.KK_APP_URL = {json.dumps(app_url)};" if app_url else '') + '</script>\n'
    parts = {}
    for lang, fn in LANGS.items():
        t = texte[lang]
        head = (kopf.replace('@@LANG@@', lang).replace('@@DESC@@', t['desc']).replace('@@VOR@@', BETA_STORE if beta else '')
                .replace('@@NACH@@', nach).replace('@@A@@', '../' if beta else '').replace('@@KURZ@@', 'Kogge Beta' if beta else 'Kogge'))
        parts[lang] = (head, body_of(pages[lang], beta))
    if not build_id:
        build_id = hashlib.sha1(''.join(h + b for h, b in parts.values()).encode()).hexdigest()[:10]
    for lang, (head, body) in parts.items():
        t = texte[lang]
        tail = fuss.replace('@@BUILD@@', build_id).replace('@@NEU@@', t['neu']).replace('@@LADEN@@', t['laden'])
        write(os.path.join(out, LANGS[lang]), head + body[:-len(END)] + tail + END)
    write(os.path.join(out, 'version.txt'), build_id + '\n')
    sw = read(os.path.join(WEB, 'sw.js'))
    if beta:
        core = ['./', 'index.html', 'en.html', 'es.html', 'manifest.webmanifest', '../icon-192.png', '../icon-512.png', '../apple-touch-icon.png']
        sw = (sw.replace('@@CACHE@@', 'kogge-beta-' + build_id).replace('@@OWN@@', "k.startsWith('kogge-beta-')")
              .replace('  @@SKIP@@\n', ''))
    else:
        core = ['./', 'index.html', 'en.html', 'es.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']
        sw = (sw.replace('@@CACHE@@', 'kogge-' + build_id).replace('@@OWN@@', "k.startsWith('kogge-') && !k.startsWith('kogge-beta-')")
              .replace('@@SKIP@@', "if (path.includes('/beta/')) return;   // die Beta hat ihren eigenen Cache"))
    write(os.path.join(out, 'sw.js'), sw.replace('@@CORE@@', json.dumps(core).replace('", "', "', '").replace('["', "['").replace('"]', "']")))
    if beta:
        m = json.load(open(os.path.join(ROOT, 'manifest.webmanifest'), encoding='utf-8'))
        m.update(name='Kogge & Kontor Beta', short_name='Kogge Beta', description='Handelsspiel zur Hansezeit, Testfassung')
        for i in m['icons']:
            i['src'] = '../' + i['src']
        write(os.path.join(out, 'manifest.webmanifest'), json.dumps(m, ensure_ascii=False, indent=2) + '\n')
        write(os.path.join(out, 'README.md'), '# Beta\n\nTestfassung von Kogge & Kontor bis zum Start im App Store. Gebaut mit `python3 tools/build.py` aus `src/`; nicht von Hand ändern.\nSpielstände liegen unter eigenen Schlüsseln (`kogge-kontor-beta-…`) und berühren die Hauptseite nicht.\n')
    if os.path.abspath(out) != ROOT and not beta:   # eigener Ordner: Schriften und Symbole mitnehmen
        for f in ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manifest.webmanifest']:
            shutil.copy(os.path.join(ROOT, f), os.path.join(out, f))
        shutil.copytree(os.path.join(ROOT, 'fonts'), os.path.join(out, 'fonts'), dirs_exist_ok=True)
    return build_id


def same(a, b):
    return os.path.exists(a) and os.path.exists(b) and open(a, 'rb').read() == open(b, 'rb').read()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--haupt', action='store_true')
    ap.add_argument('--probe')
    ap.add_argument('--app-url', default='')
    ap.add_argument('--app', action='store_true')
    ap.add_argument('--build-id')
    a = ap.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        print('Übersetzung')
        tr = translate(SRC, os.path.join(tmp, 'src') if a.check else os.path.join(ROOT, 'src'), tmp)
        pages = {'de': SRC, 'en': tr['en'], 'es': tr['es']}
        beta_out = os.path.join(tmp, 'beta') if a.check else os.path.join(ROOT, 'beta')
        print('Beta', web(pages, beta_out, 'beta', build_id=a.build_id))
        if a.haupt:
            print('Hauptseite', web(pages, os.path.join(tmp, 'haupt') if a.check else ROOT, 'full', build_id=a.build_id))
        if a.probe:
            print('Probe', web(pages, a.probe, 'probe', a.app_url, a.build_id))
        if a.app:
            print(run([sys.executable, os.path.join(ROOT, 'app', 'build_www.py'), SRC]).strip())
        if a.check:
            bad = []
            for lang in ('en', 'es'):
                if not same(tr[lang], os.path.join(ROOT, 'src', f'kogge-kontor.{lang}.html')):
                    bad.append(f'src/kogge-kontor.{lang}.html')
            for f in sorted(os.listdir(beta_out)):
                if not same(os.path.join(beta_out, f), os.path.join(ROOT, 'beta', f)):
                    bad.append('beta/' + f)
            if a.haupt:
                for f in list(LANGS.values()) + ['version.txt', 'sw.js']:
                    if not same(os.path.join(tmp, 'haupt', f), os.path.join(ROOT, f)):
                        bad.append(f)
            if bad:
                print('NICHT AKTUELL: ' + ', '.join(bad))
                print('Bitte `python3 tools/build.py` ausführen und die geänderten Dateien mit einchecken.')
                raise SystemExit(1)
            print('Alle gebauten Dateien sind aktuell.')


if __name__ == '__main__':
    main()

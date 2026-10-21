#!/usr/bin/env python3
"""Baut den Ordner www/ der iPhone-App aus der Spieldatei.

Aufruf: python3 build_www.py ../src/kogge-kontor.html
Danach: npm run native && npx cap sync ios
"""
import os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WWW = os.path.join(HERE, 'www')
FS = os.path.join(HERE, 'node_modules', '@fontsource')
# Schriften und Schnitte, die das Spiel nutzt (wie bisher bei Google Fonts)
FONTS = [('alegreya-sans', ['400', '400-italic', '500', '700']),
         ('alegreya-sans-sc', ['500', '700']),
         ('ibm-plex-mono', ['400', '500']),
         ('unifrakturmaguntia', ['400'])]
SUBSETS = ('latin', 'latin-ext')

HEAD = """<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="format-detection" content="telephone=no">
<style>[hidden]{display:none!important}body{margin:0}html{-webkit-text-size-adjust:100%}
body{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
input,textarea{-webkit-user-select:text;user-select:text}</style>
<link rel="stylesheet" href="fonts/fonts.css">
<script>window.KK_TARGET = 'app';</script>
<script src="native.js"></script>
"""

def fonts():
    out = os.path.join(WWW, 'fonts'); os.makedirs(out, exist_ok=True)
    css = []
    for fam, cuts in FONTS:
        for cut in cuts:
            src = open(os.path.join(FS, fam, cut + '.css'), encoding='utf-8').read()
            for m in re.finditer(r'/\* (\S+) \*/\s*(@font-face \{.*?\})', src, re.S):
                name, block = m.groups()
                if not any(name == f'{fam}-{sub}-{cut.split("-")[0]}-{"italic" if "italic" in cut else "normal"}' for sub in SUBSETS):
                    continue
                f = re.search(r'url\(\./files/([^)]+\.woff2)\)', block).group(1)
                shutil.copy(os.path.join(FS, fam, 'files', f), os.path.join(out, f))
                block = re.sub(r"src: [^;]+;", f"src: url({f}) format('woff2');", block)
                css.append(block)
        shutil.copy(os.path.join(FS, fam, 'LICENSE'), os.path.join(out, f'LICENSE-{fam}.txt'))
    open(os.path.join(out, 'fonts.css'), 'w', encoding='utf-8').write('\n'.join(css) + '\n')
    return len(css)

def page(src_path):
    s = open(src_path, encoding='utf-8').read()
    body = s[s.index('<title>'):]
    # Google Fonts raus, die Schriften liegen in der App
    body, n = re.subn(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts\.(?:googleapis|gstatic)\.com[^>]*>\n?', '', body)
    assert n == 3, n
    assert 'fonts.googleapis' not in body and 'fonts.gstatic' not in body
    open(os.path.join(WWW, 'index.html'), 'w', encoding='utf-8').write(HEAD + body)
    return len(HEAD + body)

if __name__ == '__main__':
    os.makedirs(WWW, exist_ok=True)
    print('Schriften:', fonts(), 'Schnitte')
    print('index.html:', page(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'src', 'kogge-kontor.html')), 'Zeichen')

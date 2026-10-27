"""Prüft Übersetzungen: python3 check.py --units UNITS.json
Platzhalter {n} und {x} gleich, HTML-Tags gleich (Textattribute ausgenommen), nichts fehlt.
Die Übersetzungen kommen aus tr/c*.json ([englisch, spanisch]); Endcode 1 bei Fehlern."""
import json, re, sys, glob, os
HERE=os.path.dirname(os.path.abspath(__file__))
units=sys.argv[sys.argv.index('--units')+1] if '--units' in sys.argv else os.path.join(HERE,'v48_units.json')
U={}
for u in json.load(open(units,encoding='utf-8'))['units']: U[u['key']]=u['text']
TRS={'en':{},'es':{}}
for f in sorted(glob.glob(os.path.join(HERE,'tr','c[0-9]*.json'))):
    for k,v in json.load(open(f,encoding='utf-8')).items(): TRS['en'][k]=v[0]; TRS['es'][k]=v[1]
TXT_ATTR=re.compile(r'\s(aria-label|title|placeholder|alt)="[^"]*"')
def tags(s): return [TXT_ATTR.sub('',t) for t in re.findall(r'<[^>]+>',s)]
def phs(s): return sorted(re.findall(r'\{\d+\}',s))
def toks(s): return sorted(re.findall(r'\{[a-z]+\}',s))
bad=0
for path,T in TRS.items():
    miss=[k for k in U if k not in T]
    print(path,'Einheiten',len(U),'übersetzt',len([k for k in U if k in T]),'fehlend',len(miss))
    for k,src in U.items():
        if k not in T: continue
        t=T[k]
        errs=[]
        if phs(t)!=phs(src): errs.append('Platzhalter')
        if toks(t)!=toks(src): errs.append('Token')
        if tags(t)!=tags(src): errs.append('Tags')
        if src[:1].isspace()!=t[:1].isspace() or src[-1:].isspace()!=t[-1:].isspace(): errs.append('Leerzeichen am Rand')
        if re.search(r'[\u0400-\u04ff\u0370-\u03ff]', t) and not re.search(r'[\u0400-\u04ff\u0370-\u03ff]', src): errs.append('fremde Schrift')
        if errs:
            bad+=1
            if bad<=40: print(' ',k,errs,'|',src[:90].replace('\n',' '),'=>',t[:90].replace('\n',' '))
print('Fehler',bad)
if bad: sys.exit(1)

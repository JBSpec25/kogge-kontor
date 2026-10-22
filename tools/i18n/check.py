"""Prüft Übersetzungen: python3 check.py tr_en.json [tr_es.json]
Platzhalter {n} und {x} gleich, HTML-Tags gleich (Textattribute ausgenommen), nichts fehlt."""
import json, re, sys, glob
U={}
for u in json.load(open('v48_units.json'))['units']: U[u['key']]=u['text']
TXT_ATTR=re.compile(r'\s(aria-label|title|placeholder|alt)="[^"]*"')
def tags(s): return [TXT_ATTR.sub('',t) for t in re.findall(r'<[^>]+>',s)]
def phs(s): return sorted(re.findall(r'\{\d+\}',s))
def toks(s): return sorted(re.findall(r'\{[a-z]+\}',s))
bad=0
for path in sys.argv[1:]:
    T=json.load(open(path,encoding='utf-8'))
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

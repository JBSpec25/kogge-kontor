import json,glob
en,es={},{}
for f in sorted(glob.glob('tr/c[0-9]*.json')):
    for k,v in json.load(open(f)).items(): en[k]=v[0]; es[k]=v[1]
json.dump(en,open('tr_en.json','w'),ensure_ascii=False); json.dump(es,open('tr_es.json','w'),ensure_ascii=False)
print(len(en))

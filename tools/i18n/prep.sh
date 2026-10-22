# prep.sh SPIEL.html NAME  -> NAME_units.json mit Schlüsseln
node extract.js "$1" /tmp/claude-0/u_raw.json >/dev/null && python3 - "$2" <<'P'
import json, hashlib, sys
d=json.load(open('/tmp/claude-0/u_raw.json'))
for u in d['units']: u['key']=hashlib.sha1(u['text'].encode()).hexdigest()[:8]
json.dump(d,open(sys.argv[1]+'_units.json','w'))
P

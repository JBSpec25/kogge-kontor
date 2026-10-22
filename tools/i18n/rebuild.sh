set -e
cd /home/claude/i18n
bash prep.sh /home/claude/kk/v48.html v48
bash prep.sh /home/claude/kk/test48.html test48
python3 merge.py >/dev/null
python3 check.py tr_en.json tr_es.json | tail -3
for L in en es; do node build2.js /home/claude/kk/v48.html v48_units.json /home/claude/kk/v48_$L.html $L; node build2.js /home/claude/kk/test48.html test48_units.json /home/claude/kk/test48_$L.html $L; done
node parsecheck.js /home/claude/kk/v48_en.html /home/claude/kk/v48_es.html /home/claude/kk/test48_en.html /home/claude/kk/test48_es.html

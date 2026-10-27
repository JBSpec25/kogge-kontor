// Stadtbilder zum Durchsehen: jede Stadt neu, halb und voll ausgebaut, auf Wunsch im Winter.
//
//   node tools/test/stadtbilder.js [SPIEL.html] [--staedte luebeck,riga] [--stufen neu,halb,voll] [--jahreszeiten fruehling,sommer,herbst,winter] [--breite 1240] [--aus tools/out/stadt]
//
// Zeichnet mit derselben Zeichenmaschine wie das Spiel (G36.cityBase), ohne das Spiel zu starten. Die Stufen gelten für den
// Stammsitz; jede Stadt wird als Stammsitz gezeichnet, dazu einmal als fremder Hafen mit Niederlassung („fremd“).
const fs = require('fs'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { ({chromium} = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const ROOT = path.resolve(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = process.argv[2] && !process.argv[2].startsWith('--') ? path.resolve(process.argv[2]) : path.join(ROOT, 'src', 'kogge-kontor.html');
const OUT = path.resolve(arg('--aus', path.join(ROOT, 'tools', 'out', 'stadt')));
const ALL = ['luebeck', 'hamburg', 'bremen', 'danzig', 'riga', 'reval', 'visby', 'stockholm', 'bruegge', 'london', 'bergen', 'nowgorod'];
const STAEDTE = arg('--staedte', ALL.join(',')).split(',');
const STUFEN = arg('--stufen', 'neu,halb,voll,fremd').split(',');
const ZEITEN = arg('--jahreszeiten', process.argv.includes('--winter') ? 'winter' : 'sommer').split(','), W = +arg('--breite', 1240), H = Math.round(W / 1.55);
// Bauplätze je Stufe (wie cityPlots im Spiel)
const PLOTS = {
  neu:{kontor:null, kontorLvl:1, haus:'built', hausLvl:1, hausF:0, w0:{s:'lock'}, w1:{s:'lock'}, w2:{s:'lock'}, w3:{s:'lock'}, w4:{s:'lock'}, kran:null, markt:null, kirche:null, mauer:null},
  halb:{kontor:'built', kontorLvl:1, haus:'built', hausLvl:2, hausF:0, w0:{s:'built', g:'bier'}, w1:{s:'job', f:0.4}, w2:{s:'free'}, w3:{s:'lock'}, w4:{s:'lock'}, kran:'job', kranF:0.6, markt:null, kirche:null, mauer:null,
    fam:4, gv:{hospital:'job'}},
  voll:{kontor:'built', kontorLvl:2, haus:'built', hausLvl:3, hausF:0, w0:{s:'built', g:'bier'}, w1:{s:'built', g:'tuch'}, w2:{s:'built', g:'salz'}, w3:{s:'built', g:'holz'}, w4:{s:'built', g:'fass'}, kran:'built', markt:'built', kirche:'built', mauer:'built',
    fam:12, gv:{hospital:'built', hafen:'built', artushof:'built', turm:'built'}}
};
// Hausfarbe (kräftige Fassung von „Taube“) und Hausmarke 2 für die Probebilder
const HOUSE = {hc:arg('--farbe', '#4f7896'), mark:'M20 4V36M20 36L12 28M20 36L28 28M13 14H27'};
(async () => {
  let s = fs.readFileSync(SRC, 'utf8');
  const anchor = '  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {';
  if (!s.includes(anchor)) throw new Error('Anker nicht gefunden');
  s = s.replace(anchor, '  window.__kk = {G36, Plans36, K36};\n' + anchor);
  fs.mkdirSync(OUT, {recursive:true});
  const tmp = path.join(OUT, '_spiel.html'); fs.writeFileSync(tmp, s);
  const b = await chromium.launch(), p = await b.newPage({viewport:{width:400, height:300}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + tmp); await p.waitForFunction(() => !!window.__kk, null, {timeout:20000});
  for (const cid of STAEDTE) for (const stufe of STUFEN) for (const season of ZEITEN) {
    const url = await p.evaluate(({cid, stufe, plots, W, H, season, house}) => {
      const {G36} = window.__kk, home = stufe !== 'fremd';
      const base = G36.cityBase({cid, plots:home ? plots : null, branch:!home, W, H, dpr:1, winter:season === 'winter', season, house});
      const cv = document.createElement('canvas');
      G36.show(cv, {base, ships:[{type:'kogge'}, {type:'holk'}], still:true});
      return cv.toDataURL('image/png');
    }, {cid, stufe, plots:PLOTS[stufe] || null, W, H, season, house:HOUSE});
    const f = path.join(OUT, `${cid}_${stufe}${season === 'sommer' ? '' : '_' + season}.png`);
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    process.stdout.write(path.relative(ROOT, f) + '\n');
  }
  await b.close(); fs.unlinkSync(tmp);
  if (errs.length) { console.error('Fehler:', errs.join('\n')); process.exitCode = 1; }
})();

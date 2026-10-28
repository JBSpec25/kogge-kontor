// Prüfmodus für die Stadtbilder (ab Version 50): baut jede Stadt als Stammsitz (neu, halb, voll) und als fremden Hafen
// und prüft, was man beim Ansehen nicht übersehen soll.
//
//   node tools/test/stadtpruefung.js [SPIEL.html] [--staedte luebeck,riga] [--ausfuehrlich]
//
// Geprüft wird:
//   Wasser     kein Bau steht über Wasser (außer Schiffen, den Häusern auf der London Bridge, Brügges Wasserhalle, Kränen und dem Krantor)
//   Mauer      jedes Ende eines Mauerstücks stößt an ein anderes Stück, einen Turm oder ein Tor; kein Stück läuft durch einen Turm
//   Boden      alles steht auf dem Boden, auf einer Terrasse (Domberg, St Paul's) oder in Visby auf dem Hang
//   Viertel    in einem neuen Spiel steht im Viertel nur dein Haus (dazu Pflöcke, Schild und Bäume)
//   Stadt      Häuser und Bäume der Stadt bleiben an ihrem Platz, während du baust
//   Antippen   jeder Bauplatz und jedes große Vorhaben ist zu mindestens 30 % sichtbar und lässt sich antippen
// Bei einem Befund endet das Skript mit Fehlercode 1.
const fs = require('fs'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { ({chromium} = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const ROOT = path.resolve(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = process.argv[2] && !process.argv[2].startsWith('--') ? path.resolve(process.argv[2]) : path.join(ROOT, 'src', 'kogge-kontor.html');
const ALL = ['luebeck', 'hamburg', 'bremen', 'danzig', 'riga', 'reval', 'visby', 'stockholm', 'bruegge', 'london', 'bergen', 'nowgorod'];
const STAEDTE = arg('--staedte', ALL.join(',')).split(',');
const LAUT = process.argv.includes('--ausfuehrlich');
// Bauplätze je Stufe wie in tools/test/stadtbilder.js
const PLOTS = {
  neu:{kontor:null, kontorLvl:1, haus:'built', hausLvl:1, hausF:0, w0:{s:'lock'}, w1:{s:'lock'}, w2:{s:'lock'}, w3:{s:'lock'}, w4:{s:'lock'}, kran:null, markt:null, kirche:null, mauer:null, fam:0, gv:{}},
  halb:{kontor:'built', kontorLvl:1, haus:'built', hausLvl:2, hausF:0, w0:{s:'built', g:'bier'}, w1:{s:'job', f:0.4}, w2:{s:'free'}, w3:{s:'lock'}, w4:{s:'lock'}, kran:'job', kranF:0.6, markt:'job', marktF:0.4, kirche:null, mauer:null,
    fam:4, gv:{hospital:'job'}},
  voll:{kontor:'built', kontorLvl:2, haus:'built', hausLvl:3, hausF:0, w0:{s:'built', g:'bier'}, w1:{s:'built', g:'tuch'}, w2:{s:'built', g:'salz'}, w3:{s:'built', g:'holz'}, w4:{s:'built', g:'fass'}, kran:'built', markt:'built', kirche:'built', mauer:'built',
    fam:12, gv:{hospital:'built', hafen:'built', artushof:'built', turm:'built', flotte:'built'}},
  vorhaben:{kontor:'built', kontorLvl:2, haus:'built', hausLvl:3, hausF:0, w0:{s:'built', g:'bier'}, w1:{s:'built', g:'tuch'}, w2:{s:'open'}, w3:{s:'free'}, w4:{s:'lock'}, kran:'built', markt:'built', kirche:'job', kircheF:0.6, mauer:'job', mauerF:0.2,
    fam:9, gv:{hospital:'built', hafen:'job', turm:'job'}}
};
const HOUSE = {hc:'#4f7896', mark:'M20 4V36M20 36L12 28M20 36L28 28M13 14H27'};
(async () => {
  let s = fs.readFileSync(SRC, 'utf8');
  const anchor = '  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {';
  if (!s.includes(anchor)) throw new Error('Anker nicht gefunden');
  s = s.replace(anchor, '  window.__kk = {G36, Plans36, K36};\n' + anchor);
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'kk-pruef-')), tmp = path.join(tmpDir, 'spiel.html');
  fs.writeFileSync(tmp, s);
  const b = await chromium.launch(), p = await b.newPage({viewport:{width:400, height:300}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + tmp); await p.waitForFunction(() => !!window.__kk, null, {timeout:20000});
  const res = await p.evaluate(({STAEDTE, PLOTS, HOUSE}) => {
    const {G36, Plans36, K36} = window.__kk, out = [];
    const VQ = [212, 16, 268, 92], QAREA = [210, -2, 274, 135];
    const inR = (q, r) => q[0] >= r[0] && q[0] <= r[2] && q[1] >= r[1] && q[1] <= r[3];
    const ctr = f => [(f[0] + f[2]) / 2, (f[1] + f[3]) / 2];
    for (const cid of STAEDTE) {
      const sigs = {};
      for (const stufe of ['neu', 'halb', 'voll', 'vorhaben', 'fremd']) {
        const home = stufe !== 'fremd', plots = home ? PLOTS[stufe] : null, tag = `${cid} ${stufe}`;
        const bad = (art, txt) => out.push({cid, stufe, art, txt});
        const sc = Plans36.build(cid, {plots, branch:!home, house:HOUSE});
        const G = sc.ground, O = sc.objs;
        // ── Wasser ──
        const wet = (x, y) => { let w = false;
          for (const g of G) {
            if (g.t === 'water') { if (g.rect ? x > g.rect[0] && x < g.rect[2] && y > g.rect[1] && y < g.rect[3] : K36.inPoly([x, y], g.pts)) w = true; }
            else if (g.t === 'canal') { if (x > g.rect[0] && x < g.rect[2] && y > g.rect[1] && y < g.rect[3]) w = true; }
            else if ((g.t === 'land' || g.t === 'kai') && g.pts && K36.inPoly([x, y], g.pts)) w = false;
          }
          return w; };
        const okWater = o => o.t === 'ship' || o.t === 'bridgeHouses' || o.t === 'crane' || o.t === 'krantor' || ((o.t === 'halle' || o.plot === 'markt') && cid === 'bruegge');
        O.forEach(o => { if (okWater(o)) return; const f = K36.foot(o); if (!f) return;
          let n = 0, w = 0; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { n++; if (wet(f[0] + (f[2] - f[0]) * (0.1 + 0.2 * i), f[1] + (f[3] - f[1]) * (0.1 + 0.2 * j))) w++; }
          if (w / n > 0.15) bad('Wasser', `${o.t} bei ${ctr(f).map(v => v.toFixed(0))} steht zu ${Math.round(w / n * 100)} % über Wasser`); });
        // ── Mauer ──
        const walls = O.filter(o => o.t === 'wallS' && o.ctr), obs = O.filter(o => o.t === 'tower' || o.t === 'gate' || o.t === 'gateTower');
        const inside = (q, o, tol) => {
          if (o.t === 'tower' && o.kind === 'round') return Math.hypot(q[0] - o.x, q[1] - o.y) <= o.r + tol;
          if (o.t === 'tower') { const a = -(o.rot || 0), dx = q[0] - o.x, dy = q[1] - o.y, lx = Math.cos(a) * dx - Math.sin(a) * dy, ly = Math.sin(a) * dx + Math.cos(a) * dy; return Math.abs(lx) <= o.r + tol && Math.abs(ly) <= o.r + tol; }
          const f = K36.foot(o); return q[0] >= f[0] - tol && q[0] <= f[2] + tol && q[1] >= f[1] - tol && q[1] <= f[3] + tol; };
        walls.forEach(w => {
          [w.a, w.b].forEach(e => { const joined = walls.some(v => v !== w && (Math.hypot(v.a[0] - e[0], v.a[1] - e[1]) < 0.05 || Math.hypot(v.b[0] - e[0], v.b[1] - e[1]) < 0.05)) || obs.some(o => inside(e, o, 0.35));
            if (!joined) bad('Mauer', `freies Mauerende bei ${e.map(v => v.toFixed(1))}`); });
          const m = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2], hit = obs.find(o => inside(m, o, -0.3));
          if (hit) bad('Mauer', `Mauerstück bei ${m.map(v => v.toFixed(1))} läuft durch ${hit.t}`); });
        // ── Boden ──
        const SL = sc.slope, zAt = (x, y) => SL ? Math.max(0, Math.min(SL.max, (y - SL.y0) * SL.k)) : 0;
        const plats = O.filter(o => o.t === 'platform');
        O.forEach(o => { if (o.t === 'wallS') { if (SL && (Math.abs((o.za || 0) - zAt(...o.a)) > 0.6 || Math.abs((o.zb || 0) - zAt(...o.b)) > 0.6)) bad('Boden', `Mauerstück bei ${o.a.map(v => v.toFixed(0))} schwebt`); return; }
          if (o.t === 'ship' || o.t === 'platform') return; const f = K36.foot(o); if (!f) return;
          const z = o.z || 0, c = ctr(f), ground = zAt(c[0], f[1]), plat = plats.find(q => c[0] >= q.x && c[0] <= q.x + q.w && c[1] >= q.y && c[1] <= q.y + q.d);
          const want = ground + (plat && Math.abs(z - ground - plat.h) < 0.05 ? plat.h : 0);
          if (Math.abs(z - want) > 0.05) bad('Boden', `${o.t} bei ${c.map(v => v.toFixed(0))} steht auf ${z.toFixed(1)} m statt ${want.toFixed(1)} m`); });
        // ── Verschneidung: feste Bauten überlappen sich nicht, keine Mauer läuft durch ein Gebäude ──
        const SOLID = new Set(['house', 'church', 'rathaus', 'halle', 'stalls', 'tower', 'castle', 'ruin', 'belfry', 'crane', 'krantor', 'gate', 'gateTower', 'roland', 'well', 'shed', 'work', 'woodpile', 'mill', 'sophia', 'scaffold', 'sign']);
        const sol = O.filter(o => SOLID.has(o.t) && !o.noWalls).map(o => ({o, f:K36.foot(o)})).filter(q => q.f);
        for (let i = 0; i < sol.length; i++) for (let j = i + 1; j < sol.length; j++) { const A = sol[i], B = sol[j], a = A.f, c = B.f;
          const ox = Math.min(a[2], c[2]) - Math.max(a[0], c[0]), oy = Math.min(a[3], c[3]) - Math.max(a[1], c[1]);
          if (ox <= 0.4 || oy <= 0.4 || ox * oy <= 1) continue;
          if ((A.o.t === 'scaffold' || B.o.t === 'scaffold') && A.o.plot && A.o.plot === B.o.plot) continue;
          if (A.o.t === 'tower' && B.o.t === 'tower') continue;
          bad('Verschneidung', `${A.o.t} bei ${ctr(a).map(v => v.toFixed(0))} und ${B.o.t} bei ${ctr(c).map(v => v.toFixed(0))} überlappen ${ox.toFixed(1)} × ${oy.toFixed(1)} m`); }
        O.filter(o => o.t === 'wallS').forEach(w => { for (let q = 1; q < 5; q++) { const t = q / 5, pt = [w.a[0] + (w.b[0] - w.a[0]) * t, w.a[1] + (w.b[1] - w.a[1]) * t];
          const hit = sol.find(({o, f}) => o.t !== 'tower' && o.t !== 'gate' && o.t !== 'gateTower' && pt[0] > f[0] + 0.3 && pt[0] < f[2] - 0.3 && pt[1] > f[1] + 0.3 && pt[1] < f[3] - 0.3);
          if (hit) { bad('Verschneidung', `Mauer bei ${pt.map(v => v.toFixed(0))} läuft durch ${hit.o.t}`); break; } } });
        // ── Viertel im neuen Spiel ──
        if (stufe === 'neu') O.forEach(o => { const f = K36.foot(o); if (!f || !inR(ctr(f), VQ)) return;
          if (!['stake', 'sign', 'tree'].includes(o.t) && !(o.t === 'house' && o.plot === 'haus')) bad('Viertel', `im neuen Spiel steht ${o.t} bei ${ctr(f).map(v => v.toFixed(0))}`); });
        // ── Stadt bleibt beim Bauen gleich ──
        if (home) sigs[stufe] = O.filter(o => (o.t === 'house' || o.t === 'tree') && !o.plot && !o.hc).map(o => { const f = K36.foot(o); return f && !inR(ctr(f), QAREA) ? `${o.t}@${o.x.toFixed(2)},${o.y.toFixed(2)}` : null; }).filter(Boolean).sort().join(';');
        // ── Antippen ──
        if (home) {
          const base = G36.cityBase({cid, plots, W:1240, H:800, dpr:1, season:'sommer', house:HOUSE, hulls:true}), H = base.R.hulls, hits = base.R.hits;
          Object.keys(hits).forEach(k => {
            let last = -1; H.forEach((h, i) => { if (h.plot === k) last = i; });
            const poly = hits[k], xs = poly.map(q => q[0]), ys = poly.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
            const pts = []; for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) { const q = [x0 + (x1 - x0) * i / 16, y0 + (y1 - y0) * j / 16]; if (K36.inPoly(q, poly)) pts.push(q); }
            const free = pts.filter(q => !H.some((h, i) => i > last && h.plot !== k && h.t !== 'tree' && !h.see && K36.inPoly(q, h.hull)));
            const vis = pts.length ? free.length / pts.length : 0;
            if (vis < 0.3) bad('Antippen', `${k} nur zu ${Math.round(vis * 100)} % sichtbar`);
            if (free.length) { const cx = free.reduce((a, q) => a + q[0], 0) / free.length, cy = free.reduce((a, q) => a + q[1], 0) / free.length;
              const q = free.reduce((a, q) => Math.hypot(q[0] - cx, q[1] - cy) < Math.hypot(a[0] - cx, a[1] - cy) ? q : a, free[0]), got = G36.pick(base, q[0], q[1]);
              if (got !== k) bad('Antippen', `Tippen auf ${k} trifft ${got || 'nichts'}`); }
          });
        }
      }
      ['halb', 'voll', 'vorhaben'].forEach(sx => { if (sigs[sx] !== sigs.neu) { const a = new Set(sigs.neu.split(';')), b = new Set(sigs[sx].split(';')), gone = [...a].filter(x => !b.has(x)), come = [...b].filter(x => !a.has(x));
        out.push({cid, stufe:sx, art:'Stadt', txt:`gegenüber „neu“ ${gone.length} Häuser oder Bäume weg, ${come.length} neu (z. B. ${(gone[0] || come[0])})`}); } });
    }
    return out;
  }, {STAEDTE, PLOTS, HOUSE});
  await b.close(); fs.rmSync(tmpDir, {recursive:true, force:true});
  const by = {}; res.forEach(r => { const k = `${r.cid} · ${r.stufe} · ${r.art}`; (by[k] = by[k] || []).push(r.txt); });
  Object.entries(by).forEach(([k, v]) => { console.log(`✗ ${k}: ${v.length} Befund${v.length === 1 ? '' : 'e'}`); (LAUT ? v : v.slice(0, 3)).forEach(t => console.log('    ' + t)); });
  if (errs.length) console.error('Fehler im Spiel:', errs.join('\n'));
  console.log(res.length ? `${res.length} Befunde in ${STAEDTE.length} Städten` : `Stadtbilder ohne Befund (${STAEDTE.length} Städte, je 5 Stufen)`);
  if (res.length || errs.length) process.exitCode = 1;
})();

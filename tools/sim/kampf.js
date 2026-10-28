// Kampfquoten je Kampfstufe (ab Version 51). Der Bot „mensch“ spielt sich mehrmals bis zu einem Spieltag hoch; von jedem dieser
// Spielstände aus laufen viele Gefechte je Stufe, einmal mit Juliens Können („gut“) und einmal so, wie ein Kapitän entscheidet („ordentlich“).
//
//   node tools/sim/kampf.js SIM.html [--tage 400,1100,1800] [--staende 8] [--n 30] [--stammsitz riga] [--verbaende] [--json AUS.json]
//
// Ziel (Roadmap): leicht mindestens 95 % Siege, mittel etwa 80 %, schwer 50 bis 60 %; der Kapitän jeweils 10 bis 15 Punkte darunter;
// Seeräuberverbände über „schwer“, gegen Störtebeker 30 bis 40 %. Im Nahkampf wählt der beste Bot jeden Befehl in 25 bis 45 % der Runden.
// SIM.html baut tools/sim/mksim.py.
const fs = require('fs'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { ({chromium} = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SIM = path.resolve(process.argv[2]);
const TAGE = arg('--tage', '400,1100,1800').split(',').map(Number), M = +arg('--staende', 8), N = +arg('--n', 30), HOME = arg('--stammsitz', 'riga');
const PFS = (arg('--pf', '') || 'stoertebeker,michels,wigbold,wichmann,scheld').split(',');
const ROWS = [[0, 'leicht'], [1, 'mittel'], [2, 'schwer']].concat(process.argv.includes('--verbaende') ? PFS.map(p => ['v:' + p, p]) : []);
const pc = (a, b) => b ? `${Math.round(a / b * 100)} %`.padStart(5) : '   – ';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('Seitenfehler:', e.message));
  await page.goto('file://' + SIM); await page.waitForTimeout(500);
  const all = [];
  for (const tage of TAGE) {
    const sum = {}, heads = [];
    for (let m = 0; m < M; m++) {
      const r = await page.evaluate(o => { localStorage.clear(); window.__bot.run(o.run); const out = {};
        for (const [t] of o.rows) { const pf = String(t).startsWith('v:') ? String(t).slice(2) : null; Object.assign(out, Object.fromEntries(Object.entries(window.__bot.kampf({n:o.n, tiers:[pf ? 'v' : t], pf}).out).map(([k, v]) => [`${t}_${k.split('_')[1]}`, v]))); }
        const k = window.__bot.kampf({n:0, tiers:[]}); return {head:`R${k.rank} ${k.crew} Leute`, out}; },
        {run:{days:tage, home:HOME, skill:'gut', mutig:true, repBias:0.12}, n:N, rows:ROWS});
      heads.push(r.head);
      for (const [k, R] of Object.entries(r.out)) { const S = sum[k] || (sum[k] = {n:0, won:0, lost:0, escaped:0, bd:{storm:0, shoot:0, hold:0}}); S.n += R.n; S.won += R.won; S.lost += R.lost; S.escaped += R.escaped; for (const c in R.bd) S.bd[c] += R.bd[c]; }
    }
    all.push({tage, heads, sum});
    console.log(`\nTag ${tage}: ${heads.join(' | ')}`);
    console.log('Gegner         Können      Siege  verloren  ohne Ausgang   Nahkampf Stürmen / Schießen / Halten');
    for (const [t, name] of ROWS) for (const s of ['gut', 'ordentlich']) {
      const R = sum[`${t}_${s}`]; if (!R) continue; const bd = R.bd.storm + R.bd.shoot + R.bd.hold;
      console.log(`${name.padEnd(14)} ${s.padEnd(11)} ${pc(R.won, R.n)}  ${pc(R.lost, R.n)}     ${pc(R.escaped, R.n)}        ${bd ? [R.bd.storm, R.bd.shoot, R.bd.hold].map(x => pc(x, bd)).join(' / ') : '–'}`);
    }
  }
  await browser.close();
  const out = arg('--json'); if (out) fs.writeFileSync(out, JSON.stringify(all, null, 1));
})();

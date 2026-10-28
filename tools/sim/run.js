// Langzeitsimulation mit dem Spieler-Bot: mehrere Spiele, Meilensteine als Median der Spieltage.
//
//   node tools/sim/run.js SIM.html [--spiele 12] [--tage 1460] [--profil mensch|bot45] [--json AUS.json]
//
// SIM.html baut tools/sim/mksim.py. Profile: „bot45“ wie die Simulation von Version 45 (zielt ordentlich, flieht oft),
// „mensch“ wie ein geübter Spieler (zielt wie Julien, kämpft, verkauft im Stammsitz für Ansehen).
const fs = require('fs'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { ({chromium} = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SIM = path.resolve(process.argv[2]);
const SPIELE = +arg('--spiele', 12), TAGE = +arg('--tage', 1460), PROFIL = arg('--profil', 'mensch'), HOME = arg('--stammsitz', 'luebeck');
const PROFILE = {
  bot45: {skill:'ordentlich'},
  mensch: {skill:'gut', mutig:true, repBias:0.12}
};
const MARKS = [['rank1', 'Händler'], ['rank2', 'Kaufmann'], ['civic1', 'Bürger'], ['civic2', 'Gildebruder'], ['niederlassung', 'Niederlassung'], ['betrieb', 'erster Betrieb'], ['rank3', 'Fernhändler'], ['civic3', 'Ratsherr'], ['verband', 'erster Verband'], ['rank4', 'Großkaufmann'], ['buergermeister', 'Bürgermeister'], ['rank5', 'Handelsherr'], ['aeltermann', 'Ältermann'], ['aeltermann_gegner', 'Gegner Ältermann'], ['rank6', 'Patrizier']];
const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('Seitenfehler:', e.message));
  await page.goto('file://' + SIM); await page.waitForTimeout(500);
  const runs = [];
  for (let i = 0; i < SPIELE; i++) {
    const r = await page.evaluate(o => { localStorage.clear(); return window.__bot.run(o); }, Object.assign({days:TAGE, home:HOME}, PROFILE[PROFIL]));
    runs.push(r);
    process.stderr.write(`Spiel ${i + 1}: ${r.days} Tage, Vermögen ${r.wealth}, Rang ${r.rank}, ${r.ms} ms${r.bankrupt ? ', Bankrott' : ''}\n`);
  }
  await browser.close();
  const tab = MARKS.map(([k, n]) => { const xs = runs.map(r => r.marks[k]); return {k, n, median:med(xs), erreicht:xs.filter(x => x != null).length}; });
  console.log(`\nProfil ${PROFIL}, ${SPIELE} Spiele à ${TAGE} Tage, Stammsitz ${HOME}`);
  tab.forEach(t => console.log(`${t.n.padEnd(16)} ${t.median == null ? '–' : String(t.median).padStart(5) + ' Tage'}   (${t.erreicht}/${SPIELE})`));
  console.log(`Vermögen am Ende (Median) ${med(runs.map(r => r.wealth))}`);
  const out = arg('--json'); if (out) fs.writeFileSync(out, JSON.stringify({profil:PROFIL, spiele:SPIELE, tage:TAGE, tab, runs:runs.map(r => ({score:r.score, marks:r.marks, wealth:r.wealth, rank:r.rank, bankrupt:r.bankrupt, use:r.use, series:r.series}))}, null, 1));
})();

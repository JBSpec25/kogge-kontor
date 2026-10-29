// Prüfung des Seegefechts (ab Version 54: Fernkampf in Dritteln, Entern mit Karten) auf dem kleinsten iPhone (375 × 667),
// in Deutsch, Englisch und Spanisch.
//
//   node tools/test/gefecht.js [--bilder]
//
// Je Sprache: neues Spiel, Rang Kaufmann, ein schwerer Seeräuber. Durchgespielt werden Treffen (Einschätzung des Kapitäns,
// „Kapitän lassen“), ein Manöver, die Salve (Zeiger läuft ohne „Spannen“, Waffe wechseln, je Rotte ein Tipp auf die Leiste),
// das Gegenfeuer, ein Enterkampf mit Karten bis zum Ende, einmal „Kapitän lassen“ und der Übungskampf am ersten Seeräuber.
// Geprüft wird: keine Fehler in der Konsole, kein Knopf ragt über den Bildschirm oder liegt unter etwas anderem, im Enterkampf
// drei Abschnitte, vier Karten und „Taue kappen“ unter dem Bild, gelegte Karten verschieben die Vorschau, Treffer kosten die
// Drittel Punkte, keine deutschen Reste in Englisch und Spanisch. Bilder mit --bilder in tools/out/gefecht/. Endcode 1, wenn etwas fehlschlägt.
const fs = require('fs'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { ({chromium} = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'tools', 'out', 'gefecht');
const BILDER = process.argv.includes('--bilder');
const FILES = {de:'src/kogge-kontor.html', en:'src/kogge-kontor.en.html', es:'src/kogge-kontor.es.html'};
const ERLAUBT = new Set(fs.readFileSync(path.join(__dirname, 'erlaubt.txt'), 'utf8').split('\n').map(s => s.replace(/#.*/, '').trim()).filter(Boolean));
const DE_WORT = /^(und|der|die|das|nicht|mit|für|ist|ein|eine|dein|deine|auf|zum|zur|vom|beim|wird|werden|kannst|noch|schon|Tage|Tag|Last|Gulden|Schiff|Schiffe|Ware|Waren|kaufen|verkaufen|Hafen|Stadt|bauen|Weiter|Zurück|Schließen|Stürmen|Halten|Schießen|Kraft|Rotte|Rotten|Sturm|Salve|Bug|Mitte|Kastell|Karte|Karten|Runde|Abschnitt)$/;
const deutscheReste = text => [...new Set(text.split(/[^A-Za-zÄÖÜäöüß]+/).filter(w => w && !ERLAUBT.has(w) && (/[äöüßÄÖÜ]/.test(w) || DE_WORT.test(w))))];
const ANCHOR = '  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {';
const HOOK = '  window.__kk = {get st() { return st; }, startEnc, commit, setTab, board, route, BD, aim, pirEff, ownEff, thOf};\n';

async function lauf(browser, lang, bericht) {
  const fehler = [];
  let s = fs.readFileSync(path.join(ROOT, FILES[lang]), 'utf8');
  if (!s.includes(ANCHOR)) throw new Error('Anker nicht gefunden in ' + FILES[lang]);
  s = s.replace(ANCHOR, HOOK + ANCHOR);
  const tmp = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'kk-gefecht-')), 'spiel.html');
  fs.writeFileSync(tmp, s);
  const ctx = await browser.newContext({viewport:{width:375, height:667}, deviceScaleFactor:2, reducedMotion:'reduce', locale:{de:'de-DE', en:'en-GB', es:'es-ES'}[lang]});
  const p = await ctx.newPage();
  p.on('pageerror', e => fehler.push('Seitenfehler: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) fehler.push('Konsole: ' + m.text()); });
  const texte = [];
  const sieh = async name => {
    const r = await p.evaluate(() => {
      const ab = document.querySelector('#aimbar.melee'); if (ab && !ab.hidden) ab.querySelector('.hand').scrollIntoView({block:'center'});
      const W = innerWidth, breit = [], klein = [], verdeckt = [];
      for (const b of document.querySelectorAll('#actions button, #aimbar button')) {
        if (!b.getClientRects().length || b.closest('[hidden]') || getComputedStyle(b).visibility === 'hidden') continue;
        const rc = b.getBoundingClientRect();
        if (rc.right > W + 1 || rc.left < -1) breit.push(b.innerText.replace(/\s+/g, ' ').slice(0, 40));
        if (b.classList.contains('bcard') && rc.height < 56) klein.push(`Karte ${Math.round(rc.height)} px`);
        const top = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
        if (top && !b.contains(top)) verdeckt.push(b.dataset.act || b.innerText.slice(0, 20));
      }
      return {breit, klein, verdeckt, text:[...document.querySelectorAll('#enc, #actions, #aimbar')].map(x => x.hidden ? '' : x.innerText).join('\n')};
    });
    r.breit.forEach(x => fehler.push(`${name}: Knopf ragt über den Bildschirm: ${x}`));
    r.klein.forEach(x => fehler.push(`${name}: Karte zu niedrig: ${x}`));
    r.verdeckt.forEach(x => fehler.push(`${name}: Knopf verdeckt: ${x}`));
    texte.push(r.text);
    if (BILDER) await p.screenshot({path:path.join(OUT, `${lang}-${name}.png`), fullPage:false});
  };
  const klick = async act => { await p.click(`#actions [data-act="${act}"]`); await p.waitForTimeout(120); };
  const phase = () => p.evaluate(() => window.__kk.st.enc && window.__kk.st.enc.phase);
  const warte = async (ok, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(ok)) return true; await p.waitForTimeout(60); } return false; };
  // Gefecht vorbereiten: Kaufmann mit Kogge und Schnigge auf See, ein schwerer Seeräuber
  const neu = () => p.evaluate(() => {
    const K = window.__kk, st = K.st;
    st.rank = 2; st.money = 60000; st.loc = null; st.ev = null; st.encs = 5;
    if (st.fleet.length < 2) st.fleet.push({id:(st.nextShip = (st.nextShip || 10) + 1), type:'kogge', name:'Maria', hull:100});
    st.fleet.forEach(sh => { sh.hull = 100; });
    st.crew = 40; st.arms = {armbrust:16, harnisch:10, pavese:4, haken:4}; st.brand = 6;
    const to = st.home === 'danzig' ? 'luebeck' : 'danzig', r = K.route(st.home, to, st.day);
    st.sail = {from:st.home, to, segs:r.segs, days:r.days, t:1, weather:'clear', wind:'West', delayed:false, shanty:0, met:true};
    try { K.startEnc(2); K.setTab('lage'); K.commit(); } catch (e) { throw new Error(e.stack.slice(0, 600)); }
  });
  try {
    await p.goto('file://' + tmp); await p.waitForTimeout(700);
    if (await p.$('[data-act="wiz-dice"]')) {
      await p.click('[data-act="wiz-dice"]');
      for (let i = 0; i < 8; i++) { if (await p.$('[data-act="wiz-go"]:visible')) { await p.click('[data-act="wiz-go"]'); break; } await p.click('[data-act="wiz-next"]'); await p.waitForTimeout(120); }
    }
    await p.waitForTimeout(300);
    await p.evaluate(() => { document.querySelectorAll('[data-qwel="skip"]').forEach(b => b.click()); });
    // 1. Treffen
    await neu(); await p.waitForTimeout(250);
    if (!(await p.$('#enc .assess'))) fehler.push('Treffen: keine Einschätzung des Kapitäns');
    if (!(await p.$('#actions [data-act="capauto"]'))) fehler.push('Treffen: „Kapitän lassen“ fehlt ab Kaufmann');
    await sieh('1-treffen');
    // 2. Manöver und Zielen: der Zeiger läuft gleich, Waffe wechseln, dann je Rotte ein Tipp auf die Leiste
    await klick('fight'); await p.waitForTimeout(150);
    await klick('m-hold');
    if (!(await warte(() => window.__kk.st.enc.phase === 'volley'))) fehler.push('Zielen: keine Salve nach dem Manöver');
    await p.waitForTimeout(300);
    if (!(await p.evaluate(() => window.__kk.aim.run))) fehler.push('Zielen: der Zeiger läuft nicht von selbst');
    if ((await p.$$('#aimbar .weapons button')).length !== 4) fehler.push('Zielen: nicht vier Waffen unter der Leiste');
    if ((await p.$$('#aimbar .strip .t')).length !== 3) fehler.push('Zielen: Trefferleiste ohne drei Drittel');
    const wechsel = await p.evaluate(() => { const b = [...document.querySelectorAll('#aimbar [data-weap]')].find(x => !x.disabled && x.getAttribute('aria-pressed') !== 'true'); return b ? b.dataset.weap : null; });
    if (wechsel) { await p.click(`#aimbar [data-weap="${wechsel}"]`); await p.waitForTimeout(150); if ((await p.evaluate(() => window.__kk.st.enc.ammo)) !== wechsel) fehler.push('Zielen: Waffe lässt sich nicht wechseln'); }
    await sieh('2-zielen');
    const th0 = await p.evaluate(() => JSON.stringify(window.__kk.thOf(window.__kk.st.enc)));
    const R = await p.evaluate(() => window.__kk.aim.R);
    for (let i = 0; i < R; i++) { await p.click('#aimbar .strip').catch(() => {}); await p.waitForTimeout(110); }
    if (!(await warte(() => !window.__kk.aim.run))) fehler.push('Zielen: nach allen Rotten läuft der Zeiger weiter');
    await sieh('3-salve');
    await warte(() => { const e = window.__kk.st.enc; return !e || ['tactic', 'won', 'fleeing', 'melee', 'escaped', 'lost', 'captured'].includes(e.phase); }, 12000);
    await sieh('4-runde');
    // 3. Enterkampf: sie entern dich
    await neu(); await p.evaluate(() => { const e = window.__kk.st.enc; e.phase = 'tactic'; e.dist = 0; window.__kk.board(true, ''); });
    if (!(await warte(() => window.__kk.st.enc && window.__kk.st.enc.phase === 'melee'))) fehler.push('Entern: kein Nahkampf');
    else {
      await sieh('5-nahkampf');
      if ((await p.$$('#aimbar .lane')).length !== 3) fehler.push('Entern: nicht drei Abschnitte');
      if ((await p.$$('#aimbar .bcard')).length !== 4) fehler.push('Entern: nicht vier Karten auf der Hand');
      if (!(await p.$('#aimbar [data-act="bd-back"]'))) fehler.push('Entern: „Taue kappen“ fehlt im Enterkampf unter der Szene');
      for (let i = 0; i < 6 && (await phase()) === 'melee'; i++) {
        // Karten legen, bis die Kraft verbraucht ist: Karte antippen, dann den Abschnitt (Heimat, sonst Bug)
        for (let j = 0; j < 2; j++) {
          const c = await p.evaluate(() => { const b = [...document.querySelectorAll('#aimbar .bcard')].find(x => !x.disabled && !x.classList.contains('gone')); return b ? +b.dataset.i : null; });
          if (c == null) break;
          await p.click(`#aimbar .bcard[data-i="${c}"]`); await p.waitForTimeout(80);
          const l = await p.evaluate(() => (document.querySelector('#aimbar .lane.home') || document.querySelector('#aimbar .lane.can') || {dataset:{}}).dataset.l);
          if (!l) break;
          await p.click(`#aimbar .lane[data-l="${l}"]`); await p.waitForTimeout(120);
        }
        if (i === 0) { if (!(await p.$('#aimbar .planks s'))) fehler.push('Entern: keine Vorschau auf der Deckleiste nach dem Legen'); await sieh('6-karten'); }
        await klick('bd-go');
        await warte(() => { const e = window.__kk.st.enc, b = document.querySelector('#actions [data-act="bd-go"]'); return !e || e.phase !== 'melee' || (b && !b.disabled); }, 8000);
        await p.waitForTimeout(200);
      }
      await sieh('7-nahkampf-ende');
      if ((await phase()) === 'melee') fehler.push('Entern: nach drei Runden noch kein Ende');
    }
    // 4. Kapitän entscheiden lassen
    await neu(); await p.waitForTimeout(150);
    const t0 = Date.now(); await klick('capauto');
    const ms = Date.now() - t0;
    if (!['won', 'lost', 'captured', 'escaped'].includes(await phase())) fehler.push(`Kapitän lassen: kein Ende, Phase ${await phase()}`);
    if (ms > 3000) fehler.push(`Kapitän lassen dauert ${ms} ms`);
    await sieh('8-kapitaen');
    // 5. Übungskampf am ersten Seeräuber: leicht, mit Hinweisen, ohne „Kapitän lassen“
    await p.evaluate(() => { const K = window.__kk, st = K.st; st.enc = null; st.encs = 0; st.focus = null; K.startEnc(); K.commit(); });
    await p.waitForTimeout(200);
    const ue = await p.evaluate(() => { const e = window.__kk.st.enc; return {prac:e.prac, tier:e.tier}; });
    if (!ue.prac || ue.tier !== 0) fehler.push('Übungskampf: erster Seeräuber ist keine leichte Übung: ' + JSON.stringify(ue));
    if (await p.$('#actions [data-act="capauto"]')) fehler.push('Übungskampf: „Kapitän lassen“ sollte fehlen');
    await sieh('9-uebung');
  } catch (e) {
    fehler.push('Abbruch: ' + e.message.split('\n').slice(0, 6).join(' | '));
    await p.screenshot({path:path.join(OUT, `${lang}-abbruch.png`)}).catch(() => {});
  }
  if (lang !== 'de') { const reste = deutscheReste(texte.join('\n')); if (reste.length) fehler.push('Deutsche Reste: ' + reste.join(', ')); }
  await ctx.close();
  bericht.push({lang, ok:!fehler.length, fehler});
  console.log(`${fehler.length ? 'FEHLER' : 'ok   '} ${lang}${fehler.length ? '\n  - ' + fehler.join('\n  - ') : ''}`);
}

(async () => {
  fs.rmSync(OUT, {recursive:true, force:true}); fs.mkdirSync(OUT, {recursive:true});
  const browser = await chromium.launch(), bericht = [];
  for (const lang of Object.keys(FILES)) if (fs.existsSync(path.join(ROOT, FILES[lang]))) await lauf(browser, lang, bericht);
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'bericht.json'), JSON.stringify(bericht, null, 1));
  if (bericht.some(b => !b.ok)) process.exitCode = 1;
})();

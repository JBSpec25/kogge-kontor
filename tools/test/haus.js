// Prüfung des Hauses im Stil Kontorbuch (ab Version 53) auf dem kleinsten iPhone (375 × 667), in Deutsch, Englisch und Spanisch.
//
//   node tools/test/haus.js [--bilder]
//
// Je Sprache: neues Spiel ohne Hausmarke, dann Kaufmann mit Kontor, Niederlassung, drei Kapitänen und zwei Verbänden
// (einer nach Regeln mit Menge und Preisgrenze). Geöffnet werden das Haus, jedes Blatt hinter den Kacheln und das Blatt
// eines Verbands; dort wird eine Regel bearbeitet (Aktion, Menge, Preisgrenze) und wieder geschlossen.
// Geprüft wird: keine Fehler in der Konsole, nichts ragt seitlich über den Bildschirm, jedes Blatt hat einen Titel und
// schließt wieder, die Regel steht danach so im Spielstand, der Handel nach Regeln hält Menge und Preisgrenze ein,
// keine deutschen Reste in Englisch und Spanisch. Bilder mit --bilder in tools/out/haus/. Endcode 1, wenn etwas fehlschlägt.
const fs = require('fs'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { ({chromium} = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'tools', 'out', 'haus');
const BILDER = process.argv.includes('--bilder');
const FILES = {de:'src/kogge-kontor.html', en:'src/kogge-kontor.en.html', es:'src/kogge-kontor.es.html'};
const ERLAUBT = new Set(fs.readFileSync(path.join(__dirname, 'erlaubt.txt'), 'utf8').split('\n').map(s => s.replace(/#.*/, '').trim()).filter(Boolean));
const DE_WORT = /^(und|der|die|das|nicht|mit|für|ist|ein|eine|dein|deine|auf|zum|zur|vom|beim|wird|werden|kannst|noch|schon|Tage|Tag|Gulden|Schiff|Schiffe|Ware|Waren|kaufen|verkaufen|Hafen|Stadt|Kapitän|Verband|Flotte|Regeln|Menge|höchstens|mindestens|alles|Liegeplatz|Schifferhaus|Haus)$/;
const deutscheReste = text => [...new Set(text.split(/[^A-Za-zÄÖÜäöüß]+/).filter(w => w && !ERLAUBT.has(w) && (/[äöüßÄÖÜ]/.test(w) || DE_WORT.test(w))))];
const ANCHOR = '  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {';
const HOOK = '  window.__kk = {get st() { return st; }, get ui() { return ui; }, commit, setTab, formConvoy, genCaptain, kontorBuild, cvRuleTrade, buyPrice, sellPrice};\n';

async function lauf(browser, lang) {
  const fehler = [];
  let s = fs.readFileSync(path.join(ROOT, FILES[lang]), 'utf8');
  if (!s.includes(ANCHOR)) throw new Error('Anker nicht gefunden in ' + FILES[lang]);
  s = s.replace(ANCHOR, HOOK + ANCHOR);
  const tmp = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'kk-haus-')), 'spiel.html');
  fs.writeFileSync(tmp, s);
  const ctx = await browser.newContext({viewport:{width:375, height:667}, deviceScaleFactor:2, reducedMotion:'reduce', locale:{de:'de-DE', en:'en-GB', es:'es-ES'}[lang]});
  const p = await ctx.newPage();
  p.on('pageerror', e => fehler.push('Seitenfehler: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) fehler.push('Konsole: ' + m.text()); });
  const texte = [];
  const sieh = async name => {
    const r = await p.evaluate(() => {
      const W = innerWidth, breit = [];
      for (const el of document.querySelectorAll('#homecard *, #housecard *, #hsheet *, #stats *')) {
        if (!el.getClientRects().length || el.closest('[hidden]')) continue;
        const rc = el.getBoundingClientRect();
        if (rc.width && (rc.right > W + 1 || rc.left < -1) && !el.closest('svg')) breit.push(`${el.tagName.toLowerCase()}.${el.className || ''} ${Math.round(rc.left)}–${Math.round(rc.right)}`);
      }
      const doc = document.documentElement.scrollWidth > W + 1 ? [`Seite ${document.documentElement.scrollWidth} px breit`] : [];
      return {breit:doc.concat(breit.slice(0, 5)), text:[...document.querySelectorAll('#homecard, #housecard, #hsheet, #stats')].map(x => x.hidden ? '' : x.innerText).join('\n')};
    });
    r.breit.forEach(x => fehler.push(`${name}: ragt über den Bildschirm: ${x}`));
    texte.push(r.text);
    if (BILDER) await p.screenshot({path:path.join(OUT, `${lang}-${name}.png`), fullPage:false});
  };
  try {
    await p.goto('file://' + tmp); await p.waitForTimeout(700);
    if (await p.$('[data-act="wiz-dice"]')) {
      await p.click('[data-act="wiz-dice"]');
      for (let i = 0; i < 8; i++) {
        if (await p.$('.hmset')) fehler.push('Spielstart: Hausmarke noch zur Wahl');
        if (await p.$('[data-act="wiz-go"]:visible')) { if (!(await p.$('.summary .hseal'))) fehler.push('Spielstart: kein Haussiegel in der Übersicht'); await p.click('[data-act="wiz-go"]'); break; }
        await p.click('[data-act="wiz-next"]'); await p.waitForTimeout(120);
      }
    }
    await p.waitForTimeout(300);
    await p.evaluate(() => { document.querySelectorAll('[data-qwel="skip"]').forEach(b => b.click()); });
    if (!(await p.$('#stats .hpurse')) || !(await p.$('#stats .wline .hseal'))) fehler.push('Kopf: Truhe oder Haussiegel fehlt');
    await p.evaluate(() => {
      const K = window.__kk, st = K.st, ui = K.ui;
      st.rank = 2; st.money = 90000; st.repute = 2095; st.crew = 40;
      K.kontorBuild();
      const other = st.home === 'visby' ? 'riga' : 'visby';
      st.branches = st.branches || {}; st.branches[other] = {lvl:1, cap:60, goods:{}};
      while (st.captains.length < 3) { const k = K.genCaptain(); k.cv = null; st.captains.push(k); }
      st.fleet.push({id:(st.nextShip = (st.nextShip || 10) + 1), type:'kogge', name:'Morgenstern', hull:100});
      st.fleet.push({id:(st.nextShip = st.nextShip + 1), type:'holk', name:'Greif', hull:64});
      const free = st.captains.filter(k => !k.cv && k.id !== st.capOwn);
      ui.form = {ships:[st.fleet[1].id], cap:free[0].id, route:[other], mode:'regeln', tpl:'rund', rules:{[st.home]:{salz:{a:'buy', q:20, p:70}, tuch:'buy'}, [other]:{salz:'sell'}}}; K.formConvoy();
      ui.form = {ships:[st.fleet[1].id], cap:free[1].id, route:[other === 'riga' ? 'visby' : 'riga'], mode:'frei', tpl:'rund', rules:{}}; K.formConvoy();
      K.setTab('haus'); K.commit();
    });
    await p.waitForTimeout(300);
    if ((await p.evaluate(() => window.__kk.st.convoys.length)) !== 2) fehler.push('Aufbau: zwei Verbände erwartet');
    if ((await p.$$('#homecard .htile')).length < 7) fehler.push('Haus: weniger als sieben Kacheln im Stammsitz');
    if ((await p.$$('#housecard .fentry')).length !== 3) fehler.push('Haus: Flotte sollte drei Einträge haben (dein Verband und zwei Kapitänsverbände)');
    await sieh('1-haus');
    // Jede Kachel öffnet ein Blatt mit Titel, Zurück schließt es
    const keys = await p.$$eval('#homecard .htile, #housecard .htile', l => l.map(b => b.dataset.hsOpen));
    for (const k of keys) {
      await p.click(`[data-hs-open="${k}"]`); await p.waitForTimeout(150);
      const t = await p.evaluate(() => !document.querySelector('#hsheet').hidden && (document.querySelector('#hs-title') || {}).textContent);
      if (!t) fehler.push(`Blatt ${k}: öffnet nicht oder ohne Titel`);
      await sieh('2-' + k);
      await p.click('#hsheet [data-hs="close"]'); await p.waitForTimeout(100);
      if (!(await p.evaluate(() => document.querySelector('#hsheet').hidden))) fehler.push(`Blatt ${k}: schließt nicht`);
    }
    // Verband nach Regeln: Karte, Regeln, eine Regel bearbeiten
    await p.click('#housecard .fentry[data-hs-open="cv"]'); await p.waitForTimeout(200);
    if (!(await p.$('#hsheet .rchart'))) fehler.push('Verband: keine Seekarte mit der Route');
    if ((await p.$$('#hsheet .rrow')).length < 3) fehler.push('Verband: Regeln je Hafen fehlen');
    await sieh('3-verband');
    await p.click('#hsheet .rrow[data-g="tuch"]'); await p.waitForTimeout(120);
    await p.click('#hsheet [data-h="rlq"][data-g="tuch"][data-v="10"]'); await p.waitForTimeout(120);
    const lim = await p.$eval('#hsheet [data-h="rlp"][data-g="tuch"]:not([data-v="0"])', b => b.dataset.v);
    await p.click(`#hsheet [data-h="rlp"][data-g="tuch"][data-v="${lim}"]`); await p.waitForTimeout(120);
    await sieh('4-regel');
    const rule = await p.evaluate(() => { const st = window.__kk.st; return st.convoys[0].rules[st.home].tuch; });
    if (!rule || rule.a !== 'buy' || rule.q !== 10 || rule.p !== +lim) fehler.push('Regel: Menge und Preisgrenze nicht gespeichert: ' + JSON.stringify(rule));
    await p.click('#hsheet [data-hs="close"]'); await p.waitForTimeout(100);
    // Handel nach Regeln: Menge und Preisgrenze werden eingehalten
    const tr = await p.evaluate(() => {
      const K = window.__kk, st = K.st, cv = st.convoys[0], c = st.home;
      cv.loc = c; cv.sail = null; cv.cargo = {}; st.money = 90000;
      cv.rules[c] = {salz:{a:'buy', q:7, p:9999}, eisen:{a:'buy', q:0, p:1}};
      K.cvRuleTrade(cv, c);
      return {salz:(cv.cargo.salz || {}).q || 0, eisen:(cv.cargo.eisen || {}).q || 0};
    });
    if (tr.salz !== 7) fehler.push(`Handel: Menge nicht eingehalten, Salz ${tr.salz} statt 7`);
    if (tr.eisen !== 0) fehler.push(`Handel: Preisgrenze nicht eingehalten, Eisen ${tr.eisen} statt 0`);
    if (lang !== 'de') { const rest = deutscheReste(texte.join('\n')); if (rest.length) fehler.push('Deutsche Reste: ' + rest.slice(0, 12).join(', ')); }
  } catch (e) { fehler.push('Abbruch: ' + e.message.split('\n')[0]); }
  await ctx.close();
  return fehler;
}

(async () => {
  if (BILDER) fs.mkdirSync(OUT, {recursive:true});
  const browser = await chromium.launch();
  let schlecht = 0;
  for (const lang of Object.keys(FILES)) {
    const f = await lauf(browser, lang);
    console.log(`${f.length ? 'FEHLER' : 'ok   '} ${lang}`); f.forEach(x => console.log('   ' + x));
    schlecht += f.length;
  }
  await browser.close();
  process.exit(schlecht ? 1 : 0);
})();

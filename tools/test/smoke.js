// Rauchtest für Kogge & Kontor: jede Fassung in jeder Sprache einmal im iPhone-Format durchspielen.
//
//   node tools/test/smoke.js [--nur beta,haupt,probe,app] [--wochen 104] [--bilder]
//
// Je Fassung und Sprache: neues Spiel über den Assistenten, alle sechs Reiter, Zeit vergehen lassen
// (die Beta auf Deutsch zwei Spieljahre), Ende der Probezeit (Probe und App) samt nachgestelltem Kauf in der App,
// Neuladen mit gleichem Spielstand, Sprachwechsel (Beta). Geprüft wird: keine Fehler in der Konsole, keine
// deutschen Reste in Englisch und Spanisch (außer Namen in tools/test/erlaubt.txt), kein Knopf ragt über den
// Bildschirm, gleiche Versionskennung in Seite, version.txt und sw.js. Ergebnis: tools/out/smoke/bericht.json,
// Bildschirmfotos in tools/out/smoke/. Endcode 1, wenn etwas fehlschlägt.
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { ({chromium} = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'tools', 'out', 'smoke');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const NUR = arg('--nur', 'beta,haupt,probe,app').split(',');
const WOCHEN = +arg('--wochen', 104);
const BILDER = process.argv.includes('--bilder');
const PAGES = {de: 'index.html', en: 'en.html', es: 'es.html'};
const LOCALE = {de: 'de-DE', en: 'en-GB', es: 'es-ES'};
const TABS = ['lage', 'markt', 'karte', 'werft', 'stadt', 'haus'];
const FASSUNGEN = [
  {name: 'beta', base: 'beta/', target: 'full', sprachwechsel: true},
  {name: 'haupt', base: '', target: 'full'},
  {name: 'probe', base: 'tools/out/probe/', target: 'web'},
  {name: 'app', base: 'app/www/', target: 'app'}
].filter(f => NUR.includes(f.name) && fs.existsSync(path.join(ROOT, f.base, 'index.html')));

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml'};
function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

// Namen und Begriffe, die in Englisch und Spanisch so stehen dürfen
const ERLAUBT = new Set(fs.readFileSync(path.join(__dirname, 'erlaubt.txt'), 'utf8').split('\n').map(s => s.replace(/#.*/, '').trim()).filter(Boolean));
const DE_WORT = /^(und|der|die|das|nicht|mit|für|ist|ein|eine|dein|deine|auf|zum|zur|vom|beim|wird|werden|kannst|noch|schon|Tage|Tag|Last|Gulden|Schiff|Schiffe|Ware|Waren|kaufen|verkaufen|Hafen|Stadt|bauen|Weiter|Zurück|Schließen)$/;
function deutscheReste(text) {
  const out = new Set();
  for (const w of text.split(/[^A-Za-zÄÖÜäöüß]+/)) {
    if (!w || ERLAUBT.has(w)) continue;
    if (/[äöüßÄÖÜ]/.test(w) || DE_WORT.test(w)) out.add(w);
  }
  return [...out];
}

async function popupsZu(p) {
  for (let i = 0; i < 12; i++) {
    const did = await p.evaluate(() => {
      const vis = el => el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const q = document.querySelector('#qsheet');
      if (vis(q)) { const b = q.querySelector('[data-qwel="skip"], [data-qclose], [data-qwel], button'); if (b) { b.click(); return 'quest'; } }
      for (const act of ['news-ok', 'close', 'bs-close', 'book-close', 'saves-close', 'let-go', 'resume']) {
        const b = [...document.querySelectorAll(`[data-act="${act}"]`)].find(vis);
        if (b) { b.click(); return act; }
      }
      return '';
    });
    if (!did) return;
    await p.waitForTimeout(150);
  }
}
const geld = p => p.evaluate(() => { const t = document.body.innerText.match(/([\d.,\s]+)\s*(Gulden|guilders|florines)/i); return t ? t[1].replace(/\D/g, '') : ''; });
const sichtbar = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].some(e => !e.hidden && e.getClientRects().length > 0 && !e.disabled && !e.closest('[hidden]')), sel);

async function lauf(browser, base, F, lang, bericht) {
  const name = `${F.name}-${lang}`, fehler = [], hinweise = [];
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, locale: LOCALE[lang], reducedMotion: 'reduce'});
  const p = await ctx.newPage();
  p.on('pageerror', e => fehler.push('Seitenfehler: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) fehler.push('Konsole: ' + m.text()); });
  const url = base + F.base + PAGES[lang];
  const t0 = Date.now();
  try {
    await p.goto(url, {waitUntil: 'load'}); await p.waitForTimeout(800);
    const htmlLang = await p.evaluate(() => document.documentElement.lang);
    if (htmlLang !== lang) fehler.push(`Sprache der Seite ${htmlLang} statt ${lang}`);
    // Neues Spiel
    if (!(await sichtbar(p, '[data-act="wiz-dice"]'))) fehler.push('Assistent für ein neues Spiel erscheint nicht');
    else {
      await p.click('[data-act="wiz-dice"]');
      for (let i = 0; i < 8; i++) {
        if (await sichtbar(p, '[data-act="wiz-go"]')) { await p.click('[data-act="wiz-go"]'); break; }
        await p.click('[data-act="wiz-next"]'); await p.waitForTimeout(150);
      }
    }
    await p.waitForTimeout(500); await popupsZu(p);
    // Reiter
    const reste = new Set(), breit = new Set();
    const pruefen = async tab => {
      const r = await p.evaluate(() => {
        const W = innerWidth, out = [];
        for (const b of document.querySelectorAll('button, .btn')) {
          if (!b.getClientRects().length || b.closest('[hidden]')) continue;
          const rc = b.getBoundingClientRect();
          if (rc.width && (rc.right > W + 1 || rc.left < -1)) out.push((b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 40));
        }
        return {breit: out, text: document.body.innerText};
      });
      r.breit.forEach(x => breit.add(`${tab}: ${x}`));
      if (lang !== 'de') deutscheReste(r.text).forEach(w => reste.add(w));
    };
    for (const tab of TABS) {
      await p.click(`[data-tab-btn="${tab}"]`); await p.waitForTimeout(250); await popupsZu(p);
      await pruefen(tab);
      if (BILDER || F.name === 'beta') await p.screenshot({path: path.join(OUT, `${name}-${tab}.png`)});
    }
    await p.click('[data-tab-btn="lage"]');
    // Zeit vergehen lassen
    const wochen = F.name === 'beta' ? WOCHEN : 10;
    let gewartet = 0;
    for (let w = 0; w < wochen; w++) {
      await popupsZu(p);
      if (!(await sichtbar(p, '[data-act="waitrun"]'))) {
        if (await sichtbar(p, '[data-act="restart"]')) hinweise.push(`Bankrott nach ${gewartet} Wochen ohne Handel (so gewollt)`);
        break;
      }
      await p.click('[data-act="waitrun"]');
      for (let i = 0; i < 80 && await sichtbar(p, '[data-act="waitstop"]'); i++) await p.waitForTimeout(150);
      gewartet++;
    }
    await popupsZu(p);
    for (const tab of TABS) { await p.click(`[data-tab-btn="${tab}"]`); await p.waitForTimeout(150); await popupsZu(p); await pruefen(tab + ' später'); }
    await p.click('[data-tab-btn="lage"]'); await p.waitForTimeout(200);
    // Probezeit
    const kauf = await sichtbar(p, '[data-act="full-buy"]'), probeVorbei = await p.evaluate(() => !!document.querySelector('#actions [data-act="full-saves"]'));
    if (F.target === 'full' && (kauf || probeVorbei)) fehler.push('Probezeit endet im ganzen Spiel');
    if (F.target === 'full' && gewartet < Math.min(wochen, 10)) fehler.push(`nur ${gewartet} Wochen gewartet`);
    if (F.target === 'app' && !kauf) fehler.push('In der App erscheint nach der Probezeit kein Kaufknopf');
    if (F.target === 'web' && !probeVorbei) fehler.push('Im Browser erscheint nach der Probezeit kein Hinweis auf die App');
    if (F.target !== 'full') await p.screenshot({path: path.join(OUT, `${name}-probezeit.png`)});
    if (F.target === 'app' && kauf) {   // Kauf nachstellen: so merkt sich die App die Vollversion
      await p.evaluate(() => localStorage.setItem('kogge-kontor-vollversion', '1'));
      await p.reload(); await p.waitForTimeout(800); await popupsZu(p);
      if (await sichtbar(p, '[data-act="full-buy"]')) fehler.push('Nach dem Kauf bleibt die Probezeit gesperrt');
      if (!(await sichtbar(p, '[data-act="waitrun"]'))) fehler.push('Nach dem Kauf geht es nicht weiter');
    }
    // Speichern und Laden
    const g0 = await geld(p);
    await p.reload(); await p.waitForTimeout(800); await popupsZu(p);
    if (await sichtbar(p, '[data-act="wiz-dice"]')) fehler.push('Nach dem Neuladen ist der Spielstand weg');
    const g1 = await geld(p);
    if (!g0 || g0 !== g1) fehler.push(`Truhe vor und nach dem Neuladen verschieden: ${g0} / ${g1}`);
    // Sprachwechsel
    if (F.sprachwechsel) {
      const ziel = lang === 'de' ? 'en' : 'de';
      await p.click('#savesbtn'); await p.waitForTimeout(300);
      const btn = await p.$(`[data-slot="lang"][data-v="${ziel}"]`);
      if (!btn) fehler.push('Sprachwahl fehlt unter Spielstände und Einstellungen');
      else {
        await Promise.all([p.waitForNavigation({waitUntil: 'load'}), btn.click()]);
        await p.waitForTimeout(800); await popupsZu(p);
        const l2 = await p.evaluate(() => document.documentElement.lang), g2 = await geld(p);
        if (l2 !== ziel) fehler.push(`Sprachwechsel landet auf ${l2} statt ${ziel}`);
        if (g2 !== g1) fehler.push(`Spielstand nach dem Sprachwechsel verschieden: ${g1} / ${g2}`);
      }
    }
    // Versionskennung
    const build = await p.evaluate(() => window.KK_BUILD || '');
    if (F.target !== 'app') {
      const vt = fs.readFileSync(path.join(ROOT, F.base, 'version.txt'), 'utf8').trim();
      const sw = fs.readFileSync(path.join(ROOT, F.base, 'sw.js'), 'utf8');
      if (build !== vt) fehler.push(`Versionskennung der Seite ${build} ≠ version.txt ${vt}`);
      if (!sw.includes(`-${vt}'`)) fehler.push('sw.js passt nicht zu version.txt');
    }
    if (breit.size) fehler.push('Knöpfe ragen über den Bildschirm: ' + [...breit].join(' | '));
    const neu = [...reste];
    if (neu.length) fehler.push('Deutsche Reste: ' + neu.join(', '));
    hinweise.push(`${gewartet} Wochen gewartet`);
  } catch (e) {
    fehler.push('Abbruch: ' + e.message.split('\n')[0]);
    await p.screenshot({path: path.join(OUT, `${name}-abbruch.png`)}).catch(() => {});
  }
  await ctx.close();
  const ok = !fehler.length;
  bericht.push({lauf: name, ok, sekunden: Math.round((Date.now() - t0) / 1000), fehler, hinweise});
  console.log(`${ok ? 'ok   ' : 'FEHLER'} ${name} (${Math.round((Date.now() - t0) / 1000)} s)${ok ? '' : '\n  - ' + fehler.join('\n  - ')}`);
}

(async () => {
  fs.rmSync(OUT, {recursive: true, force: true}); fs.mkdirSync(OUT, {recursive: true});
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const bericht = [];
  if (!FASSUNGEN.length) { console.log('Keine Fassung gefunden'); process.exitCode = 1; }
  for (const F of FASSUNGEN) for (const lang of Object.keys(PAGES)) await lauf(browser, base, F, lang, bericht);
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(OUT, 'bericht.json'), JSON.stringify(bericht, null, 1));
  const bad = bericht.filter(b => !b.ok).length;
  console.log(`${bericht.length - bad} von ${bericht.length} Läufen ohne Fehler`);
  if (bad) process.exitCode = 1;
})();

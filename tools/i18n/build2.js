// Baut eine Sprachfassung: node build2.js SPIEL.html UNITS.json AUS.html en|es
// Übersetzungen aus tr/c*.json ([en, es]), Sonderfälle nach Kontext aus tr/ctx.json,
// Quelltext-Korrekturen aus tr/srcfix.json, statisches HTML aus tr/html.json.
const fs = require('fs'), path = require('path');
const [,, srcPath, unitsPath, outPath, lang] = process.argv;
const LI = {en: 0, es: 1}[lang]; if (LI == null) throw new Error('Sprache en oder es');
const src = fs.readFileSync(srcPath, 'utf8');
const {units} = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
const TR = path.join(__dirname, 'tr');
const tr = {};
for (const f of fs.readdirSync(TR).filter(f => /^c\d+\.json$/.test(f)).sort())
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(TR, f), 'utf8')))) tr[k] = v[LI];
const ctxo = JSON.parse(fs.readFileSync(path.join(TR, 'ctx.json'), 'utf8'));
const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const main = blocks.sort((a, b) => b[1].length - a[1].length)[0];
const js = main[1], off = main.index + '<script>'.length;

units.sort((a, b) => a.s - b.s || b.e - a.e);
const roots = [], stack = [];
for (const u of units) {
  u.kids = [];
  while (stack.length && stack[stack.length - 1].e <= u.s) stack.pop();
  if (stack.length) stack[stack.length - 1].kids.push(u); else roots.push(u);
  stack.push(u);
}
const ctxHit = new Set();
const tOf = u => {
  for (const [i, o] of ctxo.entries()) if (o.key === u.key && new RegExp(o.re).test(u.ctx)) { ctxHit.add(i); return o.t[LI]; }
  return tr[u.key];
};
let used = 0; const missing = [];
function renderRange(s, e, kids) {
  let out = '', p = s;
  for (const k of kids) { if (k.s < s || k.e > e) continue; out += js.slice(p, k.s) + renderUnit(k); p = k.e; }
  return out + js.slice(p, e);
}
function escLit(t, q) {
  const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
  return q + t.replace(/\\/g, '\\\\').split(q).join('\\' + q).replace(/\n/g, '\\n').replace(/\r/g, '\\r').split(LS).join('\\u2028').split(PS).join('\\u2029') + q;
}
function renderUnit(u) {
  const t = tOf(u);
  if (t == null || t === u.text) { if (t == null) missing.push(u.key + ' ' + u.text.slice(0, 60)); return renderRange(u.s, u.e, u.kids); }
  used++;
  if (u.kind === 'lit') return escLit(t, u.q);
  const ex = u.exprs.map(([s, e]) => renderRange(s, e, u.kids));
  let out = '`', i = 0; const re = /\{(\d+)\}/g; let m;
  const lit = x => x.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  while ((m = re.exec(t))) {
    out += lit(t.slice(i, m.index));
    const n = +m[1];
    if (n >= ex.length) throw new Error(`Platzhalter {${n}} gibt es nicht in ${u.key}: ${t}`);
    out += '${' + ex[n] + '}';
    i = re.lastIndex;
  }
  return out + lit(t.slice(i)) + '`';
}
let newJs = renderRange(0, js.length, roots);
// Korrekturen im übersetzten Quelltext (alle Vorkommen)
for (const fx of JSON.parse(fs.readFileSync(path.join(TR, 'srcfix.json'), 'utf8'))) {
  const to = fx[1 + LI], pat = Array.isArray(fx[0]) ? fx[0][LI] : fx[0]; if (to == null) continue;
  if (!newJs.includes(pat)) throw new Error('Korrektur nicht gefunden: ' + pat);
  newJs = newJs.split(pat).join(to);
}
// Deutsche Anführungszeichen um eingesetzte Namen
newJs = newJs.replace(/„(\$\{[^}`]*\})“/g, LI === 0 ? '“$1”' : '«$1»');
let pre = src.slice(0, off), post = src.slice(off + js.length);
for (const [a, b] of Object.entries(JSON.parse(fs.readFileSync(path.join(TR, 'html.json'), 'utf8')))) {
  const n = pre.split(a).length + post.split(a).length - 2;
  if (!n) throw new Error('HTML-Text nicht gefunden: ' + a);
  pre = pre.split(a).join(b[LI]); post = post.split(a).join(b[LI]);
}
pre = pre.replace('<html lang="de">', `<html lang="${lang}">`);
const html = pre + newJs + post;
fs.writeFileSync(outPath, html);
const unusedCtx = ctxo.filter((_, i) => !ctxHit.has(i)).map(o => o.key);
console.log(lang, 'übersetzt', used, 'fehlend', missing.length, unusedCtx.length ? 'Kontext ungenutzt ' + unusedCtx.join(',') : '', 'Größe', html.length);
if (missing.length) console.log(missing.slice(0, 20).join('\n'));

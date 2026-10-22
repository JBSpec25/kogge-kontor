// Zieht alle Texte für Menschen aus dem Spiel: Zeichenketten und Vorlagen im Hauptskript.
// Ausgabe: units.json [{id, kind:'lit'|'tpl', text, ph:[Ausdrucksquelltext], ctx, key}]
const fs = require('fs'), acorn = require('acorn'), walk = require('acorn-walk');
const src = fs.readFileSync(process.argv[2], 'utf8');
const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const main = blocks.sort((a, b) => b[1].length - a[1].length)[0];
const js = main[1], off = main.index + '<script>'.length;
const ast = acorn.parse(js, {ecmaVersion: 'latest', ranges: true});

// Zeichenketten, die als Kennung dienen (Vergleiche, Schlüssel, case, Attribute)
const idStr = new Set();
const ID_KEYS = new Set(['id', 'k', 'kind', 'type', 'phase', 'tab', 'act', 'g', 'good', 'tgt', 'mat', 'cid', 'from', 'to', 'loc', 'home', 'at', 'w', 'weather', 'mode', 'res', 'key', 'cat', 'art', 'icon', 'ic', 'shape', 'side', 'role', 'state', 'status', 'track', 'sel', 'la', 'cls', 'style', 'tag', 'el', 'evDay', 'dir']);
walk.fullAncestor(ast, (n, anc) => {
  if (n.type !== 'Literal' || typeof n.value !== 'string') return;
  const p = anc[anc.length - 2];
  if (!p) return;
  if (p.type === 'BinaryExpression' && /^[!=]==?$/.test(p.operator)) idStr.add(n.value);
  if (p.type === 'SwitchCase' && p.test === n) idStr.add(n.value);
  if (p.type === 'Property' && p.key === n) idStr.add(n.value);
  if (p.type === 'MemberExpression' && p.property === n) idStr.add(n.value);
  if (p.type === 'Property' && p.value === n && p.key && ID_KEYS.has(p.key.name || p.key.value)) idStr.add(n.value);
  if (p.type === 'CallExpression' && p.callee.type === 'MemberExpression' && ['includes', 'indexOf', 'has', 'get', 'getItem', 'setItem', 'removeItem', 'querySelector', 'querySelectorAll', 'getElementById', 'closest', 'add', 'remove', 'toggle', 'contains', 'addEventListener', 'getContext', 'createElement', 'setAttribute', 'getAttribute', 'startsWith', 'endsWith', 'test', 'split', 'join', 'replace', 'matches', 'use'].includes(p.callee.property.name)) idStr.add(n.value);
});

const idents = new Set();
walk.full(ast, n => { if (n.type === 'Identifier') idents.add(n.name); if (n.type === 'Property' && n.key && n.key.type === 'Identifier') idents.add(n.key.name); });
const BLOCK = new Set('frt auto smooth wheel touchstart vertrag ybtn profit safe bold beforeend dn aimbar null lowpass triangle sawtooth sine bandpass peaking highpass playback avc inl numeric short down rvf neg ladder race biz council deal newships pyr cathedral nearest decide kurz jung'.split(' '));
const GERMANW = new Set('heiter nie sicher ordentlich wacklig halbes angenommen abgelehnt ihn sie nichts wenig drei zwei eine ein einmal nah fern gut ausgeglichen schlecht vertrieben versenkt gehen geht fallen hell dunkel blass golden tiefbraun braun blond schwarz grau rot kastanie blau purpur ocker schlicht ausschalten einschalten heute gestern sofort jetzt wurde wurden segelt fertig geliefert mittel'.split(' '));
const GW2 = /(^|[^A-Za-zÄÖÜäöüß])(und|kannst|nichts|nicht|abholen|abliefern|geladen|verkauft|verdorben|angeheuert|braucht|geliefert|liegt|schon|hier|bis|vom|der|die|das|den|dem|eine|ein|Menge|Ware|Waffe|Datum|Truhe|Warnung|Rotte|Hausmarke|Saison|Gerade|Lager|Kaufpreis|zeigen|Schließen|Bauaufträge|Schifferhaus|genau|verliert|verwundet|hast|vollendet|ab|zu|an|in|auf|mit|für|aus)([^A-Za-zÄÖÜäöüß]|$)/;
const HUMAN = s => {
  if (BLOCK.has(s)) return false;
  if (/^\s*#[0-9a-fA-F]{3,8}\s*$/.test(s)) return false;
  const attrs = [...s.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map(m => m[1]).join(' ');
  const t = (s.replace(/<[^>]*>/g, ' ') + ' ' + attrs).replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\{\d+\}/g, ' ');
  if (GW2.test(t) && /\s/.test(s.trim())) return true;                 // deutsche Wörter, auch klein geschrieben
  if (!/[A-Za-zÄÖÜäöüß]{2}/.test(t)) return false;
  if (!/\s/.test(s.trim()) && !/[<>]/.test(s)) return 'word';         // ein Wort ohne Leerzeichen: evtl. Kennung
  if (/^[a-z0-9_\-:.#\[\]=" ,()>*+~^$|%]+$/.test(t) && !/\s[a-zäöü]{3,}\s/.test(t)) return false;   // Selektor, CSS
  if (/^(?:[a-z-]+:[^;]+;\s*)+$/.test(t.trim())) return false;          // style
  if (/^https?:|^data:|^#[0-9a-f]{3,8}$|^rgba?\(|^hsla?\(/i.test(t.trim())) return false;
  return true;
};

const units = []; const seenRange = new Set();
const lineOf = pos => { const a = js.lastIndexOf('\n', pos) + 1, b = js.indexOf('\n', pos); return js.slice(a, b < 0 ? undefined : b).trim().slice(0, 260); };
walk.fullAncestor(ast, (n, anc) => {
  const p = anc[anc.length - 2];
  if (n.type === 'Literal' && typeof n.value === 'string') {
    if (p && p.type === 'Property' && p.key === n) return;
    if (p && (p.type === 'ImportDeclaration')) return;
    const h = HUMAN(n.value); if (!h) return;
    if (h === 'word') {
      const v = n.value;
      const w = v.trim().replace(/:$/, '');   // ' Jahre', ' für', 'Neubau:' zählen auch
      if (idStr.has(v) || idents.has(w) || /[a-z][A-Z]|[0-9_$\/]|^[.#@:-]|-$|^[a-z]+-[a-z-]+$|[=:;()\[\]{}]/.test(w)) return;
      if (/^\s|\s$/.test(v) && !/^[A-ZÄÖÜ]|[äöüß]/.test(w) && !GERMANW.has(w)) return;
      if (/^[a-z]+$/.test(w) && !/[äöüß]/.test(w) && !GERMANW.has(w)) return;   // kleines ASCII-Wort: nur bekannte deutsche Anzeigewörter
    }
    const key = p && p.type === 'Property' && p.value === n ? (p.key.name || p.key.value) : null;
    if (key && ID_KEYS.has(key)) return;
    units.push({s: n.start, e: n.end, kind: 'lit', q: js[n.start], text: n.value, key, word: h === 'word', ctx: lineOf(n.start)});
  }
  if (n.type === 'TemplateLiteral') {
    if (p && p.type === 'TaggedTemplateExpression') return;
    let text = ''; const ph = [];
    n.quasis.forEach((q, i) => { text += q.value.cooked; if (i < n.expressions.length) { text += `{${i}}`; ph.push(js.slice(n.expressions[i].start, n.expressions[i].end)); } });
    if (!HUMAN(text) || (HUMAN(text) === 'word' && !/^[A-ZÄÖÜ][a-zäöüß]{3,}$/.test(text))) return;
    units.push({s: n.start, e: n.end, kind: 'tpl', text, ph, ctx: lineOf(n.start), exprs: n.expressions.map(x => [x.start, x.end])});
  }
});
units.sort((a, b) => a.s - b.s);
units.forEach((u, i) => u.id = 'u' + i);
fs.writeFileSync(process.argv[3], JSON.stringify({off, units}, null, 0));
const chars = units.reduce((x, u) => x + u.text.length, 0);
console.log('Einheiten', units.length, 'Zeichen', chars, 'davon Einzelwörter', units.filter(u => u.word).length, 'eindeutig', new Set(units.map(u => u.text)).size);

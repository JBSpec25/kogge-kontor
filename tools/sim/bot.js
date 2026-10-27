  // ───────── Spieler-Bot für Langzeitsimulationen (nur im Simulationsbau, tools/sim/mksim.py) ─────────
  window.__bot = (() => {
    let A = null, P = null;
    const EB = typeof ECO !== 'undefined' ? ECO.bau : 1;   // Preisfaktor für Gebäude (ab Version 49)
    const add = (k, d) => { if (A) A.cat[k] = (A.cat[k] || 0) + d; };
    const use = k => { if (A) A.use[k] = (A.use[k] || 0) + 1; };
    // Buchhaltung über die Tagesfunktionen
    const W = {};
    const inv = () => Object.values(st.cargo).reduce((x, c) => x + c.cost, 0) + allStores().reduce((x, K) => x + Object.values(K.goods).reduce((y, c) => y + c.cost, 0), 0) + (st.convoys || []).reduce((x, cv) => x + Object.values(cv.cargo).reduce((y, c) => y + c.cost, 0), 0);
    const wrapDay = (name, get, set) => { const f0 = get(); set(function (...a) { const m = st.money, i0 = inv(); const r = f0.apply(this, a); const d = st.money - m + inv() - i0; if (A) { W[name] = (W[name] || 0) + d; add(name, d); } return r; }); };
    wrapDay('verbaende', () => convoysDay, f => { convoysDay = f; });
    { const f0 = worksDay; worksDay = function () { const K = st.kontor, before = {}; if (A && K) (st.works || []).forEach(w => { const c = K.goods[w.g]; before[w.g] = c ? [c.q, c.cost] : [0, 0]; });
      const m = st.money, i0 = inv(); f0(); const d = st.money - m + inv() - i0; W.betriebe = (W.betriebe || 0) + d; add('betriebe_input', d);
      if (A && st.kontor) Object.keys(before).forEach(g => { const c = st.kontor.goods[g], q = (c ? c.q : 0) - before[g][0], v = (c ? c.cost : 0) - before[g][1]; if (q > 0) { const P0 = A.prod[g] || (A.prod[g] = {q:0, v:0}); P0.q += q; P0.v += v; } }); }; }
    wrapDay('vertraege', () => ctDay, f => { ctDay = f; });
    wrapDay('parten', () => partsDay, f => { partsDay = f; });
    wrapDay('kredit', () => loansDay, f => { loansDay = f; });
    wrapDay('ernte', () => cropsDay, f => { cropsDay = f; });
    wrapDay('verwalter', () => stewardDay, f => { stewardDay = f; });
    wrapDay('rat', () => councilDay, f => { councilDay = f; });
    wrapDay('hansetag', () => hanseDay, f => { hanseDay = f; });
    wrapDay('bauten', () => cityJobsDay, f => { cityJobsDay = f; });
    wrapDay('auftraege_strafe', () => freightDay, f => { freightDay = f; });
    { const f0 = simDay; simDay = function () { const m = st.money, i0 = inv(), cvc = (st.convoys || []).reduce((x, cv) => x + cvCost(cv), 0) + (st.captains || []).filter(k => k.cv).reduce((x, k) => x + k.wage, 0); for (const k in W) W[k] = 0; f0(); const tot = st.money - m + inv() - i0, part = Object.values(W).reduce((x, y) => x + y, 0); add('verband_kosten', -cvc); add('laufend', tot - part + cvc); }; }
    const delta = (cat, fn) => { const m = st.money, i0 = inv(); const r = fn(); add(cat, st.money - m + inv() - i0); return r; };

    const capital = () => Math.max(1500, (CAP + (st.convoys || []).reduce((x, cv) => x + cvCap(cv), 0)) * 60);       // Geld, das zum Handeln in der Truhe bleiben soll
    const tripCost = days => (wage() + upkeep() + 6) * days;
    // geschätzter Bestand bei Ankunft: zieht zum Ruhebestand
    const stockAt = (cid, g, days) => { const e = E(C[cid], g); if (P && P.omni) { const s = st.stock[cid][g]; return e + (s - e) * Math.pow(0.965, days); } const M = A && A.mem[cid]; if (!M) return e; const s = M.s[g]; return e + (s - e) * Math.pow(0.965, days + st.day - M.d); };
    const buyU = (cid, g, s) => unitPrice(s, G[g].b, cid) * 1.06 * pf(cid, g, 'buy');
    const sellU = (cid, g, s) => unitPrice(s + 1, G[g].b, cid) * 0.94 * pf(cid, g, 'sell');
    const dests = from => CITIES.filter(c => c.id !== from && !embargoAt(c.id) && !(c.id === 'nowgorod' && newaFrozen(st.day + 6))).map(c => c.id);

    // Vertragsbedarf in einer Stadt bei Ankunft
    function ctNeed(cid, arr) {
      return ((st.contracts || {}).list || []).filter(k => k.cid === cid && arr >= k.due - CT_EARLY && arr <= k.due + CT_GRACE && stored(k.g, cid) < k.q);
    }
    // Plan für eine Fahrt nach B: was kaufen, was es bringt
    function plan(B) {
      const a = st.loc, days = route(a, B, st.day).days, arr = st.day + days;
      let cap = embargoAt(a) ? 0 : CAP - used(), cash = Math.max(0, st.money - Math.min(st.money * 0.25, 800));
      const sA = {}, sB = {}; GOODS.forEach(g => { sA[g.id] = st.stock[a][g.id]; sB[g.id] = stockAt(B, g.id, days); });
      let val = 0;
      // was schon an Bord ist
      GOODS.forEach(g => { const q = held(g.id); if (!q) return; let s = sB[g.id]; for (let i = 0; i < q; i++) { val += sellU(B, g.id, s) * 0.95; s++; } sB[g.id] = s; });
      // Verträge und Besorgen-Aufträge dort
      const special = {};
      ctNeed(B, arr).forEach(k => { special[k.g] = (special[k.g] || []).concat(Array(Math.max(0, k.q - held(k.g))).fill(k.price + ctPen(k) / k.q)); });
      ((st.freight || {}).active || []).forEach(f => { if (f.k === 'besorgen' && f.to === B && held(f.g) < f.q) special[f.g] = (special[f.g] || []).concat(Array(f.q - held(f.g)).fill(f.pay / f.q)); });
      // Rohstoffe für die Betriebe zu Hause
      if (B === st.home && st.kontor && (st.works || []).length) Object.entries(worksNeed()).forEach(([g, per]) => { const want = Math.max(0, Math.ceil(per * 25) - storedQ(g) - held(g)); if (want > 0) special[g] = (special[g] || []).concat(Array(want).fill(buyU(B, g, st.stock[B][g]) * 0.98)); });
      // Ansehen im Stammsitz: Ware, die er braucht, ist dort etwas mehr wert (wie ein Spieler, der auf das nächste Amt hinarbeitet)
      if (B === st.home && P.repBias) C[st.home].c.forEach(g => { special[g] = (special[g] || []).concat(Array(CAP).fill(sellU(B, g, sB[g]) * (1 + P.repBias))); });
      const buys = {}; let spent = 0;
      for (let n = 0; n < cap; n++) {
        let best = null, bm = 0;
        GOODS.forEach(g => {
          const id = g.id; if (sA[id] < 2) return;
          const pa = buyU(a, id, sA[id]); if (pa > cash - spent) return;
          const sp = special[id] && special[id].length ? special[id][0] : 0;
          const pb = Math.max(sp, sellU(B, id, sB[id]) * 0.93);
          const m = pb - pa;
          if (m > bm && m > g.b * 0.04) { bm = m; best = id; }
        });
        if (!best) break;
        spent += buyU(a, best, sA[best]);
        if (special[best] && special[best].length && special[best][0] >= sellU(B, best, sB[best]) * 0.93) special[best].shift(); else sB[best]++;
        sA[best]--; buys[best] = (buys[best] || 0) + 1; val += bm + buyU(a, best, sA[best] + 1);
      }
      // Lohn aus Aufträgen dorthin
      let pay = 0;
      ((st.freight || {}).active || []).forEach(f => { if (ordDue(f) === B && f.k !== 'besorgen') pay += f.pay * (f.due - arr < 4 ? 1.6 : 1); if (f.k === 'besorgen' && f.to === B) pay += f.rep ? f.rep * 15 : 0; });
      ctNeed(B, arr).forEach(k => { if (stored(k.g, B) + held(k.g) >= k.q) pay += k.q * k.price + ctPen(k) * 2; });
      ((st.contracts || {}).list || []).forEach(k => { if (k.due - st.day <= 20 && held(k.g) + stored(k.g, k.cid) < k.q && C[B].p.includes(k.g) && route(B, k.cid, arr).days + arr <= k.due + CT_GRACE) pay += ctPen(k) * 1.5; });
      // Vorkauf abholen
      const F = st.fin; if (F) F.crops.filter(c => c.ready && c.cid === B && c.got < c.q).forEach(c => { pay += Math.min(c.q - c.got, CAP) * G[c.g].b * 0.4; });
      // Wert von Ware in eigenen Lagern dort
      const K = storeAt(B); if (K && B !== st.home) Object.entries(K.goods).forEach(([g, c]) => { pay += Math.min(c.q, CAP) * G[g].b * 0.15; });
      const heldHere = GOODS.reduce((x, g) => x + (held(g.id) ? sellGain(a, g.id, held(g.id)) : 0), 0);
      const gain = val - spent - heldHere + pay - tripCost(days);
      return {B, days, buys, spent, gain, per:gain / (days + 0.6)};
    }
    // Verkaufen: was hier gut geht
    function sellHere() {
      const a = st.loc;
      if (embargoAt(a)) return;
      GOODS.forEach(g => {
        const id = g.id; let q = held(id); if (!q) return;
        const c = st.cargo[id], basis = c.cost / c.q;
        // beste andere Stadt in der Nähe (geschätzt)
        let alt = 0; dests(a).forEach(B => { const d = route(a, B, st.day).days; const v = sellU(B, id, stockAt(B, id, d)) * 0.93 - d * 1.5; if (v > alt) alt = v; });
        const keep = ((st.freight || {}).active || []).filter(f => f.k === 'besorgen' && f.g === id && f.to !== a).reduce((x, f) => x + f.q, 0) +
          ((st.contracts || {}).list || []).filter(k => k.g === id && k.cid !== a).reduce((x, k) => x + k.q, 0) +
          (a !== st.home && st.kontor && worksNeed()[id] ? Math.ceil(worksNeed()[id] * 25) : 0);
        const old = (A.age[id] || 0) >= 3;
        let n = 0, s = st.stock[a][id];
        while (n < q - keep) { const u = sellU(a, id, s + n); if (!old && (u < basis * 0.98 || u < alt * 0.92)) break; n++; }
        if (n > 0) { const m = st.money; doSell(id, n); const rev = st.money - m; add('handel', rev - basis * n); A.sales += rev;
          const R0 = A.rev[id] || (A.rev[id] = {q:0, v:0}); R0.q += n; R0.v += rev; A.age[id] = 0; }
      });
      GOODS.forEach(g => { if (held(g.id)) A.age[g.id] = (A.age[g.id] || 0) + 1; });
    }
    function storesOut() {
      const a = st.loc, K = storeAt(a); if (!K) return;
      Object.keys(K.goods).forEach(g => {
        if (a === st.home && worksNeed()[g]) return;
        const q = Math.min(K.goods[g].q, CAP - used()); if (q <= 0) return;
        const fromWorks = a === st.home && (st.works || []).some(w => w.g === g);
        kontorMove(g, 'out', q);
        if (fromWorks) { A.src[g] = A.src[g] || {}; A.src[g].works = (A.src[g].works || 0) + q; }
      });
    }
    function inputsIn() {
      if (st.loc !== st.home || !st.kontor) return;
      Object.keys(worksNeed()).forEach(g => { const q = Math.min(held(g), st.kontor.cap - kontorUsed()); if (q > 0) kontorMove(g, 'in', q); });
    }
    // Aufträge und Verträge im Hafen
    function ordersHere() {
      const a = st.loc;
      (st.freight.active || []).slice().forEach(f => {
        if (f.k === 'abholen' && !f.picked && f.from === a) pickupFreight(f.id);
        if (ordDue(f) === a) delta('auftraege', () => deliverFreight(f.id));
      });
      ((st.contracts || {}).list || []).slice().forEach(k => { if (k.cid === a && ctOpen(k) && ctHave(k) >= k.q) { delta('vertraege', () => ctGive(k.id)); use('vertrag_lieferung'); } });
      // neue Aufträge: Fracht, die zu den Zielen passt, Besorgen, wenn die Ware billig zu haben ist
      freightOffers(a).slice().forEach(o => {
        if (ordWhy(o)) return;
        if (o.k === 'fracht' && CAP - used() >= o.q && o.pay / o.q > 12) { takeFreight(o.id); use('fracht'); }
        else if (o.k === 'besorgen') { const src = CITIES.filter(c => c.p.includes(o.g)); const cheap = src.length && Math.min(...src.map(c => unitPrice(baseE(c, o.g), G[o.g].b, c.id) * 1.06)); if (cheap && o.pay > cheap * o.q * 1.12) { takeFreight(o.id); use('besorgen'); } }
        else if (o.k === 'abholen' && o.days <= 5 && o.pay / o.q > 25) { takeFreight(o.id); use('abholen'); }
      });
      // Lieferverträge
      if (P.contracts) ctOffers(a).slice().forEach(o => {
        if (ctWhy(o)) return;
        const src = CITIES.filter(c => c.p.includes(o.g) && c.id !== a); if (!src.length) return;
        const near = src.filter(c => route(c.id, a, st.day).days <= 5); if (!near.length || o.q > CAP * 0.45 || route(st.home, a, st.day).days > 7) return;
        const cheap = Math.min(...near.map(c => unitPrice(baseE(c, o.g), G[o.g].b, c.id) * 1.06 + route(c.id, a, st.day).days * 2));
        if (o.price > cheap * 1.12) { ctTake(o.id); use('vertrag'); }
      });
    }
    // Werft: Mannschaft, Ausbessern, Waffen, neue Schiffe
    function yardHere() {
      if (st.fleet.some(sh => sh.hull < 75)) delta('werft', () => yard('repairall'));
      const want = Math.round(crewMin() + (crewMax() - crewMin()) * (st.rank >= 1 ? 0.55 : 0.2));
      if (st.crew < want) delta('werft', () => yard('sailor', want - st.crew));
      if (st.rank >= 1 && st.money > capital()) { const k0 = armsOf(st).armbrust || 0, mx = armMax('armbrust'), goal = Math.min(mx, Math.round(st.crew * 0.35)); if (goal > k0) delta('werft', () => buyArm('armbrust', goal - k0)); }
      if (st.rank >= 2 && st.money > capital() * 1.5) { const h0 = armsOf(st).harnisch || 0, goal = Math.round(st.crew * 0.3); if (goal > h0) delta('werft', () => buyArm('harnisch', goal - h0)); }
      // Schiffe: zuerst den eigenen Verband füllen, dann Verbände unter Kapitänen
      const pending = buildsOf().filter(b => b.arrive == null).length + dockOf().length;
      const total = st.fleet.length + (st.convoys || []).reduce((x, cv) => x + cv.fleet.length, 0) + pending;
      const cvRoom = (routesOpen() || ownBranches() > 0) && P.convoys ? Math.min(MAX_CONVOYS, P.maxConvoys) * (P.cvShips || 2) : 0;
      const maxShips = ownMax() + cvRoom;
      if (total >= maxShips || pending >= 2) return;
      const types = ['kraweel', 'holk', 'kogge', 'schnigge'].filter(t => (YARDS[st.loc] || []).includes(t) && st.rank >= SHIPS[t].rank);
      const forCv = st.fleet.length >= ownMax(); const tp = forCv && types.includes('kogge') ? 'kogge' : (types.find(t => t !== 'kraweel' || st.rank >= 4) || types[0]);
      if (!tp) return;
      const price = SHIPS[tp].price, need = price + capital();
      if (st.money < need && P.loans && st.rank >= TAKE_RANK && LENDER(st.loc) && st.money + loanRoom() >= need && (st.fleet.length < ownMax() || st.rank >= 2)) {
        const amt = Math.min(loanRoom(), Math.round((need - st.money + 200) / 100) * 100);
        const m = st.money; loanTake(amt, 12); if (st.money > m) { use('darlehen_genommen'); A.loanIn += st.money - m; add('kredit_kapital', st.money - m); }
      }
      if (st.money >= need && !buildWhy(tp)) { delta('invest_schiffe', () => yard('build', tp)); use('schiff_' + tp); }
    }
    // Zu Hause: Kontor, Verwalter, Betriebe, Schiffe vom Liegeplatz, Kapitäne und Verbände, Bauten
    function homeHere() {
      if (st.loc !== st.home) return;
      const ci = civicIdx(st.repute || 0);
      if (!st.kontor && ci >= 1 && st.money > KONTOR[1].cost + capital()) { delta('invest_bauten', () => kontorBuild()); use('kontor'); }
      if (st.kontor && st.kontor.lvl === 1 && ci >= 2 && (st.works || []).length >= 2 && st.money > KONTOR[2].cost + capital()) { delta('invest_bauten', () => kontorBuild()); use('kontor2'); }
      if (st.kontor && (st.works || []).length && !st.kontor.steward && st.money > 400 + capital()) { stewardSet(true); if (st.kontor.steward) { st.kontor.auto = true; use('verwalter'); } }
      if (st.city && st.city.open && P.works && canStartJob()) {
        const order = P.workOrder.filter(g => worksAllowed().includes(g));
        const have = (st.works || []).map(w => w.g).concat(cityJobs().filter(j => j.kind === 'work').map(j => j.g));
        const next = order.find(g => have.filter(x => x === g).length < (g === 'bier' ? 2 : 1));
        if (next && worksPlanned() < maxWorks() && st.money > WORKS[next].cost + capital() * 1.2) { delta('invest_bauten', () => buildWork(next)); use('betrieb_' + next); }
        else if (worksPlanned() >= maxWorks() && st.money > 8000 * EB + capital() * 2) { delta('invest_bauten', () => openPlot()); }
      }
      if (st.city && st.city.open && st.money > 15000 * EB + capital() * 2 && canStartJob()) { const lv = st.city.house || 1; if (HOUSE[lv + 1] && ci >= HOUSE[lv + 1].civic) delta('invest_bauten', () => upgradeHouse()); else ['kirche', 'kran', 'markt', 'mauer'].forEach(k => { if (canStartJob() && st.money > CIVIC_B[k].cost + capital() * 2) delta('invest_bauten', () => buildCivic(k)); }); }
      // Schiffe vom Liegeplatz
      dockOf().slice().forEach(sh => { if (st.fleet.length < ownMax()) dockToFleet(sh.id); });
      // Verbände unter Kapitänen
      if (P.convoys && routesOpen() && dockOf().length && (st.convoys || []).length < Math.min(MAX_CONVOYS, P.maxConvoys)) {
        let k = st.captains.find(x => !x.cv && x.id !== st.capOwn);
        if (!k && st.captains.length < MAX_CAPTAINS) { const t = tavern().slice().sort((x, y) => (y.trade + y.nav) - (x.trade + x.nav))[0]; if (t && st.money > t.fee + capital()) { delta('invest_kapitaene', () => hireCaptain(t.id)); k = st.captains.find(x => !x.cv && x.id !== st.capOwn); } }
        if (k) {
          const ships = dockOf().slice(0, P.cvShips || 2).map(sh => sh.id);
          const route = cvRoute();
          ui.form = {ships, cap:k.id, route, mode:'frei', tpl:'rund', rules:{}};
          const n0 = st.convoys.length; delta('invest_verband', () => formConvoy()); if (st.convoys.length > n0) use('verband'); else ui.form = null;
        }
      }
      // Verbände im Hafen mit freien Schiffen auffüllen
      (st.convoys || []).forEach(cv => { if (!cv.sail && cv.loc === st.home) dockOf().slice().forEach(sh => { if (cv.fleet.length < (P.cvShips || 2)) dockToConvoy(sh.id, cv.id); }); });
    }
    // gute Rundroute für einen Kapitän: Stammsitz und zwei Städte mit hohem Gefälle
    function cvRoute() {
      const h = st.home, eqB = (c, g) => unitPrice(baseE(C[c], g), G[g].b, c) * 1.06, eqS = (c, g) => unitPrice(baseE(C[c], g) + 1, G[g].b, c) * 0.94;
      let best = null, bv = -1; const taken = (st.convoys || []).map(cv => cv.route.slice(1).sort().join());
      CITIES.forEach(x => CITIES.forEach(y => { if (taken.includes([x.id, y.id].sort().join())) return;
        if (x.id === y.id || x.id === h || y.id === h || x.id === 'nowgorod' || y.id === 'nowgorod') return;
        const leg = (a, b) => Math.max(0, ...GOODS.map(g => eqS(b, g.id) - eqB(a, g.id)));
        const d = route(h, x.id, 0).days + route(x.id, y.id, 0).days + route(y.id, h, 0).days;
        const v = (leg(h, x.id) + leg(x.id, y.id) + leg(y.id, h)) / d;
        if (v > bv) { bv = v; best = [x.id, y.id]; }
      }));
      return best || ['danzig', 'bergen'];
    }
    // Niederlassung, Hansekontor, Geldgeschäfte
    function investHere() {
      const a = st.loc, ci = civicIdx(st.repute || 0);
      if (a !== st.home && ci >= BRANCH.civic && ownBranches() < Math.min(BRANCH.max, P.branches, st.rank >= 3 ? 3 : 1) && !(st.branches[a] && (st.branches[a].own || !st.branches[a].hk)) && st.money > BRANCH.cost + capital() && P.branchCities.includes(a)) { delta('invest_bauten', () => buildBranch()); use('niederlassung'); }
      if (P.kontore && HK[a] && !hkMember(a) && st.rank >= HK_RANK && st.money > HK[a].fee * 2 + capital() * 2) { delta('invest_kontor', () => hkJoin(a)); use('hansekontor'); }
      const O = finOffers(a), F = finState();
      // Ernte vorkaufen, wenn Geld übrig ist
      const idle = st.money - capital() * 2.2 - debt();
      if (P.crops) O.crops.slice().forEach(o => { if (idle > o.q * o.price && F.crops.length < CROP_MAX()) { delta('ernte', () => cropBuy(o.id)); use('vorkauf'); } });
      if (P.parts) O.parts.slice().forEach(o => { if (st.money - capital() * 2.5 - debt() > o.price && F.parts.length < PART_MAX()) { delta('parten_kapital', () => partBuy(o.id)); use('part'); } });
      if (P.lend) O.req.slice().forEach(o => { if (o.gr < 2 && st.money - capital() * 2.5 - debt() > o.amt && F.loans.filter(L => L.kind === 'give').length < GIVE_MAX()) { delta('kredit_kapital', () => loanGive(o.id)); use('darlehen_gegeben'); } });
      // Ware aus dem Vorkauf laden
      F.crops.filter(c => c.ready && c.cid === a).forEach(c => { const g0 = held(c.g); delta('ernte', () => cropLoad(c.id)); const q = held(c.g) - g0; if (q > 0) { A.src[c.g] = A.src[c.g] || {}; A.src[c.g].crop = (A.src[c.g].crop || 0) + q; } });
      // Vorhaben, Stiftungen, Gegner
      if (P.gv !== false && typeof gvStart === 'function') {
        if (a === st.home && st.rank >= GV_RANK && !gvState().job) { const k = GV_ORDER.find(x => !gvState().done[x]); if (k && st.money > GV[k].cost + capital() * 2.5 + debt()) { delta('vorhaben', () => gvStart(k)); use('vorhaben_' + k); } }
        if (st.rank >= GV_RANK && st.money > stiftCost() * 3 + capital() * 3 + debt() && (!A.stiftD || st.day - A.stiftD > 60)) { A.stiftD = st.day; delta('vorhaben', () => gvStift()); use('stiftung'); }
        if (st.rvPend && st.money > RV_REPLY + capital()) { delta('gegner', () => rvReply()); use('gegendarstellung'); }
        if (st.rivShown && P.politics !== false && st.mayor && !st.alderman) {
          const R2 = (st.rivals || []).slice().sort((x, y) => rivStand(y) - rivStand(x)), top = R2[0];
          if (top && rvRel(top) === 'neutral' && rivStand(top) <= standing() * 1.1 && st.money > rvBundCost() + capital() * 2) { delta('gegner', () => rvBund(top.id)); use('buendnis'); }
          const foe = R2.find(r => rvRel(r) !== 'bund' && rivStand(r) > standing() * 0.9);
          if (foe && rvRel(foe) === 'neutral' && st.money > capital() * 2) { rvFehde(foe.id); use('fehde'); }
          if (foe && rvRel(foe) === 'fehde' && st.money > RV_GEGEN + capital() * 2) { delta('gegner', () => rvGegen(foe.id)); use('gegenzug'); }
        }
      }
      // Schulden tilgen, wenn genug da ist
      F.loans.filter(L => L.kind === 'take').forEach(L => { if (st.money > loanOwed(L) + capital() * 1.6) { delta('kredit_kapital', () => loanRepay(L.id)); use('darlehen_getilgt'); } });
    }
    // Hansetag: für die eigenen Kontore stimmen
    function hanseHere() {
      const H = st.hanse; if (!H) return;
      Object.entries(H.votes).forEach(([id, v]) => { if (v.res) return; const V = VOTES[id]; if (!V) return;
        if (V.kontor && hkMember(V.kontor)) { if (!v.my && canVote()) castVote(id, 'ja'); if (st.money > capital() * 3 && (v.lobby || 0) < 0.2 - 1e-9) { delta('hansetag', () => hkLobby(id)); use('fuersprache'); } }
        else if (!v.my && canVote()) castVote(id, Math.random() < 0.6 ? 'ja' : 'nein'); });
    }
    // Seeräuber: fliehen, kämpfen oder zahlen. P.aim: Anteil Volltreffer und Treffer beim Zielen (Mensch: fast immer)
    function fight() {
      const e = st.enc, aim = P.aim || {crit:0.25, hit:0.55};
      const melee = att => { e.bd = {att, r:0, ctl:50, om:ownMor0(), f0:st.crew, init:att === 'own' && Math.random() < 0.2 ? 1 : 0}; for (let i = 0; i < 12; i++) { const o = meleeCore(e.bd.ctl >= 50 ? 'storm' : 'hold'); if (o.res !== 'go') return o.res; } return 'stall'; };
      const pickZ = () => { const r = Math.random(); return r < aim.crit ? 'crit' : r < aim.crit + aim.hit ? 'hit' : 'miss'; };
      const pickG = () => { const r = Math.random(); return r < 0.2 ? 'perf' : r < 0.75 ? 'good' : 'none'; };
      e.phase = 'tactic';
      for (let r = 0; r < 16; r++) {
        if (e.dist === 2 || (e.dist === 1 && pirEff(e) / Math.max(1, ownEff()) < 0.75)) { if (Math.random() < contest(e)) e.dist--; }
        if (e.dist === 0 && boardOdds('own') >= 0.6 && Math.random() < 0.72) { const m = melee('own'); if (m === 'win' || m === 'strike') { boardWin('board', ''); return 'win'; } }
        e.ammo = e.dist === 0 ? 'steine' : 'bolzen';
        const zs = []; for (let q = 0; q < rotten(); q++) zs.push(pickZ());
        volleyCore(zs);
        let o = pirTurn({defer:true}); if (o && o.res === 'fire') o = o.finish(pickG());
        if (!o) continue;
        if (o.res === 'board') { const m = melee('pir'); if (m === 'win' || m === 'strike') { boardWin('board', ''); return 'win'; } if (m === 'broken') { boardLost(''); return 'lost'; } e.phase = 'tactic'; continue; }
        if (o.res === 'empty' || o.res === 'sunk' || o.res === 'surrender') { winCore(o.res); return 'win'; }
        if (o.res === 'flee') { winCore('fled'); return 'win'; }
        if (o.res === 'dusk') return 'draw';
        if (!st.fleet.length || st.fleet.every(sh => sh.hull <= 10)) { boardLost(''); return 'lost'; }
      }
      return 'draw';
    }
    function encounter() {
      const e = st.enc, m = st.money, i0 = inv(), foc = !!st.focus;
      if (e.prey) { letGo(); }
      else {
        use(foc ? 'seeraeuber_v' : 'seeraeuber');
        if (e.fleet) use('seeraeuber_verband');
        if (typeof capAutoOk === 'function' && capAutoOk()) { capAuto(); use('kampf_auto'); }
        else if (!P.mutig && Math.random() < fleeChance()) { e.phase = 'escaped'; use('flucht'); }
        else if (P.mutig || (st.rank >= 1 && (st.crew >= e.n0 * (e.fleet ? 0.95 : 0.7) || (e.ransom > 1500 && st.crew >= e.n0 * 0.5)))) { const r = fight(); use((st.focus ? 'vkampf_' : 'kampf_') + r); }
        else { payTribute(); use('wegzoll'); }
      }
      if (st.enc && st.enc.prize) prizeAct(false);
      add(foc ? 'seeraeuber_verbaende' : 'seeraeuber', st.money - m + inv() - i0);
      if (st.enc) { if (busy) busy = false; resumeVoyage(); }
      if (timer) { clearTimeout(timer); timer = null; }
    }
    function sailDays() {
      for (let i = 0; i < 80; i++) {
        if (st.ev) { const m = st.money, i0 = inv(); evChoose(Math.floor(Math.random() * 3)); add('ereignisse', st.money - m + inv() - i0); use('ereignis'); continue; }
        if (st.enc) { encounter(); continue; }
        if (st.pendingFight && P.capFight && typeof capFight === 'function') { use('verband_angriff'); const m = st.money, i0 = inv(); capFight(); add('seeraeuber_verbaende', st.money - m + inv() - i0); continue; }
        if (st.pendingFight) { use('verband_angriff'); takeOver(); if (st.enc) { encounter(); } else st.pendingFight = null; continue; }
        if (!st.sail) break;
        tick(); if (timer) { clearTimeout(timer); timer = null; }
      }
    }
    function snap() {
      const F = st.fin || {parts:[], loans:[], crops:[]};
      A.series.push({d:st.day, w:Math.round(wealth()), m:Math.round(st.money), rank:st.rank, civic:civicIdx(st.repute || 0), rep:Math.round(st.repute || 0),
        ships:st.fleet.length, cvShips:(st.convoys || []).reduce((x, cv) => x + cv.fleet.length, 0), cv:(st.convoys || []).length, works:(st.works || []).length, br:ownBranches(), hk:hkCount(),
        debt:debt(), ehre:Math.round(st.ehre || 0), stand:typeof standing === 'function' ? standing() : 0, mayor:!!st.mayor, ald:!!st.alderman, aldR:!!st.aldRival, voy:A.voy});
    }
    // Meilensteine: erster Spieltag, an dem etwas erreicht ist
    function marks() {
      const M = A.marks, set = (k, ok) => { if (ok && M[k] == null) M[k] = st.day; };
      set('rank' + st.rank, true);
      set('civic' + civicIdx(st.repute || 0), true);
      set('betrieb', (st.works || []).length > 0);
      set('niederlassung', ownBranches() > 0);
      set('verband', (st.convoys || []).length > 0);
      set('buergermeister', !!st.mayor);
      set('aeltermann', !!st.alderman);
      set('aeltermann_gegner', !!st.aldRival);
    }
    function run(opt) {
      P = Object.assign({contracts:true, loans:true, kontore:true, parts:true, lend:true, crops:true, works:true, convoys:true, maxConvoys:4, branches:3, branchCities:['danzig', 'bergen', 'riga', 'stockholm', 'bruegge', 'london', 'visby', 'reval', 'hamburg'],
        capFight:true, workOrder:['bier', 'fass', 'tuch', 'salz', 'hering', 'holz', 'getreide', 'eisen', 'wachs', 'pelze'], days:1460, home:'luebeck', snapEvery:30}, opt || {});
      window.__fast = true;
      newGame({name:'Bot'}, P.home, {mode:P.mode || 'offen', origin:P.origin || 'kaufmann'});
      A = {mem:{}, rev:{}, prod:{}, cat:{}, use:{}, series:[], src:{}, age:{}, sales:0, loanIn:0, voy:0, marks:{}, trips:[], idle:0};
      const t0 = performance.now();
      let lastSnap = -99;
      while (st.day < P.days) {
        if (st.ended && !st.ended.cont) { st.ended.cont = true; }
        if (bankrupt()) { A.bankrupt = st.day; break; }
        if (st.day - lastSnap >= P.snapEvery) { snap(); lastSnap = st.day; }
        marks();
        if (!A.score && st.day >= CAMPAIGN_END) A.score = scoreParts();
        if (P.stopAt && A.marks[P.stopAt] != null) break;
        if (st.sail || st.enc || st.ev || st.pendingFight) { sailDays(); continue; }
        if (!st.fleet.length) { if (st.loc === st.home && st.money >= OLD_SHIP) yard('old'); else { simDay(); continue; } }
        // im Hafen
        if (st.ev) continue;
        A.mem[st.loc] = {d:st.day, s:Object.assign({}, st.stock[st.loc])};
        ordersHere(); storesOut(); inputsIn(); sellHere(); ordersHere(); yardHere(); homeHere(); investHere(); hanseHere();
        if (!canSail()) { const need = crewMin() - st.crew; if (need > 0) yard('sailor', need); if (minHull() < 20) yard('repairall'); if (!canSail()) { simDay(); A.idle++; continue; } }
        const P0 = dests(st.loc).map(plan).sort((x, y) => y.per - x.per)[0];
        if (!P0) { simDay(); continue; }
        Object.entries(P0.buys).forEach(([g, q]) => { doBuy(g, q); });
        A.trips.push({d:st.day, from:st.loc, to:P0.B, days:P0.days, gain:Math.round(P0.gain)});
        A.voy++;
        setSail(P0.B);
        if (timer) { clearTimeout(timer); timer = null; }
        if (!st.sail) { simDay(); continue; }
        sailDays();
      }
      marks(); snap();
      return {score:A.score || null, home:P.home, days:st.day, ms:Math.round(performance.now() - t0), wealth:Math.round(wealth()), money:Math.round(st.money), rank:st.rank, civic:civicIdx(st.repute || 0), repute:Math.round(st.repute || 0),
        marks:A.marks, cat:A.cat, use:A.use, series:A.series, voy:A.voy, idle:A.idle, bankrupt:A.bankrupt || null, mayor:!!st.mayor, alder:!!st.alderman,
        works:(st.works || []).map(w => [w.g, w.made]), convoys:(st.convoys || []).map(cv => ({route:cv.route, ships:cv.fleet.map(s => s.type), prof:Math.round(cv.prof), trips:cv.trips}))};
    }
    return {run};
  })();

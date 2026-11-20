/*
 * Game engine — pure rules and state, no DOM. Runs in the browser and in Node
 * (see tests/simulate.js). All randomness comes from a seeded RNG stored in the
 * state, so a saved game resumes exactly where it left off.
 */
(function (root) {
  'use strict';

  function createEngine(C) {
    const ITEM_IDS = Object.keys(C.items);
    const PARTS = ['wheel', 'axle', 'tongue'].filter(id => C.items[id]);
    const nodes = {};
    C.trail.nodes.forEach(n => { nodes[n.id] = n; });
    const illnessById = {};
    C.illnesses.forEach(i => { illnessById[i.id] = i; });

    // ---------- RNG (mulberry32) ----------
    function rand(s) {
      let t = (s.rng = (s.rng + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    const randInt = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
    const range = (s, r) => (Array.isArray(r) ? randInt(s, Math.min(r[0], r[1]), Math.max(r[0], r[1])) : r);
    const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
    function weighted(s, arr, w) {
      const total = arr.reduce((t, x) => t + Math.max(0, w(x)), 0);
      if (total <= 0) return null;
      let r = rand(s) * total;
      for (const x of arr) { r -= Math.max(0, w(x)); if (r < 0) return x; }
      return arr[arr.length - 1];
    }

    // ---------- helpers ----------
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const round2 = v => Math.round(v * 100) / 100;
    const round1 = v => Math.round(v * 10) / 10;
    const fmt = (str, vars) => String(str || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
    const money = v => '$' + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, '');
    const noun = (id, n) => { const it = C.items[id]; return (it.noun ? it.noun[n === 1 ? 0 : 1] : it.label.toLowerCase()); };
    const living = s => s.party.filter(p => p.alive);
    const paceOf = s => C.paces.find(p => p.id === s.pace) || C.paces[0];
    const rationOf = s => C.rations.find(r => r.id === s.rations) || C.rations[0];
    const dateOf = s => new Date(Date.UTC(C.year, s.startMonth - 1, 1 + s.day));
    const month = s => dateOf(s).getUTCMonth() + 1;
    const maxOf = id => (C.items[id].max != null ? C.items[id].max : Infinity);

    function healthKey(h) { return h >= 75 ? 'good' : h >= 50 ? 'fair' : h >= 25 ? 'poor' : 'verypoor'; }
    const HEALTH_LABEL = { good: 'Good', fair: 'Fair', poor: 'Poor', verypoor: 'Very poor' };
    function partyHealth(s) {
      const a = living(s);
      if (!a.length) return 0;
      // the sickest members drag the group down, like a wagon only as fast as its slowest ox
      const avg = a.reduce((t, p) => t + p.health, 0) / a.length;
      const min = Math.min(...a.map(p => p.health));
      return Math.round(avg * 0.6 + min * 0.4);
    }
    function tempLabel(t) {
      return t >= 90 ? 'Very hot' : t >= 72 ? 'Hot' : t >= 50 ? 'Warm' : t >= 32 ? 'Cool' : t >= 10 ? 'Cold' : 'Very cold';
    }

    function log(s, text, tone) {
      s.log.unshift({ day: s.day, text, tone: tone || 'neutral' });
      if (s.log.length > 80) s.log.length = 80;
    }
    function notice(s, title, body, tone) {
      s.pending.push({ type: 'notice', title, body, tone: tone || 'neutral' });
    }

    // ---------- setup ----------
    function newGame(seed) {
      const inv = {};
      ITEM_IDS.forEach(id => { inv[id] = 0; });
      return {
        v: 1,
        status: 'setup',
        rng: (seed != null ? seed : Math.floor(Math.random() * 4294967296)) >>> 0,
        profession: null,
        money: 0,
        party: [],
        inv,
        pace: C.paces[0].id,
        rations: C.rations[0].id,
        startMonth: 4,
        day: 0,
        mile: 0,
        lastMiles: 0,
        nodeId: C.trail.start,
        route: [{ id: C.trail.start, mile: 0, day: 0 }],
        segment: null,
        weather: { temp: 60, sky: 'clear' },
        starving: false,
        traveling: false,
        pending: [],
        log: [],
        deaths: 0,
        score: null,
      };
    }
    function setProfession(s, id) {
      const p = C.professions.find(x => x.id === id);
      if (!p) return;
      s.profession = id;
      s.money = p.money;
    }
    function setParty(s, names) {
      s.party = names.slice(0, C.partySize).map((n, i) => ({
        name: String(n || '').trim().slice(0, 24) || C.suggestedNames[i % C.suggestedNames.length],
        health: 100, alive: true, illness: null, illDays: 0,
      }));
    }
    function setMonth(s, m) { s.startMonth = m; }
    function begin(s) {
      s.status = 'playing';
      rollWeather(s);
      log(s, `Your party sets out from ${nodes[s.nodeId].name}.`);
    }

    // ---------- store ----------
    function canShop(s) { return !s.segment && !!nodes[s.nodeId].store; }
    function storeList(s) {
      const f = canShop(s) ? nodes[s.nodeId].store.priceFactor : 1;
      return ITEM_IDS.filter(id => C.items[id].price != null).map(id => {
        const it = C.items[id];
        return {
          id, label: it.label, unit: it.storeUnit || noun(id, 1), pack: it.pack || 1, step: it.step || 1,
          price: round2(it.price * f), have: s.inv[id], max: maxOf(id), hint: it.hint || '',
        };
      });
    }
    function cartTotal(s, cart) {
      return round2(storeList(s).reduce((t, row) => t + Math.max(0, Math.floor(cart[row.id] || 0)) * row.price, 0));
    }
    function buy(s, cart) {
      if (!canShop(s)) return { error: 'There is no store here.' };
      const list = storeList(s);
      for (const row of list) {
        const q = Math.max(0, Math.floor(cart[row.id] || 0));
        if (s.inv[row.id] + q * row.pack > row.max) {
          return { error: `Your wagon can only hold ${row.max} ${noun(row.id, row.max)}.` };
        }
      }
      const total = cartTotal(s, cart);
      if (total > s.money + 1e-9) return { error: `That comes to ${money(total)}, but you only have ${money(s.money)}.` };
      const bought = [];
      for (const row of list) {
        const q = Math.max(0, Math.floor(cart[row.id] || 0));
        if (!q) continue;
        s.inv[row.id] += q * row.pack;
        bought.push(`${q * row.pack} ${noun(row.id, q * row.pack)}`);
      }
      s.money = round2(s.money - total);
      if (bought.length) log(s, `Bought ${bought.join(', ')} for ${money(total)}.`);
      return { ok: true, total };
    }

    // ---------- weather & terrain ----------
    function currentTerrain(s) {
      if (s.segment) return s.segment.terrain;
      const n = nodes[s.nodeId];
      return (n.next && n.next[0] && n.next[0].terrain) || 'plains';
    }
    function rollWeather(s) {
      const m = month(s);
      const terr = C.terrains[currentTerrain(s)] || {};
      const temp = Math.round(C.weather.temp[m] - (terr.cold || 0) + randInt(s, -12, 12));
      let sky = 'clear';
      if (rand(s) < C.weather.precip[m]) {
        const heavy = rand(s) < 0.3;
        sky = temp <= 32 ? (heavy ? 'heavy snow' : 'snow') : (heavy ? 'heavy rain' : 'rain');
      } else if (rand(s) < 0.3) sky = 'cloudy';
      s.weather = { temp, sky };
    }
    function dailyMiles(s) {
      const pace = paceOf(s);
      const oxFactor = Math.min(1, 0.4 + s.inv.oxen * 0.1);
      const terr = (C.terrains[currentTerrain(s)] || {}).speed || 1;
      const sky = s.weather.sky;
      const wx = sky === 'heavy snow' ? 0.35 : sky === 'snow' ? 0.65 : sky === 'heavy rain' ? 0.8 : 1;
      const sick = living(s).filter(p => p.illness).length;
      const sickFactor = sick >= 3 ? 0.85 : 1;
      return Math.max(1, Math.round(pace.miles * oxFactor * terr * wx * sickFactor * (0.9 + rand(s) * 0.2)));
    }

    // ---------- health ----------
    function makeSick(s, p, illnessId) {
      const ill = illnessById[illnessId] ||
        weighted(s, C.illnesses, i => (i.weight == null ? 1 : i.weight));
      if (!ill) return null;
      p.illness = ill.id;
      p.illDays = range(s, ill.days);
      return ill;
    }
    function die(s, p, text) {
      if (!p.alive) return;
      p.alive = false;
      p.health = 0;
      s.deaths++;
      const ill = p.illness && illnessById[p.illness];
      const body = text || (ill ? fmt(ill.deathText || '{name} has died of {illness}.', { name: p.name, illness: ill.name }) : `${p.name} has died.`);
      p.illness = null;
      notice(s, `${p.name} has died`, body, 'death');
      log(s, body, 'death');
      if (!living(s).length) finish(s, 'lost');
    }
    function hurt(s, p, d) {
      if (!p.alive) return;
      p.health = clamp(p.health + d, 0, 100);
      if (p.health <= 0) die(s, p);
    }
    function healthTick(s, mode) {
      const alive = living(s);
      const cold = s.weather.temp < 32;
      const clothingEach = alive.length ? s.inv.clothing / alive.length : 0;
      const ration = rationOf(s);
      for (const p of alive) {
        let d = s.starving ? -5 : ration.health;
        if (mode === 'travel') d += paceOf(s).health;
        if (mode === 'rest') d += 3;
        if (cold && clothingEach < 2) d -= (s.weather.temp < 10 ? 3 : 1.5) * (clothingEach < 1 ? 1.6 : 1);
        if (s.weather.temp >= 90) d -= 1;
        if (s.weather.sky.startsWith('heavy')) d -= 0.5;
        if (p.illness) {
          const ill = illnessById[p.illness];
          d -= ill ? ill.severity : 2;
          p.illDays--;
          if (p.illDays <= 0) {
            if (rand(s) < (mode === 'rest' ? 0.75 : 0.45)) {
              log(s, `${p.name} has recovered from ${ill ? ill.name : 'illness'}.`, 'good');
              p.illness = null;
            } else {
              p.illDays = 2;
            }
          }
        } else {
          d += 1;
        }
        p.health = clamp(p.health + d, 0, 100);
        if (p.health <= 0) { die(s, p); continue; }
        if (!p.illness) {
          let chance = 0.004;
          if (p.health < 50) chance += 0.02;
          if (p.health < 25) chance += 0.03;
          if (s.starving) chance += 0.02;
          if (mode === 'rest') chance /= 2;
          if (rand(s) < chance) {
            const ill = makeSick(s, p);
            if (ill) {
              notice(s, 'Illness', `${p.name} has ${ill.name}.`, 'bad');
              log(s, `${p.name} has ${ill.name}.`, 'bad');
            }
          }
        }
      }
    }

    // A day passes. mode: 'travel' | 'rest' | 'wait' (camping for a reason other than rest)
    function passDay(s, mode) {
      if (s.status !== 'playing') return;
      s.day++;
      rollWeather(s);
      const alive = living(s);
      const need = alive.length * rationOf(s).lbs;
      s.starving = alive.length > 0 && s.inv.food < need;
      s.inv.food = Math.max(0, Math.round(s.inv.food - need));
      if (s.starving) log(s, 'You have run out of food.', 'bad');
      healthTick(s, mode);
    }

    // ---------- events ----------
    function eligible(s, e, terrain) {
      const c = e.when || {};
      if (c.terrain ? !c.terrain.includes(terrain) : terrain === 'river') return false;
      if (c.months && !c.months.includes(month(s))) return false;
      if (c.minMile != null && s.mile < c.minMile) return false;
      if (c.maxMile != null && s.mile > c.maxMile) return false;
      if (c.pace && !c.pace.includes(s.pace)) return false;
      if (c.minTemp != null && s.weather.temp < c.minTemp) return false;
      if (c.maxTemp != null && s.weather.temp > c.maxTemp) return false;
      if (c.sky && !c.sky.includes(s.weather.sky)) return false;
      if (c.needs) for (const k of Object.keys(c.needs)) if ((s.inv[k] || 0) < c.needs[k]) return false;
      return true;
    }
    function applyEffect(s, fx, vars, extra) {
      switch (fx.op) {
        case 'item': {
          let n = range(s, fx.amount);
          n = n < 0 ? -Math.min(-n, s.inv[fx.item]) : Math.min(n, maxOf(fx.item) - s.inv[fx.item]);
          s.inv[fx.item] += n;
          vars.amount = Math.abs(n);
          vars.item = noun(fx.item, Math.abs(n));
          break;
        }
        case 'itemPct': {
          const n = Math.round(s.inv[fx.item] * range(s, fx.pct) / 100);
          s.inv[fx.item] -= n;
          vars.amount = n;
          vars.item = noun(fx.item, n);
          break;
        }
        case 'days': {
          const d = range(s, fx.amount);
          vars.days = d;
          for (let i = 0; i < d; i++) passDay(s, 'wait');
          break;
        }
        case 'health': {
          const d = range(s, fx.amount);
          const who = fx.who === 'all' ? living(s) : [vars._p];
          who.forEach(p => p && hurt(s, p, d));
          break;
        }
        case 'sick': {
          const p = fx.who === 'all' ? null : vars._p;
          if (p && p.alive) {
            const ill = makeSick(s, p, fx.illness);
            if (ill) vars.illness = ill.name;
          }
          break;
        }
        case 'break': {
          const part = pick(s, PARTS);
          vars.part = noun(part, 1);
          if (s.inv[part] > 0) {
            s.inv[part]--;
            extra.push(fmt(C.text.usedSpare, vars));
          } else {
            const d = randInt(s, 2, 4);
            vars.days = d;
            for (let i = 0; i < d; i++) passDay(s, 'wait');
            extra.push(fmt(C.text.noSpare, vars));
          }
          break;
        }
        default:
          break;
      }
    }
    function runEvent(s, ev) {
      const alive = living(s);
      if (!alive.length) return;
      const p = pick(s, alive);
      const vars = { name: p.name, _p: p };
      const extra = [];
      // queue the event notice ahead of any deaths its effects cause
      const slot = { type: 'notice', title: '', body: '', tone: ev.tone || 'neutral' };
      s.pending.push(slot);
      for (const fx of ev.effects || []) applyEffect(s, fx, vars, extra);
      slot.title = fmt(ev.title || 'On the trail', vars);
      slot.body = [fmt(ev.text, vars)].concat(extra).join(' ');
      log(s, slot.body, ev.tone);
    }
    function maybeEvent(s) {
      const terrain = currentTerrain(s);
      const t = C.terrains[terrain] || {};
      const chance = t.eventChance != null ? t.eventChance : 0.13;
      if (rand(s) >= chance) return;
      const pool = C.events.filter(e => eligible(s, e, terrain));
      const ev = weighted(s, pool, e => (e.weight == null ? 1 : e.weight));
      if (ev) runEvent(s, ev);
    }

    // ---------- travel ----------
    function startSegment(s, opt) {
      if (opt.toll) s.money = round2(s.money - opt.toll);
      s.segment = { from: s.nodeId, to: opt.to, miles: opt.miles, done: 0, terrain: opt.terrain || 'plains' };
    }
    function arrive(s, id) {
      const node = nodes[id];
      s.nodeId = id;
      s.segment = null;
      s.route.push({ id, mile: s.mile, day: s.day });
      s.traveling = false;
      log(s, `Arrived at ${node.name}.`, 'arrive');
      if (node.type === 'end') { finish(s, 'won'); return; }
      s.pending.push({ type: 'notice', title: node.name, body: node.blurb || '', tone: 'arrive', node: id });
      if (node.river) s.pending.push(makeRiver(s, node));
    }
    function travelDay(s, opts) {
      opts = opts || {};
      if (s.status !== 'playing' || s.pending.length) return;
      if (!s.segment) {
        const node = nodes[s.nodeId];
        if (!node.next || !node.next.length) return;
        if (node.next.length > 1) {
          s.traveling = false;
          s.pending.push({ type: 'fork', node: node.id });
          return;
        }
        startSegment(s, node.next[0]);
      }
      if (s.inv.oxen <= 0) {
        s.traveling = false;
        notice(s, 'Stranded', C.text.noOxen, 'bad');
        return;
      }
      const before = s.mile;
      passDay(s, 'travel');
      if (s.status !== 'playing') return;
      const miles = Math.min(dailyMiles(s), s.segment.miles - s.segment.done);
      s.segment.done += miles;
      s.mile += miles;
      s.lastMiles = miles;
      (opts.graves || []).forEach(g => {
        if (g.mile > before && g.mile <= s.mile) {
          notice(s, C.text.graveTitle, fmt(C.text.graveText, { name: g.name, epitaph: g.epitaph || '' }), 'grave');
        }
      });
      if (s.segment.done >= s.segment.miles) { arrive(s, s.segment.to); return; }
      maybeEvent(s);
    }
    function forkOptions(s) {
      const node = nodes[s.nodeId];
      return (node.next || []).map((o, i) => ({
        index: i, label: o.label || `Go to ${nodes[o.to].name}`, note: o.note || '',
        miles: o.miles, toll: o.toll || 0, to: o.to, affordable: !o.toll || s.money >= o.toll,
      }));
    }
    function chooseFork(s, index) {
      const top = s.pending[0];
      if (!top || top.type !== 'fork') return { error: 'There is no fork here.' };
      const opt = nodes[s.nodeId].next[index];
      if (!opt) return { error: 'Not a valid choice.' };
      if (opt.toll && s.money < opt.toll) return { error: `You need ${money(opt.toll)} for the toll.` };
      s.pending.shift();
      startSegment(s, opt);
      log(s, opt.label ? `You chose to ${opt.label.charAt(0).toLowerCase()}${opt.label.slice(1)}.` : `You head for ${nodes[opt.to].name}.`);
      return { ok: true };
    }

    // ---------- rivers ----------
    function makeRiver(s, node) {
      const r = node.river;
      const m = month(s);
      const season = m <= 5 ? 1.2 : m <= 7 ? 1 : 0.8;
      return {
        type: 'river', node: node.id,
        width: randInt(s, r.width[0], r.width[1]),
        depth: round1((r.depth[0] + rand(s) * (r.depth[1] - r.depth[0])) * season),
        swift: rand(s) < (r.swift != null ? r.swift : 0.3),
      };
    }
    function capsize(s, bad) {
      const lines = [C.text.capsize];
      const losable = ['food', 'clothing', 'bullets', 'wheel', 'axle', 'tongue'].filter(id => s.inv[id] > 0);
      const lost = [];
      const count = Math.min(losable.length, randInt(s, 2, 3));
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(rand(s) * losable.length);
        const id = losable.splice(idx, 1)[0];
        const n = Math.max(1, Math.round(s.inv[id] * (0.2 + rand(s) * 0.4)));
        s.inv[id] -= n;
        lost.push(`${n} ${noun(id, n)}`);
      }
      if (s.inv.oxen > 1 && rand(s) < 0.25) { s.inv.oxen--; lost.push('1 ox'); }
      if (lost.length) lines.push(`You lost ${lost.join(', ')}.`);
      if (bad && rand(s) < 0.3) {
        const p = pick(s, living(s));
        if (p) {
          lines.push(`${p.name} was swept away and drowned.`);
          die(s, p, `${p.name} drowned in the river.`);
          // drop the separate death notice; it's part of the crossing report
          const i = s.pending.findIndex(x => x.type === 'notice' && x.tone === 'death' && x.body.indexOf(p.name + ' drowned') === 0);
          if (i >= 0) s.pending.splice(i, 1);
        }
      }
      return { text: lines.join(' '), tone: 'bad' };
    }
    function crossRiver(s, method) {
      const rv = s.pending[0];
      if (!rv || rv.type !== 'river') return { error: 'There is no river to cross.' };
      const r = nodes[rv.node].river;
      if (method === 'wait') {
        passDay(s, 'wait');
        rv.depth = round1(Math.max(0.8, rv.depth + (rand(s) - 0.6) * 0.6));
        log(s, `You camped a day beside the ${r.name}. It is now ${rv.depth} feet deep.`);
        if (s.status !== 'playing') s.pending.splice(s.pending.indexOf(rv), 1);
        return { ok: true, stay: true };
      }
      let out;
      if (method === 'ferry') {
        if (!r.ferry) return { error: 'There is no ferry here.' };
        if (s.money < r.ferry.cost) return { error: `The ferry costs ${money(r.ferry.cost)}. You have ${money(s.money)}.` };
        s.money = round2(s.money - r.ferry.cost);
        const wait = range(s, r.ferry.wait);
        for (let i = 0; i < wait; i++) passDay(s, 'wait');
        out = rand(s) < 0.04 ? capsize(s, false) : { text: fmt(C.text.ferryOk, { days: wait }), tone: 'good' };
      } else if (method === 'guide') {
        const g = r.guide;
        if (!g) return { error: 'There is no guide here.' };
        if (s.inv[g.item] < g.cost) return { error: `The guide wants ${g.cost} ${noun(g.item, g.cost)}. You don't have enough.` };
        s.inv[g.item] -= g.cost;
        out = rand(s) < 0.05 ? capsize(s, false) : { text: C.text.guideOk, tone: 'good' };
      } else if (method === 'ford') {
        const d = rv.depth;
        if (d <= 2.5) out = { text: C.text.fordOk, tone: 'good' };
        else if (d <= 3) { passDay(s, 'wait'); out = { text: C.text.fordWet, tone: 'neutral' }; }
        else {
          const p = Math.min(0.85, 0.3 + (d - 3) * 0.2 + (rv.swift ? 0.1 : 0));
          out = rand(s) < p ? capsize(s, true) : { text: C.text.fordOk, tone: 'good' };
        }
      } else if (method === 'caulk') {
        const p = 0.1 + (rv.swift ? 0.2 : 0) + (rv.depth > 8 ? 0.15 : 0);
        out = rand(s) < p ? capsize(s, rv.swift) : { text: C.text.caulkOk, tone: 'good' };
      } else {
        return { error: 'Unknown choice.' };
      }
      const idx = s.pending.indexOf(rv);
      if (idx >= 0) s.pending.splice(idx, 1);
      s.pending.unshift({ type: 'notice', title: `Crossing the ${r.name}`, body: out.text, tone: out.tone });
      log(s, out.text, out.tone);
      return { ok: true };
    }
    function riverOptions(s) {
      const rv = s.pending[0];
      if (!rv || rv.type !== 'river') return [];
      const r = nodes[rv.node].river;
      const opts = [
        { id: 'ford', label: 'Ford the river', note: 'Drive straight through. Safe if the water is shallow.' },
        { id: 'caulk', label: 'Caulk the wagon and float it', note: 'Seal it up like a boat. Works in deep water, but risky in a swift current.' },
      ];
      if (r.ferry) opts.push({ id: 'ferry', label: `Take the ferry (${money(r.ferry.cost)})`, note: `Safest. You may wait ${r.ferry.wait[0]}–${r.ferry.wait[1]} days.`, disabled: s.money < r.ferry.cost });
      if (r.guide) opts.push({ id: 'guide', label: r.guide.label, note: r.guide.note || '', disabled: s.inv[r.guide.item] < r.guide.cost });
      opts.push({ id: 'wait', label: 'Wait a day', note: 'See whether the water drops.' });
      return opts;
    }

    // ---------- camp actions ----------
    function rest(s, days) {
      let n = 0;
      for (let i = 0; i < days && s.status === 'playing'; i++) { passDay(s, 'rest'); n++; }
      if (n) log(s, `You rested for ${n} day${n === 1 ? '' : 's'}.`);
    }
    function setPace(s, id) { if (C.paces.some(p => p.id === id)) { s.pace = id; log(s, `Pace changed to ${paceOf(s).name.toLowerCase()}.`); } }
    function setRations(s, id) { if (C.rations.some(r => r.id === id)) { s.rations = id; log(s, `Rations changed to ${rationOf(s).name.toLowerCase()}.`); } }
    function talk(s) {
      const node = nodes[s.nodeId];
      if (s.segment || !node.talk || !node.talk.length) return null;
      const t = pick(s, node.talk);
      return { speaker: t[0], text: t[1] };
    }
    function canTalk(s) { return !s.segment && !!(nodes[s.nodeId].talk || []).length; }

    function tradeAttempt(s) {
      if (s.status !== 'playing' || s.pending.length) return;
      passDay(s, 'wait');
      if (s.status !== 'playing') return;
      const offer = rand(s) < 0.2 ? null : makeOffer(s);
      if (!offer) { notice(s, 'Trading', C.text.noTrade, 'neutral'); return; }
      s.pending.push(Object.assign({ type: 'trade' }, offer));
    }
    function makeOffer(s) {
      const tradables = ITEM_IDS.filter(id => C.items[id].value);
      const needWeight = id => {
        if (id === 'oxen') return s.inv.oxen < 3 ? 6 : 1.5;
        if (PARTS.includes(id)) return s.inv[id] === 0 ? 1.5 : 0.5;
        if (id === 'food') return s.inv.food < 200 ? 4 : 2;
        return 1.5;
      };
      for (let tries = 0; tries < 15; tries++) {
        const get = weighted(s, tradables, needWeight);
        const gi = C.items[get];
        const getQty = Math.max(1, range(s, gi.tradeQty || [1, 1]));
        if (s.inv[get] + getQty > maxOf(get)) continue;
        const value = getQty * gi.value * (0.9 + rand(s) * 0.8);
        const choices = tradables.filter(id => id !== get && s.inv[id] > 0);
        if (!choices.length) return null;
        const give = pick(s, choices);
        const giveQty = Math.max(1, Math.round(value / C.items[give].value));
        if (giveQty > s.inv[give]) continue;
        if (give === 'oxen' && s.inv.oxen - giveQty < 1) continue;
        return { get: { item: get, qty: getQty, label: `${getQty} ${noun(get, getQty)}` },
                 give: { item: give, qty: giveQty, label: `${giveQty} ${noun(give, giveQty)}` } };
      }
      return null;
    }
    function resolveTrade(s, accept) {
      const t = s.pending[0];
      if (!t || t.type !== 'trade') return { error: 'No trade on the table.' };
      s.pending.shift();
      if (!accept) { log(s, 'You turned down a trade.'); return { ok: true }; }
      if (s.inv[t.give.item] < t.give.qty) return { error: 'You no longer have enough to trade.' };
      s.inv[t.give.item] -= t.give.qty;
      s.inv[t.get.item] = Math.min(maxOf(t.get.item), s.inv[t.get.item] + t.get.qty);
      log(s, `Traded ${t.give.label} for ${t.get.label}.`, 'good');
      return { ok: true };
    }

    function hunt(s, result) {
      if (s.status !== 'playing') return;
      const shots = Math.max(0, Math.floor(result.shots || 0));
      const lbs = Math.max(0, Math.floor(result.lbs || 0));
      s.inv.bullets = Math.max(0, s.inv.bullets - shots);
      passDay(s, 'wait');
      const room = maxOf('food') - s.inv.food;
      const kept = Math.max(0, Math.min(lbs, C.hunting.carry, room));
      s.inv.food += kept;
      let body;
      if (!lbs) body = `You fired ${shots} shot${shots === 1 ? '' : 's'} and came back empty-handed.`;
      else if (kept < lbs) body = `You shot ${lbs} pounds of meat, but could only carry ${kept} pounds back to the wagon.`;
      else body = `You brought back ${kept} pounds of meat.`;
      s.pending.unshift({ type: 'notice', title: 'Hunting', body, tone: lbs ? 'good' : 'neutral' });
      log(s, body, lbs ? 'good' : 'neutral');
    }

    function dismiss(s) {
      const top = s.pending[0];
      if (top && top.type === 'notice') s.pending.shift();
    }

    // ---------- end & scoring ----------
    function finish(s, result) {
      if (s.status === 'won' || s.status === 'lost') return;
      s.status = result;
      s.traveling = false;
      if (result === 'won') s.score = scoreBreakdown(s);
    }
    function rankFor(score) {
      const r = C.ranks.find(x => score >= x.min);
      return r ? r.title : '';
    }
    function scoreBreakdown(s) {
      const sc = C.scoring;
      const rows = [];
      living(s).forEach(p => {
        const k = healthKey(p.health);
        rows.push({ label: `${p.name} (${HEALTH_LABEL[k].toLowerCase()} health)`, points: sc.health[k] });
      });
      rows.push({ label: 'Wagon', points: sc.wagon });
      rows.push({ label: `${s.inv.oxen} ${noun('oxen', s.inv.oxen)}`, points: s.inv.oxen * sc.perOx });
      const parts = PARTS.reduce((t, id) => t + s.inv[id], 0);
      rows.push({ label: `${parts} spare part${parts === 1 ? '' : 's'}`, points: parts * sc.perPart });
      rows.push({ label: `${s.inv.clothing} ${noun('clothing', s.inv.clothing)}`, points: s.inv.clothing * sc.perClothing });
      rows.push({ label: `${s.inv.bullets} ${noun('bullets', s.inv.bullets)}`, points: Math.floor(s.inv.bullets / sc.bulletsPerPoint) });
      rows.push({ label: `${s.inv.food} ${noun('food', s.inv.food)}`, points: Math.floor(s.inv.food / sc.foodPerPoint) });
      rows.push({ label: `${money(s.money)} cash`, points: Math.floor(s.money / sc.moneyPerPoint) });
      const subtotal = rows.reduce((t, r) => t + r.points, 0);
      const prof = C.professions.find(p => p.id === s.profession) || { multiplier: 1, name: '' };
      const total = subtotal * prof.multiplier;
      return { rows, subtotal, multiplier: prof.multiplier, profession: prof.name, total, rank: rankFor(total) };
    }

    // ---------- views of state ----------
    function routePlan(s) {
      const pts = s.route.map(r => ({ id: r.id, mile: r.mile, visited: true }));
      let id = null, mile = s.mile;
      if (s.segment) { id = s.segment.to; mile = s.mile - s.segment.done + s.segment.miles; }
      else {
        const n = nodes[s.nodeId];
        if (n.next && n.next.length) { id = n.next[0].to; mile = s.mile + n.next[0].miles; }
      }
      let guard = 0;
      while (id && guard++ < 100) {
        const n = nodes[id];
        pts.push({ id, mile, visited: false });
        if (!n.next || !n.next.length) break;
        mile += n.next[0].miles;
        id = n.next[0].to;
      }
      pts.forEach(p => { const n = nodes[p.id]; p.name = n.name; p.short = n.short || n.name; p.type = n.type; });
      return { points: pts, total: pts[pts.length - 1].mile };
    }
    function nextLandmark(s) {
      if (s.segment) return { name: nodes[s.segment.to].name, miles: s.segment.miles - s.segment.done };
      const n = nodes[s.nodeId];
      if (!n.next || !n.next.length) return null;
      if (n.next.length > 1) return { name: 'Fork in the trail', miles: 0 };
      return { name: nodes[n.next[0].to].name, miles: n.next[0].miles };
    }
    function summary(s) {
      const h = partyHealth(s);
      const alive = living(s).length;
      const perDay = alive * rationOf(s).lbs;
      return {
        date: dateOf(s),
        weather: s.weather,
        tempLabel: tempLabel(s.weather.temp),
        health: h,
        healthLabel: HEALTH_LABEL[healthKey(h)],
        healthKey: healthKey(h),
        foodDays: perDay ? Math.floor(s.inv.food / perDay) : 0,
        next: nextLandmark(s),
        terrain: currentTerrain(s),
        terrainName: (C.terrains[currentTerrain(s)] || {}).name || '',
        atNode: !s.segment,
        node: nodes[s.nodeId],
        pace: paceOf(s),
        rations: rationOf(s),
      };
    }

    return {
      C, nodes, newGame, setProfession, setParty, setMonth, begin,
      storeList, cartTotal, buy, canShop,
      travelDay, rest, setPace, setRations, talk, canTalk,
      tradeAttempt, resolveTrade, hunt, dismiss,
      forkOptions, chooseFork, riverOptions, crossRiver,
      summary, routePlan, partyHealth, healthKey, healthLabel: k => HEALTH_LABEL[k],
      living, noun, money, fmt, dateOf, tempLabel, currentTerrain,
      rand, randInt, pick, weighted,
    };
  }

  root.OT = { createEngine };
})(typeof window !== 'undefined' ? window : globalThis);

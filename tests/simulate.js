// Plays thousands of games with bots to catch crashes, soft-locks, and bad balance.
// Usage: node tests/simulate.js [games]
require('../js/content.js');
require('../js/engine.js');
const C = globalThis.OT_CONTENT;
const E = globalThis.OT.createEngine(C);

const GAMES = Number(process.argv[2] || 3000);

function check(s, where) {
  for (const [k, v] of Object.entries(s.inv)) {
    if (!Number.isFinite(v) || v < 0) throw new Error(`${where}: bad inv.${k}=${v}`);
  }
  if (!Number.isFinite(s.money) || s.money < -0.001) throw new Error(`${where}: bad money ${s.money}`);
  for (const p of s.party) {
    if (!Number.isFinite(p.health) || p.health < 0 || p.health > 100) throw new Error(`${where}: bad health ${p.health}`);
  }
  if (!Number.isFinite(s.mile)) throw new Error(`${where}: bad mile`);
  JSON.parse(JSON.stringify(s)); // must stay serializable for saves
}

// strategy: 'smart' plays sensibly, 'random' mashes buttons
function play(seed, strategy) {
  const s = E.newGame(seed);
  const r = () => E.rand(s);
  const prof = strategy === 'smart' ? E.pick(s, C.professions).id : E.pick(s, C.professions).id;
  E.setProfession(s, prof);
  E.setParty(s, ['A', 'B', 'C', 'D', 'E']);
  E.setMonth(s, strategy === 'smart' ? 4 : E.pick(s, C.months).id);
  if (strategy === 'smart') {
    const m = s.money;
    const cart = m >= 1000 ? { oxen: 8, food: 1200, clothing: 10, bullets: 10, wheel: 1, axle: 1, tongue: 1 }
      : m >= 700 ? { oxen: 6, food: 1000, clothing: 10, bullets: 5, wheel: 1, axle: 1, tongue: 1 }
      : { oxen: 6, food: 700, clothing: 5, bullets: 4, wheel: 0, axle: 0, tongue: 0 };
    let res = E.buy(s, cart);
    if (res.error) throw new Error('smart buy failed: ' + res.error);
  } else {
    E.buy(s, { oxen: E.randInt(s, 0, 8), food: E.randInt(s, 0, 1500), clothing: E.randInt(s, 0, 10), bullets: E.randInt(s, 0, 20) });
  }
  E.begin(s);

  let steps = 0;
  let stuck = 0;
  while (s.status === 'playing') {
    if (++steps > 5000) throw new Error(`seed ${seed}: too many steps (day ${s.day}, mile ${s.mile})`);
    const top = s.pending[0];
    if (top) {
      if (top.type === 'notice') E.dismiss(s);
      else if (top.type === 'river') {
        const opts = E.riverOptions(s).filter(o => !o.disabled);
        let choice;
        if (strategy === 'smart') {
          choice = top.depth <= 2.5 ? 'ford' : opts.find(o => o.id === 'ferry') ? 'ferry' : opts.find(o => o.id === 'guide') ? 'guide' : 'caulk';
        } else choice = E.pick(s, opts).id;
        const res = E.crossRiver(s, choice);
        if (res.error) throw new Error(`seed ${seed}: river ${choice} -> ${res.error}`);
      } else if (top.type === 'fork') {
        const opts = E.forkOptions(s).filter(o => o.affordable);
        const res = E.chooseFork(s, E.pick(s, opts).index);
        if (res.error) throw new Error(`seed ${seed}: fork -> ${res.error}`);
      } else if (top.type === 'trade') {
        E.resolveTrade(s, r() < 0.5);
      } else throw new Error('unknown pending ' + top.type);
      check(s, `seed ${seed} pending`);
      continue;
    }
    const sum = E.summary(s);
    if (strategy === 'smart') {
      if (sum.health < 45 && r() < 0.5) E.rest(s, 2);
      else if (sum.foodDays < 15 && s.inv.bullets >= 10) E.hunt(s, { lbs: E.randInt(s, 0, 150), shots: E.randInt(s, 3, 10) });
      else if (s.inv.oxen === 0) E.tradeAttempt(s);
      else if (E.canShop(s) && !s.shopped) {
        s.shopped = true; // once per fort visit
        const list = E.storeList(s), price = id => list.find(x => x.id === id).price;
        const food = Math.max(0, Math.min(800 - s.inv.food, Math.floor((s.money * 0.6) / price('food'))));
        const boxes = s.inv.bullets < 60 ? Math.min(3, Math.floor((s.money - food * price('food')) / price('bullets'))) : 0;
        E.buy(s, { food, bullets: Math.max(0, boxes) });
      } else {
        s.rations = sum.foodDays < 20 ? 'meager' : 'filling';
        E.travelDay(s);
        if (s.segment) s.shopped = false;
      }
    } else {
      const a = r();
      if (a < 0.7) E.travelDay(s);
      else if (a < 0.78) E.rest(s, E.randInt(s, 1, 3));
      else if (a < 0.84) E.tradeAttempt(s);
      else if (a < 0.9) E.hunt(s, { lbs: E.randInt(s, 0, 400), shots: E.randInt(s, 0, 30) });
      else if (a < 0.95) E.setPace(s, E.pick(s, C.paces).id);
      else E.setRations(s, E.pick(s, C.rations).id);
    }
    check(s, `seed ${seed}`);
    if (s.day > 1500) throw new Error(`seed ${seed}: game never ends (day ${s.day})`);
    if (s.inv.oxen === 0) { if (++stuck > 400) break; } else stuck = 0;
  }
  E.summary(s); E.routePlan(s);
  return s;
}

module.exports = { play, E };
if (require.main === module) for (const strategy of ['smart', 'random']) {
  let won = 0, lost = 0, stranded = 0, days = 0, deaths = 0, scores = 0;
  const arrive = {}, causes = {};
  for (let i = 0; i < GAMES; i++) {
    const s = play(1000 + i, strategy);
    if (s.status === 'won') {
      won++; days += s.day; scores += s.score.total;
      const m = E.dateOf(s).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      arrive[m] = (arrive[m] || 0) + 1;
    } else if (s.status === 'lost') lost++;
    else stranded++;
    deaths += s.deaths;
    s.log.filter(l => l.tone === 'death').forEach(l => { const k = l.text.replace(/^\S+ (has )?/, ''); causes[k] = (causes[k] || 0) + 1; });
  }
  console.log(`${strategy.padEnd(6)}: ${GAMES} games | won ${(100 * won / GAMES).toFixed(1)}% | lost ${(100 * lost / GAMES).toFixed(1)}% | stranded ${stranded} | avg deaths ${(deaths / GAMES).toFixed(2)}` +
    (won ? ` | avg days ${(days / won).toFixed(0)} | avg score ${(scores / won).toFixed(0)} | arrive ${JSON.stringify(arrive)}` : ''));
  if (process.argv.includes('--causes')) console.log('   deaths by cause:', Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
}
if (require.main === module) console.log('OK: no crashes, no invalid state.');

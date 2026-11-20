/*
 * UI layer: screens, modals, keyboard, the hunting minigame, and saving.
 *
 * Input reliability notes (the reason this remake exists):
 *  - One delegated click handler and one keydown handler on `document`, bound
 *    once. Nothing is re-bound on re-render, so controls can't get "lost".
 *  - While traveling, the dashboard is patched in place rather than rebuilt,
 *    so buttons are never swapped out from under a click.
 *  - Button children ignore pointer events, so the click target is always the
 *    button itself.
 */
(function () {
  'use strict';
  const C = window.OT_CONTENT;
  const E = window.OT.createEngine(C);
  const Scene = window.OTScene;

  const KEYS = { save: 'ot-remake-save-v1', hof: 'ot-remake-hof-v1', graves: 'ot-remake-graves-v1' };
  const TICK_MS = /[?&]fast\b/.test(location.search) ? 40 : 650; // ?fast speeds up testing

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const $ = (sel, el) => (el || document).querySelector(sel);
  const h = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = E.money;
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

  let s = null;
  const ui = { view: 'title', cart: {}, modal: null, timer: null, hunt: null };

  // ---------- persistence ----------
  function save() {
    if (s && s.status === 'playing') store.set(KEYS.save, s);
  }
  function loadSave() {
    const d = store.get(KEYS.save, null);
    if (!d || d.v !== 1 || !Array.isArray(d.party) || !d.inv || d.status !== 'playing') return null;
    d.traveling = false;
    return d;
  }
  const graves = () => store.get(KEYS.graves, []);
  function hallOfFame() {
    const mine = store.get(KEYS.hof, []);
    return C.hallOfFame.concat(mine).sort((a, b) => b.score - a.score).slice(0, 10);
  }

  // ---------- formatting ----------
  const fmtDate = (d, opts) => d.toLocaleDateString('en-US', Object.assign({ timeZone: 'UTC' }, opts));
  const longDate = d => fmtDate(d, { month: 'long', day: 'numeric', year: 'numeric' });
  const dayDate = day => new Date(Date.UTC(C.year, s.startMonth - 1, 1 + day));
  const kbd = k => (k ? `<span class="kbd">${h(k === ' ' || k === 'Space' ? 'Space' : k === 'Escape' ? 'Esc' : k)}</span>` : '');
  function btn(act, label, key, o) {
    o = o || {};
    return `<button type="button" class="btn ${o.cls || ''}" data-act="${act}"${o.arg != null ? ` data-arg="${h(o.arg)}"` : ''}${key ? ` data-key="${h(key)}"` : ''}${o.disabled ? ' disabled' : ''}>${label}${kbd(key)}</button>`;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ---------- top-level render ----------
  function render() {
    document.body.dataset.view = ui.view;
    $('#topbar-right').innerHTML = (s && ui.view === 'trail')
      ? `<span class="meta">Autosaved</span>${btn('menu', 'Menu', null, { cls: 'ghost' })}` : '';
    updateScene();
    renderTrailbar();
    $('#main').innerHTML = (VIEWS[ui.view] || VIEWS.title)();
    if (ui.view === 'trail') refreshTrail();
    const auto = $('#main [autofocus]');
    if (auto) auto.focus();
    syncPending();
  }

  function updateScene() {
    let st = { traveling: false, terrain: 'plains', sky: 'clear' };
    if (ui.view === 'title') st.traveling = true;
    else if (s && s.status !== 'setup') {
      const sum = E.summary(s);
      st = {
        traveling: !!s.traveling,
        terrain: sum.terrain,
        sky: s.weather.sky,
        sign: sum.atNode ? (sum.node.short || sum.node.name) : '',
        grave: !!(s.pending[0] && s.pending[0].tone === 'grave'),
      };
    }
    Scene.update(st);
  }

  function renderTrailbar() {
    const bar = $('#trailbar');
    if (!s || s.status === 'setup') { bar.innerHTML = ''; delete bar.dataset.sig; return; }
    const plan = E.routePlan(s);
    const total = Math.max(1, plan.total);
    const atNode = !s.segment;
    const curIdx = atNode ? s.route.length - 1 : -1;
    const nextIdx = plan.points.findIndex(p => !p.visited);
    const sig = plan.points.map(p => p.id + p.mile).join('|');
    const pct = Math.min(100, (s.mile / total) * 100);
    if (sig === bar.dataset.sig && $('.track-done', bar)) {
      // patch in place so the wagon slides smoothly
      $('.track-done', bar).style.width = pct + '%';
      $('.wagon-marker', bar).style.left = pct + '%';
      bar.querySelectorAll('.stop').forEach((el, i) => {
        el.classList.toggle('current', i === curIdx);
        el.classList.toggle('next', i === nextIdx);
      });
      return;
    }
    bar.dataset.sig = sig;
    bar.innerHTML = `<div class="track"><div class="track-done" style="width:${pct}%"></div>
      ${plan.points.map((p, i) => `<div class="stop ${p.type} ${p.visited ? 'visited' : ''} ${i === curIdx ? 'current' : ''} ${i === nextIdx ? 'next' : ''}" style="left:${(p.mile / total) * 100}%" title="${h(p.name)} · mile ${p.mile}"><span class="stop-label">${h(p.short)}</span></div>`).join('')}
      <div class="wagon-marker" style="left:${pct}%" title="Your wagon"></div></div>`;
  }

  // ---------- views ----------
  const VIEWS = {};

  VIEWS.title = function () {
    const saved = (s && s.status === 'playing') || loadSave();
    const title = h(C.title).replace('Oregon', '<em>Oregon</em>');
    let n = 1;
    return `<div class="hero"><div class="card hero-card">
      <h1>${title}</h1>
      <p class="sub">${h(C.subtitle)}</p>
      <p class="tag">${h(C.tagline)}</p>
      <div class="menu">
        ${saved ? btn('continue', 'Continue your journey', String(n++), { cls: 'primary' }) : ''}
        ${btn('new', saved ? 'Start a new journey' : 'Travel the trail', String(n++), { cls: saved ? '' : 'primary' })}
        ${btn('howto', 'How to play', String(n++))}
        ${btn('hof', 'Hall of fame', String(n++))}
      </div>
    </div>
    <p class="footer-note">A fan-made remake. Number keys pick options · Space starts and stops the wagon.</p></div>`;
  };

  VIEWS.profession = function () {
    return `<div class="setup card">
      <div class="step">Step 1 of 4</div>
      <h2>Who are you?</h2>
      <p class="lede">Many kinds of people made the trip to Oregon. Your choice sets how much money you start with, and how your final score is multiplied.</p>
      <div class="choices">
        ${C.professions.map((p, i) => `<button type="button" class="choice" data-act="profession" data-arg="${h(p.id)}" data-key="${i + 1}">
          <span class="num">${i + 1}</span><span><strong>${h(p.name)}</strong><span class="note">${h(p.blurb)}</span></span>
          <span class="aside">${money(p.money)}</span></button>`).join('')}
      </div>
      <div class="row" style="margin-top:16px">${btn('title', 'Back', 'Escape', { cls: 'ghost' })}</div>
    </div>`;
  };

  VIEWS.names = function () {
    const names = s.party.length ? s.party.map(p => p.name) : [];
    const fields = [];
    for (let i = 0; i < C.partySize; i++) {
      fields.push(`<label>${i === 0 ? 'Wagon leader' : `Member ${i + 1}`}
        <input class="input" name="n${i}" maxlength="24" autocomplete="off" value="${h(names[i] || '')}" ${i === 0 ? 'autofocus' : ''} placeholder="${h(C.suggestedNames[i])}"></label>`);
    }
    return `<form class="setup card" id="names-form">
      <div class="step">Step 2 of 4</div>
      <h2>Name your party</h2>
      <p class="lede">You lead a party of ${C.partySize}. Blank names get filled in for you.</p>
      <div class="names">${fields.join('')}</div>
      <div class="row">
        ${btn('back-profession', 'Back', null, { cls: 'ghost' })}
        ${btn('random-names', 'Random names', null)}
        <button type="submit" class="btn primary">Next</button>
      </div>
    </form>`;
  };

  VIEWS.month = function () {
    return `<div class="setup card">
      <div class="step">Step 3 of 4</div>
      <h2>When will you leave?</h2>
      <p class="lede">Leave too early and there's no grass for the oxen. Leave too late and the snow catches you in the mountains.</p>
      <div class="choices">
        ${C.months.map((m, i) => `<button type="button" class="choice" data-act="month" data-arg="${m.id}" data-key="${i + 1}">
          <span class="num">${i + 1}</span><span><strong>${h(m.name)} ${C.year}</strong><span class="note">${h(m.note)}</span></span><span></span></button>`).join('')}
      </div>
      <div class="row" style="margin-top:16px">${btn('back-names', 'Back', 'Escape', { cls: 'ghost' })}</div>
    </div>`;
  };

  VIEWS.store = function () {
    const initial = s.status === 'setup';
    const node = E.nodes[s.nodeId];
    const list = E.storeList(s);
    const total = E.cartTotal(s, ui.cart);
    const over = total > s.money + 1e-9;
    const rows = list.map(r => {
      const q = ui.cart[r.id] || 0;
      return `<div class="shelf-row">
        <div class="item"><strong>${h(r.label)}</strong><small>${h(r.hint || `You have ${r.have}`)}${r.hint ? ` · have ${r.have}` : ''}</small></div>
        <div class="price">${money(r.price)} / ${h(r.unit)}</div>
        <div class="qty"><div class="stepper">
          <button type="button" data-act="qty" data-arg="${r.id}|-${r.step}" aria-label="Less ${h(r.label)}">−</button>
          <input inputmode="numeric" data-qty="${r.id}" value="${q}" aria-label="${h(r.label)} quantity">
          <button type="button" data-act="qty" data-arg="${r.id}|${r.step}" aria-label="More ${h(r.label)}">+</button>
        </div></div>
        <div class="line-total">${q ? money(q * r.price) : '—'}</div>
      </div>`;
    }).join('');
    const keeper = initial
      ? `<div class="keeper"><p>“${h(C.store.greeting)}”</p><ul>${C.store.advice.map(a => `<li>${h(a)}</li>`).join('')}</ul><cite>— ${h(C.store.keeper)}</cite></div>`
      : `<div class="keeper"><p>“${h(C.store.fortGreeting)}”</p><cite>— the trader at ${h(node.name)}</cite></div>`;
    return `<div class="card">
      ${initial ? '<div class="step">Step 4 of 4</div>' : ''}
      <div class="store-head"><div><h2>${h(initial ? C.store.name : node.name + ' store')}</h2>
        <div style="color:var(--ink-3)">${h(node.name)}${initial ? ` · ${longDate(E.dateOf(s))}` : ''}</div></div>
        <div style="text-align:right"><div class="card-title" style="margin:0">Your purse</div><div style="font:700 26px var(--display)">${money(s.money)}</div></div></div>
      ${keeper}
      <div class="shelf"><div class="shelf-row head"><div>Item</div><div>Price</div><div>Buy</div><div style="text-align:right">Cost</div></div>${rows}</div>
      <div class="checkout">
        <div class="sum">Total <strong class="${over ? 'over' : ''}">${money(total)}</strong> · ${over ? '<span class="over">More than you have</span>' : `${money(s.money - total)} left over`}</div>
        <div class="row">
          ${total ? btn('cart-clear', 'Clear', null, { cls: 'ghost' }) : ''}
          ${btn('checkout', total ? `Pay ${money(total)} and ${initial ? 'set out' : 'leave'}` : (initial ? 'Set out without buying' : 'Leave the store'), null, { cls: 'primary', disabled: over })}
        </div>
      </div>
    </div>`;
  };

  VIEWS.trail = function () {
    const canTalk = E.canTalk(s), canShop = E.canShop(s);
    return `<div class="dash" id="trail-root">
      <div class="dash-col">
        <section class="card" aria-label="Status"><div id="ledger"></div></section>
        <section class="card" aria-label="Party"><h3 class="card-title">Your party</h3><ul class="party" id="party"></ul></section>
      </div>
      <div class="dash-col actions-col">
        <section class="card">
          <div class="where" id="where"></div>
          <button type="button" class="go" id="go" data-act="travel" data-key="Space"></button>
          <div class="actions">
            ${btn('supplies', 'Supplies', '1')}
            ${btn('pace', 'Pace', '2')}
            ${btn('rations', 'Rations', '3')}
            ${btn('rest', 'Rest', '4')}
            ${btn('trade', 'Trade', '5')}
            ${btn('hunt', 'Hunt', '6')}
            ${btn('talk', 'Talk to people', '7', { disabled: !canTalk })}
            ${btn('shop', 'Buy supplies', '8', { disabled: !canShop })}
          </div>
        </section>
        <section class="card"><h3 class="card-title">Journal</h3><ol class="journal" id="journal"></ol></section>
      </div>
    </div>`;
  };

  // patches the dashboard without replacing any buttons
  function refreshTrail() {
    if (!$('#trail-root')) return;
    const sum = E.summary(s);
    const d = sum.date;
    const next = sum.next;
    $('#ledger').innerHTML = `
      <div class="ledger-date">${fmtDate(d, { month: 'long', day: 'numeric', year: 'numeric' })}<small>${fmtDate(d, { weekday: 'long' })} · day ${s.day + 1} on the trail</small></div>
      <dl class="ledger">
        <div><dt>Weather</dt><dd>${h(sum.tempLabel)}<small> · ${h(cap(s.weather.sky))}</small></dd></div>
        <div><dt>Health</dt><dd class="tone-${sum.healthKey}">${h(sum.healthLabel)}</dd></div>
        <div><dt>Food</dt><dd class="${sum.foodDays < 10 ? 'tone-bad' : ''}">${s.inv.food} lbs<small> · ${sum.foodDays} days</small></dd></div>
        <div><dt>Money</dt><dd>${money(s.money)}</dd></div>
        <div><dt>Pace</dt><dd>${h(sum.pace.name)}</dd></div>
        <div><dt>Rations</dt><dd>${h(sum.rations.name)}</dd></div>
        <div><dt>Traveled</dt><dd>${s.mile} mi<small> of ~${E.routePlan(s).total}</small></dd></div>
        <div><dt>Next landmark</dt><dd>${next ? `${h(next.name)}${next.miles ? `<small> · ${next.miles} miles</small>` : ''}` : '—'}</dd></div>
      </dl>`;
    $('#party').innerHTML = s.party.map((p, i) => {
      const k = E.healthKey(p.health);
      const ill = p.illness && C.illnesses.find(x => x.id === p.illness);
      const chip = !p.alive ? '<span class="chip dead">Died</span>'
        : ill ? `<span class="chip sick">${h(cap(ill.name.replace(/^an? /, '')))}</span>`
        : `<span class="chip">${h(E.healthLabel(k))}</span>`;
      return `<li class="member ${p.alive ? '' : 'dead'}">
        <span class="member-name">${h(p.name)}${i === 0 ? '<span class="lead">Leader</span>' : ''}</span>${chip}
        <div class="bar ${k}" role="progressbar" aria-label="${h(p.name)} health" aria-valuenow="${Math.round(p.health)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p.alive ? Math.max(3, p.health) : 0}%"></i></div></li>`;
    }).join('');
    $('#where').innerHTML = sum.atNode
      ? `<h2>${h(sum.node.name)}</h2>${sum.node.store ? '<span class="pill">Store</span>' : ''}${sum.node.type === 'river' ? '<span class="pill">River</span>' : ''}`
      : `<h2>On the trail</h2><span class="pill">${h(sum.terrainName)}</span><span class="pill">${s.lastMiles} mi today</span>`;
    const go = $('#go');
    go.classList.toggle('stop', !!s.traveling);
    go.innerHTML = s.traveling
      ? `<span><span class="go-label">Stop the wagon</span><span class="go-sub">Make camp to rest, trade, or hunt</span></span>${kbd(' ')}`
      : `<span><span class="go-label">${s.mile === 0 ? 'Set out on the trail' : 'Continue on the trail'}</span><span class="go-sub">${next ? (next.miles ? `${h(next.name)} in ${next.miles} miles` : h(next.name)) : ''}</span></span>${kbd(' ')}`;
    $('#journal').innerHTML = s.log.slice(0, 40).map(l =>
      `<li><time>${fmtDate(dayDate(l.day), { month: 'short', day: 'numeric' })}</time><span class="${h(l.tone)}">${h(l.text)}</span></li>`).join('');
  }

  VIEWS.hunt = function () {
    return `<div class="hunt-wrap">
      <div class="card hunt-hud">
        <div class="stats">
          <div class="stat"><b id="h-time">${C.hunting.seconds}</b><span>Seconds</span></div>
          <div class="stat"><b id="h-ammo">${s.inv.bullets}</b><span>Bullets</span></div>
          <div class="stat"><b id="h-meat">0</b><span>Lbs of meat</span></div>
        </div>
        ${btn('hunt-end', 'Stop hunting', 'Escape')}
      </div>
      <div class="field ${E.currentTerrain(s) === 'mountains' ? 'mountains' : ''}" id="field">
        <div class="hunt-msg" id="h-msg">Click or tap an animal to shoot.<br>You can carry ${C.hunting.carry} lbs back.</div>
      </div>
    </div>`;
  };

  VIEWS.end = function () {
    const won = s.status === 'won';
    const leader = s.party[0];
    if (won) {
      const sc = s.score;
      const hof = hallOfFame();
      return `<div class="end card">
        <div class="step">${longDate(E.dateOf(s))}</div>
        <h2>You made it to Oregon!</h2>
        <p class="lede">${h(C.text.win)}</p>
        <table class="score-table">
          ${sc.rows.map(r => `<tr><td>${h(r.label)}</td><td>${r.points}</td></tr>`).join('')}
          <tr><td>Subtotal</td><td>${sc.subtotal}</td></tr>
          <tr><td>${h(sc.profession)} bonus</td><td>× ${sc.multiplier}</td></tr>
          <tr class="total"><td>Final score · ${h(sc.rank)}</td><td>${sc.total}</td></tr>
        </table>
        <h3 class="card-title" style="margin-top:22px">Hall of fame</h3>
        ${hofTable(hof, sc.total, leader.name)}
        <div class="row" style="margin-top:18px">${btn('title', 'Main menu', null)}${btn('new', 'Travel again', 'Enter', { cls: 'primary' })}</div>
      </div>`;
    }
    const carved = s.carved;
    return `<div class="end card">
      <h2>Your journey has ended</h2>
      <p class="lede">${h(C.text.lose)}</p>
      <div class="tombstone">
        <div class="rip">R · I · P</div>
        <div class="who">${h(leader.name)}</div>
        <div class="when">${longDate(E.dateOf(s))} · mile ${s.mile}</div>
        ${carved ? `<p style="margin:12px 0 0;font:italic 16px var(--display)">${h(carved)}</p>`
          : `<textarea id="epitaph" rows="2" maxlength="80" placeholder="Write an epitaph…" aria-label="Epitaph"></textarea>`}
      </div>
      <p style="text-align:center;color:var(--ink-3);font-size:14px">${carved ? 'Future travelers in this browser will pass this grave on the trail.' : 'Carve an epitaph and future wagons in this browser will pass this grave.'}</p>
      <div class="row" style="justify-content:center">
        ${carved ? '' : btn('carve', 'Carve the stone', null)}
        ${btn('title', 'Main menu', null)}${btn('new', 'Try again', null, { cls: 'primary' })}
      </div>
    </div>`;
  };

  function hofTable(list, myScore, myName) {
    let marked = false;
    return `<table class="hof"><tr><th>Name</th><th>Rank</th><th>Score</th></tr>
      ${list.map(r => {
        const me = !marked && myScore != null && r.score === myScore && r.name === myName;
        if (me) marked = true;
        return `<tr class="${me ? 'me' : ''}"><td>${h(r.name)}</td><td>${h(r.title || '')}</td><td>${r.score}</td></tr>`;
      }).join('')}</table>`;
  }

  VIEWS.hof = function () {
    return `<div class="setup card"><h2>Hall of fame</h2><p class="lede">The ten highest-scoring parties to reach Oregon in this browser.</p>
      ${hofTable(hallOfFame())}
      <div class="row" style="margin-top:18px">${btn('title', 'Back', 'Escape')}</div></div>`;
  };

  VIEWS.howto = function () {
    return `<div class="setup card prose">
      <h2>How to play</h2>
      <p class="lede">Lead your party ${(E.routePlan(E.newGame(1)).total)} miles from Independence, Missouri to Oregon's Willamette Valley before winter, before the food runs out, and before sickness takes you.</p>
      <h3>Controls</h3>
      <ul>
        <li><b>Space</b> starts and stops the wagon.</li>
        <li><b>Number keys</b> pick any numbered option, both on screen and in pop-ups.</li>
        <li><b>Enter</b> or <b>Esc</b> closes a message.</li>
        <li>Everything also works with a mouse or a tap.</li>
      </ul>
      <h3>Tips</h3>
      <ul>
        <li>Buy at least 6 oxen. Fewer oxen means a slower wagon.</li>
        <li>Keep two sets of clothing per person for the mountains.</li>
        <li>Grueling pace and bare-bones rations wear people down. Rest when health turns poor.</li>
        <li>Ford a river only when it's under about 2½ feet deep. Otherwise caulk the wagon or take the ferry.</li>
        <li>Hunting costs a day and bullets, and you can only carry ${C.hunting.carry} lbs back.</li>
      </ul>
      <h3>Modding</h3>
      <p>Every name, prompt, landmark, event, and price lives in <code>js/content.js</code>. Edit it and reload. The README explains each field.</p>
      <p>Your game saves automatically in this browser after every day.</p>
      <div class="row" style="margin-top:18px">${btn('title', 'Back', 'Escape')}</div>
    </div>`;
  };

  // ---------- modals ----------
  // actions: [{label, note, aside, key, primary, disabled, run}]
  function openModal(o) {
    ui.modal = o;
    const choiceStyle = o.layout === 'choices';
    const actions = o.actions.map((a, i) => choiceStyle
      ? `<button type="button" class="choice" data-mi="${i}"${a.key ? ` data-key="${h(a.key)}"` : ''}${a.disabled ? ' disabled' : ''}>
           <span class="num">${a.key && /^\d$/.test(a.key) ? a.key : ''}</span><span><strong>${h(a.label)}</strong>${a.note ? `<span class="note">${h(a.note)}</span>` : ''}</span><span class="aside">${h(a.aside || '')}</span></button>`
      : `<button type="button" class="btn ${a.primary ? 'primary' : ''}" data-mi="${i}"${a.key ? ` data-key="${h(a.key)}"` : ''}${a.disabled ? ' disabled' : ''}>${h(a.label)}${kbd(a.key && a.key.length === 1 ? a.key : a.key === 'Enter' ? '⏎' : a.key === 'Escape' ? 'Esc' : '')}</button>`).join('');
    $('#modal-root').innerHTML = `<div class="overlay"><div class="modal tone-${h(o.tone || 'neutral')}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-band"></div>
      <div class="modal-body">${o.kicker ? `<div class="kicker">${h(o.kicker)}</div>` : ''}<h2 id="modal-title">${h(o.title)}</h2>${o.html || ''}</div>
      <div class="modal-actions ${choiceStyle ? '' : 'inline'}">${actions}</div>
      ${choiceStyle && o.cancel ? `<div class="modal-actions inline" style="padding-top:0">${`<button type="button" class="btn ghost" data-mi="cancel" data-key="Escape">Cancel${kbd('Esc')}</button>`}</div>` : ''}
    </div></div>`;
    const first = $('#modal-root [data-key="Enter"]') || $('#modal-root button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }
  function closeModal() {
    ui.modal = null;
    $('#modal-root').innerHTML = '';
  }
  function runModal(i) {
    const m = ui.modal;
    if (!m) return;
    if (i === 'cancel') { closeModal(); render(); return; }
    const a = m.actions[i];
    if (!a || a.disabled) return;
    closeModal();
    a.run && a.run();
  }

  // engine "pending" items → modals
  function syncPending() {
    if (ui.modal || !s || ui.view !== 'trail') return;
    const p = s.pending[0];
    if (!p) {
      if (s.status === 'won' || s.status === 'lost') { goEnd(); return; }
      if (s.traveling) scheduleTick();
      return;
    }
    const kicker = longDate(E.dateOf(s));
    if (p.type === 'notice') {
      openModal({
        tone: p.tone, kicker, title: p.title, html: p.body ? `<p>${h(p.body)}</p>` : '',
        actions: [{ label: 'Continue', key: 'Enter', primary: true, run: () => { E.dismiss(s); after(); } }],
      });
    } else if (p.type === 'river') {
      const r = E.nodes[p.node].river;
      const opts = E.riverOptions(s);
      openModal({
        tone: 'arrive', kicker, title: `The ${r.name}`, layout: 'choices',
        html: `<div class="stats">
            <div class="stat"><b>${p.width} ft</b><span>Width</span></div>
            <div class="stat"><b>${p.depth} ft</b><span>Depth</span></div>
            <div class="stat"><b>${p.swift ? 'Swift' : 'Gentle'}</b><span>Current</span></div></div>
          <p>${p.depth <= 2.5 ? 'Shallow enough to ford.' : p.depth <= 3 ? 'Fording is possible, but your supplies may get wet.' : 'Too deep to ford safely.'} How will you cross?</p>`,
        actions: opts.map((o, i) => ({
          label: o.label, note: o.note, key: String(i + 1), disabled: o.disabled,
          run: () => { const res = E.crossRiver(s, o.id); if (res.error) toast(res.error); after(); },
        })),
      });
    } else if (p.type === 'fork') {
      const node = E.nodes[p.node];
      openModal({
        tone: 'arrive', kicker, title: 'A fork in the trail', layout: 'choices', cancel: true,
        html: `<p>${h(node.forkText || 'The trail divides here.')}</p>`,
        actions: E.forkOptions(s).map((o, i) => ({
          label: o.label, note: o.note, aside: `${o.miles} mi`, key: String(i + 1), disabled: !o.affordable,
          run: () => { const res = E.chooseFork(s, o.index); if (res.error) { toast(res.error); after(); return; } s.traveling = true; after(); },
        })),
      });
      // cancel leaves the fork for later (e.g. to shop first)
      ui.modal.onCancel = () => { s.pending.shift(); };
    } else if (p.type === 'trade') {
      openModal({
        tone: 'neutral', kicker, title: 'A trade offer',
        html: `<p>A traveler offers you <b>${h(p.get.label)}</b> in exchange for <b>${h(p.give.label)}</b>.</p><p>You have ${s.inv[p.give.item]} ${h(E.noun(p.give.item, s.inv[p.give.item]))}.</p>`,
        actions: [
          { label: 'No thanks', key: '2', run: () => { E.resolveTrade(s, false); after(); } },
          { label: 'Accept', key: '1', primary: true, run: () => { const r = E.resolveTrade(s, true); if (r.error) toast(r.error); after(); } },
        ],
      });
    }
  }
  function after() { save(); render(); }

  // ---------- travel loop ----------
  function scheduleTick(delay) {
    if (ui.timer) return;
    ui.timer = setTimeout(tick, delay == null ? TICK_MS : delay);
  }
  function stopTimer() { clearTimeout(ui.timer); ui.timer = null; }
  function tick() {
    ui.timer = null;
    if (!s || !s.traveling || ui.modal || s.pending.length || s.status !== 'playing' || ui.view !== 'trail') return;
    E.travelDay(s, { graves: graves() });
    save();
    if (s.pending.length || s.status !== 'playing' || !s.traveling) { render(); return; }
    // the common case: patch in place, keep buttons intact
    updateScene();
    renderTrailbar();
    refreshTrail();
    scheduleTick();
  }
  function stopTravel() {
    stopTimer();
    if (s && s.traveling) { s.traveling = false; save(); }
  }

  function goEnd() {
    stopTimer();
    store.del(KEYS.save);
    if (s.status === 'won' && !s.recorded) {
      s.recorded = true;
      const mine = store.get(KEYS.hof, []);
      mine.push({ name: s.party[0].name, score: s.score.total, title: s.score.rank });
      store.set(KEYS.hof, mine.sort((a, b) => b.score - a.score).slice(0, 20));
    }
    ui.view = 'end';
    render();
  }

  // ---------- hunting ----------
  function startHunt() {
    const field = $('#field');
    const terrain = E.currentTerrain(s);
    const pool = C.animals.filter(a => !a.terrains || a.terrains.includes(terrain));
    const H = ui.hunt = {
      field, pool, shots: 0, lbs: 0, bullets: s.inv.bullets, animals: [],
      start: performance.now(), last: performance.now(), nextSpawn: 300, over: false, raf: 0,
    };
    field.addEventListener('pointerdown', e => {
      if (H.over || ui.hunt !== H) return;
      e.preventDefault();
      if (H.bullets <= 0) return;
      H.shots++; H.bullets--;
      const rect = field.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const puff = document.createElement('div');
      puff.className = 'shot'; puff.style.left = x + 'px'; puff.style.top = y + 'px';
      field.appendChild(puff); setTimeout(() => puff.remove(), 450);
      const el = e.target.closest('.animal');
      const a = el && H.animals.find(z => z.el === el && !z.hit);
      const msg = $('#h-msg'); if (msg) msg.remove();
      if (a) {
        a.hit = true;
        const lbs = E.randInt(s, a.def.lbs[0], a.def.lbs[1]);
        H.lbs += lbs;
        el.style.setProperty('--t', el.style.transform);
        el.classList.add('hit');
        const g = document.createElement('div');
        g.className = 'gain'; g.textContent = `+${lbs} lbs`; g.style.left = x + 'px'; g.style.top = (y - 20) + 'px';
        field.appendChild(g); setTimeout(() => g.remove(), 1000);
      }
      $('#h-ammo').textContent = H.bullets;
      $('#h-meat').textContent = H.lbs;
      if (H.bullets <= 0) setTimeout(() => endHunt('Out of bullets!'), 600);
    });
    const loop = now => {
      if (ui.hunt !== H || H.over) return;
      const dt = Math.min(0.05, (now - H.last) / 1000);
      H.last = now;
      const left = Math.max(0, C.hunting.seconds - (now - H.start) / 1000);
      $('#h-time').textContent = Math.ceil(left);
      if (left <= 0) { endHunt("Time's up!"); return; }
      const W = field.clientWidth, FH = field.clientHeight;
      H.nextSpawn -= dt * 1000;
      if (H.nextSpawn <= 0 && H.animals.filter(a => !a.hit).length < 6) {
        H.nextSpawn = 700 + Math.random() * 900;
        const def = E.weighted(s, H.pool, a => a.weight || 1);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'animal' + (dir > 0 ? ' flip' : '');
        el.setAttribute('aria-label', def.name);
        el.style.fontSize = `${def.size * Math.max(0.75, Math.min(1.2, W / 900))}rem`;
        el.innerHTML = `<span>${def.emoji}</span>`;
        field.appendChild(el);
        const size = el.offsetWidth || 40;
        H.animals.push({
          el, def, dir, hit: false, size,
          x: dir > 0 ? -size : W,
          y: FH * (0.38 + Math.random() * 0.5) - size / 2,
          v: (def.speed[0] + Math.random() * (def.speed[1] - def.speed[0])) * Math.max(0.6, W / 1100),
        });
      }
      H.animals = H.animals.filter(a => {
        if (a.hit) { if (!a.removeAt) a.removeAt = now + 600; if (now > a.removeAt) { a.el.remove(); return false; } return true; }
        a.x += a.v * a.dir * dt;
        if (a.x < -a.size - 10 || a.x > W + 10) { a.el.remove(); return false; }
        a.el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
        return true;
      });
      H.raf = requestAnimationFrame(loop);
    };
    H.raf = requestAnimationFrame(loop);
  }
  function endHunt(message) {
    const H = ui.hunt;
    if (!H || H.over) return;
    H.over = true;
    cancelAnimationFrame(H.raf);
    const m = document.createElement('div');
    m.className = 'hunt-msg'; m.textContent = message || 'Heading back to camp';
    H.field.appendChild(m);
    setTimeout(() => {
      if (ui.hunt !== H) return;
      ui.hunt = null;
      E.hunt(s, { lbs: H.lbs, shots: H.shots });
      ui.view = 'trail';
      after();
    }, 900);
  }

  // ---------- actions ----------
  function pickOne(title, items, currentId, apply) {
    openModal({
      title, layout: 'choices', cancel: true,
      actions: items.map((it, i) => ({
        label: it.name, note: it.desc, key: String(i + 1), aside: it.id === currentId ? 'Current' : '',
        run: () => { apply(it.id); after(); },
      })),
    });
  }

  const ACTIONS = {
    menu() { stopTravel(); closeModal(); ui.view = 'title'; render(); },
    title() { ui.view = 'title'; render(); },
    hof() { ui.view = 'hof'; render(); },
    howto() { ui.view = 'howto'; render(); },
    continue() {
      if (!s || s.status !== 'playing') s = loadSave();
      if (!s) { toast('No saved game found.'); render(); return; }
      ui.view = 'trail'; render();
    },
    new() { stopTimer(); s = E.newGame(); ui.cart = {}; ui.view = 'profession'; render(); },
    profession(id) { E.setProfession(s, id); ui.view = 'names'; render(); },
    'back-profession'() { ui.view = 'profession'; render(); },
    'back-names'() { ui.view = 'names'; render(); },
    'random-names'() {
      const pool = C.suggestedNames.slice();
      document.querySelectorAll('#names-form input').forEach(inp => {
        const i = Math.floor(Math.random() * pool.length);
        inp.value = pool.splice(i, 1)[0] || inp.placeholder;
      });
    },
    month(m) { E.setMonth(s, Number(m)); ui.cart = {}; ui.view = 'store'; render(); },
    qty(arg) {
      const [id, d] = arg.split('|');
      const row = E.storeList(s).find(r => r.id === id);
      const maxPacks = Math.max(0, Math.floor((row.max - row.have) / row.pack));
      ui.cart[id] = Math.max(0, Math.min(maxPacks, (ui.cart[id] || 0) + Number(d)));
      render();
    },
    'cart-clear'() { ui.cart = {}; render(); },
    checkout() {
      const initial = s.status === 'setup';
      if (initial && s.inv.oxen + (ui.cart.oxen || 0) < 1) { toast('You need at least one ox to pull the wagon.'); return; }
      const res = E.buy(s, ui.cart);
      if (res.error) { toast(res.error); return; }
      ui.cart = {};
      if (initial) E.begin(s);
      ui.view = 'trail';
      after();
    },
    travel() {
      if (!s || s.status !== 'playing') return;
      if (s.traveling) { stopTravel(); render(); return; }
      s.traveling = true;
      refreshTrail();
      updateScene();
      tick();
    },
    supplies() {
      stopTravel(); render();
      const it = C.items;
      openModal({
        title: 'Supplies', kicker: longDate(E.dateOf(s)),
        html: `<ul class="inv-list">${Object.keys(it).map(id => `<li><span>${h(it[id].label)}</span><b>${s.inv[id]} ${id === 'food' ? 'lbs' : ''}</b></li>`).join('')}
          <li><span>Money</span><b>${money(s.money)}</b></li></ul>`,
        actions: [{ label: 'Close', key: 'Enter', primary: true, run: () => render() }],
      });
    },
    pace() { stopTravel(); render(); pickOne('Change pace', C.paces, s.pace, id => E.setPace(s, id)); },
    rations() { stopTravel(); render(); pickOne('Change rations', C.rations, s.rations, id => E.setRations(s, id)); },
    rest() {
      stopTravel(); render();
      openModal({
        title: 'Rest', layout: 'choices', cancel: true,
        html: '<p>Resting helps the sick recover, but you still eat every day.</p>',
        actions: [1, 2, 3, 5, 7].map((n, i) => ({
          label: `${n} day${n > 1 ? 's' : ''}`, key: String(i + 1),
          run: () => { E.rest(s, n); after(); },
        })),
      });
    },
    trade() { stopTravel(); E.tradeAttempt(s); after(); },
    hunt() {
      stopTravel();
      if (s.inv.bullets <= 0) { toast('You have no bullets to hunt with.'); render(); return; }
      ui.view = 'hunt'; render(); startHunt();
    },
    'hunt-end'() { endHunt(); },
    talk() {
      stopTravel(); render();
      const t = E.talk(s);
      if (!t) return;
      openModal({
        title: E.nodes[s.nodeId].name, kicker: 'Talking with people',
        html: `<blockquote>“${h(t.text)}”</blockquote><cite>— ${h(t.speaker)}</cite>`,
        actions: [
          { label: 'Talk to someone else', key: '1', run: () => ACTIONS.talk() },
          { label: 'Done', key: 'Enter', primary: true, run: () => render() },
        ],
      });
    },
    shop() { stopTravel(); ui.cart = {}; ui.view = 'store'; render(); },
    carve() {
      const text = ($('#epitaph') || {}).value || '';
      const list = graves();
      list.push({ name: s.party[0].name, epitaph: text.trim().slice(0, 80), mile: Math.max(1, s.mile) });
      store.set(KEYS.graves, list.slice(-20));
      s.carved = text.trim() || '…';
      render();
    },
  };

  // ---------- input ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act],[data-mi]');
    if (!el || el.disabled) return;
    safely(() => {
      if (el.dataset.mi != null) {
        const i = el.dataset.mi;
        if (i === 'cancel' && ui.modal && ui.modal.onCancel) ui.modal.onCancel();
        runModal(i === 'cancel' ? 'cancel' : Number(i));
        return;
      }
      const fn = ACTIONS[el.dataset.act];
      if (fn) { e.preventDefault(); fn(el.dataset.arg, el); }
    });
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'names-form') return;
    e.preventDefault();
    safely(() => {
      const names = Array.from(e.target.querySelectorAll('input')).map(i => i.value);
      E.setParty(s, names);
      ui.view = 'month';
      render();
    });
  });
  document.addEventListener('change', e => {
    const id = e.target.dataset && e.target.dataset.qty;
    if (!id) return;
    safely(() => {
      const row = E.storeList(s).find(r => r.id === id);
      const maxPacks = Math.max(0, Math.floor((row.max - row.have) / row.pack));
      const v = Math.floor(Number(String(e.target.value).replace(/[^\d]/g, '')) || 0);
      ui.cart[id] = Math.max(0, Math.min(maxPacks, v));
      render();
    });
  });
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const tag = e.target && e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (typing && e.key !== 'Escape') return;
    const scope = ui.modal ? $('#modal-root') : $('#main');
    // let the browser activate a focused button natively (avoids double fire)
    if ((e.key === 'Enter' || e.key === ' ') && tag === 'BUTTON' && scope.contains(e.target)) return;
    let key = e.key === ' ' ? 'Space' : e.key;
    if (ui.modal && (key === 'Space' || (key === 'Escape' && !ui.modal.cancel))) key = 'Enter';
    if (!ui.modal && ui.view === 'end' && key === 'Space') key = 'Enter';
    let target = null;
    try { target = scope.querySelector(`[data-key="${CSS.escape(key)}"]`); } catch (err) { target = null; }
    if (target && !target.disabled) {
      e.preventDefault();
      target.click();
    } else if (key === 'Space') {
      e.preventDefault(); // never scroll the page on Space
    }
  });

  function safely(fn) {
    try { fn(); } catch (err) {
      console.error(err);
      toast('Something went wrong. Your last day is saved.');
      stopTimer();
      closeModal();
      try { render(); } catch (e2) { /* give up quietly */ }
    }
  }
  window.addEventListener('error', () => stopTimer());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && s && s.traveling) { stopTravel(); if (ui.view === 'trail') render(); }
  });

  // ---------- boot ----------
  document.title = C.title;
  $('.brand').innerHTML = `<span class="brand-mark">OT</span>${h(C.title)}`;
  Scene.mount($('#scene'));
  render();
})();

/*
 * The animated trail panorama: parallax hills, a covered wagon, weather.
 * Built once as SVG; update() only toggles classes and text, so CSS
 * animations keep running smoothly between game ticks.
 */
(function (root) {
  'use strict';
  const W = 1200, H = 300, NS = 'http://www.w3.org/2000/svg';

  // periodic ridge line so two copies tile seamlessly while scrolling
  function ridge(base, waves, sharp) {
    const pts = [];
    for (let x = 0; x <= W; x += 12) {
      let y = base;
      for (const [k, a, ph] of waves) {
        const v = Math.sin((2 * Math.PI * k * x) / W + ph);
        y -= sharp ? a * Math.pow(Math.abs(v), 0.7) : a * v;
      }
      pts.push(`${x},${y.toFixed(1)}`);
    }
    return `M0,${H} L${pts.join(' L')} L${W},${H} Z`;
  }
  const TERRAIN = {
    plains: {
      far: ridge(205, [[2, 6, 0.3], [5, 3, 1.1]]),
      mid: ridge(228, [[3, 5, 1.7], [7, 2, 0.2]]),
    },
    hills: {
      far: ridge(185, [[2, 22, 0.4], [5, 9, 2.1]], true),
      mid: ridge(222, [[3, 12, 1.2], [8, 4, 0.6]]),
    },
    mountains: {
      far: ridge(205, [[3, 95, 0.5], [7, 30, 1.9], [13, 10, 0.3]], true),
      mid: ridge(225, [[4, 38, 1.4], [9, 12, 0.8]], true),
    },
  };
  TERRAIN.river = TERRAIN.hills;

  function tiled(cls, d) {
    return `<g class="${cls}"><path d="${d}"/><path d="${d}" transform="translate(${W} 0)"/></g>`;
  }
  function precip(cls, count, drawOne) {
    let a = '';
    for (let i = 0; i < count; i++) {
      const x = (i * 97.3) % W, y = (i * 53.7) % H;
      a += drawOne(x, y, i);
    }
    return `<g class="${cls}"><g class="fall">${a}<g transform="translate(0 -${H})">${a}</g></g></g>`;
  }

  // simple ox: body, head, horns, legs
  function ox(x) {
    return `<g class="ox" transform="translate(${x} 0)">
      <ellipse cx="0" cy="226" rx="24" ry="12" />
      <rect x="18" y="214" width="16" height="12" rx="5" />
      <path d="M30 214 q6 -8 10 -4 M22 214 q-4 -8 -9 -5" class="horn" />
      <g class="legs"><rect x="-17" y="233" width="5" height="16" rx="2" class="leg a"/><rect x="-6" y="233" width="5" height="16" rx="2" class="leg b"/>
      <rect x="6" y="233" width="5" height="16" rx="2" class="leg a"/><rect x="15" y="233" width="5" height="16" rx="2" class="leg b"/></g>
    </g>`;
  }
  function wheel(cx, cy, r) {
    let spokes = '';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 6;
      spokes += `<line x1="${cx - r * Math.cos(a)}" y1="${cy - r * Math.sin(a)}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}"/>`;
    }
    return `<g class="wheel"><circle cx="${cx}" cy="${cy}" r="${r}" />${spokes}<circle cx="${cx}" cy="${cy}" r="3" class="hub"/></g>`;
  }

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="${NS}" role="img" aria-label="Your wagon on the trail">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="sky-top"/><stop offset="1" class="sky-bottom"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#skyGrad)"/>
    <circle class="sun" cx="930" cy="78" r="34"/>
    <g class="clouds">
      <g class="drift"><ellipse cx="200" cy="70" rx="70" ry="16"/><ellipse cx="240" cy="60" rx="40" ry="16"/>
      <ellipse cx="640" cy="44" rx="90" ry="14"/><ellipse cx="1000" cy="96" rx="60" ry="12"/>
      <ellipse cx="1400" cy="70" rx="70" ry="16"/><ellipse cx="1440" cy="60" rx="40" ry="16"/>
      <ellipse cx="1840" cy="44" rx="90" ry="14"/><ellipse cx="2200" cy="96" rx="60" ry="12"/></g>
    </g>
    ${Object.keys(TERRAIN).filter(k => k !== 'river').map(k => `<g class="terrain t-${k}">
      ${tiled('far scroll-far', TERRAIN[k].far)}
      ${tiled('mid scroll-mid', TERRAIN[k].mid)}
    </g>`).join('')}
    <rect class="ground" x="0" y="248" width="${W}" height="${H - 248}"/>
    <g class="riverband"><rect x="0" y="268" width="${W}" height="18"/></g>
    <g class="scroll-near">${(() => {
      let tufts = '';
      for (let i = 0; i < 2; i++) for (let j = 0; j < 22; j++) {
        const x = i * W + j * 55 + (j % 3) * 9, y = 262 + (j % 4) * 8;
        tufts += `<path class="tuft" d="M${x} ${y} l3 -9 l2 9 l3 -7 l1 7"/>`;
      }
      return tufts;
    })()}</g>
    <g class="signpost">
      <rect x="1000" y="190" width="6" height="62" class="post"/>
      <rect x="930" y="176" width="150" height="30" rx="3" class="board"/>
      <text x="1005" y="196" text-anchor="middle" class="sign-text"></text>
    </g>
    <g class="grave" transform="translate(860 0)">
      <rect x="-3" y="214" width="6" height="36" class="post"/><rect x="-14" y="222" width="28" height="5" class="post"/>
    </g>
    <g class="rig">
      <g class="bob">
        ${ox(640)}${ox(705)}
        <path class="yoke" d="M600 222 L700 220" />
        <path class="bonnet" d="M440 210 C440 140, 470 128, 500 130 C530 128, 560 140, 560 210 Z"/>
        <path class="bonnet-ribs" d="M470 136 L466 210 M500 130 L500 210 M530 136 L534 210"/>
        <rect class="box" x="430" y="206" width="140" height="26" rx="2"/>
        <path class="tongue" d="M570 222 L610 222" />
      </g>
      ${wheel(455, 240, 20)}${wheel(548, 240, 20)}
    </g>
    ${precip('rain', 90, (x, y) => `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + 18}"/>`)}
    ${precip('snow', 110, (x, y, i) => `<circle cx="${x}" cy="${y}" r="${1.5 + (i % 3)}"/>`)}
  </svg>`;

  const Scene = {
    el: null,
    mount(el) {
      this.el = el;
      el.innerHTML = svg;
      this.sign = el.querySelector('.sign-text');
    },
    update(st) {
      if (!this.el) return;
      const c = this.el.classList;
      c.toggle('traveling', !!st.traveling);
      ['plains', 'hills', 'mountains', 'river'].forEach(t => c.toggle('is-' + t, st.terrain === t));
      ['clear', 'cloudy', 'rain', 'snow', 'heavy'].forEach(k => c.remove('sky-' + k));
      const sky = st.sky || 'clear';
      c.add('sky-' + (sky.includes('snow') ? 'snow' : sky.includes('rain') ? 'rain' : sky));
      c.toggle('sky-heavy', sky.startsWith('heavy'));
      c.toggle('has-sign', !!st.sign);
      c.toggle('has-grave', !!st.grave);
      if (this.sign) this.sign.textContent = st.sign || '';
    },
  };
  root.OTScene = Scene;
})(window);

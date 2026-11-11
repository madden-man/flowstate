// The mountain, as proposed in PLAN-MOUNTAIN.md: a mock that runs. Meru drawn in pen: snow at the summit, one stream
// down through seven lotuses to the ocean, and the circle floating there. A meter for the whole mountain (the weather
// on the peak) and a gate at each lotus (its petals fold). The maths is section 3 of the plan; the real build puts it
// in model/mountain.ts and draws it with parts/Stream. No colour, font or duration is written here: tokens only.
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var W = 328, H = 476, PEAK = { x: 164, y: 44 }, SHORE = 394, SEA = { y: 434, r: 15 };
  // the circles afloat in the sea: what he does when the water is running well. Room for more.
  var CIRCLES = [['Meditate', 108, 'places'], ['Energize', 220, 'places']];
  // the seven, crown to root: name, hue, step id, petals (the thousand drawn as two rings of twenty)
  var STOPS = [['Sahasrara', 305, 'sahasrara', 1000], ['Ajna', 275, 'ajna', 2], ['Vishuddha', 250, 'vishuddha', 16], ['Anahata', 150, 'anahata', 12],
    ['Manipura', 95, 'manipura', 10], ['Svadhisthana', 55, 'svadhisthana', 6], ['Muladhara', 25, 'muladhara', 4]];
  var BASE = 30, POOL = 26, N = 130;
  var K = { day: 1, night: 0.85, still: 0.4 };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // a seeded wobble, so the pen drawing is the same every time it is drawn
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

  // ---- the lotus: n petals round a centre, folding in as the gate closes (b from 0, open, to 1, a bud)
  function Lotus(parent, cx, cy, r0, reach, n) {
    this.cx = cx; this.cy = cy; this.r0 = r0; this.reach = reach; this.petals = [];
    var rings = n > 100 ? [[20, 0, 1], [20, 9, 0.62]] : [[n, n === 2 ? 90 : 0, 1]];
    for (var k = rings.length - 1; k >= 0; k--) for (var i = 0; i < rings[k][0]; i++)
      this.petals.push({ a: rings[k][1] + i * 360 / rings[k][0], n: rings[k][0], k: rings[k][2], el: el('path', { class: 'petal' }, parent) });
    this.heart = el('circle', { class: 'ring', cx: cx, cy: cy, r: r0 }, parent);
    this.fill = el('circle', { class: 'fill', cx: cx, cy: cy, r: r0 }, parent);
  }
  Lotus.prototype.set = function (b) {
    var r0 = this.r0, cx = this.cx, cy = this.cy;
    for (var i = 0; i < this.petals.length; i++) {
      var p = this.petals[i], len = this.reach * p.k * (0.22 + 0.78 * (1 - b)), w = Math.min(Math.PI * r0 / p.n * 1.05, r0 * 0.8) * (0.6 + 0.4 * (1 - b)), y = cy - r0;
      p.el.setAttribute('d', 'M' + (cx - w) + ' ' + y + ' C' + (cx - w * 1.5) + ' ' + (y - len * 0.5) + ' ' + (cx - w * 0.4) + ' ' + (y - len * 0.9) + ' ' + cx + ' ' + (y - len) +
        ' C' + (cx + w * 0.4) + ' ' + (y - len * 0.9) + ' ' + (cx + w * 1.5) + ' ' + (y - len * 0.5) + ' ' + (cx + w) + ' ' + y);
      p.el.setAttribute('transform', 'rotate(' + p.a + ' ' + cx + ' ' + cy + ')');
    }
    this.fill.setAttribute('opacity', b.toFixed(2));
  };

  // ---- the walk: the spring under the snow, seven lotuses on alternating sides, the river mouth, the circle in the sea
  var way = [{ x: PEAK.x, y: PEAK.y + 14 }];
  STOPS.forEach(function (s, i) { var side = i % 2 ? -1 : 1; way.push({ x: 164 + side * (12 + i * 8), y: 96 + i * 42, side: side }); });
  way.push({ x: 164, y: SHORE }); way.push({ x: 164, y: SEA.y + 4 });
  var X = [], Y = [], L = [], at = [0];
  (function () {
    var len = 0;
    for (var w = 0; w < way.length - 1; w++) {
      var a = way[w], b = way[w + 1], my = (a.y + b.y) / 2;
      for (var j = w ? 1 : 0; j <= 28; j++) {
        var t = j / 28, u = 1 - t;
        var x = u * u * u * a.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * b.x;
        var y = u * u * u * a.y + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * b.y;
        if (X.length) len += Math.hypot(x - X[X.length - 1], y - Y[Y.length - 1]);
        X.push(x); Y.push(y); L.push(len);
      }
      at.push(len);
    }
  })();
  var TOTAL = L[L.length - 1], MOUTH = at[8];
  function place(s) {
    var lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
    var f = (s - L[lo]) / ((L[hi] - L[lo]) || 1), dx = X[hi] - X[lo], dy = Y[hi] - Y[lo], d = Math.hypot(dx, dy) || 1;
    return { x: X[lo] + dx * f, y: Y[lo] + dy * f, tx: dx / d, ty: dy / d };
  }
  function stretch(s) { var i = 0; while (i < 7 && s >= at[i + 1]) i++; return i; }

  // ---- the land, in pen. Half the mountain's width at a height, for the snow, the hatching and the trees.
  function half(y) { var t = (y - PEAK.y) / (SHORE - PEAK.y); return 4 + 156 * Math.pow(t, 1.25); }
  function ridge(side) { // one flank from the peak to the shore, a little jagged near the top
    var d = '';
    for (var y = PEAK.y; y <= SHORE; y += 6) {
      var jag = y < 150 ? (rnd() - 0.5) * 5 : (rnd() - 0.5) * 2;
      d += (d ? 'L' : 'M') + (PEAK.x + side * (half(y) + jag)).toFixed(1) + ' ' + y + ' ';
    }
    return d;
  }
  function fir(g, x, y, h) {
    el('path', { class: 'pen', d: 'M' + x + ' ' + (y - h) + ' l' + (-h * 0.36) + ' ' + (h * 0.45) + ' h' + (h * 0.2) + ' l' + (-h * 0.3) + ' ' + (h * 0.4) + ' h' + (h * 0.92) +
      ' l' + (-h * 0.3) + ' ' + (-h * 0.4) + ' h' + (h * 0.2) + ' Z M' + x + ' ' + (y - h * 0.15) + ' v' + (h * 0.3) }, g);
  }
  function land(svg) {
    var g = el('g', { class: 'land' }, svg);
    // the sun on its arc: weather, nothing to tap
    var sky = el('g', { class: 'mt-place' }, svg);
    el('path', { class: 'pen far', d: 'M16 50 C36 48 48 16 64 14 C80 13 94 44 114 50' }, sky);
    el('circle', { class: 'pen sun', cx: 64, cy: 14, r: 5 }, sky);
    for (var r = 0; r < 8; r++) { var a = r * Math.PI / 4; el('path', { class: 'pen sun', d: 'M' + (64 + 8 * Math.cos(a)).toFixed(1) + ' ' + (14 + 8 * Math.sin(a)).toFixed(1) + ' L' + (64 + 11 * Math.cos(a)).toFixed(1) + ' ' + (14 + 11 * Math.sin(a)).toFixed(1) }, sky); }
    // stars, for the night
    for (var s = 0; s < 14; s++) el('circle', { class: 'star', cx: (10 + rnd() * 308).toFixed(1), cy: (6 + rnd() * 120).toFixed(1), r: (0.6 + rnd() * 0.7).toFixed(1) }, g);
    // two birds
    el('path', { class: 'pen far', d: 'M244 40 q4 -5 7 0 q3 -5 7 0 M268 54 q3 -4 5 0 q2 -4 5 0' }, g);
    // far ranges behind the peak
    el('path', { class: 'pen far', d: 'M0 262 L22 236 L38 248 L66 204 L84 226 L104 196 L118 214' }, g);
    el('path', { class: 'pen far', d: 'M212 206 L232 178 L250 200 L272 164 L292 196 L310 184 L328 208' }, g);
    el('path', { class: 'pen far', d: 'M0 322 L18 300 L34 312 L52 286' }, g);
    el('path', { class: 'pen far', d: 'M284 300 L300 280 L314 296 L328 284' }, g);
    // the peak
    el('path', { class: 'pen', d: ridge(-1) }, g);
    el('path', { class: 'pen', d: ridge(1) }, g);
    // the shaded flank: short pen strokes down the right side
    var hatch = '';
    for (var y = 84; y < SHORE - 24; y += 13) for (var k = 0; k < 3; k++) {
      var x = PEAK.x + half(y) * (0.78 + k * 0.07) - 3;
      hatch += 'M' + x.toFixed(1) + ' ' + (y + k * 3) + ' l-5 9 ';
    }
    el('path', { class: 'pen hatch', d: hatch }, g);
    // a spur on the left, and boulders by the water
    el('path', { class: 'pen far', d: 'M' + (PEAK.x - half(150) + 2) + ' 150 C128 190 118 236 96 280 C88 300 84 318 70 340' }, g);
    el('path', { class: 'pen', d: 'M118 388 q5 -8 12 -2 q6 -3 8 4 M196 390 q4 -7 10 -3 q5 0 6 5' }, g);
    // firs on the lower slopes, away from the water
    [[26, 388, 13], [40, 380, 16], [56, 388, 12], [70, 376, 15], [88, 386, 11], [44, 352, 12], [66, 338, 10],
      [246, 386, 12], [262, 378, 16], [278, 388, 13], [294, 382, 15], [308, 390, 11], [284, 352, 11], [262, 340, 10]].forEach(function (t) { fir(g, t[0], t[1], t[2]); });
    // the shore, either side of the river mouth
    el('path', { class: 'pen', d: 'M0 ' + (SHORE + 2) + ' C36 ' + (SHORE - 3) + ' 92 ' + (SHORE + 4) + ' 146 ' + SHORE + ' M182 ' + SHORE + ' C236 ' + (SHORE + 4) + ' 292 ' + (SHORE - 3) + ' 328 ' + (SHORE + 2) }, g);
  }

  var all = [];

  function Mountain(root) {
    var self = this;
    this.root = root;
    this.screen = root.closest('.screen');
    this.d = +root.dataset.d || 0;
    this.b = (root.dataset.b || '').split(',').map(Number);
    while (this.b.length < 7) this.b.push(0);
    this.q = [];

    var meter = document.createElement('div');
    meter.className = 'mt-meter';
    meter.innerHTML = '<small>Depression</small><div class="mt-rule" role="slider" aria-label="Depression" tabindex="0"><i></i></div>';
    root.appendChild(meter);
    this.meterMark = meter.querySelector('i');
    slide(meter.querySelector('.mt-rule'), function (v) { self.d = v; self.draw(); });

    var svg = this.svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H }, root);
    seed = 7;
    land(svg);
    // the snow: its line comes down the mountain as the day gets heavier, and cloud gathers on the peak
    this.snow = el('path', { class: 'pen snow' }, svg);
    this.flakes = el('path', { class: 'pen flake' }, svg);
    this.cloud = el('path', { class: 'pen cloud', d: 'M96 84 q10 -9 22 -3 q8 -12 24 -5 q14 -8 22 4 q14 -3 16 8 M150 104 q10 -8 20 -2 q10 -9 24 -2 q12 -5 18 5 q10 0 12 7 M118 62 q8 -7 18 -2 q8 -8 20 -1' }, svg);
    // the sea: wave strokes that sway on the breath, parted round the circle
    this.sea = el('g', { class: 'sea' }, svg);
    for (var row = 0; row < 6; row++) {
      var wy = SHORE + 12 + row * 12, d = '';
      for (var wx = -8 + (row % 2) * 14; wx < W + 8; wx += 28) {
        if (CIRCLES.some(function (c) { return Math.abs(wx + 9 - c[1]) < SEA.r + 15 && Math.abs(wy - SEA.y) < SEA.r + 6; })) continue;
        if (wy > SEA.y + SEA.r + 4 && wy < SEA.y + SEA.r + 22 && CIRCLES.some(function (c) { return Math.abs(wx + 9 - c[1]) < 38; })) continue;
        d += 'M' + wx + ' ' + wy + ' q4.5 -4 9 0 t9 0 ';
      }
      el('path', { class: 'pen wave', d: d, opacity: (0.75 - row * 0.08).toFixed(2) }, this.sea);
    }
    // the channel, one piece a stretch, so its width can say what runs there
    this.chan = [];
    for (var i = 0; i < 8; i++) {
      var dstr = '';
      for (var j = 0; j < L.length; j++) if (L[j] >= at[i] - 0.01 && L[j] <= at[i + 1] + 0.01) dstr += (dstr ? 'L' : 'M') + X[j].toFixed(1) + ' ' + Y[j].toFixed(1) + ' ';
      this.chan.push(el('path', { class: 'chan', d: dstr }, svg));
    }
    var g = el('g', { class: 'water' }, svg);
    this.motes = [];
    for (var m = 0; m < N; m++) {
      var depth = rnd();
      this.motes.push({ s: rnd() * TOTAL, u: rnd() + rnd() - 1, r: rnd(), a: 0, depth: depth,
        line: el('line', { class: 'mote', 'stroke-width': (1.6 + 1.6 * depth).toFixed(2), opacity: 0 }, g) });
    }
    // the circles afloat (Meditate empty, Energize with its arc inside), and the rings what arrives sends out
    var sea = el('g', { class: 'mt-place' }, svg);
    this.rings = []; this.floats = [];
    CIRCLES.forEach(function (c, i) {
      self.rings.push(el('circle', { class: 'pen far', cx: c[1], cy: SEA.y }, sea), el('circle', { class: 'pen far', cx: c[1], cy: SEA.y }, sea));
      var f = el('g', { class: 'float' }, sea);
      el('circle', { class: 'pen circle', cx: c[1], cy: SEA.y, r: SEA.r }, f);
      if (i === 1) el('path', { class: 'pen', d: 'M' + (c[1] - 10) + ' ' + (SEA.y + 5) + ' C' + (c[1] - 5) + ' ' + (SEA.y + 4) + ' ' + (c[1] - 4) + ' ' + (SEA.y - 7) + ' ' + c[1] + ' ' + (SEA.y - 7) + ' C' + (c[1] + 4) + ' ' + (SEA.y - 7) + ' ' + (c[1] + 5) + ' ' + (SEA.y + 4) + ' ' + (c[1] + 10) + ' ' + (SEA.y + 5) }, f);
      el('text', { class: 'name', x: c[1], y: SEA.y + SEA.r + 16, 'text-anchor': 'middle' }, f).textContent = c[0];
      self.floats.push(f);
    });
    // the seven lotuses, each with its gate
    this.stops = STOPS.map(function (s, i) {
      var p = way[i + 1], side = p.side, xin = p.x + side * 19, xout = p.x + side * 75;
      var grp = el('g', { class: 'mt-stop', style: '--hue:' + s[1] }, svg);
      var lotus = new Lotus(grp, p.x, p.y, 5, 10, s[3]);
      var name = el('text', { class: 'name', x: xin, y: p.y - 3, 'text-anchor': side > 0 ? 'start' : 'end' }, grp);
      name.textContent = s[0];
      var open = el('rect', { class: 'hit', x: Math.min(p.x - 16, xout), y: p.y - 22, width: Math.abs(xout - p.x) + 16, height: 24 }, grp);
      open.addEventListener('click', function () { if (document.getElementById(s[2])) location.hash = s[2]; });
      var gate = el('g', { class: 'gate' }, grp);
      el('line', { class: 'grule', x1: xin, y1: p.y + 12, x2: xout, y2: p.y + 12 }, gate);
      var mark = el('circle', { class: 'gmark', cy: p.y + 12, r: 4.5 }, gate);
      var pct = el('text', { class: 'pct', x: xout + side * 6, y: p.y + 16, 'text-anchor': side > 0 ? 'start' : 'end' }, gate);
      var hit = el('rect', { class: 'hit drag', x: Math.min(xin, xout) - 8, y: p.y + 2, width: 72, height: 22 }, gate);
      hit.addEventListener('pointerdown', function (e) {
        hit.setPointerCapture(e.pointerId);
        var move = function (ev) {
          var box = svg.getBoundingClientRect(), x = (ev.clientX - box.left) * W / box.width;
          self.b[i] = Math.max(0, Math.min(1, (x - xout) / (xin - xout)));
          self.draw();
        };
        var up = function () { hit.removeEventListener('pointermove', move); hit.removeEventListener('pointerup', up); hit.removeEventListener('pointercancel', up); };
        hit.addEventListener('pointermove', move); hit.addEventListener('pointerup', up); hit.addEventListener('pointercancel', up);
        move(e); e.preventDefault();
      });
      return { lotus: lotus, mark: mark, pct: pct, xin: xin, xout: xout };
    });
    this.draw();
  }

  Mountain.prototype.still = function () { return !!this.screen && this.screen.dataset.light === 'still'; };

  /** What runs in each stretch (PLAN-MOUNTAIN.md section 3). Still shows no state: every stretch the same. */
  Mountain.prototype.flow = function () {
    var still = this.still(), q = still ? 1 : 1 - 0.8 * this.d, out = [q];
    for (var i = 0; i < 7; i++) { if (!still) q *= 1 - 0.85 * this.b[i]; out.push(q); }
    return out;
  };

  Mountain.prototype.draw = function () {
    var self = this, d = this.still() ? 0 : this.d;
    this.q = this.flow();
    this.meterMark.style.left = (this.d * 100) + '%';
    // the snowline: a zigzag across the peak, lower on a heavy day, with a few flakes of snow under it
    var y = PEAK.y + 18 + 62 * d, h = half(y), z = '', n = 4 + Math.round(h / 7), f = '';
    for (var k = 0; k <= n; k++) z += (k ? 'L' : 'M') + (PEAK.x - h + 2 * h * k / n).toFixed(1) + ' ' + (y + (k % 2 ? 5 : -2)).toFixed(1) + ' ';
    this.snow.setAttribute('d', z);
    for (var yy = PEAK.y + 16; yy < y - 6; yy += 9) for (var xx = -half(yy) + 5; xx < half(yy) - 4; xx += 11) f += 'M' + (PEAK.x + xx + (yy % 2) * 4).toFixed(1) + ' ' + yy + ' h1.5 ';
    this.flakes.setAttribute('d', f);
    this.cloud.setAttribute('opacity', Math.max(0, (d - 0.15) / 0.85).toFixed(2));
    this.chan.forEach(function (c, i) { c.setAttribute('stroke-width', (1 + 2.5 * self.q[i]).toFixed(2)); });
    this.stops.forEach(function (s, i) {
      var b = self.b[i];
      s.lotus.set(self.still() ? 0 : b);
      s.mark.setAttribute('cx', (s.xout + (s.xin - s.xout) * b).toFixed(1));
      s.pct.textContent = b > 0.005 ? Math.round(b * 100) + '%' : '';
    });
  };

  Mountain.prototype.step = function (dt, now) {
    var light = (this.screen && this.screen.dataset.light) || 'day', still = light === 'still';
    var k = calm.matches ? 0 : (K[light] || 1);
    if (still !== this.wasStill) { this.wasStill = still; this.draw(); }
    // the breath, four in and six out: the sea sways on it
    var ph = (now / 1000) % 10, br = ph < 4 ? ph / 4 : 1 - (ph - 4) / 6, ease = br * br * (3 - 2 * br);
    this.sea.setAttribute('transform', 'translate(' + (k ? (ease - 0.5) * 7 : 0).toFixed(2) + ' 0)');
    // what arrives sends rings out from the circle
    var arrive = this.q[7];
    for (var r = 0; r < this.rings.length; r++) {
      var t = k ? ((now / 1000) * (0.08 + 0.22 * arrive) + (r % 2) / 2 + (r > 1 ? 0.25 : 0)) % 1 : 0;
      this.rings[r].setAttribute('r', (SEA.r + 3 + 16 * t).toFixed(1));
      this.rings[r].setAttribute('opacity', k ? ((1 - t) * (0.25 + 0.6 * arrive)).toFixed(2) : 0);
    }
    // the circles ride the swell, and stand out more the more water reaches them
    for (var c = 0; c < this.floats.length; c++) { this.floats[c].setAttribute('transform', 'translate(0 ' + (k ? (0.5 - ease) * 2.5 : 0).toFixed(2) + ')'); this.floats[c].setAttribute('opacity', (0.5 + 0.5 * arrive).toFixed(2)); }
    for (var n = 0; n < this.motes.length; n++) {
      var m = this.motes[n], i = stretch(m.s), q = this.q[i], pace = 0.3 + 1.2 * q, wide = 4.5;
      if (i < 7 && !still) { // the pool above a part-closed lotus
        var near = 1 - Math.min(1, (at[i + 1] - m.s) / POOL), b = this.b[i];
        pace *= 1 - 0.75 * b * near; wide += 5 * b * near;
      }
      var out = Math.max(0, (m.s - MOUTH) / (TOTAL - MOUTH)); // past the river mouth the water fans into the sea and slows
      wide += 46 * out; pace *= 1 - 0.6 * out;
      var v = BASE * pace * k;
      m.s += v * dt;
      if (m.s >= TOTAL) m.s -= TOTAL;
      var edge = Math.min(1, m.s / 14, (TOTAL - m.s) / 10);
      var want = k && m.r < 0.15 + 0.85 * q ? (0.35 + 0.55 * m.depth) * edge : 0;
      m.a += (want - m.a) * Math.min(1, dt * 3);
      var p = place(m.s), ox = -p.ty * m.u * wide, oy = p.tx * m.u * wide, dash = Math.max(0.5, Math.min(12, v * 0.12));
      m.line.setAttribute('x1', (p.x + ox).toFixed(1)); m.line.setAttribute('y1', (p.y + oy).toFixed(1));
      m.line.setAttribute('x2', (p.x + ox + p.tx * dash).toFixed(1)); m.line.setAttribute('y2', (p.y + oy + p.ty * dash).toFixed(1));
      m.line.setAttribute('opacity', m.a.toFixed(2));
    }
  };

  // a mark dragged along a rule: the meter, and the gate on a chakra's page
  function slide(rule, set) {
    rule.addEventListener('pointerdown', function (e) {
      rule.setPointerCapture(e.pointerId);
      var move = function (ev) { var box = rule.getBoundingClientRect(); set(Math.max(0, Math.min(1, (ev.clientX - box.left) / box.width))); };
      var up = function () { rule.removeEventListener('pointermove', move); rule.removeEventListener('pointerup', up); rule.removeEventListener('pointercancel', up); };
      rule.addEventListener('pointermove', move); rule.addEventListener('pointerup', up); rule.addEventListener('pointercancel', up);
      move(e); e.preventDefault();
    });
  }
  document.querySelectorAll('.mt-gate').forEach(function (gate) {
    var rule = gate.querySelector('.mt-rule'), mark = rule.querySelector('i'), pct = gate.querySelector('.mt-pct');
    // the chakra's own lotus above its gate: the petals, the element's shape and the seed syllable inside
    var big = gate.previousElementSibling, lotus = null;
    while (big && !big.classList.contains('mt-lotus')) big = big.previousElementSibling;
    if (big) {
      var svg = el('svg', { viewBox: '0 0 328 140' }, big), g = el('g', { class: 'mt-stop', style: '--hue:' + big.dataset.hue }, svg);
      lotus = new Lotus(g, 164, 74, 24, 36, +big.dataset.petals);
      var Yn = { square: 'M150 60 H178 V88 H150 Z', crescent: 'M150 70 A14 14 0 0 0 178 70 A17 10 0 0 1 150 70 Z', triangle: 'M149 62 H179 L164 90 Z',
        hexagram: 'M164 55 L180 83 H148 Z M164 93 L148 65 H180 Z', circle: 'M148 74 A16 16 0 1 0 180 74 A16 16 0 1 0 148 74 Z' }[big.dataset.yantra];
      if (Yn) el('path', { class: 'yantra', d: Yn }, g);
      if (big.dataset.bija) el('text', { class: 'bija', x: 164, y: 79, 'text-anchor': 'middle' }, g).textContent = big.dataset.bija;
    }
    var show = function (v) { mark.style.left = (v * 100) + '%'; pct.textContent = v > 0.005 ? Math.round(v * 100) + '%' : ''; if (lotus) lotus.set(v); };
    slide(rule, show); show(+gate.dataset.b || 0);
  });

  document.querySelectorAll('.mt').forEach(function (r) { all.push(new Mountain(r)); });
  var prev = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - prev) / 1000 || 0); prev = now;
    for (var i = 0; i < all.length; i++) if (all[i].root.offsetParent) all[i].step(dt, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

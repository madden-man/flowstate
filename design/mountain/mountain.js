// The mountain, as proposed in PLAN-MOUNTAIN.md: a mock that runs. One stream from the summit to the lake, seven stops,
// a meter for the whole mountain and a gate at each stop. The maths is section 3 of the plan; the real build puts it
// in model/mountain.ts and draws it with parts/Stream. No colour, font or duration is written here: tokens only.
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var W = 328, H = 476;
  // summit to foot: name, hue angle (the voice formula makes the colour), the walkthrough step a tap turns to
  var STOPS = [['3 a.m.', 305, 'night'], ['Replay', 275, 'replay'], ['Fight', 250, 'fight'], ['Depress', 150, 'depress'],
    ['Shame', 95, 'shame'], ['Shutdown', 55, 'shutdown'], ['Panic', 25, 'panic']];
  var BASE = 30, POOL = 26, N = 120;
  var K = { day: 1, night: 0.85, still: 0.4 };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---- the walk: summit, seven stops on alternating sides, the lake
  var way = [{ x: 164, y: 58 }];
  STOPS.forEach(function (s, i) { var side = i % 2 ? -1 : 1; way.push({ x: 164 + side * (12 + i * 8), y: 104 + i * 46, side: side }); });
  way.push({ x: 164, y: 430 });
  var X = [], Y = [], L = [], at = [0]; // samples, their distance along, and the distance of each waypoint
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
  var TOTAL = L[L.length - 1];
  function place(s) { // the point and the unit tangent at distance s
    var lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
    var f = (s - L[lo]) / ((L[hi] - L[lo]) || 1), dx = X[hi] - X[lo], dy = Y[hi] - Y[lo], d = Math.hypot(dx, dy) || 1;
    return { x: X[lo] + dx * f, y: Y[lo] + dy * f, tx: dx / d, ty: dy / d };
  }
  function stretch(s) { var i = 0; while (i < 7 && s >= at[i + 1]) i++; return i; } // 0 above the first stop ... 7 below the last

  var all = [];

  function Mountain(root) {
    var self = this;
    this.root = root;
    this.screen = root.closest('.screen');
    this.d = +root.dataset.d || 0;
    this.b = (root.dataset.b || '').split(',').map(Number);
    while (this.b.length < 7) this.b.push(0);
    this.q = [];

    // the meter: one rule above the summit
    var meter = document.createElement('div');
    meter.className = 'mt-meter';
    meter.innerHTML = '<small>Depression</small><div class="mt-rule" role="slider" aria-label="Depression" tabindex="0"><i></i></div>';
    root.appendChild(meter);
    this.meterMark = meter.querySelector('i');
    slide(meter.querySelector('.mt-rule'), function (v) { self.d = v; self.draw(); });

    var svg = this.svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H }, root);
    el('path', { class: 'ridge', d: 'M6 432 C60 410 120 170 164 50 C208 170 268 410 322 432' }, svg);
    // Energize, the arc in the sky
    var sky = el('g', { class: 'mt-place' }, svg);
    el('path', { class: 'pass', d: 'M18 44 L112 44' }, sky);
    el('path', { class: 'arc', d: 'M22 44 C40 43 50 16 64 14 C78 13 92 40 110 44' }, sky);
    el('text', { class: 'name', x: 66, y: 62, 'text-anchor': 'middle' }, sky).textContent = 'Energize';
    // the channel, one piece a stretch, so its width can say what runs there
    this.chan = [];
    for (var i = 0; i < 8; i++) {
      var dstr = '';
      for (var j = 0; j < L.length; j++) if (L[j] >= at[i] - 0.01 && L[j] <= at[i + 1] + 0.01) dstr += (dstr ? 'L' : 'M') + X[j].toFixed(1) + ' ' + Y[j].toFixed(1) + ' ';
      this.chan.push(el('path', { class: 'chan', d: dstr }, svg));
    }
    // the water
    var g = el('g', { class: 'water' }, svg);
    this.motes = [];
    for (var m = 0; m < N; m++) {
      var depth = Math.random();
      this.motes.push({ s: Math.random() * TOTAL, u: Math.random() + Math.random() - 1, r: Math.random(), a: 0, depth: depth,
        line: el('line', { class: 'mote', 'stroke-width': (1.6 + 1.6 * depth).toFixed(2), opacity: 0 }, g) });
    }
    // Meditate, the lake
    var lake = el('g', { class: 'mt-place' }, svg);
    el('circle', { class: 'arc', cx: 164, cy: 446, r: 15 }, lake);
    el('text', { class: 'name', x: 188, y: 451, 'text-anchor': 'start' }, lake).textContent = 'Meditate';
    // the seven stops, each with its gate
    this.stops = STOPS.map(function (s, i) {
      var p = way[i + 1], side = p.side, xin = p.x + side * 14, xout = p.x + side * 70;
      var grp = el('g', { class: 'mt-stop', style: '--hue:' + s[1] }, svg);
      el('circle', { class: 'ring', cx: p.x, cy: p.y, r: 7 }, grp);
      var fill = el('circle', { class: 'fill', cx: p.x, cy: p.y, r: 7 }, grp);
      var name = el('text', { class: 'name', x: xin, y: p.y - 3, 'text-anchor': side > 0 ? 'start' : 'end' }, grp);
      name.textContent = s[0];
      var open = el('rect', { class: 'hit', x: Math.min(p.x - 12, xout), y: p.y - 22, width: Math.abs(xout - p.x) + 12, height: 24 }, grp);
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
      return { fill: fill, mark: mark, pct: pct, xin: xin, xout: xout };
    });
    this.draw();
  }

  /** What runs in each stretch (PLAN-MOUNTAIN.md section 3). Still shows no state: every stretch the same. */
  Mountain.prototype.flow = function () {
    var still = this.screen && this.screen.dataset.light === 'still';
    var q = still ? 1 : 1 - 0.8 * this.d, out = [q];
    for (var i = 0; i < 7; i++) { if (!still) q *= 1 - 0.85 * this.b[i]; out.push(q); }
    return out;
  };

  Mountain.prototype.draw = function () {
    var self = this;
    this.q = this.flow();
    this.meterMark.style.left = (this.d * 100) + '%';
    this.chan.forEach(function (c, i) { c.setAttribute('stroke-width', (1 + 2.5 * self.q[i]).toFixed(2)); });
    this.stops.forEach(function (s, i) {
      var b = self.b[i];
      s.fill.setAttribute('opacity', b.toFixed(2));
      s.mark.setAttribute('cx', (s.xout + (s.xin - s.xout) * b).toFixed(1));
      s.pct.textContent = b > 0.005 ? Math.round(b * 100) + '%' : '';
    });
  };

  Mountain.prototype.step = function (dt) {
    var light = (this.screen && this.screen.dataset.light) || 'day', still = light === 'still';
    var k = calm.matches ? 0 : (K[light] || 1);
    if (still !== this.wasStill) { this.wasStill = still; this.draw(); }
    for (var n = 0; n < this.motes.length; n++) {
      var m = this.motes[n], i = stretch(m.s), q = this.q[i], pace = 0.3 + 1.2 * q, wide = 4.5;
      if (i < 7 && !still) { // the pool above a part-closed gate
        var near = 1 - Math.min(1, (at[i + 1] - m.s) / POOL), b = this.b[i];
        pace *= 1 - 0.75 * b * near; wide += 5 * b * near;
      }
      var v = BASE * pace * k;
      m.s += v * dt;
      if (m.s >= TOTAL) m.s -= TOTAL;
      var edge = Math.min(1, m.s / 14, (TOTAL - m.s) / 14);
      var want = k && m.r < 0.15 + 0.85 * q ? (0.35 + 0.55 * m.depth) * edge : 0;
      m.a += (want - m.a) * Math.min(1, dt * 3);
      var p = place(m.s), ox = -p.ty * m.u * wide, oy = p.tx * m.u * wide, dash = Math.max(0.5, Math.min(12, v * 0.12));
      m.line.setAttribute('x1', (p.x + ox).toFixed(1)); m.line.setAttribute('y1', (p.y + oy).toFixed(1));
      m.line.setAttribute('x2', (p.x + ox + p.tx * dash).toFixed(1)); m.line.setAttribute('y2', (p.y + oy + p.ty * dash).toFixed(1));
      m.line.setAttribute('opacity', m.a.toFixed(2));
    }
  };

  // a mark dragged along a rule: the meter, and the gate on a flow's page
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
    var rule = gate.querySelector('.mt-rule'), mark = rule.querySelector('i'), pct = gate.querySelector('.mt-pct'), ring = gate.querySelector('.mt-dot b');
    var show = function (v) { mark.style.left = (v * 100) + '%'; pct.textContent = v > 0.005 ? Math.round(v * 100) + '%' : ''; ring.style.opacity = v; };
    slide(rule, show); show(+gate.dataset.b || 0);
  });

  document.querySelectorAll('.mt').forEach(function (r) { all.push(new Mountain(r)); });
  // a mock that opens on the foot of the page
  document.querySelectorAll('[data-foot]').forEach(function (s) { s.dataset.footed = ''; });
  var prev = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - prev) / 1000 || 0); prev = now;
    for (var i = 0; i < all.length; i++) if (all[i].root.offsetParent) all[i].step(dt);
    document.querySelectorAll('[data-footed]').forEach(function (s) { if (s.offsetParent && s.scrollHeight > s.clientHeight) { s.scrollTop = s.scrollHeight; delete s.dataset.footed; } });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// Energize, the fixations (PLAN-ENERGIZE.md): what makes the proposal's phones live. Two things only.
//   1. The stream on the arc, a small stand-in for parts/Stream + cycle/stream.ts: the same motes pass every point, so
//      they thin out where the step runs fast and pool where it runs slow; one lane a fixation, in its hue.
//   2. The swap: a tap on one of the three raises the deck; a tap on a deck row puts it in that place.
// The real page is package X2 and X3; nothing here ships.
(function () {
  var NS = 'http://www.w3.org/2000/svg';

  // ---- the arc's main line (cycle/arc.ts): baseline, climb, crest, glide, baseline, as a polyline with lengths
  var SEGS = [
    [[14, 172], [44, 172]],
    [[44, 172], [86, 170], [104, 44], [146, 42]],
    [[146, 42], [196, 38], [226, 170], [272, 172]],
    [[272, 172], [316, 172]],
  ];
  var PTS = [];
  SEGS.forEach(function (s) {
    for (var k = 0; k <= 40; k++) {
      var t = k / 40, x, y;
      if (s.length === 2) { x = s[0][0] + (s[1][0] - s[0][0]) * t; y = s[0][1] + (s[1][1] - s[0][1]) * t; }
      else {
        var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        x = a * s[0][0] + b * s[1][0] + c * s[2][0] + d * s[3][0];
        y = a * s[0][1] + b * s[1][1] + c * s[2][1] + d * s[3][1];
      }
      PTS.push([x, y]);
    }
  });
  var LEN = [0];
  for (var p = 1; p < PTS.length; p++) LEN.push(LEN[p - 1] + Math.hypot(PTS[p][0] - PTS[p - 1][0], PTS[p][1] - PTS[p - 1][1]));
  var TOTAL = LEN[LEN.length - 1];
  function at(s) {
    var lo = 0, hi = LEN.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (LEN[m] <= s) lo = m; else hi = m; }
    var f = (s - LEN[lo]) / ((LEN[hi] - LEN[lo]) || 1), A = PTS[lo], B = PTS[hi];
    var dx = B[0] - A[0], dy = B[1] - A[1], n = Math.hypot(dx, dy) || 1;
    return { x: A[0] + dx * f, y: A[1] + dy * f, tx: dx / n, ty: dy / n };
  }
  // the pace along the line (model/pace.ts, with the plan's quicker rest): rest, Spark, Build, Locked in, The tip, Landing, rest
  var PACE = [[0, 1.1], [.09, 1.1], [.25, 1.5], [.42, 2.0], [.52, 2.4], [.68, 1.0], [1, 1.1]];
  function pace(f) {
    for (var k = 1; k < PACE.length; k++) if (f <= PACE[k][0]) {
      var a = PACE[k - 1], b = PACE[k];
      return a[1] + (b[1] - a[1]) * ((f - a[0]) / ((b[0] - a[0]) || 1));
    }
    return 1;
  }

  function Stream(host) {
    this.host = host; this.svg = host.querySelector('svg'); this.draw = host.closest('.fl-drawing');
    this.motes = []; this.lines = []; this.surge = 0;
    for (var k = 0; k < 54; k++) {
      var el = document.createElementNS(NS, 'line');
      el.setAttribute('class', 'h' + (k % 3));
      el.setAttribute('stroke-width', (1 + (k * 7 % 5) / 4).toFixed(2));
      this.svg.appendChild(el); this.lines.push(el);
      // spread evenly in time, not in distance, so the first frame is already the steady state
      this.motes.push({ s: 0, off: ((k * 37) % 17) - 8, o: .25 + ((k * 13) % 10) / 22 });
    }
    var T = 0, acc = [0];
    for (var q = 1; q <= 200; q++) { T += 1 / pace((q - .5) / 200); acc.push(T); }
    for (var m = 0; m < this.motes.length; m++) {
      var want = (m + .5) / this.motes.length * T, j = 1;
      while (acc[j] < want) j++;
      this.motes[m].s = (j - 1 + (want - acc[j - 1]) / (acc[j] - acc[j - 1])) / 200 * TOTAL;
    }
    this.k = 1; this.frames = 0;
  }
  Stream.prototype.step = function (dt) {
    if (this.frames++ % 30 === 0) {
      var v = parseFloat(getComputedStyle(this.host).getPropertyValue('--stream'));
      this.k = isFinite(v) ? v : 1;
      this.host.style.display = this.k > 0 ? '' : 'none';
    }
    if (this.surge > 0) this.surge = Math.max(0, this.surge - dt);
    var show = Math.round(this.motes.length * Math.min(1, .35 + .65 * this.k));
    for (var k = 0; k < this.motes.length; k++) {
      var m = this.motes[k], el = this.lines[k];
      if (k >= show) { el.setAttribute('opacity', '0'); continue; }
      var f = m.s / TOTAL, v = pace(f) * (1 + this.surge * 1.6) * this.k;
      m.s += v * 26 * dt; if (m.s > TOTAL) m.s -= TOTAL;
      var P = at(m.s), nx = -P.ty, ny = P.tx, half = 2 + v * 2.2;
      var x = P.x + nx * m.off, y = P.y + ny * m.off;
      el.setAttribute('x1', (x - P.tx * half).toFixed(1)); el.setAttribute('y1', (y - P.ty * half).toFixed(1));
      el.setAttribute('x2', (x + P.tx * half).toFixed(1)); el.setAttribute('y2', (y + P.ty * half).toFixed(1));
      var edge = Math.min(1, f / .05, (1 - f) / .05);
      el.setAttribute('opacity', (m.o * edge).toFixed(2));
    }
  };
  // a landing: one ring out from the dot, and the water pushed on (parts/Stream land)
  Stream.prototype.land = function (hue) {
    this.surge = .8;
    var dot = this.draw.querySelector('.now'); if (!dot) return;
    var old = this.svg.querySelector('.fl-ripple'); if (old) old.remove();
    var c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'fl-ripple'); c.setAttribute('cx', dot.getAttribute('cx')); c.setAttribute('cy', dot.getAttribute('cy')); c.setAttribute('r', '10');
    if (hue) c.style.setProperty('--fxr', hue);
    c.addEventListener('animationend', function () { c.remove(); });
    this.svg.appendChild(c);
  };

  var streams = [].slice.call(document.querySelectorAll('.fl-stream')).map(function (h) { var s = new Stream(h); h.fxStream = s; return s; });
  var still = matchMedia('(prefers-reduced-motion: reduce)');
  var prev = 0;
  function frame(now) {
    var dt = prev ? Math.min(.05, (now - prev) / 1000) : 0; prev = now;
    if (!still.matches && document.visibilityState !== 'hidden') streams.forEach(function (s) { if (s.host.closest('.step.on')) s.step(dt); });
    requestAnimationFrame(frame);
  }
  streams.forEach(function (s) { s.step(0); });
  requestAnimationFrame(frame);

  // ---- the swap
  function hues(screen) {
    var d = screen.querySelector('.fl-drawing'); if (!d || d.dataset.ride !== undefined) return;
    [].slice.call(screen.querySelectorAll('.fx-cards .fx-card')).forEach(function (c, k) { d.style.setProperty('--fx' + k, c.style.getPropertyValue('--vc')); });
  }
  document.querySelectorAll('.screen').forEach(hues);
  function shut(screen) { screen.querySelectorAll('.fx-sheet, .fx-scrim').forEach(function (x) { x.classList.add('out'); }); }
  document.addEventListener('pointerdown', function (e) { var c = e.target.closest('.fx-card'); if (c) c.setAttribute('data-down', ''); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { document.addEventListener(t, function () { document.querySelectorAll('.fx-card[data-down]').forEach(function (c) { c.removeAttribute('data-down'); }); }, true); });
  document.addEventListener('click', function (e) {
    var screen = e.target.closest('.screen'); if (!screen) return;
    var sheet = screen.querySelector('.fx-sheet[data-swap]');
    var card = e.target.closest('.fx-cards .fx-card');
    if (card && sheet) {
      screen.fxSlot = card;
      sheet.style.setProperty('--vc', card.style.getPropertyValue('--vc'));
      sheet.querySelector('h2 span').textContent = card.querySelector('.fx-name span').textContent;
      sheet.querySelector('.fx-since').textContent = card.dataset.since || 'On since today';
      sheet.querySelector('.fx-fate span').textContent = card.querySelector('.fx-name span').textContent + ' goes back on deck.';
      sheet.querySelectorAll('[data-dealt]').forEach(function (r) { r.removeAttribute('data-dealt'); });
      sheet.classList.remove('out'); screen.querySelector('.fx-scrim').classList.remove('out');
      return;
    }
    if (e.target.closest('.fx-scrim')) { shut(screen); return; }
    var deal = e.target.closest('[data-deal]');
    if (deal && sheet) {
      var deck = sheet.querySelector('.fx-deck'), rows = [].slice.call(deck.querySelectorAll('.fx-deckrow'));
      rows.forEach(function (r) { r.removeAttribute('data-dealt'); });
      deck.removeAttribute('data-riffle'); void deck.offsetWidth; deck.setAttribute('data-riffle', '');
      var pick = rows[Math.floor(Math.random() * rows.length)];
      if (pick === deck.fxLast && rows.length > 1) pick = rows[(rows.indexOf(pick) + 1) % rows.length];
      deck.fxLast = pick; pick.setAttribute('data-dealt', '');
      return;
    }
    var row = e.target.closest('.fx-sheet[data-swap] .fx-deckrow');
    if (row) {
      var slot = screen.fxSlot || screen.querySelector('.fx-cards .fx-card:last-child');
      var name = slot.querySelector('.fx-name span'), was = name.textContent, wasHue = slot.style.getPropertyValue('--vc');
      var hue = row.style.getPropertyValue('--vc');
      name.textContent = row.querySelector('b').textContent; slot.style.setProperty('--vc', hue);
      slot.querySelector('.fx-meta').innerHTML = 'Since today<span class="fs-notstill"> · brand new</span>';
      slot.dataset.since = 'On since today';
      row.querySelector('b').textContent = was; row.style.setProperty('--vc', wasHue); row.querySelector('small').textContent = 'last on 11 / 10';
      row.removeAttribute('data-dealt');
      var chips = [].slice.call(screen.querySelectorAll('.fx-deckpeek .fs-chip'));
      chips.forEach(function (c) { if (c.lastChild.textContent === name.textContent) { c.lastChild.textContent = was; c.style.setProperty('--vc', wasHue); } });
      shut(screen); hues(screen);
      slot.classList.remove('fresh'); void slot.offsetWidth; slot.classList.add('fresh');
      var s = screen.querySelector('.fl-stream'); if (s && s.fxStream) s.fxStream.land(hue);
    }
  });
})();

// The mountain, as proposed in PLAN-MOUNTAIN.md: a mock that runs. Meru drawn in pen and ink, a horn with a face in shadow: snow at the summit, one stream
// down through seven signs to the ocean, and the circles floating there. A meter for the whole mountain (the weather
// on the peak) and a gate at each sign (it empties and shrinks). The maths is section 3 of the plan; the real build puts it
// in model/mountain.ts and draws it with parts/Stream. No colour, font or duration is written here: tokens only.
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var W = 328, H = 476, PEAK = { x: 164, y: 44 }, SHORE = 394, SEA = { y: 434, r: 15 };
  // the circles afloat in the sea: what he does when the water is running well. Room for more.
  var CIRCLES = [['Meditate', 108, 'places'], ['Energize', 220, 'places']];
  // the seven, crown to root: the part of the body or soul it sits at (its only name: nothing here is borrowed from
  // the Hindu chakras' own names, lotuses or letters), hue, step id, its sign, and where the stream meets it: x, y and
  // the side its name and gate go. The course is uneven on purpose, each stop placed by what it is:
  //   Crown        just under the summit, in the snow the water starts as: letting go
  //   Third eye    a ledge out on the lit side, close under the crown, where you can see a long way
  //   Throat       back in tight against the arete, the narrows where the water is loudest: speech
  //   Heart        the long swing out to the wide hollow at the mountain's middle, where water rests in a tarn
  //   Solar plexus across to the far flank, a fire kept on the side in shadow: will
  //   Sacral       a short drop to a pool low on the lit side: feeling
  //   Root         the foot, in the trees, where the mountain meets the ground: safety
  var STOPS = [['Crown', 305, 'crown', 'crown', 172, 80, 1], ['Third eye', 275, 'third-eye', 'eye', 138, 112, -1], ['Throat', 250, 'throat', 'voice', 180, 152, 1],
    ['Heart', 150, 'heart', 'heart', 112, 222, -1], ['Solar plexus', 95, 'solar-plexus', 'sun', 216, 272, 1], ['Sacral', 55, 'sacral', 'drop', 148, 316, -1],
    ['Root', 25, 'root', 'sprout', 198, 360, 1]];
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

  // ---- the signs: one small drawn mark a stop, in a box of 20, full of its colour when the water runs through it and
  // emptying to an outline and drawing in as its gate closes (b from 0, open, to 1, shut). ink is drawn in line only.
  var SIGNS = {
    crown: { fill: 'M-8 6 L-9.5 -4 L-4.5 1 L0 -8 L4.5 1 L9.5 -4 L8 6 Z' },
    eye: { fill: 'M-10 0 Q0 -9 10 0 Q0 9 -10 0 Z', ink: 'M-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M-6 -6.5 l-1.5 -2.5 M0 -8 v-3 M6 -6.5 l1.5 -2.5' },
    voice: { fill: 'M-7 -7 H7 Q10 -7 10 -4 V1 Q10 4 7 4 H-1 L-6 9 L-5 4 H-7 Q-10 4 -10 1 V-4 Q-10 -7 -7 -7 Z', ink: 'M-5 -3 H5 M-5 0 H2' },
    heart: { fill: 'M0 8.5 C-13 0 -9.5 -9 -4.5 -8.5 C-1.5 -8.3 0 -5.5 0 -4 C0 -5.5 1.5 -8.3 4.5 -8.5 C9.5 -9 13 0 0 8.5 Z' },
    sun: { fill: 'M-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z', ink: 'M0 -7.5 V-10.5 M0 7.5 V10.5 M-7.5 0 H-10.5 M7.5 0 H10.5 M-5.3 -5.3 L-7.4 -7.4 M5.3 -5.3 L7.4 -7.4 M-5.3 5.3 L-7.4 7.4 M5.3 5.3 L7.4 7.4' },
    drop: { fill: 'M0 -10 C4 -4 8 0 8 3.5 A8 8 0 0 1 -8 3.5 C-8 0 -4 -4 0 -10 Z', ink: 'M-4 4 a4.5 4.5 0 0 0 3 3.5' },
    sprout: { fill: 'M0 1 C-8 0 -10 -8 -10 -8 C-3 -9 0 -4 0 1 Z M0 1 C8 0 10 -8 10 -8 C3 -9 0 -4 0 1 Z', ink: 'M0 1 V6 M0 6 L-5 10.5 M0 6 L5 10.5 M0 6 V11' },
  };
  function Sign(parent, cx, cy, k, kind) {
    var sg = SIGNS[kind] || SIGNS.heart;
    this.cx = cx; this.cy = cy; this.k = k;
    this.g = el('g', { class: 'sign' }, parent);
    el('circle', { class: 'ground', r: 13 }, this.g);
    this.body = el('path', { class: 'body', d: sg.fill }, this.g);
    if (sg.ink) el('path', { class: 'line', d: sg.ink }, this.g);
    this.set(0);
  }
  Sign.prototype.set = function (b) {
    var k = this.k * (1 - 0.3 * b);
    this.g.setAttribute('transform', 'translate(' + this.cx + ' ' + this.cy + ') scale(' + k.toFixed(3) + ')');
    this.body.setAttribute('fill-opacity', (1 - b).toFixed(2));
  };

  // ---- the walk: the spring under the snow, the seven signs where STOPS puts them, the river mouth, the circles in the sea
  var way = [{ x: PEAK.x, y: PEAK.y + 14 }];
  STOPS.forEach(function (s) { way.push({ x: s[4], y: s[5], side: s[6] }); });
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

  // ---- the land, in pen and ink (pass 5: "draw the mountain in a more dramatic and visceral way"). A horn, not a
  // hill: a spire that steepens to the summit, crags broken out of both flanks, an arete falling from the peak that
  // splits a lit face from a face in shadow (tone under close hatching), gullies cut down the lit side, two lesser
  // horns shouldering in behind, spindrift torn off the top, and a black treeline over sea cliffs at the foot.
  // Half the mountain's width at a height, for the snow.
  function half(y) { var t = (y - PEAK.y) / (SHORE - PEAK.y); return 3 + 150 * Math.pow(t, 1.5); }
  var FLANK = { '-1': [], '1': [] }, ARETE = [];
  function flank(side) { // one flank from the peak to the shore: cliffs and ledges, the crags bigger up high
    var pts = FLANK[side], out = 0;
    for (var y = PEAK.y; y <= SHORE; y += 4) {
      var amp = y < 210 ? 7 : 4;
      if (rnd() < 0.2) out = (rnd() - 0.3) * amp * 1.6; // a crag breaks out, or a notch bites in, and holds a while
      pts.push([PEAK.x + side * (half(y) + out + (rnd() - 0.5) * amp * 0.5), y]);
    }
    pts[0] = [PEAK.x, PEAK.y];
    return pts;
  }
  function line(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' '); }
  function arete(y) { return PEAK.x + 5 + (y - PEAK.y) * 0.13 + 5 * Math.sin(y / 23) + 3 * Math.sin(y / 9); }
  function edge(side, y) { var p = FLANK[side][Math.max(0, Math.min(FLANK[side].length - 1, Math.round((y - PEAK.y) / 4)))]; return p[0]; }
  // a line that falls down a face, breaking left and right as rock does
  function fall(x, y, dx, len, step) {
    var d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
    for (var k = 0; k < len; k += step) {
      x += dx * step + (rnd() - 0.5) * 5; y += step;
      // a crack stays on the rock: it stops short of either flank and above the trees
      if (y > SHORE - 16 || x < edge(-1, y) + 5 || x > edge(1, y) - 5) break;
      d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d + ' ';
  }
  function hatchBand(x0, x1, y, gap, lean) { var d = ''; for (var x = x0; x < x1; x += gap) d += 'M' + x.toFixed(1) + ' ' + y + ' l' + lean + ' 7 '; return d; }
  function land(svg) {
    // each mountain on the page is drawn afresh, from the same seed, so each is the same mountain
    FLANK = { '-1': [], '1': [] }; ARETE = [];
    var g = el('g', { class: 'land' }, svg);
    // stars, for the night
    for (var s = 0; s < 14; s++) el('circle', { class: 'star', cx: (10 + rnd() * 308).toFixed(1), cy: (6 + rnd() * 120).toFixed(1), r: (0.6 + rnd() * 0.7).toFixed(1) }, g);
    // far ranges, sawtoothed, low behind everything
    el('path', { class: 'pen far', d: 'M0 250 L14 226 L22 236 L40 196 L48 210 L62 178 L72 200 L80 190 L96 222' }, g);
    el('path', { class: 'pen far', d: 'M232 214 L246 186 L254 198 L270 160 L280 182 L290 170 L306 204 L316 194 L328 216' }, g);
    // two lesser horns shouldering in behind the peak, each with its dark side
    var horns = [
      [[0, 344], [20, 300], [30, 312], [52, 250], [60, 262], [82, 196], [90, 210], [104, 148], [111, 166], [117, 158], [126, 196], [132, 260], [120, 344]],
      [[200, 344], [198, 190], [206, 172], [214, 136], [221, 150], [232, 116], [240, 142], [246, 134], [262, 184], [272, 174], [292, 236], [300, 226], [328, 290], [328, 344]],
    ];
    horns.forEach(function (h, i) {
      el('path', { class: 'mass', d: line(h) + ' Z' }, g);
      el('path', { class: 'pen rock', d: line(h.slice(0, h.length - 1 - i)) }, g);
    });
    var dark = '';
    for (var y1 = 160; y1 < 330; y1 += 8) dark += hatchBand(104 + (y1 - 148) * 0.06, 110 + (y1 - 148) * 0.14, y1, 4, -3);
    for (var y2 = 128; y2 < 330; y2 += 8) dark += hatchBand(233 + (y2 - 116) * 0.1, 238 + (y2 - 116) * 0.42, y2, 5, -3);
    el('path', { class: 'pen hatch', d: dark }, g);
    // spindrift torn off the summit, downwind
    el('path', { class: 'pen far', d: 'M167 41 q20 -13 50 -10 M171 47 q28 -9 64 -2 M169 35 q12 -9 30 -10 M178 53 q22 -4 44 4' }, g);
    // the peak: its mass first, so nothing behind shows through; then the face in shadow, then the ink
    var lf = flank(-1), rt = flank(1);
    for (var y = PEAK.y; y <= SHORE; y += 4) ARETE.push([y === PEAK.y ? PEAK.x : arete(y), y]);
    el('path', { class: 'mass', d: line(lf) + ' ' + line(rt.slice().reverse()).replace('M', 'L') + ' Z' }, g);
    el('path', { class: 'shade', d: line(ARETE) + ' ' + line(rt.slice().reverse()).replace('M', 'L') + ' Z' }, g);
    // the shadow's hatching: close against the arete, opening toward the far edge
    var hatch = '';
    for (var hy = PEAK.y + 10; hy < SHORE - 8; hy += 6) {
      var x0 = arete(hy) + 2, x1 = edge(1, hy) - 3;
      for (var x = x0, gap = 4; x < x1; x += gap, gap = Math.min(10, gap * 1.2)) hatch += 'M' + (x + (rnd() - 0.5)).toFixed(1) + ' ' + hy + ' l-3.5 ' + (6 + rnd() * 3).toFixed(1) + ' ';
    }
    el('path', { class: 'pen hatch', d: hatch }, g);
    // gullies cut down the lit face from the arete, and the broken rock between them
    var cut = '';
    for (var k = 0; k < 6; k++) { var gy = 74 + k * 44; cut += fall(arete(gy) - 2, gy, -0.42 - k * 0.04, 46 + k * 16, 7); }
    for (var k2 = 0; k2 < 4; k2++) { var sy = 110 + k2 * 62; cut += fall(arete(sy) + 4, sy, 0.3, 40 + k2 * 10, 7); }
    el('path', { class: 'pen crack', d: cut }, g);
    var chips = '';
    for (var c = 0; c < 70; c++) {
      var cy = 80 + rnd() * (SHORE - 110), lo = edge(-1, cy) + 5, hi = arete(cy) - 6;
      if (hi - lo < 8) continue;
      var cx = lo + rnd() * (hi - lo);
      chips += 'M' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' l' + (-2 - rnd() * 3).toFixed(1) + ' ' + (4 + rnd() * 5).toFixed(1) + ' ';
    }
    el('path', { class: 'pen far', d: chips }, g);
    // the ground each stop sits on: the ledge under the eye, the falls at the throat, the tarn the heart rests in
    el('path', { class: 'pen rock thin', d: 'M124 121 l10 3 l12 -1 l9 3' }, g);
    el('path', { class: 'pen far', d: 'M176 160 v12 M180 162 v15 M184 160 v11 M172 164 v8' }, g);
    el('path', { class: 'pen rock thin', d: 'M92 232 q20 -9 42 0 q-20 10 -42 0 Z' }, g);
    el('path', { class: 'pen far', d: 'M100 232 h10 M114 235 h10 M106 229 h8' }, g);
    // the ink: both flanks heavy, the shadow side heaviest, and the arete falling from the summit
    el('path', { class: 'pen rock', d: line(lf) }, g);
    el('path', { class: 'pen rock bold', d: line(rt) }, g);
    el('path', { class: 'pen rock', d: line(ARETE.slice(0, 66)) }, g);
    // the foot: a black treeline either side of the river, two ranks deep, and scree by the water
    var trees = '', back = '';
    for (var tx = 2; tx < W - 2; tx += 3.2) {
      if (tx > 128 && tx < 204) continue;
      var th = 6 + rnd() * 7;
      trees += 'M' + tx.toFixed(1) + ' ' + (SHORE - 1) + ' l1.6 ' + (-th).toFixed(1) + ' l1.6 ' + th.toFixed(1) + ' ';
      if (tx < 104 || tx > 226) { var bh = 5 + rnd() * 6; back += 'M' + (tx + 1.4).toFixed(1) + ' ' + (SHORE - 9) + ' l1.5 ' + (-bh).toFixed(1) + ' l1.5 ' + bh.toFixed(1) + ' '; }
    }
    el('path', { class: 'pen far', d: back }, g);
    el('path', { class: 'pen rock thin', d: trees }, g);
    el('path', { class: 'pen', d: 'M132 388 q5 -9 12 -2 q6 -4 8 4 M186 390 q4 -8 10 -3 q5 -1 6 5 M146 380 q3 -5 7 -1 M178 382 q3 -5 7 -1' }, g);
    // the shore: sea cliffs, either side of the river mouth, with the rock dropping into the water
    el('path', { class: 'pen rock', d: 'M0 ' + (SHORE + 2) + ' L30 ' + (SHORE - 1) + ' L58 ' + (SHORE + 3) + ' L96 ' + SHORE + ' L146 ' + (SHORE + 1) + ' M182 ' + (SHORE + 1) + ' L232 ' + (SHORE + 3) + ' L270 ' + (SHORE - 1) + ' L300 ' + (SHORE + 3) + ' L328 ' + (SHORE + 1) }, g);
    var drop = '';
    for (var dx = 4; dx < W - 2; dx += 5) { if (dx > 142 && dx < 186) continue; drop += 'M' + dx + ' ' + (SHORE + 3) + ' v' + (3 + rnd() * 4).toFixed(1) + ' '; }
    el('path', { class: 'pen far', d: drop }, g);
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
    // the seven signs, each with its gate
    this.stops = STOPS.map(function (s, i) {
      var p = way[i + 1], side = p.side, xin = p.x + side * 19, xout = p.x + side * 75;
      var grp = el('g', { class: 'mt-stop', style: '--hue:' + s[1] }, svg);
      var lotus = new Sign(grp, p.x, p.y, 0.95, s[3]);
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
      if (i < 7 && !still) { // the pool above a part-closed sign
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
    // the stop's own sign, large, above its gate
    var big = gate.previousElementSibling, lotus = null;
    while (big && !big.classList.contains('mt-lotus')) big = big.previousElementSibling;
    if (big) {
      var svg = el('svg', { viewBox: '0 0 328 140' }, big), g = el('g', { class: 'mt-stop', style: '--hue:' + big.dataset.hue }, svg);
      lotus = new Sign(g, 164, 74, 4.2, big.dataset.sign);
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

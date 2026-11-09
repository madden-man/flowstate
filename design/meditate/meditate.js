// The audition for PLAN-MEDITATE.md. Two halves:
//   1. the four scapes (rain, ocean, forest, bowl) synthesised with Web Audio, no files; since S1 the app's own are
//      src/ui/parts/Sound.ts (scape), ported from these and kept the same graphs and levels;
//   2. the circle in each phone mock (steps 1 to 8 are the app's real markup since S1 and S2): a tap begins the sit and
//      the sound, a tap ends both. With a length chosen on the Minutes chips the page carries data-ending and the ink
//      line goes round on the sound's clock, as in ui/flow/Meditate.tsx; the bell closes it. A sit of a minute or more
//      comes back as the page after it; under a minute, or in Still, back to rest.
// Nothing here plays until the circle is tapped.
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var IN = 4, OUT = 6, BREATH = IN + OUT;   // the breath of rule 18: four seconds in, six out

  // ---------- noise, made once per context: six seconds, the tail folded into the head so the loop has no seam
  function noiseBuffer(a, kind) {
    a._noise = a._noise || {};
    if (a._noise[kind]) return a._noise[kind];
    var sr = a.sampleRate, n = sr * 6, fold = Math.floor(sr * 0.25), buf = a.createBuffer(2, n, sr);
    for (var ch = 0; ch < 2; ch++) {
      var g = new Float32Array(n + fold), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (var i = 0; i < n + fold; i++) {
        var w = Math.random() * 2 - 1;
        if (kind === 'white') g[i] = w;
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          g[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else { last = (last + 0.02 * w) / 1.02; g[i] = last * 3.5; }
      }
      var d = buf.getChannelData(ch);
      for (var j = 0; j < n; j++) { if (j < fold) { var x = j / fold; d[j] = g[j] * x + g[n + j] * (1 - x); } else d[j] = g[j]; }
    }
    return (a._noise[kind] = buf);
  }

  // ---------- one sit's worth of sound: every node hangs off `bus`, so ending is one fade and one disconnect
  function Sit(a, dest) {
    this.a = a; this.t0 = a.currentTime + 0.08; this.loops = []; this.sources = [];
    this.bus = a.createGain(); this.bus.gain.value = 0; this.bus.connect(dest);
  }
  Sit.prototype.noise = function (kind, to) {
    var s = this.a.createBufferSource(); s.buffer = noiseBuffer(this.a, kind); s.loop = true;
    s.connect(to); s.start(this.t0, Math.random() * 5); this.sources.push(s); return s;
  };
  Sit.prototype.filter = function (type, freq, q, to) {
    var f = this.a.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; f.connect(to); return f;
  };
  Sit.prototype.gain = function (v, to) { var g = this.a.createGain(); g.gain.value = v; g.connect(to); return g; };
  Sit.prototype.pan = function (v, to) {
    if (!this.a.createStereoPanner) return to;
    var p = this.a.createStereoPanner(); p.pan.value = v; p.connect(to); return p;
  };
  /** A slow sine that leans a gain up and down (a breeze, a shower thickening). */
  Sit.prototype.lean = function (param, hz, depth) {
    var o = this.a.createOscillator(), g = this.a.createGain(); o.frequency.value = hz; g.gain.value = depth;
    o.connect(g); g.connect(param); o.start(this.t0); this.sources.push(o);
  };
  /** Calls fn(time) for t0, t0 + period, ... kept a little ahead of the clock; offline it schedules the whole render. */
  Sit.prototype.every = function (period, fn) {
    var self = this, a = this.a, next = this.t0, offline = typeof a.startRendering === 'function';
    function fill(until) { while (next < until) { fn.call(self, next); next += period; } }
    if (offline) { fill(a.length / a.sampleRate); return; }
    var lead = Math.max(2, period * 0.25);
    fill(a.currentTime + lead);
    this.loops.push(setInterval(function () { fill(a.currentTime + lead); }, 400));
  };
  Sit.prototype.fadeIn = function (seconds, level) {
    var g = this.bus.gain; g.setValueAtTime(0, this.t0); g.linearRampToValueAtTime(level, this.t0 + seconds);
  };
  Sit.prototype.end = function (seconds) {
    var a = this.a, t = a.currentTime, g = this.bus.gain, self = this;
    this.loops.forEach(clearInterval); this.loops = [];
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(0, t, seconds / 4);
    setTimeout(function () {
      self.sources.forEach(function (s) { try { s.stop(); } catch (e) { /* already stopped */ } });
      try { self.bus.disconnect(); } catch (e) { /* gone */ }
    }, seconds * 1000 + 200);
  };

  /** One sounding note: a sine with a little second harmonic, a soft envelope, a glide if `to` differs. */
  function note(s, out, t, from, to, seconds, level) {
    var a = s.a, v = a.createGain(); v.connect(out);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(level, t + Math.min(0.03, seconds * 0.3));
    v.gain.setValueAtTime(level, t + seconds * 0.6); v.gain.linearRampToValueAtTime(0, t + seconds);
    [[1, 1], [2, 0.12]].forEach(function (h) {
      var o = a.createOscillator(), hv = a.createGain(); hv.gain.value = h[1]; o.type = 'sine';
      o.frequency.setValueAtTime(from * h[0], t); if (to !== from) o.frequency.exponentialRampToValueAtTime(to * h[0], t + seconds);
      o.connect(hv); hv.connect(v); o.start(t); o.stop(t + seconds + 0.02);
    });
  }
  /** A struck bowl: three partials, each a pair of sines a fraction of a hertz apart so it shimmers as it rings down. */
  function bowl(s, out, t, freq, level) {
    var a = s.a;
    [[1, 1, 20], [2.71, 0.4, 14], [4.95, 0.14, 8]].forEach(function (p) {
      var v = a.createGain(); v.connect(out);
      v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(level * p[1], t + 0.04);
      v.gain.exponentialRampToValueAtTime(level * p[1] * 0.02, t + p[2] - 0.5); v.gain.linearRampToValueAtTime(0, t + p[2]);
      [-0.35, 0.35].forEach(function (d) {
        var o = a.createOscillator(); o.type = 'sine'; o.frequency.value = freq * p[0] + d;
        o.connect(v); o.start(t); o.stop(t + p[2] + 0.1);
      });
    });
  }
  function curve(n, fn) { var c = new Float32Array(n); for (var i = 0; i < n; i++) c[i] = fn(i / (n - 1)); return c; }
  function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

  var SCAPES = {
    // Rain: a steady bed, the low body of it on a roof, the patter thickening and thinning, and single drops close by.
    rain: function (s) {
      var bed = s.gain(0.5, s.bus);
      s.noise('pink', s.filter('highpass', 500, 0, s.filter('lowpass', 7000, 0, bed)));
      s.noise('brown', s.filter('lowpass', 400, 0, s.gain(0.3, s.bus)));
      var patter = s.gain(0.11, s.bus);
      s.noise('white', s.filter('bandpass', 3200, 0.6, patter));
      s.lean(patter.gain, 0.07, 0.04); s.lean(bed.gain, 0.045, 0.1);
      var white = noiseBuffer(s.a, 'white');
      s.every(1, function (t) {
        for (var k = 0, n = 9 + Math.floor(Math.random() * 8); k < n; k++) {
          var at = t + Math.random(), len = rnd(0.012, 0.05), v = s.a.createGain(), src = s.a.createBufferSource();
          src.buffer = white;
          v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(rnd(0.05, 0.22), at + 0.002);
          v.gain.exponentialRampToValueAtTime(0.0003, at + len);
          var f = s.filter('bandpass', rnd(1400, 6000), 2.5, v); v.connect(s.pan(rnd(-0.9, 0.9), s.bus));
          src.connect(f); src.start(at, Math.random() * 5, len + 0.02);
        }
      });
      s.fadeIn(IN, 0.85);
    },
    // Ocean: one wave a breath. It gathers for four seconds, breaks, and draws back down the sand for six,
    // on the same clock as the circle. Under it the sea far out, which never stops.
    ocean: function (s) {
      s.noise('brown', s.filter('lowpass', 140, 0, s.gain(0.5, s.bus)));
      var surfGain = s.gain(0.14, s.bus), surfTone = s.filter('lowpass', 260, 0, surfGain);
      s.noise('brown', surfTone);
      var foamGain = s.gain(0.01, s.bus);
      s.noise('pink', s.filter('highpass', 2200, 0, foamGain));
      var N = 256, peak = IN / BREATH;
      s.every(BREATH, function (t) {
        var size = rnd(0.8, 1.1);
        surfGain.gain.setValueCurveAtTime(curve(N, function (x) {
          return x < peak ? 0.14 + 0.86 * size * Math.pow(x / peak, 2.2) : 0.14 + 0.86 * size * Math.pow(1 - (x - peak) / (1 - peak), 1.8);
        }), t, BREATH - 0.02);
        surfTone.frequency.setValueCurveAtTime(curve(N, function (x) {
          return x < peak ? 260 + 1700 * size * Math.pow(x / peak, 2) : 260 + 1700 * size * Math.pow(1 - (x - peak) / (1 - peak), 1.4);
        }), t, BREATH - 0.02);
        foamGain.gain.setValueCurveAtTime(curve(N, function (x) {
          var from = peak - 0.08; if (x < from) return 0.01;
          var y = (x - from) / (1 - from); return 0.01 + 0.3 * size * Math.min(1, y * 7) * Math.pow(1 - y, 2.4);
        }), t, BREATH - 0.02);
      });
      s.fadeIn(IN, 0.7);
    },
    // Forest: moving air, leaves, and a few birds a long way off in a little room of trees. The calls are plain
    // tones (a two-note whistle, a warble, a trill, a dove), each from its own place, never on a beat.
    forest: function (s) {
      var air = s.gain(0.5, s.bus);
      s.noise('pink', s.filter('bandpass', 600, 0.4, air)); s.lean(air.gain, 0.05, 0.2);
      var leaves = s.gain(0.06, s.bus);
      s.noise('white', s.filter('highpass', 4200, 0, leaves)); s.lean(leaves.gain, 0.08, 0.03);
      // the trees: a short burst of fading noise used as a room
      var a = s.a, len = Math.floor(a.sampleRate * 1.8), ir = a.createBuffer(2, len, a.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      var room = a.createConvolver(); room.buffer = ir; room.connect(s.gain(1.1, s.bus));
      function place() { var far = Math.random(), p = s.pan(rnd(-0.8, 0.8), s.gain(2.2, s.bus)); var g = a.createGain(); g.gain.value = 1 - far * 0.65; g.connect(p); g.connect(room); return g; }
      var CALLS = [
        function (t, to) { note(s, to, t, 3900, 3900, 0.38, 0.05); note(s, to, t + 0.5, 3300, 3300, 0.44, 0.05); return 1; },
        function (t, to) { for (var k = 0, n = 5 + Math.floor(Math.random() * 4), at = t; k < n; k++) { var f = rnd(2600, 4400), l = rnd(0.07, 0.12); note(s, to, at, f, f * rnd(0.86, 1.16), l, 0.04); at += l + rnd(0.02, 0.07); } return 1.2; },
        function (t, to) { var f = rnd(4200, 5200); for (var k = 0, n = 10 + Math.floor(Math.random() * 7); k < n; k++) note(s, to, t + k * 0.055, k % 2 ? f * 1.12 : f, k % 2 ? f * 1.12 : f, 0.04, 0.028); return 1; },
        function (t, to) { note(s, to, t, 440, 560, 0.3, 0.07); [0.5, 1.0, 1.5].forEach(function (d) { note(s, to, t + d, 480, 465, 0.32, 0.06); }); return 2.2; },
        function (t, to) { note(s, to, t, 6400, 5700, 0.07, 0.022); return 0.3; }
      ];
      var busyUntil = 0;
      s.every(1, function (t) {
        if (t < busyUntil || Math.random() > 0.42) return;
        var k = Math.random(), call = CALLS[k < 0.3 ? 0 : k < 0.6 ? 1 : k < 0.75 ? 2 : k < 0.87 ? 3 : 4];
        var at = t + Math.random(); busyUntil = at + call(at, place()) + rnd(0.3, 2.5);
      });
      s.fadeIn(IN, 0.9);
    },
    // Bowl: one bowl struck as an in-breath begins, every other breath, and a second a fifth above it between them.
    bowl: function (s) {
      s.every(BREATH * 2, function (t) {
        bowl(s, s.bus, t + 0.05, 196, 0.15);
        bowl(s, s.bus, t + BREATH + 0.05, 293.66, 0.09);
      });
      s.fadeIn(0.3, 0.9);
    }
  };

  /** Start a scape on a context; returns the sit (t0 is the clock the circle breathes on). */
  function begin(a, name, dest) { var s = new Sit(a, dest || a.destination); if (SCAPES[name]) SCAPES[name](s); return s; }
  /** The closing bell: the unlock bell's shape, lower and longer (parts/Sound's sitEnd: 528 Hz over four seconds). */
  function closingBell(a, dest) {
    var t = a.currentTime + 0.02, out = a.createGain(); out.connect(dest || a.destination);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.16, t + 0.012); out.gain.exponentialRampToValueAtTime(0.0008, t + 4);
    [[528, 1], [528 * 2.76, 0.18]].forEach(function (p) { var o = a.createOscillator(), v = a.createGain(); v.gain.value = p[1]; o.frequency.value = p[0]; o.connect(v); v.connect(out); o.start(t); o.stop(t + 4.1); });
  }
  window.Meditate = { begin: begin, closingBell: closingBell, scapes: Object.keys(SCAPES) };

  // ---------- the mocks: a tap on the circle begins, a tap ends; the circle breathes on the sound's own clock
  var ac = null, live = null;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ctx() {
    if (!AC) return null;
    if (!ac) { try { ac = new AC(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function ease(x) { return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x))); }
  function set(page, state) {
    page.dataset.state = state;
    var app = page.closest('.fs-app'); if (app) { if (state === 'sitting') app.dataset.sitting = 'true'; else delete app.dataset.sitting; }
    var c = page.querySelector('.md-circle'); if (c) c.setAttribute('aria-label', state === 'sitting' ? 'End the sit' : 'Begin');
  }
  /** The chosen length in seconds: the pressed Minutes chip, open in Still (a sit begun there is always open). */
  function lengthOf(page) {
    var screen = page.closest('[data-light]');
    if (screen && screen.dataset.light === 'still') return 0;
    var chip = page.querySelector('.md-lengths [aria-pressed="true"]');
    return (chip ? +chip.dataset.minutes || 0 : 0) * 60;
  }
  function stop() {
    if (!live) return;
    var l = live; live = null; cancelAnimationFrame(l.raf);
    if (l.sit) l.sit.end(OUT);
    var page = l.page, fixed = !!page.dataset.fixed;
    l.breath.style.transform = '';
    // a fixed mock (step 6) goes back to how it is drawn; a live one lifts the line from where it got to (rule 27)
    if (fixed) { if (l.sat && page.dataset.from) l.sat.style.strokeDashoffset = String(1 - l.from); }
    else delete page.dataset.ending;
    var sat = (l.clock() - l.t0) / 60, after = page.querySelector('.md-after');
    var still = (page.closest('[data-light]') || {}).dataset;
    var back = fixed ? 'sitting' : sat >= 1 && after && !(still && still.light === 'still') ? 'after' : 'rest';
    if (back === 'after') {
      var n = Math.max(1, Math.round(sat));
      after.innerHTML = '<p class="fl-last fs-notstill">Sat · ' + n + (n === 1 ? ' minute · ' : ' minutes · ') + (page.dataset.sound || 'rain') +
        '</p><a class="fs-row fs-list-row"><span class="fs-list-line">Write it down</span><small class="fs-list-meta">Today\'s page</small></a>';
    }
    set(page, back); page.removeAttribute('data-playing');
  }
  function start(page) {
    stop();
    var name = page.dataset.sound || 'rain', a = name === 'quiet' ? null : ctx();
    // a sit is media, like the music: where the phone lets a page say so, the ringer switch does not silence it
    try { if (a && navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not on this phone */ }
    var sit = a ? begin(a, name) : null, t0 = sit ? sit.t0 : performance.now() / 1000;
    var seconds = lengthOf(page), from = +page.dataset.from || 0;
    var clock = function () { return sit ? a.currentTime : performance.now() / 1000; };
    var l = live = { page: page, sit: sit, breath: page.querySelector('.md-breath'), sat: page.querySelector('.sat'), from: from, clock: clock, t0: t0 };
    if (seconds) { page.dataset.ending = 'true'; if (l.sat) l.sat.style.strokeDashoffset = String(1 - from); }
    set(page, 'sitting'); page.dataset.playing = 'true';
    (function frame() {
      if (live !== l) return;
      if (!page.closest('.step').classList.contains('on')) { stop(); return; }   // turned to another step: the sound goes with it
      var t = clock() - t0, p = ((t % BREATH) + BREATH) % BREATH;
      var open = p < IN ? ease(p / IN) : 1 - ease((p - IN) / OUT);
      if (!still) l.breath.style.transform = 'scale(' + (0.86 + 0.14 * open).toFixed(4) + ')';
      if (seconds && l.sat) {
        var done = Math.max(0, Math.min(1, from + t / seconds)); l.sat.style.strokeDashoffset = String(1 - done);
        if (done >= 1) { if (a || ctx()) closingBell(a || ctx()); stop(); return; }
      }
      l.raf = requestAnimationFrame(frame);
    })();
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest('.md-circle');
    if (c) { var page = c.closest('.md-page'); if (live && live.page === page) stop(); else start(page); return; }
    var chip = e.target.closest('.md-sounds .fs-chip, .md-lengths .fs-chip');
    if (chip) {
      var group = chip.parentNode, pg = chip.closest('.md-page');
      [].forEach.call(group.querySelectorAll('.fs-chip'), function (x) { x.setAttribute('aria-pressed', String(x === chip)); });
      if (group.classList.contains('md-sounds')) pg.dataset.sound = chip.dataset.sound;
    }
  });
})();

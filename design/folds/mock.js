// The proposal mock for PLAN-FOLDS.md: Be's list drawn by hand in the real app's markup, on the real app's stylesheet
// (app.css, built from src) with the proposed folds.css over it. It is a drawing to decide from, not the app: the
// page chrome is the app's own markup copied as it renders, the list is drawn here, and the drag is the app's geometry
// (src/ui/be/drag.ts: collapse and target) with the one change the plan makes, a folded heading being its place's foot.
// Example data, as design/tiers/src/seed.ts. Package G3 replaces this with the real app, as design/tiers/ is.
(function () {
  var q = new URLSearchParams(location.search);
  var step = q.get('step') || 'places', n = q.get('n') || '0';
  var DESIGNED = { still: 'still', shelves: 'night' };
  var HOLD_MS = 500, SLOP = 8;

  var V = {
    honesty: { shadow: 'discretion', looks: 'Saying the true thing while it can still help.', since: '11 / 12 / 26',
      val: [['Warrior', 'red', 'I say it to their face, and I stay in the room after.'], ['Skeptic', 'black', 'I check it is true before I call it honest.']],
      sha: [['Mystic', 'blue', 'Not every true thing is mine to say tonight.']] },
    courage: { shadow: 'safety', since: '11 / 12 / 26', val: [['Warrior', 'red'], ['Explorer', 'orange']], sha: [['Architect', 'green']] },
    presence: { shadow: 'planning', since: '11 / 6 / 26', val: [['Mystic', 'blue'], ['Sensualist', 'pink']], sha: [] },
    patience: { shadow: 'urgency', since: '11 / 6 / 26', val: [['Architect', 'green'], ['Meaning Maker', 'purple']], sha: [['Warrior', 'red']] },
    craft: { shadow: 'enough', since: '11 / 12 / 26', val: [['Engineer', 'brown'], ['Architect', 'green']], sha: [] },
    play: { shadow: 'caution', val: [['Joker', 'yellow'], ['Explorer', 'orange']], sha: [] },
    perfection: { shadow: 'good enough', dates: '8 / 3 / 26 to 11 / 12 / 26', val: [['Architect', 'green'], ['Skeptic', 'black']], sha: [] }
  };
  var PLACES = ['1', '2', '3', 'resting', 'legacy'];
  var WORD = { '1': 'First', '2': 'Second', '3': 'Third', resting: 'Resting', legacy: 'Legacy' };
  var base = function () { return { '1': ['honesty', 'courage'], '2': ['presence', 'patience'], '3': ['craft'], resting: ['play'], legacy: ['perfection'] }; };
  var fold = function (list) { var f = {}; PLACES.forEach(function (p) { f[p] = list.indexOf(p) >= 0; }); return f; };

  // each step's state: where the values are, which places are folded, what is open, what is lifted and where it rides
  var STEPS = {
    places: { folded: fold(['resting', 'legacy']) },
    fold: { folded: fold(['2', 'resting', 'legacy']) },
    glance: { folded: fold(PLACES) },
    lift: { folded: fold(['2', 'resting', 'legacy']), lifted: 'craft', live: { to: '3', index: 0 } },
    cross: { folded: fold(['2', 'resting', 'legacy']), lifted: 'craft', live: { to: '1', index: 1 } },
    into: { folded: fold(['2', 'resting', 'legacy']), lifted: 'craft', live: { to: '2', index: 2 } },
    landed: { folded: fold(['2', 'resting', 'legacy']), places: { '1': ['honesty', 'courage'], '2': ['presence', 'patience', 'craft'], '3': [], resting: ['play'], legacy: ['perfection'] } },
    open: { folded: fold(['2', '3', 'resting', 'legacy']), open: ['honesty'] },
    shelves: { folded: fold(['1', '2', '3']) },
    still: { folded: fold(['resting', 'legacy']), still: true }
  };
  var preset = STEPS[step] || STEPS.places;
  var S = {
    places: preset.places || base(), folded: preset.folded, open: {}, lifted: preset.lifted || null, live: preset.live || null,
    still: !!preset.still
  };
  (preset.open || []).forEach(function (id) { S.open[id] = true; });

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var vc = function (hue) { return 'style="--vc: var(--v-' + hue + ');"'; };

  // ---- the app's own page chrome, as it renders (design/tiers/dist, step "sorted") ----
  function chrome(still) {
    var moon = still
      ? '<button type="button" aria-label="Leave Still" aria-pressed="true" class="fs-moon fs-ring"><span aria-hidden="true" class="fs-ring-mark"></span></button>'
      : '<button type="button" aria-label="Still" aria-pressed="false" class="fs-moon"><i></i></button>';
    return '<div class="fs-app"><main class="fs-main"><section class="fs-page">' +
      '<header class="fs-hdr"><div class="fs-hdr-l">' + moon + '<button type="button" class="fs-word">Settings</button><button type="button" aria-label="Music" class="fs-word fs-musicword">♪</button></div>' +
      '<div class="fs-hdr-r"><span class="fs-hdr-top"><span class="fs-hdr-label">Be</span></span><span>Date: <b>11 / 12 / 26</b></span></div></header>' +
      '<div class="fs-be-top fs-notstill"><nav aria-label="Be" class="fs-seg"><a aria-current="page">Values</a><a>Champions</a></nav><button type="button" class="fs-word">New value</button></div>' +
      '<div class="fs-sheetof fs-rules fs-be fs-values" id="list"></div></section></main>' +
      '<nav aria-label="Sections" class="fs-tabs"><a class="fs-tab">Journal</a><a class="fs-tab">Council</a><a aria-label="Questions" class="fs-tab fs-tab-q">?</a><a aria-current="page" class="fs-tab">Be</a><a class="fs-tab">Flow</a>' +
      '<span aria-hidden="true" class="fs-tab-mark" data-placing style="--mark-x: 325.6875px; --mark-y: 39.5px; --mark-w: 16.96875;"></span></nav></div>';
  }

  // ---- the list ----
  /** The places as drawn: the lifted value taken from wherever it is and put where it rides (drag.ts carry). */
  function shown() {
    if (!S.lifted || !S.live) return S.places;
    var out = {};
    PLACES.forEach(function (p) { out[p] = S.places[p].filter(function (id) { return id !== S.lifted; }); });
    var rows = out[S.live.to];
    rows.splice(Math.max(0, Math.min(rows.length, S.live.index)), 0, S.lifted);
    return out;
  }
  function spoke(id) {
    var v = V[id], all = v.val.concat(v.sha);
    if (!all.length) return '<span class="fs-spoke-none" aria-label="Nobody yet"></span>';
    return '<span class="fs-spoke" aria-label="' + esc(all.map(function (c) { return c[0]; }).join(', ')) + '">' +
      all.map(function (c) { return '<i ' + vc(c[1]) + '></i>'; }).join('') + '</span>';
  }
  function champs(id, side, label) {
    var list = V[id][side];
    return '<div role="group" class="fs-champside"><p class="fs-print">' + label + '</p>' +
      list.map(function (c) {
        return '<div data-voice="' + esc(c[0]) + '" class="fs-msg fs-v fs-champ" ' + vc(c[1]) + '><span class="fs-sp">' + esc(c[0]) + '</span>' +
          '<textarea rows="1" placeholder="Why, in a sentence" class="fs-champ-why" style="height: 28px;">' + esc(c[2] || '') + '</textarea></div>';
      }).join('') + '<p class="fs-champ-add"><button type="button" class="fs-chip add">+ champion</button></p></div>';
  }
  function body(id, p) {
    var v = V[id], held = /^\d$/.test(p);
    return '<div class="fs-be-fold"><div class="fs-value-body">' +
      (v.looks ? '<p class="fs-value-looks">' + esc(v.looks) + '</p>' : '') +
      '<div class="fs-be-places"><div role="group" aria-label="Place" class="fs-opts">' +
      PLACES.map(function (o) { return '<button type="button" class="fs-opt" data-to="' + o + '" aria-pressed="' + (o === p) + '">' + WORD[o] + '</button>'; }).join('') + '</div></div>' +
      (held ? '<p class="fs-print fs-be-since">' + WORD[p] + ' since ' + (v.since || '11 / 12 / 26') + '</p>' : '') +
      (p !== 'legacy' ? '<div class="fs-champs">' + champs(id, 'val', 'Fighting for it') + champs(id, 'sha', 'Fighting for <i>' + esc(v.shadow) + '</i>') + '</div>' : '') +
      '<div class="fs-value-acts">' + (p !== 'legacy' ? '<button type="button" class="fs-word">Call a council</button>' : '') + '<button type="button" class="fs-word">Edit</button></div>' +
      '</div></div>';
  }
  function row(id, p, infold) {
    var v = V[id], open = !!S.open[id] && !S.lifted, lifted = S.lifted === id;
    var size = /^\d$/.test(p) ? ' fs-value-t' + p : ' fs-value-shelf';
    var shelf = p === 'resting' || p === 'legacy';
    var head = open
      ? '<button type="button" class="fs-dichotomy fs-value-open" aria-expanded="true"><span class="a">' + esc(id) + '</span><i aria-hidden="true"></i><span class="b">' + esc(v.shadow) + '</span></button>'
      : '<button type="button" class="fs-dichotomy fs-value' + size + (shelf ? ' resting' : '') + '" aria-expanded="false"><span class="a">' + esc(id) + '</span>' +
        (p === 'legacy' ? '<span class="fs-value-dates">' + (v.dates || '11 / 6 / 26 to 11 / 12 / 26') + '</span>' : spoke(id)) + '</button>';
    return '<section class="fs-be-row' + (open ? ' open' : '') + (lifted ? ' lift' : '') + (infold ? ' infold' : '') + '" data-row="' + id + '" data-place="' + p + '">' +
      head + (open ? body(id, p) : '') + '</section>';
  }
  function heading(p, rows, lifting) {
    var folded = S.folded[p];
    var run = rows.map(function (id) { return '<span' + (id === S.lifted ? ' class="riding"' : '') + '>' + esc(id) + '</span>'; }).join('<span class="dot" aria-hidden="true">·</span>');
    return '<p class="fs-be-tier fs-be-head' + (folded ? ' folded' : '') + (S.drawn === p ? ' drawn' : '') + (folded && lifting ? ' land' : '') + '" data-heading="' + p + '" data-place="' + p + '"' + (folded ? ' data-folded' : '') + '>' +
      '<button type="button" aria-expanded="' + !folded + '"><span class="w">' + WORD[p] + '</span>' +
      (folded ? '<span class="run">' + run + '</span>' : '<i class="stroke" aria-hidden="true"></i>') + '</button></p>';
  }
  function render() {
    var list = document.getElementById('list');
    var html = '<p class="fs-be-core">I determine my core.</p>';
    if (S.still) {
      html += S.places['1'].map(function (id) { return '<section class="fs-be-row"><p class="fs-value">' + esc(id) + '</p></section>'; }).join('');
      list.innerHTML = html;
      return;
    }
    var t = shown(), lifting = !!S.lifted;
    PLACES.forEach(function (p) {
      var rows = t[p], shelf = p === 'resting' || p === 'legacy';
      if (shelf && !rows.length && !lifting) return;
      html += heading(p, rows, lifting);
      if (S.folded[p]) {
        // only the value under the finger is drawn; the rest are the run
        if (lifting && rows.indexOf(S.lifted) >= 0) html += row(S.lifted, p, true);
        return;
      }
      html += rows.map(function (id) { return row(id, p, false); }).join('');
      if (!rows.length || lifting) html += '<p class="fs-be-land" data-land="' + p + '" aria-hidden="true"></p>';
    });
    list.innerHTML = html;
    S.drawn = null;
    if (drag) ride();
  }

  // ---- the drag (src/ui/be/drag.ts, with a folded heading as its place's foot) ----
  var hold = null, drag = null, swallow = false;
  var rowEl = function (id) { return document.querySelector('#list > [data-row="' + id + '"]'); };
  function whereIs(id) {
    for (var k = 0; k < PLACES.length; k++) { var i = S.places[PLACES[k]].indexOf(id); if (i >= 0) return { to: PLACES[k], index: i }; }
    return null;
  }
  function ride() {
    var el = drag && rowEl(drag.id);
    if (!el) return;
    el.style.transform = 'none';
    var natural = el.getBoundingClientRect().top;
    el.style.transform = 'translateY(' + (drag.y - drag.grab - natural - 2) + 'px)';
  }
  function target(boxes, top) {
    var k = 0;
    while (k < boxes.length && (boxes[k].top + boxes[k].bottom) / 2 < top) k++;
    var count = function (p, before) { return boxes.slice(0, before).filter(function (b) { return b.kind === 'row' && b.place === p; }).length; };
    var foot = function (p) { return S.places[p].filter(function (id) { return id !== drag.id; }).length; };
    if (k === 0) return { to: '1', index: S.folded['1'] ? foot('1') : 0 };
    var above = boxes[k - 1];
    if (above.kind === 'heading') return { to: above.place, index: above.folded ? foot(above.place) : 0 };
    if (above.kind === 'row') return { to: above.place, index: count(above.place, k) };
    return { to: above.place, index: foot(above.place) };
  }
  function follow() {
    var list = document.getElementById('list'), el = rowEl(drag.id);
    if (!el) return;
    el.style.transform = 'none';
    var lt = el.getBoundingClientRect().top, lb = lt + el.offsetHeight, h = lb - lt, boxes = [], under = null;
    [].forEach.call(list.children, function (c) {
      if (c === el) return;
      var d = c.dataset, kind = d.heading ? 'heading' : d.land ? 'land' : d.row ? 'row' : null;
      if (!kind) return;
      var r = c.getBoundingClientRect();
      // the plan's one new rule: a finger on a folded place's line is in that place, wherever the row's top edge is
      if (kind === 'heading' && 'folded' in d && drag.y >= r.top && drag.y <= r.bottom) under = d.heading;
      var shift = r.top >= lb - 0.5 ? h : 0;
      boxes.push({ kind: kind, place: d.heading || d.land || d.place, folded: 'folded' in d, top: r.top - shift, bottom: r.bottom - shift });
    });
    var t = under ? { to: under, index: S.places[under].filter(function (id) { return id !== drag.id; }).length } : target(boxes, drag.y - drag.grab);
    if (t.to !== S.live.to || t.index !== S.live.index) { S.live = t; render(); } else ride();
  }
  function lift(id, y) {
    var el = rowEl(id);
    if (!el) return;
    var top = el.getBoundingClientRect().top;
    drag = { id: id, y: y, grab: y - top };
    S.open = {};
    S.lifted = id;
    S.live = whereIs(id);
    render();
    // as the app does: the list is put back under the row once the landing rules have grown above it, so nothing
    // changes place under a still finger (here by room at the foot to scroll into; the app's list already scrolls)
    var list = document.getElementById('list');
    el = rowEl(id);
    el.style.transform = 'none';
    list.style.paddingBottom = '100vh';
    list.scrollTop += el.getBoundingClientRect().top - top;
    drag.grab = y - el.getBoundingClientRect().top;
    ride();
  }
  function drop() {
    if (S.lifted && S.live) S.places = shown();
    S.lifted = null; S.live = null; drag = null;
    document.getElementById('list').style.paddingBottom = '';
    render();
  }

  function wire() {
    var list = document.getElementById('list');
    list.addEventListener('pointerdown', function (e) {
      if (S.still || e.button > 0) return;
      swallow = false;
      // a step that opens on a held value: the next touch lets it go where it rides
      if (S.lifted && !drag) { drop(); swallow = true; return; }
      var d = e.target.closest('.fs-dichotomy'), r = d && d.closest('.fs-be-row');
      if (!r) return;
      d.classList.add('holding');
      hold = { x: e.clientX, y: e.clientY, el: d, t: setTimeout(function () { var y = hold.y; hold.el.classList.remove('holding'); hold = null; swallow = true; lift(r.dataset.row, y); }, HOLD_MS) };
    });
    var cancel = function () { if (hold) { clearTimeout(hold.t); hold.el.classList.remove('holding'); hold = null; } };
    addEventListener('pointermove', function (e) {
      if (hold && (Math.abs(e.clientX - hold.x) > SLOP || Math.abs(e.clientY - hold.y) > SLOP)) cancel();
      if (drag) { drag.y = e.clientY; follow(); }
    });
    var up = function () { cancel(); if (drag) drop(); };
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    document.addEventListener('touchmove', function (e) { if (drag) e.preventDefault(); }, { passive: false });
    list.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) {
      if (swallow) { swallow = false; e.preventDefault(); return; }
      if (S.still) return;
      var h = e.target.closest('.fs-be-head');
      if (h) { var p = h.dataset.place; S.folded[p] = !S.folded[p]; S.drawn = p; render(); return; }
      var o = e.target.closest('.fs-opt');
      if (o) {
        var r = o.closest('.fs-be-row'), id = r.dataset.row, to = o.dataset.to;
        if (to === r.dataset.place) return;
        PLACES.forEach(function (p) { S.places[p] = S.places[p].filter(function (x) { return x !== id; }); });
        S.places[to].push(id);
        S.folded[to] = false;
        render();
        return;
      }
      var d = e.target.closest('.fs-dichotomy'), row = d && d.closest('.fs-be-row');
      if (row) { var vid = row.dataset.row; if (S.open[vid]) delete S.open[vid]; else S.open[vid] = true; render(); }
    });
  }

  // ---- the walkthrough's frame protocol (design/tiers/walk.js) ----
  function relight(l) { document.documentElement.dataset.light = l === 'design' ? (DESIGNED[step] || 'day') : l; }
  relight(q.get('light') || 'design');
  document.getElementById('app').innerHTML = chrome(S.still);
  render();
  wire();
  // the mark under the tab, put under Be at this width (the app measures it the same way)
  (function () {
    var nav = document.querySelector('.fs-tabs'), tab = nav.querySelector('[aria-current]'), mark = nav.querySelector('.fs-tab-mark');
    var a = nav.getBoundingClientRect(), b = tab.getBoundingClientRect(), w = parseFloat(mark.style.getPropertyValue('--mark-w'));
    mark.style.setProperty('--mark-x', (b.left - a.left + (b.width - w) / 2) + 'px');
  })();
  addEventListener('message', function (e) {
    var d = e.data;
    if (e.source !== parent || !d || !d.fs) return;
    if (d.light) relight(d.light);
  });
  requestAnimationFrame(function () { try { parent.postMessage({ fs: true, ready: true, n: n }, '*'); } catch (err) { /* no parent */ } });
})();

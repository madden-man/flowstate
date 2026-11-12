// The Research walkthrough's phone (PLAN-RESEARCH.md): a hand mock of the page on the app's own parts.css, alive enough
// to use. Ask runs the looking, a title opens its abstract, + and − quiet the other side, the words at the foot go where
// they say. Nothing here calls a model or an index: the papers are data.js, and the sides were sorted by hand.
(function () {
  var P = window.RS_PAPERS;
  var PLUS = 'var(--v-blue)', MINUS = 'var(--d-blue)';
  var SETS = {
    main: { q: 'Does writing about hard feelings help?', lines: [['33634766', '+'], ['19742069', '-'], ['37345260', '+'], ['40968670', '-'], ['39651593', '+']] },
    empty: { q: 'Does one session of writing before a test lower test anxiety?', lines: [['40968670', '-']], none: '+' },
    lower: { q: 'Does writing lower anxiety in a first pregnancy?', lines: [['42432549', '-'], ['PPR444484', '+']] }
  };
  var ASKED = [['11 / 13 / 26', SETS.main.q, 'main'], ['11 / 12 / 26', SETS.empty.q, 'empty'], ['11 / 10 / 26', SETS.lower.q, 'lower']];
  // what each step opens on
  var STEPS = {
    sea: { view: 'sea' }, ask: { view: 'ask' }, look: { view: 'run' }, sides: { view: 'sides' }, one: { view: 'sides', filter: '+' },
    paper: { view: 'paper', paper: '37345260' }, carry: { view: 'journal', paper: '37345260' }, empty: { view: 'sides', set: 'empty' },
    lower: { view: 'sides', set: 'lower' }, asked: { view: 'asked' }, still: { view: 'sides' }, key: { view: 'key' }
  };
  var host, st = {}, timers = [], go = function () {};
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var sign = function (s) { return s === '+' ? '+' : '−'; };

  function header(left, label) {
    return '<header class="fs-hdr"><div class="fs-hdr-l"><button type="button" class="fs-moon" aria-label="Still"><i></i><b></b></button>' + left +
      '</div><div class="fs-hdr-r"><span class="fs-hdr-top"><span class="fs-hdr-label">' + label + '</span></span><span>Date: <b>11 / 13 / 26</b></span></div></header>';
  }
  function tabs(here) {
    return '<nav class="fs-tabs" aria-label="Sections">' + [['Journal'], ['Council'], ['?', 1], ['Be'], ['Flow']].map(function (t) {
      return '<a class="fs-tab' + (t[1] ? ' fs-tab-q' : '') + '"' + (t[0] === here ? ' aria-current="page"' : '') + '>' + t[0] + '</a>';
    }).join('') + '</nav>';
  }
  var word = function (act, text) { return '<a class="fs-word" data-act="' + act + '">' + text + '</a>'; };
  function line(id, side, fresh) {
    var p = P[id], meta = [p.journal, p.year, p.kind].filter(Boolean).join(' · ');
    var hush = st.filter && st.filter !== side ? ' rs-hush' : '';
    return '<div class="fs-msg fs-v' + (side === '-' ? ' deep' : '') + hush + (fresh ? ' rs-in' : '') + '" style="--vc:' + (side === '+' ? PLUS : MINUS) + '" data-paper="' + id + '">' +
      '<span class="fs-sp">' + sign(side) + ' · ' + esc(meta) + '</span><p>' + esc(p.title) + '</p></div>';
  }
  function chips(looking) {
    return '<div class="fs-chips">' + ['+', '-'].map(function (s) {
      return '<button type="button" class="fs-chip" data-side="' + s + '" style="--vc:' + (s === '+' ? PLUS : MINUS) + '" aria-pressed="' + (st.filter === s) + '"' +
        (looking ? ' data-looking' : '') + ' aria-label="' + (s === '+' ? 'For' : 'Against') + '"><i></i>' + sign(s) + '</button>';
    }).join('') + '</div>';
  }
  function page(inner) { return '<div class="fs-app rs-app"><div class="fs-main"><div class="fs-page fs-council">' + inner + '</div></div>' + tabs('Flow') + '</div>'; }

  var VIEWS = {
    sea: function () {
      var ring = function (x, name, extra, act) {
        return '<g' + (act ? ' class="rs-go" data-act="ask" role="link" tabindex="0"' : '') + '><circle class="rs-ring" cx="' + x + '" cy="424" r="15"/>' + extra +
          '<text class="rs-name" x="' + x + '" y="456" text-anchor="middle">' + name + '</text></g>';
      };
      var stops = [84, 128, 172, 216, 260, 304, 348].map(function (y, i) { return '<circle class="rs-ring" cx="' + (164 + (i % 2 ? 9 : -9)) + '" cy="' + y + '" r="5"/>'; }).join('');
      return '<div class="fs-app rs-app"><div class="fs-main"><div class="fs-page">' + header('<button type="button" class="fs-word">Settings</button>', 'Flow') +
        '<div class="rs-plate"><svg viewBox="0 0 328 476" preserveAspectRatio="xMidYMid meet" aria-label="The mountain, and the sea under it">' +
        '<path class="rs-face" d="M164 44 L272 392 L196 392 Z"/><path class="rs-rock" d="M164 44 L56 392 L272 392 Z M130 152 H198 M108 224 H220 M86 296 H242"/>' +
        '<path class="rs-water" d="M164 58 C150 100 178 110 173 128 S150 160 155 172 S178 204 173 216 S150 248 155 260 S178 292 173 304 S150 336 155 348 S164 380 164 400"/>' + stops +
        '<path class="rs-rock" d="M20 400 H308"/>' +
        ring(68, 'Meditate', '') + ring(164, 'Energize', '<path class="rs-ring" d="M154 430 Q164 408 174 430"/>') + ring(260, 'Research', '<path class="rs-ring" d="M260 409 V439"/>', true) +
        '</svg></div></div></div>' + tabs('Flow') + '</div>';
    },
    ask: function () {
      return page(header(word('sea', 'Flow') + word('asked', 'Asked'), 'Research') +
        '<div class="fs-chat fs-rules"><p class="rs-q rs-caret">' + esc(SETS.main.q) + '</p><span class="rs-print">This question leaves the phone.</span></div>' +
        '<div class="fs-composer-wrap"><button type="button" class="fs-new" data-act="run">Ask</button></div>');
    },
    run: function () {
      var set = SETS.main;
      timers.push(setTimeout(function step() {
        var chat = host.querySelector('.fs-chat'), k = chat.querySelectorAll('.fs-msg').length, wait = chat.querySelector('.fs-quiet');
        if (k >= set.lines.length) { go('sides'); return; }
        wait.insertAdjacentHTML('beforebegin', line(set.lines[k][0], set.lines[k][1], true));
        chat.scrollTop = chat.scrollHeight;
        timers.push(setTimeout(step, 1500));
      }, 900));
      return page(header(word('sea', 'Flow') + word('asked', 'Asked'), 'Research') +
        '<div class="fs-chat fs-rules"><p class="rs-q">' + esc(set.q) + '</p><p class="fs-quiet">Looking</p></div>' +
        '<div class="fs-composer-wrap">' + chips(true) + '</div>');
    },
    sides: function () {
      var set = SETS[st.set || 'main'];
      var none = set.none ? '<p class="fs-quiet' + (st.filter && st.filter !== set.none ? ' rs-hush' : '') + '">Nothing found for ' + sign(set.none) + '.</p>' : '';
      return page(header(word('sea', 'Flow') + word('asked', 'Asked'), 'Research') +
        '<div class="fs-chat fs-rules"><p class="rs-q">' + esc(set.q) + '</p>' + set.lines.map(function (l) { return line(l[0], l[1]); }).join('') + none + '</div>' +
        '<div class="fs-composer-wrap">' + chips(false) + '</div>');
    },
    paper: function () {
      var p = P[st.paper], meta = [p.journal, p.year, p.kind].filter(Boolean).join(' · ');
      return page(header(word('back', 'Research'), 'Paper') +
        '<div class="fs-sheetof fs-rules rs-paper"><p class="rs-q">' + esc(p.title) + '</p><span class="rs-print">' + esc(meta) + '</span><p class="fs-line"></p>' +
        p.abstract.map(function (s) { return (s[0] ? '<span class="rs-print">' + esc(s[0]) + '</span>' : '') + '<p>' + esc(s[1]) + '</p>'; }).join('') + '</div>' +
        '<div class="fs-composer-wrap rs-words">' + word('open', 'Open the paper') + word('journal', 'Write about it') + word('council', 'To Council') + '</div>');
    },
    journal: function () {
      var p = P[st.paper];
      return '<div class="fs-app rs-app"><div class="fs-main"><div class="fs-page">' +
        header('<a class="fs-word">Pages</a><button type="button" class="fs-word">Settings</button>', 'No. <b>14</b>') +
        '<div class="fs-sheetof fs-rules"><div class="fs-from"><small>From</small><a data-act="back-sides">' + esc(SETS.main.q) + '</a></div>' +
        '<div class="fs-msg fs-v" style="--vc:' + PLUS + '"><span class="fs-sp">+ · ' + esc(p.journal) + ' · ' + p.year + '</span><p>' + esc(p.title) + '</p></div>' +
        '<p class="fs-line"></p><p class="fs-line rs-caret">One study is not all of them, but</p></div></div></div>' + tabs('Journal') + '</div>';
    },
    asked: function () {
      return page(header(word('ask', 'Research'), 'Asked') + '<div class="fs-sheetof fs-rules">' + ASKED.map(function (a) {
        return '<a class="fs-list-row" data-set="' + a[2] + '"><span class="fs-list-meta">' + a[0] + '</span><span class="fs-list-line">' + esc(a[1]) + '</span></a>';
      }).join('') + '</div>');
    },
    key: function () {
      return '<div class="fs-app rs-app"><div class="fs-main"><div class="fs-page fs-council">' + header(word('sea', 'Flow') + word('asked', 'Asked'), 'Research') +
        '<div class="fs-chat fs-rules"><p class="rs-q">&nbsp;</p></div></div>' +
        '<div class="fs-scrim"></div><section class="fs-sheet" aria-label="Settings"><div class="fs-sheet-head"><div class="fs-grab"></div>' +
        '<div class="fs-sheet-title"><h2>Settings</h2><span class="fs-sheet-words"><button type="button" class="fs-word" data-act="ask">Done</button></span></div></div>' +
        '<div class="fs-sheet-body"><div class="fs-rows"><label class="fs-row stack"><span>Research key</span>' +
        '<input class="fs-input" value="sk-ant-••••••••4f2a" readonly><span class="fs-note">Kept on this phone, sealed with the PIN. A question leaves the phone; nothing else does.</span></label>' +
        '<button type="button" class="fs-row">Remove the key</button></div></div></section></div>' + tabs('Flow') + '</div>';
    }
  };

  function draw() {
    timers.forEach(clearTimeout); timers = [];
    host.innerHTML = VIEWS[st.view]();
  }
  function set(next) { st = next; draw(); }

  function act(a) {
    if (a === 'sea') go('sea');
    else if (a === 'ask') go('ask');
    else if (a === 'run') go('look');
    else if (a === 'asked') go('asked');
    else if (a === 'back' || a === 'back-sides') go('sides');
    else if (a === 'journal') go('carry');
    // To Council and Open the paper go out of this mock: the council and the paper are not drawn here
  }
  function click(e) {
    var t = e.target.closest('[data-act],[data-side],[data-paper],[data-set]');
    if (!t || !host.contains(t)) return;
    if (t.dataset.act) return act(t.dataset.act);
    if (t.dataset.side) { st.filter = st.filter === t.dataset.side ? null : t.dataset.side; if (st.view === 'sides') draw(); return; }
    if (t.dataset.set) { set({ view: 'sides', set: t.dataset.set }); return; }
    if (t.dataset.paper && st.view !== 'journal') { st = { view: 'paper', paper: t.dataset.paper }; if (t.dataset.paper === STEPS.paper.paper) go('paper'); else draw(); }
  }

  window.RS = {
    mount: function (el, goStep) { host = el; go = goStep; host.addEventListener('click', click); host.addEventListener('keydown', function (e) { if (e.key === 'Enter') click(e); }); },
    show: function (id) { var s = STEPS[id] || STEPS.sea; set({ view: s.view, set: s.set, filter: s.filter || null, paper: s.paper }); }
  };
})();

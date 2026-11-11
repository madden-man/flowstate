// The walk walkthrough: the rail, the counter, Previous and Next, the arrow keys, #step deep links and the relight
// control, as design/motion/walk.js has them. Every step loads the real app afresh (app.html?step=<id>), so it starts
// from that step's own state: the new load sits under the shown one until it says it has drawn, then takes its place
// and is told to make the step's taps (design/walk/src/driver.ts). Nothing here draws the app.
(function () {
  var steps = [].slice.call(document.querySelectorAll('.step'));
  var rail = document.getElementById('rail'), counter = document.getElementById('counter');
  var frames = document.getElementById('frames'), screen = document.querySelector('.screen'), nolive = document.getElementById('nolive');
  var clock = document.getElementById('clock');
  var DESIGNED = { short: 'day', one: 'day', done: 'day', on: 'night', ring: 'night', text: 'day', calendar: 'day', help: 'night', still: 'still' };
  // the phone's clock at each step: an afternoon of 11 / 10, the wave that night, Still in the small hours
  var TIME = { short: '14:02', one: '14:03', done: '15:10', on: '21:40', ring: '21:12', text: '14:31', calendar: '9:20', help: '23:05', still: '2:10' };
  var i = 0, LIGHT = 'design', n = 0, shown = null, pending = null, everReady = false, late = 0;

  function lightOf(id) { return LIGHT === 'design' ? DESIGNED[id] : LIGHT; }
  function post(f, msg) { msg.fs = true; try { f.contentWindow.postMessage(msg, '*'); } catch (e) { /* gone */ } }

  // a fresh load of the app for step id, under the one shown
  function load(id) {
    n++;
    if (pending) pending.remove();
    var f = document.createElement('iframe');
    f.className = 'next';
    f.title = 'FlowState, running live';
    f.dataset.n = String(n);
    f.dataset.step = id;
    f.src = 'app.html?step=' + id + '&light=' + lightOf(id) + '&n=' + n;
    frames.appendChild(f);
    pending = f;
    screen.dataset.light = lightOf(id);
    clock.textContent = TIME[id] || '9:41';
    clearTimeout(late);
    late = setTimeout(function () { if (!everReady) { screen.classList.add('down'); nolive.hidden = false; } }, 4000);
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.fs || !d.ready || !pending || e.source !== pending.contentWindow || d.n !== pending.dataset.n) return;
    if (shown) shown.remove();
    shown = pending; pending = null;
    shown.classList.remove('next');
    shown.id = 'app';
    everReady = true;
    screen.classList.remove('down'); nolive.hidden = true;
    post(shown, { act: true });
  });

  steps.forEach(function (s, j) {
    var li = document.createElement('li'), a = document.createElement('a');
    a.href = '#' + s.id;
    a.innerHTML = '<span class="n">' + (j + 1) + '</span><span class="t"></span>';
    a.querySelector('.t').textContent = s.dataset.name;
    a.addEventListener('click', function (e) { e.preventDefault(); go(j); });
    li.appendChild(a); rail.appendChild(li);
  });

  function go(k) {
    i = (k + steps.length) % steps.length;
    steps.forEach(function (s, j) { s.classList.toggle('on', j === i); });
    [].slice.call(rail.querySelectorAll('a')).forEach(function (a, j) { if (j === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
    counter.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
    try { history.replaceState(null, '', '#' + steps[i].id); } catch (e) { /* a sandboxed page may refuse; the step still shows */ }
    load(steps[i].id);
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-prev]')) go(i - 1);
    if (e.target.closest('[data-next]')) go(i + 1);
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowRight') go(i + 1);
    if (e.key === 'ArrowLeft') go(i - 1);
  });
  // relighting keeps the step where it is: the shown app is relit in place (a load still coming is lit as it loads)
  document.querySelectorAll('.lights [data-light]').forEach(function (b) {
    b.addEventListener('click', function () {
      LIGHT = b.dataset.light;
      document.querySelectorAll('.lights [data-light]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var id = steps[i].id;
      screen.dataset.light = lightOf(id);
      if (pending) load(id);
      else if (shown) post(shown, { light: LIGHT });
    });
  });

  function fromHash() { var h = (location.hash || '').replace('#', ''); var k = steps.findIndex(function (s) { return s.id === h; }); go(k >= 0 ? k : 0); }
  window.addEventListener('hashchange', function () { var h = (location.hash || '').replace('#', ''); if (h !== steps[i].id) fromHash(); });
  fromHash();
})();

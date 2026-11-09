// The walkthrough: the rail, the counter, Previous and Next, the arrow keys, #step deep links and the relight
// control, as design/flows/flows.js has them; but every step drives the ONE live app in the phone (app.html) to
// its screen, by a message the app's driver answers (design/motion/src/driver.ts). Nothing here draws the app.
(function () {
  var steps = [].slice.call(document.querySelectorAll('.step'));
  var rail = document.getElementById('rail'), counter = document.getElementById('counter');
  var frame = document.getElementById('app'), screen = document.querySelector('.screen'), nolive = document.getElementById('nolive');
  var DESIGNED = { keys: 'day', press: 'day', tabs: 'day', open: 'day', sheet: 'day', album: 'day', still: 'night', stream: 'night', nine: 'night', dot: 'night', hold: 'night', quiet: 'still' };
  var i = 0, LIGHT = 'design', ready = false;

  function send(msg) {
    if (!ready) return;
    msg.fs = true;
    frame.contentWindow.postMessage(msg, '*');
  }
  function drive() {
    var id = steps[i].id;
    send({ step: id, light: LIGHT });
    screen.dataset.light = LIGHT === 'design' ? DESIGNED[id] : LIGHT;
    document.querySelectorAll('.nine [data-flow]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
  }

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
    drive();
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-prev]')) go(i - 1);
    if (e.target.closest('[data-next]')) go(i + 1);
    var f = e.target.closest('.nine [data-flow]');
    if (f) {
      send({ flow: f.dataset.flow });
      document.querySelectorAll('.nine [data-flow]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === f)); });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowRight') go(i + 1);
    if (e.key === 'ArrowLeft') go(i - 1);
  });
  document.querySelectorAll('.lights [data-light]').forEach(function (b) {
    b.addEventListener('click', function () {
      LIGHT = b.dataset.light;
      document.querySelectorAll('.lights [data-light]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      drive();
    });
  });

  // the app says when it has drawn; until then the step waits, and past three seconds the phone says so plainly
  window.addEventListener('message', function (e) {
    if (e.source !== frame.contentWindow || !e.data || !e.data.fs) return;
    if (e.data.ready && !ready) { ready = true; screen.classList.remove('down'); nolive.hidden = true; drive(); }
  });
  setTimeout(function () { if (!ready) { screen.classList.add('down'); nolive.hidden = false; } }, 3000);

  var clock = document.getElementById('clock');
  function tick() { var d = new Date(); clock.textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
  tick(); setInterval(tick, 30000);

  function fromHash() { var h = (location.hash || '').replace('#', ''); var k = steps.findIndex(function (s) { return s.id === h; }); go(k >= 0 ? k : 0); }
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();

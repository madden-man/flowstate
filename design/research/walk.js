// The Research walkthrough (PLAN-RESEARCH.md): the rail, the counter, Previous and Next, the arrow keys, #step deep
// links and the relight control, as design/tasks/walk.js has them. The phone is research.js, drawn here, not an iframe.
(function () {
  var steps = [].slice.call(document.querySelectorAll('.step'));
  var rail = document.getElementById('rail'), counter = document.getElementById('counter');
  var screen = document.querySelector('.screen'), clock = document.getElementById('clock');
  var DESIGNED = { sea: 'night', ask: 'day', look: 'night', sides: 'day', one: 'day', paper: 'day', carry: 'day', empty: 'day', lower: 'night', asked: 'day', still: 'still', key: 'day' };
  var TIME = { sea: '21:40', ask: '9:12', look: '21:41', sides: '9:14', one: '9:14', paper: '9:15', carry: '9:18', empty: '9:30', lower: '21:50', asked: '9:31', still: '0:20', key: '9:10' };
  var i = 0, LIGHT = 'design';

  function relight() { screen.dataset.light = LIGHT === 'design' ? DESIGNED[steps[i].id] : LIGHT; }

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
    clock.textContent = TIME[steps[i].id] || '9:41';
    relight();
    window.RS.show(steps[i].id);
  }
  function goId(id) { var k = steps.findIndex(function (s) { return s.id === id; }); if (k >= 0) go(k); }

  window.RS.mount(document.getElementById('frames'), goId);

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-prev]')) go(i - 1);
    if (e.target.closest('[data-next]')) go(i + 1);
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
      relight();
    });
  });

  function fromHash() { var h = (location.hash || '').replace('#', ''); var k = steps.findIndex(function (s) { return s.id === h; }); go(k >= 0 ? k : 0); }
  window.addEventListener('hashchange', function () { var h = (location.hash || '').replace('#', ''); if (h !== steps[i].id) fromHash(); });
  fromHash();
})();

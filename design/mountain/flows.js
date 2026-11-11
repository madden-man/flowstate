(function(){
  var NS='http://www.w3.org/2000/svg';
  // ---- the ring: one SVG drawn in every mock, the dot placed by data-ring (rest, 1..4, empty)
  var C={x:164,y:150,r:92};
  function pt(deg){var a=deg*Math.PI/180;return [C.x+C.r*Math.cos(a),C.y+C.r*Math.sin(a)];}
  var AT={'1':-90,'2':0,'3':90,'4':180,'rest':225};
  var STEPS=[['s1','1','Overstimulated'],['s2','2','Panic'],['s3','3','Settling'],['s4','4','Under the skin']];
  function arrow(deg){var p=pt(deg);return '<path class="arrow" d="M-6 -4 L0 0 L-6 4" transform="translate('+p[0].toFixed(1)+' '+p[1].toFixed(1)+') rotate('+(deg+90)+')"/>';}
  document.querySelectorAll('.fl-ring').forEach(function(r){
    var where=r.dataset.ring,empty=where==='empty';
    var svg='<svg viewBox="0 0 328 300" aria-hidden="true">';var g=+r.dataset.ghosts||0;for(var k=0;k<g;k++){svg+='<circle class="ghost" cx="'+(C.x+(k%3-1)*1.5)+'" cy="'+(C.y+(k%2?1.5:-1.5))+'" r="'+(C.r+5+k*4)+'"/>';}svg+=
      (empty?'<path class="arc pass" d="M164 58 C217 57 257 97 256 150 C255 203 215 243 164 242 C113 243 73 203 72 150 C72 99 112 59 164 58"/>'
            :'<path class="arc" d="M164 58 C217 57 257 97 256 150 C255 203 215 243 164 242 C113 243 73 203 72 150"/><path class="arc pass" d="M72 150 C72 99 112 59 164 58"/>'+arrow(-45)+arrow(45)+arrow(135));
    if(!empty){STEPS.forEach(function(s){var p=pt(AT[s[1]]);if(s[1]!==where)svg+='<circle class="mark" cx="'+p[0]+'" cy="'+p[1]+'" r="3"/>';});
      var d=pt(AT[where]);if(where==='2')svg+='<circle class="halo" cx="'+d[0]+'" cy="'+d[1]+'" r="16"/>';svg+='<circle class="now" cx="'+d[0]+'" cy="'+d[1]+'" r="5"/>';}
    svg+='</svg>';
    var html=(r.hasAttribute('data-wash')?'<span class="fl-wash"></span>':'')+svg;
    if(empty){html+='<button type="button" class="fl-step s1 cur">name the first step<span class="fl-caret"></span></button>';}
    else STEPS.forEach(function(s){html+='<button type="button" class="fl-step '+s[0]+'" aria-pressed="'+(s[1]===where)+'"><small>'+s[1]+'</small>'+s[2]+'</button>';});
    if(r.dataset.mid){var m=r.dataset.mid.split('|');html+='<p class="fl-mid">'+m[0]+'<i>'+m[1]+'</i></p>';}
    r.innerHTML=html;
  });

  // ---- the other shapes: each a few drawn paths, phases with a point and a label place, the walker at data-at
  function head(x,y,deg){return '<path class="arrow" d="M-6 -4 L0 0 L-6 4" transform="translate('+x+' '+y+') rotate('+deg+')"/>';}
  function spiral(cx,cy,r0,turns){var d='',n=140;for(var i=0;i<=n;i++){var t=i/n,a=Math.PI+t*turns*2*Math.PI,r=r0*(1-t)+10*t,x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)+' ';}return d;}
  var DIAGS={
    valley:{paths:['<path class="arc" d="M12 40 C60 60 95 140 130 180 L198 180 C233 140 268 60 316 40"/>','<path class="arc pass" d="M182 174 C212 150 240 120 258 86"/>'+head(258,86,-62),'<text class="hand" x="196" y="100" text-anchor="middle">one small thing</text>'],
      phases:[{n:'Sliding',x:40,y:62,lx:52,ly:58,a:'start'},{n:'Pulling in',x:78,y:112,lx:90,ly:110,a:'start'},{n:"Head won't stop",x:108,y:160,lx:122,ly:172,a:'end',dy:0},{n:'The bottom',x:164,y:180,lx:164,ly:200,a:'middle'},{n:'A little light',x:222,y:158,lx:210,ly:150,a:'end'},{n:'Climbing out',x:268,y:78,lx:258,ly:74,a:'end'}]},
    arc:{paths:['<path class="arc pass faint" d="M12 170 L316 170"/>','<path class="arc" d="M20 170 C70 165 110 60 150 50 C190 42 250 150 316 170"/>','<path class="arc pass" d="M150 50 C180 70 200 200 240 206 C270 208 300 180 316 170"/>','<text class="hand" x="240" y="220" text-anchor="middle">the crash, and back</text>'],
      phases:[{n:'Spark',x:40,y:158,lx:50,ly:150,a:'start'},{n:'Build',x:92,y:100,lx:102,ly:98,a:'start'},{n:'Locked in',x:150,y:50,lx:150,ly:38,a:'middle'},{n:'The tip',x:195,y:72,lx:206,ly:70,a:'start'},{n:'Landing',x:280,y:150,lx:270,ly:142,a:'end'}]},
    mountain:{paths:['<path class="arc" d="M12 200 C50 190 80 80 110 40 C150 60 220 150 300 196"/>','<path class="arc pass" d="M110 40 C150 80 180 180 215 190 C250 200 275 198 300 196"/>','<path class="arc faint" d="M170 76 L170 200"/>','<path class="arc faint" d="M258 76 L258 200"/>','<text class="print" x="170" y="68" text-anchor="middle">20 min</text>','<text class="print" x="262" y="68" text-anchor="middle">about an hour</text>','<text class="hand" x="156" y="134" text-anchor="end">say it</text>','<text class="hand" x="176" y="92" text-anchor="start">leave</text>'],
      phases:[{n:'Trigger',x:30,y:192,lx:40,ly:186,a:'start',dy:-6},{n:'Climb',x:72,y:110,lx:62,ly:108,a:'end'},{n:'Flooded',x:110,y:40,lx:110,ly:28,a:'middle'},{n:'Said it, or left',x:140,y:72,lx:0,ly:0,a:'none'},{n:'Cooling',x:236,y:162,lx:228,ly:156,a:'end'},{n:'Repair',x:300,y:196,lx:300,ly:214,a:'middle'}]},
    curve:{paths:['<path class="arc pass faint" d="M12 190 L316 190"/>','<path class="arc" d="M20 186 C100 180 160 60 200 52 L208 190"/>','<path class="arc faint" d="M208 52 L208 190"/>','<path class="tick" d="M228 168 l4 4 l8 -9"/>','<path class="tick" d="M254 168 l4 4 l8 -9"/>','<path class="tick" d="M280 168 l4 4 l8 -9"/>','<text class="print" x="268" y="150" text-anchor="middle">didn\'t happen · 9 in 10</text>'],
      phases:[{n:"Something's coming",x:62,y:180,lx:66,ly:208,a:'middle'},{n:'What if',x:135,y:100,lx:122,ly:96,a:'end'},{n:'Night before',x:196,y:54,lx:190,ly:40,a:'middle'},{n:'The thing',x:208,y:190,lx:208,ly:208,a:'middle'},{n:'It was fine',x:262,y:190,lx:286,ly:208,a:'middle'}]},
    stamps:{paths:['<path class="arc pass faint" d="M12 190 L316 190"/>','<path class="arc" d="M20 186 C100 180 160 60 200 52 L208 190"/>','<path class="arc faint" d="M208 52 L208 190"/>','<path class="tick" d="M222 168 l4 4 l8 -9"/>','<path class="tick" d="M242 168 l4 4 l8 -9"/>','<path class="cross" d="M262 164 l10 10 M272 164 l-10 10"/>','<path class="tick" d="M282 168 l4 4 l8 -9"/>','<path class="tick" d="M302 168 l4 4 l8 -9"/>','<text class="hand" x="268" y="140" text-anchor="middle">yours, stamped</text>'],
      phases:[{n:"Something's coming",x:62,y:180,lx:66,ly:208,a:'middle'},{n:'What if',x:135,y:100,lx:122,ly:96,a:'end'},{n:'Night before',x:196,y:54,lx:190,ly:40,a:'middle'},{n:'The thing',x:208,y:190,lx:208,ly:208,a:'middle'},{n:'It was fine',x:262,y:190,lx:286,ly:208,a:'middle'}]},
    coil:{paths:['<path class="arc" d="'+spiral(164,112,86,2.5)+'"/>','<path class="arc" d="M174 112 L310 112"/>'+head(310,112,0),'<text class="hand" x="250" y="102" text-anchor="middle">how, not why</text>'],
      phases:[{n:'That stung',x:78,y:112,lx:72,ly:134,a:'start',dy:0},{n:'Why did I',x:164,y:50,lx:164,ly:36,a:'middle'},{n:'Heavier',x:164,y:112,lx:164,ly:212,a:'middle'},{n:'How, not why',x:250,y:112,lx:0,ly:0,a:'none'}]},
    clock:{paths:['<circle class="arc pass" cx="164" cy="112" r="82"/>','<path class="arc thick" d="M246 112 A82 82 0 0 1 222 170"/>','<path class="arc" d="M222 170 L240 196"/>'+head(240,196,55),'<text class="print" x="164" y="22" text-anchor="middle">12</text>','<text class="print" x="258" y="116" text-anchor="start">3</text>','<text class="print" x="164" y="212" text-anchor="middle">6</text>','<text class="print" x="70" y="116" text-anchor="end">9</text>','<circle class="pin" cx="123" cy="183" r="4"/>','<text class="print" x="112" y="200" text-anchor="end">7, pinned</text>'],
      phases:[{n:'Awake again',x:246,y:112,lx:258,ly:96,a:'middle',dy:0},{n:'What time is it',x:242,y:134,lx:0,ly:0,a:'none'},{n:'Lying there',x:236,y:150,lx:250,ly:150,a:'start'},{n:'Up',x:240,y:196,lx:252,ly:200,a:'start'},{n:'Same alarm',x:123,y:183,lx:0,ly:0,a:'none'}]},
    stairs:{paths:['<path class="arc" d="M12 60 L80 60 L80 110 L160 110 L160 160 L230 160"/>','<path class="arc" d="M230 160 C260 150 290 110 316 80"/>'],
      phases:[{n:'Too much',x:46,y:60,lx:46,ly:48,a:'middle'},{n:'Stuck',x:120,y:110,lx:120,ly:98,a:'middle'},{n:'Far away',x:195,y:160,lx:195,ly:148,a:'middle'},{n:'Thawing',x:280,y:120,lx:270,ly:176,a:'middle'}]},
    fork:{paths:['<path class="arc" d="M40 30 C70 40 95 90 120 120"/>','<path class="arc pass" d="M120 120 C100 150 70 180 40 200"/>','<path class="arc pass" d="M120 120 C150 150 190 185 230 205"/>','<path class="arc" d="M120 120 C170 110 230 60 300 40"/>'+head(300,40,-20),'<text class="hand" x="40" y="214" text-anchor="middle">hide</text>','<text class="hand" x="232" y="218" text-anchor="middle">hit back</text>'],
      phases:[{n:'Seen',x:40,y:30,lx:54,ly:26,a:'start'},{n:"I'm worthless",x:120,y:120,lx:132,ly:140,a:'start'},{n:'Hide, or hit back',x:160,y:160,lx:0,ly:0,a:'none'},{n:'I did a thing, I can fix it',x:300,y:40,lx:296,ly:28,a:'end'}]}
  };
  function drawDiag(d){
    var D=DIAGS[d.dataset.diag],at=+d.dataset.at;if(!D)return;
    var s='<svg viewBox="0 0 328 220" aria-hidden="true">'+D.paths.join('');
    D.phases.forEach(function(p,i){var n=i+1;if(n!==at)s+='<circle class="mark" cx="'+p.x+'" cy="'+p.y+'" r="3"/>';
      if(p.a!=='none')s+='<text class="ph'+(n===at?' cur':'')+'" data-n="'+n+'" x="'+p.lx+'" y="'+p.ly+'" text-anchor="'+p.a+'">'+p.n+'</text>';});
    var w=D.phases[at-1];if(w)s+='<circle class="now" cx="'+w.x+'" cy="'+w.y+'" r="5"/>';s+='</svg>';
    d.innerHTML=s;
  }
  document.querySelectorAll('.fl-diag').forEach(drawDiag);

  // ---- the drawn check, once per row
  var MARK='<svg class="fs-check-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path class="fs-check-box" d="M3.2 3.6 C7 3.1 13 3.3 16.6 3.4 C16.9 7.5 16.8 12.6 16.5 16.5 C12.4 16.9 7.6 16.8 3.4 16.6 C3.1 12.4 3 8 3.2 3.6 Z"></path><path class="fs-check-ink" pathLength="1" d="M5.2 10.6 L8.6 14 L17.6 2.6"></path></svg>';
  document.querySelectorAll('.fs-check').forEach(function(b){if(!b.querySelector('svg'))b.insertAdjacentHTML('afterbegin',MARK);});
  // a tap on a ring step word turns to that step's page (the page follows the dot); on a drawing it moves the walker; a tap on a tip ticks it
  var PAGE={'1':'overstimulated','2':'peak','3':'settling','4':'skin'};
  document.addEventListener('click',function(e){
    var ph=e.target.closest('.fl-diag text.ph');if(ph){var dg=ph.closest('.fl-diag');dg.dataset.at=ph.dataset.n;drawDiag(dg);return;}
    var s=e.target.closest('.fl-step');if(s&&!s.classList.contains('cur')){var ring=s.closest('.fl-ring'),n=s.querySelector('small').textContent,d=pt(AT[n]);
      var k=steps.findIndex(function(x){return x.id===PAGE[n];});if(k>=0&&!s.closest('.fs-sheet')&&steps[k]!==s.closest('.step')){go(k);return;}
      ring.querySelectorAll('.fl-step').forEach(function(x){x.setAttribute('aria-pressed',String(x===s));});
      var now=ring.querySelector('.now'),halo=ring.querySelector('.halo');now.setAttribute('cx',d[0]);now.setAttribute('cy',d[1]);
      if(halo)halo.remove();if(n==='2'){var h=document.createElementNS(NS,'circle');h.setAttribute('class','halo');h.setAttribute('cx',d[0]);h.setAttribute('cy',d[1]);h.setAttribute('r','16');now.parentNode.insertBefore(h,now);}}
    var c=e.target.closest('.fs-check');if(c){var on=c.getAttribute('aria-checked')!=='true';c.setAttribute('aria-checked',String(on));c.classList.toggle('done',on);}
  });

  var steps=[].slice.call(document.querySelectorAll('.step')),rail=document.getElementById('rail'),counter=document.getElementById('counter'),i=0,GLOBAL='design';
  steps.forEach(function(s,j){var li=document.createElement('li'),a=document.createElement('a');a.href='#'+s.id;a.innerHTML='<span class="n">'+(j+1)+'</span><span class="t"></span>';a.querySelector('.t').textContent=s.dataset.name;a.addEventListener('click',function(e){e.preventDefault();go(j);});li.appendChild(a);rail.appendChild(li);
    var c=document.createElement('div');c.className='ctl';c.innerHTML='<button type="button" data-prev>Previous</button><button type="button" data-next>Next</button>';s.appendChild(c);
    s.querySelectorAll('.screen').forEach(function(sc){sc.dataset.lightDefault=sc.dataset.light;});});
  function go(k){i=(k+steps.length)%steps.length;steps.forEach(function(s,j){s.classList.toggle('on',j===i);});more();[].slice.call(rail.querySelectorAll('a')).forEach(function(a,j){if(j===i)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});counter.textContent='Step '+(i+1)+' of '+steps.length;try{history.replaceState(null,'','#'+steps[i].id);}catch(e){}window.scrollTo({top:0,behavior:'smooth'});}
  document.addEventListener('click',function(e){if(e.target.closest('[data-prev]'))go(i-1);if(e.target.closest('[data-next]'))go(i+1);var m=e.target.closest('.screen .fs-moon');if(m){var sc=m.closest('.screen');sc.dataset.light=sc.dataset.light==='still'?(GLOBAL==='design'||GLOBAL==='still'?(sc.dataset.lightDefault==='still'?'night':sc.dataset.lightDefault):GLOBAL):'still';}});
  document.addEventListener('keydown',function(e){if(e.target.closest&&e.target.closest('input,textarea'))return;if(e.key==='ArrowRight')go(i+1);if(e.key==='ArrowLeft')go(i-1);});
  document.querySelectorAll('.lights [data-light]').forEach(function(b){b.addEventListener('click',function(){GLOBAL=b.dataset.light;document.querySelectorAll('.lights [data-light]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});document.querySelectorAll('.screen').forEach(function(s){s.dataset.light=GLOBAL==='design'?s.dataset.lightDefault:GLOBAL;});});});
  function more(){document.querySelectorAll('.screen .fs-sheetof').forEach(function(x){x.classList.toggle('more',x.scrollHeight>x.clientHeight+4);});}
  function fromHash(){var h=(location.hash||'').replace('#','');var k=steps.findIndex(function(s){return s.id===h;});go(k>=0?k:0);}
  window.addEventListener('hashchange',fromHash);fromHash();
})();

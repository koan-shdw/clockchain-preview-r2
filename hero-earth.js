/* Fixed background globe: a wireframe Earth pinned to the viewport (does not
   scroll), spinning slowly, faint accent lines fading around the globe, with
   subtle city + local-time tags (Neuchatel plus main world cities). It sits
   behind the whole page and is dimmed behind the content sections by their
   translucent backgrounds. Canvas 2D, no dependencies. Land outlines from the
   world-atlas TopoJSON; graticule-only fallback if it fails.
   Reduced ~50% from the earlier size, per the team notes. */
(function(){
  var canvas = document.getElementById('hero-earth');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- camera / layout ---- */
  var CAM_D = 1.7;         /* camera distance from sphere centre (R = 1) */
  var SPIN = 0.045;        /* radians per second */
  /* Tilted north (Ken, R2). Positive tilt leans the north pole toward the
     camera, so the northern hemisphere fills the visible face and the disk
     centres near ~24 deg N — giving London, Frankfurt, New York, Tokyo and the
     European cluster prominent screen time. Accepted trade-off: São Paulo and
     Sydney now sit near or below the limb. Tuned empirically over a full turn. */
  var TILT = 0.42;
  var landSegs = null;

  /* cities: [name, lat, lon, UTC offset hours (July 2026, incl. summer time)] */
  var CITIES = [
    ['Neuchatel', 46.99, 6.93, 2],
    ['London', 51.51, -0.13, 1],
    ['Frankfurt', 50.11, 8.68, 2],
    ['New York', 40.71, -74.01, -4],
    ['Chicago', 41.88, -87.63, -5],
    ['San Francisco', 37.77, -122.42, -7],
    ['São Paulo', -23.55, -46.63, -3],
    ['Dubai', 25.20, 55.27, 4],
    ['Mumbai', 19.08, 72.88, 5.5],
    ['Singapore', 1.35, 103.82, 8],
    ['Hong Kong', 22.32, 114.17, 8],
    ['Tokyo', 35.68, 139.69, 9],
    ['Sydney', -33.87, 151.21, 10],
    ['Paris', 48.85, 2.35, 2],
    ['Zurich', 47.37, 8.54, 2],
    ['Amsterdam', 52.37, 4.90, 2],
    ['Toronto', 43.65, -79.38, -4],
    ['Los Angeles', 34.05, -118.24, -7],
    ['Shanghai', 31.23, 121.47, 8],
    ['Seoul', 37.57, 126.98, 9]
  ];

  var W = 0, H = 0, DPR = 1, S = 0, CX = 0, CY = 0;
  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    /* ~50% smaller than the old full-bleed globe, sitting centre-right so it
       reads strongest behind the hero widget */
    var narrow = W < 760;
    S = Math.max(W, H) * (narrow ? 0.46 : 0.4);
    CX = narrow ? W * 0.5 : W * 0.66;
    /* sits low enough that the northern band clears the live clock card, which
       otherwise swallowed 68-83% of every city label's path */
    CY = narrow ? H * 0.34 : H * 0.62;
  }

  function accent(){
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00cc00';
  }
  function pageBg(){
    return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
  }

  function toXYZ(lat, lon){
    var la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  }

  /* rotate around Y (spin) then X (tilt); out = [x, y, visible, frontness] */
  function project(p, rot, out){
    var cr = Math.cos(rot), sr = Math.sin(rot);
    var x = p[0] * cr + p[2] * sr;
    var z = -p[0] * sr + p[2] * cr;
    var ct = Math.cos(TILT), st = Math.sin(TILT);
    var y = p[1] * ct - z * st;
    z = p[1] * st + z * ct;
    if(z < 1 / CAM_D) { out[2] = 0; return out; }
    var k = S / (CAM_D - z);
    out[0] = CX + x * k;
    out[1] = CY - y * k;
    out[2] = 1;
    out[3] = z;
    return out;
  }

  function strokeSegs(segs, rot, alpha){
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    var a = [0,0,0,0];
    for(var i = 0; i < segs.length; i++){
      var seg = segs[i], pen = false;
      for(var j = 0; j < seg.length; j++){
        project(seg[j], rot, a);
        if(a[2]){
          if(pen) ctx.lineTo(a[0], a[1]);
          else { ctx.moveTo(a[0], a[1]); pen = true; }
        } else pen = false;
      }
    }
    ctx.stroke();
  }

  /* ---- city tags ---- */
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function cityTime(offset){
    var d = new Date(Date.now() + offset * 3600000);
    return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }
  /* per-city animation state: opacity eases toward a target so labels fade in
     as a city rounds into view and fade out as it leaves or yields to a
     collision, instead of popping. Position is remembered so a fading-out
     label follows its city (or lingers where it was as it slips off the limb). */
  var cityFx = [];
  function drawCities(rot, ac, bg, dt){
    var a = [0,0,0,0], boxes = [], fadeR = S / CAM_D * 1.33;
    ctx.font = '500 11.5px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    var k = 1 - Math.exp(-(dt || 1) / 0.16);   /* ease toward target over ~0.16s */
    var i, j;
    /* pass 1: project each city, build its label, resolve collisions in priority order */
    var vis = [];
    for(i = 0; i < CITIES.length; i++){
      var c = CITIES[i];
      project(toXYZ(c[1], c[2]), rot, a);
      if(!a[2]){ vis[i] = null; continue; }
      var x = a[0], y = a[1], dx = x - CX, dy = y - CY;
      /* keep tags on the globe: past the vignette they float on blank page */
      if(Math.sqrt(dx * dx + dy * dy) > fadeR){ vis[i] = null; continue; }
      /* 0 at the limb, 1 dead centre. z never drops below 1/CAM_D when visible,
         so normalise across that range instead of wasting most of the ramp. */
      var lift = (a[3] - 1 / CAM_D) / (1 - 1 / CAM_D);
      var label = c[0] + '  ' + cityTime(c[3]);
      var bx = x + 7, w = ctx.measureText(label).width;
      var box = [bx, y - 9, bx + w, y + 9], clash = false;
      for(j = 0; j < boxes.length; j++){
        var b = boxes[j];
        if(box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]){ clash = true; break; }
      }
      if(!clash) boxes.push(box);   /* only a winner reserves its box */
      vis[i] = { x:x, y:y, lift:lift, label:label, bx:bx, win: !clash };
    }
    /* pass 2: ease opacity toward the target, draw at the remembered position */
    for(i = 0; i < CITIES.length; i++){
      var f = cityFx[i] || (cityFx[i] = { a:0, x:0, y:0, lift:0, label:'', bx:0 });
      var v = vis[i], target = 0;
      if(v){
        target = v.win ? 1 : 0;
        f.x = v.x; f.y = v.y; f.lift = v.lift; f.label = v.label; f.bx = v.bx;
      }
      f.a += (target - f.a) * k;
      if(f.a < 0.02 || !f.label) continue;
      ctx.globalAlpha = (0.55 + f.lift * 0.4) * f.a;
      ctx.fillStyle = ac;
      ctx.beginPath(); ctx.arc(f.x, f.y, 2.1, 0, 6.2832); ctx.fill();
      /* halo in the page colour so the tag reads over the graticule lines */
      ctx.globalAlpha = 0.9 * f.a;
      ctx.strokeStyle = bg; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
      ctx.strokeText(f.label, f.bx, f.y);
      ctx.globalAlpha = (0.6 + f.lift * 0.35) * f.a;
      ctx.fillStyle = ac;
      ctx.fillText(f.label, f.bx, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  /* ---- graticule ---- */
  var grat = [];
  (function(){
    var lat, lon, line;
    for(lon = -180; lon < 180; lon += 15){
      line = [];
      for(lat = -90; lat <= 90; lat += 3) line.push(toXYZ(lat, lon));
      grat.push(line);
    }
    for(lat = -75; lat <= 75; lat += 15){
      line = [];
      for(lon = -180; lon <= 180; lon += 3) line.push(toXYZ(lat, lon));
      grat.push(line);
    }
  })();

  /* ---- land outlines ---- */
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
    .then(function(r){ return r.json(); })
    .then(function(topo){
      var tr = topo.transform, sc = tr.scale, tl = tr.translate;
      landSegs = topo.arcs.map(function(arc){
        var x = 0, y = 0;
        return arc.map(function(d){
          x += d[0]; y += d[1];
          return toXYZ(y * sc[1] + tl[1], x * sc[0] + tl[0]);
        });
      });
    })
    .catch(function(){});

  /* ---- edge fade, centred on the globe ---- */
  function fade(){
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    var r = S / CAM_D * 1.35;
    var g = ctx.createRadialGradient(CX, CY, r * 0.35, CX, CY, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.72, 'rgba(0,0,0,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  function draw(rot, dt){
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    var ac = accent();
    ctx.strokeStyle = ac;
    strokeSegs(grat, rot, 0.15);
    if(landSegs) strokeSegs(landSegs, rot, 0.4);
    fade();
    drawCities(rot, ac, pageBg(), dt);
  }

  /* ---- loop: fixed backdrop, runs while the tab is visible ----
     The canvas is a GPU-promoted fixed layer (see CSS translateZ), so it does
     not repaint on scroll and cannot flicker as the sections scroll over it. */
  var running = false, raf = null, t0 = null, rot0 = 0.6, lastT = null;
  function frame(t){
    if(t0 === null) t0 = t;
    var dt = (lastT === null) ? 0.016 : (t - lastT) / 1000;
    lastT = t;
    draw(rot0 + (t - t0) / 1000 * SPIN, dt);
    raf = running ? requestAnimationFrame(frame) : null;
  }
  function setRunning(on){
    on = on && !document.hidden && !reduceMotion;
    if(on === running) return;
    running = on;
    if(on){ t0 = null; lastT = null; rot0 += 0.0001; raf = requestAnimationFrame(frame); }
    else if(raf){ cancelAnimationFrame(raf); raf = null; }
  }

  document.addEventListener('visibilitychange', function(){ setRunning(true); });
  var rt = null;
  window.addEventListener('resize', function(){
    /* debounce so a scroll-driven mobile URL-bar resize does not thrash */
    if(rt) return;
    rt = setTimeout(function(){ rt = null; resize(); if(!running) draw(rot0); }, 150);
  });

  resize();
  if(reduceMotion){ draw(rot0); setTimeout(function(){ draw(rot0); }, 1500); }
  else setRunning(true);
  setTimeout(function(){ if(!running) draw(rot0); }, 1500);
})();

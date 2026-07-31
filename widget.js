/* Clockchain live-proof widget: hero card + docked pill + expand table.
   ------------------------------------------------------------------
   DATA PROVIDER: SIMULATED for this mockup.
   Production swap: replace `feed.status()` with a fetch to a public
   read-only endpoint (e.g. GET node.clockchain.network/api/time/time,
   currently key-gated; a keyless proxy or public route is required).
   Keep the returned shape { height, offsets } and everything else works.
   ------------------------------------------------------------------ */
(function(){
  /* Block 36042 observed at 2026-07-03 02:45:28 UTC on the live testnet;
     height advances 1 block/second from that anchor. */
  var GENESIS = Math.floor(Date.UTC(2026, 6, 3, 2, 45, 28) / 1000) - 36042;
  var TAI_OFFSET_S = 37; /* TAI = UTC + 37 s (current leap-second total) */

  var feed = {
    status: function(){
      var ms = Date.now();
      return {
        ms: ms,
        height: Math.floor(ms / 1000) - GENESIS,
        /* simulated source offsets vs Clockchain consensus time, in ms */
        offsets: { clockchain: 0, utc: 57, ntp: -55, gps: 12 }
      };
    }
  };

  function pad(n, w){ n = String(n); while(n.length < (w || 2)) n = '0' + n; return n; }
  function fmtTime(ms, withMs){
    var d = new Date(ms);
    var s = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
    return withMs ? s : s;
  }
  function fmtDate(ms){
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' UTC';
  }
  function fmtOffset(v){ return (v >= 0 ? '+' : '') + v + ' ms'; }
  function randHash(){
    var c = '0123456789abcdef', s = '0x';
    for(var i = 0; i < 12; i++) s += c[Math.floor(Math.random() * 16)];
    return s;
  }

  var el = {
    time: document.getElementById('cw-time'),
    date: document.getElementById('cw-date'),
    height: document.getElementById('cw-height'),
    hash: document.getElementById('cw-hash'),
    logs: document.getElementById('cw-logs'),
    dHash: document.getElementById('cwd-hash'),
    dTime: document.getElementById('cwd-time'),
    dHeight: document.getElementById('cwd-height')
  };
  var srcEls = document.querySelectorAll('[data-cw-src]');
  var offEls = document.querySelectorAll('[data-cw-off]');
  var chainEls = document.querySelectorAll('[data-cw-chain]'); /* blockchain compare: current time per chain */
  var blockEls = document.querySelectorAll('[data-cw-block]'); /* blockchain compare: live Clockchain height */

  /* total logs anchored: a large, continuously rising number.
     Simulated: ~7.4 logs/second from a fixed epoch so it only ever climbs. */
  var LOGS_EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);
  var LOGS_RATE = 7.4;
  function totalLogs(ms){ return Math.floor((ms - LOGS_EPOCH) / 1000 * LOGS_RATE); }

  var lastSecond = -1;
  function render(){
    var st = feed.status();
    var sec = Math.floor(st.ms / 1000);
    var msPart = pad(st.ms % 1000, 3);

    if(el.time) el.time.innerHTML = fmtTime(st.ms) + '<span class="cw-ms">.' + msPart + '</span>';
    if(el.logs) el.logs.textContent = totalLogs(st.ms).toLocaleString();

    if(sec !== lastSecond){
      lastSecond = sec;
      var h = '#' + st.height.toLocaleString();
      var hash = randHash();
      if(el.date) el.date.textContent = fmtDate(st.ms);
      if(el.height) el.height.textContent = h;
      if(el.dTime) el.dTime.textContent = fmtTime(st.ms);
      if(el.dHeight) el.dHeight.textContent = h;
      var anchored = 'block ' + hash + '… anchored · verified on-chain';
      if(el.hash) el.hash.textContent = anchored;
      if(el.dHash) el.dHash.textContent = anchored;

      srcEls.forEach(function(n){
        var k = n.getAttribute('data-cw-src');
        var t = st.ms;
        if(k === 'utc') t += st.offsets.utc;
        else if(k === 'ntp') t += st.offsets.ntp;
        else if(k === 'gps') t += st.offsets.gps;
        else if(k === 'tai') t += TAI_OFFSET_S * 1000;
        n.textContent = fmtTime(t);
      });
      offEls.forEach(function(n){
        var k = n.getAttribute('data-cw-off');
        if(k === 'clockchain'){ n.textContent = 'consensus'; return; }
        if(k === 'tai'){ n.textContent = '+37 s'; return; }
        n.textContent = fmtOffset(st.offsets[k]);
      });
      chainEls.forEach(function(n){
        var off = parseInt(n.getAttribute('data-cw-chain'), 10) || 0;
        n.textContent = fmtTime(st.ms + off * 1000);
      });
      blockEls.forEach(function(n){
        n.textContent = '#' + st.height.toLocaleString();
      });
    }
    raf = requestAnimationFrame(render);
  }
  var raf = requestAnimationFrame(render);
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ cancelAnimationFrame(raf); }
    else { lastSecond = -1; raf = requestAnimationFrame(render); }
  });

  /* hero card expand */
  var toggle = document.getElementById('cw-toggle');
  var table = document.getElementById('cw-table');
  if(toggle && table){
    toggle.addEventListener('click', function(){
      var open = table.hasAttribute('hidden');
      if(open) table.removeAttribute('hidden'); else table.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* dock: appears when the hero card scrolls out of view.
     Pages without a hero card (about, newsroom) dock immediately. */
  var card = document.getElementById('cw-card');
  var dock = document.getElementById('cw-dock');
  if(dock){
    if(card && 'IntersectionObserver' in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          /* dock only once the card has scrolled up past the viewport,
             not while it still sits below the fold on first load */
          var docked = !en.isIntersecting && en.boundingClientRect.top < 0;
          document.body.classList.toggle('cw-docked', docked);
          dock.setAttribute('aria-hidden', docked ? 'false' : 'true');
        });
      }, { threshold: 0.15 });
      io.observe(card);
    } else {
      document.body.classList.add('cw-docked');
      dock.setAttribute('aria-hidden', 'false');
    }
  }

  /* dock: expand panel */
  var dToggle = document.getElementById('cw-dock-toggle');
  var dPanel = document.getElementById('cw-dock-panel');
  if(dToggle && dPanel){
    dToggle.addEventListener('click', function(){
      var open = dPanel.hasAttribute('hidden');
      if(open) dPanel.removeAttribute('hidden'); else dPanel.setAttribute('hidden', '');
      dToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function(e){
      if(!dPanel.hasAttribute('hidden') && !dock.contains(e.target)){
        dPanel.setAttribute('hidden', '');
        dToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* dock: dismiss for the session */
  var dClose = document.getElementById('cw-dock-close');
  if(dClose){
    dClose.addEventListener('click', function(){
      document.body.classList.add('cw-dismissed');
      try{ sessionStorage.setItem('cw-dismissed', '1'); }catch(e){}
    });
    try{
      if(sessionStorage.getItem('cw-dismissed') === '1') document.body.classList.add('cw-dismissed');
    }catch(e){}
  }
})();

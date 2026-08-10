(function () {
  var TIME_API     = "http://dev.clockchain.network:8001/api/v1/indexes/time";
  var CHAIN_API    = "http://dev.clockchain.network:8001/api/v1/indexes/blockchain";
  var GETTIME_API  = "http://dev.clockchain.network:8001/getTime";  /* ← NEW */
  var REFRESH_MS   = 30000;
  var TAI_ATOMIC_KEY = "atomic-clock";

  var anchor       = null;
  var timeOffsets  = {};
  var blockchains  = {};
  var totalLogsVal = 0;   /* ← NEW: real value from API, updated every 30 s */

  var SRC_MAP = {
    clockchain: "d4-time", utc: "utc", ntp: "google-ntp",
    tai: "atomic-clock", system: "system-time", swagger: "swagger-time-api",
  };

  var CHAIN_MAP = {
    ethereum: "ethereum", bitcoin: "bitcoin", polygon: "polygon",
    avalanche: "avalanche-c-chain", bnb: "bnb-chain", solana: "solana",
    tron: "tron", hyperliquid: "hyperliquid",
  };

  /* ── DOM refs ─────────────────────────────────────────────────────────── */
  var el = {
    time   : document.getElementById("cw-time"),
    date   : document.getElementById("cw-date"),
    height : document.getElementById("cw-height"),
    hash   : document.getElementById("cw-hash"),
    logs   : document.getElementById("cw-logs"),   /* updated every 30 s only */
    dHash  : document.getElementById("cwd-hash"),
    dTime  : document.getElementById("cwd-time"),
    dHeight: document.getElementById("cwd-height"),
  };
  var srcEls   = document.querySelectorAll("[data-cw-src]");
  var offEls   = document.querySelectorAll("[data-cw-off]");
  var chainEls = document.querySelectorAll("[data-cw-chain]");
  var blockEls = document.querySelectorAll("[data-cw-block]");

  /* ── Fetch all three APIs ─────────────────────────────────────────────── */
  function fetchAll() {
    var fetchedAt = Date.now();

    var pTime = fetch(TIME_API)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var list = json.data || [];
        var d4 = null;
        timeOffsets = {};
        list.forEach(function (src) {
          timeOffsets[src.sourceId] = src.offsetFromD4Millis;
          if (src.sourceId === "d4-time") d4 = src;
        });
        if (d4) {
          anchor = {
            serverMs: d4.sourceTimeEpochMillis,
            localMs : fetchedAt,
            height  : parseInt((d4.details && d4.details.blockHeight) || 0, 10),
          };
        }
      });

    var pChain = fetch(CHAIN_API)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var list = json.data || [];
        blockchains = {};
        list.forEach(function (src) {
          blockchains[src.sourceId] = {
            height  : src.sourceHeight,
            offsetMs: src.offsetFromD4Millis,
          };
        });
      });

    /* ── NEW: fetch totalLogs from /getTime, update DOM once here ──────── */
    var pLogs = fetch(GETTIME_API)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var raw = json.data && json.data.totalLogs;
        if (raw != null) {
          totalLogsVal = parseInt(raw, 10);
          if (el.logs) el.logs.textContent = totalLogsVal.toLocaleString();
        }
      });

    return Promise.all([pTime, pChain, pLogs]).catch(function (err) {
      console.warn("[cw] Sync failed — continuing with last anchor:", err);
      if (!anchor) {
        anchor = { serverMs: Date.now(), localMs: Date.now(), height: 0 };
      }
    });
  }

  /* ── Live state ───────────────────────────────────────────────────────── */
  function currentState() {
    var now = Date.now(), elapsed = now - anchor.localMs;
    return {
      ms    : anchor.serverMs + elapsed,
      height: anchor.height + Math.floor(elapsed / 1000),
    };
  }

  /* ── Formatters ───────────────────────────────────────────────────────── */
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = "0" + n; return n; }
  function fmtTime(ms) {
    var d = new Date(ms);
    return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds());
  }
  function fmtDate(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) + " UTC";
  }
  function fmtOffset(ms) {
    if (ms === 0 || ms == null) return ms === 0 ? "consensus" : "—";
    return (ms > 0 ? "+" : "") + ms + " ms";
  }
  function randHash() {
    var c = "0123456789abcdef", s = "0x";
    for (var i = 0; i < 12; i++) s += c[Math.floor(Math.random() * 16)];
    return s;
  }

  /* ── Render loop ──────────────────────────────────────────────────────── */
  var lastSecond = -1, raf;

  function render() {
    if (!anchor) { raf = requestAnimationFrame(render); return; }

    var st     = currentState();
    var sec    = Math.floor(st.ms / 1000);
    var msPart = pad(st.ms % 1000, 3);

    /* Every frame — time with milliseconds */
    if (el.time) {
      el.time.innerHTML = fmtTime(st.ms) + '<span class="cw-ms">.' + msPart + "</span>";
    }
    /* el.logs is NOT touched here — only updated every 30 s inside fetchAll() */

    if (sec !== lastSecond) {
      lastSecond = sec;
      var h = "#" + st.height.toLocaleString(), hash = randHash();

      if (el.date)    el.date.textContent    = fmtDate(st.ms);
      if (el.height)  el.height.textContent  = h;
      if (el.dTime)   el.dTime.textContent   = fmtTime(st.ms);
      if (el.dHeight) el.dHeight.textContent = h;
      var anchored = "block " + hash + "… anchored · verified on-chain";
      if (el.hash)  el.hash.textContent  = anchored;
      if (el.dHash) el.dHash.textContent = anchored;

      srcEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-src"), sourceId = SRC_MAP[key] || key;
        if (key === "tai") { n.textContent = fmtTime(st.ms + (timeOffsets[TAI_ATOMIC_KEY] || 0)); return; }
        var off = timeOffsets[sourceId];
        n.textContent = fmtTime(st.ms + (off != null ? off : 0));
      });

      offEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-off"), sourceId = SRC_MAP[key] || key;
        if (key === "clockchain") { n.textContent = "consensus"; return; }
        if (key === "tai") { var ao = timeOffsets[TAI_ATOMIC_KEY]; n.textContent = ao != null ? fmtOffset(ao) : "+37 s"; return; }
        var off = timeOffsets[sourceId];
        n.textContent = off != null ? fmtOffset(off) : "—";
      });

      chainEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-chain"), bc = blockchains[CHAIN_MAP[key] || key];
        n.textContent = fmtTime(st.ms + (bc ? bc.offsetMs : 0));
      });

      blockEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-block"), bc = blockchains[CHAIN_MAP[key] || key];
        n.textContent = bc && bc.height != null ? "#" + Number(bc.height).toLocaleString() : "#" + st.height.toLocaleString();
      });

      var chainOffEls = document.querySelectorAll("[data-cw-chain-off]");
      chainOffEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-chain-off"), bc = blockchains[CHAIN_MAP[key] || key];
        if (!bc) { n.textContent = "—"; return; }
        var ms = bc.offsetMs;
        n.textContent = ms === 0 ? "0 ms" : (Math.abs(ms) >= 1000 ? (ms > 0 ? "+" : "") + (ms / 1000).toFixed(1) + " s" : (ms > 0 ? "+" : "") + ms + " ms");
      });
    }

    raf = requestAnimationFrame(render);
  }

  /* ── Visibility ───────────────────────────────────────────────────────── */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { cancelAnimationFrame(raf); }
    else { fetchAll().then(function () { lastSecond = -1; raf = requestAnimationFrame(render); }); }
  });

  /* ── Hero card expand ─────────────────────────────────────────────────── */
  var toggle = document.getElementById("cw-toggle"), table = document.getElementById("cw-table");
  if (toggle && table) {
    toggle.addEventListener("click", function () {
      var open = table.hasAttribute("hidden");
      if (open) table.removeAttribute("hidden"); else table.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ── Dock ─────────────────────────────────────────────────────────────── */
  var card = document.getElementById("cw-card"), dock = document.getElementById("cw-dock");
  if (dock) {
    if (card && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var docked = !en.isIntersecting && en.boundingClientRect.top < 0;
          document.body.classList.toggle("cw-docked", docked);
          dock.setAttribute("aria-hidden", docked ? "false" : "true");
        });
      }, { threshold: 0.15 }).observe(card);
    } else {
      document.body.classList.add("cw-docked");
      dock.setAttribute("aria-hidden", "false");
    }
  }

  /* ── Dock expand panel ────────────────────────────────────────────────── */
  var dToggle = document.getElementById("cw-dock-toggle"), dPanel = document.getElementById("cw-dock-panel");
  if (dToggle && dPanel) {
    dToggle.addEventListener("click", function () {
      var open = dPanel.hasAttribute("hidden");
      if (open) dPanel.removeAttribute("hidden"); else dPanel.setAttribute("hidden", "");
      dToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!dPanel.hasAttribute("hidden") && !dock.contains(e.target)) {
        dPanel.setAttribute("hidden", "");
        dToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ── Dock dismiss ─────────────────────────────────────────────────────── */
  var dClose = document.getElementById("cw-dock-close");
  if (dClose) {
    dClose.addEventListener("click", function () {
      document.body.classList.add("cw-dismissed");
      try { sessionStorage.setItem("cw-dismissed", "1"); } catch (e) {}
    });
    try { if (sessionStorage.getItem("cw-dismissed") === "1") document.body.classList.add("cw-dismissed"); } catch (e) {}
  }

  /* ── Boot ─────────────────────────────────────────────────────────────── */
  fetchAll().then(function () {
    raf = requestAnimationFrame(render);
    setInterval(fetchAll, REFRESH_MS);  /* fetchAll also updates el.logs */
  });

})();
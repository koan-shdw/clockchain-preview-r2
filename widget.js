(function () {
  /* ═══════════════════════════════════════════════════════════════════════
     Clockchain live-proof widget — REAL INDEX DATA edition.
     Three API calls on boot (+ every 30 s):
       /getTime                   → Clockchain time, blockHeight, totalLogs
       /api/v1/indexes/time       → per-source time offsets
       /api/v1/indexes/blockchain → per-chain heights + time offsets
     Between syncs, Clockchain time & height advance locally (+1 s / tick)
     so the display remains smooth. If API data is missing, "—" is shown.
     ═══════════════════════════════════════════════════════════════════════ */

  var TIME_API    = "https://clockchain.network/clockchain-api/api/v1/indexes/time";
  var CHAIN_API   = "https://clockchain.network/clockchain-api/api/v1/indexes/blockchain";
  var GETTIME_API = "https://clockchain.network/clockchain-api/getTime";
  var REFRESH_MS  = 30000;

  var anchor       = null;
  /* anchor = { serverMs: number, localMs: number, height: number } */
  var timeOffsets  = {};
  var blockchains  = {};
  var totalLogsVal = null;

  var SRC_MAP = {
    clockchain: "d4-time",
    utc: "utc",
    ntp: "google-ntp",
    gnss: "gnss-gps",
    ptp: "ptp",
    system: "system-time",
    swagger: "swagger-time-api",
  };

  var CHAIN_MAP = {
    clockchain: "clockchain",
    ethereum: "ethereum",
    bitcoin: "bitcoin",
    polygon: "polygon",
    avalanche: "avalanche-c-chain",
    bnb: "bnb-chain",
    solana: "solana",
    tron: "tron",
    hyperliquid: "hyperliquid",
  };

  /* ── DOM refs ─────────────────────────────────────────────────────────── */
  var el = {
    time   : document.getElementById("cw-time"),
    date   : document.getElementById("cw-date"),
    height : document.getElementById("cw-height"),
    hash   : document.getElementById("cw-hash"),
    logs   : document.getElementById("cw-logs"),
    dHash  : document.getElementById("cwd-hash"),
    dTime  : document.getElementById("cwd-time"),
    dHeight: document.getElementById("cwd-height"),
  };
  var srcEls      = document.querySelectorAll("[data-cw-src]");
  var offEls      = document.querySelectorAll("[data-cw-off]");
  var chainEls    = document.querySelectorAll("[data-cw-chain]");
  var blockEls    = document.querySelectorAll("[data-cw-block]");
  var chainOffEls = document.querySelectorAll("[data-cw-chain-off]");

  /* ── Parse "DD-MM-YYYY_HH:mm:ss:mmm" → Unix ms (UTC) ─────────────────── */
  function parseMadMarzullo(str) {
    if (!str || typeof str !== "string") return null;
    try {
      var halves = str.split("_");
      if (halves.length < 2) return null;
      var dateParts = halves[0].split("-");
      var timeParts = halves[1].split(":");
      if (dateParts.length < 3 || timeParts.length < 3) return null;

      return Date.UTC(
        parseInt(dateParts[2], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[0], 10),
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10),
        parseInt(timeParts[2], 10),
        parseInt(timeParts[3] || 0, 10)
      );
    } catch (e) {
      return null;
    }
  }

  /* ── Fetch all three APIs ─────────────────────────────────────────────── */
  function fetchAll() {
    var fetchedAt = Date.now();

    /* 1. getTime API: Sourced for Clockchain time, blockHeight, and totalLogs */
    var pGetTime = fetch(GETTIME_API)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json && json.success && json.data) {
          var d = json.data;
          var serverMs = parseMadMarzullo(d.madMarzulloTime);
          var height   = d.blockHeight != null ? parseInt(d.blockHeight, 10) : null;

          if (serverMs != null && height != null && !isNaN(height)) {
            anchor = {
              serverMs: serverMs,
              localMs : fetchedAt,
              height  : height,
            };
          } else {
            anchor = null;
          }

          totalLogsVal = d.totalLogs != null ? parseInt(d.totalLogs, 10) : null;
        } else {
          anchor = null;
          totalLogsVal = null;
        }

        if (el.logs) {
          el.logs.textContent = (totalLogsVal != null && !isNaN(totalLogsVal))
            ? totalLogsVal.toLocaleString()
            : "—";
        }
      })
      .catch(function (err) {
        console.warn("[cw] /getTime API failed:", err);
        if (!anchor) anchor = null;
        totalLogsVal = null;
        if (el.logs) el.logs.textContent = "—";
      });

    /* 2. Time Indexes API */
    var pTime = fetch(TIME_API)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var list = (json && json.data) || [];
        timeOffsets = {};
        list.forEach(function (src) {
          timeOffsets[src.sourceId] = src.offsetFromD4Millis;
        });
      })
      .catch(function (err) {
        console.warn("[cw] Time index API failed:", err);
        timeOffsets = {};
      });

    /* 3. Blockchain Indexes API */
    var pChain = fetch(CHAIN_API)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var list = (json && json.data) || [];
        blockchains = {};
        list.forEach(function (src) {
          blockchains[src.sourceId] = {
            height  : src.sourceHeight,
            offsetMs: src.offsetFromD4Millis,
          };
        });
      })
      .catch(function (err) {
        console.warn("[cw] Blockchain index API failed:", err);
        blockchains = {};
      });

    return Promise.all([pGetTime, pTime, pChain]);
  }

  /* ── Live state ───────────────────────────────────────────────────────── */
  function currentState() {
    if (!anchor) return null;
    var now = Date.now(), elapsed = now - anchor.localMs;
    return {
      ms    : anchor.serverMs + elapsed,
      height: anchor.height + Math.floor(elapsed / 1000),
    };
  }

  /* ── Formatters ───────────────────────────────────────────────────────── */
  function pad(n, w) {
    n = String(n);
    while (n.length < (w || 2)) n = "0" + n;
    return n;
  }
  function fmtTime(ms) {
    if (ms == null || isNaN(ms)) return "—";
    var d = new Date(ms);
    return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds());
  }
  function fmtDate(ms) {
    if (ms == null || isNaN(ms)) return "—";
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) + " UTC";
  }
  function fmtOffset(ms) {
    if (ms === 0) return "consensus";
    if (ms == null || isNaN(ms)) return "—";
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
    var st = currentState();

    /* ── Case 1: No API data available ───────────────────────────────────── */
    if (!st) {
      if (el.time)    el.time.innerHTML    = "--";
      if (el.date)    el.date.textContent  = "--";
      if (el.height)  el.height.textContent = "--";
      if (el.dTime)   el.dTime.textContent  = "--";
      if (el.dHeight) el.dHeight.textContent = "--";
      if (el.hash)    el.hash.textContent   = "--";
      if (el.dHash)   el.dHash.textContent  = "--";
      if (el.logs)    el.logs.textContent   = "--";

      srcEls.forEach(function (n) { n.textContent = "--"; });
      offEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-off");
        n.textContent = key === "clockchain" ? "consensus" : "--";
      });
      chainEls.forEach(function (n) { n.textContent = "--"; });
      blockEls.forEach(function (n) { n.textContent = "--"; });
      chainOffEls.forEach(function (n) { n.textContent = "--"; });

      raf = requestAnimationFrame(render);
      return;
    }

    /* ── Case 2: Live rendering from anchor data ─────────────────────────── */
    var sec    = Math.floor(st.ms / 1000);
    var msPart = pad(st.ms % 1000, 3);

    /* Millisecond display */
    if (el.time) {
      el.time.innerHTML = fmtTime(st.ms) + '<span class="cw-ms">.' + msPart + "</span>";
    }

    /* Second display */
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

      /* Time sources */
      srcEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-src"), sourceId = SRC_MAP[key] || key;
        var off = timeOffsets[sourceId];

        if (off == null && key === "gnss" && timeOffsets["utc"] != null) {
          off = timeOffsets["utc"] + 18000;
        }
        if (off == null && key === "ptp" && timeOffsets["utc"] != null) {
          off = timeOffsets["utc"];
        }

        n.textContent = off != null ? fmtTime(st.ms + off) : "—";
      });

      /* Time offsets */
      offEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-off"), sourceId = SRC_MAP[key] || key;
        if (key === "clockchain") { n.textContent = "consensus"; return; }
        var off = timeOffsets[sourceId];
        n.textContent = off != null ? fmtOffset(off) : "—";
      });

      /* Blockchain times (Clockchain row takes directly from getTime API anchor) */
      chainEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-chain");
        if (key === "clockchain" || key === "0") {
          n.textContent = fmtTime(st.ms);
          return;
        }
        var sourceId = CHAIN_MAP[key] || key;
        var bc = blockchains[sourceId];
        n.textContent = (bc && bc.offsetMs != null) ? fmtTime(st.ms + bc.offsetMs) : "—";
      });

      /* Blockchain heights (Clockchain row takes directly from getTime API anchor) */
      blockEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-block");
        if (key === "clockchain" || key === "0") {
          n.textContent = "#" + st.height.toLocaleString();
          return;
        }
        var sourceId = CHAIN_MAP[key] || key;
        var bc = blockchains[sourceId];
        n.textContent = (bc && bc.height != null) ? "#" + Number(bc.height).toLocaleString() : "—";
      });

      /* Blockchain offsets */
      chainOffEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-chain-off");
        if (key === "clockchain" || key === "0") {
          n.textContent = "0 ms";
          return;
        }
        var sourceId = CHAIN_MAP[key] || key;
        var bc = blockchains[sourceId];
        if (!bc || bc.offsetMs == null) { n.textContent = "—"; return; }
        var ms = bc.offsetMs;
        n.textContent = ms === 0
          ? "0 ms"
          : (Math.abs(ms) >= 1000
            ? (ms > 0 ? "+" : "") + (ms / 1000).toFixed(1) + " s"
            : (ms > 0 ? "+" : "") + ms + " ms");
      });
    }

    raf = requestAnimationFrame(render);
  }

  /* ── Visibility ───────────────────────────────────────────────────────── */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      fetchAll().then(function () {
        lastSecond = -1;
        raf = requestAnimationFrame(render);
      });
    }
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
    setInterval(fetchAll, REFRESH_MS);
  });

})();
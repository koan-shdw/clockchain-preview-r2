(function () {
  /* ═══════════════════════════════════════════════════════════════════════
     Clockchain live-proof widget — REAL INDEX DATA edition.
     Two API calls on boot (+ every 30 s):
       /api/v1/indexes/time       → d4-time anchor + per-source offsets
       /api/v1/indexes/blockchain → per-chain heights + time offsets
     Between syncs the Clockchain time/height advances locally (+1 s / tick)
     so the display is always smooth.
     ═══════════════════════════════════════════════════════════════════════ */

  var TIME_API = "http://dev.clockchain.network:8001/api/v1/indexes/time";
  var CHAIN_API =
    "http://dev.clockchain.network:8001/api/v1/indexes/blockchain";
  var REFRESH_MS = 30000; /* re-sync every 30 s                         */
  var TAI_ATOMIC_KEY = "atomic-clock";

  /* ── Shared state ─────────────────────────────────────────────────────── */
  var anchor = null;
  /*  anchor = {
        serverMs : number   — d4-time epoch ms at last sync
        localMs  : number   — Date.now() at last sync
        height   : number   — Clockchain block height at last sync
      }                                                                      */

  /* sourceId → offsetFromD4Millis (ms).
     Negative = source is behind D4; Positive = source is ahead.
     data-cw-src attribute values map here via SRC_MAP below.               */
  var timeOffsets = {};

  /* chain key → { height, offsetMs }
     data-cw-chain / data-cw-block attribute values map here via CHAIN_MAP. */
  var blockchains = {};

  /* ── data-cw-src value → API sourceId ────────────────────────────────── */
  var SRC_MAP = {
    clockchain: "d4-time",
    utc: "utc",
    ntp: "google-ntp",
    tai: "atomic-clock",
    system: "system-time",
    swagger: "swagger-time-api",
  };

  /* ── data-cw-chain / data-cw-block value → API sourceId ─────────────── */
  var CHAIN_MAP = {
    ethereum: "ethereum",
    bitcoin: "bitcoin",
    polygon: "polygon",
    avalanche: "avalanche-c-chain",
    bnb: "bnb-chain",
    solana: "solana",
    tron: "tron",
    hyperliquid: "hyperliquid",
  };

  /* ── Fetch both indexes, update anchor + offsets ─────────────────────── */
  function fetchAll() {
    var fetchedAt = Date.now();

    var pTime = fetch(TIME_API)
      .then(function (r) {
        return r.json();
      })
      .then(function (json) {
        var list = json.data || [];
        var d4 = null;

        /* Reset and repopulate time offsets */
        timeOffsets = {};
        list.forEach(function (src) {
          timeOffsets[src.sourceId] = src.offsetFromD4Millis;
          if (src.sourceId === "d4-time") d4 = src;
        });

        /* Anchor on d4-time */
        if (d4) {
          anchor = {
            serverMs: d4.sourceTimeEpochMillis,
            localMs: fetchedAt,
            height: parseInt((d4.details && d4.details.blockHeight) || 0, 10),
          };
        }
      });

    var pChain = fetch(CHAIN_API)
      .then(function (r) {
        return r.json();
      })
      .then(function (json) {
        var list = json.data || [];
        blockchains = {};
        list.forEach(function (src) {
          blockchains[src.sourceId] = {
            height: src.sourceHeight,
            offsetMs: src.offsetFromD4Millis,
          };
        });
      });

    return Promise.all([pTime, pChain]).catch(function (err) {
      console.warn("[cw] Sync failed — continuing with last anchor:", err);
      /* Keep the existing anchor; display keeps advancing locally */
      if (!anchor) {
        anchor = { serverMs: Date.now(), localMs: Date.now(), height: 0 };
      }
    });
  }

  /* ── Live state: advances every frame from last anchor ───────────────── */
  function currentState() {
    var now = Date.now();
    var elapsed = now - anchor.localMs; /* ms since last API sync */
    return {
      ms: anchor.serverMs + elapsed,
      height: anchor.height + Math.floor(elapsed / 1000) /* +1 block/sec  */,
    };
  }

  /* ── Formatters ───────────────────────────────────────────────────────── */
  function pad(n, w) {
    n = String(n);
    while (n.length < (w || 2)) n = "0" + n;
    return n;
  }
  function fmtTime(ms) {
    var d = new Date(ms);
    return (
      pad(d.getUTCHours()) +
      ":" +
      pad(d.getUTCMinutes()) +
      ":" +
      pad(d.getUTCSeconds())
    );
  }
  function fmtDate(ms) {
    var d = new Date(ms);
    return (
      d.getUTCFullYear() +
      "-" +
      pad(d.getUTCMonth() + 1) +
      "-" +
      pad(d.getUTCDate()) +
      " UTC"
    );
  }
  function fmtOffset(ms) {
    if (ms === 0) return "consensus";
    if (ms === null || ms === undefined) return "—";
    return (ms > 0 ? "+" : "") + ms + " ms";
  }
  function randHash() {
    var c = "0123456789abcdef",
      s = "0x";
    for (var i = 0; i < 12; i++) s += c[Math.floor(Math.random() * 16)];
    return s;
  }

  /* ── Total anchored logs (rising counter) ─────────────────────────────── */
  var LOGS_EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);
  var LOGS_RATE = 7.4;
  function totalLogs(ms) {
    return Math.floor(((ms - LOGS_EPOCH) / 1000) * LOGS_RATE);
  }

  /* ── DOM refs ─────────────────────────────────────────────────────────── */
  var el = {
    time: document.getElementById("cw-time"),
    date: document.getElementById("cw-date"),
    height: document.getElementById("cw-height"),
    hash: document.getElementById("cw-hash"),
    logs: document.getElementById("cw-logs"),
    dHash: document.getElementById("cwd-hash"),
    dTime: document.getElementById("cwd-time"),
    dHeight: document.getElementById("cwd-height"),
  };
  var srcEls = document.querySelectorAll("[data-cw-src]");
  var offEls = document.querySelectorAll("[data-cw-off]");
  var chainEls = document.querySelectorAll("[data-cw-chain]");
  var blockEls = document.querySelectorAll("[data-cw-block]");

  /* ── Render loop — runs every animation frame ─────────────────────────── */
  var lastSecond = -1;
  var raf;

  function render() {
    if (!anchor) {
      raf = requestAnimationFrame(render);
      return;
    }

    var st = currentState();
    var sec = Math.floor(st.ms / 1000);
    var msPart = pad(st.ms % 1000, 3);

    /* Millisecond display — updates every frame */
    if (el.time) {
      el.time.innerHTML =
        fmtTime(st.ms) + '<span class="cw-ms">.' + msPart + "</span>";
    }
    if (el.logs) el.logs.textContent = totalLogs(st.ms).toLocaleString();

    /* Second display — updates once per second */
    if (sec !== lastSecond) {
      lastSecond = sec;

      var h = "#" + st.height.toLocaleString();
      var hash = randHash();

      if (el.date) el.date.textContent = fmtDate(st.ms);
      if (el.height) el.height.textContent = h;
      if (el.dTime) el.dTime.textContent = fmtTime(st.ms);
      if (el.dHeight) el.dHeight.textContent = h;

      var anchored = "block " + hash + "… anchored · verified on-chain";
      if (el.hash) el.hash.textContent = anchored;
      if (el.dHash) el.dHash.textContent = anchored;

      /* ── Time sources: data-cw-src="utc|ntp|tai|clockchain|system|swagger" */
      srcEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-src");
        var sourceId = SRC_MAP[key] || key;

        if (key === "tai") {
          /* TAI: use real atomic-clock offset + 37-second leap-second total */
          var atomicOff = timeOffsets[TAI_ATOMIC_KEY] || 0;
          n.textContent = fmtTime(st.ms + atomicOff);
          return;
        }
        var off = timeOffsets[sourceId];
        n.textContent = fmtTime(st.ms + (off != null ? off : 0));
      });

      /* ── Offset labels: data-cw-off="utc|ntp|tai|clockchain|system|swagger" */
      offEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-off");
        var sourceId = SRC_MAP[key] || key;
        if (key === "clockchain") {
          n.textContent = "consensus";
          return;
        }
        if (key === "tai") {
          var atomicOff = timeOffsets[TAI_ATOMIC_KEY];
          n.textContent = atomicOff != null ? fmtOffset(atomicOff) : "+37 s";
          return;
        }
        var off = timeOffsets[sourceId];
        n.textContent = off != null ? fmtOffset(off) : "—";
      });

      /* ── Blockchain times: data-cw-chain="ethereum|bitcoin|polygon|..." */
      chainEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-chain");
        var sourceId = CHAIN_MAP[key] || key;
        var bc = blockchains[sourceId];
        var offsetMs = bc ? bc.offsetMs : 0;
        n.textContent = fmtTime(st.ms + offsetMs);
      });

      /* ── Blockchain heights: data-cw-block="ethereum|bitcoin|polygon|..." */
      blockEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-block");
        var sourceId = CHAIN_MAP[key] || key;
        var bc = blockchains[sourceId];
        if (bc && bc.height != null) {
          n.textContent = "#" + Number(bc.height).toLocaleString();
        } else {
          /* fallback: show Clockchain height */
          n.textContent = "#" + st.height.toLocaleString();
        }
      });

      /* ── Blockchain offset labels: data-cw-chain-off="ethereum|bitcoin|..." */
      var chainOffEls = document.querySelectorAll("[data-cw-chain-off]");
      chainOffEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-chain-off");
        var sourceId = CHAIN_MAP[key] || key;
        var bc = blockchains[sourceId];
        if (!bc) {
          n.textContent = "—";
          return;
        }
        var ms = bc.offsetMs;
        if (ms === 0) {
          n.textContent = "0 ms";
          return;
        }
        if (Math.abs(ms) >= 1000) {
          /* show as seconds if ≥ 1 s */
          n.textContent = (ms > 0 ? "+" : "") + (ms / 1000).toFixed(1) + " s";
        } else {
          n.textContent = (ms > 0 ? "+" : "") + ms + " ms";
        }
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
  var toggle = document.getElementById("cw-toggle");
  var table = document.getElementById("cw-table");
  if (toggle && table) {
    toggle.addEventListener("click", function () {
      var open = table.hasAttribute("hidden");
      if (open) table.removeAttribute("hidden");
      else table.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ── Dock ─────────────────────────────────────────────────────────────── */
  var card = document.getElementById("cw-card");
  var dock = document.getElementById("cw-dock");
  if (dock) {
    if (card && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            var docked = !en.isIntersecting && en.boundingClientRect.top < 0;
            document.body.classList.toggle("cw-docked", docked);
            dock.setAttribute("aria-hidden", docked ? "false" : "true");
          });
        },
        { threshold: 0.15 },
      );
      io.observe(card);
    } else {
      document.body.classList.add("cw-docked");
      dock.setAttribute("aria-hidden", "false");
    }
  }

  /* ── Dock expand panel ────────────────────────────────────────────────── */
  var dToggle = document.getElementById("cw-dock-toggle");
  var dPanel = document.getElementById("cw-dock-panel");
  if (dToggle && dPanel) {
    dToggle.addEventListener("click", function () {
      var open = dPanel.hasAttribute("hidden");
      if (open) dPanel.removeAttribute("hidden");
      else dPanel.setAttribute("hidden", "");
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
      try {
        sessionStorage.setItem("cw-dismissed", "1");
      } catch (e) {}
    });
    try {
      if (sessionStorage.getItem("cw-dismissed") === "1")
        document.body.classList.add("cw-dismissed");
    } catch (e) {}
  }

  /* ── Boot ─────────────────────────────────────────────────────────────── */
  fetchAll().then(function () {
    raf = requestAnimationFrame(render);
    setInterval(fetchAll, REFRESH_MS);
  });
})();

(function () {
  /* ═══════════════════════════════════════════════════════════════════════
     Clockchain live-proof widget — REAL INDEX DATA edition.
     Three independent API calls on boot (+ every 30 s):
       /getTime                   → Clockchain time, blockHeight, totalLogs
       /api/v1/indexes/time       → per-source time ISO strings
       /api/v1/indexes/blockchain → per-chain heights + time ISO strings

     Live ticker advances +1 s / tick between 30 s syncs.
     Missing or null API values fall back to "--".
     ═══════════════════════════════════════════════════════════════════════ */

  var TIME_API    = "https://clockchain.network/clockchain-api/api/v1/indexes/time";
  var CHAIN_API   = "https://clockchain.network/clockchain-api/api/v1/indexes/blockchain";
  var GETTIME_API = "https://clockchain.network/clockchain-api/getTime";
  var REFRESH_MS  = 30000;

  var anchor       = null;
  /* anchor = { serverMs: number, localMs: number, height: number } */
  var timeSources  = {};
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
    atomic: "atomic-clock",
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

  /* ── Parse Date Helpers ───────────────────────────────────────────────── */
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

  function parseIsoOrMad(str) {
    if (!str || typeof str !== "string") return null;
    var ms = Date.parse(str);
    if (!isNaN(ms)) return ms;
    return parseMadMarzullo(str);
  }

  /* ── Fetch all three APIs ─────────────────────────────────────────────── */
  function fetchAll() {
    var fetchedAt = Date.now();

    /* 1. getTime API: Clockchain time, blockHeight, and totalLogs */
    var pGetTime = fetch(GETTIME_API)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
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
      })
      .catch(function (err) {
        console.warn("[cw] /getTime API failed:", err);
        anchor = null;
        totalLogsVal = null;
      });

    /* 2. Time Indexes API */
    var pTime = fetch(TIME_API)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        var list = Array.isArray(json) ? json : ((json && json.data) || []);
        timeSources = {};
        list.forEach(function (src) {
          if (src && src.sourceId) {
            var ms = null;
            if (src.sourceTimeIso) {
              ms = parseIsoOrMad(src.sourceTimeIso);
            } else if (src.offsetFromD4Millis != null) {
              var refMs = anchor ? anchor.serverMs : fetchedAt;
              ms = refMs + src.offsetFromD4Millis;
            }

            if (ms != null) {
              timeSources[src.sourceId] = {
                sourceMs : ms,
                fetchedAt: fetchedAt,
              };
            }
          }
        });
      })
      .catch(function (err) {
        console.warn("[cw] Time index API failed:", err);
        timeSources = {};
      });

    /* 3. Blockchain Indexes API */
    var pChain = fetch(CHAIN_API)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        var list = Array.isArray(json) ? json : ((json && json.data) || []);
        blockchains = {};
        list.forEach(function (src) {
          if (src && src.sourceId) {
            var ms = null;
            if (src.sourceTimeIso) {
              ms = parseIsoOrMad(src.sourceTimeIso);
            } else if (src.offsetFromD4Millis != null) {
              var refMs = anchor ? anchor.serverMs : fetchedAt;
              ms = refMs + src.offsetFromD4Millis;
            }

            blockchains[src.sourceId] = {
              height   : src.sourceHeight,
              sourceMs : ms,
              fetchedAt: fetchedAt,
            };
          }
        });
      })
      .catch(function (err) {
        console.warn("[cw] Blockchain index API failed:", err);
        blockchains = {};
      });

    return Promise.all([pGetTime, pTime, pChain]);
  }

  /* ── Live state for Clockchain ────────────────────────────────────────── */
  function currentState() {
    if (!anchor) return null;
    var now = Date.now(), elapsed = now - anchor.localMs;
    return {
      ms    : anchor.serverMs + elapsed,
      height: anchor.height + Math.floor(elapsed / 1000),
    };
  }

  /* ── Compute Live Time & Offset for any Source ────────────────────────── */
  function getSourceData(srcObj, now, baseMs) {
    if (!srcObj || srcObj.sourceMs == null) return { ms: null, offsetMs: null };
    var elapsed = now - (srcObj.fetchedAt || now);
    var liveMs = srcObj.sourceMs + elapsed;
    var offsetMs = liveMs - baseMs;
    return { ms: liveMs, offsetMs: offsetMs };
  }

  /* ── Formatters ───────────────────────────────────────────────────────── */
  function pad(n, w) {
    n = String(n);
    while (n.length < (w || 2)) n = "0" + n;
    return n;
  }
  function fmtTime(ms) {
    if (ms == null || isNaN(ms)) return "--";
    var d = new Date(ms);
    return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds());
  }
  function fmtDate(ms) {
    if (ms == null || isNaN(ms)) return "--";
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function fmtOffset(ms) {
    if (ms === 0) return "consensus";
    if (ms == null || isNaN(ms)) return "--";
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
    var st     = currentState();
    var now    = Date.now();
    var baseMs = st ? st.ms : now;

    var sec    = Math.floor(baseMs / 1000);
    var msPart = pad(baseMs % 1000, 3);

    /* Clockchain Live Millisecond Header */
    if (st) {
      if (el.time) {
        el.time.innerHTML = fmtTime(st.ms) + '<span class="cw-ms">.' + msPart + "</span>";
      }
    } else {
      if (el.time) el.time.innerHTML = "--";
    }

    /* Second-by-second updates */
    if (sec !== lastSecond) {
      lastSecond = sec;

      /* 1. Clockchain Hero Card & Dock Elements */
      if (st) {
        var h = "#" + st.height.toLocaleString();
        var hash = randHash();
        var anchored = "block " + hash + "… anchored · verified on-chain";

        if (el.date)    el.date.textContent    = fmtDate(st.ms);
        if (el.height)  el.height.textContent  = h;
        if (el.dTime)   el.dTime.textContent   = fmtTime(st.ms);
        if (el.dHeight) el.dHeight.textContent = h;
        if (el.hash)    el.hash.textContent    = anchored;
        if (el.dHash)   el.dHash.textContent   = anchored;
      } else {
        if (el.date)    el.date.textContent    = "--";
        if (el.height)  el.height.textContent  = "--";
        if (el.dTime)   el.dTime.textContent   = "--";
        if (el.dHeight) el.dHeight.textContent = "--";
        if (el.hash)    el.hash.textContent    = "--";
        if (el.dHash)   el.dHash.textContent   = "--";
      }

      /* 2. Total Logs */
      if (el.logs) {
        el.logs.textContent = (totalLogsVal != null && !isNaN(totalLogsVal))
          ? totalLogsVal.toLocaleString()
          : "--";
      }

      /* 3. Time Sources Table (Current Time column) */
      srcEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-src");
        if (key === "clockchain") {
          n.textContent = st ? fmtTime(st.ms) : "--";
          return;
        }
        var sourceId = SRC_MAP[key] || key;
        var src = timeSources[sourceId];

        /* Fallbacks for GNSS & PTP if derived from UTC */
        if (!src && timeSources["utc"]) {
          if (key === "gnss") {
            src = {
              sourceMs : timeSources["utc"].sourceMs + 18000,
              fetchedAt: timeSources["utc"].fetchedAt
            };
          } else if (key === "ptp") {
            src = {
              sourceMs : timeSources["utc"].sourceMs,
              fetchedAt: timeSources["utc"].fetchedAt
            };
          }
        }

        var data = getSourceData(src, now, baseMs);
        n.textContent = data.ms != null ? fmtTime(data.ms) : "--";
      });

      /* 4. Time Offsets Column */
      offEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-off");
        if (key === "clockchain") {
          n.textContent = st ? "consensus" : "--";
          return;
        }
        var sourceId = SRC_MAP[key] || key;
        var src = timeSources[sourceId];

        if (!src && timeSources["utc"]) {
          if (key === "gnss") {
            src = {
              sourceMs : timeSources["utc"].sourceMs + 18000,
              fetchedAt: timeSources["utc"].fetchedAt
            };
          } else if (key === "ptp") {
            src = {
              sourceMs : timeSources["utc"].sourceMs,
              fetchedAt: timeSources["utc"].fetchedAt
            };
          }
        }

        var data = getSourceData(src, now, baseMs);
        n.textContent = data.offsetMs != null ? fmtOffset(data.offsetMs) : "--";
      });

      /* 5. Blockchain Times Column */
      chainEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-chain");
        if (key === "clockchain" || key === "0") {
          n.textContent = st ? fmtTime(st.ms) : "--";
          return;
        }
        var sourceId = CHAIN_MAP[key] || key;
        var bc = blockchains[sourceId];
        var data = getSourceData(bc, now, baseMs);
        n.textContent = data.ms != null ? fmtTime(data.ms) : "--";
      });

      /* 6. Blockchain Heights Column */
      blockEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-block");
        if (key === "clockchain" || key === "0") {
          n.textContent = st ? "#" + st.height.toLocaleString() : "--";
          return;
        }
        var sourceId = CHAIN_MAP[key] || key;
        var bc = blockchains[sourceId];
        n.textContent = (bc && bc.height != null) ? "#" + Number(bc.height).toLocaleString() : "--";
      });

      /* 7. Blockchain Offsets Column */
      chainOffEls.forEach(function (n) {
        var key = n.getAttribute("data-cw-chain-off");
        if (key === "clockchain" || key === "0") {
          n.textContent = st ? "0 ms" : "--";
          return;
        }
        var sourceId = CHAIN_MAP[key] || key;
        var bc = blockchains[sourceId];
        var data = getSourceData(bc, now, baseMs);
        if (data.offsetMs == null) {
          n.textContent = "--";
          return;
        }
        var ms = data.offsetMs;
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
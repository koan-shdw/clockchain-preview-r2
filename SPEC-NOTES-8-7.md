# Spec — Website Notes 8/7 + Dashboard Split

Date: 2026-08-11. Target: `clockchain-preview-r2` (live at koan-shdw.github.io/clockchain-preview-r2), base `cd22522`.
Status: AWAITING APPROVAL. Build only after approval.

## Scope split

| Item | Where it lives | Action |
|---|---|---|
| 1 Nav API → API/MCP | this repo | build |
| 2 Time comparison box | this repo | build |
| 3 Patent title | this repo | **already correct — no change** |
| 4 Contact forms | FormSubmit / backend | **note only** |
| 5 D4D Token / D4DT → $CCTT | live portal | **forward to Satish** |
| 6 Service menu titles | live portal | **forward to Satish** |
| 7 "twites" → "tweets" | live portal | **forward to Satish** |
| 8 Token Management button centering | live portal | **forward to Satish** |
| 9 Docs: Why Chronology Matters | this repo | build |
| 10 Docs: Verifiable Time for Regulatory Compliance | this repo | build |
| Dashboard | new repo | build (split only, no feature work) |

Items 5–8: none of those strings exist anywhere in this repo (checked sitewide, including the app mock). They are on the live portal (services/dev.clockchain.network) — Satish's codebase. "D4D Sàrl" company mentions in legal pages are NOT token mentions and stay untouched.

Item 4: FormSubmit was never activated (activation email sits in Jon's inbox). No fix needed — backend team is rebuilding contact for live.

---

## Item 1 — Header "API" → "API/MCP"

- `components.js:25` desktop nav label `API` → `API/MCP`
- `components.js:42` mobile menu label `API` → `API/MCP`
- Links unchanged (`dev.clockchain.network/service/docs`).
- Footer has no API link; unchanged.

## Cleanup (found while reading, riding along)

`newsroom.html:45-59` and `industry-solutions.html:33-47` still carry hardcoded `#mobile-menu` blocks from before the components.js merge. They duplicate the injected menu's id and resurrect dropped links (Community / Discord). Delete both blocks; components.js provides the real menu.

## Item 2 — Time comparison box (index.html, compare box A)

Keep: LIVE badge, live "Current time" column, row highlight on Clockchain.
Header row: last column renamed `Independently verifiable` → `Independent verifiable record`.

New rows (order fixed):

| Source | Time source | Record |
|---|---|---|
| Clockchain | Distributed Consensus | Yes |
| UTC | BIPM / International Atomic Clock Network | No |
| GNSS / GPS | Satellite Atomic Clocks | No |
| NTP | Network Time Servers | No |
| PTP | Grandmaster / Network Clock | No |
| System Time | Local Host Clock | No |
| Swagger Time API | API Server | No |

Diff vs current: TAI row removed; GNSS/GPS + PTP rows added (7 rows total, was 6); `Google NTP` → `NTP`; descriptors per table.

`widget.js`:
- `SRC_MAP`: drop `tai`, add `gnss: "gnss-gps"`, `ptp: "ptp"` — if the backend later publishes those sourceIds, rows go fully live automatically.
- Until then, client fallbacks so the rows don't mirror consensus time: GNSS/GPS = UTC + 18 s (GPS–UTC leap-second offset), PTP = UTC (grandmaster-aligned, sub-ms at this display precision).
- Remove the two `tai` special cases (`widget.js:154,162`) and `TAI_ATOMIC_KEY`.

Heads-up (not in scope, for Satish): `widget.js` now fetches `http://dev.clockchain.network:8001` — blocked as mixed content from the https Pages site, so live values fall back to local time until the endpoint gets https.

## Item 3 — Patent title

`about.html:137` already reads "Method for distributed and secure timekeeping" — exactly the notes' target (the note was written against the old live site). No change.

## Items 9 + 10 — Docs page, two new sections

`docs.html` accordion, new order:

- 01 Overview
- 02 Product Briefs
- 03 Industry Solutions
- 04 Developer docs & API
- **05 Verifiable Time for Regulatory Compliance (new)**
- **06 Why Chronology Matters (new)**
- 07 The Future of Time (renumbered from 05)

Both new sections mirror the Future of Time pattern: one teaser line + PDF link row.

- 05 teaser: "Strengthening auditability, traceability and trust in digital records." → `assets/docs/verifiable-time-for-regulatory-compliance.pdf`
- 06 teaser: "An executive briefing on defensible evidence of time." → `assets/docs/why-chronology-matters.pdf`

PDFs copied from Desktop into `assets/docs/`. Teasers are the docs' own subtitles, not invented copy.

---

## Dashboard split — new repo `clockchain-dashboard`

- New public repo `koan-shdw/clockchain-dashboard`, GitHub Pages on `main`.
- Seed: copy of `app/` (all 12 files: dashboard, logging, contracts, timestamp, benchmarking, account, login, app.css, app.js, docs/index, docs/timestamp-api, docs/mcp) at repo root, plus the two assets they reference (`favicon-32.png`, `clockchain-logo-full.png`) into `assets/`.
- Path fixes only: `../assets/…` → `assets/…`; sidebar logo link `../index.html` → absolute URL of the r2 preview site. No feature changes.
- Root `index.html` = redirect to `dashboard.html`.
- `DASHBOARD-NOTES.md` in the repo root holding the six dashboard note items verbatim (connections section with API gen/revoke cards + MCP section; "Clockchain Time" / "Clockchain Block Height" titles top right; drop "API" from "Timestamp API"; Live Benchmarking → "Network Status"; rethink opening dashboard info with Jeff; light mode). Work starts after this round, in that repo.
- `app/` in the site repo stays untouched (site links point into it; Satish is actively committing there).
- URL: https://koan-shdw.github.io/clockchain-dashboard/

## Deploy

1. One commit to r2: items 1, 2, 9, 10 + stale-menu cleanup + this spec.
2. New dashboard repo: seed commit + Pages enable.
3. Verify both live in browser, report.

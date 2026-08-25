# SPEC — Final main-site round (Jon's notes 8/25)

**Status: APPROVED (GO 2026-08-25) — building.**
Source: Jon's 7-item list (chat, 2026-08-25) + `Desktop\Clockchain_FAQ.pdf` (4 pages, 28 Q&As).
Repo: clockchain-preview-r2 `main`. After this round, focus moves to the dashboard repo.

## Decisions (Alex, 2026-08-25)

- **D1** — Hero eyebrow "anchoring time on-chain every second": **LEAVE.**
- **D2** — docs.html:87 "anchors a synchronized timestamp on-chain every second": **LEAVE.** Item 3 touches only the specific line Jon quoted, nothing buried in other paragraphs.
- **D3** — Middle news card (press release PDF, no artwork): **use `assets/media/hipther.png`** (blockchain-blocks artwork from an article about the same launch).

---

## Item 1 — Delete "UTC" from the live box

The homepage hero live card (`#cw-card`) shows the date line as `2026-08-25 UTC`.
- `index.html:76` — placeholder `<div class="cw-date" id="cw-date">— UTC</div>` → `—`
- `widget.js:112` — date formatter drops the `+ " UTC"` suffix.
- The UTC **row in the compare table** (index.html:125) is untouched — Jon's item names the live box only.

## Item 2 — Hero headline

- `index.html:55` — `<span class="hq-em">autonomous systems.</span>` → `the digital world.`
- Nothing else: page `<title>`, metas, and other "autonomous systems" body mentions (about.html:58, about.html:126, docs.html:90) stay — they read as normal copy, not the tagline.

## Item 3 — "anchored on-chain every second" → "anchored to an immutable ledger every second."

**One line only** (Alex narrowed it 2026-08-25): `index.html:60`, the visible bolded homepage intro line Jon quoted.
Deliberately untouched: index.html metas (10/16/22), about.html:32, app/docs/index.html:39, index.html:54 eyebrow, docs.html:87.

## Item 4 — FAQ page + footer link

**New `faq.html`** — copies the docs.html shell exactly (same head block, `#site-nav`/`#site-footer` placeholders, script order components→app→contact, same section/accordion grammar). Content from the PDF, verbatim, 4 collapsible sections in PDF order:
- 01 Understanding Clockchain (5 Q&As)
- 02 How Clockchain Works (8 Q&As)
- 03 Products and Applications (8 Q&As; services list as bullets)
- 04 Trust, Compliance, and Integration (7 Q&As)

Inside a section: question as a bold sub-heading, answer as paragraph(s), exactly as docs.html formats its body text. Page title "FAQ · Clockchain"; meta description from the PDF's intro line.

**Footer** — `components.js` Resources column gains `<li><a href="faq.html">FAQ</a></li>` after Blog. Footer is shared, so the link appears on all pages (approved by Alex).

## Item 5 — Thumbs on the homepage news cards

The three `.nt-card`s in `#news` (index.html:375-400) each get a thumb div as first child, copying the newsroom `.media-thumb` grammar:
- New `.nt-thumb` CSS in styles.css next to the nt-card rules: 16:9, border-radius, `img{object-fit:cover}`, same `contain`/panel variants available.
- Card 1 (Blog → brief-history-of-time) → `assets/blog/atomic-clock-1949.jpg` (that post's lead image), alt text copied from the post.
- Card 2 (Press release → testnet) → **D3** proposal `assets/media/hipther.png`.
- Card 3 (Media → Blockzeit) → `assets/media/blockzeit.png`, alt from newsroom.

## Item 6 — Remove patent section

- `about.html:131-142` — delete the whole `<details class="about-acc" id="patent">` block.
- `about.html:7` — meta description drops the trailing "Patent US 12,022,015."
- `components.js` Company column — delete `<li><a href="about.html#patent">Patent · US 12,022,015</a></li>`.
- Left alone on purpose: "patented technology" body mentions (about.html:107, docs.html:87), newsroom patent press items and media cards, app.js press-modal data. Jon asked for the section and footer link only.

## Item 7 — Breadcrumbs, every page except home

Injected by `components.js` right after the nav, so one implementation covers all pages that use the shared shell:
- On any page whose filename isn't index.html (or empty), inject
  `<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> <span>/</span> <span aria-current="page">{label}</span></nav>` as the first element of `<main>`.
- Label map: about→About · services→Services · docs→Docs · newsroom→Newsroom · industry-solutions→Industry Solutions · faq→FAQ · privacy→Privacy Policy · terms→Terms of Use · cookie→Cookie Policy. Unknown filename → prettified filename, so future pages get crumbs for free.
- New `.crumbs` CSS in styles.css: 12px, `--fg-3`, sits in the page's existing top padding (absolute, below the 58px nav, aligned to the container edge); inherits the eclipse light-on-dark treatment the nav links use.
- Excluded: homepage, `blog/*` and `app/*` (hardcoded shells, Satish's zone).

## Cache bumps

- styles.css → v5 (items 5, 7)
- components.js → v3 (items 4, 6, 7)
- widget.js → v5 (item 1)
- site.css, app.js — untouched, stay v17 / v3
- All 9 pages get the bumped refs; faq.html ships with them from birth.

## Verify

Preview server: desktop 1335 + phone 320/375 (Ken's Display Zoom sizes). Check: live box date line, new H1, footer FAQ link, FAQ page sections open/close, thumbs on all 3 cards, patent gone from about + footer, crumbs on all 9 subpages, none on home. Then push, confirm the new files serve live.

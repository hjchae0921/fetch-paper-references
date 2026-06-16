---
name: fetch-paper-references
description: Read a paper's markdown (.md), pick the references essential to understanding it, then fetch those reference PDFs from Google Scholar via Playwright MCP. Use when asked to gather, download, collect, or fetch the references / citations / 레퍼런스 of a paper, or to find the source PDFs a paper builds on.
---

# fetch-paper-references

Given a paper exported to markdown (e.g. `*.md` next to its `*.pdf` and
`*.images/` folder in this workspace), this skill: reads the paper, selects the
**references you can't understand the paper without**, and downloads those
reference PDFs from Google Scholar.

The "app" being driven is **Google Scholar through Playwright MCP** (the
off-the-shelf browser driver). The two committed scripts are the reusable parts:
- `extract-results.js` — the page-scraping function fed to `browser_evaluate`.
- `fetch-pdf.mjs` — a downloader that keeps a file **only if it is a real PDF**.

Paths below are relative to the workspace root (the folder holding the `.md`).
The skill's own files live at `.claude/skills/fetch-paper-references/`.

## Prerequisites

- **Node.js** (v18+; tested on v24). `fetch-pdf.mjs` uses the built-in `fetch`
  and `node:fs` — no `npm install`.
- **Playwright MCP** server connected (the `mcp__playwright__browser_*` tools).
  Already configured in this workspace.

## Run (agent path)

### 1. Read the paper and select essential references

This is a **judgement based on the whole body, not the bibliography — and not
the Related-Work section — alone.** The `## References` list only gives
titles/authors/years (enough to guess by fame or topic); "Related work" tells
you the lineage but **not** which works a *derivation* or *experiment* actually
leans on. Those load-bearing citations live in the **Method and Experiments**
sections. Follow this procedure so you don't miss them:

1. **Enumerate every section** so you know what you must cover — don't assume the
   structure:
   ```bash
   grep -nE '^#{1,4} ' "<paper>.md"
   ```
2. **Read every citation-bearing section, not just the intro.** At minimum:
   Introduction, Related work, **Method/Algorithm**, **Experiments/Results**, and
   skim the Appendix for derivation citations. The classic failure (see Gotchas)
   is selecting from Related-Work only and missing the foundational works cited
   in the Method.
3. **Locate where each candidate is actually used.** Grep the body (everything
   *before* the `## References` heading) for an author surname to see how many
   times and in what context it's cited:
   ```bash
   grep -nE '\(<Surname>[, ]|<Surname> et al' "<paper>.md"
   ```
   A work cited inside an equation/derivation or as an experimental baseline is
   load-bearing; one name-dropped once in passing usually isn't.
4. **Cross-reference** the chosen surnames against the `## References` entries to
   get exact titles + years for searching.

Be selective: 5–12 references (more only if the method genuinely rests on a wide
base), not the whole list. Skip textbooks, framework/tooling citations (Theano,
Blocks), and pure dataset citations (MNIST, CIFAR) unless central to the method.

### 2. For each selected reference, search Google Scholar

Build a query from author + title + year and navigate with Playwright MCP:

```
mcp__playwright__browser_navigate
  url: https://scholar.google.com/scholar?q=Generative+Adversarial+Nets+Goodfellow+2014
```

Then extract the top results — pass the function from `extract-results.js` to:

```
mcp__playwright__browser_evaluate
  function: (paste the arrow function from
            .claude/skills/fetch-paper-references/extract-results.js)
```

It returns JSON like:

```json
[
  {
    "title": "Generative adversarial nets",
    "link": "https://proceedings.neurips.cc/paper/2014/hash/....html",
    "pdf": "https://proceedings.neurips.cc/paper_files/paper/2014/file/....-Paper.pdf"
  }
]
```

### 3. Download — but only if it's a real PDF

A non-null `pdf` is a **candidate**, not a guarantee. Pipe it through the
verified downloader, which checks the `%PDF` magic bytes and refuses HTML
paywall pages:

```bash
node .claude/skills/fetch-paper-references/fetch-pdf.mjs \
  "https://proceedings.neurips.cc/paper_files/paper/2014/file/f033ed80deb0234979a61f95710dbe25-Paper.pdf" \
  "references/Goodfellow2014_GenerativeAdversarialNets.pdf"
# OK: references/Goodfellow2014_GenerativeAdversarialNets.pdf (539761 bytes)   exit 0
```

- **exit 0** → real PDF saved under `references/`.
- **exit 2** → not a PDF (paywall/HTML) or HTTP error. **Skip this reference and
  move on — do not force it.** Don't hunt for alternate sources unless the user
  asks.

Name files `<FirstAuthor><Year>_<ShortTitle>.pdf` so they map back to the
bibliography.

### 4. Report

Tell the user which references were saved and which were skipped (and why —
"paywalled", "no PDF on Scholar"). Don't claim a reference was fetched unless
`fetch-pdf.mjs` returned exit 0.

## Verifying the harness yourself (smoke test)

These two commands were the actual end-to-end test (one success, one expected
skip):

```bash
# real PDF -> exit 0
node .claude/skills/fetch-paper-references/fetch-pdf.mjs \
  "https://proceedings.neurips.cc/paper_files/paper/2014/file/f033ed80deb0234979a61f95710dbe25-Paper.pdf" \
  "/tmp/gan_test.pdf"

# paywalled JSTOR "[PDF]" link -> exit 2, skipped
node .claude/skills/fetch-paper-references/fetch-pdf.mjs \
  "https://www.jstor.org/stable/pdf/2987782.pdf" "/tmp/jstor_test.pdf"
```

## Gotchas

- **Don't select references from the Related-Work section alone.** It's the
  tempting shortcut — that section conveniently discusses other papers — but the
  works a paper's *math* depends on are cited in the **Method**, and its
  baselines in the **Experiments**. Real example (this very paper, *Nonequilibrium
  Thermodynamics*): reading only §1.2 surfaced the ML lineage (VAE, GAN, GSN) but
  missed the physics foundation cited in §2 — Jarzynski 1997 (§2.3), Spinney &
  Ford 2013 and Jarzynski 2011 (§2.3, §2.4.1), Grosse 2013 (§2.4.1) — which is
  the actual core of the method. Always run the §1 step-1 procedure over **every**
  citation-bearing section.
- **arXiv is the fallback for "essential but paywalled".** Old physics/stats
  papers (Jarzynski 1997 on APS → 403; Neal 2001 AIS on Springer → HTML stub) are
  usually also on arXiv (`cond-mat/9707325`, `physics/9803008`). If a *load-
  bearing* reference is skipped by the publisher host, retry `https://arxiv.org/
  pdf/<id>` before giving up. "Don't force it" applies to incidental refs, not the
  ones the method rests on.
- **Scholar's `[PDF]` label lies.** The right-column link can point at JSTOR /
  Springer / IEEE, which return an ~11 KB HTML login page, not a PDF. The magic-
  byte check in `fetch-pdf.mjs` is the whole reason it exists — trust exit code,
  not the label.
- **`browser_evaluate` is the reliable extractor**, not the accessibility
  snapshot. Scholar's PDF links live in `.gs_or_ggsm a`; the title/landing link
  is `.gs_rt a`. Selectors are in `extract-results.js`.
- **Download with a browser User-Agent.** `fetch-pdf.mjs` sends a Chrome UA;
  some hosts (incl. neurips) 403 a default Node/curl agent.
- **Don't log into Scholar or solve CAPTCHAs.** Light, spaced-out querying
  worked without a CAPTCHA in this session. If Scholar starts challenging you,
  stop and tell the user rather than automating around it.
- **Old / non-CS references (pre-2000 stats & physics, e.g. Feller 1949,
  Langevin 1908, Besag 1975) usually have no free PDF.** Expect to skip these;
  that's normal, not a failure.
- **A `[PDF]` link is no guarantee even when the host looks open.** Springer
  `content/pdf/...` and APS `link.aps.org/pdf/...` returned an HTML stub / `403`
  in practice — `fetch-pdf.mjs` skipped them correctly. The publisher landing
  page (`.gs_rt a` link) being open-access (PLOS, JMLR, PMLR) is a better signal.
- **The downloader sets `process.exitCode` instead of calling
  `process.exit()`.** On Windows, `process.exit()` while a fetch socket is still
  closing aborts with a libuv assertion (`UV_HANDLE_CLOSING`, exit 127) — which
  would clobber the 0/2 exit code the caller trusts. Don't "simplify" it back.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `fetch-pdf.mjs` prints `SKIP: not a PDF (magic="...")` | Working as intended — the link was HTML/paywall. Skip the reference. |
| `SKIP: HTTP 403` | Host blocks automated download even with a UA. Skip it. |
| `browser_evaluate` returns `[]` | Scholar markup/region differs, or a CAPTCHA/consent page loaded. Take a screenshot (`browser_take_screenshot`) and inspect. |
| Saved PDF won't open | It shouldn't happen (magic verified), but re-run; a truncated download returns the wrong size. |

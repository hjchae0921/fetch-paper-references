# fetch-paper-references

A [Claude Code](https://claude.com/claude-code) skill that reads a research
paper exported to Markdown, selects the references **essential to understanding
it**, and downloads those reference PDFs from Google Scholar via the Playwright
MCP browser.

## What's here

| File | Purpose |
|---|---|
| `SKILL.md` | Agent-facing instructions + frontmatter (the slash command). |
| `extract-results.js` | The page-scraping function fed to Playwright MCP's `browser_evaluate` to pull title / landing link / `[PDF]` link from a Scholar results page. |
| `fetch-pdf.mjs` | A downloader that keeps a file **only if it's a real PDF** (verifies the `%PDF` magic bytes), so paywalled HTML pages masquerading as `[PDF]` links are rejected. |

## Install

Copy this folder into a Claude Code skills directory:

- **Project scope:** `<your-project>/.claude/skills/fetch-paper-references/`
- **Global scope:** `~/.claude/skills/fetch-paper-references/`

Then ask Claude to *"fetch the references of this paper"* with a paper `.md`
in the workspace.

## Requirements

- Node.js v18+ (uses built-in `fetch`; no `npm install`).
- Playwright MCP server connected (`mcp__playwright__browser_*` tools).

## Smoke test

```bash
# real PDF -> exit 0
node fetch-pdf.mjs \
  "https://proceedings.neurips.cc/paper_files/paper/2014/file/f033ed80deb0234979a61f95710dbe25-Paper.pdf" \
  "/tmp/gan_test.pdf"

# paywalled JSTOR "[PDF]" link -> exit 2 (skipped, not a PDF)
node fetch-pdf.mjs "https://www.jstor.org/stable/pdf/2987782.pdf" "/tmp/jstor_test.pdf"
```

See `SKILL.md` for the full agent workflow and gotchas.

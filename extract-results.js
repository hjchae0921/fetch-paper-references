// Extraction function for the fetch-paper-references skill.
//
// Paste the body of this function as the `function` argument to the
// Playwright-MCP `browser_evaluate` tool AFTER navigating to a
// scholar.google.com/scholar?q=... results page. It returns the top
// results with their title, landing-page link, and a direct "[PDF]"
// link when Scholar surfaced one in the right-hand column (.gs_or_ggsm).
//
// A non-null `pdf` is only a CANDIDATE — it may point at a paywalled
// host (JSTOR/Springer/IEEE) that serves HTML. Always pipe it through
// fetch-pdf.mjs, which verifies the %PDF magic bytes before keeping it.

() => {
  const out = [...document.querySelectorAll('.gs_r.gs_or, .gs_ri')].slice(0, 5).map(r => {
    const titleEl = r.querySelector('.gs_rt a');
    const pdfEl = [...r.querySelectorAll('.gs_or_ggsm a')]
      .find(a => /\[PDF\]|\[HTML\]/i.test(a.textContent));
    return {
      title: titleEl ? titleEl.textContent : (r.querySelector('.gs_rt')?.textContent ?? null),
      link: titleEl ? titleEl.href : null,
      pdf: pdfEl ? pdfEl.href : null,
    };
  });
  return JSON.stringify(out, null, 2);
}

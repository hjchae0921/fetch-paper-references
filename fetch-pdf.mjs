#!/usr/bin/env node
// Verified PDF downloader for the fetch-paper-references skill.
//
// Usage:  node fetch-pdf.mjs <url> <out-path>
//
// Downloads <url> to <out-path>, but ONLY keeps the file if it is a real
// PDF (first bytes == "%PDF"). A Google Scholar "[PDF]" link often points
// at a paywalled host (JSTOR, Springer, IEEE) that returns an HTML login
// page instead of the file — this check rejects those so the caller can
// skip the reference instead of saving garbage.
//
// Exit codes:  0 = real PDF saved   2 = not a PDF / HTTP error (skip)   1 = bad args

import { writeFile, unlink } from 'node:fs/promises';

const [, , url, out] = process.argv;
if (!url || !out) {
  console.error('usage: node fetch-pdf.mjs <url> <out-path>');
  process.exit(1);
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

try {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/pdf,*/*' },
    redirect: 'follow',
  });
  if (!res.ok) {
    console.error(`SKIP: HTTP ${res.status} ${res.statusText}`);
    process.exit(2);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const magic = buf.subarray(0, 4).toString('latin1');
  if (magic !== '%PDF') {
    console.error(`SKIP: not a PDF (magic="${magic.replace(/[^\x20-\x7e]/g, '.')}", ${buf.length} bytes) — likely a paywall/HTML page`);
    process.exit(2);
  }
  await writeFile(out, buf);
  console.log(`OK: ${out} (${buf.length} bytes)`);
  process.exit(0);
} catch (e) {
  console.error(`SKIP: ${e.message}`);
  process.exit(2);
}

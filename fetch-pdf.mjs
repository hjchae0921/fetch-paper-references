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
//
// NOTE: we set process.exitCode and return rather than calling process.exit().
// On Windows, calling process.exit() while a fetch socket is still tearing
// down trips a libuv assertion ("UV_HANDLE_CLOSING", abort with code 127),
// which would clobber the real exit code the caller relies on.

import { writeFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function main() {
  const [, , url, out] = process.argv;
  if (!url || !out) {
    console.error('usage: node fetch-pdf.mjs <url> <out-path>');
    process.exitCode = 1;
    return;
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/pdf,*/*' },
      redirect: 'follow',
    });
    if (!res.ok) {
      console.error(`SKIP: HTTP ${res.status} ${res.statusText}`);
      process.exitCode = 2;
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const magic = buf.subarray(0, 4).toString('latin1');
    if (magic !== '%PDF') {
      console.error(`SKIP: not a PDF (magic="${magic.replace(/[^\x20-\x7e]/g, '.')}", ${buf.length} bytes) — likely a paywall/HTML page`);
      process.exitCode = 2;
      return;
    }
    await writeFile(out, buf);
    console.log(`OK: ${out} (${buf.length} bytes)`);
    process.exitCode = 0;
  } catch (e) {
    console.error(`SKIP: ${e.message}`);
    process.exitCode = 2;
  }
}

await main();

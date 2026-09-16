/**
 * Gate runner — runs every verify suite once and prints a compact summary.
 *
 * Written because the suites are Playwright-driven and each takes 20-60s, so a
 * shell loop that greps both PASS and FAIL ran every suite twice and blew the
 * foreground timeout. One run per suite, summary extracted from the same
 * output buffer.
 *
 * Usage: node scripts/run-all-gates.cjs [url]
 */
const { spawnSync } = require('child_process');
const path = require('path');

const URL = process.argv[2] || 'http://127.0.0.1:5199/';

const SUITES = [
  ['verify-port-outline.cjs', 'PORT_OUTLINE_PASS'],
  ['verify-connections.cjs', 'CONNECTIONS_PASS'],
  // These suites print no PASS/FAIL marker line; they exit non-zero on failure
  // and their PASS lines are checked by the passCount/failLines logic below.
  ['verify-undo.cjs', ''],
  ['verify-tags.cjs', 'TAGS_PASS'],
  ['verify-lists.cjs', 'LISTS_PASS'],
  ['verify-nozzles.cjs', 'NOZZLES_PASS'],
  ['verify-datasheets.cjs', 'DATASHEETS_PASS'],
  ['verify-numbering.cjs', 'NUMBERING_PASS'],
  ['verify-freeline.cjs', ''],
  ['verify-bug3.cjs', ''],
  ['verify-export.cjs', 'EXPORT_PASS'],
  ['verify-pdf-vector.cjs', 'PDFVECTOR_PASS'],
  ['verify-linekind.cjs', 'LINEKIND_PASS'],
  ['mutate-connections.cjs', 'CONNECTIONS_MUTATION_PASS'],
  ['mutate-size-reader.cjs', 'SIZE_READER_MUTATION_PASS'],
];

let failed = 0;
const summary = [];

for (const [script, marker] of SUITES) {
  const file = path.join(__dirname, script);
  const started = Date.now();
  const res = spawnSync('node', [file, URL], {
    encoding: 'utf8',
    timeout: 300000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  const passCount = (out.match(/^PASS/gm) || []).length;
  const failLines = (out.match(/^FAIL.*$/gm) || []).slice(0, 6);
  const hasMarker = marker ? out.includes(marker) : true;
  const ok = res.status === 0 && failLines.length === 0 && hasMarker;

  if (!ok) failed++;

  summary.push({ script, ok, passCount, secs, failLines });
  console.log(
    `${ok ? 'OK  ' : 'BAD '} ${script.padEnd(28)} ${String(passCount).padStart(3)} PASS  ${secs}s` +
      (hasMarker ? '' : `  [missing ${marker}]`),
  );
  for (const l of failLines) console.log(`       ${l}`);
  if (res.status !== 0 && !failLines.length) {
    console.log(`       exit=${res.status}`);
    console.log(`       ${out.trim().split('\n').slice(-8).join('\n       ')}`);
  }
}

console.log(`\n${failed === 0 ? 'ALL_GATES_PASS' : `GATES_FAILED: ${failed}`}  (${SUITES.length} suites)`);
process.exit(failed === 0 ? 0 : 1);

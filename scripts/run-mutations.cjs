/** Run just the two mutation suites and show their tails. */
const { spawnSync } = require('child_process');
const path = require('path');
const URL = process.argv[2] || 'http://127.0.0.1:5199/';

for (const s of ['mutate-connections.cjs', 'mutate-size-reader.cjs']) {
  const started = Date.now();
  const r = spawnSync('node', [path.join(__dirname, s), URL], {
    encoding: 'utf8',
    timeout: 400000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const fail = (out.match(/^FAIL.*$/gm) || []).slice(0, 8);
  console.log(`\n===== ${s} ===== exit=${r.status} ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`PASS lines: ${(out.match(/^PASS/gm) || []).length}`);
  for (const l of fail) console.log(`  ${l}`);
  console.log('--- tail ---');
  console.log(out.trim().split('\n').slice(-14).join('\n'));
}

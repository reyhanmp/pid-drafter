const { withFixture, cleanup } = require('./fixture-computed-size.cjs');

/**
 * Mutation test for the port-outline gate's size reader.
 *
 * The gate's defaultsFor() must FAIL LOUDLY when it cannot read a symbol's
 * declared size as a literal, rather than guessing 80x80. Guessing turns a
 * correctly-drawn symbol into a reported geometry defect: the probe divides
 * screen measurements by defaultWidth to get node-local units, so a wrong
 * divisor lands every port "28px off the ink". A gate that reports a defect
 * that does not exist is worse than no gate, because it sends the author to
 * fix geometry that is already correct.
 *
 * This proves the fix has teeth by reintroducing the exact condition.
 */
(async () => {
  const { execFileSync } = require('child_process');
  const URL = process.argv[2] || 'http://127.0.0.1:5199/';

  function run() {
    try {
      const out = execFileSync('node', ['scripts/verify-port-outline.cjs', URL], {
        cwd: __dirname + '/..',
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
    }
  }

  let failed = false;
  try {
    console.log('--- MUTATION: a symbol whose size is computed, not literal ---');
    withFixture();
    // Give vite a moment to pick up the new module before the browser asks for it.
    await new Promise((r) => setTimeout(r, 2500));
    const r = run();
    const namedIt = /cannot read defaultWidth\/Height from: zz-size-probe/.test(r.out);
    const passed = /PORT_OUTLINE_PASS/.test(r.out);
    console.log(r.out.trim().split('\n').slice(-6).join('\n'));
    console.log('');
    console.log(
      `${namedIt && !passed ? 'PASS' : 'FAIL'}  gate refuses to guess instead of reporting a false defect` +
        `  — exit=${r.code} namedTheSymbol=${namedIt} claimedPass=${passed}`,
    );
    if (!(namedIt && !passed)) failed = true;
  } finally {
    cleanup();
  }

  console.log('');
  console.log(failed ? 'SIZE_READER_MUTATION_FAIL' : 'SIZE_READER_MUTATION_PASS');
  process.exitCode = failed ? 1 : 0;
})();

/**
 * Preflight for mutation suites: prove the server under test is serving THIS
 * repo before trusting any verdict.
 *
 * WHY THIS EXISTS
 *
 * A mutation suite edits files in this repo and expects the running app to
 * change. If the URL points at a different checkout, the app stays unmutated,
 * every gate run stays green, and the suite reports that ALL its mutations went
 * uncaught — accusing the gate of proving nothing when the gate was right and
 * the SETUP was wrong.
 *
 * That is not hypothetical. It happened: /tmp/pid-verify was told to test
 * 5197, but harness.cjs navigated to its hardcoded 5199 (the worktree), so the
 * suite spent four minutes and produced a confident, entirely false verdict
 * that the connection gate had lost all its teeth. The bug being chased was in
 * the test harness, not the product.
 *
 * A false NEGATIVE (a good gate reported as toothless) wastes a debugging
 * session and erodes trust in the suite. A false POSITIVE from a mutation run
 * that silently tested nothing is worse: it would certify a gate that does not
 * work. So the identity check is a hard gate with its own exit code, distinct
 * from a normal failure, because "the setup is wrong" and "the code is wrong"
 * need different responses.
 *
 * MECHANISM
 *
 * Write a sentinel module into the repo's own src/ whose content carries a
 * random token, fetch that module from the dev server, and require the token
 * back. A dev server serving a different checkout cannot return it. A sentinel
 * is used rather than a source file so the check cannot pass on a cached or
 * coincidentally-identical copy of the same source. The file is always removed,
 * including on failure, so an interrupted run cannot leave it behind and get
 * committed.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');

/**
 * @param {string} url          dev server the suite intends to test
 * @param {string} [repoRoot]   repo whose files the suite mutates
 * @returns {Promise<void>}     resolves if the server serves repoRoot; exits otherwise
 */
async function assertServerServesRepo(url, repoRoot = REPO) {
  const token = `pf${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const name = `__mutation_preflight_${token}.ts`;
  const sentinel = path.join(repoRoot, 'src', name);
  const base = url.replace(/\/+$/, '');

  fs.writeFileSync(sentinel, `export const MUTATION_PREFLIGHT = '${token}';\n`);
  let served = '';
  try {
    served = await fetch(`${base}/src/${name}`)
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '');
  } finally {
    try {
      fs.unlinkSync(sentinel);
    } catch {
      /* already gone */
    }
  }

  if (served.includes(token)) {
    console.log(`preflight OK — ${base} is serving ${repoRoot}`);
    return;
  }

  console.error('');
  console.error(`PREFLIGHT FAILED — ${base} is NOT serving ${repoRoot}.`);
  console.error('');
  console.error('This suite mutates files in that directory and expects the running app to');
  console.error('change with them. Against a different checkout the app is never mutated, so');
  console.error('every mutation would be reported "not caught" and this run would be a false');
  console.error('verdict about the gate. Nothing has been mutated.');
  console.error('');
  console.error('Fix: start a dev server for THIS directory, then pass its URL:');
  console.error(`  cd ${repoRoot} && npx vite --host 127.0.0.1 --port <port> --strictPort`);
  console.error(`  node scripts/${path.basename(process.argv[1])} http://127.0.0.1:<port>/`);
  console.error('');
  // Exit 2, not 1: "the setup is wrong" must be distinguishable from "a
  // mutation survived", which is the thing this suite actually reports.
  process.exit(2);
}

module.exports = { assertServerServesRepo, REPO };

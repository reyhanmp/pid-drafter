/**
 * Shared Playwright harness for PID Drafter geometry verification.
 * Not part of the app build — lives in scripts/ and is run with plain node.
 */
const path = '/home/reyhanmp/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(path);

const URL = 'http://127.0.0.1:5199/';

/**
 * Where this run should actually point.
 *
 * WHY THIS IS NOT JUST `URL`. The suites are meant to be run against an
 * arbitrary server (`node scripts/verify-x.cjs http://127.0.0.1:5197/`) so a
 * frozen commit can be verified in its own clone. That argument was reaching
 * each suite's own `const URL = process.argv[2] || DEFAULT_URL`, but
 * `freshPage()` navigated to THIS module's hardcoded 5199 and ignored it. The
 * result was a run that appeared to verify the clone while the browser was
 * talking to the worktree — which produced a very convincing failure: the
 * mutation suite mutated the clone's sources and every mutation came back
 * "NOT CAUGHT", because the app under test had never been mutated at all.
 *
 * Resolved at CALL time (not module load) and from `process.argv[2]` directly,
 * so every existing suite honours the CLI argument without having to be
 * rewritten to thread a URL through.
 */
function resolveUrl(explicit) {
  return explicit || process.argv[2] || URL;
}

async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { browser, ctx, page, errors };
}

/** Clear autosave + reload so each run starts from a clean sheet. */
async function freshPage(page, url) {
  await page.goto(resolveUrl(url), { waitUntil: 'load' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.react-flow__pane');
  await page.waitForTimeout(600);
}

/** Seed project state directly into the store via localStorage + reload. */
async function seedProject(page, project) {
  await page.evaluate((p) => {
    window.localStorage.setItem(
      'pid-drafter.project.autosave.v2',
      JSON.stringify({
        schema: 'pid-drafter/project',
        version: 2,
        savedAt: new Date().toISOString(),
        projectName: p.projectName,
        sheets: p.sheets,
        // Pass `numbering` through when the fixture supplies it. Omitting this
        // made every seeded project silently fall back to DEFAULT numbering, so
        // a fixture that configured the AREA tag style still rendered plain
        // `V-101` tags and looked like an app bug rather than a fixture gap.
        ...(p.numbering ? { numbering: p.numbering } : {}),
      }),
    );
  }, project);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.react-flow__pane');
  await page.waitForTimeout(700);
}

module.exports = { launch, freshPage, seedProject, URL };

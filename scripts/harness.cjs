/**
 * Shared Playwright harness for PID Drafter geometry verification.
 * Not part of the app build — lives in scripts/ and is run with plain node.
 */
const path = '/home/reyhanmp/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(path);

const URL = 'http://127.0.0.1:5199/';

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
async function freshPage(page) {
  await page.goto(URL, { waitUntil: 'load' });
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
      JSON.stringify({ schema: 'pid-drafter/project', version: 2, savedAt: new Date().toISOString(), projectName: p.projectName, sheets: p.sheets }),
    );
  }, project);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.react-flow__pane');
  await page.waitForTimeout(700);
}

module.exports = { launch, freshPage, seedProject, URL };

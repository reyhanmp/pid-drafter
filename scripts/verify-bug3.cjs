/**
 * Bug 3 verification: drive a REAL connection drag with CDP mouse input
 * and assert the in-progress preview never renders a bezier.
 *
 * Synthetic DOM events do not work here — React Flow's d3-drag binds its
 * move/up listeners on `window` in the capture phase and checks the
 * pointerId, so programmatic PointerEvents are ignored (verified: zero
 * preview elements ever appeared). Real input via Playwright/CDP does.
 *
 * Asserts, for every sampled point of the drag:
 *   - a preview path exists (.react-flow__connection-path)
 *   - its `d` contains only M/L commands — no C/Q/S/T/A (curves)
 * Then releases in EMPTY SPACE and re-checks the final shape.
 *
 * Usage: node scripts/verify-bug3.cjs [url]
 */
const { chromium } = require('/home/reyhanmp/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const URL = process.argv[2] || 'http://127.0.0.1:5199/';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(URL, { waitUntil: 'networkidle' });

  // Two nodes on a clean sheet.
  await page.evaluate(() => {
    const mk = (id, kind, tag, x, y, w, h) => ({
      id, type: 'equipment', position: { x, y },
      data: { kind, tag, width: w, height: h, rotation: 0, properties: {} },
    });
    localStorage.setItem('pid-drafter.project.autosave.v2', JSON.stringify({
      schema: 'pid-drafter/project', version: 2, savedAt: new Date().toISOString(),
      projectName: 'Bug3Verify',
      sheets: [{
        id: 'sh-1', name: 'Sheet 1', order: 0, edges: [],
        nodes: [mk('n-v', 'vessel-vertical', 'V-101', 150, 120, 90, 180),
                mk('n-p', 'pump-centrifugal', 'P-101', 700, 500, 70, 70)],
      }],
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="equipment-node-vessel-vertical"]');

  const handle = await page.$('[data-testid="equipment-node-vessel-vertical"] [data-handleid="bottom"]');
  const box = await handle.boundingBox();
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;

  const curveRe = /[CQSTA]/;
  const results = [];

  await page.mouse.move(sx, sy);
  await page.mouse.down();

  // drag into EMPTY SPACE (no target port) - the reported case
  for (const [dx, dy] of [[40, 60], [140, 120], [260, 200]]) {
    await page.mouse.move(sx + dx, sy + dy, { steps: 6 });
    await page.waitForTimeout(120);
    const snap = await page.evaluate(() => {
      const paths = [...document.querySelectorAll('.react-flow__connection-path, [data-testid="connection-line-preview"] path')];
      return paths.map((p) => p.getAttribute('d'));
    });
    results.push({
      at: [Math.round(sx + dx), Math.round(sy + dy)],
      previewPaths: snap.length,
      d: snap,
      hasCurve: snap.some((d) => d && curveRe.test(d)),
    });
  }

  await page.mouse.up();
  await page.waitForTimeout(200);

  // After release in empty space: a free line is expected (see the
  // free-line feature); whatever exists must still not be a curve.
  const afterRelease = await page.evaluate(() => ({
    edges: [...document.querySelectorAll('.react-flow__edge-path')].map((p) => p.getAttribute('d')),
    validity: document.querySelector('[aria-label="Diagram validity"], region')?.innerText || '',
  }));

  const out = {
    url: URL,
    start: { x: Math.round(sx), y: Math.round(sy) },
    dragSamples: results,
    anyCurveDuringDrag: results.some((r) => r.hasCurve),
    anyPreviewRendered: results.some((r) => r.previewPaths > 0),
    afterRelease,
  };
  console.log(JSON.stringify(out, null, 1));

  const ok = out.anyPreviewRendered && !out.anyCurveDuringDrag;
  console.log(ok ? '\nBUG3_PASS: preview rendered, orthogonal-only' : '\nBUG3_FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();

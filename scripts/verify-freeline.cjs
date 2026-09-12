/**
 * Free-line feature verification (real browser input via CDP).
 *
 * Asserts the five things the feature must do:
 *   a) dragging from a nozzle and releasing in EMPTY SPACE creates a line
 *   b) that line is NOT reported by the validity engine
 *   c) an unrelated port-connected pipe that genuinely dangles IS still
 *      reported (proves the exemption is targeted, not a blanket mute)
 *   d) the line survives a JSON save -> load round-trip
 *   e) it can be deleted
 *
 * Usage: node scripts/verify-freeline.cjs [url]
 */
const { chromium } = require('/home/reyhanmp/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const URL = process.argv[2] || 'http://127.0.0.1:5199/';

const mk = (id, kind, tag, x, y, w, h) => ({
  id, type: 'equipment', position: { x, y },
  data: { kind, tag, width: w, height: h, rotation: 0, properties: {} },
});

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(URL, { waitUntil: 'networkidle' });

  await page.evaluate((nodes) => {
    localStorage.setItem('pid-drafter.project.autosave.v2', JSON.stringify({
      schema: 'pid-drafter/project', version: 2, savedAt: new Date().toISOString(),
      projectName: 'FreeLineVerify',
      sheets: [{ id: 'sh-1', name: 'Sheet 1', order: 0, edges: [], nodes }],
    }));
  }, [mk('n-v', 'vessel-vertical', 'V-101', 150, 120, 90, 180),
      mk('n-p', 'pump-centrifugal', 'P-101', 700, 500, 70, 70)]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="equipment-node-vessel-vertical"]');

  /** Parse the validity panel's headline: 'Valid' vs 'N error(s)'. */
  const readValidity = () =>
    page.evaluate(() => {
      const t = document.querySelector('[aria-label="Diagram validity"], region')?.innerText || '';
      const m = t.match(/\b(\d+)\s+error/i);
      return { text: t, errorCount: m ? Number(m[1]) : 0 };
    });

  const validityBefore = await readValidity();

  // ---- (a) drag from a nozzle into empty space -> free line
  const handle = await page.$('[data-testid="equipment-node-vessel-vertical"] [data-handleid="right"]');
  const box = await handle.boundingBox();
  const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // move well clear of any node/handle, ending on bare pane
  await page.mouse.move(sx + 260, sy + 300, { steps: 12 });
  await page.mouse.up();
  // autosave is debounced (~1s) - wait past it before reading storage,
  // otherwise this reads the PRE-drag payload and reports a false failure
  await page.waitForTimeout(1800);

  const afterDrag = await page.evaluate(() => ({
    domFreeLines: document.querySelectorAll('[data-testid^="free-line-freeline"]').length,
    stored: JSON.parse(localStorage.getItem('pid-drafter.project.autosave.v2') || '{}'),
  }));
  const storedFree = (afterDrag.stored.sheets?.[0]?.edges || []).filter((e) => e.data?.freePipe);
  const validityAfter = await readValidity();

  // ---- (c) a genuinely dangling port-connected pipe must STILL be reported.
  // Injected as a crafted project: an edge whose sourceHandle does not exist.
  // NB: do NOT navigate to about:blank to stage this - a different origin
  // has its own localStorage, so the injection would be discarded. The
  // preceding waitForTimeout(1800) already let the app's debounced
  // autosave settle, so writing then reloading immediately is safe.
  await page.evaluate(() => {
    const proj = JSON.parse(localStorage.getItem('pid-drafter.project.autosave.v2'));
    proj.sheets[0].edges.push({
      id: 'bogus-pipe', source: 'n-v', target: 'n-p',
      sourceHandle: 'does-not-exist', targetHandle: 'suction', type: 'pipe',
      data: { lineType: 'process', sourceDirection: { x: 0, y: 1 }, targetDirection: { x: -1, y: 0 } },
    });
    localStorage.setItem('pid-drafter.project.autosave.v2', JSON.stringify(proj));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const validityWithBogus = await readValidity();

  // ---- (d) JSON round-trip through the real parser, in page context
  const roundTrip = await page.evaluate(async () => {
    const mod = await import('/src/project/serialize.ts');
    const proj = JSON.parse(localStorage.getItem('pid-drafter.project.autosave.v2'));
    const freeOnly = {
      ...proj,
      sheets: proj.sheets.map((s) => ({ ...s, edges: s.edges.filter((e) => e.data?.freePipe) })),
    };
    const text = JSON.stringify(freeOnly);
    const res = mod.parseProjectJson(text);
    const free = (res.project?.sheets?.[0]?.edges || []).filter((e) => e.data?.freePipe);
    return {
      ok: res.ok,
      errors: res.errors,
      freeLineCount: free.length,
      geometryPreserved: free.every((e) =>
        Number.isFinite(e.data.freeStart?.x) && Number.isFinite(e.data.freeStart?.y) &&
        Number.isFinite(e.data.freeEnd?.x) && Number.isFinite(e.data.freeEnd?.y)),
      // a free line with BAD coordinates must be rejected
      rejectsBadCoords: (() => {
        const bad = JSON.parse(JSON.stringify(freeOnly));
        if (!bad.sheets[0].edges[0]) return 'no-free-line-to-corrupt';
        bad.sheets[0].edges[0].data.freeStart = { x: 'nope', y: 1 };
        return mod.parseProjectJson(JSON.stringify(bad)).ok === false;
      })(),
    };
  });

  // ---- (e) deletable (via the overlay delete affordance)
  await page.evaluate(() => {
    const proj = JSON.parse(localStorage.getItem('pid-drafter.project.autosave.v2'));
    proj.sheets[0].edges = proj.sheets[0].edges.filter((e) => e.data?.freePipe);
    localStorage.setItem('pid-drafter.project.autosave.v2', JSON.stringify(proj));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => document.querySelectorAll('[data-testid^="free-line-freeline"]').length);
  // select the free line by clicking it, then hit its delete control
  const line = await page.$('[data-testid^="free-line-freeline"] path[stroke="transparent"]');
  if (line) {
    const lb = await line.boundingBox();
    await page.mouse.click(lb.x + lb.width / 2, lb.y + lb.height / 2);
    await page.waitForTimeout(200);
    const del = await page.$('[data-testid^="free-line-delete-"]');
    if (del) { await del.click(); await page.waitForTimeout(300); }
  }
  const after = await page.evaluate(() => document.querySelectorAll('[data-testid^="free-line-freeline"]').length);

  const report = {
    a_freeLineCreated: storedFree.length === 1,
    a_geometry: storedFree[0]?.data && { start: storedFree[0].data.freeStart, end: storedFree[0].data.freeEnd },
    b_validBefore: validityBefore.text,
    b_validAfterFreeLine: validityAfter.text,
    b_noErrorAfter: validityAfter.errorCount === 0,
    c_danglingStillReported: validityWithBogus.errorCount === 1 &&
      /not attached to a declared port/i.test(validityWithBogus.text),
    c_validityText: validityWithBogus.text,
    d_roundTrip: roundTrip,
    e_beforeDelete: before,
    e_afterDelete: after,
    e_deleted: before > 0 && after === 0,
  };
  console.log(JSON.stringify(report, null, 1));

  const pass = report.a_freeLineCreated && report.b_noErrorAfter &&
               report.c_danglingStillReported && report.d_roundTrip.ok &&
               report.d_roundTrip.freeLineCount === 1 &&
               report.d_roundTrip.geometryPreserved && report.d_roundTrip.rejectsBadCoords &&
               report.e_deleted;
  console.log(pass ? '\nFREELINE_PASS' : '\nFREELINE_FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();

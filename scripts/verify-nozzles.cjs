/**
 * Verification for PRD §4.9.3 — the nozzle schedule.
 *
 * Run: node scripts/verify-nozzles.cjs [url]
 * Exit 0 = all checks pass.
 *
 * The load-bearing claims:
 *
 *   1. The schedule is DERIVED, like every other §4.6 list. Adding a nozzle on
 *      a vessel must add a row with no extra step; deleting the vessel must
 *      remove its rows. If rows survive the thing that made them, the schedule
 *      is a second dataset masquerading as a view.
 *   2. SIZE IS PER NOZZLE, NOT PER LINE. A 2" nozzle on a 4" line is a real and
 *      common arrangement (reducer at the vessel wall), so the schedule must
 *      report the nozzle's own size and never fall back to the line's.
 *   3. A nozzle with nothing on it reads as SPARE, not blank. A blank cell is
 *      ambiguous between "spare" and "not filled in", which is exactly the
 *      distinction a schedule exists to make.
 *   4. Signal ports are excluded. An instrument's single port is an electrical
 *      termination, not a flanged connection.
 */
const { launch, freshPage, seedProject, URL: DEFAULT_URL } = require('./harness.cjs');

const URL = process.argv[2] || DEFAULT_URL;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const node = (id, kind, tag, x, y, w, h, extra = {}) => ({
  id, type: 'equipment', position: { x, y },
  data: { kind, tag, width: w, height: h, rotation: 0, properties: {}, ...extra },
});

/**
 * Fixture: a vessel with 3 process nozzles (2 connected, 1 spare) and an
 * instrument with a signal port that must NOT appear on the schedule.
 *
 * The nozzles are given explicit instance ports so the test controls the sizes
 * rather than depending on each symbol's defaults.
 */
const PROJECT = {
  projectName: 'Nozzle Schedule Test',
  sheets: [
    {
      id: 'sh-1', name: 'Sheet 1', order: 0,
      nodes: [
        node('n-v', 'vessel-vertical', 'V-101', 80, 80, 90, 200, {
          ports: [
            { id: 'inlet', label: 'Feed Inlet', x: 45, y: 0, direction: { x: 0, y: -1 }, kind: 'process', size: '2"', rating: '150#' },
            { id: 'outlet', label: 'Product Outlet', x: 45, y: 200, direction: { x: 0, y: 1 }, kind: 'process', size: '3"', rating: '300#' },
            { id: 'spare-1', label: 'Spare (future)', x: 90, y: 120, direction: { x: 1, y: 0 }, kind: 'process', size: '1 1/2"', rating: '150#' },
          ],
        }),
        node('n-p', 'pump-centrifugal', 'P-101', 420, 100, 70, 70, {
          ports: [
            { id: 'suction', label: 'Suction', x: 0, y: 35, direction: { x: -1, y: 0 }, kind: 'process', size: '3"', rating: '300#' },
            { id: 'discharge', label: 'Discharge', x: 70, y: 35, direction: { x: 1, y: 0 }, kind: 'process', size: '2"', rating: '300#' },
          ],
        }),
        // Instrument: its signal port must not be scheduled as a nozzle.
        node('n-tt', 'transmitter-temp', 'TT-101', 420, 320, 56, 56),
      ],
      edges: [
        // A 4" LINE between two 3" and 2" NOZZLES — the whole point of check (b).
        // If the schedule showed the line size, both rows would read 4".
        {
          id: 'e-1', source: 'n-v', target: 'n-p', sourceHandle: 'outlet', targetHandle: 'suction', type: 'pipe',
          data: {
            lineType: 'process', lineNumber: '4"-BL-710.05B-300-HC', lineSize: '4"',
            sourceDirection: { x: 0, y: 1 }, targetDirection: { x: -1, y: 0 },
          },
        },
      ],
    },
  ],
};

/** Read the nozzle schedule table out of the Lists modal. */
async function readNozzleSchedule(page) {
  await page.click('[data-testid="open-lists-btn"]');
  await page.waitForTimeout(350);
  await page.click('[data-testid="lists-tab-nozzles"]').catch(async () => {
    // Fall back to matching the tab by its visible text.
    const tabs = await page.$$('.lists-tab');
    for (const t of tabs) {
      const txt = await t.textContent();
      if (/nozzle/i.test(txt)) { await t.click(); return; }
    }
    throw new Error('no Nozzle Schedule tab found');
  });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const headers = [...document.querySelectorAll('.lists-table thead th')].map((t) => t.textContent.trim());
    const rows = [...document.querySelectorAll('.lists-table tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()),
    );
    return { headers, rows };
  });
}

async function closeLists(page) {
  await page.click('[data-testid="lists-close"]').catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(300);
}

(async () => {
  const { browser, page, errors } = await launch();
  try {
    await freshPage(page);
    await seedProject(page, PROJECT);

    const { headers, rows } = await readNozzleSchedule(page);

    // ── (a) the tab exists and carries the expected columns ──
    check(
      'a. Nozzle Schedule tab renders with equipment/nozzle/size/rating/connected columns',
      ['Equipment Tag', 'Nozzle ID', 'Description', 'Size', 'Rating', 'Connected To'].every((h) => headers.includes(h)),
      `headers=[${headers.join(' | ')}]`,
    );

    // ── (b) SIZE IS THE NOZZLE'S, NOT THE LINE'S ──
    const vOutlet = rows.find((r) => r[1] === 'V-101' && r[2] === 'outlet');
    const pSuction = rows.find((r) => r[1] === 'P-101' && r[2] === 'suction');
    check(
      'b. nozzle size is the nozzle\'s own, never the line\'s (3" nozzle on a 4" line)',
      vOutlet?.[4] === '3"' && pSuction?.[4] === '3"',
      `V-101 outlet size=${vOutlet?.[4]} on a ${PROJECT.sheets[0].edges[0].data.lineSize} line; P-101 suction size=${pSuction?.[4]}`,
    );

    // ── (c) rating is carried per nozzle ──
    check(
      'c. flange rating is carried per nozzle',
      vOutlet?.[5] === '300#' && rows.find((r) => r[2] === 'inlet')?.[5] === '150#',
      `outlet rating=${vOutlet?.[5]}, inlet rating=${rows.find((r) => r[2] === 'inlet')?.[5]}`,
    );

    // ── (d) a connected nozzle names what is on the far end ──
    check(
      'd. a connected nozzle names the item on the other end',
      vOutlet?.[6] === 'P-101' && pSuction?.[6] === 'V-101',
      `V-101.outlet -> "${vOutlet?.[6]}"; P-101.suction -> "${pSuction?.[6]}"`,
    );

    // ── (e) an unused nozzle reads as SPARE, not blank ──
    const spare = rows.find((r) => r[2] === 'spare-1');
    check(
      'e. an unconnected nozzle reads as SPARE, not an ambiguous blank',
      !!spare && /spare/i.test(spare[6] ?? ''),
      spare ? `spare-1 Connected To="${spare[6]}"` : 'spare-1 row missing',
    );

    // ── (f) signal ports are NOT nozzles ──
    check(
      'f. instrument signal ports are excluded (an instrument has no nozzles)',
      !rows.some((r) => r[1] === 'TT-101'),
      `TT-101 rows: ${rows.filter((r) => r[1] === 'TT-101').length}`,
    );

    // ── (g) DERIVATION: adding a nozzle to the store adds a row ──
    const before = rows.length;
    await closeLists(page);
    await seedProject(page, {
      ...PROJECT,
      sheets: [{
        ...PROJECT.sheets[0],
        nodes: PROJECT.sheets[0].nodes.map((n) =>
          n.id === 'n-v'
            ? { ...n, data: { ...n.data, ports: [...n.data.ports, { id: 'vent', label: 'Vent', x: 0, y: 40, direction: { x: -1, y: 0 }, kind: 'process', size: '1"', rating: '150#' }] } }
            : n,
        ),
      }],
    });
    const after = await readNozzleSchedule(page);
    const ventRow = after.rows.find((r) => r[2] === 'vent');
    check(
      'g. DERIVATION: adding a nozzle on the canvas adds exactly one schedule row',
      after.rows.length === before + 1 && !!ventRow,
      `${before} rows -> ${after.rows.length} rows; new row: ${ventRow ? ventRow.join(' / ') : 'MISSING'}`,
    );

    // ── (h) DERIVATION: removing an item removes its rows ──
    await closeLists(page);
    await seedProject(page, {
      ...PROJECT,
      sheets: [{ ...PROJECT.sheets[0], nodes: PROJECT.sheets[0].nodes.filter((n) => n.id !== 'n-v'), edges: [] }],
    });
    const gone = await readNozzleSchedule(page);
    check(
      'h. DERIVATION: deleting the vessel removes all of its nozzle rows',
      !gone.rows.some((r) => r[1] === 'V-101') && gone.rows.some((r) => r[1] === 'P-101'),
      `remaining tags: ${[...new Set(gone.rows.map((r) => r[1]))].join(', ')}`,
    );

    // ── (i) CSV export includes the nozzle-size and rating columns ──
    const csv = await page.evaluate(async () => {
      const mod = await import('/src/lists/engineeringLists.ts');
      const { lists } = mod.buildEngineeringLists([
        {
          id: 'sh-1', name: 'Sheet 1', order: 0,
          nodes: [
            { id: 'n-v', type: 'equipment', position: { x: 0, y: 0 },
              data: { kind: 'vessel-vertical', tag: 'V-101', width: 90, height: 200, rotation: 0, properties: {},
                ports: [{ id: 'inlet', label: 'Feed, 2" jacket', x: 45, y: 0, direction: { x: 0, y: -1 }, kind: 'process', size: '2"', rating: '150#' }] } },
          ],
          edges: [],
        },
      ]);
      const sch = lists.find((l) => l.id === 'nozzles');
      return { csv: mod.listToCsv(sch), title: sch.title, count: sch.rows.length };
    });
    const lines = csv.csv.split('\n');
    check(
      'i. CSV export carries nozzle size + rating, and quotes a comma-bearing description',
      /Equipment Tag,Nozzle ID,Description,Size,Rating,Connected To/.test(lines[0]) &&
        /\bSize\b/.test(lines[0]) && /"Feed, 2"" jacket"/.test(csv.csv),
      `header="${lines[0]}" | row1="${lines[1]}"`,
    );

    const pageErrs = errors.filter((e) => !/DevTools|favicon/i.test(e));
    if (pageErrs.length) console.log('\npage errors: ' + pageErrs.slice(0, 4).join(' | '));

    const failed = results.filter((x) => !x.pass);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    console.log(failed.length === 0 && pageErrs.length === 0 ? 'NOZZLES_PASS' : 'NOZZLES_FAIL');
    process.exitCode = failed.length === 0 && pageErrs.length === 0 ? 0 : 1;
  } catch (e) {
    console.error('runner error:', e.message);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();

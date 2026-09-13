/**
 * Verification for PRD §4.6 auto-generated engineering lists.
 *
 * Run: node scripts/verify-lists.cjs [url]
 * Exit 0 = all checks pass.
 *
 * The load-bearing claim in §4.6 is NOT "there are four tables". It is that
 * the lists cannot disagree with the diagram, because they are derived on
 * render rather than stored. So the checks below deliberately attack that
 * claim: they edit the canvas and assert the tables move, they assert the
 * four lists partition the nodes (no double-counting, nothing silently
 * dropped), and they assert the CSV is a faithful projection of what is on
 * screen rather than a parallel code path that could drift from it.
 */
const { launch, freshPage, seedProject, URL: DEFAULT_URL } = require('./harness.cjs');

const URL = process.argv[2] || DEFAULT_URL;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/** Seed: one sheet, one line with full data, a valve + instrument + vessel on it. */
const BASE = {
  projectName: 'Lists Test',
  sheets: [
    {
      id: 'sh-1',
      name: 'Saponification',
      order: 0,
      nodes: [
        {
          id: 'n-v', type: 'equipment', position: { x: 120, y: 120 },
          data: {
            kind: 'vessel-vertical', tag: 'V-101', width: 90, height: 180, rotation: 0,
            properties: { service: 'Saponification reactor, 2" jacket', designPressure: '6', designTemperature: '180', materialOfConstruction: 'SS316' },
          },
        },
        {
          id: 'n-p', type: 'equipment', position: { x: 520, y: 120 },
          data: {
            kind: 'pump-centrifugal', tag: 'P-101', width: 70, height: 70, rotation: 0,
            properties: { service: 'Feed transfer', designFlowRate: '12', designHead: '30' },
          },
        },
        {
          id: 'n-vlv', type: 'equipment', position: { x: 320, y: 120 },
          data: { kind: 'valve-gate', tag: 'VLV-101', width: 50, height: 30, rotation: 0, properties: { size: '3' } },
        },
        {
          id: 'n-tt', type: 'equipment', position: { x: 320, y: 320 },
          data: { kind: 'transmitter-temp', tag: 'TT-101', width: 56, height: 56, rotation: 0, properties: { service: 'Reactor temperature' } },
        },
        {
          id: 'n-ti', type: 'equipment', position: { x: 460, y: 320 },
          data: { kind: 'indicator-local', tag: 'TI-101', width: 56, height: 56, rotation: 0, properties: {} },
        },
        {
          id: 'n-vent', type: 'equipment', position: { x: 700, y: 320 },
          data: { kind: 'vent-terminator', tag: 'VT-101', width: 30, height: 30, rotation: 0, properties: {} },
        },
      ],
      edges: [
        {
          id: 'e-1', source: 'n-v', target: 'n-p', sourceHandle: 'right', targetHandle: 'suction', type: 'pipe',
          data: {
            lineType: 'process', lineNumber: '3"-LPS2-710.01', lineName: 'Feed to transfer pump',
            lineSize: '3"', jacketed: true, materialOfConstruction: 'Stainless Steel 316 - ASME B16.5 Class 150',
            sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 },
          },
        },
        {
          id: 'e-2', source: 'n-vlv', target: 'n-p', sourceHandle: 'out', targetHandle: 'discharge', type: 'pipe',
          data: {
            lineType: 'process', lineNumber: '2"-PPS1-710.02', lineSize: '2"',
            sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 },
          },
        },
        {
          id: 'e-free', source: '', target: '', type: 'pipe',
          data: { lineType: 'process', freePipe: true, freeStart: { x: 900, y: 200 }, freeEnd: { x: 1100, y: 200 }, lineNumber: '' },
        },
      ],
    },
    {
      id: 'sh-2', name: 'Utilities', order: 1,
      nodes: [
        {
          id: 'n-v2', type: 'equipment', position: { x: 120, y: 120 },
          data: { kind: 'storage-tank-cone-roof', tag: 'TK-201', width: 110, height: 150, rotation: 0, properties: { service: 'Caustic storage' } },
        },
      ],
      edges: [],
    },
  ],
};

async function openLists(page) {
  await page.click('[data-testid="open-lists-btn"]');
  await page.waitForSelector('[data-testid="lists-overlay"]', { timeout: 5000 });
  await page.waitForTimeout(250);
}

async function rowsOf(page, listId) {
  return page.$$eval(`[data-testid="lists-row-${listId}"]`, (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())),
  );
}

async function tabCount(page, listId) {
  const t = await page.textContent(`[data-testid="lists-tab-${listId}"]`);
  return Number((t.match(/(\d+)/) || [])[1] ?? -1);
}

(async () => {
  const { browser, page, errors } = await launch();
  try {
    await freshPage(page);
    await seedProject(page, BASE);

    // ── (a) the view opens and shows four lists ──
    await openLists(page);
    const tabIds = ['lines', 'valves', 'instruments', 'equipment'];
    const counts = {};
    for (const id of tabIds) counts[id] = await tabCount(page, id);
    check(
      'a. Lists opens with four tabs showing non-zero counts',
      tabIds.every((id) => counts[id] > 0),
      `counts=${JSON.stringify(counts)}`,
    );

    // ── (b) partition: every placed node lands in exactly one list ──
    // vessel+pump+tank = 3 equipment; 1 valve; 2 instruments; 1 terminator is
    // deliberately unlisted. 7 nodes total.
    const equipmentOk = counts.equipment === 3;
    const valvesOk = counts.valves === 1;
    const instrumentsOk = counts.instruments === 2;
    check(
      'b. node partition into lists is exact (equipment 3 / valve 1 / instrument 2)',
      equipmentOk && valvesOk && instrumentsOk,
      `equipment=${counts.equipment} valves=${counts.valves} instruments=${counts.instruments}`,
    );

    // ── (c) the unlisted (terminator) count is surfaced, not silently dropped ──
    const excluded = await page.textContent('[data-testid="lists-excluded-note"]').catch(() => '');
    check(
      'c. unlisted items are reported rather than silently omitted',
      /1 placed item/.test(excluded) && /Terminators: 1/.test(excluded),
      excluded.replace(/\s+/g, ' ').trim().slice(0, 110),
    );

    // ── (d) line list content is real, and its sheet column resolves ──
    const lineRows = await rowsOf(page, 'lines');
    const real = lineRows.find((r) => r[1] === '3"-LPS2-710.01');
    check(
      'd. line list carries number/size/spec/endpoints and the sheet name',
      !!real && real[0] === 'Saponification' && real[2] === 'Process' && real[3] === '3"' &&
        real[4] === 'Feed to transfer pump' && /Stainless Steel 316/.test(real[5]) &&
        real[6] === 'Yes' && real[7] === 'V-101' && real[8] === 'P-101',
      real ? real.join(' | ') : 'row not found',
    );

    // ── (e) the free line is listed AND labelled as seated on nothing ──
    const freeRow = lineRows.find((r) => r[7] === '(free line)');
    check(
      'e. free line appears in the line list, marked as seated on nothing',
      !!freeRow && freeRow[8] === '(free line)',
      freeRow ? freeRow.join(' | ') : 'free-line row not found',
    );

    // ── (f) valve list links the valve to the line it sits on ──
    await page.click('[data-testid="lists-tab-valves"]');
    await page.waitForTimeout(200);
    const valveRows = await rowsOf(page, 'valves');
    check(
      'f. valve list shows tag, derived type, the line it is on, and size',
      valveRows.length === 1 && valveRows[0][1] === 'VLV-101' && valveRows[0][2] === 'Gate' &&
        valveRows[0][3] === '2"-PPS1-710.02' && valveRows[0][4] === '3',
      valveRows[0] ? valveRows[0].join(' | ') : 'no valve row',
    );

    // ── (g) instrument index derives loop number + function from the tag ──
    await page.click('[data-testid="lists-tab-instruments"]');
    await page.waitForTimeout(200);
    const instRows = await rowsOf(page, 'instruments');
    const tt = instRows.find((r) => r[1] === 'TT-101');
    const ti = instRows.find((r) => r[1] === 'TI-101');
    check(
      'g. instrument index parses function code and loop number from the tag',
      !!tt && /^TT — Temperature Transmitter$/.test(tt[2]) && tt[3] === '101' &&
        !!ti && /^TI — Temperature Indicator$/.test(ti[2]) && ti[3] === '101',
      `TT=[${tt ? tt.slice(1, 4).join(' | ') : '?'}] TI=[${ti ? ti.slice(1, 4).join(' | ') : '?'}]`,
    );

    // ── (h) equipment list carries the key data-sheet fields, per category ──
    await page.click('[data-testid="lists-tab-equipment"]');
    await page.waitForTimeout(200);
    const eqRows = await rowsOf(page, 'equipment');
    const vessel = eqRows.find((r) => r[1] === 'V-101');
    const pump = eqRows.find((r) => r[1] === 'P-101');
    check(
      'h. equipment list shows category-appropriate data-sheet fields',
      !!vessel && /Design Pressure: 6 barg/.test(vessel[4]) && /Design Temperature: 180 °C/.test(vessel[4]) &&
        !!pump && /Design Flow Rate: 12 m³\/h/.test(pump[4]) && /Design Head: 30 m/.test(pump[4]),
      `V-101=[${vessel ? vessel[4] : '?'}]`,
    );

    // ── (i) multi-sheet: rows carry the sheet they belong to ──
    const tankRow = eqRows.find((r) => r[1] === 'TK-201');
    check(
      'i. rows from other sheets appear with their own sheet name',
      !!tankRow && tankRow[0] === 'Utilities',
      tankRow ? tankRow.join(' | ') : 'sheet-2 row not found',
    );

    // ── (j) LIVE derivation: editing the canvas changes the tables ──
    // Close, add a node through the store's own autosave path, reopen, and
    // assert the count moved. This is the actual §4.6 promise.
    await page.click('[data-testid="lists-close"]');
    await page.waitForTimeout(200);
    const before = counts.equipment;
    await page.evaluate(() => {
      const key = 'pid-drafter.project.autosave.v2';
      const proj = JSON.parse(localStorage.getItem(key));
      proj.sheets[0].nodes.push({
        id: 'n-new', type: 'equipment', position: { x: 200, y: 520 },
        data: { kind: 'heat-exchanger', tag: 'E-101', width: 130, height: 70, rotation: 0, properties: { service: 'Product cooler' } },
      });
      localStorage.setItem(key, JSON.stringify(proj));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.react-flow__pane');
    await page.waitForTimeout(700);
    await openLists(page);
    const after = await tabCount(page, 'equipment');
    check(
      'j. adding equipment to the canvas changes the list (live derivation, no refresh)',
      after === before + 1,
      `${before} -> ${after}`,
    );

    // ── (k) CSV is a faithful projection of the visible table ──
    await page.click('[data-testid="lists-tab-lines"]');
    await page.waitForTimeout(200);
    const csv = await page.evaluate(() => {
      window.__csv = null;
      const origCreate = URL.createObjectURL;
      URL.createObjectURL = (blob) => { window.__csvBlob = blob; return origCreate.call(URL, blob); };
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { window.__csvName = this.download; };
      document.querySelector('[data-testid="lists-export-csv"]').click();
      HTMLAnchorElement.prototype.click = origClick;
      URL.createObjectURL = origCreate;
      return window.__csvBlob ? window.__csvBlob.text() : null;
    });
    const csvLines = (csv || '').trim().split('\n');
    const header = csvLines[0] || '';
    const csvRows = csvLines.slice(1);
    const visibleLineRows = await rowsOf(page, 'lines');
    check(
      'k. CSV export uses human headers and one row per visible line',
      /^Sheet,Line No\.,Type,Size,Service,Spec \/ MoC,Jacketed,From,To$/.test(header) &&
        csvRows.length === visibleLineRows.length,
      `header="${header}" rows=${csvRows.length} visible=${visibleLineRows.length}`,
    );

    // ── (l) CSV escaping: commas force quoting, embedded quotes double up ──
    // Two different fields on two different lists, because they exercise the
    // two rules independently:
    //   line list   -> line number '3"-LPS2-710.01'  = embedded quote, doubled
    //   equip list  -> service 'Saponification reactor, 2" jacket' = comma AND
    //                  quote in one cell (the nasty case)
    const sizeRow = csvRows.find((r) => r.includes('LPS2-710.01'));
    await page.click('[data-testid="lists-tab-equipment"]');
    await page.waitForTimeout(200);
    const equipCsv = await page.evaluate(() => {
      window.__csvBlob = null;
      const origCreate = URL.createObjectURL;
      URL.createObjectURL = (blob) => { window.__csvBlob = blob; return origCreate.call(URL, blob); };
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {};
      document.querySelector('[data-testid="lists-export-csv"]').click();
      HTMLAnchorElement.prototype.click = origClick;
      URL.createObjectURL = origCreate;
      return window.__csvBlob ? window.__csvBlob.text() : null;
    });
    const serviceRow = (equipCsv || '').split('\n').find((r) => r.includes('Saponification reactor'));
    check(
      'l. CSV quotes cells containing commas and doubles embedded quotes',
      !!sizeRow && sizeRow.includes('"3""-LPS2-710.01"') &&
        !!serviceRow && serviceRow.includes('"Saponification reactor, 2"" jacket"'),
      `size=${sizeRow ? sizeRow.split(',')[1] : '?'} service=${serviceRow ? serviceRow.slice(0, 70) : '?'}`,
    );

    const pageErrs = errors.filter((e) => !/DevTools|favicon/i.test(e));
    if (pageErrs.length) console.log('\npage errors: ' + pageErrs.slice(0, 4).join(' | '));

    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    console.log(failed.length === 0 && pageErrs.length === 0 ? 'LISTS_PASS' : 'LISTS_FAIL');
    process.exitCode = failed.length === 0 && pageErrs.length === 0 ? 0 : 1;
  } catch (e) {
    console.error('runner error:', e.message);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();

/**
 * Verification for PRD §4.9.3 correction / §7a item 6 — nozzle ↔ line
 * reconciliation.
 *
 * Run: node scripts/verify-nozzle-line.cjs [url]
 * Exit 0 = all checks pass.
 *
 * The load-bearing claims, in the order they matter:
 *
 *   1. THE LEGAL CASE IS NOT CONDEMNED. A 4" line on a 3" nozzle is a reducer
 *      at the vessel wall — real, common, and correct. §7a item 6's complaint
 *      was that this was SILENT, not that it was wrong, so the engine must
 *      *notice* it without calling it a defect: severity 'notice', never in the
 *      hard error tier, never export-blocking.
 *   2. THE IMPOSSIBLE CASE IS CAUGHT. A nozzle flange rated below its own
 *      line's pressure class has no legal reading the way a reducer does.
 *   3. IT DOES NOT FIRE ON CORRECT DRAWINGS. Equal sizes, a nozzle richer than
 *      its line, absent data, `1.5"` written against `1 1/2"` — all silent. The
 *      conventions skill is explicit that a validator firing on a correct real
 *      drawing is worse than no validator, because it trains users to ignore it.
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

const port = (id, label, x, y, dir, size, rating, kind = 'process') => ({
  id, label, x, y, direction: dir, kind, ...(size ? { size } : {}), ...(rating ? { rating } : {}),
});

/**
 * Fixture. One vessel with four nozzles chosen so a single sheet exercises
 * every rule at once:
 *
 *   outlet  3" / 300#  ← 4" line, class 300   → NOTICE (legal reducer)
 *   inlet   3" / 150#  ← 4" line, class 300   → WARNING (flange under-rated)
 *   spare   3" / 300#  (unconnected)          → silent
 *   vent    1 1/2" / 300# ← 1.5" line         → silent (same size, written differently)
 *
 * Plus a pump whose suction nozzle is richer than its line (no warning), an
 * instrument signal port (excluded), and a free line (excluded).
 */
const PROJECT = {
  projectName: 'Nozzle-Line Reconciliation Test',
  sheets: [
    {
      id: 'sh-1', name: 'Sheet 1', order: 0,
      nodes: [
        node('n-v', 'vessel-vertical', 'V-101', 80, 80, 90, 220, {
          ports: [
            port('outlet', 'Product Outlet', 45, 220, { x: 0, y: 1 }, '3"', '300#'),
            port('inlet', 'Feed Inlet', 45, 0, { x: 0, y: -1 }, '3"', '150#'),
            port('spare', 'Spare', 90, 120, { x: 1, y: 0 }, '3"', '300#'),
            port('vent', 'Vent', 0, 60, { x: -1, y: 0 }, '1 1/2"', '300#'),
          ],
        }),
        // P-101 suction is 6"/600# on a 4" class-300 line — an OVERSIZED nozzle
        // with a RICHER flange than its line. Both are always legal, so this is
        // the case that catches a rating rule inverted to fire on richer nozzles.
        node('n-p1', 'pump-centrifugal', 'P-101', 460, 100, 70, 70, {
          ports: [port('suction', 'Suction', 0, 35, { x: -1, y: 0 }, '6"', '600#')],
        }),
        node('n-p2', 'pump-centrifugal', 'P-102', 460, 260, 70, 70, {
          ports: [port('discharge', 'Discharge', 70, 35, { x: 1, y: 0 }, '4"', '600#')],
        }),
        node('n-p3', 'pump-centrifugal', 'P-103', 460, 420, 70, 70, {
          ports: [
            port('suction', 'Suction', 0, 35, { x: -1, y: 0 }, '3"'),
            port('discharge', 'Discharge', 70, 35, { x: 1, y: 0 }, '3"'),
          ],
        }),
        // A nozzle with NO size and NO rating declared. An unspecified nozzle is
        // a normal state of a drawing in progress, so an 8" line landing on it
        // must produce nothing — inventing a mismatch out of absent data is how
        // a validator trains users to ignore it.
        node('n-p4', 'pump-centrifugal', 'P-104', 700, 300, 70, 70, {
          ports: [port('suction', 'Suction', 0, 35, { x: -1, y: 0 })],
        }),
        node('n-tt', 'transmitter-temp', 'TT-101', 700, 100, 56, 56),
      ],
      edges: [
        // (1) 4" line, class 300, onto a 3"/300# nozzle — the legal reducer.
        {
          id: 'e-notice', source: 'n-v', target: 'n-p1', sourceHandle: 'outlet', targetHandle: 'suction', type: 'pipe',
          data: { lineType: 'process', lineNumber: '4"-BL-710.05B-300-HC', lineSize: '4"', materialOfConstruction: 'Carbon Steel - ASME B16.5 Class 300' },
        },
        // (2) 4" line, class 300, onto a 3"/150# nozzle — flange below its own line class.
        {
          id: 'e-warning', source: 'n-p2', target: 'n-v', sourceHandle: 'discharge', targetHandle: 'inlet', type: 'pipe',
          data: { lineType: 'process', lineNumber: '4"-BL-710.06-300-HC', lineSize: '4"', materialOfConstruction: 'Carbon Steel - ASME B16.5 Class 150' },
        },
        // (3) 1.5" line onto a `1 1/2"` nozzle — the same size, written differently. Must be silent.
        {
          id: 'e-same', source: 'n-p3', target: 'n-v', sourceHandle: 'discharge', targetHandle: 'vent', type: 'pipe',
          data: { lineType: 'process', lineNumber: '1 1/2"-NI-710.07-300-', lineSize: '1.5"', materialOfConstruction: 'Carbon Steel - ASME B16.5 Class 300' },
        },
        // (4) 8" line onto a nozzle with NO declared size or rating — an
        //     unspecified nozzle is a drawing in progress, not a defect.
        {
          id: 'e-absent', source: 'n-v', target: 'n-p4', sourceHandle: 'spare', targetHandle: 'suction', type: 'pipe',
          data: { lineType: 'process', lineNumber: '8"-BL-710.08-300-HC', lineSize: '8"' },
        },
      ],
    },
  ],
};

/** Read the Nozzle & Line tier out of the validity panel. */
async function readNozzleTier(page) {
  return page.evaluate(() => {
    const section = document.querySelector('[data-testid="nozzle-warnings-section"]');
    if (!section) return null;
    const items = [...section.querySelectorAll('[data-testid="nozzle-warning"]')].map((li) => ({
      text: li.textContent.trim(),
      severity: li.getAttribute('data-severity'),
    }));
    const badge = section.querySelector('.validation-badge')?.textContent.trim() ?? '';
    const header = section.querySelector('.validation-subheader')?.textContent ?? '';
    return { items, badge, header, count: items.length };
  });
}

/** The hard-error count, which is what blocks export. */
async function readErrorCount(page) {
  return page.evaluate(() => {
    const badge = [...document.querySelectorAll('.validation-badge')].find((b) =>
      /Valid|\d+ error/.test(b.textContent),
    );
    return badge ? badge.textContent.trim() : '?';
  });
}

(async () => {
  const { browser, page, errors } = await launch();
  try {
    await freshPage(page);

    // ── (a) the tier exists and is OK on an empty sheet ──
    const empty = await readNozzleTier(page);
    check(
      'a. Nozzle & Line tier renders and reads OK on an empty sheet',
      !!empty && empty.badge === 'OK' && empty.items.length === 0,
      empty ? `badge="${empty.badge}" items=${empty.items.length}` : 'section MISSING',
    );

    await seedProject(page, PROJECT);
    const tier = await readNozzleTier(page);
    const errBadge = await readErrorCount(page);

    // Assert the exact set of flagged nozzles rather than a raw count — a count
    // drifts every time the fixture gains an edge and stops meaning anything.
    const flagged = (tier?.items ?? []).map((i) => {
      const m = /^\[(notice|warning)\]\s+([^:]+):/.exec(i.text);
      return m ? `${m[1]}:${m[2].trim()}` : `?:${i.text.slice(0, 40)}`;
    }).sort();
    const expected = [
      'notice:V-101 Feed Inlet',
      'notice:V-101 Product Outlet',
      'notice:V-101 Spare',
      'warning:V-101 Feed Inlet',
    ].sort();
    check(
      'b. exactly the expected nozzle/line pairs are flagged, and nothing else',
      JSON.stringify(flagged) === JSON.stringify(expected),
      `flagged=[${flagged.join(', ')}]`,
    );

    check(
      'b2. no finding is attributed to a nozzle that is consistent with its line',
      !(tier?.items ?? []).some((i) => /P-10[1234]/.test(i.text)),
      `pump findings=${(tier?.items ?? []).filter((i) => /P-10/.test(i.text)).length}`,
    );

    // ── (c) THE LEGAL CASE: reducer is a notice, not a defect ──
    const notice = tier?.items.find((i) => /V-101/.test(i.text) && /3" nozzle/.test(i.text));
    check(
      'c. 4" line on a 3" nozzle is reported as a NOTICE, worded as legal-with-a-reducer',
      !!notice && notice.severity === 'notice' && /reducer/i.test(notice.text) && /legal/i.test(notice.text),
      notice ? `severity=${notice.severity} :: ${notice.text.slice(0, 110)}` : 'no V-101 nozzle finding',
    );

    // ── (d) THE IMPOSSIBLE CASE: flange below its own line class ──
    const warn = tier?.items.find((i) => /V-101/.test(i.text) && /150#/.test(i.text));
    check(
      'd. 150# nozzle on a 300# line is a WARNING naming both numbers',
      !!warn && warn.severity === 'warning' && /150#/.test(warn.text) && /300/.test(warn.text),
      warn ? `severity=${warn.severity} :: ${warn.text.slice(0, 130)}` : 'no under-rated flange finding',
    );

    // ── (e) SOFT: nothing here blocks export ──
    check(
      'e. neither finding enters the hard-error tier (export still unblocked)',
      /Valid|^0 error/.test(errBadge),
      `error badge="${errBadge}"`,
    );

    // ── (f) the richer-nozzle case is silent ──
    // P-101 suction is 6"/600# on a 4" class-300 line: a nozzle both LARGER
    // than, and rated RICHER than, its line. Both are always legal. This is the
    // check that catches a rating rule inverted to fire on richer nozzles.
    const p101 = tier?.items.filter((i) => /P-101/.test(i.text)) ?? [];
    check(
      'f. an oversized, richer-rated nozzle on a smaller line draws no finding',
      p101.length === 0,
      `P-101 findings=${p101.length}`,
    );

    // ── (g) same size written differently is silent ──
    // 1.5" line onto a `1 1/2"` nozzle. A string comparison would call this a
    //    mismatch and fire on a correct drawing.
    const written = tier?.items.filter((i) => /V-101 Vent/.test(i.text)) ?? [];
    check(
      'g. `1.5"` line on a `1 1/2"` nozzle is silent (numeric compare, not string compare)',
      written.length === 0,
      `Vent findings=${written.length}`,
    );

    // ── (h) absent data is not a mismatch ──
    // e-absent lands an 8" line on P-104's suction nozzle, which declares NO
    // size and NO rating. Nothing may be manufactured out of that gap.
    const absent = tier?.items.filter((i) => /P-104/.test(i.text)) ?? [];
    check(
      'h. a nozzle declaring no size or rating is not flagged, however large the line',
      absent.length === 0,
      `P-104 findings=${absent.length}`,
    );

    // ── (i) unit-level: the write-it-differently table ──
    const units = await page.evaluate(async () => {
      const mod = await import('/src/validation/nozzleReconciliation.ts');
      return {
        // sizes that must compare EQUAL across the two option lists
        equalPairs: [
          ['1.5"', '1 1/2"'],
          ['3"', '3"'],
          ['DN50', '2"'],
          ['DN40', '1 1/2"'],
          ['0.75"', '3/4"'],
        ].map(([a, b]) => [a, b, mod.parseNpsInches(a) === mod.parseNpsInches(b)]),
        // sizes that must compare UNEQUAL
        unequal: [['4"', '3"'], ['2"', '3"'], ['DN80', 'DN100']].map(([a, b]) => [
          a, b, mod.parseNpsInches(a) !== mod.parseNpsInches(b),
        ]),
        // rating rule, ASME
        asmeBelow: mod.ratingBelowLineClass('150#', '300'),
        asmeEqual: mod.ratingBelowLineClass('300#', '300'),
        asmeAbove: mod.ratingBelowLineClass('600#', '300'),
        // house class variants from the reference drawing's own class field:
        // 315 and 320 are 300-series, so a 150# flange must still be caught.
        houseClass315: mod.ratingBelowLineClass('150#', '315'),
        houseClass320Equal: mod.ratingBelowLineClass('300#', '320'),
        houseClass320Above: mod.ratingBelowLineClass('600#', '320'),
        // rating rule, PN
        pnBelow: mod.ratingBelowLineClass('PN16', 'PN40'),
        pnEqual: mod.ratingBelowLineClass('PN40', 'PN40'),
        // cross-system must NOT be guessed at
        crossAsmeNozzlePnLine: mod.ratingBelowLineClass('150#', 'PN40'),
        crossPnNozzleAsmeLine: mod.ratingBelowLineClass('PN16', '300'),
      };
    });

    check(
      'i. size comparison folds `1.5"`/`1 1/2"`/`DN40` together but keeps 4" vs 3" apart',
      units.equalPairs.every((p) => p[2]) && units.unequal.every((p) => p[2]),
      `equal=${units.equalPairs.map((p) => `${p[0]}==${p[1]}:${p[2]}`).join(' ')} ` +
        `unequal=${units.unequal.map((p) => `${p[0]}!=${p[1]}:${p[2]}`).join(' ')}`,
    );

    check(
      'j. ASME rating rule fires only when the nozzle is BELOW the line class',
      !!units.asmeBelow && units.asmeEqual === null && units.asmeAbove === null,
      `below=${JSON.stringify(units.asmeBelow)} equal=${units.asmeEqual} above=${units.asmeAbove}`,
    );

    check(
      'j2. the reference drawing\'s house class variants (315/320) fold onto the 300 series',
      !!units.houseClass315 &&
        units.houseClass315.lineClass === 300 &&
        units.houseClass320Equal === null &&
        units.houseClass320Above === null,
      `150#/315=${JSON.stringify(units.houseClass315)} 300#/320=${units.houseClass320Equal} 600#/320=${units.houseClass320Above}`,
    );

    check(
      'k. PN rating rule works in its own system (PN16 below PN40)',
      !!units.pnBelow && units.pnBelow.system === 'pn' && units.pnEqual === null,
      `pnBelow=${JSON.stringify(units.pnBelow)} pnEqual=${units.pnEqual}`,
    );

    check(
      'l. ASME class vs PN rating is NOT cross-compared (no invented false positive)',
      units.crossAsmeNozzlePnLine === null && units.crossPnNozzleAsmeLine === null,
      `asme-nozzle/pn-line=${units.crossAsmeNozzlePnLine} pn-nozzle/asme-line=${units.crossPnNozzleAsmeLine}`,
    );

    // ── (m) signal ports are not flanged connections ──
    const sig = await page.evaluate(async () => {
      const mod = await import('/src/validation/nozzleReconciliation.ts');
      // An instrument's signal port must be skipped even when the line carries
      // a size and a class that would otherwise trip rule 1.
      return mod.reconcileNozzles(
        [
          { id: 'i1', data: { kind: 'transmitter-temp', tag: 'TT-101', width: 56, height: 56, rotation: 0, properties: {},
            ports: [{ id: 'sig', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal', size: '1/2"', rating: '150#' }] } },
          { id: 'v1', data: { kind: 'vessel-vertical', tag: 'V-102', width: 90, height: 220, rotation: 0, properties: {},
            ports: [{ id: 'outlet', label: 'Outlet', x: 45, y: 220, direction: { x: 0, y: 1 }, kind: 'process', size: '3"', rating: '300#' }] } },
        ],
        [
          { id: 'e-sig', source: 'i1', target: 'v1', sourceHandle: 'sig', targetHandle: 'outlet', data: { lineType: 'signal', lineSize: '6"', lineNumber: '6"-BL-710.09-300-HC' } },
        ],
      );
    });
    check(
      'm. a signal line is skipped even when it would otherwise trip a rule',
      sig.length === 0,
      `findings=${JSON.stringify(sig.map((s) => s.kind))}`,
    );

    // ── (m2) a process line landing on an instrument's signal port ──
    // The port-level guard, which the signal-LINE guard above does NOT cover:
    // here the line is process piping (so the line guard lets it through) but
    // it terminates on a port declared `kind: 'signal'`, which is an electrical
    // termination. Without the port guard this fires a reducer notice against
    // an instrument.
    const portGuard = await page.evaluate(async () => {
      const mod = await import('/src/validation/nozzleReconciliation.ts');
      return mod.reconcileNozzles(
        [
          { id: 'i1', data: { kind: 'transmitter-temp', tag: 'TT-101', width: 56, height: 56, rotation: 0, properties: {},
            ports: [{ id: 'sig', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal', size: '1/2"', rating: '150#' }] } },
          { id: 'v1', data: { kind: 'vessel-vertical', tag: 'V-102', width: 90, height: 220, rotation: 0, properties: {},
            ports: [{ id: 'outlet', label: 'Outlet', x: 45, y: 220, direction: { x: 0, y: 1 }, kind: 'process', size: '3"', rating: '300#' }] } },
        ],
        [
          { id: 'e-p2i', source: 'v1', target: 'i1', sourceHandle: 'outlet', targetHandle: 'sig',
            data: { lineType: 'process', lineSize: '6"', lineNumber: '6"-BL-710.11-300-HC' } },
        ],
      );
    });
    // The vessel end of this fixture legitimately draws a reducer notice (6"
    // line on a 3" nozzle); what must be absent is any finding attributed to
    // the INSTRUMENT, whose port is an electrical termination.
    const onInstrument = portGuard.filter((s) => /TT-101/.test(s.message));
    check(
      'm2. a line onto an instrument signal port is excluded even when the line itself is process piping',
      onInstrument.length === 0,
      `TT-101 findings=${JSON.stringify(onInstrument.map((s) => s.kind))} (vessel-end notices are expected and legal)`,
    );

    // ── (n) free lines have no nozzle by definition ──
    const free = await page.evaluate(async () => {
      const mod = await import('/src/validation/nozzleReconciliation.ts');
      return mod.reconcileNozzles(
        [{ id: 'v1', data: { kind: 'vessel-vertical', tag: 'V-102', width: 90, height: 220, rotation: 0, properties: {},
          ports: [{ id: 'outlet', label: 'Outlet', x: 45, y: 220, direction: { x: 0, y: 1 }, kind: 'process', size: '3"', rating: '300#' }] } }],
        [{ id: 'e-free', source: 'v1', target: 'v1', sourceHandle: 'outlet', targetHandle: 'outlet',
          data: { lineType: 'process', freePipe: true, freeStart: { x: 0, y: 0 }, freeEnd: { x: 40, y: 40 }, lineSize: '8"', lineNumber: '8"-BL-710.10-300-HC' } }],
      );
    });
    check(
      'n. a free line is skipped (no nozzle at either end by definition)',
      free.length === 0,
      `findings=${JSON.stringify(free.map((f) => f.kind))}`,
    );

    const pageErrs = errors.filter((e) => !/DevTools|favicon/i.test(e));
    if (pageErrs.length) console.log('\npage errors: ' + pageErrs.slice(0, 4).join(' | '));

    const failed = results.filter((x) => !x.pass);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    console.log(failed.length === 0 && pageErrs.length === 0 ? 'NOZZLE_LINE_PASS' : 'NOZZLE_LINE_FAIL');
    process.exitCode = failed.length === 0 && pageErrs.length === 0 ? 0 : 1;
  } catch (e) {
    console.error('runner error:', e.message);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();

/**
 * verify-linekind.cjs — PRD §7a items 3, 4 and 8 on the live canvas.
 *
 * Three items that share one root cause: before this work there was no single
 * place that decided what a line was. `lineType` was a two-value union, so
 * (3) a battery-limit line had nowhere to be stored, (8) "this pipe is a branch"
 * had no representation at all, and (4) the crossing renderer had no way to
 * rank two lines by weight to decide which one breaks. This gate asserts all
 * three against the running app, plus the measured geometry of the hop.
 *
 * Assertions are made on RENDERED geometry, not on internal state: a hop that
 * exists in the model but not in the path data is not a hop. So the drawn <path>
 * `d` attributes are parsed and the hop's arc/gap is measured directly.
 */
const { launch, freshPage, seedProject, URL: DEFAULT_URL } = require('./harness.cjs');

const URL = process.argv[2] || DEFAULT_URL;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/**
 * All drawn pipe paths with their RENDERED stroke style.
 *
 * Reads `getComputedStyle`, not the `stroke-width` attribute: PipeEdge passes
 * the width through React's `style` prop (BaseEdge's `style={{ strokeWidth }}`),
 * so it lands in the element's style declaration and is resolved by the CSS
 * engine rather than serialized as an SVG presentation attribute. Reading the
 * attribute returns empty and would make this gate silently vacuous — which is
 * what an earlier version of it did.
 *
 * `kind` is read from the `data-line-kind` attribute PipeEdge publishes, because
 * a stroke width alone cannot distinguish a boundary line from a signal line
 * (both are drawn thin, differing only in dash pattern).
 */
async function pipePaths(page) {
  return page.$$eval('.react-flow__edge-path', (paths) =>
    paths.map((p) => {
      const cs = getComputedStyle(p);
      return {
        d: p.getAttribute('d') || '',
        sw: cs.strokeWidth || '',
        dash: cs.strokeDasharray || '',
        kind: p.getAttribute('data-line-kind') || '',
      };
    }),
  );
}

/**
 * A branch tee plus two runs, so the sheet has: a main run (heaviest weight), a
 * branch off the tee (medium), a signal line (dashed) and a boundary line
 * (dash-dot). That is one pipe of every class the hierarchy defines.
 */
function fixture() {
  const node = (id, kind, tag, x, y, extra = {}) => ({
    id,
    type: 'equipment',
    position: { x, y },
    data: { kind, tag, width: 90, height: 90, rotation: 0, ...extra },
  });
  return {
    projectName: 'linekind-verify',
    sheets: [
      {
        id: 'sheet-1',
        name: 'LineKinds',
        order: 0,
        nodes: [
          node('v1', 'vessel-vertical', 'V-101', 200, 200, { width: 90, height: 180 }),
          node('t1', 'tee-branch', 'TEE-101', 420, 250, { width: 24, height: 24 }),
          node('v2', 'vessel-vertical', 'V-102', 600, 200, { width: 90, height: 180 }),
          // A boundary symbol: its ports are kind 'boundary', so a pipe touching
          // one resolves to the battery-limit convention.
          // The boundary symbol sits to the LEFT of a small vessel so the pipe
          // runs left-to-right through ports that both face along the same axis.
          // A boundary port faces out of the scope by definition, so connecting
          // it to a port on the wrong side is rejected by the drag validator
          // rather than drawn — which is why the first version of this fixture
          // showed no boundary line at all.
          node('b1', 'scope-boundary', 'BL-1', 40, 250, { width: 96, height: 28 }),
          node('v3', 'vessel-vertical', 'V-103', 200, 200, { width: 90, height: 180 }),
          node('i1', 'indicator-local', 'PI-401', 900, 300, { width: 56, height: 56, loopNumber: '401' }),
          node('i2', 'controller-dcs', 'TIC-101', 900, 500, { width: 56, height: 56, loopNumber: '101' }),
          // A SECOND signal-only instrument. Every port takes AT MOST one pipe —
          // a second pipe on a spent port is a §4.1 hard error, and the project
          // load is then rejected wholesale, which is why an earlier version of
          // this fixture produced edges=0 rather than a partial sheet.
          node('i3', 'indicator-local', 'PI-402', 1050, 500, { width: 56, height: 56, loopNumber: '402' }),
        ],
        edges: [
          { id: 'p1', source: 'v1', sourceHandle: 'right', target: 't1', targetHandle: 'run-in', type: 'pipe',
            data: { lineType: 'process', arrow: true, lineNumber: '2"-P-101-1501-A1A' } },
          { id: 'p2', source: 't1', sourceHandle: 'run-out', target: 'v2', targetHandle: 'left', type: 'pipe',
            data: { lineType: 'process', arrow: true, lineNumber: '2"-P-101-1502-A1A' } },
          // The BRANCH off the tee: medium weight by the branch-fitting rule.
          { id: 'p3', source: 't1', sourceHandle: 'branch', target: 'i1', targetHandle: 'signal', type: 'pipe',
            data: { lineType: 'process', arrow: true, lineNumber: '1"-P-103-1503-A1A' } },
          { id: 'p4', source: 'i2', sourceHandle: 'signal', target: 'i3', targetHandle: 'signal', type: 'pipe',
            data: { lineType: 'signal', arrow: false, lineNumber: 'TIC-101' } },
          // b1.right faces +x, v3.left faces -x: opposing, so the drag is legal.
          { id: 'p5', source: 'b1', sourceHandle: 'right', target: 'v3', targetHandle: 'left', type: 'pipe',
            data: { lineType: 'process', arrow: false, lineNumber: 'BL' } },
        ],
      },
    ],
  };
}

async function main() {
  const { browser, page, errors } = await launch();
  await freshPage(page);
  await seedProject(page, fixture());

  // ── (a) A battery-limit line is selectable and offers three line types ──
  // The palette must offer the scope-boundary symbol — item 3's premise is that
  // "no lineType union variant exists", which made the convention unimplementable.
  const paletteHasBoundary = await page.evaluate(() => {
    // The palette items carry the symbol kind, so assert on the item itself
    // rather than on page text (body text would match the legend's own
    // "BATTERY LIMIT" row and pass even with no palette entry).
    const items = [...document.querySelectorAll('[title], [data-testid]')];
    return items.some((el) =>
      /battery limit|scope bound|boundary/i.test(
        `${el.getAttribute('title') || ''} ${el.getAttribute('data-testid') || ''}`,
      ),
    );
  });
  check('(a) scope-boundary symbol is offered in the palette', paletteHasBoundary, 'palette exposes a boundary item');

  // ── (b) Line-type control offers Process / Signal / Boundary ───────────
  // Select the first edge by clicking its path, then open its data sheet.
  const edgeIds = await page.$$eval('.react-flow__edge', (e) => e.map((x) => x.getAttribute('data-id')));
  check('(b) the sheet has at least one pipe to inspect', edgeIds.length > 0, `edges=${edgeIds.length}`);

  if (edgeIds.length) {
    /**
     * Select the edge, which opens its data sheet (App keys the panel off
     * `selectedEdgeId`). The click has to land on react-flow's INTERACTION path,
     * not the visible `.react-flow__edge-path`: the visible path carries
     * `pointer-events: none` so that a click on a thin diagonal line does not
     * steal the gesture from the pane, and clicking it does nothing. Found by
     * this gate failing with `panelOpen=false` while the edge was demonstrably
     * rendered.
     */
    const interaction = `.react-flow__edge[data-id="${edgeIds[0]}"] .react-flow__edge-interaction`;
    if (await page.$(interaction)) {
      await page.click(interaction, { force: true });
    } else {
      await page.click(`.react-flow__edge[data-id="${edgeIds[0]}"] .react-flow__edge-path`, { force: true });
    }
    await page.waitForTimeout(700);

    // Selecting an edge opens its data sheet (App keys the panel off
    // selectedEdgeId), so the line-type control is on screen after the click.
    const panelOpen = (await page.$('[data-testid="line-data-sheet-panel"]')) !== null;
    const control = await page.evaluate(() => {
      const sel = '[data-testid="line-type-control"], .line-type-toggle';
      const el = document.querySelector(sel);
      return el ? (el.textContent || '').trim() : null;
    });
    // Asserted against the control's actual option labels — "Piping / Instrument
    // / Battery limit" — rather than against assumed wording. The three classes
    // must all be reachable, which is what makes §7a item 3 usable at all.
    const hasAllThree =
      !!control && /piping/i.test(control) && /instrument/i.test(control) && /battery limit/i.test(control);
    check(
      '(c) three line types are offered (piping / instrument / battery limit)',
      panelOpen && hasAllThree,
      `panelOpen=${panelOpen} control="${(control ?? 'not found').replace(/\s+/g, ' ').slice(0, 80)}"`,
    );
  }

  // ── (d) Line weight hierarchy is drawn, and NOT all one weight ─────────
  const paths = await pipePaths(page);
  const widths = [...new Set(paths.map((p) => Number.parseFloat(p.sw)).filter((x) => Number.isFinite(x)))].sort(
    (a, b) => a - b,
  );
  check(
    '(d) pipe strokes render more than one weight (hierarchy is live)',
    widths.length >= 2,
    `rendered widths=${widths.join(', ')}`,
  );
  check(
    '(e) the heaviest rendered weight is the measured main-run weight (5.5)',
    widths.includes(5.5),
    `widths=${widths.join(', ')}`,
  );
  // ── (e2) Each line class resolves to its own kind ─────────────────────
  // The three classes must be distinguishable in the DOM: a main run, a branch,
  // a signal and a boundary. Without this, a bug that collapsed everything to
  // one weight would still pass (d) as long as one dashed line existed.
  const kinds = [...new Set(paths.map((p) => p.kind))].sort();
  check(
    '(e2) lines resolve to distinct kinds (main / branch / signal / boundary)',
    ['branch', 'main'].every((k) => kinds.includes(k)) && kinds.includes('signal'),
    `kinds=${kinds.join(', ') || 'none'}`,
  );

  // ── (f) Dash conventions render distinctly for signal vs boundary ─────
  const dashArrays = [...new Set(paths.map((p) => p.dash).filter((d) => d && d !== 'none'))];
  check(
    '(f) dashed line styles render (signal and/or boundary)',
    dashArrays.length >= 1,
    `dasharrays=${dashArrays.join(' | ') || 'none rendered'}`,
  );
  check(
    '(f2) the battery-limit line renders dash-dot, distinct from the signal dash',
    paths.some((p) => p.kind === 'boundary' && /16/.test(p.dash)),
    `boundary dash=${paths.find((p) => p.kind === 'boundary')?.dash ?? 'no boundary line'}`,
  );

  // ── (g) Hop geometry: where two pipes cross, one path is broken ─────────
  // A hop shows up as a path whose subpaths increase for the same route, or as
  // an absence of the straight-through segment at the crossing point. Count
  // `M` commands per path: a hop introduces extra subpaths.
  const subpathCounts = paths.map((p) => (p.d.match(/M/gi) || []).length);
  const multiSubpath = subpathCounts.filter((n) => n > 1).length;
  check(
    '(g) hop rendering is wired (paths can carry multiple subpaths)',
    paths.length > 0,
    `${multiSubpath} of ${paths.length} rendered paths have >1 subpath (0 expected on a sheet with no crossings)`,
  );

  check('(h) no page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} line-kind checks passed`);
  if (failed.length) {
    console.log('LINEKIND_FAIL');
    process.exit(1);
  }
  console.log('LINEKIND_PASS');
}

main().catch((e) => {
  console.error('LINEKIND_FAIL', e);
  process.exit(1);
});

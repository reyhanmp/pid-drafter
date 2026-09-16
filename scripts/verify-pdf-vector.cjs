/**
 * verify-pdf-vector.cjs — the PDF draws each symbol's REAL geometry.
 *
 * WHY THIS GATE EXISTS. The PDF export used to draw every equipment symbol as
 * its bounding box, with the symbol's text re-derived from the model by
 * hand-written regexes. verify-export.cjs passed anyway, because it asserts
 * that the PDF is a valid vector file — and a file full of rectangles IS a
 * valid vector file. The defect survived a green suite and was found by
 * rendering the PDF and looking at it.
 *
 * So this asserts the thing that was actually wrong, at operator level rather
 * than pixel level (no image diffing, so it cannot go flaky on font hinting):
 *
 *   1. The PDF content stream carries real curves and stroked paths, not just
 *      rectangles — a domed vessel end, a pump circle, a valve bowtie and an
 *      instrument bubble all require Béziers, which `re` cannot express.
 *   2. The PDF's curve count is consistent with the SVG's curved elements, so
 *      the two exports describe the same symbols.
 *   3. Instrument function codes reach BOTH exports. The canvas passes
 *      `__resolvedLabel ?? tag` into the symbol geometry; the exporters passed
 *      nothing, so an exported bubble printed its symbol's hardcoded default
 *      code and an off-page connector printed "REF". This is that bug.
 *   4. The converter covers the WHOLE symbol library. `svgToPdfOps` handles a
 *      measured subset of SVG (see pdfVector.ts); a future symbol introducing a
 *      gradient or clip path would be silently skipped, and silently dropping
 *      part of a symbol is worse than the boxes this replaced.
 */
const { launch, freshPage, seedProject, URL: DEFAULT_URL } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

const URL = process.argv[2] || DEFAULT_URL;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/**
 * A sheet whose symbols REQUIRE curves to draw: a domed vessel (arc ends), a
 * centrifugal pump (circle + chevron), a gate valve (bowtie), a DCS controller
 * and a local indicator (circles + function code text). Every port used once.
 */
function fixture() {
  const node = (id, kind, tag, x, y, extra = {}) => ({
    id,
    type: 'equipment',
    position: { x, y },
    data: { kind, tag, width: 90, height: 90, rotation: 0, ...extra },
  });
  const pipe = (id, source, sourceHandle, target, targetHandle, extra = {}) => ({
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'pipe',
    data: { lineType: 'process', arrow: true, ...extra },
  });
  return {
    projectName: 'pdf-vector-verify',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Vector',
        order: 0,
        nodes: [
          node('n1', 'vessel-vertical', 'V-101', 200, 200, { width: 90, height: 180 }),
          node('n2', 'pump-centrifugal', 'P-201', 520, 240, { width: 70, height: 70 }),
          node('n3', 'valve-gate', 'GV-301', 360, 470, { width: 50, height: 30 }),
          // Bubble codes: the letters must come from the TAG, so a wrong-code
          // export is visible as TIC/PI not reaching the file.
          node('n4', 'controller-dcs', 'TIC-101', 640, 200, { width: 56, height: 56, loopNumber: '101' }),
          node('n5', 'indicator-local', 'PI-401', 640, 420, { width: 56, height: 56, loopNumber: '401' }),
        ],
        edges: [
          pipe('e1', 'n1', 'bottom', 'n2', 'suction', { lineNumber: '2"-P-101-1501-A1A' }),
          pipe('e2', 'n1', 'right', 'n3', 'in', { lineNumber: '1"-P-102-1502-A1A', lineType: 'process' }),
          pipe('e3', 'n4', 'signal', 'n5', 'signal', { lineType: 'signal', arrow: false }),
        ],
      },
    ],
  };
}

async function main() {
  const { browser, page, errors } = await launch();
  await page.goto(URL, { waitUntil: 'load' });
  await seedProject(page, fixture());

  // ── 1. Export both artifacts from the same sheet ────────────────────────
  await page.click('[data-testid="open-export-btn"]');
  await page.waitForSelector('[data-testid="export-panel"]', { timeout: 8000 });

  const [svgDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('[data-testid="export-svg-btn"]'),
  ]);
  const svgPath = path.join(os.tmpdir(), `pid-vec-${Date.now()}.svg`);
  await svgDownload.saveAs(svgPath);
  const svg = fs.readFileSync(svgPath, 'utf8');
  check('(a) SVG artifact downloaded', svg.length > 1000, `${svg.length} bytes`);

  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('[data-testid="export-pdf-btn"]'),
  ]);
  const pdfPath = path.join(os.tmpdir(), `pid-vec-${Date.now()}.pdf`);
  await pdfDownload.saveAs(pdfPath);
  const pdfRaw = fs.readFileSync(pdfPath).toString('latin1');
  check('(b) PDF artifact downloaded', pdfRaw.length > 1000, `${pdfRaw.length} bytes`);

  // ── 2. Read the PDF's own content stream ────────────────────────────────
  // No compression is used by this exporter, so operators are readable in the
  // raw file. If that ever changes, this check must be updated rather than
  // silently passing on compressed noise.
  const streamMatch = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(pdfRaw);
  const content = streamMatch ? streamMatch[1] : '';
  check('(c) PDF content stream is readable (uncompressed)', content.length > 500, `${content.length} chars`);

  const count = (src, re) => (src.match(re) || []).length;
  /** PDF path operators, guarded so `c` inside a word is not counted. */
  const curves = count(content, /(?<![A-Za-z-])c(?![A-Za-z])/g);
  const lines = count(content, /(?<![A-Za-z-])l(?![A-Za-z])/g);
  const fills = count(content, /(?<![A-Za-z-])f(?![A-Za-z])/g);
  const fillStroke = count(content, /(?<![A-Za-z-])B(?![A-Za-z])/g);
  const rectOps = count(content, /(?<![A-Za-z-])re(?![A-Za-z-])/g);

  check('(d) PDF draws real curves, not only rectangles', curves >= 8, `${curves} Bézier ops`);
  check('(e) PDF draws stroked path geometry', lines + curves > 20, `${lines} l-ops + ${curves} c-ops`);
  check('(f) PDF paints filled/stroked closed shapes', fills + fillStroke > 0, `${fills} f + ${fillStroke} B`);

  // ── 3. The two exports describe the same symbols ────────────────────────
  const svgCircles = count(svg, /<circle\b/g);
  const svgEllipses = count(svg, /<ellipse\b/g);
  check(
    '(g) SVG carries curved symbol geometry to compare against',
    svgCircles + svgEllipses > 0,
    `circle=${svgCircles} ellipse=${svgEllipses}`,
  );
  // Each circle/ellipse needs 4 cubic Béziers once converted.
  const curvesNeeded = (svgCircles + svgEllipses) * 4;
  check(
    '(h) PDF curve count is consistent with the SVG curved elements',
    curves >= curvesNeeded,
    `pdf curves=${curves} >= needed=${curvesNeeded}`,
  );
  check(
    '(i) drawing carries interior geometry beyond node boxes',
    curves + lines > rectOps,
    `path ops=${curves + lines} vs rect ops=${rectOps}`,
  );

  // ── 4. Text is real text, and bubble codes reach BOTH exports ───────────
  const pdfTextRuns = count(content, /Tj/g);
  const svgTexts = count(svg, /<text\b/g);
  check('(j) PDF carries real text runs, not outlines', pdfTextRuns >= 8, `${pdfTextRuns} Tj ops`);
  check('(k) SVG carries real text elements', svgTexts >= 4, `${svgTexts} <text>`);

  /**
   * The specific regression: the exporters called the symbol geometry with no
   * `label`, so a bubble drew its hardcoded fallback code (every local
   * indicator printing `PI` regardless of its tag) and an off-page connector
   * printed `REF`.
   *
   * The assertion is EXACT — `>TIC<` / `(TIC) Tj` — because a loose `\bTIC\b`
   * test passes on the node's furniture label ("TIC-101 / 101"), which is drawn
   * by separate code and would mask the bug. Verified by mutation: reverting
   * the label fix must fail these checks. It initially did not, which is how
   * the looseness was caught.
   *
   * The bubble's letters are the FUNCTION CODE only (splitTagForBubble), so
   * "TIC" and "PI" each appear alone — their loop numbers are separate runs.
   */
  const svgBubble = (code) => new RegExp(`>${code}<`).test(svg);
  const pdfBubble = (code) => new RegExp(`\\(${code}\\)\\s*Tj`).test(content);
  check(
    '(l) the instrument tag\u2019s function code reaches the SVG export',
    svgBubble('TIC'),
    'exact >TIC< in SVG text (loose match would hit the tag label)',
  );
  check(
    '(m) the instrument tag\u2019s function code reaches the PDF export',
    pdfBubble('TIC'),
    'exact (TIC) Tj run in the PDF content stream',
  );
  check(
    '(n) a second instrument\u2019s own code reaches the exports',
    svgBubble('PI') && pdfBubble('PI'),
    'exact PI in both artifacts (not a shared hardcoded default)',
  );

  // ── 5. Converter coverage over the WHOLE symbol library ─────────────────
  /**
   * Every symbol is serialized and checked for elements the converter would
   * skip. A symbol that silently loses half its geometry in the PDF would be a
   * worse outcome than the bounding boxes this replaced, so new SVG constructs
   * must fail here rather than degrade quietly.
   */
  const coverage = await page.evaluate(async () => {
    const mod = await import('/src/export/pdfVector.ts');
    const symbolsMod = await import('/src/symbols/index.ts');
    const svgMod = await import('/src/export/svgExport.ts');
    const unsupported = [];
    const empty = [];
    let total = 0;
    for (const kind of Object.keys(symbolsMod.symbolsByKind)) {
      const sym = symbolsMod.symbolsByKind[kind];
      const w = sym.defaultWidth || 64;
      const h = sym.defaultHeight || 64;
      const markup = svgMod.symbolMarkup(kind, w, h, 'TIC-101');
      if (!markup) {
        empty.push(kind);
        continue;
      }
      total++;
      const bad = mod.unsupportedElements(markup);
      if (bad.length) unsupported.push(`${kind}:${bad.join('+')}`);
      const body = markup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').trim();
      if (!body) empty.push(kind);
    }
    return { total, unsupported, empty };
  });

  check(
    '(o) every symbol serializes to converter-supported SVG',
    coverage.unsupported.length === 0,
    coverage.unsupported.length
      ? `${coverage.unsupported.length}/${coverage.total} unsupported: ${coverage.unsupported.slice(0, 6).join(' | ')}`
      : `${coverage.total} symbols, all supported`,
  );
  check(
    '(p) the coverage sweep actually covered the library',
    coverage.total >= 60,
    `${coverage.total} symbols serialized`,
  );
  check(
    '(q) no symbol serializes to an empty body',
    coverage.empty.length === 0,
    coverage.empty.length ? `empty: ${coverage.empty.slice(0, 8).join(', ')}` : 'all symbols emit geometry',
  );

  check('(r) no page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pdf-vector checks passed`);
  if (failed.length) {
    console.log('PDFVECTOR_FAIL');
    process.exit(1);
  }
  console.log('PDFVECTOR_PASS');
}

main().catch((e) => {
  console.error('PDFVECTOR_FAIL', e);
  process.exit(1);
});

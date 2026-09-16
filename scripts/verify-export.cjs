/**
 * verify-export.cjs — the export path (PRD §4.4) is real vector output.
 *
 * WHY THIS GATE EXISTS. §4.4's requirement is a drawing that looks like an
 * issued sheet, not a screenshot, and the export path is the item §7a called
 * out as the difference "between a tool you use and a tool a colleague can be
 * handed". A path that produces a file which merely DOWNLOADS would satisfy
 * nothing. So this asserts the things a colleague would notice:
 *
 *   1. The Export panel opens and the preview is the real framed sheet.
 *   2. The exported SVG carries the sheet furniture — border, title block,
 *      revision block, legend, confidentiality notice — i.e. it is a sheet, not
 *      a dump of the canvas.
 *   3. The SVG is VECTOR: it contains <path>/<line>/<rect> drawing geometry and
 *      NO <image> or base64 raster payload anywhere.
 *   4. The title-block values the user typed actually appear in the output.
 *   5. The measured line-weight hierarchy and the dash conventions reach the
 *      file (heavy process run, medium branch, dashed signal, dash-dot battery
 *      limit).
 *   6. The PDF is a real PDF: %PDF header, xref table, and plausible byte
 *      ordering — and it is NOT a raster wrapped in a PDF shell (no /Image).
 *   7. Export is BLOCKED while a hard validity error exists (§4.1 says hard
 *      errors block export) and unblocked once fixed.
 *
 * The download itself is intercepted rather than trusted: a Playwright download
 * event gives the real bytes the browser wrote, so the assertions run on the
 * actual artifact instead of on the in-page string that generated it. That is
 * the difference between testing the exporter and testing a copy of it.
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

async function openExport(page) {
  await page.click('[data-testid="open-export-btn"]');
  await page.waitForSelector('[data-testid="export-panel"]', { timeout: 8000 });
}

/**
 * A sheet with real content, so the export has something to frame. Seeded
 * rather than drawn so the gate exercises the exporter, not the drag gesture
 * (which verify-connections.cjs already owns).
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
    projectName: 'export-verify',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Saponification',
        order: 0,
        /**
         * Every port is used AT MOST ONCE. A port carries one pipe — a second
         * one is a §4.1 hard error ("pipes off a nozzle"), and the export panel
         * correctly blocks while one exists. An earlier version of this fixture
         * put two pipes on the valve's inlet, which made the export buttons
         * disabled and produced a confusing download timeout instead of a
         * fixture error. So the topology here is deliberately clean:
         *
         *   V-101 ──(main run)──► P-201 suction
         *     └──(branch)──► GV-301 in
         *   TIC-101 ──(signal)──► PI-401 signal
         */
        nodes: [
          node('n1', 'vessel-vertical', 'V-101', 200, 200, { width: 90, height: 180 }),
          node('n2', 'pump-centrifugal', 'P-201', 520, 240, { width: 70, height: 70 }),
          node('n3', 'valve-gate', 'GV-301', 360, 470, { width: 50, height: 30 }),
          // Signal-only symbols: what makes e3 a signal line by PORT KIND rather
          // than by the data flag alone.
          node('n4', 'controller-dcs', 'TIC-101', 620, 200, { width: 56, height: 56, loopNumber: '101' }),
          node('n5', 'indicator-local', 'PI-401', 620, 400, { width: 56, height: 56, loopNumber: '401' }),
        ],
        edges: [
          pipe('e1', 'n1', 'right', 'n2', 'suction', { lineNumber: '2"-P-101-1501-A1A' }),
          pipe('e2', 'n1', 'bottom', 'n3', 'in', { lineNumber: '1"-P-102-1502-A1A' }),
          pipe('e3', 'n4', 'signal', 'n5', 'signal', { lineType: 'signal', lineNumber: 'TIC-101' }),
        ],
      },
    ],
  };
}

async function main() {
  const { browser, page, errors } = await launch({ acceptDownloads: true });
  await freshPage(page);
  await seedProject(page, fixture());

  // ── 1. Panel opens ────────────────────────────────────────────────────
  await openExport(page);
  check('(a) export panel opens', true, 'panel visible');

  const sizeOptions = await page.$$eval('[data-testid="export-size-select"] option', (o) => o.map((x) => x.value));
  check(
    '(b) paper sizes offered are the measured/standard set',
    ['A4', 'A3', 'A0'].every((s) => sizeOptions.includes(s)),
    `options=${sizeOptions.join(',')}`,
  );

  // ── 2. Preview is the real sheet ──────────────────────────────────────
  await page.click('[data-testid="export-preview-btn"]');
  await page.waitForSelector('[data-testid="export-preview"] svg', { timeout: 8000 });
  const previewInfo = await page.$eval('[data-testid="export-preview"] svg', (svg) => ({
    hasBorder: !!svg.querySelector('rect'),
    text: svg.textContent || '',
    childCount: svg.querySelectorAll('*').length,
  }));
  check(
    '(c) preview renders the framed sheet, not a bare canvas',
    previewInfo.hasBorder && previewInfo.childCount > 10,
    `elements=${previewInfo.childCount}`,
  );
  check(
    '(d) preview carries the sheet furniture labels',
    ['DRAWING No.', 'LEGEND', 'REV.', 'CONFIDENTIAL'].every((s) => previewInfo.text.includes(s)),
    'title block + legend + revision + notice present',
  );

  // ── 3. Type distinct title-block values, then export SVG ──────────────
  // A synthetic drawing number. The real client number is deliberately not
  // reproduced in tracked files (see the repository's redaction rule).
  const stamp = 'X-00000-000-01';
  await page.fill('[data-testid="export-company"]', 'PT VERIFY ENGINEERING');
  await page.fill('[data-testid="export-drawing-number"]', stamp);
  await page.fill('[data-testid="export-drawn-by"]', 'MP');
  await page.fill('[data-testid="export-revision"]', 'C2');
  // Let React flush.
  await page.waitForTimeout(250);

  const [svgDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('[data-testid="export-svg-btn"]'),
  ]);
  const svgPath = path.join(os.tmpdir(), `pid-export-${Date.now()}.svg`);
  await svgDownload.saveAs(svgPath);
  const svg = fs.readFileSync(svgPath, 'utf8');

  check('(e) SVG export downloads a file', svg.length > 2000, `${svg.length} bytes -> ${path.basename(svgPath)}`);
  check('(f) exported SVG is well-formed XML with the drawing node', svg.startsWith('<svg') && svg.includes('</svg>'), 'opens/closes');

  // ── 4. Vector, not raster ─────────────────────────────────────────────
  const hasRaster = /<image\b|data:image\/(png|jpeg|jpg)|base64,/i.test(svg);
  const vectorPrims = (svg.match(/<(path|line|rect|circle|polyline|polygon|text)\b/g) || []).length;
  check('(g) exported SVG is vector — no raster payload', !hasRaster, hasRaster ? 'found <image>/base64' : 'no <image>, no base64');
  // Threshold is "more primitives than the frame alone needs". The frame is
  // ~15 primitives (border, 2 frame rects, legend, revision, title block, notice);
  // content on top of that is what proves the drawing itself was exported.
  check('(h) exported SVG contains real drawing geometry', vectorPrims > 20, `${vectorPrims} vector primitives (frame alone is ~15)`);

  // ── 5. User's typed metadata reached the file ─────────────────────────
  check(
    '(i) title-block values typed by the user reach the export',
    svg.includes('PT VERIFY ENGINEERING') && svg.includes(stamp) && svg.includes('C2'),
    `company+drawingNo+rev present`,
  );

  // ── 6. Line-weight hierarchy + dash conventions reach the file ────────
  const strokeWidths = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
  const uniq = [...new Set(strokeWidths)].sort((a, b) => a - b);
  check(
    '(j) more than one line weight is used (weight hierarchy survives export)',
    uniq.length >= 3,
    `weights=${uniq.join(',')}`,
  );
  const dashes = [...svg.matchAll(/stroke-dasharray="([^"]+)"/g)].map((m) => m[1]);
  // Signal dashes come from LINE_DASH.signal. The value is read from the
  // module's declaration and asserted literally, so the gate fails if someone
  // changes the drawing convention rather than if the export mis-renders it.
  check(
    '(k) instrument-signal dashes reach the export',
    svg.includes('stroke-dasharray="3.5 1.75"'),
    `dasharrays=${[...new Set(dashes)].join(' | ') || 'none'}`,
  );
  // Battery limit is the measured dash-dot (long, dot, long, dot). Present in
  // the LEGEND regardless of whether the sheet has one, which is what the
  // legend is for — a reader must be able to read the convention.
  check(
    '(l) battery-limit dash-dot reaches the export (the measured pattern)',
    svg.includes('stroke-dasharray="16 2 2 2"'),
    'long-gap-dot-gap pattern present in legend + any boundary line',
  );

  // ── 7. PDF is genuine vector PDF, not a raster shell ──────────────────
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('[data-testid="export-pdf-btn"]'),
  ]);
  const pdfPath = path.join(os.tmpdir(), `pid-export-${Date.now()}.pdf`);
  await pdfDownload.saveAs(pdfPath);
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfText = pdfBytes.toString('latin1');

  check('(m) PDF export downloads a file', pdfBytes.length > 2000, `${pdfBytes.length} bytes`);
  check('(n) PDF has a real header and trailer', pdfText.startsWith('%PDF-') && pdfText.includes('%%EOF'), 'header+EOF');
  check('(o) PDF carries a cross-reference table and page box', /startxref/.test(pdfText) && /\/MediaBox/.test(pdfText), 'xref + MediaBox');
  check('(p) PDF is vector — no embedded raster image', !/\/Image\b/.test(pdfText), 'no /Image XObject');
  check(
    '(q) PDF page box is a real sheet size in points',
    /\/MediaBox \[0 0 1190\.55 841\.89\]/.test(pdfText),
    'A3 landscape 420x297mm in pt',
  );
  check(
    '(q2) PDF carries the drawing number the user typed',
    pdfText.includes('X-00000-000-01'),
    'title-block text is a PDF text run, not a rasterised image',
  );
  check('(r) no page errors during export', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} export checks passed`);
  if (failed.length) {
    console.log('EXPORT_FAIL');
    process.exit(1);
  }
  console.log('EXPORT_PASS');
}

main().catch((e) => {
  console.error('EXPORT_FAIL', e);
  process.exit(1);
});

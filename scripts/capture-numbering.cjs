/** Screenshot the numbering settings panel with a realistic project. */
const { launch, freshPage, seedProject } = require('./harness.cjs');

const node = (id, kind, tag, x, y, w, h) => ({
  id, type: 'equipment', position: { x, y },
  data: { kind, tag, width: w, height: h, rotation: 0, properties: {} },
});

const PROJECT = {
  projectName: 'Numbering — demo',
  // Seeded in the AREA style, because that is the reference drawing's own house
  // convention (P-710.01A, D-710.2.01A) and therefore the one worth looking at.
  numbering: {
    tags: { style: 'area', area: '710', sequencePad: 2, suffix: '', defaultStart: 101, sequenceStart: 1, step: 1, prefixStarts: {} },
    lines: { area: '710', sequenceStart: 1, sequencePad: 2, suffix: '', step: 1, pipingClass: '300', insulation: 'HC', defaultService: 'LPS2', defaultSize: '1 1/2"' },
  },
  sheets: [{
    id: 'sh-1', name: 'Saponification', order: 0,
    nodes: [
      node('n-r', 'reactor-jacketed', 'R-710.01', 80, 120, 110, 200),
      node('n-c', 'column-tray', 'C-710.01', 320, 80, 120, 200),
      node('n-p', 'pump-centrifugal', 'P-710.01A', 600, 200, 70, 70),
      node('n-e', 'heat-exchanger', 'E-710.01', 600, 60, 120, 70),
    ],
    edges: [
      { id: 'e-1', source: 'n-r', target: 'n-c', sourceHandle: 'product', targetHandle: 'feed-lower', type: 'pipe',
        data: { lineType: 'process', lineNumber: '1 1/2"-LPS2-710.01-300-HC', sourceDirection: { x: 0, y: 1 }, targetDirection: { x: -1, y: 0 } } },
      { id: 'e-2', source: 'n-c', target: 'n-p', sourceHandle: 'bottoms', targetHandle: 'suction', type: 'pipe',
        data: { lineType: 'process', sourceDirection: { x: 0, y: 1 }, targetDirection: { x: -1, y: 0 } } },
      { id: 'e-3', source: 'n-c', target: 'n-e', sourceHandle: 'overhead', targetHandle: 'shell-in', type: 'pipe',
        data: { lineType: 'process', sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 } } },
    ],
  }],
};

(async () => {
  const { browser, page, errors } = await launch();
  try {
    await freshPage(page);
    await seedProject(page, PROJECT);
    await page.click('[data-testid="open-numbering-btn"]');
    await page.waitForTimeout(600);
    await page.screenshot({ path: '/tmp/pid-numbering.png' });
    const info = await page.evaluate(() => ({
      tagPreviews: [...document.querySelectorAll('[data-testid="numbering-tag-preview"] code')].map((c) => c.textContent.trim()),
      linePreviews: [...document.querySelectorAll('[data-testid="numbering-line-preview"] code')].map((c) => c.textContent.trim()),
      prefixes: [...document.querySelectorAll('[data-testid^="numbering-prefix-"]')].map((i) => i.getAttribute('data-testid')),
      pattern: document.querySelector('[data-testid="numbering-line-pattern"]')?.textContent?.trim(),
      bulk: document.querySelector('[data-testid="number-unnumbered-btn"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    }));
    console.log('pattern:      ' + info.pattern);
    console.log('tag previews: ' + info.tagPreviews.join(', '));
    console.log('prefix seeds: ' + info.prefixes.join(', '));
    console.log('line previews:'); info.linePreviews.forEach((l) => console.log('  ' + l));
    console.log('bulk button:  ' + info.bulk);
    const real = errors.filter((e) => !/DevTools|favicon/i.test(e));
    console.log('page errors: ' + (real.length ? real.slice(0, 3).join(' | ') : 'none'));
  } finally {
    await browser.close();
  }
})();

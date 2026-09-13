/**
 * Verification for the chemical-engineering data-sheet depth pass.
 *
 * Run: node scripts/verify-datasheets.cjs [url]
 * Exit 0 = all checks pass.
 *
 * The claim being tested is NOT "there are more fields". It is that the sheet
 * shown for a given symbol is the RIGHT sheet — a reactor is asked for
 * conversion and residence time, a strainer for mesh size, an air cooler for
 * fan power — and that the kind-level override actually beats the category
 * default rather than merely existing in the source.
 *
 * The regression risk here is specific and boring: a saved project stores its
 * values keyed by field id, so any id renamed or dropped silently blanks that
 * column of every existing drawing. Check (f) pins the ids that shipped
 * before this pass.
 */
const { launch, freshPage, seedProject, URL: DEFAULT_URL, openNode } = require('./harness.cjs');

const URL = process.argv[2] || DEFAULT_URL;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/** One node per symbol under test, laid out in a row so each is clickable. */
function nodeFor(id, kind, tag, i, props = {}) {
  return {
    id, type: 'equipment', position: { x: 60 + (i % 5) * 220, y: 80 + Math.floor(i / 5) * 200 },
    data: { kind, tag, width: 90, height: 90, rotation: 0, properties: props },
  };
}

const SYMBOLS = [
  ['n-r', 'reactor-jacketed', 'R-101'],
  ['n-c', 'column-tray', 'C-101'],
  ['n-st', 'strainer', 'ST-101'],
  ['n-or', 'restriction-orifice', 'RO-101'],
  ['n-trap', 'steam-trap', 'TR-101'],
  ['n-sb', 'spectacle-blind', 'SB-101'],
  ['n-ac', 'hx-air-cooler', 'E-101'],
  ['n-fh', 'heater-fired', 'H-101'],
  ['n-comp', 'compressor-centrifugal', 'K-101'],
  ['n-relay', 'relay-diamond', 'I-101'],
  ['n-vent', 'vent-terminator', 'VT-101'],
  ['n-pump', 'pump-centrifugal', 'P-101'],
];

const SEED = {
  projectName: 'DataSheet Test',
  sheets: [
    {
      id: 'sh-1', name: 'Sheet 1', order: 0,
      nodes: SYMBOLS.map(([id, kind, tag], i) =>
        nodeFor(id, kind, tag, i, {
          // A pre-existing value on an OLD field id, for the compat check.
          service: kind === 'reactor-jacketed' ? 'Saponification' : undefined,
        }),
      ),
      edges: [],
    },
  ],
};

/**
 * Open a symbol's data sheet.
 *
 * Selector is by SYMBOL KIND (`equipment-node-<kind>`), which is unique per
 * mount in this fixture since every symbol appears exactly once — simpler and
 * more robust than a node id, which isn't exposed on the DOM.
 */
async function openAndReadLabels(page, kind) {
  await page.click(`[data-testid="equipment-node-${kind}"]`);
  await page.waitForSelector('[data-testid="data-sheet-panel"]', { timeout: 4000 });
  await page.waitForTimeout(150);
  return page.evaluate(() => ({
    labels: [...document.querySelectorAll('[data-testid="data-sheet-panel"] .data-sheet-field > span')].map((e) => e.textContent.trim()),
    groups: [...document.querySelectorAll('[data-testid="data-sheet-panel"] .data-sheet-group-heading')].map((e) => e.textContent.trim()),
    ids: [...document.querySelectorAll('[data-testid="data-sheet-panel"] [data-testid^="data-sheet-field-"]')].map((e) =>
      e.getAttribute('data-testid').replace('data-sheet-field-', ''),
    ),
  }));
}

async function closePanel(page) {
  await page.click('[data-testid="data-sheet-panel"] .data-sheet-close').catch(() => {});
  await page.waitForTimeout(120);
}

(async () => {
  const { browser, page, errors } = await launch();
  try {
    await freshPage(page);
    await seedProject(page, SEED);

    // ── (a) Reactors: conversion / residence time / catalyst now present ──
    const r = await openAndReadLabels(page, 'reactor-jacketed');
    check(
      'a. reactor sheet captures reaction engineering (conversion, residence time, catalyst)',
      r.labels.some((l) => /^Conversion per Pass/.test(l)) &&
        r.labels.some((l) => /^Residence Time/.test(l)) &&
        r.labels.some((l) => /^Catalyst Type/.test(l)) &&
        r.labels.some((l) => /^Space Velocity/.test(l)) &&
        r.labels.some((l) => /^Reaction$/.test(l)),
      `${r.labels.length} fields`,
    );

    // ── (b) fields render under section headings, in engineering order ──
    check(
      'b. reactor sheet is sectioned (Process / Reaction / Design / Performance / Mechanical)',
      ['Process', 'Reaction', 'Design', 'Performance', 'Mechanical'].every((g) => r.groups.includes(g)),
      `headings=[${r.groups.join(', ')}]`,
    );

    // ── (c) the old service value survived the schema expansion ──
    const serviceVal = await page.inputValue('[data-testid="data-sheet-field-service"]');
    check(
      'c. existing values still bind to their (unchanged) field id',
      serviceVal === 'Saponification',
      `service="${serviceVal}"`,
    );
    await closePanel(page);

    // ── (d) Column: trays/packing/reflux/stages ──
    const col = await openAndReadLabels(page, 'column-tray');
    check(
      'd. column sheet captures internals and separation duty',
      col.labels.some((l) => /^Theoretical Stages/.test(l)) &&
        col.labels.some((l) => /^Tray Spacing/.test(l)) &&
        col.labels.some((l) => /^Reflux Ratio/.test(l)) &&
        col.labels.some((l) => /^Reboiler Duty/.test(l)) &&
        col.labels.some((l) => /^Packed Height/.test(l)),
      `${col.labels.length} fields`,
    );
    await closePanel(page);

    // ── (e) KIND OVERRIDE BEATS CATEGORY: four piping accessories, four
    //        different sheets, none of them the neutral category default ──
    const stra = await openAndReadLabels(page, 'strainer');
    await closePanel(page);
    const orif = await openAndReadLabels(page, 'restriction-orifice');
    await closePanel(page);
    const trap = await openAndReadLabels(page, 'steam-trap');
    await closePanel(page);
    const blind = await openAndReadLabels(page, 'spectacle-blind');
    await closePanel(page);

    check(
      'e. piping accessories each get their own sheet, not one shared stub',
      stra.labels.some((l) => /^Screen Mesh/.test(l)) &&
        stra.labels.some((l) => /^Strainer Type/.test(l)) &&
        orif.labels.some((l) => /^Orifice Bore/.test(l)) &&
        orif.labels.some((l) => /^Beta Ratio/.test(l)) &&
        trap.labels.some((l) => /^Trap Type/.test(l)) &&
        trap.labels.some((l) => /^Max Discharge Capacity/.test(l)) &&
        blind.labels.some((l) => /^Position/.test(l)) &&
        blind.labels.some((l) => /^Facing/.test(l)),
      `strainer=${stra.labels.length} orifice=${orif.labels.length} trap=${trap.labels.length} blind=${blind.labels.length} fields`,
    );

    // ── (f) Machinery / exchangers also get bespoke sheets ──
    const ac = await openAndReadLabels(page, 'hx-air-cooler');
    await closePanel(page);
    const comp = await openAndReadLabels(page, 'compressor-centrifugal');
    await closePanel(page);
    check(
      'f. air cooler asks for fan data; compressor asks for head/efficiency/seal',
      ac.labels.some((l) => /^Fan Power/.test(l)) &&
        ac.labels.some((l) => /^Approach Temperature/.test(l)) &&
        comp.labels.some((l) => /^Compression Ratio/.test(l)) &&
        comp.labels.some((l) => /^Polytropic Efficiency/.test(l)) &&
        comp.labels.some((l) => /^Seal Type/.test(l)),
      `aircooler=${ac.labels.length} compressor=${comp.labels.length} fields`,
    );

    // ── (g) COMPATIBILITY: no field id from the pre-change schema was
    //        renamed or dropped.
    //
    // Checked at the SOURCE level against the last commit rather than through
    // the DOM, because the DOM can only show ids reachable from the symbols
    // this fixture happens to mount — a dropped id on an unmounted category
    // would sail past. A saved project stores values keyed by field id, so
    // losing one silently blanks that column of every existing drawing.
    const { execSync } = require('child_process');
    const prevSrc = execSync('git show HEAD:src/dataSheet/fieldSchemas.ts', {
      cwd: process.cwd(), encoding: 'utf8',
    });
    const idsIn = (src) => new Set([...src.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]));
    const prevIds = idsIn(prevSrc);
    const nowIds = idsIn(require('fs').readFileSync('src/dataSheet/fieldSchemas.ts', 'utf8'));
    const dropped = [...prevIds].filter((id) => !nowIds.has(id));
    check(
      'g. no field id from the previous schema was renamed or dropped',
      dropped.length === 0,
      dropped.length
        ? `DROPPED (breaks saved projects): ${dropped.join(', ')}`
        : `${prevIds.size} legacy ids all intact; schema grew to ${nowIds.size} ids (+${nowIds.size - prevIds.size})`,
    );

    const pageErrs = errors.filter((e) => !/DevTools|favicon/i.test(e));
    if (pageErrs.length) console.log('\npage errors: ' + pageErrs.slice(0, 4).join(' | '));

    const failed = results.filter((x) => !x.pass);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    console.log(failed.length === 0 && pageErrs.length === 0 ? 'DATASHEETS_PASS' : 'DATASHEETS_FAIL');
    process.exitCode = failed.length === 0 && pageErrs.length === 0 ? 0 : 1;
  } catch (e) {
    console.error('runner error:', e.message);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();

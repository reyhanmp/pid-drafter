/**
 * Port-vs-outline conformance GATE — runs the in-browser probe
 * (scripts/port-outline-probe.js) against EVERY symbol in the registry.
 *
 * Usage: node scripts/verify-port-outline.cjs [url]
 * Exit 0 = all ports land on painted ink. Exit 1 = at least one failure.
 *
 * Why this exists: the probe is the objective acceptance gate for symbol
 * authoring. A port may sit exactly on the declared bounding box and still
 * float in empty space beside the drawn shape (the "nozzle floats off the
 * vessel" defect fixed in c5efcd7). Bounding box != drawn outline, so the
 * gate must measure ink, not boxes.
 */
const fs = require('fs');
const path = require('path');
const { launch, freshPage, seedProject, URL: DEFAULT_URL } = require('./harness.cjs');

const URL = process.argv[2] || DEFAULT_URL;
const REPO = path.resolve(__dirname, '..');

/** Read the registry's kinds straight from source, so this can never drift. */
function registryKinds() {
  const src = fs.readFileSync(path.join(REPO, 'src/symbols/index.ts'), 'utf8');
  const block = src.match(/export const allSymbols[\s\S]*?\n\];/)[0];
  const idents = [...block.matchAll(/^\s+(\w+),/gm)].map((m) => m[1]);
  const kindOf = {};
  for (const m of src.matchAll(/^import (\w+) from '\.\/([\w-]+)';/gm)) kindOf[m[1]] = m[2];
  return idents.map((i) => kindOf[i]);
}

/**
 * Read defaultWidth/Height per symbol so the seed nodes are correctly sized.
 *
 * THROWS when a size cannot be read as a literal. It must not fall back to a
 * guessed 80x80: the probe converts every screen measurement back to node-local
 * units using these numbers, so a wrong size turns a correctly drawn symbol into
 * a reported geometry defect. That is a LYING gate, which is worse than a
 * missing one — it sends the author to fix geometry that is already right. A
 * computed `defaultWidth: SIZE` is the way this happens in practice; the fix is
 * to write the literals.
 */
function defaultsFor(kinds) {
  const out = {};
  const unreadable = [];
  for (const kind of kinds) {
    const s = fs.readFileSync(path.join(REPO, 'src/symbols', `${kind}.tsx`), 'utf8');
    const w = s.match(/defaultWidth:\s*(\d+)/);
    const h = s.match(/defaultHeight:\s*(\d+)/);
    if (!w || !h) {
      unreadable.push(kind);
      continue;
    }
    out[kind] = { w: +w[1], h: +h[1] };
  }
  if (unreadable.length) {
    throw new Error(
      `cannot read defaultWidth/Height from: ${unreadable.join(', ')}. ` +
        'The probe needs those numbers to measure ports in node-local units; ' +
        'a guessed size reports a false port geometry failure. Write them as literals.',
    );
  }
  return out;
}

/**
 * The probe reads `window.__SYMBOLS_BY_KIND[kind].defaultWidth` to convert
 * screen-space measurements back to node-local units. The app does not expose
 * that global (it is not needed at runtime), so the runner synthesizes a
 * minimal stand-in from the source files it already parsed.
 */
function dimsToDefs(dims) {
  return Object.fromEntries(Object.entries(dims).map(([k, d]) => [k, { defaultWidth: d.w, defaultHeight: d.h }]));
}

(async () => {
  const kinds = registryKinds();
  const dims = defaultsFor(kinds);
  const { browser, page, errors } = await launch();
  try {
    await page.goto(URL, { waitUntil: 'load' });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.react-flow__pane');

    // Lay every symbol out on a roomy grid so each node is genuinely mounted.
    const nodes = [];
    const COLS = 8;
    const STEP_X = 260;
    const STEP_Y = 300;
    kinds.forEach((kind, i) => {
      nodes.push({
        id: `probe-${kind}`,
        type: 'equipment',
        position: { x: (i % COLS) * STEP_X, y: Math.floor(i / COLS) * STEP_Y },
        data: {
          kind,
          tag: `X-${i}`,
          width: dims[kind].w,
          height: dims[kind].h,
          rotation: 0,
          properties: {},
        },
      });
    });
    await seedProject(page, { projectName: 'probe', sheets: [{ id: 's1', name: 'Sheet 1', order: 0, nodes, edges: [] }] });

    // Fit the view so all nodes are within the viewport (react-flow only paints
    // what is in view; the probe reads live DOM geometry).
    await page.evaluate(() => {
      const el = document.querySelector('.react-flow');
      if (el) el.style.height = '1000px';
    });
    await page.keyboard.press('Control+Shift+F'); // fitView binding if present
    await page.waitForTimeout(400);

    const missing = await page.evaluate((ks) => {
      return ks.filter((k) => !document.querySelector(`[data-testid="equipment-node-${k}"]`));
    }, kinds);

    // Inject + run the probe.
    // The probe normalizes screen measurements back to node-local units using
    // `def.defaultWidth`; without this map it falls back to scale=1 and every
    // distance is reported in raw screen px (bogus at any zoom != 1).
    await page.evaluate((map) => {
      window.__SYMBOLS_BY_KIND = map;
    }, dimsToDefs(dims));

    const probeSrc = fs.readFileSync(path.join(__dirname, 'port-outline-probe.js'), 'utf8');
    await page.addScriptTag({ content: probeSrc });
    const raw = await page.evaluate((ks) => window.__portOutlineProbe(ks), kinds);
    const results = JSON.parse(raw);

    const notMounted = results.filter((r) => r.error);
    const failed = results.filter((r) => r.failing && r.failing.length > 0);
    const totalPorts = results.reduce((a, r) => a + (r.ports ? r.ports.length : 0), 0);

    console.log(`symbols in registry : ${kinds.length}`);
    console.log(`measured            : ${results.length - notMounted.length}`);
    console.log(`ports measured      : ${totalPorts}`);
    console.log(`not mounted         : ${notMounted.length}${notMounted.length ? ' -> ' + notMounted.map((r) => r.kind).join(', ') : ''}`);
    console.log(`failing symbols     : ${failed.length}${failed.length ? ' -> ' + failed.map((r) => r.kind).join(', ') : ''}`);
    if (missing.length) console.log(`never hit the DOM   : ${missing.join(', ')}`);

    if (failed.length) {
      console.log('\n--- FAILURES (port does not land on painted ink) ---');
      for (const r of failed) {
        console.log(`\n${r.kind}`);
        for (const f of r.failing) {
          console.log(`   port "${f.id}" (${f.pos}) at local ${JSON.stringify(f.local)}  dist=${f.distToOutline}px  tol=${f.tol}px`);
        }
      }
    }

    const pageErrs = errors.filter((e) => !/DevTools|favicon|React DevTools/i.test(e));
    if (pageErrs.length) console.log('\npage errors: ' + pageErrs.slice(0, 5).join(' | '));

    const ok = failed.length === 0 && notMounted.length === 0;
    console.log('\n' + (ok ? 'PORT_OUTLINE_PASS' : 'PORT_OUTLINE_FAIL'));
    process.exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('probe runner error:', e.message);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();

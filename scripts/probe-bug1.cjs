/**
 * BUG 1 geometry proof — measures, in a real browser at two zoom levels
 * and for all four port directions on two different symbol kinds:
 *   (a) the declared port point (node rect + declared local port x/y),
 *   (b) the rendered <Handle> element's React Flow anchor edge,
 *   (c) the flange glyph's own center,
 *   (d) the connected pipe path's actual first/last point,
 * and reports the pixel deltas between them.
 *
 * Usage: node scripts/probe-bug1.cjs
 */
const { launch, freshPage, seedProject } = require('./harness.cjs');

const HANDLE_SIZE = 8;

function handleBox(position, x, y) {
  switch (position) {
    case 'bottom': return { left: x - HANDLE_SIZE / 2, top: y - HANDLE_SIZE };
    case 'top': return { left: x - HANDLE_SIZE / 2, top: y };
    case 'left': return { left: x, top: y - HANDLE_SIZE / 2 };
    default: return { left: x - HANDLE_SIZE, top: y - HANDLE_SIZE / 2 };
  }
}

function mkNode(id, kind, pos, w, h, ports) {
  return {
    id, type: 'equipment', position: pos,
    handles: ports.map((p) => {
      const b = handleBox(p.pos, p.x, p.y);
      return { id: p.id, x: b.left, y: b.top, position: p.pos, type: 'source', width: HANDLE_SIZE, height: HANDLE_SIZE };
    }),
    data: { kind, tag: id, width: w, height: h, ports: ports.map((p) => ({ id: p.id, label: p.id, x: p.x, y: p.y, direction: p.dir, kind: 'process' })) },
  };
}

/** Vessel 90x180 (ports on box corners), pump 70x70 (ports inset on drawn circle). */
const VESSEL_PORTS = [
  { id: 'top', x: 45, y: 0, pos: 'top', dir: { x: 0, y: -1 } },
  { id: 'bottom', x: 45, y: 180, pos: 'bottom', dir: { x: 0, y: 1 } },
  { id: 'left', x: 0, y: 90, pos: 'left', dir: { x: -1, y: 0 } },
  { id: 'right', x: 90, y: 90, pos: 'right', dir: { x: 1, y: 0 } },
];
const PUMP_PORTS = [
  { id: 'suction', x: 0, y: 35, pos: 'left', dir: { x: -1, y: 0 } },
  { id: 'discharge', x: 70, y: 35, pos: 'right', dir: { x: 1, y: 0 } },
];

const project = {
  projectName: 'probe-bug1',
  sheets: [{
    id: 'sheet-probe', name: 'Probe', order: 0,
    nodes: [
      mkNode('v1', 'vessel-vertical', { x: 300, y: 200 }, 90, 180, VESSEL_PORTS),
      mkNode('p1', 'pump-centrifugal', { x: 800, y: 260 }, 70, 70, PUMP_PORTS),
      mkNode('v2', 'vessel-vertical', { x: 300, y: 700 }, 90, 180, VESSEL_PORTS),
    ],
    edges: [
      {
        id: 'pipe-v1-right-p1-suction', source: 'v1', target: 'p1',
        sourceHandle: 'right', targetHandle: 'suction', type: 'pipe', data: { lineType: 'process', sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 } },
      },
      {
        id: 'pipe-v2-top-p1-discharge', source: 'v2', target: 'p1',
        sourceHandle: 'top', targetHandle: 'discharge', type: 'pipe', data: { lineType: 'process', sourceDirection: { x: 0, y: -1 }, targetDirection: { x: 1, y: 0 } },
      },
    ],
  }],
};

async function measure(page, tag) {
  return page.evaluate(() => {
    const zoom = (() => {
      const vp = document.querySelector('.react-flow__viewport');
      const m = new DOMMatrixReadOnly(getComputedStyle(vp).transform);
      return m.m22;
    })();

    const portPoints = {
      'v1:top': [45, 0], 'v1:bottom': [45, 180], 'v1:left': [0, 90], 'v1:right': [90, 90],
      'p1:suction': [0, 35], 'p1:discharge': [70, 35],
      'v2:top': [45, 0], 'v2:bottom': [45, 180],
    };
    const nodeIds = { v1: 'v1', p1: 'p1', v2: 'v2' };

    const out = { zoom, ports: {}, pipes: {} };

    for (const key of Object.keys(portPoints)) {
      const [nodeId, portId] = key.split(':');
      const nodeEl = document.querySelector(`.react-flow__node[data-id="${nodeIds[nodeId]}"]`);
      if (!nodeEl) continue;
      const nr = nodeEl.getBoundingClientRect();
      const [lx, ly] = portPoints[key];
      const declared = { x: nr.left + lx * zoom, y: nr.top + ly * zoom };

      const handleEl = nodeEl.querySelector(`.react-flow__handle[data-handleid="${portId}"]`);
      let handleAnchor = null;
      let handleRect = null;
      if (handleEl) {
        const hr = handleEl.getBoundingClientRect();
        handleRect = { left: hr.left, top: hr.top, w: hr.width, h: hr.height };
        const pos = handleEl.getAttribute('data-handlepos');
        if (pos === 'top') handleAnchor = { x: hr.left + hr.width / 2, y: hr.top };
        else if (pos === 'bottom') handleAnchor = { x: hr.left + hr.width / 2, y: hr.bottom };
        else if (pos === 'left') handleAnchor = { x: hr.left, y: hr.top + hr.height / 2 };
        else handleAnchor = { x: hr.right, y: hr.top + hr.height / 2 };
        // handle CENTER too, for reference
        handleRect.cx = hr.left + hr.width / 2;
        handleRect.cy = hr.top + hr.height / 2;
      }

      const flangeEl = nodeEl.querySelector(`[data-testid="nozzle-flange-${portId}"]`);
      let flange = null;
      if (flangeEl) {
        const fr = flangeEl.getBoundingClientRect();
        flange = { cx: fr.left + fr.width / 2, cy: fr.top + fr.height / 2, w: fr.width, h: fr.height };
      }

      out.ports[key] = { declared, handleAnchor, handleRect, flange };
    }

    for (const pathEl of document.querySelectorAll('.react-flow__edge-path')) {
      const edgeIdx = pathEl.closest('.react-flow__edge')?.getAttribute('data-id') || 'unknown';
      const total = pathEl.getTotalLength();
      const m = pathEl.getScreenCTM();
      const toScreen = (pt) => ({ x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f });
      out.pipes[edgeIdx] = {
        d: pathEl.getAttribute('d'),
        start: toScreen(pathEl.getPointAtLength(0)),
        end: toScreen(pathEl.getPointAtLength(total)),
      };
    }
    return out;
  });
}

function delta(a, b) {
  if (!a || !b) return null;
  return { dx: +(a.x - b.x).toFixed(3), dy: +(a.y - b.y).toFixed(3) };
}

function check(label, a, b) {
  const d = delta(a, b);
  if (!d) return `${label}: MISSING`;
  const ok = Math.abs(d.dx) < 0.5 && Math.abs(d.dy) < 0.5;
  return `${ok ? 'PASS' : 'FAIL'} ${label}: dx=${d.dx} dy=${d.dy}`;
}

(async () => {
  const { browser, page, errors } = await launch();
  await page.goto('http://127.0.0.1:5199/', { waitUntil: 'load' });
  await page.evaluate(() => window.localStorage.clear());
  await seedProject(page, project);

  let fails = 0;
  for (const zoomStep of ['default', 'zoomed']) {
    if (zoomStep === 'zoomed') {
      // zoom in using the Controls' zoom-in button twice
      for (let i = 0; i < 2; i++) { await page.click('.react-flow__controls-zoomin'); await page.waitForTimeout(250); }
      await page.waitForTimeout(500);
    }
    const m = await measure(page, zoomStep);
    console.log(`\n=== zoom=${zoomStep} (viewport scale ${m.zoom.toFixed(4)}) ===`);
    for (const key of Object.keys(m.ports)) {
      const p = m.ports[key];
      if (!p.handleAnchor) { console.log(`  ${key}: NO HANDLE`); continue; }
      const lines = [
        `${key} declared=(${p.declared.x.toFixed(2)},${p.declared.y.toFixed(2)})`,
        `handleAnchor=(${p.handleAnchor.x.toFixed(2)},${p.handleAnchor.y.toFixed(2)})`,
        p.flange ? `flangeCenter=(${p.flange.cx.toFixed(2)},${p.flange.cy.toFixed(2)})` : 'flange=MISSING',
      ];
      const r1 = check('  declared->handleAnchor', p.handleAnchor, p.declared);
      const r2 = p.flange ? check('  declared->flangeCenter', { x: p.flange.cx, y: p.flange.cy }, p.declared) : 'FAIL flange missing';
      if (r1.startsWith('FAIL') || r2.startsWith('FAIL')) fails++;
      console.log('  ' + lines.join('\n  '));
      console.log('  ' + r1 + '\n  ' + r2);
    }
    for (const [eid, pipe] of Object.entries(m.pipes)) {
      const isSource = eid.includes('v1-right') || eid.includes('v2-top');
      // compare pipe start to the source port of the edge
      let key = null;
      if (eid.includes('v1-right')) key = 'v1:right';
      else if (eid.includes('v2-top')) key = 'v2:top';
      else if (eid.includes('p1-suction')) key = 'p1:suction';
      if (!key || !m.ports[key]) continue;
      const ref = m.ports[key].declared;
      const pt = isSource ? pipe.start : pipe.end;
      const r = check(`pipe ${eid} ${isSource ? 'start' : 'end'} vs declared ${key}`, pt, ref);
      if (r.startsWith('FAIL')) fails++;
      console.log(`  d=${pipe.d}`);
      console.log('  ' + r);
    }
  }

  console.log('\nerrors:', errors.length ? errors : 'none');
  console.log(fails === 0 ? '\nALL BUG-1 GEOMETRY CHECKS PASS' : `\n${fails} FAILURES`);
  await browser.close();
})();

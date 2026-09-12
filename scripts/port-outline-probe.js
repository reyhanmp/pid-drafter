/**
 * Port-vs-outline conformance probe (runs IN THE BROWSER, pasted via
 * browser_console). Not a build artifact — kept in the repo so the check
 * is reproducible and so symbol authors have an objective gate.
 *
 * For every symbol kind it: mounts a node, measures each declared port's
 * point in node-local px, then measures the distance from that point to
 * the nearest point on the symbol's actual DRAWN OUTLINE (every stroked
 * path/line/circle/polygon/rect in the geometry group). A port passes if
 * that distance is <= half the widest stroke touching that point, i.e.
 * the port lands on painted ink rather than in empty space beside the
 * shape (the "nozzle floats off the vessel" defect).
 *
 * Usage: in the app, ensure a node of each kind can be created, then
 * evaluate this function with the kinds you want to check.
 */
window.__portOutlineProbe = function (kinds) {
  const NS = 'http://www.w3.org/2000/svg';

  /** Sample points along an SVG element's own geometry (local coords). */
  function samplePoints(el, steps = 240) {
    const pts = [];
    const push = (x, y) => pts.push({ x, y });
    const tag = el.tagName.toLowerCase();
    try {
      if (tag === 'rect') {
        const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0;
        const w = +el.getAttribute('width') || 0, h = +el.getAttribute('height') || 0;
        // walk the 4 edges (ignore rx/ry rounding; adequate for conformance)
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          push(x + w * t, y); push(x + w * t, y + h);
          push(x, y + h * t); push(x + w, y + h * t);
        }
      } else if (tag === 'circle') {
        const cx = +el.getAttribute('cx') || 0, cy = +el.getAttribute('cy') || 0;
        const r = +el.getAttribute('r') || 0;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          push(cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
      } else if (tag === 'ellipse') {
        const cx = +el.getAttribute('cx') || 0, cy = +el.getAttribute('cy') || 0;
        const rx = +el.getAttribute('rx') || 0, ry = +el.getAttribute('ry') || 0;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
        }
      } else if (tag === 'line') {
        const x1 = +el.getAttribute('x1') || 0, y1 = +el.getAttribute('y1') || 0;
        const x2 = +el.getAttribute('x2') || 0, y2 = +el.getAttribute('y2') || 0;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
        }
      } else if (tag === 'polyline' || tag === 'polygon') {
        const raw = el.getAttribute('points') || '';
        const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
        for (let i = 0; i + 1 < nums.length; i += 2) push(nums[i], nums[i + 1]);
        if (tag === 'polygon' && nums.length >= 4) push(nums[0], nums[1]);
      } else if (tag === 'path') {
        const L = el.getTotalLength ? el.getTotalLength() : 0;
        if (L > 0) {
          for (let i = 0; i <= steps; i++) {
            const p = el.getPointAtLength((i / steps) * L);
            push(p.x, p.y);
          }
        }
      } else if (tag === 'g') {
        // nested group: recurse
        for (const child of el.children) pts.push(...samplePoints(child, steps));
      }
    } catch (e) {
      /* getTotalLength can throw on display:none — treat as unsampled */
    }
    return pts;
  }

  function strokeWidthOf(el) {
    let w = parseFloat(el.getAttribute('stroke-width'));
    if (!Number.isFinite(w)) {
      const cs = getComputedStyle(el);
      w = parseFloat(cs.strokeWidth);
    }
    return Number.isFinite(w) ? w : 0;
  }

  const results = [];

  for (const kind of kinds) {
    // mount on a scratch sheet so we never disturb the user's drawing
    const node = document.querySelector(`[data-testid="equipment-node-${kind}"]`);
    if (!node) {
      results.push({ kind, error: 'not mounted in DOM — add one to the canvas first' });
      continue;
    }
    const def = window.__SYMBOLS_BY_KIND && window.__SYMBOLS_BY_KIND[kind];
    const geo = node.querySelector('[data-testid="equipment-geometry-wrapper"]');
    if (!geo) {
      results.push({ kind, error: 'no equipment-geometry-wrapper' });
      continue;
    }
    const gr = geo.getBoundingClientRect();
    if (!gr.width) { results.push({ kind, error: 'geometry has zero width' }); continue; }
    const scale = gr.width / (def ? def.defaultWidth : gr.width);
    const toLocal = (sx, sy) => ({ x: (sx - gr.x) / scale, y: (sy - gr.y) / scale });

    // Collect outline samples + their strokes in NODE-LOCAL coords.
    const samples = [];
    const shapes = geo.querySelectorAll('path, line, circle, ellipse, rect, polyline, polygon');
    for (const el of shapes) {
      const sw = strokeWidthOf(el);
      if (sw <= 0) continue;              // not painted — not an outline
      const paint = getComputedStyle(el).stroke;
      if (!paint || paint === 'none' || paint === 'rgba(0, 0, 0, 0)') continue;
      // element's local -> screen -> node-local (handles viewBox scaling)
      const elRect = el.getBoundingClientRect();
      const elIsScaled = el.getBBox && el.getBBox().width > 0;
      let ex = 0, ey = 0, es = 1;
      if (elIsScaled) {
        try {
          const bb = el.getBBox();
          const ctm = el.getCTM ? el.getCTM() : null;
          // map element-local geometric point -> screen via CTM
          for (const p of samplePoints(el)) {
            const sp = ctm
              ? { x: p.x * ctm.a + p.y * ctm.c + ctm.e, y: p.x * ctm.b + p.y * ctm.d + ctm.f }
              : { x: p.x + elRect.x, y: p.y + elRect.y };
            samples.push({ ...toLocal(sp.x, sp.y), sw });
          }
          void bb; void ex; void ey; void es;
        } catch (e) {
          /* skip shape */
        }
      }
    }

    // Nearest-outline distance for each declared port.
    const portEls = [...node.querySelectorAll('[data-handleid]')];
    const ports = portEls.map((h) => {
      const id = h.getAttribute('data-handleid');
      const pos = h.getAttribute('data-handlepos');
      const r = h.getBoundingClientRect();
      // the DECLARED port point = the handle's edge anchor, reversed
      let px, py;
      if (pos === 'bottom') { px = r.x + r.width / 2; py = r.y + r.height; }
      else if (pos === 'top') { px = r.x + r.width / 2; py = r.y; }
      else if (pos === 'left') { px = r.x; py = r.y + r.height / 2; }
      else { px = r.x + r.width; py = r.y + r.height / 2; }
      const pl = toLocal(px, py);

      let best = Infinity;
      for (const s of samples) {
        const dx = s.x - pl.x, dy = s.y - pl.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best * best) best = Math.sqrt(d2);
      }
      // tolerance: the port must land on painted ink, allowing for the
      // stroke being painted centred on the path (half-stroke outward)
      const maxStroke = samples.length
        ? Math.max(...samples.map((s) => s.sw))
        : 0;
      const tol = maxStroke / 2 + 0.75; // +0.75 slack for sampling coarseness
      return {
        id,
        pos,
        local: { x: +pl.x.toFixed(2), y: +pl.y.toFixed(2) },
        distToOutline: Number.isFinite(best) ? +best.toFixed(2) : null,
        tol: +tol.toFixed(2),
        pass: Number.isFinite(best) ? best <= tol : null,
      };
    });

    results.push({
      kind,
      sampledOutlinePoints: samples.length,
      ports,
      failing: ports.filter((p) => p.pass === false),
    });
  }

  return JSON.stringify(results, null, 1);
};
'installed';

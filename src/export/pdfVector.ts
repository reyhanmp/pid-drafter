/**
 * SVG geometry → PDF content-stream operators.
 *
 * WHY THIS MODULE EXISTS
 *
 * The PDF export used to represent every equipment symbol as its bounding box,
 * and re-derive the symbol's text from the model with its own regexes. Both
 * halves of that were wrong in the same way: the SVG export already serializes
 * each symbol's real geometry by invoking its React component
 * (`renderToStaticMarkup` in svgExport.ts), and a second, hand-written
 * derivation of the same information is a copy that can drift — the PDF's
 * instrument-bubble letters were computed from `data.tag` with a pattern that
 * had to keep matching `splitTagForBubble` in isaBubble.tsx, and nothing
 * enforced that it did.
 *
 * So the PDF consumes the same serialized symbol geometry the SVG does. One
 * serializer, two back ends. A symbol's interior cannot differ between the two
 * artifacts because there is only one description of it.
 *
 * SCOPE: this is deliberately NOT a general SVG renderer. It covers the subset
 * the symbol library actually emits, which was measured rather than assumed —
 * across the 69 symbols the only elements are `line`, `path`, `rect`, `circle`,
 * `ellipse`, `polyline`, `g` and `text`; there is no CSS, no `class` attribute,
 * no gradient, no clip path, no filter, and no nested viewport. Path data uses
 * only M/L/A/Z plus Q and C (A appears in the domed ends of vessels). Anything
 * outside that subset is skipped rather than mis-drawn, and
 * `unsupportedElements()` reports what was skipped so a gate can fail loudly if
 * a future symbol introduces something new — silently dropping part of a symbol
 * would be worse than the box it replaced.
 */

/** A 2D affine transform, SVG convention: (x,y) -> (a*x + c*y + e, b*x + d*y + f). */
export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Apply `m` to a point. */
export function apply(m: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/** Compose: the result applies `outer` to the output of `inner`. */
export function compose(outer: Matrix, inner: Matrix): Matrix {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

/** Uniform scale factor of the matrix, for stroke widths and font sizes. */
export function scaleOf(m: Matrix): number {
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
}

/**
 * Parse an SVG `transform` attribute into a matrix.
 *
 * Supported because they are the ones present (or plausibly present) in the
 * symbol library: translate, scale, rotate, matrix. Composed left-to-right,
 * which is the SVG rule.
 */
export function parseTransform(value: string | undefined): Matrix {
  if (!value) return IDENTITY;
  let out = IDENTITY;
  const re = /(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    const args = m[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((x) => Number.isFinite(x));
    let next = IDENTITY;
    switch (m[1]) {
      case 'translate':
        next = { a: 1, b: 0, c: 0, d: 1, e: args[0] ?? 0, f: args[1] ?? 0 };
        break;
      case 'scale': {
        const sx = args[0] ?? 1;
        const sy = args[1] ?? sx;
        next = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
        break;
      }
      case 'rotate': {
        const deg = args[0] ?? 0;
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rot: Matrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
        if (args.length >= 3) {
          // rotate(angle cx cy) — rotate about a point.
          const about = compose(compose({ a: 1, b: 0, c: 0, d: 1, e: args[1], f: args[2] }, rot), {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: -args[1],
            f: -args[2],
          });
          next = about;
        } else {
          next = rot;
        }
        break;
      }
      case 'matrix':
        if (args.length >= 6) next = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
        break;
      case 'skewX':
        next = { a: 1, b: 0, c: Math.tan(((args[0] ?? 0) * Math.PI) / 180), d: 1, e: 0, f: 0 };
        break;
      case 'skewY':
        next = { a: 1, b: Math.tan(((args[0] ?? 0) * Math.PI) / 180), c: 0, d: 1, e: 0, f: 0 };
        break;
      default:
        break;
    }
    out = compose(out, next);
  }
  return out;
}

/**
 * Elements this converter knows how to draw.
 *
 * `svg` and `g` are both handled as transform/namespace wrappers (the symbol's
 * outer `<svg>` is stripped by the caller, but a bare fragment could still
 * carry one, and the recursive `g` case is the same code path).
 */
const SUPPORTED = new Set([
  'svg',
  'g',
  'line',
  'rect',
  'circle',
  'ellipse',
  'polyline',
  'polygon',
  'path',
  'text',
]);

/** Elements present in `markup` that the converter would skip. */
export function unsupportedElements(markup: string): string[] {
  const found = new Set<string>();
  const re = /<([a-zA-Z][\w:-]*)[\s/>]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    const name = m[1].toLowerCase();
    if (!SUPPORTED.has(name)) found.add(name);
  }
  return [...found];
}

/** Read one attribute value from a raw element tag string. */
function attr(tag: string, name: string): string | undefined {
  // Attribute values in the serialized output are quoted (double quotes from
  // React's serializer), so a quoted-only match is sufficient and avoids
  // mis-reading an unquoted value that happens to contain the name.
  const re = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`);
  const m = re.exec(tag);
  return m ? m[1] : undefined;
}

function num(tag: string, name: string, fallback = 0): number {
  const v = attr(tag, name);
  if (v === undefined) return fallback;
  const parsed = Number.parseFloat(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Style carried down the element tree, as PDF operator values. */
interface Style {
  /** Stroke colour as PDF "r g b" in 0..1, or null for no stroke. */
  stroke: string | null;
  /** Fill colour as PDF "r g b" in 0..1, or null for no fill. */
  fill: string | null;
  strokeWidth: number;
  /** PDF dash operator, or null. */
  dash: string | null;
}

const DEFAULT_STYLE: Style = { stroke: '0.1 0.1 0.1', fill: null, strokeWidth: 1, dash: null };

/** CSS colour names that can appear in the symbol library. */
const NAMED: Record<string, [number, number, number]> = {
  none: [-1, -1, -1],
  white: [1, 1, 1],
  black: [0, 0, 0],
};

/** Convert a colour to PDF's "r g b" form, or null when it means "none". */
function pdfColor(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return null;
  if (v in NAMED) {
    const [r, g, b] = NAMED[v];
    if (r < 0) return null;
    return `${r} ${g} ${b}`;
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return `${round(r)} ${round(g)} ${round(b)}`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(v);
  if (rgb) {
    const parts = rgb[1].split(/[\s,]+/).map(Number);
    return `${round((parts[0] ?? 0) / 255)} ${round((parts[1] ?? 0) / 255)} ${round((parts[2] ?? 0) / 255)}`;
  }
  // Unknown colour syntax: fall back to the drawing ink rather than dropping
  // the element, so a symbol cannot vanish because of a colour format.
  return '0.1 0.1 0.1';
}

function round(v: number): string {
  return (Math.round(v * 1000) / 1000).toString();
}

function fmt(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

/** Read the style attributes on an element, inheriting from the parent. */
function styleOf(tag: string, parent: Style, ownScale: number): Style {
  const strokeAttr = attr(tag, 'stroke');
  const fillAttr = attr(tag, 'fill');
  const stroke = strokeAttr === undefined ? parent.stroke : pdfColor(strokeAttr) ?? null;
  const fill = fillAttr === undefined ? parent.fill : pdfColor(fillAttr) ?? null;
  const swAttr = attr(tag, 'stroke-width');
  const sw = swAttr === undefined ? parent.strokeWidth : Number.parseFloat(swAttr);
  const dash = attr(tag, 'stroke-dasharray');
  return {
    stroke,
    fill,
    // A stroke width in user units becomes PDF points via the element's own
    // scale, so a scaled symbol keeps its relative line weights.
    strokeWidth: (Number.isFinite(sw) ? sw : parent.strokeWidth) * ownScale,
    dash: dash === undefined ? parent.dash : dashToPdf(dash, ownScale),
  };
}

/** SVG dasharray (user units) to a PDF dash operator (points). */
export function dashToPdf(dash: string, scale: number): string | null {
  const parts = dash
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((x) => Number.isFinite(x) && x > 0);
  if (!parts.length) return null;
  return `[${parts.map((p) => fmt(p * scale)).join(' ')}] 0 d`;
}

/** Emit the paint operator for a path, honouring fill and stroke. */
function paint(out: string[], style: Style): void {
  const hasFill = style.fill !== null;
  const hasStroke = style.stroke !== null && style.strokeWidth > 0;
  // B = fill then stroke; f = fill only; S = stroke only. A closed path that is
  // stroked but not filled uses S, which is the case that matters here: a
  // vessel outline is a stroked closed path with fill="none".
  if (hasFill && hasStroke) out.push('B');
  else if (hasFill) out.push('f');
  else if (hasStroke) out.push('S');
  // Neither: the element is invisible, which is legitimate (a `<line>` used as
  // a spacer, or a fill=none stroke=none placeholder). Emit nothing.
}

/** Set up the graphics state for one element. */
function begin(out: string[], style: Style): void {
  out.push('q');
  if (style.stroke) out.push(`${style.stroke} RG`);
  if (style.fill) out.push(`${style.fill} rg`);
  out.push(`${fmt(Math.max(0.1, style.strokeWidth))} w`);
  if (style.dash) out.push(style.dash);
  out.push('1 J');
  out.push('1 j');
}

function end(out: string[]): void {
  out.push('Q');
}

/**
 * Append a straight segment.
 *
 * The matrix is applied numerically rather than emitted as a PDF `cm`, so every
 * coordinate in the stream is absolute. That keeps the geometry debuggable (a
 * coordinate in the file maps directly to a page point) and means non-uniform
 * symbol scaling cannot silently distort stroke widths.
 */
function moveTo(out: string[], m: Matrix, x: number, y: number): void {
  const p = apply(m, x, y);
  out.push(`${fmt(p.x)} ${fmt(p.y)} m`);
}

function lineTo(out: string[], m: Matrix, x: number, y: number): void {
  const p = apply(m, x, y);
  out.push(`${fmt(p.x)} ${fmt(p.y)} l`);
}

/** Emit a full ellipse from four cubic Béziers — PDF has no circle primitive. */
function ellipsePath(out: string[], m: Matrix, cx: number, cy: number, rx: number, ry: number): void {
  const K = 0.5522847498307936; // 4/3 * tan(pi/8): the circle-to-Bézier constant
  const ox = rx * K;
  const oy = ry * K;

  // Start at the top, run clockwise in SVG's coordinate sense. The matrix
  // handles the y-flip into PDF space, so no visual flip is introduced here.
  moveTo(out, m, cx, cy - ry);
  bezier(out, m, cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy);
  bezier(out, m, cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry);
  bezier(out, m, cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy);
  bezier(out, m, cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry);
}

function bezier(out: string[], m: Matrix, c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
  const a = apply(m, c1x, c1y);
  const b = apply(m, c2x, c2y);
  const c = apply(m, x, y);
  out.push(`${fmt(a.x)} ${fmt(a.y)} ${fmt(b.x)} ${fmt(b.y)} ${fmt(c.x)} ${fmt(c.y)} c`);
}

/**
 * Elliptical arc (SVG `A`) to cubic Béziers.
 *
 * Needs the full endpoint→centre parameterization: the SVG form gives an
 * endpoint, two radii, a rotation and two flags, and there is no PDF arc
 * operator to hand it to. Vessel domed ends use this, so it is not optional —
 * skipping it would leave the reference drawing's own vessel shape drawn as a
 * flat-topped box, i.e. exactly the defect this module exists to remove.
 */
function arcTo(
  out: string[],
  m: Matrix,
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  xAxisRotation: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): void {
  if (rx === 0 || ry === 0) {
    lineTo(out, m, x2, y2);
    return;
  }
  let rxAbs = Math.abs(rx);
  let ryAbs = Math.abs(ry);
  const phi = (xAxisRotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  // Scale the radii up if they cannot span the endpoints (the SVG spec's
  // correction, which browsers apply too — matching it keeps the export
  // identical to what the canvas shows).
  const lambda = (x1p * x1p) / (rxAbs * rxAbs) + (y1p * y1p) / (ryAbs * ryAbs);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rxAbs *= s;
    ryAbs *= s;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const numer = rxAbs * rxAbs * ryAbs * ryAbs - rxAbs * rxAbs * y1p * y1p - ryAbs * ryAbs * x1p * x1p;
  const denom = rxAbs * rxAbs * y1p * y1p + ryAbs * ryAbs * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, numer / denom));
  const cxp = (co * rxAbs * y1p) / ryAbs;
  const cyp = (-co * ryAbs * x1p) / rxAbs;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    const a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    return ux * vy - uy * vx < 0 ? -a : a;
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rxAbs, (y1p - cyp) / ryAbs);
  let delta = angle(
    (x1p - cxp) / rxAbs,
    (y1p - cyp) / ryAbs,
    (-x1p - cxp) / rxAbs,
    (-y1p - cyp) / ryAbs,
  );
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;

  // Split into at most 90-degree pieces, the standard accuracy bound.
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / segments;
  const k = (4 / 3) * Math.tan(step / 4);

  let theta = theta1;
  for (let i = 0; i < segments; i++) {
    const nextTheta = theta + step;
    const start = { x: Math.cos(theta), y: Math.sin(theta) };
    const endPt = { x: Math.cos(nextTheta), y: Math.sin(nextTheta) };
    const c1 = { x: start.x - k * start.y, y: start.y + k * start.x };
    const c2 = { x: endPt.x + k * endPt.y, y: endPt.y - k * endPt.x };
    const map = (pt: { x: number; y: number }) => ({
      x: cx + cosPhi * rxAbs * pt.x - sinPhi * ryAbs * pt.y,
      y: cy + sinPhi * rxAbs * pt.x + cosPhi * ryAbs * pt.y,
    });
    const cp1 = map(c1);
    const cp2 = map(c2);
    const to = map(endPt);
    bezier(out, m, cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y);
    theta = nextTheta;
  }
}

function quadTo(out: string[], m: Matrix, cx: number, cy: number, x: number, y: number, fromX: number, fromY: number): void {
  // A quadratic becomes a cubic: C1 = P0 + 2/3(Q-P0), C2 = P1 + 2/3(Q-P1).
  const c1x = fromX + (2 / 3) * (cx - fromX);
  const c1y = fromY + (2 / 3) * (cy - fromY);
  const c2x = x + (2 / 3) * (cx - x);
  const c2y = y + (2 / 3) * (cy - y);
  bezier(out, m, c1x, c1y, c2x, c2y, x, y);
}

/**
 * Tokenize SVG path data into commands with numeric arguments.
 *
 * Handles the spec's implicit-repeat rule (a second coordinate pair after `M`
 * is an `L`, repeated `c`/`l` triples) and scientific notation, because a
 * flattened symbol's path data is machine-generated and uses both.
 */
function tokenizePath(d: string): Array<{ cmd: string; args: number[] }> {
  const out: Array<{ cmd: string; args: number[] }> = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    const args = (m[2].match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
    out.push({ cmd, args });
  }
  return out;
}

/** Arguments consumed per command, for splitting implicit repeats. */
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Draw an SVG `path` element. */
function drawPath(out: string[], m: Matrix, d: string, style: Style): void {
  const tokens = tokenizePath(d);
  if (!tokens.length) return;

  begin(out, style);
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  /** Previous control point, for S/T shorthand reflection. */
  let lastC: { x: number; y: number } | null = null;
  let lastQ: { x: number; y: number } | null = null;
  let open = false;

  const emit = (cmd: string, a: number[], prevCmd: string): void => {
    const rel = cmd === cmd.toLowerCase();
    const base = rel ? { x: cx, y: cy } : { x: 0, y: 0 };
    switch (cmd.toUpperCase()) {
      case 'M': {
        const x = base.x + a[0];
        const y = base.y + a[1];
        moveTo(out, m, x, y);
        cx = x;
        cy = y;
        startX = x;
        startY = y;
        open = true;
        break;
      }
      case 'L': {
        const x = base.x + a[0];
        const y = base.y + a[1];
        lineTo(out, m, x, y);
        cx = x;
        cy = y;
        break;
      }
      case 'H': {
        const x = rel ? cx + a[0] : a[0];
        lineTo(out, m, x, cy);
        cx = x;
        break;
      }
      case 'V': {
        const y = rel ? cy + a[0] : a[0];
        lineTo(out, m, cx, y);
        cy = y;
        break;
      }
      case 'C': {
        const x = base.x + a[4];
        const y = base.y + a[5];
        bezier(out, m, base.x + a[0], base.y + a[1], base.x + a[2], base.y + a[3], x, y);
        lastC = { x: base.x + a[2], y: base.y + a[3] };
        cx = x;
        cy = y;
        break;
      }
      case 'S': {
        const rx = lastC && /[CcSs]/.test(prevCmd) ? 2 * cx - lastC.x : cx;
        const ry = lastC && /[CcSs]/.test(prevCmd) ? 2 * cy - lastC.y : cy;
        const x = base.x + a[2];
        const y = base.y + a[3];
        bezier(out, m, rx, ry, base.x + a[0], base.y + a[1], x, y);
        lastC = { x: base.x + a[0], y: base.y + a[1] };
        cx = x;
        cy = y;
        break;
      }
      case 'Q': {
        const x = base.x + a[2];
        const y = base.y + a[3];
        quadTo(out, m, base.x + a[0], base.y + a[1], x, y, cx, cy);
        lastQ = { x: base.x + a[0], y: base.y + a[1] };
        cx = x;
        cy = y;
        break;
      }
      case 'T': {
        const qx = lastQ && /[QqTt]/.test(prevCmd) ? 2 * cx - lastQ.x : cx;
        const qy = lastQ && /[QqTt]/.test(prevCmd) ? 2 * cy - lastQ.y : cy;
        const x = base.x + a[0];
        const y = base.y + a[1];
        quadTo(out, m, qx, qy, x, y, cx, cy);
        lastQ = { x: qx, y: qy };
        cx = x;
        cy = y;
        break;
      }
      case 'A': {
        const x = rel ? cx + a[5] : a[5];
        const y = rel ? cy + a[6] : a[6];
        arcTo(out, m, cx, cy, a[0], a[1], a[2], a[3] !== 0, a[4] !== 0, x, y);
        cx = x;
        cy = y;
        break;
      }
      case 'Z': {
        lineTo(out, m, startX, startY);
        out.push('h'); // close the subpath for filling
        cx = startX;
        cy = startY;
        open = false;
        break;
      }
      default:
        break;
    }
  };

  let prev = '';
  for (const { cmd, args } of tokens) {
    const arity = ARITY[cmd.toUpperCase()] ?? 0;
    if (arity === 0) {
      emit(cmd, [], prev);
      prev = cmd;
      continue;
    }
    // Implicit repetition: every full group after the first is the same command
    // (except M, whose repeats are L).
    let first = true;
    for (let i = 0; i + arity <= args.length; i += arity) {
      const group = args.slice(i, i + arity);
      const use = first ? cmd : cmd === 'M' ? 'L' : cmd === 'm' ? 'l' : cmd;
      emit(use, group, prev);
      prev = use;
      first = false;
    }
  }
  if (open) out.push('S');
  else paint(out, style);
  end(out);
}

/** Draw an SVG `text` element. */
export function drawTextElement(
  out: string[],
  m: Matrix,
  x: number,
  y: number,
  size: number,
  text: string,
  anchor: string,
  bold: boolean,
): void {
  // Courier's advance is exactly 0.6 em, so the anchor offset is exact rather
  // than an estimate — the same reason the sheet furniture uses Courier.
  const scaled = scaleOf(m);
  const widthUser = text.length * size * 0.6 * scaled;
  const dxUser = anchor === 'middle' ? -widthUser / 2 : anchor === 'end' ? -widthUser : 0;

  /*
   * Position the glyphs with `Tm`, with the anchor shift folded into its
   * translation term. Tm rather than Td matters: Td measures in TEXT space,
   * which Tm has already scaled, so a scaled symbol's label would land at the
   * wrong offset, and for a rotated symbol Td would walk the label along the
   * rotated axis while the glyphs stayed upright.
   *
   * THE FLIP MUST BE REMOVED FROM THE TEXT MATRIX. `m` is the full
   * page transform and its b/d terms carry the SVG→PDF y-flip (SVG y grows
   * down, PDF's up), which is correct for PATH geometry but wrong for text: a
   * text matrix with d = -1 draws every glyph vertically mirrored. The
   * symptom was an instrument bubble reading "IIC" over "IOI" instead of
   * "TIC" over "101", and "PI" rendering as "ЬI" — readable as letters, so it
   * looked like a font problem, but the glyphs were upside down.
   *
   * It is easy to miss, and specifically it does NOT affect the sheet
   * furniture: drawText() positions text with `Td` and never touches Tm, so
   * the title block, legend and notices were always upright while only the
   * symbol-drawn labels were mirrored.
   *
   * So: negate b and d to undo the flip while keeping the symbol's own
   * rotation and scale, and take the ORIGIN from the full matrix so the
   * position still respects the flip.
   */
  const origin = apply(m, x + dxUser / (scaled || 1), y);
  const tm = { a: m.a / scaled, b: -m.b / scaled, c: m.c / scaled, d: -m.d / scaled };

  out.push('q');
  out.push('BT');
  out.push(`/F${bold ? '2' : '1'} ${fmt(size * scaled)} Tf`);
  out.push('0.1 0.1 0.1 rg');
  out.push(`${fmt(tm.a)} ${fmt(tm.b)} ${fmt(tm.c)} ${fmt(tm.d)} ${fmt(origin.x)} ${fmt(origin.y)} Tm`);
  out.push(`(${escapePdf(text)}) Tj`);
  out.push('ET');
  out.push('Q');
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Walk serialized SVG markup and append PDF operators.
 *
 * `base` maps symbol-local user units to PDF points, including the page's
 * y-flip. Attributes are read from the raw tag text rather than via the DOM
 * because this runs in the browser but must not depend on a live document (the
 * export also runs in tests and could run in a worker), and because the React
 * serializer's output is already well-formed and predictable.
 */
export function svgToPdfOps(markup: string, base: Matrix): string[] {
  const out: string[] = [];
  /*
   * One pass, two alternatives: an element tag, or a run of text content.
   * Matching text content explicitly is essential — the original version of
   * this loop only matched TAGS, so the character data between `<text>` and
   * `</text>` was never read and every symbol-drawn label (instrument bubble
   * codes, the off-page reference) silently vanished from the PDF. The gate
   * caught it as "the instrument tag's function code reaches the PDF export:
   * FAIL" while the SVG was correct.
   */
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|[^>"])*?)(\/?)>|([^<]+)/g;
  const stack: Matrix[] = [base];
  const styleStack: Style[] = [
    { ...DEFAULT_STYLE, strokeWidth: scaleOf(base) },
  ];
  const textStack: Array<{ x: number; y: number; size: number; anchor: string; bold: boolean }> = [];
  let m: RegExpExecArray | null;
  let textDepth = 0;
  let textBuffer = '';

  while ((m = tagRe.exec(markup))) {
    // Text-content alternative: accumulate it for the enclosing <text>.
    if (m[5] !== undefined) {
      if (textDepth > 0) textBuffer += m[5];
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const rawAttrs = m[3] ?? '';
    const selfClosing = m[4] === '/';
    const full = `<${name}${rawAttrs}>`;

    if (closing) {
      if (name === 'g' || name === 'svg') {
        stack.pop();
        styleStack.pop();
      }
      if (name === 'text') {
        textDepth--;
        if (textBuffer && textStack.length) {
          const t = textStack[textStack.length - 1];
          drawTextElement(out, stack[stack.length - 1], t.x, t.y, t.size, textBuffer, t.anchor, t.bold);
        }
        textStack.pop();
        textBuffer = '';
      }
      continue;
    }

    if (textDepth > 0 && name !== 'text' && name !== 'tspan') {
      // Nested geometry inside text is not a thing in this library; ignore.
      continue;
    }

    if (name === 'g' || name === 'svg') {
      const parent = stack[stack.length - 1];
      const local = parseTransform(attr(full, 'transform'));
      const composed = compose(parent, local);
      if (!selfClosing) {
        stack.push(composed);
        const parentStyle = styleStack[styleStack.length - 1];
        styleStack.push(styleOf(full, parentStyle, scaleOf(local) || 1));
      }
      continue;
    }

    const here = stack[stack.length - 1];
    const parentStyle = styleStack[styleStack.length - 1];
    const style = styleOf(full, parentStyle, 1);

    if (name === 'text') {
      textDepth++;
      textStack.push({
        x: num(full, 'x'),
        y: num(full, 'y'),
        size: num(full, 'font-size', 10),
        anchor: attr(full, 'text-anchor') ?? 'start',
        bold: Number(attr(full, 'font-weight') ?? 0) >= 600,
      });
      textBuffer = '';
      continue;
    }

    switch (name) {
      case 'line': {
        if (style.stroke === null) break;
        begin(out, style);
        moveTo(out, here, num(full, 'x1'), num(full, 'y1'));
        lineTo(out, here, num(full, 'x2'), num(full, 'y2'));
        out.push('S');
        end(out);
        break;
      }
      case 'rect': {
        const x = num(full, 'x');
        const y = num(full, 'y');
        const w = num(full, 'width');
        const h = num(full, 'height');
        if (w <= 0 || h <= 0) break;
        // Rounded rectangles: this library uses rx only on shapes it draws as a
        // plain rect (the `rx` attributes measured across the library are
        // `<ellipse>` radii), so a rounded corner is approximated as square
        // rather than drawn wrong — and unsupportedElements() would not catch it
        // because `rect` is supported. Noted here so the assumption is visible.
        begin(out, style);
        const corners = [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ].map((p) => apply(here, p.x, p.y));
        out.push(`${fmt(corners[0].x)} ${fmt(corners[0].y)} m`);
        for (const c of corners.slice(1)) out.push(`${fmt(c.x)} ${fmt(c.y)} l`);
        out.push('h');
        paint(out, style);
        end(out);
        break;
      }
      case 'circle':
        if (num(full, 'r') <= 0) break;
        begin(out, style);
        ellipsePath(out, here, num(full, 'cx'), num(full, 'cy'), num(full, 'r'), num(full, 'r'));
        paint(out, style);
        end(out);
        break;
      case 'ellipse':
        if (num(full, 'rx') <= 0 || num(full, 'ry') <= 0) break;
        begin(out, style);
        ellipsePath(out, here, num(full, 'cx'), num(full, 'cy'), num(full, 'rx'), num(full, 'ry'));
        paint(out, style);
        end(out);
        break;
      case 'polyline':
      case 'polygon': {
        const pts = (attr(full, 'points') ?? '')
          .trim()
          .split(/[\s,]+/)
          .map(Number)
          .filter((v) => Number.isFinite(v));
        if (pts.length < 4) break;
        begin(out, style);
        const first = apply(here, pts[0], pts[1]);
        out.push(`${fmt(first.x)} ${fmt(first.y)} m`);
        for (let i = 2; i + 1 < pts.length; i += 2) {
          const p = apply(here, pts[i], pts[i + 1]);
          out.push(`${fmt(p.x)} ${fmt(p.y)} l`);
        }
        if (name === 'polygon') out.push('h');
        paint(out, style);
        end(out);
        break;
      }
      case 'path': {
        const d = attr(full, 'd');
        if (!d) break;
        drawPath(out, here, d, style);
        break;
      }
      default:
        break;
    }
    void textDepth;
  }

  return out;
}

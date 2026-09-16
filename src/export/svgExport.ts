/**
 * Vector SVG export (PRD §4.4).
 *
 * §4.4 CORRECTED (2026-09-13) established that "SVG export does NOT exist … a
 * full search of src/ for any export path returns nothing. There is no export
 * of any kind in the build, and there never was in this codebase." This module
 * is that missing path.
 *
 * WHY A HAND-WRITTEN CONVERTER RATHER THAN AN OFF-THE-SHELF LIBRARY:
 *
 * The diagram is already React-drawn SVG-in-divs, so the obvious shortcut is to
 * serialize the live DOM (`XMLSerializer` on the canvas, or `html2canvas`). Both
 * produce output that fails §4.4's actual requirement — "real vector output, not
 * a screenshot … what makes an export look like an actual issued drawing instead
 * of an app screenshot with a logo slapped on":
 *
 *   - The canvas's DOM carries react-flow's own furniture: viewport transform,
 *     pan/zoom state, selection rings, drag hit-targets, edge-label HTML divs.
 *     Serializing it exports the EDITOR, at whatever zoom the user happened to
 *     be at.
 *   - Tags are HTML `<div>`s, not SVG text. They do not survive serialization
 *     into a standalone SVG file at all.
 *   - Percent/px CSS geometry resolves differently outside the app's stylesheet.
 *
 * So the export is built from the MODEL — the same plain node/edge data the
 * validity engine and the engineering lists already read — and re-draws it into
 * the paper template's coordinate space. That is what makes the output a
 * drawing rather than a capture of a screen, and it is also what makes this
 * testable without a browser: `buildSheetSvg` is a pure function from project
 * data to an SVG string.
 *
 * SCOPE, stated so it is not mistaken for a general SVG library: this converter
 * supports the subset of SVG that the symbol library actually uses, which was
 * enumerated from source rather than assumed — `line`, `rect`, `circle`,
 * `ellipse`, `polyline`, and `path` (rendered as a passthrough, since symbol
 * paths are already authored as SVG path data), plus the presentation
 * attributes the symbols set (stroke, stroke-width, stroke-dasharray, fill,
 * transform). Symbols are invoked as FUNCTIONS — they are React components whose
 * only dynamic input is `{width, height, selected, label}` — so each symbol's
 * real geometry is reused rather than re-implemented. Nothing here walks a DOM.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { symbolsByKind } from '../symbols';
import { getRenderedPorts, normalizeRotation } from '../symbols/effectivePorts';
import { buildOrthogonalPath } from '../edges/orthogonalRouting';
import { LINE_DASH, LINE_WEIGHT, STROKE } from '../symbols/style';
import { resolveLineKind, strokeForLineKind, type LineKind } from '../edges/lineKind';
import {
  paperTemplateLayout,
  frameGapUnits,
  type SheetSizeName,
  type TitleBlockFields,
} from './paperTemplate';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';

/** Geometry the exporter needs; react-flow's Node/Edge satisfy it structurally. */
export interface ExportNode {
  id: string;
  position: { x: number; y: number };
  data: EquipmentNodeData;
}

export interface ExportEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: PipeEdgeData;
}

export interface SheetSvgOptions {
  sheetName: string;
  sheetNumber: number;
  sheetTotal: number;
  size?: SheetSizeName;
  titleBlock?: TitleBlockFields;
  /** Hide the free-line overlay? Free lines are part of the drawing, so default true. */
  includeFreeLines?: boolean;
}

/** Escape text for XML content and attributes. */
function xml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Round to 2dp — keeps the SVG compact without visible geometry error. */
function n(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

const MONO = 'monospace';

/**
 * Render a symbol's geometry to SVG markup by invoking its React component.
 *
 * `renderToStaticMarkup` is used purely as a JSX-to-SVG-string serializer — the
 * output is a fragment of plain SVG elements with no React runtime, no state and
 * no react-flow classes. That is what lets one export path cover all 69 symbols
 * without a per-symbol drawing routine that could drift from the on-canvas one.
 */
function symbolMarkup(kind: string, width: number, height: number, label?: string): string {
  const symbol = symbolsByKind[kind];
  if (!symbol) return '';
  const Geometry = symbol.Geometry as unknown as (props: Record<string, unknown>) => unknown;
  const markup = renderToStaticMarkup(
    createElement(Geometry as never, { width, height, label, selected: false } as never) as never,
  );
  return markup;
}

/**
 * Wrap a symbol's markup so it sits at the node's position, at the node's size,
 * with its rotation applied about the box centre — the same convention as the
 * canvas (`rotatePorts.ts` rotates ports about the box centre and EquipmentNode
 * applies a CSS transform about the same point).
 */
function nodeMarkup(node: ExportNode): string {
  const d = node.data;
  const width = d.width;
  const height = d.height;
  const rotation = normalizeRotation(d.rotation);
  const inner = symbolMarkup(d.kind, width, height);
  if (!inner) return '';
  // Strip the symbol's own outer <svg> wrapper: nesting a sized <svg> inside a
  // positioned <g> would re-apply its own viewBox and reflow the geometry. The
  // symbols all size their viewBox exactly to width x height (documented in
  // README §Architecture notes), so the inner content is already in node-local
  // units and can be inlined directly.
  const body = inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const transform =
    rotation === 0
      ? `translate(${n(node.position.x)} ${n(node.position.y)})`
      : `translate(${n(node.position.x + width / 2)} ${n(node.position.y + height / 2)}) rotate(${rotation}) translate(${n(-width / 2)} ${n(-height / 2)})`;
  return `<g transform="${transform}">${body}</g>`;
}

/**
 * Tag label, drawn at the same place the canvas puts it: below the symbol,
 * centred, 11px monospace semibold (EquipmentNode draws it at `bottom: -18`).
 * Drawn as real SVG <text> so it survives into the exported file — on the canvas
 * it is an HTML div, which is one of the concrete reasons a DOM-serializing
 * export could not work.
 */
function tagMarkup(node: ExportNode): string {
  const d = node.data;
  if (!d.tag) return '';
  const cx = node.position.x + d.width / 2;
  const y = node.position.y + d.height + 14;
  const label = d.loopNumber ? `${d.tag} / ${d.loopNumber}` : d.tag;
  return (
    `<text x="${n(cx)}" y="${n(y)}" font-family="${MONO}" font-size="11" font-weight="600" ` +
    `fill="${STROKE}" text-anchor="middle">${xml(label)}</text>`
  );
}

/** One pipe/signal/boundary line as an SVG path, with its label. */
function edgeMarkup(edge: ExportEdge, nodes: ExportNode[]): string {
  const sourceNode = nodes.find((x) => x.id === edge.source);
  const targetNode = nodes.find((x) => x.id === edge.target);
  if (!sourceNode || !targetNode) return '';

  if (edge.data?.freePipe === true) {
    const a = edge.data.freeStart;
    const b = edge.data.freeEnd;
    if (!a || !b) return '';
    return linePath({ x: a.x, y: a.y }, { x: b.x, y: b.y }, 'free', edge.data);
  }

  const sourcePorts = getRenderedPorts(
    sourceNode.data.kind,
    sourceNode.data.ports,
    sourceNode.data.rotation,
    sourceNode.data.width,
    sourceNode.data.height,
  );
  const targetPorts = getRenderedPorts(
    targetNode.data.kind,
    targetNode.data.ports,
    targetNode.data.rotation,
    targetNode.data.width,
    targetNode.data.height,
  );
  const sp = sourcePorts.find((p) => p.id === edge.sourceHandle);
  const tp = targetPorts.find((p) => p.id === edge.targetHandle);
  if (!sp || !tp) return '';

  const start = { x: sourceNode.position.x + sp.x, y: sourceNode.position.y + sp.y };
  const end = { x: targetNode.position.x + tp.x, y: targetNode.position.y + tp.y };

  /**
   * NOTE ON HOPS: the on-canvas renderer breaks a line over a heavier one at
   * crossings (PRD §7a item 4, src/edges/lineHops.ts). The export deliberately
   * does NOT — it draws the route whole. This is a stated limitation, not an
   * oversight: the canvas hop pass exists to make a dense working sheet legible
   * on screen where a reader has no other cue, while a plotted drawing is read
   * with the line list alongside it. Reproducing it here is a follow-up whose
   * ordering rule must match the canvas exactly, and doing it half-right would
   * put hops in different places in the two views of the same drawing — worse
   * than consistently plain crossings. Recorded in PRD §0g.
   */
  const pts = buildOrthogonalPath(start, sp.direction, end, tp.direction);

  const kind = resolveLineKind(
    { source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle, data: edge.data as Record<string, unknown> },
    nodes as never,
    (k) => symbolsByKind[k]?.branchPorts,
    () => (sp.kind === 'boundary' || tp.kind === 'boundary' ? 'boundary' : sp.kind === 'signal' || tp.kind === 'signal' ? 'signal' : undefined),
  );

  const path = linePathBetween(pts, kind, edge.data);
  return path;
}

function linePath(a: { x: number; y: number }, b: { x: number; y: number }, kind: string, data?: PipeEdgeData): string {
  return linePathBetween([a, b], kind as LineKind, data);
}

function linePathBetween(pts: Array<{ x: number; y: number }>, kind: LineKind, data?: PipeEdgeData): string {
  const stroke = strokeForLineKind(kind, LINE_DASH);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${n(p.x)} ${n(p.y)}`).join(' ');
  const dash = stroke.strokeDasharray ? ` stroke-dasharray="${stroke.strokeDasharray}"` : '';
  const label = lineLabel(pts, data);
  return `<path d="${d}" fill="none" stroke="${STROKE}" stroke-width="${stroke.strokeWidth}"${dash}/>${label}`;
}

/**
 * The line-number label, placed at the route's midpoint like the canvas.
 *
 * The label is drawn over a small opaque box. Without it the pipe the label
 * describes runs straight through its own text, and so does any line crossing
 * at that point — visible as struck-through characters on the exported sheet
 * (caught by rendering the PDF and reading it, not visible in the markup).
 * A masked label is the drafting convention: the line number sits in a gap in
 * the line rather than on top of it.
 *
 * The box width is estimated from the character count: the label is monospace,
 * so width = chars x 0.6 x font-size is exact for the glyphs, and the padding is
 * fixed. Estimating is fine here because the box is only a mask — an over-wide
 * box is invisible, and the only failure mode is an under-wide one, which the
 * generous 0.62 factor avoids.
 */
function lineLabel(pts: Array<{ x: number; y: number }>, data?: PipeEdgeData): string {
  if (!data) return '';
  const text = data.freePipe
    ? [data.lineNumber, data.lineName, data.lineSize].filter(Boolean).join(' · ')
    : data.lineNumber ?? '';
  if (!text) return '';
  const mid = pts[Math.floor(pts.length / 2)] ?? pts[0];
  if (!mid) return '';
  const fontSize = 9;
  const boxW = text.length * fontSize * 0.62 + 4;
  const boxH = fontSize + 3;
  return (
    `<rect x="${n(mid.x - boxW / 2)}" y="${n(mid.y - 4 - fontSize + 1)}" width="${n(boxW)}" height="${n(boxH)}" ` +
    `fill="#ffffff" stroke="none"/>` +
    `<text x="${n(mid.x)}" y="${n(mid.y - 4)}" font-family="${MONO}" font-size="${fontSize}" fill="${STROKE}" ` +
    `text-anchor="middle">${xml(text)}</text>`
  );
}

/** Off-page connector resolved label, so cross-sheet references survive export. */
function offpageMarkup(node: ExportNode, nodes: ExportNode[]): string {
  const d = node.data;
  if (d.kind !== 'offpage-connector') return '';
  const sheetId = d.offpageTargetSheetId;
  const tag = d.offpageTargetTag;
  if (!sheetId || !tag) return '';
  const target = nodes.find((x) => x.id && x.data.tag === tag);
  const text = target ? `TO ${tag}` : `TO ${tag}`;
  return (
    `<text x="${n(node.position.x + d.width / 2)}" y="${n(node.position.y + d.height / 2 + 3)}" ` +
    `font-family="${MONO}" font-size="8" fill="${STROKE}" text-anchor="middle">${xml(text)}</text>`
  );
}

/** Title block interior: the reference's cells, laid out upright inside the rotated box. */
function titleBlockMarkup(layout: ReturnType<typeof paperTemplateLayout>, fields: TitleBlockFields): string {
  const tb = layout.titleBlock;
  const rows = 7;
  const rowH = tb.height / rows;
  const labelSize = Math.max(5, layout.size.height * 0.0045);
  const valueSize = Math.max(6, layout.size.height * 0.0055);
  const pad = labelSize * 0.6;

  const cells: Array<[string, string, number]> = [
    ['COMPANY', fields.company ?? '', 1.5],
    ['PROJECT', fields.title ?? '', 1.3],
    ['PROCESS / UNIT', fields.process ?? '', 1],
    ['JOB No.', fields.jobNumber ?? '', 1],
    ['ITEM No.', fields.itemNumber ?? '', 1],
    ['SCALE', fields.scale ?? '', 1],
    ['DRAWN', fields.drawnBy ?? '', 1],
    ['CHK.', fields.checkedBy ?? '', 1],
    ['DATE', fields.date ?? '', 1],
    ['DRAWING No.', fields.drawingNumber ?? '', 2.2],
    ['SH.', fields.sheetTotal ? `${fields.sheetNumber} / ${fields.sheetTotal}` : `${fields.sheetNumber}`, 1.2],
  ];

  let out = '';
  // Two columns: a left column of label/value rows and a right block for the
  // drawing number + sheet designation, which the reference draws large and
  // enclosed in its own framed cell.
  const splitX = tb.x + tb.width * 0.66;

  out += `<rect x="${n(tb.x)}" y="${n(tb.y)}" width="${n(tb.width)}" height="${n(tb.height)}" fill="none" stroke="${STROKE}" stroke-width="1.6"/>`;
  out += `<line x1="${n(splitX)}" y1="${n(tb.y)}" x2="${n(splitX)}" y2="${n(tb.y + tb.height)}" stroke="${STROKE}" stroke-width="1"/>`;

  let y = tb.y + rowH;
  let li = 0;
  for (const [label, value] of cells) {
    if (li >= 6) break;
    out += `<line x1="${n(tb.x)}" y1="${n(y)}" x2="${n(splitX)}" y2="${n(y)}" stroke="${STROKE}" stroke-width="0.6"/>`;
    out += `<text x="${n(tb.x + pad)}" y="${n(y - rowH + labelSize + 1)}" font-family="${MONO}" font-size="${n(labelSize)}" fill="#555">${xml(label)}</text>`;
    out += `<text x="${n(tb.x + tb.width * 0.30)}" y="${n(y - rowH + valueSize + 1)}" font-family="${MONO}" font-size="${n(valueSize)}" fill="${STROKE}" font-weight="600">${xml(value)}</text>`;
    y += rowH;
    li++;
  }

  // Drawing number: prominent, in the right block.
  const dnY = tb.y + tb.height * 0.42;
  out += `<text x="${n(splitX + pad)}" y="${n(tb.y + labelSize + 2)}" font-family="${MONO}" font-size="${n(labelSize)}" fill="#555">DRAWING No.</text>`;
  out += `<text x="${n(splitX + pad)}" y="${n(dnY)}" font-family="${MONO}" font-size="${n(valueSize * 1.5)}" fill="${STROKE}" font-weight="700">${xml(fields.drawingNumber ?? '')}</text>`;
  out += `<text x="${n(splitX + pad)}" y="${n(dnY + rowH)}" font-family="${MONO}" font-size="${n(labelSize)}" fill="#555">REV.</text>`;
  out += `<text x="${n(splitX + pad + labelSize * 4)}" y="${n(dnY + rowH)}" font-family="${MONO}" font-size="${n(valueSize)}" fill="${STROKE}" font-weight="600">${xml(fields.revision ?? '')}</text>`;
  out += `<text x="${n(splitX + pad)}" y="${n(dnY + rowH * 2)}" font-family="${MONO}" font-size="${n(labelSize)}" fill="#555">SH.</text>`;
  out += `<text x="${n(splitX + pad + labelSize * 4)}" y="${n(dnY + rowH * 2)}" font-family="${MONO}" font-size="${n(valueSize)}" fill="${STROKE}" font-weight="600">${xml(
    fields.sheetTotal ? `${fields.sheetNumber} / ${fields.sheetTotal}` : `${fields.sheetNumber}`,
  )}</text>`;

  return out;
}

/** Revision block: Rev | Description columns, rows tied to the title block. */
function revisionBlockMarkup(layout: ReturnType<typeof paperTemplateLayout>, fields: TitleBlockFields): string {
  const rb = layout.revisionBlock;
  const size = Math.max(5, layout.size.height * 0.0045);
  const colX = rb.x + rb.width * 0.18;
  let out = `<rect x="${n(rb.x)}" y="${n(rb.y)}" width="${n(rb.width)}" height="${n(rb.height)}" fill="none" stroke="${STROKE}" stroke-width="1.4"/>`;
  out += `<line x1="${n(colX)}" y1="${n(rb.y)}" x2="${n(colX)}" y2="${n(rb.y + rb.height)}" stroke="${STROKE}" stroke-width="0.8"/>`;
  out += `<line x1="${n(rb.x)}" y1="${n(rb.y + rb.height / 2)}" x2="${n(rb.x + rb.width)}" y2="${n(rb.y + rb.height / 2)}" stroke="${STROKE}" stroke-width="0.6"/>`;
  const pad = size * 0.6;
  out += `<text x="${n(rb.x + pad)}" y="${n(rb.y + size + 2)}" font-family="${MONO}" font-size="${n(size)}" fill="#555">REV.</text>`;
  out += `<text x="${n(colX + pad)}" y="${n(rb.y + size + 2)}" font-family="${MONO}" font-size="${n(size)}" fill="#555">DESCRIPTION</text>`;
  out += `<text x="${n(rb.x + pad)}" y="${n(rb.y + rb.height / 2 + size + 2)}" font-family="${MONO}" font-size="${n(size * 1.1)}" fill="${STROKE}" font-weight="600">${xml(fields.revision ?? '')}</text>`;
  out += `<text x="${n(colX + pad)}" y="${n(rb.y + rb.height / 2 + size + 2)}" font-family="${MONO}" font-size="${n(size * 1.1)}" fill="${STROKE}" font-weight="600">${xml(fields.revisionDescription ?? '')}</text>`;
  return out;
}

/** Legend box: the two line conventions a reader needs to read this drawing. */
function legendMarkup(layout: ReturnType<typeof paperTemplateLayout>): string {
  const lb = layout.legendBox;
  const size = Math.max(5, layout.size.height * 0.0045);
  const pad = size * 0.8;
  const rowH = Math.max(10, lb.height / 5);
  let out = `<rect x="${n(lb.x)}" y="${n(lb.y)}" width="${n(lb.width)}" height="${n(lb.height)}" fill="none" stroke="${STROKE}" stroke-width="1.4"/>`;
  out += `<text x="${n(lb.x + pad)}" y="${n(lb.y + size + 3)}" font-family="${MONO}" font-size="${n(size)}" fill="#555">LEGEND</text>`;

  const rows: Array<{ y: number; markup: string; label: string }> = [
    {
      y: lb.y + rowH * 1.6,
      markup: `<line x1="${n(lb.x + pad)}" y1="0" x2="${n(lb.x + pad + size * 4)}" y2="0" stroke="${STROKE}" stroke-width="${LINE_WEIGHT.heavy}"/>`,
      label: 'MAIN PROCESS RUN',
    },
    {
      y: lb.y + rowH * 2.3,
      markup: `<line x1="${n(lb.x + pad)}" y1="0" x2="${n(lb.x + pad + size * 4)}" y2="0" stroke="${STROKE}" stroke-width="${LINE_WEIGHT.medium}"/>`,
      label: 'BRANCH / SECONDARY',
    },
    {
      y: lb.y + rowH * 3.0,
      markup: `<line x1="${n(lb.x + pad)}" y1="0" x2="${n(lb.x + pad + size * 4)}" y2="0" stroke="${STROKE}" stroke-width="${LINE_WEIGHT.thin}" stroke-dasharray="${LINE_DASH.signal}"/>`,
      label: 'INSTRUMENT SIGNAL',
    },
    {
      y: lb.y + rowH * 3.7,
      markup: `<line x1="${n(lb.x + pad)}" y1="0" x2="${n(lb.x + pad + size * 4)}" y2="0" stroke="${STROKE}" stroke-width="${LINE_WEIGHT.thin}" stroke-dasharray="${LINE_DASH.boundary}"/>`,
      label: 'BATTERY LIMIT',
    },
  ];

  for (const r of rows) {
    out += `<g transform="translate(0 ${n(r.y)})">${r.markup}</g>`;
    out += `<text x="${n(lb.x + pad + size * 5)}" y="${n(r.y + size * 0.4)}" font-family="${MONO}" font-size="${n(size)}" fill="${STROKE}">${xml(r.label)}</text>`;
  }
  return out;
}

/** Confidentiality / ownership notice, a small separate box as §6 describes. */
function confidentialityMarkup(layout: ReturnType<typeof paperTemplateLayout>): string {
  const cb = layout.confidentiality;
  const size = Math.max(5, layout.size.height * 0.004);
  return (
    `<rect x="${n(cb.x)}" y="${n(cb.y)}" width="${n(cb.width)}" height="${n(cb.height)}" fill="none" stroke="${STROKE}" stroke-width="0.8"/>` +
    `<text x="${n(cb.x + cb.width / 2)}" y="${n(cb.y + cb.height / 2 + size * 0.4)}" font-family="${MONO}" font-size="${n(size)}" ` +
    `fill="#555" text-anchor="middle">CONFIDENTIAL — PROPERTY OF THE ISSUING COMPANY. NOT TO BE COPIED OR SHOWN TO THIRD PARTIES.</text>`
  );
}

/**
 * Compose one sheet: paper template furniture + the sheet's own drawing content.
 *
 * Content is translated so the drawing sits inside the FRAME, not at the sheet
 * origin: the canvas has no notion of a page, so node coordinates are in
 * "wherever the user drew it" space. Offsetting by the frame origin minus the
 * content's own bounding box keeps the drawing centred in the available area
 * rather than pinned to the sheet's top-left corner.
 */
export function buildSheetSvg(nodes: ExportNode[], edges: ExportEdge[], opts: SheetSvgOptions): string {
  const sizeName = opts.size ?? 'A3';
  const layout = paperTemplateLayout(sizeName);
  const gap = frameGapUnits(sizeName);

  const fields: TitleBlockFields = {
    ...opts.titleBlock,
    sheetNumber: opts.sheetNumber,
    sheetTotal: opts.sheetTotal,
  };

  // Drawing content: symbols, then tags, then lines (lines under tags reads
  // correctly — a label must not be crossed out by its own pipe).
  const contentParts: string[] = [];
  for (const e of edges) {
    const m = edgeMarkup(e, nodes);
    if (m) contentParts.push(m);
  }
  for (const node of nodes) {
    const m = nodeMarkup(node);
    if (m) contentParts.push(m);
    const t = tagMarkup(node);
    if (t) contentParts.push(t);
    const o = offpageMarkup(node, nodes);
    if (o) contentParts.push(o);
  }

  const drawing = contentParts.join('');

  /**
   * Fit the drawing into the frame's available area: scale down if it is larger
   * than the page (an A0-sized drawing on an A3 sheet must not be cropped), and
   * never scale UP, so a small drawing stays at its authored weight rather than
   * having its line weights balloon.
   */
  const bounds = nodes.length
    ? {
        minX: Math.min(...nodes.map((x) => x.position.x)),
        minY: Math.min(...nodes.map((x) => x.position.y)),
        maxX: Math.max(...nodes.map((x) => x.position.x + x.data.width)),
        maxY: Math.max(...nodes.map((x) => x.position.y + x.data.height)),
      }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  const contentW = Math.max(1, bounds.maxX - bounds.minX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);

  // Available area = frame minus the furniture that occupies its corners.
  const availX = layout.frame.x + 4;
  const availY = layout.frame.y + layout.legendBox.height + 16;
  const availW = layout.frame.width - 8;
  const availH = layout.frame.height - layout.legendBox.height - layout.titleBlock.height - layout.revisionBlock.height - 32;

  const fitScale = Math.min(1, availW / contentW, availH / contentH);

  const offsetX = availX - bounds.minX * fitScale + Math.max(0, (availW - contentW * fitScale) / 2);
  const offsetY = availY - bounds.minY * fitScale + Math.max(0, (availH - contentH * fitScale) / 2);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(layout.size.width)}" height="${n(layout.size.height)}" `,
    `viewBox="0 0 ${n(layout.size.width)} ${n(layout.size.height)}" data-sheet-size="${sizeName}" data-sheet-name="${xml(opts.sheetName)}">`,
    `<rect x="0" y="0" width="${n(layout.size.width)}" height="${n(layout.size.height)}" fill="#ffffff"/>`,
    // Outer thin border + inner double-line drawing frame (§6).
    `<rect x="0.5" y="0.5" width="${n(layout.size.width - 1)}" height="${n(layout.size.height - 1)}" fill="none" stroke="${STROKE}" stroke-width="1"/>`,
    `<rect x="${n(layout.frame.x)}" y="${n(layout.frame.y)}" width="${n(layout.frame.width)}" height="${n(layout.frame.height)}" fill="none" stroke="${STROKE}" stroke-width="2.4"/>`,
    `<rect x="${n(layout.frame.x + gap)}" y="${n(layout.frame.y + gap)}" width="${n(layout.frame.width - gap * 2)}" height="${n(layout.frame.height - gap * 2)}" fill="none" stroke="${STROKE}" stroke-width="0.8"/>`,
    `<g transform="translate(${n(offsetX)} ${n(offsetY)}) scale(${fitScale})" data-testid="drawing-content">${drawing}</g>`,
    legendMarkup(layout),
    revisionBlockMarkup(layout, fields),
    titleBlockMarkup(layout, fields),
    confidentialityMarkup(layout),
    '</svg>',
  ].join('');

  return svg;
}

/** Exported so a gate can assert the exported drawing's own geometry. */
export const EXPORT_META = { LINE_WEIGHT, LINE_DASH } as const;

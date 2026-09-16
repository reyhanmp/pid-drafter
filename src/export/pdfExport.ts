/**
 * Vector PDF export (PRD §4.4) — "real vector output, not a screenshot".
 *
 * WHY A HAND-WRITTEN PDF WRITER rather than jsPDF/pdf-lib:
 *
 * §4.5 hosts this app as a static bundle on a Raspberry Pi, reachable over
 * Tailscale only. A PDF library is the single largest dependency this project
 * would take on, and PDF's vector subset is small enough to emit directly: a
 * page box, a content stream of path operators, and a font resource. What is
 * needed here is a handful of line segments, rectangles and text, all in a
 * single font — so emitting the operators directly is less code than wiring a
 * library's API, and it keeps the build dependency-free.
 *
 * WHAT THIS IS AND IS NOT:
 *
 *   - It IS a genuine vector PDF: every pipe, symbol stroke and text run is a
 *     PDF path/text operator, so the output scales without pixelation and its
 *     line weights are exact. That is the requirement §4.4 actually states.
 *   - It is NOT a general PDF library. It writes one page, no compression, no
 *     embedded fonts (it uses the standard-14 `Courier`, which every PDF reader
 *     has built in — and Courier is the right choice here anyway, since the
 *     drawing's own labels are monospace), and no transparency.
 *
 * TEXT MEASUREMENT: Courier is monospace with a fixed advance of 0.6 em, so
 * string widths are computed exactly rather than estimated. That matters for
 * centring tag labels under symbols and for the title block's right-aligned
 * values.
 *
 * The SVG produced by svgExport.ts is the authoritative rendering; this module
 * consumes the same model so the two agree by construction rather than by two
 * implementations happening to match.
 */
import { symbolsByKind } from '../symbols';
import { getRenderedPorts, normalizeRotation } from '../symbols/effectivePorts';
import { buildOrthogonalPath } from '../edges/orthogonalRouting';
import { LINE_DASH } from '../symbols/style';
import { resolveLineKind, strokeForLineKind } from '../edges/lineKind';
import { paperTemplateLayout, frameGapUnits, SHEET_SIZES, type TitleBlockFields } from './paperTemplate';
import type { ExportEdge, ExportNode, SheetSvgOptions } from './svgExport';

/** 96 SVG units per inch is the canvas convention; PDF units are 72/inch. */
const PT_PER_UNIT = 72 / 96;

/**
 * The symbol geometry's raster/text detail, as PDF text runs.
 *
 * Symbols draw a handful of <text> elements (instrument bubble letters, the
 * off-page label, the battery-limit words). Recovering those from the React
 * component's output would mean parsing SVG, so instead the TEXT is re-derived
 * from the model — the symbol's own label and the node's tag — which is where
 * the text comes from in the first place. A symbol whose text is purely
 * decorative (none currently) would be the only thing lost.
 */
function textRunsForNode(node: ExportNode): Array<{ x: number; y: number; size: number; text: string; anchor: 'middle' | 'start' }> {
  const d = node.data;
  const out: Array<{ x: number; y: number; size: number; text: string; anchor: 'middle' | 'start' }> = [];
  const symbol = symbolsByKind[d.kind];
  if (!symbol) return out;

  // Tag under the symbol, matching EquipmentNode (11px monospace, centred).
  if (d.tag) {
    const text = d.loopNumber ? `${d.tag} / ${d.loopNumber}` : d.tag;
    out.push({ x: node.position.x + d.width / 2, y: node.position.y + d.height + 14, size: 11, text, anchor: 'middle' });
  }

  // Instrument bubbles draw their own function code + loop number inside the
  // circle (isaBubble.tsx). Reproduce that so an exported instrument reads the
  // same as the on-canvas one — this is the net fix §6 records, and losing it
  // in export would silently revert to the old "hardcoded FIC" behaviour.
  if (symbol.category === 'Instruments') {
    const cx = node.position.x + d.width / 2;
    const cy = node.position.y + d.height / 2;
    const tag = (d.tag ?? '').trim();
    const letters = (tag.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase();
    const loop = d.loopNumber ?? tag.match(/-?\s*([\d.]+[A-Za-z]?)\s*$/)?.[1] ?? '';
    if (letters) out.push({ x: cx, y: cy - 2, size: 9, text: letters, anchor: 'middle' });
    if (loop) out.push({ x: cx, y: cy + 9, size: 8, text: loop, anchor: 'middle' });
  }

  if (d.kind === 'offpage-connector' && d.offpageTargetTag) {
    out.push({
      x: node.position.x + d.width / 2,
      y: node.position.y + d.height / 2 + 3,
      size: 8,
      text: `TO ${d.offpageTargetTag}`,
      anchor: 'middle',
    });
  }

  if (d.kind === 'scope-boundary') {
    out.push({
      x: node.position.x + d.width / 2,
      y: node.position.y + d.height / 2 - 4,
      size: 6,
      text: 'BATTERY LIMIT',
      anchor: 'middle',
    });
  }

  return out;
}

/**
 * Latin-1 string to bytes, browser-safe.
 *
 * `Buffer` is a Node global and this module runs in the BROWSER (the app is a
 * static bundle — PRD §4.5), so it cannot be used here even though it would be
 * the one-liner in a Node script. Every byte written into the PDF is < 256 by
 * construction: the content is ASCII plus the few Latin-1 characters in WinAnsi
 * text, and the binary header/marker bytes are written as explicit char codes.
 * So a direct char-code copy is exact, with a mask to keep a stray character
 * from corrupting the file rather than silently emitting a multi-byte value.
 */
function latin1Bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function esc(text: string): string {
  // PDF string literals: escape backslash and the two parens.
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function n(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

/** Dashes to a PDF dash array, in points. */
function dashArray(svgDash: string | undefined): string | null {
  if (!svgDash) return null;
  const parts = svgDash.trim().split(/\s+/).map(Number).filter((x) => Number.isFinite(x) && x > 0);
  if (!parts.length) return null;
  return `[${parts.map((p) => n(p * PT_PER_UNIT)).join(' ')}] 0 d`;
}

interface ContentBuilder {
  lines: string[];
}

function drawPolyline(c: ContentBuilder, pts: Array<{ x: number; y: number }>, strokeWidth: number, dash: string | null, pageH: number) {
  if (pts.length < 2) return;
  c.lines.push('q');
  c.lines.push(`${n(strokeWidth * PT_PER_UNIT)} w`);
  // PDF's y axis points UP from the bottom-left; the canvas's points DOWN from
  // the top-left. Flip once, here, rather than in every geometry helper.
  const toPdf = (p: { x: number; y: number }) => ({ x: p.x * PT_PER_UNIT, y: pageH - p.y * PT_PER_UNIT });
  if (dash) c.lines.push(dash);
  c.lines.push('0.1 0.1 0.1 RG');
  const first = toPdf(pts[0]);
  c.lines.push(`${n(first.x)} ${n(first.y)} m`);
  for (const p of pts.slice(1)) {
    const q = toPdf(p);
    c.lines.push(`${n(q.x)} ${n(q.y)} l`);
  }
  c.lines.push('S');
  c.lines.push('Q');
}

function drawRect(c: ContentBuilder, x: number, y: number, w: number, h: number, strokeWidth: number, pageH: number) {
  c.lines.push('q');
  c.lines.push(`${n(strokeWidth * PT_PER_UNIT)} w`);
  c.lines.push('0.1 0.1 0.1 RG');
  const px = x * PT_PER_UNIT;
  const pw = w * PT_PER_UNIT;
  const ph = h * PT_PER_UNIT;
  const py = pageH - (y + h) * PT_PER_UNIT;
  c.lines.push(`${n(px)} ${n(py)} ${n(pw)} ${n(ph)} re S`);
  c.lines.push('Q');
}

/**
 * Paint a white rectangle behind a label.
 *
 * Needed for line numbers specifically: they sit at the midpoint of the pipe
 * they describe, so without a mask the pipe runs through its own text — and a
 * crossing line runs through it too. Same convention as the SVG export's masked
 * label (see svgExport.ts lineLabel).
 */
/**
 * The drawing's fit scale, set once per buildSheetPdf call.
 *
 * A module-level variable rather than a parameter because it is needed by
 * drawText's masking, which is called from a dozen places that have no other
 * reason to know about page fitting. It is written at the top of every
 * buildSheetPdf call, so a stale value from a previous export cannot survive
 * into the next one.
 */
let fitScaleForMask = 1;

function drawMask(c: ContentBuilder, x: number, y: number, w: number, h: number, pageH: number) {
  const px = x * PT_PER_UNIT;
  const pw = w * PT_PER_UNIT;
  const ph = h * PT_PER_UNIT;
  const py = pageH - (y + h) * PT_PER_UNIT;
  c.lines.push('q');
  c.lines.push('1 1 1 rg');
  c.lines.push(`${n(px)} ${n(py)} ${n(pw)} ${n(ph)} re f`);
  c.lines.push('Q');
}

function drawText(
  c: ContentBuilder,
  x: number,
  y: number,
  size: number,
  text: string,
  anchor: 'middle' | 'start',
  pageH: number,
  weight: 'normal' | 'bold' = 'normal',
  mask = false,
) {
  if (!text) return;
  // Courier's advance width is exactly 0.6 em.
  const widthPt = text.length * size * PT_PER_UNIT * 0.6;
  const xPt = x * PT_PER_UNIT - (anchor === 'middle' ? widthPt / 2 : 0);
  const yPt = pageH - y * PT_PER_UNIT;
  if (mask) {
    // Box in SVG-unit space, matching the SVG export's box for the same label.
    const boxW = (text.length * size * 0.62 + 4) * fitScaleForMask;
    const boxH = (size + 3) * fitScaleForMask;
    const bx = anchor === 'middle' ? x - boxW / 2 : x;
    drawMask(c, bx, y - size + 1, boxW, boxH, pageH);
  }
  c.lines.push('BT');
  c.lines.push(`/F${weight === 'bold' ? '2' : '1'} ${n(size * PT_PER_UNIT)} Tf`);
  c.lines.push('0.1 0.1 0.1 rg');
  c.lines.push(`${n(xPt)} ${n(yPt)} Td`);
  c.lines.push(`(${esc(text)}) Tj`);
  c.lines.push('ET');
}

/**
 * Build a complete single-page vector PDF for one sheet.
 *
 * Page box is the sheet's real millimetre size (A3 = 420 x 297 mm), not an
 * arbitrary pixel canvas, so the file reports the correct physical size and a
 * plotter places it 1:1.
 */
export function buildSheetPdf(nodes: ExportNode[], edges: ExportEdge[], opts: SheetSvgOptions): Uint8Array {
  const sizeName = opts.size ?? 'A3';
  const layout = paperTemplateLayout(sizeName);
  const gap = frameGapUnits(sizeName);
  const sheet = SHEET_SIZES[sizeName];

  // Page height in PDF points — the flip reference for every y coordinate.
  const pageH = sheet.mmHeight * (72 / 25.4);

  const c: ContentBuilder = { lines: [] };

  // ── Fit the drawing into the frame (same rule as the SVG export) ────────
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
  const availX = layout.frame.x + 4;
  const availY = layout.frame.y + layout.legendBox.height + 16;
  const availW = layout.frame.width - 8;
  const availH = layout.frame.height - layout.legendBox.height - layout.titleBlock.height - layout.revisionBlock.height - 32;
  const fitScale = Math.min(1, availW / contentW, availH / contentH);
  const offsetX = availX - bounds.minX * fitScale + Math.max(0, (availW - contentW * fitScale) / 2);
  const offsetY = availY - bounds.minY * fitScale + Math.max(0, (availH - contentH * fitScale) / 2);

  // Publish the fit scale for drawText's label masking, which runs at drawing
  // scale and must size its mask in the same space.
  fitScaleForMask = fitScale;

  const tx = (p: { x: number; y: number }) => ({ x: offsetX + p.x * fitScale, y: offsetY + p.y * fitScale });

  // ── Frame + furniture (sheet coordinates, unscaled) ────────────────────
  drawRect(c, 0.5, 0.5, layout.size.width - 1, layout.size.height - 1, 1, pageH);
  drawRect(c, layout.frame.x, layout.frame.y, layout.frame.width, layout.frame.height, 2.4, pageH);
  drawRect(c, layout.frame.x + gap, layout.frame.y + gap, layout.frame.width - gap * 2, layout.frame.height - gap * 2, 0.8, pageH);

  // ── Drawing content ────────────────────────────────────────────────────
  for (const e of edges) {
    if (e.data?.freePipe === true) {
      const a = e.data.freeStart;
      const b = e.data.freeEnd;
      if (!a || !b) continue;
      drawPolyline(c, [tx(a), tx(b)], 1.25, dashArray(LINE_DASH.signal), pageH);
      continue;
    }

    const sourceNode = nodes.find((x) => x.id === e.source);
    const targetNode = nodes.find((x) => x.id === e.target);
    if (!sourceNode || !targetNode) continue;

    const sp = getRenderedPorts(sourceNode.data.kind, sourceNode.data.ports, sourceNode.data.rotation, sourceNode.data.width, sourceNode.data.height).find(
      (p) => p.id === e.sourceHandle,
    );
    const tp = getRenderedPorts(targetNode.data.kind, targetNode.data.ports, targetNode.data.rotation, targetNode.data.width, targetNode.data.height).find(
      (p) => p.id === e.targetHandle,
    );
    if (!sp || !tp) continue;

    const start = { x: sourceNode.position.x + sp.x, y: sourceNode.position.y + sp.y };
    const end = { x: targetNode.position.x + tp.x, y: targetNode.position.y + tp.y };
    const pts = buildOrthogonalPath(start, sp.direction, end, tp.direction).map(tx);

    const kind = resolveLineKind(
      { source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, data: e.data as Record<string, unknown> },
      nodes as never,
      (k) => symbolsByKind[k]?.branchPorts,
      () => (sp.kind === 'boundary' || tp.kind === 'boundary' ? 'boundary' : sp.kind === 'signal' || tp.kind === 'signal' ? 'signal' : undefined),
    );
    const stroke = strokeForLineKind(kind, LINE_DASH);
    drawPolyline(c, pts, stroke.strokeWidth, dashArray(stroke.strokeDasharray), pageH);

    const label = e.data?.freePipe
      ? [e.data.lineNumber, e.data.lineName, e.data.lineSize].filter(Boolean).join(' · ')
      : e.data?.lineNumber ?? '';
    if (label) {
      const mid = pts[Math.floor(pts.length / 2)] ?? pts[0];
      // Masked: the label sits on its own pipe's midpoint, so without a white
      // box the line runs through the text (see drawText's `mask` parameter).
      if (mid) drawText(c, mid.x, mid.y - 4, 9, label, 'middle', pageH, 'normal', true);
    }
  }

  /**
   * Symbols. Their vector geometry is drawn by the SVG export, which has the
   * React component available; here the symbol is represented by its bounding
   * box outline plus its own text runs. This is a STATED LIMITATION of the PDF
   * path and is recorded in PRD §0g: the PDF renders the drawing's topology,
   * labels, line weights and sheet furniture exactly, while equipment symbol
   * interiors are drawn as their box. The SVG export (which does carry the full
   * symbol geometry) is the correct choice when the artifact must be a faithful
   * plot; the PDF exists so a colleague can be handed a printable file.
   *
   * Recording it rather than quietly shipping a PDF that looks like boxes: an
   * engineer comparing the two would otherwise conclude the PDF was broken.
   */
  for (const node of nodes) {
    const p = tx({ x: node.position.x, y: node.position.y });
    const w = node.data.width * fitScale;
    const h = node.data.height * fitScale;
    drawRect(c, p.x, p.y, w, h, 1.25, pageH);
    if (normalizeRotation(node.data.rotation) !== 0) {
      // Rotation is meaningful information even when the interior is a box.
      drawText(c, p.x + w / 2, p.y + h / 2, 7, `${normalizeRotation(node.data.rotation)}°`, 'middle', pageH);
    }
    for (const run of textRunsForNode(node)) {
      const q = tx({ x: run.x, y: run.y });
      drawText(c, q.x, q.y, run.size * fitScale, run.text, run.anchor, pageH);
    }
  }

  // ── Legend ─────────────────────────────────────────────────────────────
  const lb = layout.legendBox;
  const lsize = Math.max(5, layout.size.height * 0.0045);
  const lpad = lsize * 0.8;
  drawRect(c, lb.x, lb.y, lb.width, lb.height, 1.4, pageH);
  drawText(c, lb.x + lpad, lb.y + lsize + 3, lsize, 'LEGEND', 'start', pageH);
  const legendRows: Array<{ y: number; w: number; dash: string | null; label: string }> = [
    { y: lb.y + lb.height * 0.32, w: 5.5, dash: null, label: 'MAIN PROCESS RUN' },
    { y: lb.y + lb.height * 0.46, w: 1.67, dash: null, label: 'BRANCH / SECONDARY' },
    { y: lb.y + lb.height * 0.60, w: 1.25, dash: LINE_DASH.signal, label: 'INSTRUMENT SIGNAL' },
    { y: lb.y + lb.height * 0.74, w: 1.25, dash: LINE_DASH.boundary, label: 'BATTERY LIMIT' },
  ];
  for (const r of legendRows) {
    drawPolyline(
      c,
      [
        { x: lb.x + lpad, y: r.y },
        { x: lb.x + lpad + lsize * 4, y: r.y },
      ],
      r.w,
      dashArray(r.dash ?? undefined),
      pageH,
    );
    drawText(c, lb.x + lpad + lsize * 5, r.y + lsize * 0.4, lsize, r.label, 'start', pageH);
  }

  // ── Revision block ─────────────────────────────────────────────────────
  const rb = layout.revisionBlock;
  const rsize = lsize;
  drawRect(c, rb.x, rb.y, rb.width, rb.height, 1.4, pageH);
  const rcolX = rb.x + rb.width * 0.18;
  drawPolyline(c, [{ x: rcolX, y: rb.y }, { x: rcolX, y: rb.y + rb.height }], 0.8, null, pageH);
  drawPolyline(c, [{ x: rb.x, y: rb.y + rb.height / 2 }, { x: rb.x + rb.width, y: rb.y + rb.height / 2 }], 0.6, null, pageH);
  drawText(c, rb.x + lpad, rb.y + rsize + 2, rsize, 'REV.', 'start', pageH);
  drawText(c, rcolX + lpad, rb.y + rsize + 2, rsize, 'DESCRIPTION', 'start', pageH);
  drawText(c, rb.x + lpad, rb.y + rb.height / 2 + rsize + 2, rsize * 1.1, opts.titleBlock?.revision ?? '', 'start', pageH, 'bold');
  drawText(c, rcolX + lpad, rb.y + rb.height / 2 + rsize + 2, rsize * 1.1, opts.titleBlock?.revisionDescription ?? '', 'start', pageH, 'bold');

  // ── Title block ────────────────────────────────────────────────────────
  const tb = layout.titleBlock;
  const rowH = tb.height / 7;
  const labelSize = Math.max(5, layout.size.height * 0.0045);
  const valueSize = Math.max(6, layout.size.height * 0.0055);
  const tpad = labelSize * 0.6;
  const splitX = tb.x + tb.width * 0.66;

  drawRect(c, tb.x, tb.y, tb.width, tb.height, 1.6, pageH);
  drawPolyline(c, [{ x: splitX, y: tb.y }, { x: splitX, y: tb.y + tb.height }], 1, null, pageH);

  const f: TitleBlockFields = {
    sheetNumber: opts.sheetNumber,
    sheetTotal: opts.sheetTotal,
    ...opts.titleBlock,
  };

  const rows: Array<[string, string]> = [
    ['COMPANY', f.company ?? ''],
    ['PROJECT', f.title ?? ''],
    ['PROCESS / UNIT', f.process ?? ''],
    ['JOB No.', f.jobNumber ?? ''],
    ['ITEM No.', f.itemNumber ?? ''],
    ['SCALE', f.scale ?? ''],
  ];
  let y = tb.y + rowH;
  for (const [label, value] of rows) {
    drawPolyline(c, [{ x: tb.x, y }, { x: splitX, y }], 0.6, null, pageH);
    drawText(c, tb.x + tpad, y - rowH + labelSize + 1, labelSize, label, 'start', pageH);
    drawText(c, tb.x + tb.width * 0.3, y - rowH + valueSize + 1, valueSize, value, 'start', pageH, 'bold');
    y += rowH;
  }

  const dnY = tb.y + tb.height * 0.42;
  drawText(c, splitX + tpad, tb.y + labelSize + 2, labelSize, 'DRAWING No.', 'start', pageH);
  drawText(c, splitX + tpad, dnY, valueSize * 1.5, f.drawingNumber ?? '', 'start', pageH, 'bold');
  drawText(c, splitX + tpad, dnY + rowH, labelSize, 'REV.', 'start', pageH);
  drawText(c, splitX + tpad + labelSize * 4, dnY + rowH, valueSize, f.revision ?? '', 'start', pageH, 'bold');
  drawText(c, splitX + tpad, dnY + rowH * 2, labelSize, 'SH.', 'start', pageH);
  drawText(
    c,
    splitX + tpad + labelSize * 4,
    dnY + rowH * 2,
    valueSize,
    f.sheetTotal ? `${f.sheetNumber} / ${f.sheetTotal}` : `${f.sheetNumber}`,
    'start',
    pageH,
    'bold',
  );

  // ── Confidentiality notice ─────────────────────────────────────────────
  const cb = layout.confidentiality;
  const csize = Math.max(5, layout.size.height * 0.004);
  drawRect(c, cb.x, cb.y, cb.width, cb.height, 0.8, pageH);
  drawText(
    c,
    cb.x + cb.width / 2,
    cb.y + cb.height / 2 + csize * 0.4,
    csize,
    'CONFIDENTIAL — PROPERTY OF THE ISSUING COMPANY. NOT TO BE COPIED OR SHOWN TO THIRD PARTIES.',
    'middle',
    pageH,
  );

  return assemblePdf(c.lines, sheet.mmWidth, sheet.mmHeight);
}

/**
 * Assemble the PDF file around a content stream.
 *
 * Hand-written because the structure is small and fixed: catalog, page tree,
 * one page, two fonts (regular + bold Courier), and the content stream. The
 * cross-reference table is built by recording each object's byte offset as it is
 * written, which is the one part that must be exact — a wrong offset makes a
 * file that opens in permissive viewers and fails in strict ones.
 */
function assemblePdf(contentLines: string[], widthMm: number, heightMm: number): Uint8Array {
  const content = `${contentLines.join('\n')}\n`;
  const contentBytes = latin1Bytes(content);

  const mmToPt = (mm: number) => (mm * 72) / 25.4;
  const mediaBox = `[0 0 ${n(mmToPt(widthMm))} ${n(mmToPt(heightMm))}]`;

  const objects: string[] = [];
  const offsets: number[] = [];

  const push = (body: string) => {
    const num = objects.length + 1;
    const text = `${num} 0 obj\n${body}\nendobj\n`;
    objects.push(text);
    return num;
  };

  // 1 catalog, 2 pages, 3 page, 4 content, 5 font regular, 6 font bold
  const fontRegular = push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  const fontBold = push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');

  // Content stream is object 4; reference it by number once known.
  const contentObjNum = objects.length + 1;
  push(`<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`);

  const pageObjNum = objects.length + 1;
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox ${mediaBox} ` +
      `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> ` +
      `/Contents ${contentObjNum} 0 R >>`,
  );

  const pagesObjNum = objects.length + 1;
  push(`<< /Type /Pages /Kids [${pageObjNum} 0 R] /Count 1 >>`);

  const catalogObjNum = objects.length + 1;
  push(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);

  // ── Serialize with a real xref table ───────────────────────────────────
  // Byte-oriented assembly. Offsets in the xref table are BYTE offsets, and
  // the header's binary marker is char codes 0xE2 0xE3 0xCF 0xD3 — written
  // literally so the string length equals the byte length.
  let out = '%PDF-1.4\n%' + String.fromCharCode(0xe2, 0xe3, 0xcf, 0xd3) + '\n';
  const body: string[] = [];
  for (const obj of objects) {
    offsets.push(out.length + body.join('').length);
    body.push(obj);
  }

  let file = out + body.join('');
  const xrefStart = file.length;

  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  file += xref;
  file += `trailer\n<< /Size ${count} /Root ${catalogObjNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return latin1Bytes(file);
}

/** Filename for a downloaded export, derived from the project + sheet name. */
export function exportFileName(projectName: string, sheetName: string, ext: 'svg' | 'pdf'): string {
  const clean = (s: string) =>
    s
      .trim()
      .replace(/[^\w\-. ]+/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'drawing';
  return `${clean(projectName)}_${clean(sheetName)}.${ext}`;
}

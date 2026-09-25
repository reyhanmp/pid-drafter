/**
 * Nozzle ↔ line reconciliation (PRD §4.9.3 correction / §7a item 6).
 *
 * `specValidation.ts` compares the pipe's own spec against the *component's*
 * declared data-sheet fields. It never reads a nozzle. This module closes the
 * other half: it compares what the pipe says about itself against the nozzle
 * the pipe is actually bolted to, at both ends.
 *
 * TWO RULES, and the severity split between them is the whole point:
 *
 *   1. SIZE — a line larger than the nozzle it lands on. This is **legal and
 *      common**: a reducer at the vessel wall is exactly how a 4" run leaves a
 *      3" nozzle, and the vessel designer sizes the reinforcement pad off the
 *      nozzle. So this is reported as a *notice*, worded as something to
 *      confirm rather than a defect to fix. The PRD's complaint was that this
 *      case was **silent**, not that it was wrong; a tool that refused it would
 *      be confidently wrong about correct work (see the pid-engineering-
 *      conventions skill: "a validator that fires on a correct real drawing is
 *      worse than no validator").
 *
 *   2. RATING — a line whose pressure class exceeds the nozzle's flange rating.
 *      A 150# flange on a 300# line is *below the line's own pressure class*,
 *      which has no legal reading the way a reducer does. Still soft (never
 *      export-blocking): a partially-filled drawing is normal, and a project
 *      may use a house rating scheme this tool cannot see.
 *
 * Scope guards, all deliberate:
 *   - Only `kind: 'process'` ports. An instrument's port is an electrical
 *     termination, not a flanged connection (same exclusion as §4.9.3's
 *     schedule).
 *   - Free lines are skipped — they have no nozzle by definition (§4.1).
 *   - A missing size/rating on either side produces NO warning. An
 *     unspecified nozzle is a normal state of a drawing in progress, and
 *     inventing a mismatch out of absent data is how a validator trains users
 *     to ignore it.
 *   - ASME class and PN are compared only within their own system. The two are
 *     not interchangeable at a fixed ratio, and a cross-system guess would
 *     manufacture false positives on correct metric drawings.
 */
import { symbolsByKind } from '../symbols/index';
import { getRenderedPorts } from '../symbols/effectivePorts';
import { parseLineNumber } from './lineNumbers';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';

export interface NozzleDiagramNode {
  id: string;
  data: EquipmentNodeData;
}

export interface NozzleDiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: PipeEdgeData;
}

export type NozzleLineWarningKind =
  | 'line-larger-than-nozzle'
  | 'nozzle-rating-below-line-class';

export interface NozzleLineWarning {
  kind: NozzleLineWarningKind;
  /** 'notice' for the legal-with-a-reducer size case; 'warning' for the rating case. */
  severity: 'notice' | 'warning';
  message: string;
  nodeIds: string[];
  edgeId: string;
  /** Nozzle-side values, for the gate and for a future click-to-focus. */
  nozzleSize?: string;
  lineSize?: string;
  nozzleRating?: string;
  lineClass?: string;
}

/**
 * Nominal size tokens → a single comparable number, in NPS inches.
 *
 * The two option lists disagree on how to write the same size: the line sheet
 * offers `1.5"` and the nozzle editor offers `1 1/2"`. A string comparison
 * would call those different, so everything is reduced to a number here and
 * compared numerically. DN sizes fold onto their NPS equivalents (DN40 = 1.5"
 * = NPS 1½), which is how a metric nozzle and an imperial line can still be
 * reconciled instead of silently skipped.
 */
const DN_TO_NPS_INCHES: Record<number, number> = {
  15: 0.5, 20: 0.75, 25: 1, 40: 1.5, 50: 2, 80: 3, 100: 4, 150: 6, 200: 8,
  250: 10, 300: 12, 350: 14, 400: 16, 450: 18, 500: 20, 600: 24,
};

/**
 * Parse a size string — `2"`, `1 1/2"`, `1.5"`, `3/4"`, `DN50` — into NPS
 * inches, or null when it carries no readable size.
 */
export function parseNpsInches(text: string | undefined | null): number | null {
  if (!text) return null;
  const s = text.trim();

  // Metric first: `DN50`, `DN 50`, `dn1 50` are all the same nozzle.
  const dn = s.match(/\bDN\s*(\d+)\b/i);
  if (dn) {
    const mm = Number(dn[1]);
    return DN_TO_NPS_INCHES[mm] ?? mm / 25.4;
  }

  // Imperial: optional whole part + optional fraction, e.g. `1 1/2`, `3/4`, `2`.
  const frac = s.match(/(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const whole = Number(frac[1]);
    const num = Number(frac[2]);
    const den = Number(frac[3]);
    if (den === 0) return null;
    return whole + num / den;
  }
  const bare = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (bare) {
    const num = Number(bare[1]);
    const den = Number(bare[2]);
    if (den === 0) return null;
    return num / den;
  }
  const dec = s.match(/(\d+(?:\.\d+)?)/);
  if (dec) return Number(dec[1]);
  return null;
}

/**
 * Compare two sizes, tolerating the write-it-differently problem (`1.5"` vs
 * `1 1/2"`) without tolerating a real difference (2" vs 3").
 */
const NPS_TOLERANCE = 0.01;

function largerLineSize(lineNps: number | null, nozzleNps: number | null): boolean {
  if (lineNps === null || nozzleNps === null) return false;
  return lineNps > nozzleNps + NPS_TOLERANCE;
}

/**
 * Fold a numeric value onto its ASME class series. The reference drawing's
 * class field carries 315 and 320, which are the project's own 300-series
 * classes (see `PIPING_CLASS_SUGGESTIONS`), not separate ratings — so they
 * must compare as class 300 or a 150# flange on a class-315 line goes
 * unreported. Without this fold the comparison silently does nothing.
 */
function normalizeAsmeClassSeries(n: number): number | null {
  if (n < 150 || n > 2500) return null;
  if (n < 300) return 150;
  if (n < 600) return 300;
  if (n < 900) return 600;
  if (n < 1500) return 900;
  if (n < 2500) return 1500;
  return 2500;
}

/**
 * ASME class number from a rating string. Accepts both the flange-rating
 * spelling (`300#`, `Class 300`, `ANSI 300`) and the BARE number the
 * line-number grammar carries in its class field (`4"-BL-710.05B-300-HC`).
 * Returns null for PN values, which are a different system (see the scope
 * note at the top of this file).
 */
function parseAsmeClass(text: string | undefined | null): number | null {
  if (!text) return null;
  if (/\bPN\s*\d+/i.test(text)) return null;
  const marked =
    text.match(/(?:class|ansi|#)\s*[:#]?\s*(\d+)/i) ?? text.match(/\b(\d+)\s*#/);
  const bare = /^\s*(\d+)\s*$/.exec(text);
  const n = marked ? Number(marked[1]) : bare ? Number(bare[1]) : null;
  return n === null ? null : normalizeAsmeClassSeries(n);
}

/** PN number from a rating string, e.g. `PN40` → 40. Null for ASME classes. */
function parsePn(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = text.match(/\bPN\s*(\d+)\b/i);
  return m ? Number(m[1]) : null;
}

/**
 * Whether the line's class exceeds the nozzle's rating, within one system.
 * Exported so the gate can pin the system-mixing rule directly.
 */
export function ratingBelowLineClass(
  nozzleRating: string | undefined | null,
  lineClassText: string | undefined | null,
): { nozzleClass: number; lineClass: number; system: 'asme' | 'pn' } | null {
  const lineAsme = parseAsmeClass(lineClassText);
  const nozzleAsme = parseAsmeClass(nozzleRating);
  if (lineAsme !== null && nozzleAsme !== null) {
    return nozzleAsme < lineAsme
      ? { nozzleClass: nozzleAsme, lineClass: lineAsme, system: 'asme' }
      : null;
  }
  const linePn = parsePn(lineClassText);
  const nozzlePn = parsePn(nozzleRating);
  if (linePn !== null && nozzlePn !== null && nozzlePn < linePn) {
    return { nozzleClass: nozzlePn, lineClass: linePn, system: 'pn' };
  }
  return null;
}

/** The piping class the line carries, preferring the parsed line number. */
function linePressureClass(edge: NozzleDiagramEdge): string | null {
  const parsed = edge.data?.lineNumber ? parseLineNumber(edge.data.lineNumber) : null;
  if (parsed?.parts?.pipingClass) return parsed.parts.pipingClass;
  return null;
}

/** The line's nominal size — the explicit field first, else the line number's own size. */
function lineNominalSize(edge: NozzleDiagramEdge): string | null {
  if (edge.data?.lineSize) return edge.data.lineSize;
  const parsed = edge.data?.lineNumber ? parseLineNumber(edge.data.lineNumber) : null;
  return parsed?.parts?.size ?? null;
}

/**
 * Reconcile one line against the nozzle at one of its ends.
 *
 * `handleId` is the port id the edge is seated on, and `endLabel` names the
 * end in the message so a user with two flagged nozzles can tell which is
 * which without hunting for the pipe.
 */
function checkEnd(
  edge: NozzleDiagramEdge,
  node: NozzleDiagramNode,
  handleId: string | null | undefined,
  lineSize: string | null,
  lineClass: string | null,
): NozzleLineWarning[] {
  if (!handleId) return [];
  const symbol = symbolsByKind[node.data.kind];
  if (!symbol) return [];

  const port = getRenderedPorts(
    node.data.kind,
    node.data.ports,
    node.data.rotation,
    node.data.width,
    node.data.height,
  ).find((p) => p.id === handleId);
  if (!port) return [];

  // Signal ports are electrical terminations, not flanged connections.
  if (port.kind !== 'process') return [];

  const who = `${node.data.tag || node.id} ${port.label || handleId}`;
  const warnings: NozzleLineWarning[] = [];

  // ── Rule 1: line larger than the nozzle ──
  const lineNps = parseNpsInches(lineSize);
  const nozzleNps = parseNpsInches(port.size);
  if (largerLineSize(lineNps, nozzleNps) && lineSize && port.size) {
    warnings.push({
      kind: 'line-larger-than-nozzle',
      severity: 'notice',
      message:
        `${who}: ${lineSize} line on a ${port.size} nozzle — legal via a reducer at the nozzle; ` +
        `confirm the reducer and that the nozzle is sized for it.`,
      nodeIds: [node.id],
      edgeId: edge.id,
      nozzleSize: port.size,
      lineSize,
    });
  }

  // ── Rule 2: nozzle flange rating below the line's pressure class ──
  const belowBy = ratingBelowLineClass(port.rating, lineClass);
  if (belowBy && port.rating && lineClass) {
    const unit = belowBy.system === 'pn' ? 'PN' : 'Class';
    warnings.push({
      kind: 'nozzle-rating-below-line-class',
      severity: 'warning',
      message:
        `${who}: nozzle rating ${port.rating} is below the line's ${unit} ${belowBy.lineClass} ` +
        `(line number class ${lineClass}) — the flange would be under-rated for its own line.`,
      nodeIds: [node.id],
      edgeId: edge.id,
      nozzleRating: port.rating,
      lineClass,
    });
  }

  return warnings;
}

/**
 * Run nozzle ↔ line reconciliation across every non-free line in the diagram.
 * Pure function over plain data — no react-flow imports, same contract as
 * every other rule in this directory.
 */
export function reconcileNozzles(
  nodes: NozzleDiagramNode[],
  edges: NozzleDiagramEdge[],
): NozzleLineWarning[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const warnings: NozzleLineWarning[] = [];

  for (const edge of edges) {
    // A free line has no nozzle at either end by definition (§4.1).
    if ((edge.data as Record<string, unknown> | undefined)?.freePipe === true) continue;
    // A signal line terminates on an instrument port, not a flange. Skipped as
    // a whole LINE, not just per-port: the far end of a signal line is usually
    // process equipment, and checking only the port kind let an instrument's
    // signal line draw a reducer notice against the vessel it reports on.
    if (edge.data?.lineType === 'signal') continue;

    const lineSize = lineNominalSize(edge);
    const lineClass = linePressureClass(edge);
    if (!lineSize && !lineClass) continue; // nothing said about this line yet

    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (sourceNode) warnings.push(...checkEnd(edge, sourceNode, edge.sourceHandle, lineSize, lineClass));
    if (targetNode) warnings.push(...checkEnd(edge, targetNode, edge.targetHandle, lineSize, lineClass));
  }

  return warnings;
}

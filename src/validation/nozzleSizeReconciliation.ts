/**
 * Nozzle-vs-line size reconciliation (PRD §7a item 6 / §4.9.3).
 *
 * THE ENGINEERING FACT THIS ENCODES: a 4" line leaving a 3" nozzle is LEGAL
 * and common. A reducer at the vessel wall is ordinary design, and the vessel
 * designer sizes the reinforcement pad off the NOZZLE, not the pipe. So this
 * rule must never report "line bigger than nozzle" as a defect — a validator
 * that fires on correct drawings trains users to ignore it, which is worse than
 * having no validator at all (see the governing rule in the project's own
 * engineering-conventions skill).
 *
 * WHAT IS ACTUALLY WRONG is the reverse, and it is a real error:
 *
 *   A **line larger than its nozzle** is legal. A **line SMALLER than its
 *   nozzle** means the nozzle is bigger than anything that connects to it,
 *   which on a real drawing is either a mis-sized nozzle or a missing reducer
 *   note. Either way it is worth telling the engineer about, because nothing
 *   downstream will catch it: the nozzle schedule reports them independently
 *   and they never meet.
 *
 * Two further cases stay SILENT on purpose, and each silence is a decision:
 *
 *   - **Unspecified sizes.** A vessel has no inherent nozzle size (PRD §4.9.3:
 *     "never invent engineering data"), so a blank nozzle size is a normal
 *     state of a drawing in progress, not a finding.
 *   - **The line's own size is unset while the nozzle is set.** Nothing to
 *     compare.
 *
 * The line's size is read from BOTH places it can live: the structured
 * `lineSize` field, and the size token parsed out of the line number itself
 * (`1 1/2"-LPS2-710.01-300-HC`). The number is the authoritative source on a
 * real drawing, so it wins when both are present — an engineer who edits the
 * number by hand and leaves the dropdown stale would otherwise get a warning
 * about a size the drawing no longer claims.
 *
 * Soft warning, never a hard error: size reconciliation is advisory, and the
 * hard tier in this tool is reserved for defects that make a drawing
 * unbuildable or unparseable.
 */
import { parseLineNumber } from './lineNumbers';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';
import { getRenderedPorts } from '../symbols/effectivePorts';

export interface SizeNode {
  id: string;
  data: EquipmentNodeData;
}

export interface SizeEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: PipeEdgeData;
}

export type NozzleSizeWarningKind = 'nozzle-larger-than-line';

export interface NozzleSizeWarning {
  kind: NozzleSizeWarningKind;
  message: string;
  nodeIds: string[];
  edgeId: string;
}

/**
 * A nominal size reduced to a comparable number in INCHES.
 *
 * Both unit systems are supported because the tool offers both (PRD §4.9.3
 * lists `NOZZLE_SIZE_OPTIONS` spanning inches and DN), and a project that
 * mixes them — a DN nozzle on imported equipment, an inch line number — is
 * exactly where this check is worth having.
 *
 * Returns null for anything unparseable rather than guessing, so an unusual
 * spelling produces silence instead of a false finding.
 */
export function parseNominalSize(text: string | undefined): number | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;

  // DN / DNmm — millimetres / 25.4.
  const dn = t.match(/^dn\s*(\d+(?:\.\d+)?)$/i);
  if (dn) return Number(dn[1]) / 25.4;

  // "4", "4\"", "4 in", "4 inch".
  const inch = t.match(/^(\d+(?:\.\d+)?)\s*(?:"|''|in\b|inch(?:es)?\b)?$/i);
  if (inch) return Number(inch[1]);

  // Fractions: "1 1/2\"", "3/4", "1/2".
  const frac = t.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*(?:"|''|in\b)?$/i);
  if (frac) {
    const whole = frac[1] ? Number(frac[1]) : 0;
    const num = Number(frac[2]);
    const den = Number(frac[3]);
    if (den === 0) return null;
    return whole + num / den;
  }

  // Anything with an explicit mm suffix.
  const mm = t.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
  if (mm) return Number(mm[1]) / 25.4;

  return null;
}

/**
 * The size this line claims, in inches — from the line NUMBER when it parses,
 * otherwise from the structured field. Returns null when neither is set.
 */
export function lineSizeInches(edge: SizeEdge): { inches: number | null; source: 'line-number' | 'field' | null } {
  const fromNumber = parseLineNumber(edge.data?.lineNumber ?? '').parts?.size;
  const parsedNumber = parseNominalSize(fromNumber);
  if (parsedNumber !== null) return { inches: parsedNumber, source: 'line-number' };

  const parsedField = parseNominalSize(edge.data?.lineSize);
  if (parsedField !== null) return { inches: parsedField, source: 'field' };

  return { inches: null, source: null };
}

/** Format inches back to a readable nominal size for the message. */
function formatSize(inches: number): string {
  if (Number.isInteger(inches)) return `${inches}"`;
  const rounded = Math.round(inches * 16) / 16;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  const sixteenths = Math.round(frac * 16);
  if (sixteenths === 0) return `${whole}"`;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(sixteenths, 16);
  const num = sixteenths / g;
  const den = 16 / g;
  return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
}

/**
 * Compare every connected line's size against the nozzle it is seated on.
 *
 * Only ports that are actually CONNECTED are checked: an unconnected nozzle's
 * size relates to no line, and reporting it would flag every spare nozzle on
 * every drawing.
 */
export function validateNozzleLineSizes(nodes: SizeNode[], edges: SizeEdge[]): NozzleSizeWarning[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const warnings: NozzleSizeWarning[] = [];

  for (const edge of edges) {
    // Free lines attach to no nozzle by definition (PRD §4.1 carve-out).
    if (edge.data?.freePipe === true) continue;
    // Battery-limit lines are a scope plane, not a pipe with a bore.
    if (edge.data?.lineType === 'boundary') continue;

    const { inches: lineInches, source } = lineSizeInches(edge);
    if (lineInches === null) continue; // nothing to compare

    const ends: Array<{ nodeId: string; handle: string | null | undefined }> = [
      { nodeId: edge.source, handle: edge.sourceHandle },
      { nodeId: edge.target, handle: edge.targetHandle },
    ];

    for (const { nodeId, handle } of ends) {
      if (!handle) continue;
      const node = nodeById.get(nodeId);
      if (!node) continue;

      const kind = node.data.kind;
      const width = node.data.width ?? 0;
      const height = node.data.height ?? 0;
      const ports = getRenderedPorts(kind, node.data.ports, node.data.rotation, width, height);
      const port = ports.find((p) => p.id === handle);
      if (!port) continue;

      const nozzleInches = parseNominalSize(port.size);
      if (nozzleInches === null) continue; // unspecified nozzle is honest, not a finding

      /**
       * The rule, and the only direction that fires:
       *   line SMALLER than nozzle -> worth telling the engineer.
       * A line LARGER than its nozzle is legal (a reducer at the wall) and is
       * deliberately silent — see the module header.
       *
       * Tolerance: sizes are nominal, and a comparison at exactly the boundary
       * must not fire because of float noise from the fraction/DN conversions
       * (1 1/2" = 1.5 exactly, but DN40 = 1.5748" against a 1 1/2" line).
       */
      const TOLERANCE = 0.02;
      if (lineInches + TOLERANCE >= nozzleInches) continue;

      const where = source === 'line-number' ? 'line number' : 'line size field';
      warnings.push({
        kind: 'nozzle-larger-than-line',
        message:
          `${node.data.tag || node.id} ${port.label}: nozzle is ${formatSize(nozzleInches)} but the ` +
          `${formatSize(lineInches)} line on it (from the ${where}) is smaller. ` +
          `A line may be larger than its nozzle (a reducer at the wall is normal), but a nozzle larger ` +
          `than its line is usually a mis-sized nozzle or a missing reducer.`,
        nodeIds: [node.id],
        edgeId: edge.id,
      });
    }
  }

  return warnings;
}

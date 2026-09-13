/**
 * Tag and line-number semantics warnings (PRD §4.9.2).
 *
 * These are SOFT warnings by explicit design, surfaced through the same
 * non-blocking channel as the spec-compatibility checks (§4.1). The reason is
 * not laziness — it is that every rule here has legitimate real-world
 * exceptions:
 *
 *   - house standards add function codes ISA-5.1 never defined (the project's
 *     own reference drawing uses ZSL/ZSH/ZI/HS/AV)
 *   - a tag prefix can overlap between equipment families (`T` is a tank or a
 *     tower depending on the plant; `D` is a drum here, a reactor vessel on
 *     the reference drawing)
 *   - a half-drawn diagram is the NORMAL state of a P&ID, so a partially
 *     specified line number is not an error
 *
 * A hard error would therefore make the tool confidently wrong about correct
 * drawings. A visible, listed, non-export-blocking warning tells an engineer
 * "check this" without ever refusing their drawing — which is exactly the bar
 * §4.9.2 sets.
 *
 * WHAT IS NOT LENIENT: a tag with no function letters, or no loop number.
 * Those genuinely break loop cross-referencing (§4.7), list generation (§4.6)
 * and DEXPI export, so they surface as errors through `validateDiagram`
 * rather than as warnings here.
 */
import { symbolsByKind } from '../symbols';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';
import { readIsaTag, isInstrumentLoopTag } from './isaTags';
import { checkPrefixMatchesCategory, isPrefixChecked } from './equipmentTags';
import { parseLineNumber, isMalformedLineNumber } from './lineNumbers';

export type TagWarningKind =
  | 'isa-function-code-unknown'
  | 'isa-variable-mismatch'
  | 'equipment-prefix-mismatch'
  | 'line-number-malformed';

export interface TagWarning {
  kind: TagWarningKind;
  message: string;
  nodeIds: string[];
  edgeId?: string;
}

export interface TagWarningNode {
  id: string;
  data: EquipmentNodeData;
}

export interface TagWarningEdge {
  id: string;
  source: string;
  target: string;
  data?: PipeEdgeData;
}

/**
 * Symbols whose whole identity IS one measured variable, and which therefore
 * may be checked against the tag's first letter.
 *
 * This is an explicit list rather than something inferred from `tagPrefix`,
 * because `tagPrefix` is a seeding convenience, not a semantic claim. Several
 * instrument symbols are deliberately generic: `indicator-local` seeds "PI"
 * but a local indicator is legitimately used for any variable (`TI-101` drawn
 * as a local indicator is correct, not a mistake), and `controller-dcs` seeds
 * "FIC" while a DCS controller can control flow, pressure, level or
 * temperature. Inferring from the prefix would warn on correct drawings,
 * which is worse than not warning at all.
 *
 * Only the transmitters, the element and the gauge qualify: a temperature
 * transmitter that is tagged `PT-101` (or a pressure transmitter tagged
 * `TT-101`) is a real drafting error that every other check in this app
 * misses — the tag is unique, the ports are seated, the spec matches.
 */
const VARIABLE_SPECIFIC_KINDS = new Set([
  'transmitter-temp',       // T
  'transmitter-pressure',   // P
  'transmitter-flow',       // F
  'transmitter-level',      // L
  'transmitter-dp',         // P (differential pressure)
  'instrument-flowmeter-inline', // F
  'instrument-gauge-pressure',   // P
  'analyzer',               // A
]);

/** First ISA letter each variable-specific symbol is expected to carry. */
const EXPECTED_FIRST_LETTER: Record<string, string> = {
  'transmitter-temp': 'T',
  'transmitter-pressure': 'P',
  'transmitter-flow': 'F',
  'transmitter-level': 'L',
  'transmitter-dp': 'P',
  'instrument-flowmeter-inline': 'F',
  'instrument-gauge-pressure': 'P',
  analyzer: 'A',
};

/**
 * Every instrument-category symbol validates as an ISA tag; equipment
 * categories validate their prefix against the drawn symbol.
 */
export function validateTagSemantics(
  nodes: TagWarningNode[],
  edges: TagWarningEdge[],
): TagWarning[] {
  const warnings: TagWarning[] = [];

  for (const node of nodes) {
    const symbol = symbolsByKind[node.data.kind];
    if (!symbol) continue; // unknown kind — validation already reports it
    const tag = (node.data.tag ?? '').trim();
    if (!tag) continue; // untagged is not this check's business

    // ── Instruments, Signal & Logic → ISA-5.1 reading ──
    if (symbol.category === 'Instruments' || symbol.category === 'Signal & Logic') {
      if (!isInstrumentLoopTag(node.data.kind)) continue;
      const reading = readIsaTag(tag);
      if (!reading.recognised && reading.functionCode) {
        warnings.push({
          kind: 'isa-function-code-unknown',
          message:
            `Instrument "${tag}" uses function code "${reading.functionCode}", which is not a ` +
            `standard ISA-5.1 code or a known house code. Fine if it is deliberate for this ` +
            `plant, but confirm — an unrecognised code will not be understood by anyone reading the drawing.`,
          nodeIds: [node.id],
        });
      }
      // A transmitter on a variable whose first letter disagrees with the
      // instrument the symbol actually depicts is worth flagging: a temperature
      // transmitter tagged PT-101 is a real drafting mistake that every other
      // check in this app misses.
      const expectedLetter = EXPECTED_FIRST_LETTER[node.data.kind];
      if (expectedLetter && reading.functionCode && reading.functionCode[0] !== expectedLetter) {
        const expected = readIsaTag(`${expectedLetter}I-1`);
        warnings.push({
          kind: 'isa-variable-mismatch',
          message:
            `Instrument "${tag}" reads as measuring ${reading.variable ?? reading.functionCode[0]}, ` +
            `but it is drawn as a ${symbol.label} (normally first letter "${expectedLetter}" = ` +
            `${expected.variable ?? expectedLetter}). Check the tag or the symbol.`,
          nodeIds: [node.id],
        });
      }
    }

    // ── Equipment categories → prefix vs symbol type ──
    if (isPrefixChecked(symbol.category)) {
      const { warning } = checkPrefixMatchesCategory(tag, symbol.category, symbol.label);
      if (warning) {
        warnings.push({ kind: 'equipment-prefix-mismatch', message: warning, nodeIds: [node.id] });
      }
    }
  }

  // ── Line numbers → grammar ──
  for (const edge of edges) {
    const data = edge.data;
    if (!data) continue;
    if (data.freePipe) continue; // free lines are unnumbered by design (§4.1)
    const lineNumber = (data.lineNumber ?? '').trim();
    if (!lineNumber) continue;
    if (isMalformedLineNumber(lineNumber)) {
      const { problem } = parseLineNumber(lineNumber);
      warnings.push({
        kind: 'line-number-malformed',
        message: `Line number "${lineNumber}" is not in the expected format. ${problem ?? ''}`.trim(),
        nodeIds: [edge.source, edge.target].filter(Boolean),
        edgeId: edge.id,
      });
    }
  }

  return warnings;
}

/** Whether a symbol's kind participates in the variable-vs-symbol check. */
export function isVariableSpecific(kind: string): boolean {
  return VARIABLE_SPECIFIC_KINDS.has(kind);
}

/**
 * Group a set of line numbers by service code, for the line list's
 * service-based ordering and for a future spec-break check. Returns a map of
 * service code -> line numbers; unparseable numbers collect under ''.
 */
export function groupLineNumbersByService(lineNumbers: string[]): Map<string, string[]> {
  const byService = new Map<string, string[]>();
  for (const raw of lineNumbers) {
    const { parts } = parseLineNumber(raw);
    const key = parts?.service ?? '';
    const bucket = byService.get(key);
    if (bucket) bucket.push(raw);
    else byService.set(key, [raw]);
  }
  return byService;
}

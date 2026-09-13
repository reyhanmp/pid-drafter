/**
 * Validity engine — pure functions over plain node/edge data, decoupled
 * from react-flow internals so it's testable in isolation and reusable
 * by a future export/print pipeline.
 */
import { symbolsByKind } from '../symbols/index';
import { getRenderedPorts } from '../symbols/effectivePorts';
import { isOffpageConnector, resolveOffpageRef, type SheetRef } from './offpageReferences';
import { findOverOccupiedPorts } from './connectionRules';
import { readIsaTag } from './isaTags';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';

export interface DiagramNode {
  id: string;
  data: EquipmentNodeData;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: PipeEdgeData;
}

export type ValidationErrorKind =
  | 'duplicate-tag'
  | 'unconnected-pipe'
  | 'offpage-broken-reference'
  | 'malformed-instrument-tag'
  | 'port-overloaded';

export interface ValidationError {
  kind: ValidationErrorKind;
  message: string;
  /** Node ids implicated in this error, e.g. both nodes sharing a duplicate tag. */
  nodeIds: string[];
  /** Edge id implicated, if this is a pipe-connection error. */
  edgeId?: string;
  /** Sheet id this error surfaced on (project-level validation). */
  sheetId?: string;
  /** Sheet name(s) implicated — set on project-wide duplicate-tag errors. */
  sheetNames?: string[];
}

export interface ValidationResult {
  errors: ValidationError[];
}

/** Rule 1: every equipment/instrument tag must be unique. */
function checkUniqueTags(nodes: DiagramNode[]): ValidationError[] {
  const byTag = new Map<string, string[]>();
  for (const node of nodes) {
    const tag = (node.data.tag ?? '').trim();
    if (!tag) continue;
    const ids = byTag.get(tag) ?? [];
    ids.push(node.id);
    byTag.set(tag, ids);
  }
  const errors: ValidationError[] = [];
  for (const [tag, ids] of byTag) {
    if (ids.length > 1) {
      errors.push({
        kind: 'duplicate-tag',
        message: `Duplicate tag "${tag}" used by ${ids.length} items`,
        nodeIds: ids,
      });
    }
  }
  return errors;
}

/**
 * Rule 2: every pipe/signal line must terminate on a declared port on a
 * known symbol. This is structurally guaranteed by the connector system
 * (edges may only be created from a react-flow Handle bound to a real
 * port id), but we verify defensively here in case data was edited
 * out-of-band (e.g. a future JSON load in a later phase).
 */
function checkPortConnections(nodes: DiagramNode[], edges: DiagramEdge[]): ValidationError[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const errors: ValidationError[] = [];

  for (const edge of edges) {
    // FREE LINE exemption (explicit user decision): a line drawn into
    // empty space has no nozzles by definition, so it is not a dangling
    // pipe and must not be reported. Flagged explicitly on the edge data
    // rather than inferred, so this stays a deliberate, documented
    // carve-out from PRD §4.1 rather than a hole the engine can't see.
    if ((edge.data as Record<string, unknown> | undefined)?.freePipe === true) continue;

    const problems: string[] = [];

    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

    if (!sourceNode) problems.push('source equipment missing');
    if (!targetNode) problems.push('target equipment missing');

    if (sourceNode) {
      const symbol = symbolsByKind[sourceNode.data.kind];
      if (!symbol) {
        problems.push('source equipment has unknown symbol kind');
      } else {
        const effectivePorts = getRenderedPorts(sourceNode.data.kind, sourceNode.data.ports, sourceNode.data.rotation, sourceNode.data.width, sourceNode.data.height);
        if (!edge.sourceHandle || !effectivePorts.some((p) => p.id === edge.sourceHandle)) {
          problems.push('source end is not attached to a declared port');
        }
      }
    }

    if (targetNode) {
      const symbol = symbolsByKind[targetNode.data.kind];
      if (!symbol) {
        problems.push('target equipment has unknown symbol kind');
      } else {
        const effectivePorts = getRenderedPorts(targetNode.data.kind, targetNode.data.ports, targetNode.data.rotation, targetNode.data.width, targetNode.data.height);
        if (!edge.targetHandle || !effectivePorts.some((p) => p.id === edge.targetHandle)) {
          problems.push('target end is not attached to a declared port');
        }
      }
    }

    if (problems.length > 0) {
      errors.push({
        kind: 'unconnected-pipe',
        message: `Pipe ${edge.id}: ${problems.join('; ')}`,
        nodeIds: [edge.source, edge.target].filter(Boolean),
        edgeId: edge.id,
      });
    }
  }

  return errors;
}

/**
 * Rule 5 (PRD §4.1 + §7a items 1+2): a nozzle carries exactly ONE pipe.
 *
 * This is the rule that makes §4.1's premise true rather than merely
 * plausible. Before it, two runs could be dragged onto the same port and the
 * panel reported nothing, so a diagram showing three lines converging on one
 * vessel nozzle — which is not a drawing of anything buildable — passed every
 * check the tool had.
 *
 * The exception is a branch fitting's header port (a tee's run), declared on
 * the symbol itself. The decision lives in connectionRules.ts so the canvas
 * (which refuses the connection outright) and this rule (which catches data
 * that arrived some other way, e.g. a JSON load) can never disagree — a
 * refusal on the canvas plus a clean bill of health from the panel would be
 * worse than either alone.
 */
function checkPortOccupancy(nodes: DiagramNode[], edges: DiagramEdge[]): ValidationError[] {
  return findOverOccupiedPorts(nodes, edges).map((occ) => {
    const portLabel = symbolsByKind[occ.kind]?.ports.find((p) => p.id === occ.handleId)?.label ?? occ.handleId;
    return {
      kind: 'port-overloaded' as const,
      message:
        `Nozzle overloaded — "${occ.nodeTag}" ${portLabel} carries ${occ.edgeIds.length} pipes. ` +
        `One pipe per nozzle; branch the line through a Tee / Branch Fitting.`,
      nodeIds: [occ.nodeId],
      edgeId: occ.edgeIds[0],
    };
  });
}

/**
 * Rule 4 (PRD §4.9.2): an instrument tag must carry function letters and a
 * loop number.
 *
 * This is the one tag rule that IS a hard error, and deliberately so: loop
 * cross-referencing (§4.7), list generation (§4.6) and DEXPI export all parse
 * the tag, and a tag with no letters or no number silently breaks all three.
 * Everything else about tag semantics — unrecognised ISA codes, prefixes that
 * disagree with the symbol — stays a soft warning, because house standards
 * legitimately violate the letter of the standard and a tool that refuses
 * those drawings is worse than useless.
 *
 * Untagged instruments are NOT flagged: a half-drawn diagram is normal, and
 * the empty tag is already obvious on screen.
 */
function checkInstrumentTagShape(nodes: DiagramNode[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const node of nodes) {
    const symbol = symbolsByKind[node.data.kind];
    if (!symbol) continue;
    if (symbol.category !== 'Instruments' && symbol.category !== 'Signal & Logic') continue;
    const tag = (node.data.tag ?? '').trim();
    if (!tag) continue;
    const { problem } = readIsaTag(tag);
    if (problem) {
      errors.push({
        kind: 'malformed-instrument-tag',
        message: `Instrument "${tag}" — ${problem}`,
        nodeIds: [node.id],
      });
    }
  }
  return errors;
}

/** Run all validity rules against a diagram and return every current error. */
export function validateDiagram(nodes: DiagramNode[], edges: DiagramEdge[]): ValidationResult {
  return {
    errors: [
      ...checkUniqueTags(nodes),
      ...checkPortConnections(nodes, edges),
      ...checkPortOccupancy(nodes, edges),
      ...checkInstrumentTagShape(nodes),
    ],
  };
}

/**
 * Rule 3 (PRD §4.8): an off-page / tie-in connector's declared target
 * (drawing sheet + tag) must resolve. A connector pointing at a sheet or
 * tag that no longer exists is a HARD error — this is what gives
 * cross-sheet references teeth. Pure: operates on plain sheet data.
 */
export interface ProjectValidationSheet {
  id: string;
  name: string;
  order: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

function checkOffpageReferences(sheets: ProjectValidationSheet[]): ValidationError[] {
  const sheetRefs: SheetRef[] = sheets.map((s) => ({ id: s.id, name: s.name, order: s.order, nodes: s.nodes }));
  const errors: ValidationError[] = [];

  for (const sheet of sheets) {
    for (const node of sheet.nodes) {
      if (!isOffpageConnector(node.data)) continue;
      const ref = resolveOffpageRef(node.data, sheetRefs);
      if (ref.status !== 'broken') continue;
      errors.push({
        kind: 'offpage-broken-reference',
        message: `Off-page connector "${node.data.tag || node.id}" references a target that does not exist: ${ref.problem}`,
        nodeIds: [node.id],
        sheetId: sheet.id,
        sheetNames: [sheet.name],
      });
    }
  }
  return errors;
}

/**
 * Rule 1, project-wide (PRD §4.1 + §4.8): tag uniqueness is enforced
 * across ALL sheets, not just within one. A tag used on two different
 * sheets is a hard error, and the message names both sheets so the user
 * knows where to go fix it.
 */
function checkUniqueTagsProjectWide(sheets: ProjectValidationSheet[]): ValidationError[] {
  const byTag = new Map<string, Array<{ sheetId: string; sheetName: string; nodeId: string }>>();
  for (const sheet of sheets) {
    for (const node of sheet.nodes) {
      const tag = (node.data.tag ?? '').trim();
      if (!tag) continue;
      const list = byTag.get(tag) ?? [];
      list.push({ sheetId: sheet.id, sheetName: sheet.name, nodeId: node.id });
      byTag.set(tag, list);
    }
  }

  const errors: ValidationError[] = [];
  for (const [tag, hits] of byTag) {
    if (hits.length < 2) continue;
    const distinctSheetIds = [...new Set(hits.map((h) => h.sheetId))];
    const sheetNames = [...new Set(hits.map((h) => h.sheetName))];
    const where =
      distinctSheetIds.length > 1
        ? `across sheets ${sheetNames.map((n) => `"${n}"`).join(' and ')}`
        : `on sheet "${sheetNames[0]}"`;
    errors.push({
      kind: 'duplicate-tag',
      message: `Duplicate tag "${tag}" used by ${hits.length} items ${where}`,
      nodeIds: hits.map((h) => h.nodeId),
      sheetId: hits[0].sheetId,
      sheetNames,
    });
  }
  return errors;
}

/**
 * Project-level validity (PRD §4.8): runs every per-sheet rule plus the
 * project-wide tag-uniqueness rule and the off-page-reference rule.
 * Still a pure function over plain data — no react-flow imports.
 */
export function validateProject(sheets: ProjectValidationSheet[]): ValidationResult {
  const errors: ValidationError[] = [];

  // Per-sheet structural rules (dangling pipes on the sheet they live on).
  for (const sheet of sheets) {
    for (const err of validateDiagram(sheet.nodes, sheet.edges).errors) {
      // Tag-duplicate-per-sheet is subsumed by the project-wide check below,
      // which produces a message naming the sheets involved.
      if (err.kind === 'duplicate-tag') continue;
      errors.push({ ...err, sheetId: sheet.id, sheetNames: [sheet.name] });
    }
  }

  errors.push(...checkUniqueTagsProjectWide(sheets));
  errors.push(...checkOffpageReferences(sheets));

  return { errors };
}


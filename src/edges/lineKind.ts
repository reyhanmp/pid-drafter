/**
 * The single place that decides what a pipe/signal/boundary line IS.
 *
 * Before this module, `PipeEdgeData.lineType` was a two-value union
 * (`'process' | 'signal'`) and every consumer re-derived meaning from it
 * ad hoc: PipeEdge decided its stroke width from a hardcoded 2,
 * LineDataSheetPanel decided its toggle state from `lineType === 'signal'`,
 * engineeringLists decided its Type column the same way. Adding a third line
 * kind (battery limit, PRD §7a item 3) by editing each of those sites would
 * guarantee they drift, and the failure mode is a drawing where the line list
 * disagrees with the line on the canvas.
 *
 * So the decision lives here, exactly as §4.12's connectivity decision lives
 * in connectionRules.ts and for the same reason. Consumers ask this module
 * what a line looks like; they do not each hold an opinion.
 *
 * Pure functions over plain data — no react-flow import — so the canvas, the
 * data sheet, the engineering lists and the validity engine all read one
 * answer.
 */
import { LINE_WEIGHT } from '../symbols/style';

/**
 * What a line MEANS.
 *
 * - `main`     — a main process pipe run. Heaviest (PRD §6 tier 1).
 * - `branch`   — branch/secondary process piping. Tier 2. A pipe is a branch
 *                when it is downstream of a branch fitting's branch port.
 * - `signal`   — pneumatic/electric instrument signal. Thin dashed (tier 4).
 * - `boundary` — battery-limit / scope boundary. Thin dash-dot (tier 5).
 */
export type LineKind = 'main' | 'branch' | 'signal' | 'boundary';

/**
 * The PERSISTED discriminator. Deliberately NOT the same enum as `LineKind`:
 *
 * `main` vs `branch` is DERIVED from what the line is attached to (see
 * `isBranchRun`), so persisting it would create a second source of truth that
 * can go stale the moment a pipe is re-routed onto or off a branch fitting.
 * A drawing would then show a branch pipe at main weight because the stored
 * flag was set before the reroute. What is persisted is the user's INTENT
 * (`process` vs `signal` vs `boundary`); how heavy a process run draws is
 * computed from the graph every render.
 */
export type LineType = 'process' | 'signal' | 'boundary';

export const LINE_TYPES: readonly LineType[] = ['process', 'signal', 'boundary'];

export function isLineType(value: unknown): value is LineType {
  return typeof value === 'string' && (LINE_TYPES as readonly string[]).includes(value);
}

/** Human label for the data sheet's line-type toggle and the line list. */
export const LINE_TYPE_LABELS: Record<LineType, string> = {
  process: 'Piping (solid)',
  signal: 'Instrument (dashed)',
  boundary: 'Battery limit (dash-dot)',
};

/** Short label for table cells in the engineering lists. */
export const LINE_TYPE_SHORT: Record<LineType, string> = {
  process: 'Process',
  signal: 'Signal',
  boundary: 'Battery limit',
};

/**
 * A port may legitimately carry a battery-limit line in any of these spellings,
 * because the library and any loaded JSON disagree about which one means
 * "scope boundary" (`boundary` was added later; `battery-limit` is the spelling
 * an earlier hand-authored file would use). All are accepted so a real project
 * is never refused over a naming variant.
 */
const BOUNDARY_PORT_KINDS = new Set(['boundary', 'battery-limit']);

export function isBoundaryPortKind(kind: string | undefined): boolean {
  return kind !== undefined && BOUNDARY_PORT_KINDS.has(kind);
}

/**
 * Read the persisted line type off edge data.
 *
 * Absent means `process`: every edge created before the boundary type existed
 * carries no `lineType` at all in some saved files, and a process pipe is what
 * all of them were. Unknown values also fall back to `process` here — strict
 * REJECTION of an unknown type is the loader's job (see project/serialize.ts),
 * so that a corrupt file is refused with a message rather than silently
 * reinterpreted. This function is for rendering data already accepted.
 */
export function readLineType(data: { lineType?: unknown } | undefined | null): LineType {
  const raw = data?.lineType;
  return isLineType(raw) ? raw : 'process';
}

/** A minimal edge shape — react-flow's Edge satisfies it. */
export interface KindEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Record<string, unknown> | undefined;
}

/** A minimal node shape. */
export interface KindNode {
  id: string;
  data: Record<string, unknown>;
}

/**
 * True when this edge leaves a branch fitting's BRANCH port.
 *
 * This is what makes tier 2 real rather than decorative. A branch fitting
 * declares which of its ports is the branch (the tee's `branch` port, as
 * opposed to the `run-in`/`run-out` header ports), and a run leaving that port
 * is by definition secondary piping — it is the pipe that exists only because
 * the line split. Reproducing §6's main-vs-branch distinction therefore does
 * not require the user to declare anything: the drawing already says it.
 *
 * Takes the SYMBOL'S declared branch port ids rather than importing the symbol
 * registry, so this module stays pure and dependency-free and can be unit-
 * tested in isolation. Call sites pass `symbolsByKind[kind].branchPorts`.
 */
export function isBranchRun(
  edge: KindEdge,
  nodes: KindNode[],
  branchPortsOf: (kind: string) => string[] | undefined,
): boolean {
  const kindOfNode = (nodeId: string): string => {
    const node = nodes.find((n) => n.id === nodeId);
    const k = node?.data.kind;
    return typeof k === 'string' ? k : '';
  };

  const start = branchPortsOf(kindOfNode(edge.source));
  if (start && edge.sourceHandle && start.includes(edge.sourceHandle)) return true;

  const end = branchPortsOf(kindOfNode(edge.target));
  if (end && edge.targetHandle && end.includes(edge.targetHandle)) return true;

  return false;
}

/**
 * Resolve what a line is, and therefore how heavy and how dashed to draw it.
 *
 * Order matters: an explicitly-signal port beats the branch heuristic (a signal
 * line off a tee's branch port is still a signal line, not a heavy branch
 * pipe), and an explicitly-declared port kind beats the persisted intent,
 * because the port is the physically real end of the line.
 *
 * Battery-limit lines are drawn at the same THIN weight as signals but with
 * the dash-dot pattern. That matches the reference drawing, where the boundary
 * line is not heavier than other thin ink — it is distinguished by pattern,
 * not weight. A thicker boundary line would be an invented convention.
 */
export function resolveLineKind(
  edge: KindEdge,
  nodes: KindNode[],
  branchPortsOf: (kind: string) => string[] | undefined,
  portKindOf?: (edge: KindEdge) => string | undefined,
): LineKind {
  const declared = readLineType(edge.data);

  if (declared === 'boundary') return 'boundary';
  if (declared === 'signal') return 'signal';

  // The port's own declared kind is the tighter signal: a line whose endpoint
  // port is a battery-limit port is a boundary line whatever it was created as.
  const portKind = portKindOf?.(edge);
  if (isBoundaryPortKind(portKind)) return 'boundary';
  if (portKind === 'signal') return 'signal';

  return isBranchRun(edge, nodes, branchPortsOf) ? 'branch' : 'main';
}

/** Stroke properties for a resolved line kind. One source of truth. */
export interface LineStroke {
  strokeWidth: number;
  strokeDasharray?: string;
  /** Process lines carry a directional arrowhead; signal and boundary lines do not. */
  carriesArrow: boolean;
}

export function strokeForLineKind(kind: LineKind, dash: { signal: string; boundary: string }): LineStroke {
  switch (kind) {
    case 'main':
      return { strokeWidth: LINE_WEIGHT.heavy, carriesArrow: true };
    case 'branch':
      return { strokeWidth: LINE_WEIGHT.medium, carriesArrow: true };
    case 'signal':
      return { strokeWidth: LINE_WEIGHT.thin, strokeDasharray: dash.signal, carriesArrow: false };
    case 'boundary':
      return { strokeWidth: LINE_WEIGHT.thin, strokeDasharray: dash.boundary, carriesArrow: false };
  }
}

/** The union of arrowhead-carrying kinds — used when a line type changes. */
export function carriesArrow(kind: LineKind): boolean {
  return kind === 'main' || kind === 'branch';
}

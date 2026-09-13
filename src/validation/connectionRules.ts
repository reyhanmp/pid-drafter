/**
 * Connectivity soundness (PRD §4.1 + §7a items 1+2).
 *
 * THE RULE: a nozzle carries ONE pipe. A nozzle is a hole in a vessel wall
 * with a flange on it — two pipes cannot bolt to the same flange, and a
 * drawing that shows three runs converging on one nozzle is not a drawing of
 * anything buildable. §4.1's premise is that the validity engine checks
 * *structural* correctness, and before this file it did not check that:
 * two pipes could be dragged onto the same port and nothing reported
 * anything, so the load-bearing feature had a soundness hole (not a missing
 * nicety) at its centre.
 *
 * THE EXCEPTION: a *branch fitting*. Where a line becomes two is a real
 * fitting (a tee), and the fitting owns the split — the run of a tee is a
 * header that legitimately carries more than one pipe. So the exception is
 * declared ON THE SYMBOL (`SymbolDefinition.multiBranchPorts`), not inferred
 * from port counts or from a port happening to face both ways. If the
 * branching is not visible as a fitting in the drawing, it is not branching;
 * it is a drawing error. That is what keeps this a P&ID rule rather than a
 * graph-editor feature.
 *
 * Pure functions over plain data, same as the rest of src/validation/, so the
 * connect path (react-flow's `isValidConnection`), the validity panel, and a
 * future JSON-load gate all decide this identically instead of each growing
 * their own opinion.
 */
import { symbolsByKind } from '../symbols/index';

/** Minimal shape this module needs from an edge — react-flow's Edge satisfies it. */
export interface OccupancyEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Record<string, unknown> | undefined;
}

/** Minimal shape this module needs from a node. `data` is deliberately loose so
 * react-flow's own `Node` satisfies it with no cast at the call site; `kind` is
 * read defensively and an unknown kind always gets the STRICT rule. */
export interface OccupancyNode {
  id: string;
  data: Record<string, unknown>;
}

function kindOf(node: OccupancyNode): string {
  const k = node.data.kind;
  return typeof k === 'string' ? k : '';
}

function tagOf(node: OccupancyNode): string {
  const t = node.data.tag;
  return typeof t === 'string' && t ? t : node.id;
}

/** A port carrying more pipes than it is allowed to. */
export interface PortOccupancy {
  nodeId: string;
  nodeTag: string;
  kind: string;
  handleId: string;
  /** Pipe ids currently on this port, in edge order. */
  edgeIds: string[];
}

function isFreeLine(edge: OccupancyEdge): boolean {
  return edge.data?.freePipe === true;
}

/**
 * True when `handleId` on symbol `kind` is declared multi-branch.
 *
 * An unknown kind returns false: an unrecognised symbol gets the STRICT rule,
 * not the permissive one, so a symbol that fails to load cannot silently
 * become a place where pipes pile up.
 */
export function isMultiBranchPort(kind: string, handleId: string | null | undefined): boolean {
  if (!handleId) return false;
  return symbolsByKind[kind]?.multiBranchPorts?.includes(handleId) ?? false;
}

/**
 * Every port in the diagram carrying more pipes than it is allowed to.
 *
 * Free lines are excluded (they attach to no port by definition). Edges with a
 * missing handle are excluded — those are a *dangling pipe* problem, which
 * `checkPortConnections` already reports under its own rule; double-reporting
 * one defect as two would make the error count meaningless.
 *
 * An empty result means the connectivity is physically possible. This is the
 * whole decision, so the connect path and the loader share it.
 */
export function findOverOccupiedPorts(nodes: OccupancyNode[], edges: OccupancyEdge[]): PortOccupancy[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  /** key: `${nodeId}\u0000${handleId}` */
  const pipes = new Map<string, string[]>();

  const record = (nodeId: string, handleId: string | null | undefined, edgeId: string) => {
    if (!handleId) return;
    const key = `${nodeId}\u0000${handleId}`;
    const list = pipes.get(key);
    if (list) list.push(edgeId);
    else pipes.set(key, [edgeId]);
  };

  for (const edge of edges) {
    if (isFreeLine(edge)) continue;
    record(edge.source, edge.sourceHandle, edge.id);
    record(edge.target, edge.targetHandle, edge.id);
  }

  const out: PortOccupancy[] = [];
  for (const [key, edgeIds] of pipes) {
    if (edgeIds.length < 2) continue;
    const [nodeId, handleId] = key.split('\u0000');
    const node = nodeById.get(nodeId);
    if (!node) continue; // unknown node is a different rule's business
    const kind = kindOf(node);
    if (isMultiBranchPort(kind, handleId)) continue;
    out.push({
      nodeId,
      nodeTag: tagOf(node),
      kind,
      handleId,
      edgeIds,
    });
  }
  return out;
}

/**
 * Number of pipes already on each port of the diagram, keyed
 * `${nodeId}\u0000${handleId}`.
 *
 * Used by the canvas to mark an occupied nozzle so the single-connection rule
 * is visible BEFORE a drag is attempted. A rule the user only discovers by
 * being refused reads as a broken tool; a port that already shows a pipe
 * attached reads as engineering.
 */
export function numberOccupiedPorts(edges: OccupancyEdge[]): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (nodeId: string, handleId: string | null | undefined) => {
    if (!handleId) return;
    const key = `${nodeId}\u0000${handleId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const edge of edges) {
    if (isFreeLine(edge)) continue;
    bump(edge.source, edge.sourceHandle);
    bump(edge.target, edge.targetHandle);
  }
  return counts;
}

/**
 * The first port on this instance that still has room for a pipe, or null when
 * every port is spent.
 *
 * Needed because a refusal alone is a dead end. When a connection is rejected
 * the canvas wants to offer the one action that actually solves it — drop a
 * tee on a free port of the equipment and re-run the line through the tee —
 * and that requires knowing which nozzle is free. Reads the SAME occupancy
 * map the render path uses, so the port a tee would land on is the port the
 * user sees as empty.
 */
export function getSuggestedPortId(
  kind: string,
  occupied: Record<string, number> | undefined,
  multiBranchPorts: string[] | undefined,
): string | null {
  const symbol = symbolsByKind[kind];
  if (!symbol) return null;
  const taken = occupied ?? {};
  for (const port of symbol.ports) {
    if (multiBranchPorts?.includes(port.id)) continue; // not "free", just unconstrained
    if ((taken[port.id] ?? 0) === 0) return port.id;
  }
  return null;
}

/** The occupancy map key for one port. One place, so nothing can disagree. */
export function portKey(nodeId: string, handleId: string): string {
  return `${nodeId}\u0000${handleId}`;
}

export interface ConnectionRequest {
  source: string | null;
  target: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface ConnectionDecision {
  allowed: boolean;
  /** Why it was refused, naming the port — shown to the user verbatim. */
  reason?: string;
  /**
   * WHICH end was refused. Required, not decorative: the caller offers to drop
   * a branch fitting on the offending equipment's free nozzle, and the obvious
   * implementation (`target ?? source`) points at whichever end happens to be
   * the target — so a drag from a spent nozzle INTO a free one would offer to
   * put the tee on the equipment that was never the problem. The user would
   * click it, get a tee on the wrong vessel, and still be unable to make the
   * connection. The decision knows which end failed; it has to say so.
   */
  blockedNodeId?: string;
  blockedHandleId?: string;
}

/**
 * May this connection be MADE, given what is on the sheet right now?
 *
 * Used as react-flow's `isValidConnection`. Refusing here (rather than
 * accepting and repairing afterwards) is deliberate: whatever the user sees
 * during the drag is what they get, and a connection that is created and then
 * silently rolled back is indistinguishable from a broken drag.
 *
 * A drag from a free end (no source/target resolved yet) is allowed: react-flow
 * calls this with partial state mid-drag, and refusing those would make the
 * whole gesture dead.
 */
export function canConnect(
  request: ConnectionRequest,
  nodes: OccupancyNode[],
  edges: OccupancyEdge[],
): ConnectionDecision {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const endpoints: Array<{ role: 'source' | 'target'; nodeId: string | null; handleId: string | null | undefined }> = [
    { role: 'source', nodeId: request.source, handleId: request.sourceHandle },
    { role: 'target', nodeId: request.target, handleId: request.targetHandle },
  ];

  for (const { nodeId, handleId } of endpoints) {
    if (!nodeId || !handleId) continue; // half-formed drag, nothing to judge
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const kind = kindOf(node);
    if (isMultiBranchPort(kind, handleId)) continue;

    const taken = edges.filter(
      (e) =>
        !isFreeLine(e) &&
        ((e.source === nodeId && e.sourceHandle === handleId) || (e.target === nodeId && e.targetHandle === handleId)),
    );
    if (taken.length === 0) continue;

    const portLabel =
      symbolsByKind[kind]?.ports.find((p: { id: string; label: string }) => p.id === handleId)?.label ?? handleId;
    return {
      allowed: false,
      reason:
        `${tagOf(node)} — ${portLabel} already has a pipe on it. A nozzle takes one pipe; ` +
        `branch the line through a Tee / Branch Fitting instead.`,
      blockedNodeId: nodeId,
      blockedHandleId: handleId,
    };
  }

  return { allowed: true };
}

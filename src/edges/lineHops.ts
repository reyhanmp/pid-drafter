/**
 * Line hops at crossings (PRD §7a item 4, §6 tier 4).
 *
 * THE PROBLEM: real P&IDs break one line over another where they cross WITHOUT
 * connecting. Every crossing in this tool previously looked like an unmarked
 * intersection, so with more than a few runs on a sheet a reader could not tell
 * a crossing from a junction — a genuine correctness problem in a drawing whose
 * whole job is to be read, not a cosmetic nicety.
 *
 * THE RULE, and why it is not symmetric: on a real drawing exactly ONE of the
 * two lines is broken at a crossing. If both broke, the crossing would read as
 * a gap in both lines and the topology would be *less* legible than a plain
 * intersection. So a hop needs a priority, and the priority here is:
 *
 *   1. Heavier line wins. A signal or battery-limit line breaks over a process
 *      pipe. This matches the reference drawing, where the thin dashed signal
 *      lines are the ones that visually pass under the heavy main run.
 *   2. Equal weight: the later-created edge breaks, decided by a total order on
 *      edge id so the result is deterministic rather than dependent on render
 *      order. Two process pipes crossing produce exactly one hop, not two and
 *      not zero.
 *
 * WHAT IS NOT A CROSSING:
 *   - Edges sharing a node. Those meet at a nozzle, which is a junction; a hop
 *     there would draw a break an inch from the equipment it connects to.
 *   - Free lines (they attach to no port by definition).
 *   - A crossing at a route's own vertex or endpoint. Only strictly interior
 *     crossings get a gap, so a hop can never eat a corner it needs.
 *   - Collinear/overlapping runs. Two segments sharing a direction are not
 *     crossing; a zero-length projection would put a gap in the wrong place.
 *
 * Pure over plain data — the route builder and the symbol registry only — so
 * the geometry is unit-testable and the canvas cannot disagree with a gate.
 */
import { buildOrthogonalPath, type RoutePoint } from './orthogonalRouting';
import { getRenderedPorts } from '../symbols/effectivePorts';
import { symbolsByKind } from '../symbols/index';
import { resolveLineKind, type KindEdge, type KindNode, type LineKind } from './lineKind';

/** Half-gap on each side of the crossing, in flow units. */
const HOP_GAP = 7;
/** Crossings closer than this to a vertex are ignored — a gap there eats the corner. */
const VERTEX_CLEARANCE = 9;
/** Segments shorter than this cannot carry a legible gap. */
const MIN_SEGMENT_FOR_HOP = 20;

export interface HopEdge extends KindEdge {
  id: string;
}

export interface HopNode extends KindNode {
  position: { x: number; y: number };
}

interface Segment {
  a: RoutePoint;
  b: RoutePoint;
}

/** Absolute flow-coordinate position of a port on a node, or null if unresolvable. */
function portPosition(node: HopNode, handleId: string | null | undefined): RoutePoint | null {
  const port = findPort(node, handleId);
  if (!port) return null;
  return { x: node.position.x + port.x, y: node.position.y + port.y };
}

/** Port kind declared on a node's port, or undefined. */
function portKindOf(node: HopNode | undefined, handleId: string | null | undefined): string | undefined {
  return findPort(node, handleId)?.kind;
}

function findPort(node: HopNode | undefined, handleId: string | null | undefined) {
  if (!node || !handleId) return undefined;
  const kind = typeof node.data.kind === 'string' ? node.data.kind : '';
  const width = typeof node.data.width === 'number' ? node.data.width : 0;
  const height = typeof node.data.height === 'number' ? node.data.height : 0;
  const rotation = typeof node.data.rotation === 'number' ? node.data.rotation : 0;
  const ports = getRenderedPorts(kind, node.data.ports as never, rotation, width, height);
  return ports.find((p) => p.id === handleId);
}

/** One place that resolves a hop's line kind, so every call site agrees. */
function kindFor(edge: HopEdge, nodeById: Map<string, HopNode>): LineKind {
  return resolveLineKind(
    edge,
    [...nodeById.values()],
    (k) => symbolsByKind[k]?.branchPorts,
    (e) =>
      portKindOf(nodeById.get(e.source), e.sourceHandle) ??
      portKindOf(nodeById.get(e.target), e.targetHandle),
  );
}

/** The route an edge actually draws, or null when its geometry cannot be resolved. */
function routeOf(edge: HopEdge, nodeById: Map<string, HopNode>): RoutePoint[] | null {
  const sourceNode = nodeById.get(edge.source);
  const targetNode = nodeById.get(edge.target);
  if (!sourceNode || !targetNode) return null;

  const start = portPosition(sourceNode, edge.sourceHandle);
  const end = portPosition(targetNode, edge.targetHandle);
  if (!start || !end) return null;

  const d = (edge.data ?? {}) as Record<string, unknown>;
  const startDir = (d.sourceDirection as { x: number; y: number } | undefined) ?? { x: 1, y: 0 };
  const endDir = (d.targetDirection as { x: number; y: number } | undefined) ?? { x: -1, y: 0 };

  return buildOrthogonalPath(start, startDir, end, endDir);
}

/** Ordering weight of a line: heavier means "wins, does not break". */
function priorityOf(kind: LineKind): number {
  switch (kind) {
    case 'main':
      return 3;
    case 'branch':
      return 2;
    // Signal and boundary are both drawn thin; they break over any process run.
    case 'signal':
    case 'boundary':
      return 1;
  }
}

/**
 * Break `ownPoints` wherever this route crosses a HIGHER-OR-EQUAL-priority
 * route that wins the tie-break. Returns a list of subpaths: a hop is a real
 * break in the drawn line, not a thinner stroke, so the result cannot be a
 * single continuous point list. The caller renders each subpath as its own
 * `M…L…` run.
 */
export function applyLineHops(
  ownPoints: RoutePoint[],
  ownEdge: HopEdge,
  allEdges: HopEdge[],
  nodes: HopNode[],
): RoutePoint[][] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const ownPriority = priorityOf(kindFor(ownEdge, nodeById));

  /**
   * Only lines that OUTRANK this one can force a break in it. Rank is
   * comparison-then-id: semantically weight-first, and total so that
   * equal-weight crossings still resolve to exactly one hop.
   */
  const obstacles: Segment[] = [];
  for (const other of allEdges) {
    if (other.id === ownEdge.id) continue;
    if (other.data?.freePipe === true) continue;

    // Two lines that share a node meet at that node's nozzle. Even when they
    // also cross elsewhere (a line leaving a vessel and looping back over it),
    // they are the same subsystem, and breaking one right next to its own
    // equipment is unreadable — so node-sharing pairs are left alone entirely.
    const sharedNode =
      other.source === ownEdge.source ||
      other.target === ownEdge.target ||
      other.source === ownEdge.target ||
      other.target === ownEdge.source;
    if (sharedNode) continue;

    const otherPriority = priorityOf(kindFor(other, nodeById));
    const wins = otherPriority > ownPriority || (otherPriority === ownPriority && other.id < ownEdge.id);
    if (!wins) continue;

    const otherPoints = routeOf(other, nodeById);
    if (!otherPoints) continue;

    for (let i = 0; i < otherPoints.length - 1; i++) {
      obstacles.push({ a: otherPoints[i], b: otherPoints[i + 1] });
    }
  }

  if (obstacles.length === 0) return [ownPoints];

  const subpaths: RoutePoint[][] = [];
  let current: RoutePoint[] = [ownPoints[0]];

  for (let i = 0; i < ownPoints.length - 1; i++) {
    const a = ownPoints[i];
    const b = ownPoints[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);

    if (segLen < MIN_SEGMENT_FOR_HOP) {
      current.push(b);
      continue;
    }

    const cuts: number[] = [];
    for (const ob of obstacles) {
      const t = interiorCrossingParam(a, b, ob.a, ob.b);
      if (t === null) continue;
      const distAlong = t * segLen;
      // Skip crossings that would put a gap on top of a vertex — including the
      // segment's own endpoints, where a break would detach the pipe from its
      // nozzle.
      if (distAlong < VERTEX_CLEARANCE || segLen - distAlong < VERTEX_CLEARANCE) continue;
      cuts.push(t);
    }

    if (cuts.length === 0) {
      current.push(b);
      continue;
    }

    cuts.sort((x, y) => x - y);
    const ux = (b.x - a.x) / segLen;
    const uy = (b.y - a.y) / segLen;
    const half = HOP_GAP / 2;

    let lastCut = -Infinity;
    for (const t of cuts) {
      const dist = t * segLen;
      // Two crossings within one gap width cannot both be drawn; merge them
      // into a single gap rather than emitting a sliver of line between them.
      if (dist - lastCut < HOP_GAP) continue;
      lastCut = dist;

      const cx = a.x + ux * dist;
      const cy = a.y + uy * dist;

      // Close the current subpath just short of the crossing...
      current.push({ x: cx - ux * half, y: cy - uy * half });
      subpaths.push(current);
      // ...and start the next one just past it. The gap between is the hop.
      current = [{ x: cx + ux * half, y: cy + uy * half }];
    }
    current.push(b);
  }

  subpaths.push(current);
  return subpaths.filter((sp) => sp.length >= 2);
}

/**
 * If segment A→B crosses segment C→D at a point strictly interior to both,
 * return the parameter t along A→B. Otherwise null.
 *
 * Collinear overlaps return null: two runs sharing a direction are not
 * crossing, and a hop there would be a break in a line that never intersects.
 * Shared endpoints return null for the same reason — that is a junction.
 */
function interiorCrossingParam(a: RoutePoint, b: RoutePoint, c: RoutePoint, d: RoutePoint): number | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;

  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null; // parallel or collinear

  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;

  // Strictly interior to both segments.
  const EPS = 1e-6;
  if (t <= EPS || t >= 1 - EPS) return null;
  if (u <= EPS || u >= 1 - EPS) return null;

  return t;
}

/** Subpaths to an SVG `d`. A hop is a break, so each subpath is its own run. */
export function subpathsToPath(subpaths: RoutePoint[][]): string {
  return subpaths
    .filter((sp) => sp.length >= 2)
    .map((sp) => sp.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '))
    .join(' ');
}

/** Exported for the gates, so the hop geometry can be asserted directly. */
export const HOP_METRICS = { HOP_GAP, VERTEX_CLEARANCE, MIN_SEGMENT_FOR_HOP } as const;

/**
 * Per-render cache. `applyLineHops` is O(other edges) per edge, so recomputing
 * it for every edge on every render is O(E^2) route builds — measurable on a
 * Raspberry Pi at the density this tool targets.
 *
 * Keyed on the EDGES and NODES ARRAY IDENTITIES, which react-flow replaces
 * whenever their contents change. That makes the key exactly as stable as the
 * data it caches: no invalidation logic to get wrong, and a stale hop is
 * impossible because a change to any edge or node produces a new array.
 */
const hopCache = new WeakMap<object, WeakMap<object, Map<string, RoutePoint[][]>>>();

export function hopSubpathsFor(edge: HopEdge, edges: HopEdge[], nodes: HopNode[]): RoutePoint[][] {
  let perNodes = hopCache.get(edges);
  if (!perNodes) {
    perNodes = new WeakMap();
    hopCache.set(edges, perNodes);
  }
  let perEdge = perNodes.get(nodes);
  if (!perEdge) {
    perEdge = new Map();
    perNodes.set(nodes, perEdge);
  }
  const hit = perEdge.get(edge.id);
  if (hit) return hit;

  const ownPoints = routeOf(edge, new Map(nodes.map((n) => [n.id, n])));
  const result = ownPoints ? applyLineHops(ownPoints, edge, edges, nodes) : [];
  perEdge.set(edge.id, result);
  return result;
}

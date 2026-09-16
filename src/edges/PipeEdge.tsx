import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react';
import { hopSubpathsFor, subpathsToPath } from './lineHops';
import type { PipeEdgeData } from '../types/diagram';
import { symbolsByKind } from '../symbols/index';
import { resolveLineKind, strokeForLineKind, isBoundaryPortKind, type KindNode } from './lineKind';
import { LINE_DASH, STROKE } from '../symbols/style';

const SELECTED_COLOR = '#0066cc';

/**
 * Seamless pipe / signal-line edge.
 *
 * Unlike react-flow's built-in smoothstep/step edges (which ignore port
 * orientation and just route between two arbitrary points), this edge reads
 * each endpoint's declared port normal (stashed on edge.data at connection time
 * — see App.tsx onConnect) and builds an orthogonal path whose terminal
 * segments leave/arrive exactly along those normals, so the pipe reads as
 * physically continuous with the equipment nozzle.
 *
 * GEOMETRY comes from `hopSubpathsFor` (src/edges/lineHops.ts), which inserts a
 * real break wherever this run crosses a heavier one (PRD §7a item 4).
 *
 * APPEARANCE does not get decided here. `resolveLineKind`
 * (src/edges/lineKind.ts) is the single decision; this component only turns it
 * into a stroke. Before that module existed this component hardcoded
 * `strokeWidth: isSignal ? 1.25 : 2`, which is why PRD §6's line-weight
 * hierarchy tiers 2 and 5 had no representation: there was no main-vs-branch
 * distinction to draw, and no dash-dot type to draw it with.
 */
function PipeEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, data, selected, markerEnd } = props;
  const { setEdges, getNodes, getEdges } = useReactFlow();
  const d = (data ?? {}) as Partial<PipeEdgeData> & {
    sourceDirection?: { x: number; y: number };
    targetDirection?: { x: number; y: number };
    /** Port kinds captured at connection time; see resolveLineKind. */
    sourcePortKind?: string;
    targetPortKind?: string;
  };

  const nodes = getNodes() as unknown as KindNode[];
  const edges = getEdges() as unknown as Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    data?: Record<string, unknown>;
  }>;

  /**
   * Hop geometry is computed per EDGE ID on a cache keyed by the edges/nodes
   * array identities, so N pipes on a sheet cost one route build each rather
   * than N² — see hopSubpathsFor. react-flow replaces those arrays on every
   * change, which is exactly the invalidation condition needed.
   */
  const subpaths = hopSubpathsFor(
    {
      id,
      source: props.source,
      target: props.target,
      sourceHandle: props.sourceHandleId,
      targetHandle: props.targetHandleId,
      data: d as Record<string, unknown>,
    },
    edges,
    nodes as never,
  );
  const path = subpathsToPath(subpaths);

  /**
   * What this line IS — main run, branch run, signal, or battery limit.
   * Resolved from the drawing (the ports it is seated on, and whether one of
   * them is a branch fitting's branch outlet), not from a stored flag, so a
   * re-routed pipe changes weight the moment it is re-routed.
   */
  const kind = resolveLineKind(
    {
      source: props.source,
      target: props.target,
      sourceHandle: props.sourceHandleId,
      targetHandle: props.targetHandleId,
      data: d as Record<string, unknown>,
    },
    nodes,
    (k) => symbolsByKind[k]?.branchPorts,
    (edge) => {
      /**
       * The port kind comes from the SYMBOL's own declaration, resolved live —
       * not from the `sourcePortKind` / `targetPortKind` stamps taken at drag
       * time.
       *
       * This was a real bug, found by a browser gate rather than by reading the
       * code: the stamps are written when a pipe is created by dragging, so a
       * project loaded from JSON (or any pipe created before the stamps existed)
       * had no stamp at all, and its line fell back to `main`. A battery-limit
       * line therefore exported as a heavy solid run in the browser while the
       * offline exporter — which already resolved port kind from the symbol —
       * drew it as dash-dot. Two views of the same drawing disagreeing is the
       * worst outcome here, so the symbol is now the single source of truth and
       * the stamps are only a fallback for a port that cannot be resolved.
       */
      const liveKinds = [edge.sourceHandle, edge.targetHandle].map((handle, i) => {
        const nodeId = i === 0 ? edge.source : edge.target;
        const node = (nodes as Array<{ id: string; data: { kind: string; ports?: unknown } }>).find(
          (n) => n.id === nodeId,
        );
        if (!node || !handle) return undefined;
        return symbolsByKind[node.data.kind]?.ports.find((p: { id: string }) => p.id === handle)?.kind;
      });
      const live = liveKinds.find((k) => k !== undefined);
      if (live !== undefined) return live;
      // Fallback: the stamps, for any port the symbol library cannot resolve.
      if (isBoundaryPortKind(d.sourcePortKind)) return d.sourcePortKind;
      if (d.sourcePortKind === 'signal') return 'signal';
      if (isBoundaryPortKind(d.targetPortKind)) return d.targetPortKind;
      return d.targetPortKind;
    },
  );
  const stroke = strokeForLineKind(kind, LINE_DASH);

  const flat = subpaths.flat();
  const midIndex = Math.floor(flat.length / 2);
  const mid = flat[midIndex] ?? { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };

  /**
   * On a real P&ID, a piping run is labelled with its LINE NUMBER and nothing
   * else — the number already encodes size, service, area, sequence and piping
   * class (PRD §6), so repeating `lineSize` beside it duplicates information
   * and `lineName` is a description that belongs on the line list, not on the
   * drawing. The reference drawing (X-00000-000-01) labels runs exactly this
   * way.
   *
   * The descriptive name and size still matter — they are shown in the line
   * data sheet and exported in the line list — they just do not belong on the
   * canvas, where they collide with equipment and make a dense drawing
   * unreadable.
   *
   * A free line (§4.1) is the exception: it has no number by definition, so it
   * falls back to whatever description it does carry, which is the only way to
   * tell two free lines apart on screen.
   */
  const label = d.freePipe
    ? [d.lineNumber, d.lineName, d.lineSize].filter(Boolean).join(' · ')
    : d.lineNumber ?? '';

  function removeSelf(e: React.MouseEvent) {
    e.stopPropagation();
    setEdges((eds) => eds.filter((edge) => edge.id !== id));
  }

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={stroke.carriesArrow ? markerEnd : undefined}
        style={{
          stroke: selected ? SELECTED_COLOR : STROKE,
          strokeWidth: stroke.strokeWidth,
          strokeDasharray: stroke.strokeDasharray,
          fill: 'none',
        }}
        /**
         * The resolved kind is exposed on the DOM so a browser gate can assert
         * what the drawing actually drew — a stroke-width assertion alone would
         * not distinguish a boundary line from a signal line, since both are
         * drawn thin and differ only by dash pattern.
         */
        data-line-kind={kind}
      />
      <EdgeLabelRenderer>
        {label ? (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y - (selected ? 12 : 0)}px)`,
              fontSize: 9,
              fontFamily: 'monospace',
              background: '#fff',
              padding: '0 3px',
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        ) : null}
        {selected ? (
          <button
            className="pipe-delete-btn"
            title="Delete this pipe"
            aria-label="Delete pipe"
            data-testid={`pipe-delete-${id}`}
            onClick={removeSelf}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y + 12}px)`,
              pointerEvents: 'all',
            }}
          >
            ×
          </button>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(PipeEdge);

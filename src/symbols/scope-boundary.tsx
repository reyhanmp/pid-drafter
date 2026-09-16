import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, LINE_DASH, STROKE } from './style';

/**
 * Battery-limit / scope boundary (PRD §7a item 3, §6 tier 5).
 *
 * This symbol exists because a battery-limit line is not a modifier on an
 * ordinary run — it is a line OF THE DRAWING in its own right, and the
 * reference drawing uses one prominently. Before it, §7a item 3 was recorded as
 * "unimplementable as the model stands": `PipeEdgeData.lineType` was a
 * two-value union with no boundary slot and no symbol declared a boundary port.
 * Both gaps are closed here and in src/edges/lineKind.ts.
 *
 * What it draws is the thing that actually appears on a real drawing at a scope
 * boundary: the line crosses it, and the crossing is marked by a heavy
 * dash-dot bar carrying the words BATTERY LIMIT. It is an inline fitting like
 * any other — two opposed ports at its centreline — so a run entering from one
 * side leaves the other, and everything beyond it belongs to the neighbouring
 * scope.
 *
 * Both ports are declared `kind: 'boundary'`, which is what makes the pipes
 * attached to them resolve to a dash-dot stroke: the line's meaning comes from
 * the port it is physically bolted to, not from a flag someone has to remember
 * to set (see resolveLineKind in src/edges/lineKind.ts).
 *
 * The bar is drawn in the dash-dot pattern rather than a solid heavy stroke, so
 * the boundary line reads as a boundary line on the sheet instead of as a very
 * thick pipe. Weight is reserved for distinguishing main from branch runs;
 * pattern is what distinguishes a scope boundary.
 *
 * Size is written as literals, not a constant — see the note in
 * tee-branch.tsx; `verify-port-outline.cjs` reads every symbol's default size
 * out of its source with a regex, and a computed size defeats that reader.
 */
function ScopeBoundaryGeometry({ width, height }: { width: number; height: number }) {
  const cy = height / 2;
  const fontSize = 6;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* The boundary bar itself, on the centreline, spanning the full width so
          a line attached at either port continues straight through it. */}
      <line
        x1={0}
        y1={cy}
        x2={width}
        y2={cy}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
        strokeDasharray={LINE_DASH.boundary}
      />
      {/* Two short end ticks, the convention that marks a battery limit as a
          plane crossing the drawing rather than a line that merely stops. */}
      <line x1={0} y1={cy - height * 0.3} x2={0} y2={cy + height * 0.3} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line
        x1={width}
        y1={cy - height * 0.3}
        x2={width}
        y2={cy + height * 0.3}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* Label above the bar. A boundary with no words on it is unreadable —
          the dash-dot pattern alone does not say which scope it separates. */}
      <text
        x={width / 2}
        y={cy - height * 0.28}
        fontSize={fontSize}
        textAnchor="middle"
        fontFamily="monospace"
        fill={STROKE}
        data-testid="scope-boundary-label"
      >
        BATTERY LIMIT
      </text>
    </svg>
  );
}

const scopeBoundary: SymbolDefinition = {
  kind: 'scope-boundary',
  label: 'Battery Limit / Scope Boundary',
  category: 'Terminators',
  defaultWidth: 96,
  defaultHeight: 28,
  tagPrefix: 'BL',
  ports: [
    { id: 'left', label: 'Boundary (left scope)', x: 0, y: 14, direction: { x: -1, y: 0 }, kind: 'boundary' },
    { id: 'right', label: 'Boundary (right scope)', x: 96, y: 14, direction: { x: 1, y: 0 }, kind: 'boundary' },
  ],
  Geometry: ScopeBoundaryGeometry,
  dexpi: { componentClass: 'BatteryLimit' },
};

export default scopeBoundary;

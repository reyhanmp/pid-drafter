/**
 * In-progress connection preview for pipes/signal lines.
 *
 * React Flow's default preview is a BEZIER (`connectionLineType` defaults
 * to 'default'), while a dropped pipe is drawn by PipeEdge.tsx through
 * buildOrthogonalPath() — straight segments only. The two renderers
 * disagree, so dragging showed a curved gray arc that snapped into a
 * right-angled pipe on release (reported as "when I drag a new piping
 * line it shows a wrong line instead of a straight line").
 *
 * This component routes the preview through the SAME
 * buildOrthogonalPath() the finished pipe uses, so what you drag is what
 * you get:
 *  - hovering a valid target port -> an exact preview of the resulting
 *    pipe (same start normal, same arrival normal)
 *  - no target (empty space)      -> a stub out of the source port plus
 *    one right-angle elbow to the cursor, never a curve
 */
import { memo } from 'react';
import { Position, type ConnectionLineComponentProps } from '@xyflow/react';
import { buildOrthogonalPath, pointsToPath, PIPE_STUB, type RoutePoint } from './orthogonalRouting';

/** Position enum -> outward direction normal, the same mapping the
 *  symbol/handle layer uses (see symbols/handleGeometry.ts). */
function positionToDirection(position: Position): { x: number; y: number } {
  switch (position) {
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Right:
      return { x: 1, y: 0 };
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Bottom:
    default:
      return { x: 0, y: 1 };
  }
}

function dedupe(points: RoutePoint[]): RoutePoint[] {
  const out: RoutePoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

function PipeConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  toHandle,
  connectionLineStyle,
}: ConnectionLineComponentProps) {
  const start: RoutePoint = { x: fromX, y: fromY };
  const startDir = positionToDirection(fromPosition);

  let points: RoutePoint[];

  if (toHandle) {
    // Previewing a real connection: use the identical router the dropped
    // pipe will use, so the preview is an exact match.
    points = buildOrthogonalPath(start, startDir, { x: toX, y: toY }, positionToDirection(toPosition));
  } else {
    // Drag into empty space: stub out of the port along its normal, then
    // a single right-angle elbow to the cursor. Still no curves.
    const p1: RoutePoint = {
      x: start.x + startDir.x * PIPE_STUB,
      y: start.y + startDir.y * PIPE_STUB,
    };
    const end: RoutePoint = { x: toX, y: toY };
    const elbow =
      Math.abs(startDir.x) > Math.abs(startDir.y)
        ? { x: end.x, y: p1.y }
        : { x: p1.x, y: end.y };
    points = dedupe([start, p1, elbow, end]);
  }

  return (
    <g data-testid="connection-line-preview">
      <path
        className="react-flow__connection-path"
        d={pointsToPath(points)}
        fill="none"
        style={connectionLineStyle}
      />
    </g>
  );
}

export default memo(PipeConnectionLine);

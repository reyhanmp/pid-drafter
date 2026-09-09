/**
 * Orthogonal path-building utilities for the "seamless" pipe connector.
 * Given a start/end point plus their port normals, computes a right-
 * angle-only path whose terminal segments align with each port's
 * declared direction before touching the symbol boundary.
 */
import type { PortDirection } from '../symbols/types';

export interface RoutePoint {
  x: number;
  y: number;
}

const STUB = 20; // minimum straight run out of a port before turning

/**
 * Build an orthogonal (Manhattan) route from `start` (leaving along
 * `startDir`) to `end` (arriving along `endDir`, i.e. entering the port
 * from the opposite side of its normal).
 */
export function buildOrthogonalPath(
  start: RoutePoint,
  startDir: PortDirection,
  end: RoutePoint,
  endDir: PortDirection,
): RoutePoint[] {
  // First stub out from the start port along its normal.
  const p1: RoutePoint = { x: start.x + startDir.x * STUB, y: start.y + startDir.y * STUB };
  // Stub back from the end port along its normal (i.e. approach point).
  const p2: RoutePoint = { x: end.x + endDir.x * STUB, y: end.y + endDir.y * STUB };

  const points: RoutePoint[] = [start, p1];

  const startHorizontal = Math.abs(startDir.x) > Math.abs(startDir.y);
  const endHorizontal = Math.abs(endDir.x) > Math.abs(endDir.y);

  if (startHorizontal && endHorizontal) {
    // both stubs run horizontally: connect with a vertical midpoint jog
    const midX = (p1.x + p2.x) / 2;
    points.push({ x: midX, y: p1.y });
    points.push({ x: midX, y: p2.y });
  } else if (!startHorizontal && !endHorizontal) {
    // both stubs run vertically: connect with a horizontal midpoint jog
    const midY = (p1.y + p2.y) / 2;
    points.push({ x: p1.x, y: midY });
    points.push({ x: p2.x, y: midY });
  } else if (startHorizontal && !endHorizontal) {
    // start leaves horizontally, end arrives vertically -> single L corner
    points.push({ x: p2.x, y: p1.y });
  } else {
    // start leaves vertically, end arrives horizontally -> single L corner
    points.push({ x: p1.x, y: p2.y });
  }

  points.push(p2, end);

  // Drop consecutive duplicate points (can happen when stubs already align).
  const cleaned: RoutePoint[] = [];
  for (const pt of points) {
    const last = cleaned[cleaned.length - 1];
    if (!last || last.x !== pt.x || last.y !== pt.y) cleaned.push(pt);
  }
  return cleaned;
}

/** Convert a point list into an SVG path `d` attribute, straight segments only. */
export function pointsToPath(points: RoutePoint[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

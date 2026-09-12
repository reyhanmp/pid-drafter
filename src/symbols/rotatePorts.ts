/**
 * Pure helper: rotate a symbol's ports by a 90°-increment angle around
 * the shape's bounding-box CENTER, producing a NEW ports array with
 * correctly rotated positions AND direction normals.
 *
 * This mirrors a CSS `transform: rotate(Ndeg)` applied to the geometry
 * SVG with its `transform-origin` at the box center (the rendering
 * approach used in EquipmentNode.tsx) — i.e. the node's layout
 * width/height do NOT change/swap on rotation (no reflow), the content
 * simply rotates in place around the center point. A point at local
 * (x,y) in the original W×H box ends up, after rotation, at the same
 * distance from center rotated by the given angle — exactly what a CSS
 * transform does visually. Keeping port math and CSS rotation in the
 * same coordinate convention is what keeps Handles pixel-aligned with
 * the visually rotated symbol.
 *
 * Rotation convention: angle is CLOCKWISE degrees in standard screen/SVG
 * coordinates (+x right, +y down). The standard rotation matrix in this
 * coordinate system:
 *   x' = x*cos(a) - y*sin(a)
 *   y' = x*sin(a) + y*cos(a)
 * sends (1,0) -> (0,1) at a=90, i.e. "right" -> "down" for a 90°
 * clockwise rotation — matching the worked example in the task spec.
 *
 * Kept dependency-free and side-effect-free so it's unit-verifiable in
 * isolation (verified standalone via a throwaway Node script before
 * being wired into the UI).
 */
import type { SymbolPort, PortDirection } from './types';

export type RotationAngle = 0 | 90 | 180 | 270;

function rotateVector(v: PortDirection, angleDeg: number): PortDirection {
  const { cos, sin } = cosSin(angleDeg);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

function cosSin(angleDeg: number): { cos: number; sin: number } {
  const rad = (angleDeg * Math.PI) / 180;
  // Snap away floating-point noise at the exact 90°-step angles we support.
  return {
    cos: Math.round(Math.cos(rad) * 1e10) / 1e10,
    sin: Math.round(Math.sin(rad) * 1e10) / 1e10,
  };
}

/**
 * Rotate a ports array by `angle` (0/90/180/270) around the center of a
 * `width` x `height` bounding box. The box itself does NOT change size —
 * this matches a CSS `rotate()` transform on the geometry, which rotates
 * visual content in place without reflowing layout.
 */
export function rotatePorts(ports: SymbolPort[], angle: RotationAngle, width: number, height: number): SymbolPort[] {
  if (angle === 0) return ports;
  const cx = width / 2;
  const cy = height / 2;
  const { cos, sin } = cosSin(angle);

  return ports.map((port) => {
    const localX = port.x - cx;
    const localY = port.y - cy;
    const rx = localX * cos - localY * sin;
    const ry = localX * sin + localY * cos;
    const direction = rotateVector(port.direction, angle);
    return {
      ...port,
      x: cx + rx,
      y: cy + ry,
      direction,
    };
  });
}

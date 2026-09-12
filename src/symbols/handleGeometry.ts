/**
 * Canonical nozzle/handle geometry shared between the DECLARED handle
 * geometry (toReactFlowHandles.ts, read by React Flow's edge/connection
 * system) and the RENDERED <Handle> element (EquipmentNode.tsx).
 *
 * One constant, one offset function, both files — no duplicated magic
 * numbers. If the declared geometry ever disagrees with what is
 * rendered, React Flow snaps connections to a different spot than the
 * user sees, and pipe endpoints land a few pixels off the nozzle
 * (the reported bug: "pipe connection to nozzle flange is not
 * centered").
 */
import { Position } from '@xyflow/react';
import type { PortDirection } from './types';

/**
 * The <Handle> element's border-box size in px (at 1:1 zoom). The
 * element uses `border: 1px` + `box-sizing: border-box` (global CSS),
 * so offsetWidth/offsetHeight — what React Flow reads via getDimensions
 * when it re-measures from the DOM — equal exactly this value.
 */
export const HANDLE_SIZE = 8;

/** Map a port's outward direction normal to React Flow's Position enum. */
export function directionToPosition(dir: PortDirection): Position {
  if (Math.abs(dir.x) > Math.abs(dir.y)) {
    return dir.x < 0 ? Position.Left : Position.Right;
  }
  return dir.y < 0 ? Position.Top : Position.Bottom;
}

/**
 * Offset of the rendered <Handle> element's LEFT/TOP (node-local px)
 * that makes React Flow's Position-based edge anchor land EXACTLY on
 * the declared port point.
 *
 * React Flow does NOT anchor an edge at the handle's center — it
 * anchors at the handle's OUTER edge along the Position axis
 * (see @xyflow/system `getHandlePosition`):
 *   Position.Bottom -> { x: x + width/2, y: y + height }
 *   Position.Top    -> { x: x + width/2, y: y }            (y = top)
 *   Position.Left   -> { x: x,           y: y + height/2 }
 *   Position.Right  -> { x: x + width,   y: y + height/2 }
 * where (x,y) is the handle's top-left corner. Requiring the anchor to
 * equal the port point P therefore implies:
 *   bottom: x = P.x - w/2, y = P.y - h
 *   top:    x = P.x - w/2, y = P.y
 *   left:   x = P.x,       y = P.y - h/2
 *   right:  x = P.x - w,   y = P.y - h/2
 * (this is exactly what the modifier classes `.react-flow__handle-bottom`
 * etc. would do on a static node — `transform: translate(-50%, 50%)`
 * for bottom, etc. — but we also need the same numbers DECLARED, so
 * they are computed here once and used by both the declaration and the
 * rendered element.)
 */
export function handleOffset(
  position: Position,
  portX: number,
  portY: number,
  size: number = HANDLE_SIZE,
): { left: number; top: number } {
  switch (position) {
    case Position.Bottom:
      return { left: portX - size / 2, top: portY - size };
    case Position.Top:
      return { left: portX - size / 2, top: portY };
    case Position.Left:
      return { left: portX, top: portY - size / 2 };
    case Position.Right:
    default:
      return { left: portX - size, top: portY - size / 2 };
  }
}

/**
 * `handleOffset`, re-expressed RELATIVE to a container that is itself
 * already positioned at the port point (the per-port wrapper div in
 * EquipmentNode.tsx, which sits at `left: port.x, top: port.y`).
 *
 * Use `handleOffset` for React Flow's DECLARED `node.handles` geometry —
 * those coordinates are node-local absolute, measured from the node's
 * own top-left. Use THIS for the rendered <Handle>, whose containing
 * block is the port wrapper, not the node.
 *
 * Getting this wrong is a silent 2x position error: the handle lands at
 * `2 * port` (e.g. a port at (45,180) renders its handle at (86,352)),
 * so React Flow anchors the pipe far from the visible nozzle while the
 * flange glyph stays perfectly centred — a confusing, half-correct
 * failure that a flange-only check will not catch.
 */
export function handleOffsetFromPort(
  position: Position,
  portX: number,
  portY: number,
  size: number = HANDLE_SIZE,
): { left: number; top: number } {
  const abs = handleOffset(position, portX, portY, size);
  return { left: abs.left - portX, top: abs.top - portY };
}

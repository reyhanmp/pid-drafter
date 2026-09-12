/**
 * Converts our domain SymbolPort[] (center x/y + direction normal) into
 * React Flow's own `NodeHandle[]` format (top-left x/y + Position enum),
 * so we can declare a node's handle geometry directly via `node.handles`
 * instead of relying on React Flow measuring rendered <Handle> DOM
 * elements.
 *
 * Why this matters: React Flow only re-measures handle bounds from the
 * DOM on mount or on an explicit `updateNodeInternals()` call, and that
 * call races against React Flow's own internal node-adoption pass -
 * which can silently reset a node's handle bounds to a stale snapshot
 * right after we update it (e.g. when a nozzle is added). Declaring
 * `node.handles` sidesteps DOM measurement (and that whole race)
 * entirely: React Flow reads handle geometry straight from data we
 * control, so it's always in sync with what we just set, no
 * measurement step and no timing window at all.
 *
 * CRITICAL: the declared geometry must be pixel-identical to the
 * rendered <Handle> element (same size, same offset) or connections
 * snap to the wrong spot. Both sides therefore take their numbers from
 * `handleGeometry.ts` — see `handleOffset()` there for the
 * Position-based anchoring math this must match. React Flow re-measures
 * from the DOM later anyway (ResizeObserver -> updateNodeInternals) and
 * the rendered element is positioned with the very same offset, so the
 * declared and measured values converge instead of fighting.
 */
import type { Position } from '@xyflow/react';
import { HANDLE_SIZE, directionToPosition, handleOffset } from './handleGeometry';
import type { SymbolPort } from './types';

export interface ReactFlowNodeHandle {
  id: string;
  x: number;
  y: number;
  position: Position;
  type: 'source';
  width: number;
  height: number;
}

export { directionToPosition };

export function toReactFlowHandles(ports: SymbolPort[]): ReactFlowNodeHandle[] {
  return ports.map((port) => {
    const position = directionToPosition(port.direction);
    const { left, top } = handleOffset(position, port.x, port.y, HANDLE_SIZE);
    return {
      id: port.id,
      x: left,
      y: top,
      position,
      type: 'source',
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
    };
  });
}

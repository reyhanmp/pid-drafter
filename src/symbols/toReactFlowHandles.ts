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
 */
import type { Position } from '@xyflow/react';
import type { PortDirection, SymbolPort } from './types';

const HANDLE_SIZE = 8; // matches the visual <Handle> box size in EquipmentNode.tsx

export function directionToPosition(dir: PortDirection): Position {
  if (Math.abs(dir.x) > Math.abs(dir.y)) {
    return (dir.x < 0 ? 'left' : 'right') as Position;
  }
  return (dir.y < 0 ? 'top' : 'bottom') as Position;
}

export interface ReactFlowNodeHandle {
  id: string;
  x: number;
  y: number;
  position: Position;
  type: 'source';
  width: number;
  height: number;
}

export function toReactFlowHandles(ports: SymbolPort[]): ReactFlowNodeHandle[] {
  return ports.map((port) => ({
    id: port.id,
    // React Flow's own DOM measurement records the handle's top-left
    // corner (post-transform); our port.x/y are the *center* point (the
    // <Handle> div is centered on it via `transform: translate(-50%,-50%)`),
    // so convert center -> top-left the same way here.
    x: port.x - HANDLE_SIZE / 2,
    y: port.y - HANDLE_SIZE / 2,
    position: directionToPosition(port.direction),
    type: 'source',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
  }));
}

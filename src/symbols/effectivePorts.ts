/**
 * Resolves the ports that actually apply to a given node INSTANCE,
 * BEFORE rotation. Ports are declared per symbol TYPE
 * (`symbolsByKind[kind].ports`) as a default, but a node instance may
 * carry its own `data.ports` override (added/removed/repositioned
 * nozzles specific to that one piece of equipment).
 *
 * IMPORTANT: this returns ports in the symbol's UNROTATED local frame —
 * this is also the frame the DataSheetPanel nozzle editor reads/writes
 * (so numeric x/y/direction edits stay meaningful regardless of the
 * node's current rotation). For ports as actually rendered/connected on
 * a (possibly rotated) node, use `getRenderedPorts` below, which applies
 * the node's `rotation` on top of this.
 *
 * Every consumer that needs "what ports does this node actually have,
 * unrotated" — the nozzle editor, and the base data `getRenderedPorts`
 * builds on — goes through this single helper so they never disagree.
 */
import { symbolsByKind } from './index';
import type { SymbolPort } from './types';
import { rotatePorts, type RotationAngle } from './rotatePorts';

export function getEffectivePorts(kind: string, instancePorts?: SymbolPort[]): SymbolPort[] {
  if (instancePorts) return instancePorts;
  return symbolsByKind[kind]?.ports ?? [];
}

/** Clamp/round any stored rotation value down to a valid 90°-step angle. */
export function normalizeRotation(rotation?: number): RotationAngle {
  const r = ((rotation ?? 0) % 360 + 360) % 360;
  if (r === 90 || r === 180 || r === 270) return r;
  return 0;
}

/**
 * Ports as they actually appear/behave on the canvas RIGHT NOW: base
 * effective ports (instance override or symbol default), rotated by the
 * node's stored `rotation` around the symbol's bounding-box center.
 * This is what must feed `toReactFlowHandles()`, the rendered Handle
 * positions in EquipmentNode, connection-time port lookup in App's
 * onConnect, and validation — anywhere pipes/handles/geometry need to
 * agree on where a port physically is right now.
 */
export function getRenderedPorts(
  kind: string,
  instancePorts: SymbolPort[] | undefined,
  rotation: number | undefined,
  width: number,
  height: number,
): SymbolPort[] {
  const base = getEffectivePorts(kind, instancePorts);
  const angle = normalizeRotation(rotation);
  if (angle === 0) return base;
  return rotatePorts(base, angle, width, height);
}

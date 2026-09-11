/**
 * Resolves the ports that actually apply to a given node INSTANCE.
 *
 * Ports are declared per symbol TYPE (`symbolsByKind[kind].ports`) as a
 * default, but a node instance may carry its own `data.ports` override
 * (added/removed/repositioned nozzles specific to that one piece of
 * equipment). Every consumer that needs "what ports does this node
 * actually have right now" — rendering (EquipmentNode), validation
 * (validateDiagram), and connection handling (App onConnect) — must go
 * through this single helper so they never disagree about which ports
 * are live.
 */
import { symbolsByKind } from './index';
import type { SymbolPort } from './types';

export function getEffectivePorts(kind: string, instancePorts?: SymbolPort[]): SymbolPort[] {
  if (instancePorts) return instancePorts;
  return symbolsByKind[kind]?.ports ?? [];
}

/**
 * Instrument loop cross-referencing (PRD §4.7).
 *
 * Loop membership is inferred purely from tag text — no separate
 * manually-maintained loop-membership list to keep in sync. Given a tag
 * like "TT-101", "TIC-101A", "PSV-101", the trailing numeric run
 * (optionally followed by a single letter suffix, e.g. "101A" for a
 * split-range/duplicate instrument) is the loop number: "101" in all
 * three examples above.
 */
import { symbolsByKind } from '../symbols';
import type { EquipmentNodeData } from '../types/diagram';

export interface LoopNode {
  id: string;
  data: EquipmentNodeData;
}

/** Categories eligible for loop cross-referencing — real field/DCS instruments and signal/logic functions, not general equipment. */
const LOOP_ELIGIBLE_CATEGORIES = new Set(['Instruments', 'Signal & Logic']);

/**
 * Extract the loop number from a tag, e.g. "TT-101" -> "101",
 * "TIC-101A" -> "101", "PSV-205" -> "205". Returns null if no trailing
 * numeric run is found (e.g. an empty or malformed tag).
 */
export function parseLoopNumber(tag: string | undefined): string | null {
  if (!tag) return null;
  const match = tag.trim().match(/(\d+)[A-Za-z]?$/);
  return match ? match[1] : null;
}

/** Whether a node's symbol category participates in loop cross-referencing at all. */
export function isLoopEligible(node: LoopNode): boolean {
  const symbol = symbolsByKind[node.data.kind];
  return !!symbol && LOOP_ELIGIBLE_CATEGORIES.has(symbol.category);
}

/**
 * Given the currently active (hovered or selected) node id, return the
 * ids of every OTHER loop-eligible node sharing the same loop number —
 * i.e. the rest of that instrument's control loop, wherever it sits on
 * the diagram. Returns an empty set if the active node isn't loop-
 * eligible or has no parseable loop number.
 */
export function getLoopMateIds(nodes: LoopNode[], activeNodeId: string | null): Set<string> {
  const mates = new Set<string>();
  if (!activeNodeId) return mates;
  const active = nodes.find((n) => n.id === activeNodeId);
  if (!active || !isLoopEligible(active)) return mates;
  const loopNumber = parseLoopNumber(active.data.tag);
  if (!loopNumber) return mates;

  for (const n of nodes) {
    if (n.id === activeNodeId) continue;
    if (!isLoopEligible(n)) continue;
    if (parseLoopNumber(n.data.tag) === loopNumber) mates.add(n.id);
  }
  return mates;
}

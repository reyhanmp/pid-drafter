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

/** One drawing sheet's worth of loop-eligible nodes, for cross-sheet lookup. */
export interface SheetLoopSlice {
  id: string;
  name: string;
  nodes: LoopNode[];
}

export interface ProjectLoopHighlight {
  /** Ids of loop mates on the SAME sheet as the active node (highlighted inline). */
  onSheetMateIds: Set<string>;
  /** How many loop mates live on OTHER sheets (PRD §4.7/§4.8 cross-sheet awareness). */
  offSheetMateCount: number;
  /** Names of the other sheets those off-sheet loop mates sit on. */
  offSheetSheetNames: string[];
}

/**
 * Project-wide loop cross-referencing (PRD §4.7 extended by §4.8): loop
 * membership spans sheets, since a transmitter on sheet 1 and its
 * controller on sheet 2 are the same control loop. Returns the on-sheet
 * mates for direct highlighting plus a real count/name list for the
 * off-sheet ones, so the hovered node can show genuine cross-sheet
 * awareness even though those nodes are not on the visible canvas.
 */
export function getProjectLoopMates(
  sheets: SheetLoopSlice[],
  activeSheetId: string | null,
  activeNodeId: string | null,
): ProjectLoopHighlight {
  const result: ProjectLoopHighlight = { onSheetMateIds: new Set(), offSheetMateCount: 0, offSheetSheetNames: [] };
  if (!activeNodeId) return result;

  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const active = activeSheet?.nodes.find((n) => n.id === activeNodeId);
  if (!active || !isLoopEligible(active)) return result;
  const loopNumber = parseLoopNumber(active.data.tag);
  if (!loopNumber) return result;

  const offSheetNames: string[] = [];
  for (const sheet of sheets) {
    for (const n of sheet.nodes) {
      if (sheet.id === activeSheetId && n.id === activeNodeId) continue;
      if (!isLoopEligible(n)) continue;
      if (parseLoopNumber(n.data.tag) !== loopNumber) continue;
      if (sheet.id === activeSheetId) {
        result.onSheetMateIds.add(n.id);
      } else {
        result.offSheetMateCount += 1;
        if (!offSheetNames.includes(sheet.name)) offSheetNames.push(sheet.name);
      }
    }
  }
  result.offSheetSheetNames = offSheetNames;
  return result;
}


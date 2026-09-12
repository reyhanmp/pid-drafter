/**
 * Project data model — a project is an ORDERED LIST OF SHEETS (drawing
 * sheets/pages), each carrying its own nodes (equipment/instruments) and
 * edges (pipes/signal lines).
 *
 * IMPORTANT: "sheet" here means DRAWING SHEET / PAGE (PRD §4.8), which is
 * a completely different concept from an equipment/instrument "data
 * sheet" (the per-node property panel in src/components/DataSheetPanel).
 * Do not conflate the two.
 *
 * The serialized envelope is versioned (see src/project/serialize.ts) so a
 * future format change can migrate rather than fail.
 */
import type { Edge, Node } from '@xyflow/react';

/** Envelope marker written into saved JSON files, for self-identification. */
export const PROJECT_SCHEMA_ID = 'pid-drafter/project';

/** Current project JSON format version. Bump on any breaking format change. */
export const PROJECT_VERSION = 2;

/** One drawing sheet: an independent canvas of equipment and pipes. */
export interface ProjectSheet {
  id: string;
  /** Display name shown on the sheet tab, e.g. "Saponification". */
  name: string;
  /** 0-based position in the sheet order. Kept explicit so JSON round-trips are stable. */
  order: number;
  nodes: Node[];
  edges: Edge[];
}

/** The whole multi-sheet project. */
export interface Project {
  version: number;
  projectName: string;
  sheets: ProjectSheet[];
}

/** Default name for a freshly created sheet at index `n` (0-based). */
export function defaultSheetName(n: number): string {
  return `Sheet ${n + 1}`;
}

let sheetSeq = 0;
/** Stable, collision-resistant sheet id (does not depend on Date.now() alone). */
export function newSheetId(): string {
  sheetSeq += 1;
  return `sheet-${Date.now().toString(36)}-${sheetSeq}`;
}

/** A brand-new project with exactly one empty sheet. */
export function createEmptyProject(): Project {
  return {
    version: PROJECT_VERSION,
    projectName: 'Untitled P&ID Project',
    sheets: [{ id: newSheetId(), name: defaultSheetName(0), order: 0, nodes: [], edges: [] }],
  };
}

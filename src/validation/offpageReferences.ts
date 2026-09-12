/**
 * Off-page / tie-in connector target resolution (PRD §4.8).
 *
 * Pure functions over plain data — no react-flow imports — so the
 * resolved-label logic and the broken-reference validity rule are shared
 * between the node renderer, the validity engine, and (later) exports.
 *
 * Vocabulary note: "sheet" here is a DRAWING sheet (a page of the P&ID),
 * never an equipment/instrument "data sheet".
 */
import type { EquipmentNodeData } from '../types/diagram';

/** A drawing sheet as seen by the resolver — just enough to resolve a target. */
export interface SheetRef {
  id: string;
  name: string;
  /** 0-based position; used for the "SH.1" style prefix in labels. */
  order: number;
  nodes: Array<{ id: string; data: EquipmentNodeData }>;
}

export const OFFPAGE_KIND = 'offpage-connector';

export type OffpageRefStatus = 'none' | 'incomplete' | 'resolved' | 'broken';

export interface OffpageRef {
  status: OffpageRefStatus;
  /** Resolved display label, e.g. "TO SH.2 TT-101". Empty when status is 'none'. */
  label: string;
  /** Target sheet, when the chosen sheet id exists. */
  sheet?: SheetRef;
  /** Target sheet's display name, when known. */
  sheetName?: string;
  /** Compact sheet designator shown in labels, e.g. "SH.2". */
  sheetDesignator?: string;
  /** Human-readable problem description when status is 'broken'. */
  problem?: string;
}

/** Sheet designator used in connector labels, e.g. order 1 -> "SH.2". */
export function sheetDesignator(sheet: { order: number }): string {
  return `SH.${sheet.order + 1}`;
}

/** Whether a node is an off-page/tie-in connector. */
export function isOffpageConnector(data: EquipmentNodeData | undefined): boolean {
  return data?.kind === OFFPAGE_KIND;
}

/**
 * Resolve an off-page connector's declared target against the project's
 * sheets. A connector with no target chosen at all resolves to 'none'
 * (plain "REF" glyph, no error — the user simply hasn't filled it in yet).
 * A connector with a target chosen that can no longer be resolved is
 * 'broken' and must surface as a hard validation error.
 */
export function resolveOffpageRef(data: EquipmentNodeData, sheets: SheetRef[]): OffpageRef {
  const sheetId = data.offpageTargetSheetId?.trim();
  const tag = data.offpageTargetTag?.trim();
  if (!sheetId) return { status: 'none', label: '' };

  const sheet = sheets.find((s) => s.id === sheetId);
  if (!sheet) {
    return { status: 'broken', label: '', problem: 'target sheet no longer exists' };
  }
  const designator = sheetDesignator(sheet);

  if (!tag) {
    // Sheet-only target is legal per spec ("TO SHEET 2" when only a sheet is chosen).
    return {
      status: 'incomplete',
      label: `TO ${designator}`,
      sheet,
      sheetName: sheet.name,
      sheetDesignator: designator,
    };
  }

  const found = sheet.nodes.some((n) => (n.data.tag ?? '').trim() === tag);
  if (!found) {
    return {
      status: 'broken',
      label: '',
      sheet,
      sheetName: sheet.name,
      sheetDesignator: designator,
      problem: `tag "${tag}" not found on ${designator}`,
    };
  }

  return {
    status: 'resolved',
    label: `TO ${designator} ${tag}`,
    sheet,
    sheetName: sheet.name,
    sheetDesignator: designator,
  };
}

/** Label shown on a connector glyph: the resolved ref, or a neutral placeholder. */
export function offpageDisplayLabel(data: EquipmentNodeData, sheets: SheetRef[]): string {
  const ref = resolveOffpageRef(data, sheets);
  if (ref.status === 'resolved' || ref.status === 'incomplete') return ref.label;
  if (ref.status === 'broken') return 'BROKEN REF';
  return 'REF';
}

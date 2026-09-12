/**
 * Shared node/edge data types for the diagram. Kept independent of
 * react-flow's own Node/Edge generics so the validity engine can operate
 * on plain data (see src/validation/).
 */
import type { SymbolPort } from '../symbols/types';

export interface EquipmentNodeData {
  /** Symbol registry key, e.g. "vessel-vertical". */
  kind: string;
  /** Equipment/instrument tag, e.g. "V-101", "TT-204". Must be unique. */
  tag: string;
  /** Loop number shown beside instrument bubbles, e.g. "204". Optional. */
  loopNumber?: string;
  width: number;
  height: number;
  /**
   * Per-instance port/nozzle override. When present, this list is used
   * instead of the symbol type's default `ports` for rendering Handles,
   * validation, and connection lookups — letting a single instance add,
   * remove, or reposition nozzles without affecting the symbol type or
   * any other instance. When absent, `symbolsByKind[kind].ports` is used
   * (see `getEffectivePorts` helper). Seeded from the symbol default the
   * first time a node's ports are edited.
   */
  ports?: SymbolPort[];
  /**
   * 90°-increment rotation applied to the symbol's rendered geometry AND
   * its effective ports (position + direction normal), in clockwise
   * degrees: 0 | 90 | 180 | 270. Absent/undefined means 0 (unrotated).
   * See src/symbols/rotatePorts.ts for the rotation math and
   * src/symbols/effectivePorts.ts for where it's applied.
   */
  rotation?: 0 | 90 | 180 | 270;
  /**
   * Free-form data-sheet fields, keyed by field id (e.g. "designPressure",
   * "npshAvailable"). Field sets differ per equipment category — see
   * src/dataSheet/fieldSchemas.ts for the per-category field definitions.
   * A bag rather than named properties keeps this type stable as field
   * schemas evolve per category.
   */
  properties?: Record<string, string>;
  /**
   * Transient, App-computed flag (PRD §4.7 instrument loop cross-
   * referencing) — true when this node is the currently hovered/selected
   * instrument OR shares its loop number with one. Not persisted;
   * recomputed every render from tag text, stashed on node.data purely
   * so EquipmentNode can render a highlight ring without a separate
   * prop-drilling path (same pattern as `__updateNodeData`).
   */
  __loopHighlight?: boolean;
  [key: string]: unknown;
}

/** Plain-data view of a port used by the connector + validity engine. */
export interface ResolvedPort extends SymbolPort {
  nodeId: string;
}

/** A pipe/signal-line connection between two declared ports. */
export interface PipeEdgeData {
  /** 'process' (solid) or 'signal' (dashed) — mirrors ISA line convention. */
  lineType: 'process' | 'signal';
  /** Line number label shown along the pipe, optional in this phase. */
  lineNumber?: string;
  /** Free-text descriptive name, e.g. "Feed to Reactor". */
  lineName?: string;
  /** Nominal pipe size, e.g. '2"'. */
  lineSize?: string;
  /** Whether the line is jacketed/traced. */
  jacketed?: boolean;
  /** ASME/ANSI-style material of construction + pressure class. */
  materialOfConstruction?: string;
  [key: string]: unknown;
}

/** Standard nominal pipe sizes offered in the line data sheet. */
export const LINE_SIZE_OPTIONS = [
  '1/2"',
  '3/4"',
  '1"',
  '1.5"',
  '2"',
  '3"',
  '4"',
  '6"',
  '8"',
  '10"',
  '12"',
];

/** Real ASME/ANSI-style material-of-construction + pressure class options. */
export const MATERIAL_OF_CONSTRUCTION_OPTIONS = [
  'Carbon Steel - ASME B16.5 Class 150',
  'Carbon Steel - ASME B16.5 Class 300',
  'Carbon Steel - ASME B16.5 Class 600',
  'Stainless Steel 304 - ASME B16.5 Class 150',
  'Stainless Steel 304 - ASME B16.5 Class 300',
  'Stainless Steel 316 - ASME B16.5 Class 150',
  'Stainless Steel 316 - ASME B16.5 Class 300',
  'Stainless Steel 316L - ASME B16.5 Class 150',
  'Duplex Stainless Steel 2205',
  'Chrome-Moly Alloy Steel (P11/P22)',
  'PVC (Schedule 80)',
  'CPVC',
  'PTFE-Lined Carbon Steel',
  'Copper',
  'HDPE',
];

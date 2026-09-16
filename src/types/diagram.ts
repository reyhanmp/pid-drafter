/**
 * Shared node/edge data types for the diagram. Kept independent of
 * react-flow's own Node/Edge generics so the validity engine can operate
 * on plain data (see src/validation/).
 */
import type { SymbolPort } from '../symbols/types';
import type { LineType } from '../edges/lineKind';

export type { LineType };

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
  /**
   * Off-page / tie-in connector target (PRD §4.8) — only meaningful on
   * nodes whose `kind` is 'offpage-connector'. `offpageTargetSheetId` is a
   * ProjectSheet.id (a DRAWING sheet, not a data sheet); `offpageTargetTag`
   * is the equipment/instrument tag that connector ties into on that sheet.
   * A connector with both set and resolvable renders "TO SH.2 TT-101"; a
   * connector whose target sheet/tag no longer exists is a hard validation
   * error (see src/validation/offpageReferences.ts).
   */
  offpageTargetSheetId?: string;
  offpageTargetTag?: string;
  /**
   * Transient, App-computed flag (PRD §4.7 cross-sheet instrument loop
   * cross-referencing) — the number of loop mates for this hovered node
   * that live on a DIFFERENT sheet. Not persisted.
   */
  __offshetLoopMateCount?: number;
  /**
   * Transient, App-computed list of the other sheets where this hovered
   * node's loop mates live, e.g. ["Sheet 2"]. Not persisted.
   */
  __offshetLoopSheetNames?: string[];
  /**
   * Transient, App-computed resolved reference label for an off-page
   * connector, e.g. "TO SH.2 TT-101". Not persisted (see
   * serialize.ts's sanitizeNodeData).
   */
  __resolvedLabel?: string;
  __loopHighlight?: boolean;
  /**
   * Transient, canvas-computed count of pipes currently attached to each of
   * this node's ports, keyed by port id (PRD §7a items 1+2). Not persisted.
   * Computed in App from the sheet's own edges so the render path never has to
   * reach for edge state, and so EquipmentNode can show a spent nozzle as
   * spent before the user attempts the connection.
   */
  __occupiedPorts?: Record<string, number>;
  [key: string]: unknown;
}

/** Plain-data view of a port used by the connector + validity engine. */
export interface ResolvedPort extends SymbolPort {
  nodeId: string;
}

/** A pipe/signal-line connection between two declared ports. */
export interface PipeEdgeData {
  /**
   * What the user declared this line to be. See src/edges/lineKind.ts for the
   * decision that turns this into an actual stroke — and for why `main` vs
   * `branch` is deliberately NOT in here.
   *
   *   'process'  — piping (solid)
   *   'signal'   — instrument/pneumatic signal (thin dashed)
   *   'boundary' — battery-limit / scope boundary (thin dash-dot)
   *
   * Importing the type from lineKind.ts rather than re-declaring it keeps a
   * second union from existing that could accept a value the decision module
   * cannot interpret.
   */
  lineType: LineType;
  /**
   * FREE LINE (explicit user decision) — a line drawn by releasing the
   * drag in empty space, attached to no nozzle at either end.
   *
   * Deliberately an EXPLICIT flag rather than "inferred from a missing
   * handle", so the distinction is unambiguous, survives JSON round-trip,
   * and the validity engine can exempt these lines with one early return
   * (see validation/validateDiagram.ts). A free line is a deliberate
   * carve-out from PRD §4.1's "every pipe is seated on a declared port"
   * rule: without this flag the engine raises 'unconnected-pipe'.
   *
   * When true, `freeStart`/`freeEnd` carry the geometry (flow coordinates)
   * and the edge is NOT handed to <ReactFlow> — react-flow requires both
   * endpoints to be node handles, so free lines render through an overlay
   * instead (see components/FreeLineLayer.tsx).
   */
  freePipe?: boolean;
  /** Start point of a free line, in flow coordinates. */
  freeStart?: { x: number; y: number };
  /** End point of a free line, in flow coordinates. */
  freeEnd?: { x: number; y: number };
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
  '14"',
  '16"',
  '18"',
  '20"',
  '24"',
];

/**
 * Nominal nozzle sizes (PRD §4.9.3), imperial first because the reference
 * drawing (X-00000-000-01) dimensions nozzles in inches (`ø1 1/2"`), with the
 * DN equivalents a metric project would use.
 */
export const NOZZLE_SIZE_OPTIONS = [
  '1/2"', '3/4"', '1"', '1 1/2"', '2"', '3"', '4"', '6"', '8"', '10"', '12"',
  '16"', '20"', '24"',
  'DN15', 'DN20', 'DN25', 'DN40', 'DN50', 'DN80', 'DN100', 'DN150', 'DN200',
  'DN250', 'DN300', 'DN400', 'DN500', 'DN600',
];

/**
 * Flange ratings (PRD §4.9.3). ASME class numbers and the PN series, since a
 * project uses one system or the other and the tool should not force a choice.
 */
export const NOZZLE_RATING_OPTIONS = [
  '150#', '300#', '600#', '900#', '1500#', '2500#',
  'PN10', 'PN16', 'PN25', 'PN40', 'PN64', 'PN100',
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

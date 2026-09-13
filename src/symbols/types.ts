/**
 * Symbol module contract.
 *
 * Every piece of process equipment / instrumentation in the palette is
 * defined by ONE module in this directory. A symbol module exports:
 *   - SVG geometry (a React component that draws the symbol at 0,0
 *     inside a `width x height` viewBox)
 *   - a list of NAMED connection ports, each with a position AND a
 *     direction/normal vector — the normal is what lets the connector
 *     system (see src/edges/) approach the port "straight on" instead
 *     of at an arbitrary angle
 *   - a category (drives the right-hand palette grouping)
 *   - a default width/height
 *   - an optional DEXPI class-mapping stub (unused this phase, reserved
 *     for a later DEXPI export phase)
 *
 * See README.md "Adding a new symbol" for the step-by-step guide.
 */
import type { ComponentType } from 'react';

/** Unit direction a port faces, e.g. {x:0,y:-1} = points up/out the top. */
export interface PortDirection {
  x: number;
  y: number;
}

/** A single named connection point on a symbol's boundary. */
export interface SymbolPort {
  /** Unique within the symbol, e.g. "top", "bottom", "inlet", "outlet". */
  id: string;
  /** Human label shown in tooltips, e.g. "Process Inlet". */
  label: string;
  /** Position relative to the symbol's bounding box, in local units (0..width, 0..height). */
  x: number;
  y: number;
  /** Outward-facing unit normal — direction a pipe must approach/leave from. */
  direction: PortDirection;
  /** What may connect here — used by the validity engine. 'process' | 'signal' */
  kind: 'process' | 'signal';
  /**
   * Nozzle size, e.g. `2"` or `DN50` (PRD §4.9.3).
   *
   * A nozzle size is not the same as the line size: a reducer at the vessel
   * wall means a 4" line can leave a 2" nozzle, and the nozzle is what the
   * vessel designer sizes the reinforcement pad for. Real drawings therefore
   * put the size on the nozzle (`ø1 1/2" ANSI 150#`) and the piping spec on the
   * line, which is why this lives on the port and not on the edge.
   *
   * Optional: an unspecified nozzle is a normal state of a drawing in
   * progress, and nothing downstream fails when it is blank.
   */
  size?: string;
  /** Nozzle flange rating, e.g. `150#`, `300#`, `PN16` (PRD §4.9.3). */
  rating?: string;
}

export type SymbolCategory =
  | 'Vessels'
  | 'Columns'
  | 'Reactors'
  | 'Pumps'
  | 'Valves'
  | 'Instruments'
  | 'Agitators'
  | 'Heat Exchangers'
  | 'Piping Accessories'
  | 'Signal & Logic'
  | 'Terminators';

/** Props passed to a symbol's geometry component. */
export interface SymbolGeometryProps {
  width: number;
  height: number;
  /** Selected/hover styling hook, optional. */
  selected?: boolean;
  /**
   * Resolved display label, when the symbol has one that is computed from
   * project data rather than fixed geometry — used by the off-page/tie-in
   * connector to draw its resolved target (e.g. "TO SH.2 TT-101") in place
   * of its neutral placeholder (PRD §4.8).
   */
  label?: string;
}

export interface DexpiMapping {
  /** Stub for a later phase — DEXPI ComponentClass name. */
  componentClass?: string;
  /** Stub for a later phase — RDL/reference-data URI. */
  rdlUri?: string;
}

export interface SymbolDefinition {
  /** Unique key, e.g. "vessel-vertical". Used as the react-flow node "kind". */
  kind: string;
  /** Display name shown in the palette, e.g. "Vertical Vessel". */
  label: string;
  category: SymbolCategory;
  /** Default bounding box in px at 1:1 canvas zoom. */
  defaultWidth: number;
  defaultHeight: number;
  /** Declared connection ports (process piping and/or signal lines). */
  ports: SymbolPort[];
  /**
   * Port ids on this symbol that may carry MORE THAN ONE pipe (PRD §7a items
   * 1+2). Empty/absent for every symbol whose ports are single-connection,
   * which is all of them except the tee: a nozzle is a hole in a vessel wall
   * and two pipes cannot bolt to one flange, but a header port on a branch
   * fitting is the definition of a point where a line becomes two.
   *
   * Enforced in src/validation/connectionRules.ts — both when a connection is
   * attempted on the canvas and when existing data is checked.
   */
  multiBranchPorts?: string[];
  /** SVG geometry renderer. */
  Geometry: ComponentType<SymbolGeometryProps>;
  /** Prefix used to seed the tag field when a new instance is dropped, e.g. "V". */
  tagPrefix: string;
  /** Reserved for a later DEXPI export phase. */
  dexpi?: DexpiMapping;
}

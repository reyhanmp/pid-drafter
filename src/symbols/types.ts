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
}

export type SymbolCategory =
  | 'Vessels'
  | 'Pumps'
  | 'Valves'
  | 'Instruments'
  | 'Agitators'
  | 'Heat Exchangers';

/** Props passed to a symbol's geometry component. */
export interface SymbolGeometryProps {
  width: number;
  height: number;
  /** Selected/hover styling hook, optional. */
  selected?: boolean;
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
  /** SVG geometry renderer. */
  Geometry: ComponentType<SymbolGeometryProps>;
  /** Prefix used to seed the tag field when a new instance is dropped, e.g. "V". */
  tagPrefix: string;
  /** Reserved for a later DEXPI export phase. */
  dexpi?: DexpiMapping;
}

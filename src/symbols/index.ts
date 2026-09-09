/**
 * Single source of truth for all symbols. To add a new symbol:
 *   1. Create src/symbols/<your-symbol>.tsx following the pattern of any
 *      existing module (export a default `SymbolDefinition`).
 *   2. Import it below and add it to `allSymbols`.
 * That's it — the palette (grouped by category) and the node registry
 * are both derived from this file automatically.
 */
import type { SymbolCategory, SymbolDefinition } from './types';

import vesselVertical from './vessel-vertical';
import vesselHorizontal from './vessel-horizontal';
import pumpCentrifugal from './pump-centrifugal';
import valveGate from './valve-gate';
import valveControl from './valve-control';
import instrumentCircle from './instrument-circle';
import instrumentSquare from './instrument-square';
import agitator from './agitator';
import heatExchanger from './heat-exchanger';

export const allSymbols: SymbolDefinition[] = [
  vesselVertical,
  vesselHorizontal,
  pumpCentrifugal,
  valveGate,
  valveControl,
  instrumentCircle,
  instrumentSquare,
  agitator,
  heatExchanger,
];

/** Lookup table keyed by symbol kind (used by node renderers). */
export const symbolsByKind: Record<string, SymbolDefinition> = Object.fromEntries(
  allSymbols.map((s) => [s.kind, s]),
);

/** Declared display order for categories in the palette. */
export const CATEGORY_ORDER: SymbolCategory[] = [
  'Vessels',
  'Pumps',
  'Valves',
  'Instruments',
  'Agitators',
  'Heat Exchangers',
];

/** Symbols grouped by category, in declared category order — drives the palette. */
export function symbolsByCategory(): Array<{ category: SymbolCategory; symbols: SymbolDefinition[] }> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    symbols: allSymbols.filter((s) => s.category === category),
  })).filter((g) => g.symbols.length > 0);
}

export type { SymbolDefinition, SymbolPort, PortDirection, SymbolCategory } from './types';

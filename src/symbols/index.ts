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
import storageTankConeRoof from './storage-tank-cone-roof';
import storageTankFloatingRoof from './storage-tank-floating-roof';
import knockoutDrum from './knockout-drum';
import separator3Phase from './separator-3phase';
import silo from './silo';
import pumpCentrifugal from './pump-centrifugal';
import pumpGear from './pump-gear';
import pumpDiaphragm from './pump-diaphragm';
import pumpScrew from './pump-screw';
import pumpVacuum from './pump-vacuum';
import compressorCentrifugal from './compressor-centrifugal';
import blower from './blower';
import valveGate from './valve-gate';
import valveControl from './valve-control';
import valveCheck from './valve-check';
import valveBall from './valve-ball';
import valveRelief from './valve-relief';
import valveSolenoid from './valve-solenoid';
import valveGlobe from './valve-globe';
import valveButterfly from './valve-butterfly';
import valve3Way from './valve-3way';
import valveMotorOperated from './valve-motor-operated';
import valveRegulator from './valve-regulator';
import instrumentCircle from './instrument-circle';
import instrumentSquare from './instrument-square';
import transmitterFlow from './transmitter-flow';
import transmitterPressure from './transmitter-pressure';
import transmitterTemp from './transmitter-temp';
import transmitterLevel from './transmitter-level';
import transmitterDp from './transmitter-dp';
import analyzer from './analyzer';
import controllerDcs from './controller-dcs';
import indicatorLocal from './indicator-local';
import agitator from './agitator';
import heatExchanger from './heat-exchanger';
import heatExchangerPlate from './heat-exchanger-plate';
import heatExchangerDoublePipe from './heat-exchanger-double-pipe';
import hxKettleReboiler from './hx-kettle-reboiler';
import hxCondenser from './hx-condenser';
import hxAirCooler from './hx-air-cooler';
import heaterFired from './heater-fired';
import hxEvaporator from './hx-evaporator';
import reducerConcentric from './reducer-concentric';
import restrictionOrifice from './restriction-orifice';
import strainer from './strainer';
import teeBranch from './tee-branch';
import flangePair from './flange-pair';
import instrumentFlowmeterInline from './instrument-flowmeter-inline';
import spectacleBlind from './spectacle-blind';
import expansionJoint from './expansion-joint';
import steamTrap from './steam-trap';
import pipeSupport from './pipe-support';
import columnTray from './column-tray';
import columnPacked from './column-packed';
import columnComplete from './column-complete';
import absorberTower from './absorber-tower';
import reactorCstr from './reactor-cstr';
import reactorPfr from './reactor-pfr';
import reactorJacketed from './reactor-jacketed';
import reactorFixedBed from './reactor-fixed-bed';
import reactorFluidizedBed from './reactor-fluidized-bed';
import relayDiamond from './relay-diamond';
import ventTerminator from './vent-terminator';
import drainTerminator from './drain-terminator';
import offpageConnector from './offpage-connector';
import scopeBoundary from './scope-boundary';
import instrumentGaugePressure from './instrument-gauge-pressure';

export const allSymbols: SymbolDefinition[] = [
  // Vessels
  vesselVertical,
  vesselHorizontal,
  storageTankConeRoof,
  storageTankFloatingRoof,
  knockoutDrum,
  separator3Phase,
  silo,
  // Columns
  columnTray,
  columnPacked,
  columnComplete,
  absorberTower,
  // Reactors
  reactorCstr,
  reactorPfr,
  reactorJacketed,
  reactorFixedBed,
  reactorFluidizedBed,
  // Pumps & machinery
  pumpCentrifugal,
  pumpGear,
  pumpDiaphragm,
  pumpScrew,
  pumpVacuum,
  compressorCentrifugal,
  blower,
  // Valves
  valveGate,
  valveControl,
  valveCheck,
  valveBall,
  valveRelief,
  valveSolenoid,
  valveGlobe,
  valveButterfly,
  valve3Way,
  valveMotorOperated,
  valveRegulator,
  // Instruments
  instrumentCircle,
  instrumentSquare,
  transmitterFlow,
  transmitterPressure,
  transmitterTemp,
  transmitterLevel,
  transmitterDp,
  analyzer,
  controllerDcs,
  indicatorLocal,
  instrumentGaugePressure,
  // Agitators
  agitator,
  // Heat exchangers
  heatExchanger,
  heatExchangerPlate,
  heatExchangerDoublePipe,
  hxKettleReboiler,
  hxCondenser,
  hxAirCooler,
  heaterFired,
  hxEvaporator,
  // Piping accessories
  reducerConcentric,
  restrictionOrifice,
  strainer,
  teeBranch,
  flangePair,
  instrumentFlowmeterInline,
  spectacleBlind,
  expansionJoint,
  steamTrap,
  pipeSupport,
  // Signal & logic
  relayDiamond,
  // Terminators
  ventTerminator,
  drainTerminator,
  offpageConnector,
  scopeBoundary,
];

/** Lookup table keyed by symbol kind (used by node renderers). */
export const symbolsByKind: Record<string, SymbolDefinition> = Object.fromEntries(
  allSymbols.map((s) => [s.kind, s]),
);

/** Declared display order for categories in the palette. */
export const CATEGORY_ORDER: SymbolCategory[] = [
  'Vessels',
  'Columns',
  'Reactors',
  'Pumps',
  'Valves',
  'Instruments',
  'Agitators',
  'Heat Exchangers',
  'Piping Accessories',
  'Signal & Logic',
  'Terminators',
];

/** Symbols grouped by category, in declared category order — drives the palette. */
export function symbolsByCategory(): Array<{ category: SymbolCategory; symbols: SymbolDefinition[] }> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    symbols: allSymbols.filter((s) => s.category === category),
  })).filter((g) => g.symbols.length > 0);
}

export type { SymbolDefinition, SymbolPort, PortDirection, SymbolCategory } from './types';

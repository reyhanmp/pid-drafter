/**
 * Per-category and per-symbol data-sheet field schemas.
 *
 * Field values are stored as strings in `EquipmentNodeData.properties` (a
 * flat bag keyed by field `id`) — kept intentionally untyped/flexible rather
 * than modelled as N per-symbol TypeScript interfaces, since these are
 * free-text/numeric data-sheet entries, not values the app computes with.
 *
 * TWO LAYERS, kind wins over category:
 *
 *   FIELDS_BY_KIND[kind]      exact engineering sheet for one symbol
 *   FIELDS_BY_CATEGORY[cat]   shared sheet for a whole category
 *   MINIMAL_FIELDS            fallback (Service only)
 *
 * The kind layer exists because a category's members often share nothing but
 * a filing label. "Piping Accessories" contains a strainer (mesh size), an
 * orifice plate (bore, beta ratio), a steam trap (trap type, capacity) and a
 * spectacle blind (open/closed position) — one shared sheet for all four
 * would be nearly all blank cells and no useful capture. Same story for
 * Heat Exchangers: an air cooler needs fan data, a fired heater needs
 * firing rate and efficiency, a kettle reboiler needs boilup.
 *
 * FIELD IDS ARE A COMPATIBILITY SURFACE. Every id that has ever shipped here
 * is still present, because saved projects store values keyed by these ids
 * and renaming one would silently blank that column of an existing drawing.
 * Adding is free; renaming or removing is a migration. Ids added later that
 * supersede an older one (e.g. the split shell/tube design conditions) sit
 * alongside the original rather than replacing it.
 *
 * `unit` and `options` are display hints only — neither is enforced, because
 * real data sheets carry values outside any dropdown a tool can guess.
 */
import type { SymbolCategory } from '../symbols/types';

export interface DataSheetField {
  id: string;
  label: string;
  /** Optional unit suffix shown next to the label, e.g. "barg", "°C". */
  unit?: string;
  /** Render as a <select> instead of free text when options are given. */
  options?: string[];
  /**
   * Optional section heading. Fields render grouped, in declared order, so a
   * long sheet reads as a real data sheet (Process / Design / Mechanical)
   * rather than a single undifferentiated column of inputs.
   */
  group?: string;
}

/** Standard group names, so every sheet in the app reads the same way. */
const G = {
  process: 'Process',
  design: 'Design',
  mechanical: 'Mechanical',
  performance: 'Performance',
  reaction: 'Reaction',
  instruments: 'Instrumentation',
} as const;

const DESIGN_CODES = ['ASME VIII Div. 1', 'ASME VIII Div. 2', 'EN 13445', 'PD 5500'];
const ANSI_CLASSES = ['150', '300', '600', '900', '1500', '2500'];
const END_CONNECTIONS = ['Flanged RF', 'Flanged FF', 'Butt Weld', 'Socket Weld', 'Threaded NPT', 'Wafer', 'Tri-Clamp'];
const LINE_SIZES = ['1/2"', '3/4"', '1"', '1 1/2"', '2"', '3"', '4"', '6"', '8"', '10"', '12"', '16"', '20"', '24"'];
const MATERIALS = [
  'Carbon Steel (A106 Gr.B)',
  'Carbon Steel (A516 Gr.70)',
  'Stainless Steel 304',
  'Stainless Steel 316',
  'Stainless Steel 316L',
  'Duplex Stainless Steel 2205',
  'Alloy Steel (A335 P11)',
  'Hastelloy C-276',
  'PTFE Lined Carbon Steel',
  'CPVC',
];

/**
 * Field sets for individual symbols, overriding their category sheet.
 * Keyed by the symbol registry `kind`.
 */
const FIELDS_BY_KIND: Record<string, DataSheetField[]> = {
  // ── Machinery: the category sheet alone understates these badly ──
  'compressor-centrifugal': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'designFlowRate', label: 'Design Flow Rate', unit: 'm³/h', group: G.process },
    { id: 'suctionPressure', label: 'Suction Pressure', unit: 'barg', group: G.process },
    { id: 'dischargePressure', label: 'Discharge Pressure', unit: 'barg', group: G.process },
    { id: 'suctionTemperature', label: 'Suction Temperature', unit: '°C', group: G.process },
    { id: 'dischargeTemperature', label: 'Discharge Temperature', unit: '°C', group: G.process },
    { id: 'compressionRatio', label: 'Compression Ratio', group: G.process },
    { id: 'molecularWeight', label: 'Gas Molecular Weight', unit: 'kg/kmol', group: G.process },
    { id: 'driverPower', label: 'Driver Power', unit: 'kW', group: G.performance },
    { id: 'polytropicEfficiency', label: 'Polytropic Efficiency', unit: '%', group: G.performance },
    { id: 'speed', label: 'Speed', unit: 'RPM', group: G.performance },
    { id: 'apiStandard', label: 'Standard', options: ['API 617', 'API 618', 'API 619'], group: G.design },
    { id: 'sealType', label: 'Seal Type', options: ['Dry Gas Seal', 'Mechanical Seal', 'Labyrinth'], group: G.design },
    { id: 'materialOfConstruction', label: 'Material of Construction', group: G.mechanical },
  ],
  blower: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'designFlowRate', label: 'Design Flow Rate', unit: 'm³/h', group: G.process },
    { id: 'pressureRise', label: 'Pressure Rise', unit: 'mbar', group: G.process },
    { id: 'inletTemperature', label: 'Inlet Temperature', unit: '°C', group: G.process },
    { id: 'driverPower', label: 'Motor Power', unit: 'kW', group: G.performance },
    { id: 'fanType', label: 'Impeller Type', options: ['Radial', 'Forward Curved', 'Backward Curved', 'Axial'], group: G.design },
    { id: 'speed', label: 'Speed', unit: 'RPM', group: G.performance },
    { id: 'materialOfConstruction', label: 'Material of Construction', group: G.mechanical },
  ],
  'pump-vacuum': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'capacity', label: 'Capacity', unit: 'm³/h', group: G.process },
    { id: 'suctionPressure', label: 'Suction Pressure', unit: 'mbar abs', group: G.process },
    { id: 'ultimatePressure', label: 'Ultimate Pressure', unit: 'mbar abs', group: G.performance },
    { id: 'sealingLiquid', label: 'Sealing Liquid', group: G.design },
    { id: 'driverPower', label: 'Driver Power', unit: 'kW', group: G.performance },
    { id: 'materialOfConstruction', label: 'Material of Construction', group: G.mechanical },
  ],

  // ── Heat exchanger variants: each is a different machine ──
  'hx-air-cooler': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'duty', label: 'Duty', unit: 'kW', group: G.process },
    { id: 'processInletTemp', label: 'Process Inlet Temperature', unit: '°C', group: G.process },
    { id: 'processOutletTemp', label: 'Process Outlet Temperature', unit: '°C', group: G.process },
    { id: 'ambientDesignTemp', label: 'Ambient Design Temperature', unit: '°C', group: G.process },
    { id: 'approachTemperature', label: 'Approach Temperature', unit: '°C', group: G.performance },
    { id: 'airFlow', label: 'Air Flow', unit: 'm³/s', group: G.performance },
    { id: 'fanCount', label: 'Fan Count', group: G.design },
    { id: 'fanPower', label: 'Fan Power (each)', unit: 'kW', group: G.design },
    { id: 'fanType', label: 'Fan Type', options: ['Forced Draft', 'Induced Draft'], group: G.design },
    { id: 'designPressure', label: 'Design Pressure', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'overallU', label: 'Overall U', unit: 'W/m²·K', group: G.performance },
    { id: 'area', label: 'Surface Area', unit: 'm²', group: G.performance },
    { id: 'materialOfConstruction', label: 'Material of Construction', group: G.mechanical },
  ],
  'heater-fired': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'duty', label: 'Absorbed Duty', unit: 'kW', group: G.process },
    { id: 'firingRate', label: 'Firing Rate', unit: 'kW', group: G.performance },
    { id: 'fuelType', label: 'Fuel Type', options: ['Natural Gas', 'Fuel Oil', 'Fuel Gas + Oil', 'LPG'], group: G.performance },
    { id: 'thermalEfficiency', label: 'Thermal Efficiency', unit: '%', group: G.performance },
    { id: 'flueGasTemp', label: 'Flue Gas Temperature', unit: '°C', group: G.performance },
    { id: 'processInletTemp', label: 'Process Inlet Temperature', unit: '°C', group: G.process },
    { id: 'processOutletTemp', label: 'Process Outlet Temperature', unit: '°C', group: G.process },
    { id: 'designPressure', label: 'Design Pressure', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'materialOfConstruction', label: 'Tube Material', group: G.mechanical },
    { id: 'materialOfConstructionShell', label: 'Shell / Casing Material', group: G.mechanical },
  ],
  'hx-evaporator': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'duty', label: 'Duty', unit: 'kW', group: G.process },
    { id: 'evaporationRate', label: 'Evaporation Rate', unit: 'kg/h', group: G.process },
    { id: 'effectNumber', label: 'Effect Number', group: G.process },
    { id: 'steamConsumption', label: 'Steam Consumption', unit: 'kg/h', group: G.performance },
    { id: 'steamPressure', label: 'Steam Pressure', unit: 'barg', group: G.performance },
    { id: 'evaporatorType', label: 'Evaporator Type', options: ['Falling Film', 'Rising Film', 'Forced Circulation', 'Falling Film Plate', 'Thin Film'], group: G.design },
    { id: 'designPressure', label: 'Design Pressure', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'area', label: 'Surface Area', unit: 'm²', group: G.performance },
    { id: 'overallU', label: 'Overall U', unit: 'W/m²·K', group: G.performance },
    { id: 'materialOfConstruction', label: 'Material of Construction', group: G.mechanical },
  ],
  'hx-condenser': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'duty', label: 'Duty', unit: 'kW', group: G.process },
    { id: 'condensingTemp', label: 'Condensing Temperature', unit: '°C', group: G.process },
    { id: 'condensateRate', label: 'Condensate Rate', unit: 'kg/h', group: G.process },
    { id: 'coolantType', label: 'Coolant', options: ['Cooling Water', 'Chilled Water', 'Brine', 'Air', 'Propylene Glycol'], group: G.process },
    { id: 'coolantSupplyTemp', label: 'Coolant Supply Temperature', unit: '°C', group: G.process },
    { id: 'coolantReturnTemp', label: 'Coolant Return Temperature', unit: '°C', group: G.process },
    { id: 'coolantFlowRate', label: 'Coolant Flow Rate', unit: 'm³/h', group: G.process },
    { id: 'lmtd', label: 'LMTD', unit: '°C', group: G.performance },
    { id: 'overallU', label: 'Overall U', unit: 'W/m²·K', group: G.performance },
    { id: 'area', label: 'Surface Area', unit: 'm²', group: G.performance },
    { id: 'designPressureShell', label: 'Design Pressure — Shell', unit: 'barg', group: G.design },
    { id: 'designPressureTube', label: 'Design Pressure — Tube', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'temaClass', label: 'TEMA Class', options: ['R', 'C', 'B'], group: G.design },
    { id: 'materialOfConstruction', label: 'Shell Material', group: G.mechanical },
    { id: 'tubeMaterial', label: 'Tube Material', group: G.mechanical },
  ],
  'hx-kettle-reboiler': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'duty', label: 'Duty', unit: 'kW', group: G.process },
    { id: 'boilupRate', label: 'Boil-up Rate', unit: 'kg/h', group: G.process },
    { id: 'bottomsTemp', label: 'Bottoms / Boiling Temperature', unit: '°C', group: G.process },
    { id: 'heatingMedium', label: 'Heating Medium', options: ['Steam', 'Hot Oil', 'Process Stream', 'Dowtherm'], group: G.process },
    { id: 'steamPressure', label: 'Steam Pressure', unit: 'barg', group: G.process },
    { id: 'steamConsumption', label: 'Steam Consumption', unit: 'kg/h', group: G.performance },
    { id: 'lmtd', label: 'LMTD', unit: '°C', group: G.performance },
    { id: 'overallU', label: 'Overall U', unit: 'W/m²·K', group: G.performance },
    { id: 'area', label: 'Surface Area', unit: 'm²', group: G.performance },
    { id: 'designPressureShell', label: 'Design Pressure — Shell', unit: 'barg', group: G.design },
    { id: 'designPressureTube', label: 'Design Pressure — Tube', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'temaClass', label: 'TEMA Class', options: ['R', 'C', 'B'], group: G.design },
    { id: 'materialOfConstruction', label: 'Shell Material', group: G.mechanical },
    { id: 'tubeMaterial', label: 'Tube Material', group: G.mechanical },
  ],

  // ── Piping accessories: four different devices behind one category label ──
  strainer: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'pressureRating', label: 'Pressure Rating (ANSI Class)', options: ANSI_CLASSES, group: G.design },
    { id: 'endConnection', label: 'End Connection', options: END_CONNECTIONS, group: G.design },
    { id: 'strainerType', label: 'Strainer Type', options: ['Y-Type', 'Basket', 'Temporary Cone', 'Duplex'], group: G.design },
    { id: 'meshSize', label: 'Screen Mesh', unit: 'µm', group: G.performance },
    { id: 'pressureDrop', label: 'Clean Pressure Drop', unit: 'bar', group: G.performance },
    { id: 'materialOfConstruction', label: 'Material of Construction', options: MATERIALS, group: G.mechanical },
    { id: 'isSparable', label: 'Sparable / Dual', options: ['Yes', 'No'], group: G.mechanical },
  ],
  'restriction-orifice': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Line Size', options: LINE_SIZES, group: G.process },
    { id: 'boreDiameter', label: 'Orifice Bore', unit: 'mm', group: G.process },
    { id: 'betaRatio', label: 'Beta Ratio (d/D)', group: G.process },
    { id: 'pressureRating', label: 'Pressure Rating (ANSI Class)', options: ANSI_CLASSES, group: G.design },
    { id: 'plateType', label: 'Plate Type', options: ['Concentric Square Edge', 'Concentric Beveled', 'Eccentric', 'Segmental', 'Restriction Orifice Plate'], group: G.design },
    { id: 'tapType', label: 'Pressure Taps', options: ['Flange Taps', 'Corner Taps', 'D-D/2 Taps', 'Pipe Taps'], group: G.design },
    { id: 'designPressureDrop', label: 'Design Pressure Drop', unit: 'bar', group: G.performance },
    { id: 'designFlowRate', label: 'Design Flow Rate', unit: 'm³/h', group: G.performance },
    { id: 'materialOfConstruction', label: 'Plate Material', options: MATERIALS, group: G.mechanical },
  ],
  'steam-trap': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'trapType', label: 'Trap Type', options: ['Thermodynamic', 'Thermostatic', 'Float & Thermostatic', 'Inverted Bucket', 'Bimetallic'], group: G.design },
    { id: 'pressureRating', label: 'Pressure Rating (ANSI Class)', options: ANSI_CLASSES, group: G.design },
    { id: 'endConnection', label: 'End Connection', options: END_CONNECTIONS, group: G.design },
    { id: 'maxDischargeCapacity', label: 'Max Discharge Capacity', unit: 'kg/h', group: G.performance },
    { id: 'maxDifferentialPressure', label: 'Max Differential Pressure', unit: 'bar', group: G.performance },
    { id: 'steamPressure', label: 'Steam Supply Pressure', unit: 'barg', group: G.process },
    { id: 'hasBypass', label: 'Bypass Fitted', options: ['Yes', 'No'], group: G.mechanical },
    { id: 'isTraced', label: 'Heat Traced', options: ['Yes', 'No'], group: G.mechanical },
    { id: 'materialOfConstruction', label: 'Body Material', options: MATERIALS, group: G.mechanical },
  ],
  'spectacle-blind': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'position', label: 'Position', options: ['Open (ring)', 'Closed (blind)', 'Spare'], group: G.process },
    { id: 'pressureRating', label: 'Pressure Rating (ANSI Class)', options: ANSI_CLASSES, group: G.design },
    { id: 'facingType', label: 'Facing', options: ['Raised Face', 'Ring Type Joint', 'Flat Face'], group: G.design },
    { id: 'purpose', label: 'Purpose', options: ['Positive Isolation', 'Maintenance Isolation', 'Commissioning'], group: G.design },
    { id: 'materialOfConstruction', label: 'Material of Construction', options: MATERIALS, group: G.mechanical },
  ],
  'expansion-joint': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'jointType', label: 'Type', options: ['Axial Bellows', 'Universal', 'Hinged', 'Gimbal', 'Pressure Balanced', 'Rubber'], group: G.design },
    { id: 'pressureRating', label: 'Pressure Rating (ANSI Class)', options: ANSI_CLASSES, group: G.design },
    { id: 'axialMovement', label: 'Axial Movement', unit: 'mm', group: G.performance },
    { id: 'lateralMovement', label: 'Lateral Movement', unit: 'mm', group: G.performance },
    { id: 'designPressure', label: 'Design Pressure', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'bellowsMaterial', label: 'Bellows Material', options: MATERIALS, group: G.mechanical },
    { id: 'hasLiners', label: 'Internal Liners', options: ['Yes', 'No'], group: G.mechanical },
  ],
  'flange-pair': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'pressureRating', label: 'Pressure Rating (ANSI Class)', options: ANSI_CLASSES, group: G.design },
    { id: 'facingType', label: 'Facing', options: ['Raised Face', 'Ring Type Joint', 'Flat Face', 'Tongue & Groove'], group: G.design },
    { id: 'gasketType', label: 'Gasket', options: ['Spiral Wound', 'Sheet', 'Ring Joint', 'PTFE Envelope', 'Graphite'], group: G.design },
    { id: 'boltMaterial', label: 'Bolt Material', group: G.mechanical },
    { id: 'materialOfConstruction', label: 'Flange Material', options: MATERIALS, group: G.mechanical },
    { id: 'purpose', label: 'Purpose', options: ['Equipment Connection', 'Spec Break', 'Break-in Flange', 'Isolation'], group: G.process },
  ],
  'pipe-support': [
    { id: 'service', label: 'Location / Description', group: G.process },
    { id: 'supportType', label: 'Support Type', options: ['Shoe', 'Guide', 'Anchor', 'Rest Support', 'Hanger', 'Spring Hanger', 'Dummy Leg'], group: G.design },
    { id: 'size', label: 'Pipe Size', options: LINE_SIZES, group: G.process },
    { id: 'insulationThickness', label: 'Insulation Thickness', unit: 'mm', group: G.mechanical },
    { id: 'hasSlidePlate', label: 'Slide Plate', options: ['Yes', 'No'], group: G.design },
    { id: 'materialOfConstruction', label: 'Material of Construction', group: G.mechanical },
  ],
  'instrument-flowmeter-inline': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'meterType', label: 'Meter Type', options: ['Magnetic Flow', 'Coriolis', 'Vortex', 'Turbine', 'Ultrasonic', 'Positive Displacement', 'Variable Area'], group: G.design },
    { id: 'range', label: 'Flow Range', group: G.process },
    { id: 'accuracy', label: 'Accuracy', unit: '% of rate', group: G.performance },
    { id: 'signalType', label: 'Output Signal', options: ['4-20mA', 'HART', 'Pulse', 'Fieldbus', 'Modbus'], group: G.instruments },
    { id: 'pressureRating', label: 'Pressure Rating (ANSI Class)', options: ANSI_CLASSES, group: G.design },
    { id: 'endConnection', label: 'End Connection', options: END_CONNECTIONS, group: G.design },
    { id: 'wettedMaterial', label: 'Wetted Material', options: MATERIALS, group: G.mechanical },
    { id: 'hazardousArea', label: 'Hazardous Area', options: ['Safe Area', 'Zone 0', 'Zone 1', 'Zone 2'], group: G.mechanical },
  ],

  // ── Signal & logic ──
  'relay-diamond': [
    { id: 'service', label: 'Function / Description', group: G.reaction },
    { id: 'ioType', label: 'Signal Type', options: ['AI', 'AO', 'DI', 'DO'], group: G.instruments },
    { id: 'signalStandard', label: 'Signal Standard', options: ['4-20mA', '24VDC Discrete', 'Pneumatic 3-15 psi', 'HART', 'Fieldbus', 'Modbus TCP'], group: G.instruments },
    { id: 'dcsTag', label: 'DCS / PLC Tag', group: G.instruments },
    { id: 'logicFunction', label: 'Logic Function', options: ['AND', 'OR', 'NOT', 'Trip', 'Interlock', 'Permissive', 'Latch', 'Timer'], group: G.reaction },
    { id: 'tripSetpoint', label: 'Trip Set Point', group: G.reaction },
    { id: 'interlockNumber', label: 'Interlock / Cause No.', group: G.reaction },
    { id: 'isSafetyRelated', label: 'Safety Related', options: ['Yes', 'No'], group: G.design },
    { id: 'silRating', label: 'SIL Rating', options: ['N/A', 'SIL 1', 'SIL 2', 'SIL 3'], group: G.design },
  ],
  'controller-dcs': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'range', label: 'Range', group: G.instruments },
    { id: 'setPoint', label: 'Set Point', group: G.instruments },
    { id: 'outputRange', label: 'Output Range', group: G.instruments },
    { id: 'controlAction', label: 'Control Action', options: ['PID', 'PI', 'On/Off', 'Cascade', 'Ratio', 'Split Range'], group: G.instruments },
    { id: 'controlDirection', label: 'Action', options: ['Direct', 'Reverse'], group: G.instruments },
    { id: 'signalType', label: 'Signal Type', options: ['4-20mA', 'HART', 'Fieldbus', 'Modbus', 'Profibus'], group: G.instruments },
    { id: 'dcsTag', label: 'DCS / PLC Tag', group: G.instruments },
  ],

  // ── Terminators: line ends, but still carry real data ──
  'vent-terminator': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'dischargeTo', label: 'Discharge To', options: ['Safe Location (atmosphere)', 'Scrubber', 'Flare Header', 'Closed System', 'Roof Vent'], group: G.design },
    { id: 'terminatorType', label: 'Type', options: ['Open Vent', 'Gooseneck', 'Flame Arrester', 'Conservation Vent', 'Vacuum Breaker'], group: G.design },
    { id: 'elevation', label: 'Discharge Elevation', unit: 'm', group: G.design },
    { id: 'hasFlameArrester', label: 'Flame Arrester Fitted', options: ['Yes', 'No'], group: G.design },
    { id: 'materialOfConstruction', label: 'Material of Construction', group: G.mechanical },
  ],
  'drain-terminator': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'dischargeTo', label: 'Discharge To', options: ['Closed Drain Header', 'Open Drain / Floor Sump', 'Recovery Drum', 'Waste Treatment'], group: G.design },
    { id: 'isDoubleBlocked', label: 'Double Block & Bleed', options: ['Yes', 'No'], group: G.design },
    { id: 'materialOfConstruction', label: 'Material of Construction', group: G.mechanical },
  ],
  'vessel-horizontal': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'operatingPressure', label: 'Operating Pressure', unit: 'barg', group: G.process },
    { id: 'operatingTemperature', label: 'Operating Temperature', unit: '°C', group: G.process },
    { id: 'volume', label: 'Volume / Capacity', unit: 'm³', group: G.process },
    { id: 'liquidLevel', label: 'Normal Liquid Level', unit: '%', group: G.process },
    { id: 'designPressure', label: 'Design Pressure', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'designCode', label: 'Design Code', options: DESIGN_CODES, group: G.design },
    { id: 'vacuumRating', label: 'Full Vacuum Rating', options: ['Yes', 'No'], group: G.design },
    { id: 'materialOfConstruction', label: 'Material of Construction', options: MATERIALS, group: G.mechanical },
    { id: 'corrosionAllowance', label: 'Corrosion Allowance', unit: 'mm', group: G.mechanical },
    { id: 'insulation', label: 'Insulation / Tracing', group: G.mechanical },
  ],
};

/**
 * Shared field sets per category. These are the fallback for every symbol
 * that has no kind-level override above.
 */
const FIELDS_BY_CATEGORY: Partial<Record<SymbolCategory, DataSheetField[]>> = {
  Vessels: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'operatingPressure', label: 'Operating Pressure', unit: 'barg', group: G.process },
    { id: 'operatingTemperature', label: 'Operating Temperature', unit: '°C', group: G.process },
    { id: 'volume', label: 'Volume / Capacity', unit: 'm³', group: G.process },
    { id: 'orientation', label: 'Orientation', options: ['Vertical', 'Horizontal'], group: G.process },
    { id: 'liquidLevel', label: 'Normal Liquid Level', unit: '%', group: G.process },
    { id: 'designPressure', label: 'Design Pressure', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'designCode', label: 'Design Code', options: DESIGN_CODES, group: G.design },
    { id: 'vacuumRating', label: 'Full Vacuum Rating', options: ['Yes', 'No'], group: G.design },
    { id: 'headType', label: 'Head Type', options: ['Ellipsoidal', 'Torispherical', 'Hemispherical', 'Flat', 'Conical', 'Dished'], group: G.design },
    { id: 'materialOfConstruction', label: 'Material of Construction', options: MATERIALS, group: G.mechanical },
    { id: 'corrosionAllowance', label: 'Corrosion Allowance', unit: 'mm', group: G.mechanical },
    { id: 'insulation', label: 'Insulation / Tracing', group: G.mechanical },
    { id: 'insulationThickness', label: 'Insulation Thickness', unit: 'mm', group: G.mechanical },
  ],

  Columns: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'columnType', label: 'Internals', options: ['Tray', 'Random Packing', 'Structured Packing', 'No Internals'], group: G.process },
    { id: 'operatingPressure', label: 'Operating Pressure (Top)', unit: 'barg', group: G.process },
    { id: 'operatingTemperature', label: 'Operating Temperature (Top)', unit: '°C', group: G.process },
    { id: 'bottomsTemperature', label: 'Bottoms Temperature', unit: '°C', group: G.process },
    { id: 'insideDiameter', label: 'Inside Diameter', unit: 'mm', group: G.design },
    { id: 'towerHeight', label: 'Tangent-to-Tangent Height', unit: 'mm', group: G.design },
    { id: 'numberOfStages', label: 'Theoretical Stages', group: G.design },
    { id: 'trayCount', label: 'Actual Trays', group: G.design },
    { id: 'traySpacing', label: 'Tray Spacing', unit: 'mm', group: G.design },
    { id: 'trayType', label: 'Tray Type', options: ['Sieve', 'Valve', 'Bubble Cap', 'Dualflow', 'N/A'], group: G.design },
    { id: 'packingType', label: 'Packing Type', group: G.design },
    { id: 'packingHeight', label: 'Packed Height', unit: 'm', group: G.design },
    { id: 'designPressure', label: 'Design Pressure', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'designCode', label: 'Design Code', options: DESIGN_CODES, group: G.design },
    { id: 'feedStage', label: 'Feed Stage', group: G.performance },
    { id: 'refluxRatio', label: 'Reflux Ratio (R)', group: G.performance },
    { id: 'reboilerDuty', label: 'Reboiler Duty', unit: 'kW', group: G.performance },
    { id: 'condenserDuty', label: 'Condenser Duty', unit: 'kW', group: G.performance },
    { id: 'materialOfConstruction', label: 'Material of Construction', options: MATERIALS, group: G.mechanical },
    { id: 'corrosionAllowance', label: 'Corrosion Allowance', unit: 'mm', group: G.mechanical },
    { id: 'insulation', label: 'Insulation / Tracing', group: G.mechanical },
  ],

  Reactors: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'reactorType', label: 'Reactor Type', options: ['CSTR', 'PFR / Tubular', 'Batch', 'Semi-Batch', 'Fixed Bed', 'Fluidized Bed', 'Jacketed / Stirred'], group: G.process },
    { id: 'reactionType', label: 'Reaction', group: G.reaction },
    { id: 'operatingPressure', label: 'Operating Pressure', unit: 'barg', group: G.process },
    { id: 'operatingTemperature', label: 'Operating Temperature', unit: '°C', group: G.process },
    { id: 'conversion', label: 'Conversion per Pass', unit: '%', group: G.reaction },
    { id: 'selectivity', label: 'Selectivity', unit: '%', group: G.reaction },
    { id: 'residenceTime', label: 'Residence Time', unit: 'min', group: G.reaction },
    { id: 'spaceVelocity', label: 'Space Velocity (LHSV/WHSV)', unit: '1/h', group: G.reaction },
    { id: 'reactionHeat', label: 'Heat of Reaction', unit: 'kJ/mol', group: G.reaction },
    { id: 'reactionPhase', label: 'Phase', options: ['Liquid', 'Liquid-Liquid', 'Gas-Liquid', 'Gas', 'Slurry', 'Solid'], group: G.reaction },
    { id: 'volume', label: 'Volume / Capacity', unit: 'm³', group: G.design },
    { id: 'designPressure', label: 'Design Pressure', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'designCode', label: 'Design Code', options: DESIGN_CODES, group: G.design },
    { id: 'heatTransferArea', label: 'Heat Transfer Area', unit: 'm²', group: G.design },
    { id: 'jacketMedium', label: 'Jacket / Coil Medium', options: ['Cooling Water', 'Chilled Water', 'Steam', 'Hot Oil', 'Brine', 'Dowtherm', 'N/A'], group: G.design },
    { id: 'jacketDuty', label: 'Jacket / Coil Duty', unit: 'kW', group: G.design },
    { id: 'catalystType', label: 'Catalyst Type', group: G.reaction },
    { id: 'catalystLoading', label: 'Catalyst Loading', unit: 'kg', group: G.reaction },
    { id: 'catalystLife', label: 'Catalyst Life', unit: 'h', group: G.reaction },
    { id: 'agitationSpeed', label: 'Agitator Speed', unit: 'RPM', group: G.performance },
    { id: 'mixingPower', label: 'Mixing Power per Volume', unit: 'kW/m³', group: G.performance },
    { id: 'materialOfConstruction', label: 'Material of Construction', options: MATERIALS, group: G.mechanical },
    { id: 'corrosionAllowance', label: 'Corrosion Allowance', unit: 'mm', group: G.mechanical },
    { id: 'insulation', label: 'Insulation / Tracing', group: G.mechanical },
  ],

  Pumps: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'pumpType', label: 'Pump Type', options: ['Centrifugal', 'Gear', 'Diaphragm', 'Screw', 'Peristaltic', 'Vane'], group: G.process },
    { id: 'fluidPumped', label: 'Fluid Pumped', group: G.process },
    { id: 'designFlowRate', label: 'Design Flow Rate', unit: 'm³/h', group: G.process },
    { id: 'designHead', label: 'Design Head', unit: 'm', group: G.performance },
    { id: 'differentialPressure', label: 'Differential Pressure', unit: 'bar', group: G.performance },
    { id: 'npshAvailable', label: 'NPSH Available', unit: 'm', group: G.performance },
    { id: 'npshRequired', label: 'NPSH Required', unit: 'm', group: G.performance },
    { id: 'efficiency', label: 'Efficiency', unit: '%', group: G.performance },
    { id: 'speed', label: 'Speed', unit: 'RPM', group: G.performance },
    { id: 'driverPower', label: 'Driver Power', unit: 'kW', group: G.performance },
    { id: 'driverType', label: 'Driver Type', options: ['Electric Motor', 'Steam Turbine', 'Diesel Engine', 'Air Motor'], group: G.design },
    { id: 'sealType', label: 'Seal Type', options: ['Mechanical Seal', 'Gland Packing', 'Magnetic Drive', 'Diaphragm', 'Lip Seal'], group: G.design },
    { id: 'sealFlushPlan', label: 'Seal Flush Plan', group: G.design },
    { id: 'apiStandard', label: 'Standard', options: ['API 610 (BB/OH)', 'API 675 (Metering)', 'API 676 (Rotary)', 'API 685 (Sealless)', 'ISO 2858', 'N/A'], group: G.design },
    { id: 'isSpared', label: 'Spared (1x100% / 2x100%)', options: ['No spare', '1 x 100% installed spare', '2 x 100% (no spare)'], group: G.design },
    { id: 'materialOfConstruction', label: 'Material of Construction', options: MATERIALS, group: G.mechanical },
  ],

  Valves: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'pressureRating', label: 'Pressure Rating (ANSI Class)', options: ANSI_CLASSES, group: G.design },
    { id: 'endConnection', label: 'End Connection', options: END_CONNECTIONS, group: G.design },
    { id: 'bodyMaterial', label: 'Body Material', options: MATERIALS, group: G.mechanical },
    { id: 'trimMaterial', label: 'Trim Material', options: ['13% Cr / SS410', 'SS316', 'SS316 + Stellite', 'Monel', 'Alloy 20', 'Duplex 2205'], group: G.mechanical },
    { id: 'actuatorType', label: 'Actuator Type', options: ['Manual', 'Pneumatic', 'Electric', 'Hydraulic', 'Solenoid', 'None'], group: G.performance },
    { id: 'failPosition', label: 'Fail Position', options: ['Fail Open', 'Fail Closed', 'Fail Last', 'N/A'], group: G.performance },
    { id: 'cv', label: 'Flow Coefficient (Cv)', group: G.performance },
    { id: 'leakageClass', label: 'Leakage Class', options: ['Class I', 'Class II', 'Class III', 'Class IV', 'Class V', 'Class VI', 'N/A'], group: G.performance },
    { id: 'valveStandard', label: 'Standard', options: ['API 600', 'API 602', 'API 526 (PSV)', 'API 598 (test)', 'BS 1873', 'ISO 5211', 'N/A'], group: G.design },
    { id: 'isCarSealed', label: 'Car Sealed', options: ['Yes', 'No'], group: G.performance },
    { id: 'setPressure', label: 'Set Pressure (relief only)', unit: 'barg', group: G.performance },
    { id: 'isolationPurpose', label: 'Isolation Purpose', options: ['Equipment Isolation', 'Spec Break', 'Maintenance', 'Control Isolation', 'N/A'], group: G.process },
  ],

  Instruments: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'range', label: 'Calibrated Range', group: G.process },
    { id: 'setPoint', label: 'Set Point', group: G.process },
    { id: 'signalType', label: 'Signal Type', options: ['4-20mA', 'Pneumatic', 'Discrete', 'HART', 'Fieldbus', 'Modbus'], group: G.instruments },
    { id: 'processConnection', label: 'Process Connection', options: ['1/2" NPT', '1/2" Flanged', 'Tri-Clamp', 'Capillary', 'Welded Boss', 'Remote Seal'], group: G.instruments },
    { id: 'wettedMaterial', label: 'Wetted Material', options: MATERIALS, group: G.mechanical },
    { id: 'accuracy', label: 'Accuracy', unit: '% of span', group: G.performance },
    { id: 'hazardousArea', label: 'Hazardous Area', options: ['Safe Area', 'Zone 0', 'Zone 1', 'Zone 2'], group: G.design },
    { id: 'ipRating', label: 'IP Rating', options: ['IP54', 'IP65', 'IP66', 'IP67', 'IP68'], group: G.design },
    { id: 'dcsTag', label: 'DCS / PLC Tag', group: G.instruments },
    { id: 'calibrationFrequency', label: 'Calibration Interval', unit: 'months', group: G.performance },
    { id: 'isSafetyRelated', label: 'Safety Related', options: ['Yes', 'No'], group: G.design },
    { id: 'silRating', label: 'SIL Rating', options: ['N/A', 'SIL 1', 'SIL 2', 'SIL 3'], group: G.design },
  ],

  'Heat Exchangers': [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'exchangerType', label: 'Exchanger Type', options: ['Shell & Tube', 'Plate', 'Double Pipe', 'Air Cooler', 'Kettle Reboiler', 'Condenser', 'Evaporator', 'Fired Heater'], group: G.process },
    { id: 'duty', label: 'Duty', unit: 'kW', group: G.process },
    { id: 'hotSideInletTemp', label: 'Hot Side Inlet', unit: '°C', group: G.process },
    { id: 'hotSideOutletTemp', label: 'Hot Side Outlet', unit: '°C', group: G.process },
    { id: 'coldSideInletTemp', label: 'Cold Side Inlet', unit: '°C', group: G.process },
    { id: 'coldSideOutletTemp', label: 'Cold Side Outlet', unit: '°C', group: G.process },
    { id: 'area', label: 'Surface Area', unit: 'm²', group: G.performance },
    { id: 'overallU', label: 'Overall U', unit: 'W/m²·K', group: G.performance },
    { id: 'lmtd', label: 'LMTD', unit: '°C', group: G.performance },
    { id: 'foulingFactor', label: 'Fouling Factor', unit: 'm²·K/W', group: G.performance },
    { id: 'designPressure', label: 'Design Pressure (Shell/Tube)', unit: 'barg', group: G.design },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C', group: G.design },
    { id: 'temaClass', label: 'TEMA Class', options: ['R', 'C', 'B', 'N/A'], group: G.design },
    { id: 'shellMaterial', label: 'Shell Material', options: MATERIALS, group: G.mechanical },
    { id: 'tubeMaterial', label: 'Tube Material', options: MATERIALS, group: G.mechanical },
    { id: 'materialOfConstruction', label: 'Material of Construction', options: MATERIALS, group: G.mechanical },
    { id: 'insulation', label: 'Insulation / Tracing', group: G.mechanical },
  ],

  Agitators: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'impellerType', label: 'Impeller Type', options: ['Rushton Turbine', 'Pitched Blade Turbine', 'Marine Propeller', 'Anchor', 'Gate / Paddle', 'Helical Ribbon', 'Screw'], group: G.design },
    { id: 'agitatorPurpose', label: 'Purpose', options: ['Mixing', 'Suspension', 'Dispersion', 'Heat Transfer', 'Blending', 'Emulsification'], group: G.process },
    { id: 'powerRating', label: 'Power Rating', unit: 'kW', group: G.performance },
    { id: 'speed', label: 'Speed', unit: 'RPM', group: G.performance },
    { id: 'mixingPowerPerVolume', label: 'Mixing Power per Volume', unit: 'kW/m³', group: G.performance },
    { id: 'tipSpeed', label: 'Tip Speed', unit: 'm/s', group: G.performance },
    { id: 'impellerCount', label: 'Number of Impellers', group: G.design },
    { id: 'impellerDiameter', label: 'Impeller Diameter', unit: 'mm', group: G.design },
    { id: 'shaftMaterial', label: 'Shaft Material', options: MATERIALS, group: G.mechanical },
    { id: 'driveType', label: 'Drive Type', options: ['Direct Coupled', 'Gearbox', 'Belt Drive', 'Magnetic Drive'], group: G.design },
    { id: 'sealType', label: 'Shaft Seal', options: ['Mechanical Seal', 'Gland Packing', 'Lip Seal', 'Magnetic Drive', 'N/A'], group: G.design },
    { id: 'isBaffled', label: 'Baffles Fitted', options: ['Yes', 'No'], group: G.design },
  ],

  'Signal & Logic': [
    { id: 'service', label: 'Function / Description', group: G.reaction },
    { id: 'ioType', label: 'Signal Type', options: ['AI', 'AO', 'DI', 'DO'], group: G.instruments },
    { id: 'signalStandard', label: 'Signal Standard', options: ['4-20mA', '24VDC Discrete', 'Pneumatic 3-15 psi', 'HART', 'Fieldbus', 'Modbus TCP'], group: G.instruments },
    { id: 'dcsTag', label: 'DCS / PLC Tag', group: G.instruments },
    { id: 'logicFunction', label: 'Logic Function', options: ['AND', 'OR', 'NOT', 'Trip', 'Interlock', 'Permissive', 'Latch', 'Timer'], group: G.reaction },
    { id: 'tripSetpoint', label: 'Trip Set Point', group: G.reaction },
    { id: 'interlockNumber', label: 'Interlock / Cause No.', group: G.reaction },
    { id: 'isSafetyRelated', label: 'Safety Related', options: ['Yes', 'No'], group: G.design },
    { id: 'silRating', label: 'SIL Rating', options: ['N/A', 'SIL 1', 'SIL 2', 'SIL 3'], group: G.design },
  ],

  /**
   * Piping Accessories deliberately has NO category sheet: the four devices
   * behind this label share no fields worth capturing. Each one has a
   * kind-level override above; anything added to the category without one
   * falls through to MINIMAL_FIELDS, which is the honest outcome — better a
   * blank "Service" than fifteen irrelevant boxes.
   */
  'Piping Accessories': [{ id: 'service', label: 'Service / Description', group: G.process }],

  Terminators: [
    { id: 'service', label: 'Service / Description', group: G.process },
    { id: 'size', label: 'Size', options: LINE_SIZES, group: G.process },
    { id: 'dischargeTo', label: 'Discharge / Destination', group: G.design },
    { id: 'materialOfConstruction', label: 'Material of Construction', group: G.mechanical },
  ],
};

/** Minimal fields for symbols with no meaningful data sheet. */
const MINIMAL_FIELDS: DataSheetField[] = [{ id: 'service', label: 'Service / Description' }];

/**
 * Sheet for one symbol, resolving kind override before category default.
 * Callers with a symbol in hand should prefer this.
 */
export function fieldsForKind(kind: string, category: SymbolCategory): DataSheetField[] {
  return FIELDS_BY_KIND[kind] ?? FIELDS_BY_CATEGORY[category] ?? MINIMAL_FIELDS;
}

/** Sheet for a whole category. Kept for callers that only know the category. */
export function fieldsForCategory(category: SymbolCategory): DataSheetField[] {
  return FIELDS_BY_CATEGORY[category] ?? MINIMAL_FIELDS;
}

/** True when a symbol has a hand-authored sheet rather than a category default. */
export function hasKindSpecificFields(kind: string): boolean {
  return kind in FIELDS_BY_KIND;
}

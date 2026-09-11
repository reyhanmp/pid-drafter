/**
 * Per-category data-sheet field schemas. Each symbol category gets a
 * reasonable, real-engineering field set (see PRD.md / task spec). Field
 * values are stored as strings in `EquipmentNodeData.properties` (a flat
 * bag keyed by field `id`) — kept intentionally untyped/flexible rather
 * than modeled as N per-category TypeScript interfaces, since these are
 * free-text/numeric data-sheet entries, not values the app computes with.
 */
import type { SymbolCategory } from '../symbols/types';

export interface DataSheetField {
  id: string;
  label: string;
  /** Optional unit suffix shown next to the label, e.g. "barg", "°C". */
  unit?: string;
  /** Render as a <select> instead of free text when options are given. */
  options?: string[];
}

/** Field sets for categories with rich data sheets. Falls back to MINIMAL_FIELDS otherwise. */
const FIELDS_BY_CATEGORY: Partial<Record<SymbolCategory, DataSheetField[]>> = {
  Vessels: [
    { id: 'service', label: 'Service / Description' },
    { id: 'designPressure', label: 'Design Pressure', unit: 'barg' },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C' },
    { id: 'operatingPressure', label: 'Operating Pressure', unit: 'barg' },
    { id: 'operatingTemperature', label: 'Operating Temperature', unit: '°C' },
    { id: 'materialOfConstruction', label: 'Material of Construction' },
    { id: 'volume', label: 'Volume / Capacity', unit: 'm³' },
    { id: 'orientation', label: 'Orientation', options: ['Vertical', 'Horizontal'] },
  ],
  Pumps: [
    { id: 'service', label: 'Service / Description' },
    { id: 'designFlowRate', label: 'Design Flow Rate', unit: 'm³/h' },
    { id: 'designHead', label: 'Design Head', unit: 'm' },
    { id: 'npshAvailable', label: 'NPSH Available', unit: 'm' },
    { id: 'driverPower', label: 'Driver Power', unit: 'kW' },
    { id: 'materialOfConstruction', label: 'Material of Construction' },
  ],
  Valves: [
    { id: 'service', label: 'Service / Description' },
    { id: 'size', label: 'Size', unit: 'in' },
    { id: 'pressureRating', label: 'Pressure Rating (ANSI Class)' },
    { id: 'bodyMaterial', label: 'Body Material' },
    { id: 'actuatorType', label: 'Actuator Type', options: ['Manual', 'Pneumatic', 'Electric', 'Solenoid', 'None'] },
    { id: 'failPosition', label: 'Fail Position', options: ['Fail Open', 'Fail Closed', 'Fail Last'] },
  ],
  Instruments: [
    { id: 'service', label: 'Service / Description' },
    { id: 'range', label: 'Range' },
    { id: 'signalType', label: 'Signal Type', options: ['4-20mA', 'Pneumatic', 'Discrete', 'HART', 'Fieldbus'] },
    { id: 'setPoint', label: 'Set Point' },
  ],
  'Heat Exchangers': [
    { id: 'service', label: 'Service / Description' },
    { id: 'designPressure', label: 'Design Pressure (Shell/Tube)', unit: 'barg' },
    { id: 'designTemperature', label: 'Design Temperature', unit: '°C' },
    { id: 'duty', label: 'Duty', unit: 'kW' },
    { id: 'materialOfConstruction', label: 'Material of Construction' },
  ],
  Agitators: [
    { id: 'service', label: 'Service / Description' },
    { id: 'powerRating', label: 'Power Rating', unit: 'kW' },
    { id: 'speed', label: 'Speed', unit: 'RPM' },
    { id: 'impellerType', label: 'Impeller Type' },
  ],
};

/** Minimal fields for categories that don't warrant a rich data sheet. */
const MINIMAL_FIELDS: DataSheetField[] = [{ id: 'service', label: 'Service / Description' }];

export function fieldsForCategory(category: SymbolCategory): DataSheetField[] {
  return FIELDS_BY_CATEGORY[category] ?? MINIMAL_FIELDS;
}

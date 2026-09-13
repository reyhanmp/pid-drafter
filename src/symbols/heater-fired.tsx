import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Fired heater (process furnace) — rectangular firebox with a stack and a
 * burner, plus a coil indicated inside.
 */
function HeaterFiredGeometry({ width, height }: { width: number; height: number }) {
  const stackW = width * 0.2;
  const stackH = height * 0.3;
  const boxTop = stackH;
  const coilY = boxTop + (height - boxTop) * 0.35;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* stack, opening through the top edge so the flue port lands on ink */}
      <rect x={width - stackW} y={0} width={stackW} height={stackH} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* firebox */}
      <rect
        x={0}
        y={boxTop}
        width={width}
        height={height - boxTop}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
      {/* process coil */}
      <line x1={width * 0.1} y1={coilY} x2={width * 0.9} y2={coilY} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line
        x1={width * 0.1}
        y1={coilY + 10}
        x2={width * 0.9}
        y2={coilY + 10}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* burner */}
      <path
        d={`M ${width * 0.4} ${height} L ${width * 0.5} ${coilY + 18} L ${width * 0.6} ${height}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const heaterFired: SymbolDefinition = {
  kind: 'heater-fired',
  label: 'Fired Heater',
  category: 'Heat Exchangers',
  defaultWidth: 110,
  defaultHeight: 140,
  tagPrefix: 'H',
  ports: [
    { id: 'in', label: 'Process Inlet', x: 0, y: 105, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Process Outlet', x: 110, y: 105, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'flue', label: 'Flue Gas', x: 99, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'fuel', label: 'Fuel In', x: 55, y: 140, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: HeaterFiredGeometry,
  dexpi: { componentClass: 'FiredHeater' },
};

export default heaterFired;

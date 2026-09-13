import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Screw (progressive-cavity) pump — circle body with two screw rotors. */
function PumpScrewGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.medium;
  const cx = width / 2;
  const cy = height / 2;
  const screwH = r * 1.1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <ellipse cx={cx - r * 0.32} cy={cy} rx={r * 0.2} ry={screwH * 0.5} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <ellipse cx={cx + r * 0.32} cy={cy} rx={r * 0.2} ry={screwH * 0.5} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={0} y1={cy} x2={cx - r} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={cx + r} y1={cy} x2={width} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
    </svg>
  );
}

const pumpScrew: SymbolDefinition = {
  kind: 'pump-screw',
  label: 'Screw / PC Pump',
  category: 'Pumps',
  defaultWidth: 70,
  defaultHeight: 70,
  tagPrefix: 'P',
  ports: [
    { id: 'suction', label: 'Suction', x: 0, y: 35, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'discharge', label: 'Discharge', x: 70, y: 35, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: PumpScrewGeometry,
  dexpi: { componentClass: 'ScrewPump' },
};

export default pumpScrew;

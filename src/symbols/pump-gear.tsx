import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Gear pump — circle body with two meshing gear circles inside. */
function PumpGearGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.medium;
  const cx = width / 2;
  const cy = height / 2;
  const gearR = r * 0.42;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <circle cx={cx - gearR} cy={cy} r={gearR} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <circle cx={cx + gearR} cy={cy} r={gearR} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* stubs out to the declared ports on the bounding box */}
      <line x1={0} y1={cy} x2={cx - r} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={cx + r} y1={cy} x2={width} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
    </svg>
  );
}

const pumpGear: SymbolDefinition = {
  kind: 'pump-gear',
  label: 'Gear Pump',
  category: 'Pumps',
  defaultWidth: 70,
  defaultHeight: 70,
  tagPrefix: 'P',
  ports: [
    { id: 'suction', label: 'Suction', x: 0, y: 35, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'discharge', label: 'Discharge', x: 70, y: 35, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: PumpGearGeometry,
  dexpi: { componentClass: 'GearPump' },
};

export default pumpGear;

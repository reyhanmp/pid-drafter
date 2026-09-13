import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Vacuum pump — circle body with a piston/cylinder glyph inside. */
function PumpVacuumGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.medium;
  const cx = width / 2;
  const cy = height / 2;
  const cyw = r * 0.85;
  const piston = r * 0.42;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <rect
        x={cx - cyw}
        y={cy - cyw * 0.5}
        width={cyw * 2}
        height={cyw}
        rx={cyw * 0.2}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <line x1={cx - piston} y1={cy - cyw * 0.5} x2={cx - piston} y2={cy + cyw * 0.5} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={0} y1={cy} x2={cx - r} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={cx + r} y1={cy} x2={width} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
    </svg>
  );
}

const pumpVacuum: SymbolDefinition = {
  kind: 'pump-vacuum',
  label: 'Vacuum Pump',
  category: 'Pumps',
  defaultWidth: 70,
  defaultHeight: 70,
  tagPrefix: 'P',
  ports: [
    { id: 'suction', label: 'Suction', x: 0, y: 35, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'discharge', label: 'Discharge', x: 70, y: 35, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: PumpVacuumGeometry,
  dexpi: { componentClass: 'VacuumPump' },
};

export default pumpVacuum;

import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Centrifugal pump — circle with a discharge nozzle chevron. */
function PumpCentrifugalGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.medium;
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* impeller chevron pointing toward discharge (right) */}
      <path
        d={`M ${cx - r * 0.4} ${cy - r * 0.5} L ${cx + r * 0.5} ${cy} L ${cx - r * 0.4} ${cy + r * 0.5}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const pumpCentrifugal: SymbolDefinition = {
  kind: 'pump-centrifugal',
  label: 'Centrifugal Pump',
  category: 'Pumps',
  defaultWidth: 70,
  defaultHeight: 70,
  tagPrefix: 'P',
  ports: [
    { id: 'suction', label: 'Suction', x: 0, y: 35, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'discharge', label: 'Discharge', x: 70, y: 35, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: PumpCentrifugalGeometry,
  dexpi: { componentClass: 'CentrifugalPump' },
};

export default pumpCentrifugal;

import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Diaphragm (metering) pump — circle body with a dome/diaphragm arc across
 * the middle and a stroke arrow, per ISA-5.1 metering-pump convention.
 */
function PumpDiaphragmGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.medium;
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* diaphragm dome */}
      <path
        d={`M ${cx - r * 0.6} ${cy + r * 0.35} A ${r * 0.7} ${r * 0.7} 0 0 1 ${cx + r * 0.6} ${cy + r * 0.35}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* stroke arrow */}
      <line x1={cx} y1={cy - r * 0.5} x2={cx} y2={cy - r * 0.05} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={cx - r * 0.18} y1={cy - 0.22 * r} x2={cx} y2={cy - r * 0.05} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={cx + r * 0.18} y1={cy - r * 0.22} x2={cx} y2={cy - r * 0.05} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={0} y1={cy} x2={cx - r} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={cx + r} y1={cy} x2={width} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
    </svg>
  );
}

const pumpDiaphragm: SymbolDefinition = {
  kind: 'pump-diaphragm',
  label: 'Diaphragm / Metering Pump',
  category: 'Pumps',
  defaultWidth: 70,
  defaultHeight: 70,
  tagPrefix: 'P',
  ports: [
    { id: 'suction', label: 'Suction', x: 0, y: 35, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'discharge', label: 'Discharge', x: 70, y: 35, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: PumpDiaphragmGeometry,
  dexpi: { componentClass: 'DiaphragmPump' },
};

export default pumpDiaphragm;

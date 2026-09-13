import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Centrifugal compressor — circle body with a single-curve impeller glyph. */
function CompressorCentrifugalGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.medium;
  const cx = width / 2;
  const cy = height / 2;
  const blades = 4;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* swept blades: the visual differentiator from a liquid pump */}
      {Array.from({ length: blades }).map((_, i) => {
        const a = (i / blades) * Math.PI * 2 - Math.PI / 4;
        const x0 = cx + Math.cos(a) * r * 0.25;
        const y0 = cy + Math.sin(a) * r * 0.25;
        const x1 = cx + Math.cos(a + 0.7) * r * 0.8;
        const y1 = cy + Math.sin(a + 0.7) * r * 0.8;
        return (
          <path
            key={i}
            d={`M ${x0} ${y0} Q ${cx + Math.cos(a + 0.2) * r * 0.75} ${cy + Math.sin(a + 0.2) * r * 0.75} ${x1} ${y1}`}
            fill={FILL_NONE}
            stroke={STROKE}
            strokeWidth={LINE_WEIGHT.thin}
          />
        );
      })}
      <line x1={0} y1={cy} x2={cx - r} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={cx + r} y1={cy} x2={width} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
    </svg>
  );
}

const compressorCentrifugal: SymbolDefinition = {
  kind: 'compressor-centrifugal',
  label: 'Centrifugal Compressor',
  category: 'Pumps',
  defaultWidth: 80,
  defaultHeight: 80,
  tagPrefix: 'K',
  ports: [
    { id: 'suction', label: 'Suction', x: 0, y: 40, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'discharge', label: 'Discharge', x: 80, y: 40, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: CompressorCentrifugalGeometry,
  dexpi: { componentClass: 'CentrifugalCompressor' },
};

export default compressorCentrifugal;

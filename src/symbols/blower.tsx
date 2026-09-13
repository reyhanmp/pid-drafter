import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Blower / fan — rectangle body with a fan-wheel glyph and a straight
 * through-flow, per ISO 10628 rotary-equipment convention.
 */
function BlowerGeometry({ width, height }: { width: number; height: number }) {
  const cy = height / 2;
  const r = Math.min(width, height) * 0.3;
  const cx = width / 2;
  const blades = 6;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {Array.from({ length: blades }).map((_, i) => {
        const a = (i / blades) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(a) * r}
            y2={cy + Math.sin(a) * r}
            stroke={STROKE}
            strokeWidth={LINE_WEIGHT.thin}
          />
        );
      })}
    </svg>
  );
}

const blower: SymbolDefinition = {
  kind: 'blower',
  label: 'Blower / Fan',
  category: 'Pumps',
  defaultWidth: 70,
  defaultHeight: 60,
  tagPrefix: 'K',
  ports: [
    { id: 'suction', label: 'Suction', x: 0, y: 30, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'discharge', label: 'Discharge', x: 70, y: 30, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: BlowerGeometry,
  dexpi: { componentClass: 'Blower' },
};

export default blower;

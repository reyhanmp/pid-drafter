import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Condenser — shell-and-tube body drawn with the tube-side heads closed off
 * and a coolant in/out pair, the standard condenser representation.
 */
function HxCondenserGeometry({ width, height }: { width: number; height: number }) {
  const capR = height * 0.12;
  const headW = width * 0.1;
  const tubeCount = 4;
  const tubeSpacing = (height - capR * 2) / (tubeCount + 1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={capR}
        ry={capR}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* tube sheet / head divisions */}
      <line x1={headW} y1={0} x2={headW} y2={height} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={width - headW} y1={0} x2={width - headW} y2={height} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {Array.from({ length: tubeCount }).map((_, i) => {
        const y = capR + tubeSpacing * (i + 1);
        return (
          <line
            key={i}
            x1={headW}
            y1={y}
            x2={width - headW}
            y2={y}
            stroke={STROKE}
            strokeWidth={LINE_WEIGHT.thin}
          />
        );
      })}
    </svg>
  );
}

const hxCondenser: SymbolDefinition = {
  kind: 'hx-condenser',
  label: 'Condenser',
  category: 'Heat Exchangers',
  defaultWidth: 130,
  defaultHeight: 60,
  tagPrefix: 'E',
  ports: [
    { id: 'vapour-in', label: 'Vapour In', x: 0, y: 30, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'condensate', label: 'Condensate Out', x: 130, y: 30, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'cool-in', label: 'Coolant In', x: 35, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'cool-out', label: 'Coolant Out', x: 95, y: 60, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: HxCondenserGeometry,
  dexpi: { componentClass: 'Condenser' },
};

export default hxCondenser;

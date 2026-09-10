import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Drain terminator — circle with "D", single port (dead-end). Circle distinguishes from the vent's square. */
function DrainTerminatorGeometry({ width, height }: { width: number; height: number }) {
  const r = Math.min(width, height) / 2 - LINE_WEIGHT.thin;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <circle
        cx={width / 2}
        cy={height / 2}
        r={r}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <text x={width / 2} y={height / 2 + 4} fontSize={12} textAnchor="middle" fontFamily="monospace" fill={STROKE}>
        D
      </text>
    </svg>
  );
}

const drainTerminator: SymbolDefinition = {
  kind: 'drain-terminator',
  label: 'Drain Point',
  category: 'Terminators',
  defaultWidth: 30,
  defaultHeight: 30,
  tagPrefix: 'DT',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
  ],
  Geometry: DrainTerminatorGeometry,
  dexpi: { componentClass: 'DrainTerminator' },
};

export default drainTerminator;

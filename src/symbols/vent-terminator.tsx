import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Vent-to-atmosphere terminator — square box with "V", single port (dead-end). */
function VentTerminatorGeometry({ width, height }: { width: number; height: number }) {
  const inset = LINE_WEIGHT.thin;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={inset}
        y={inset}
        width={width - inset * 2}
        height={height - inset * 2}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <text x={width / 2} y={height / 2 + 4} fontSize={12} textAnchor="middle" fontFamily="monospace" fill={STROKE}>
        V
      </text>
    </svg>
  );
}

const ventTerminator: SymbolDefinition = {
  kind: 'vent-terminator',
  label: 'Vent to Atmosphere',
  category: 'Terminators',
  defaultWidth: 30,
  defaultHeight: 30,
  tagPrefix: 'VT',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
  ],
  Geometry: VentTerminatorGeometry,
  dexpi: { componentClass: 'VentTerminator' },
};

export default ventTerminator;

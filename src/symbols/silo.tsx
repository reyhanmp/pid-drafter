import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Silo — straight cylindrical shell over a conical hopper discharge. */
function SiloGeometry({ width, height }: { width: number; height: number }) {
  const hopperH = height * 0.24;
  const shellBottom = height - hopperH;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={shellBottom}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
      <path
        d={`M 0 ${shellBottom} L ${width / 2} ${height} L ${width} ${shellBottom}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
      {/* stored solids level */}
      <line
        x1={width * 0.15}
        y1={shellBottom * 0.35}
        x2={width * 0.85}
        y2={shellBottom * 0.35}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
        strokeDasharray="5 4"
      />
    </svg>
  );
}

const silo: SymbolDefinition = {
  kind: 'silo',
  label: 'Silo',
  category: 'Vessels',
  defaultWidth: 100,
  defaultHeight: 170,
  tagPrefix: 'S',
  ports: [
    { id: 'inlet', label: 'Solids Inlet', x: 50, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'outlet', label: 'Hopper Outlet', x: 50, y: 170, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'vent', label: 'Bin Vent', x: 0, y: 45, direction: { x: -1, y: 0 }, kind: 'process' },
  ],
  Geometry: SiloGeometry,
  dexpi: { componentClass: 'Silo' },
};

export default silo;

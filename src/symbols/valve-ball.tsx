import type { SymbolDefinition } from './types';
import { STROKE, LINE_WEIGHT } from './style';

/** Ball valve — bowtie geometry like the gate valve, but SOLID filled (vs gate's hollow). */
function ValveBallGeometry({ width, height }: { width: number; height: number }) {
  const midY = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M 0 0 L ${width / 2} ${midY} L 0 ${height} Z`}
        fill={STROKE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <path
        d={`M ${width} 0 L ${width / 2} ${midY} L ${width} ${height} Z`}
        fill={STROKE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const valveBall: SymbolDefinition = {
  kind: 'valve-ball',
  label: 'Ball Valve',
  category: 'Valves',
  defaultWidth: 50,
  defaultHeight: 30,
  tagPrefix: 'BV',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 50, y: 15, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ValveBallGeometry,
  dexpi: { componentClass: 'BallValve' },
};

export default valveBall;

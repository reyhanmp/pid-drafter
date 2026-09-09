import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Gate/manual valve — hollow bowtie (two point-to-point triangles). */
function ValveGateGeometry({ width, height }: { width: number; height: number }) {
  const midY = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M 0 0 L ${width / 2} ${midY} L 0 ${height} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <path
        d={`M ${width} 0 L ${width / 2} ${midY} L ${width} ${height} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const valveGate: SymbolDefinition = {
  kind: 'valve-gate',
  label: 'Gate Valve',
  category: 'Valves',
  defaultWidth: 50,
  defaultHeight: 30,
  tagPrefix: 'V',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 50, y: 15, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ValveGateGeometry,
  dexpi: { componentClass: 'GateValve' },
};

export default valveGate;

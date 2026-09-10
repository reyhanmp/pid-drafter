import type { SymbolDefinition } from './types';
import { STROKE } from './style';

/** Check valve — single solid black flag/pennant triangle, flow left-to-right. */
function ValveCheckGeometry({ width, height }: { width: number; height: number }) {
  const midY = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={`M 0 0 L ${width} ${midY} L 0 ${height} Z`} fill={STROKE} stroke={STROKE} strokeWidth={1} />
    </svg>
  );
}

const valveCheck: SymbolDefinition = {
  kind: 'valve-check',
  label: 'Check Valve',
  category: 'Valves',
  defaultWidth: 50,
  defaultHeight: 30,
  tagPrefix: 'CV',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 50, y: 15, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ValveCheckGeometry,
  dexpi: { componentClass: 'CheckValve' },
};

export default valveCheck;

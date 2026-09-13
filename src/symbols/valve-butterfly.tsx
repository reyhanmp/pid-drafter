import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Butterfly valve — bowtie with a transverse disc line across the centre. */
function ValveButterflyGeometry({ width, height }: { width: number; height: number }) {
  const midY = height / 2;
  const discR = Math.min(width * 0.16, height * 0.34);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={`M 0 0 L ${width / 2} ${midY} L 0 ${height} Z`} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <path
        d={`M ${width} 0 L ${width / 2} ${midY} L ${width} ${height} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <line
        x1={width / 2 - discR}
        y1={midY - discR}
        x2={width / 2 + discR}
        y2={midY + discR}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const valveButterfly: SymbolDefinition = {
  kind: 'valve-butterfly',
  label: 'Butterfly Valve',
  category: 'Valves',
  defaultWidth: 50,
  defaultHeight: 30,
  tagPrefix: 'V',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 50, y: 15, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ValveButterflyGeometry,
  dexpi: { componentClass: 'ButterflyValve' },
};

export default valveButterfly;

import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Three-way valve — two bowties meeting at a shared central node, with a
 * third branch leaving the top. Ports: common (bottom), branch A (left),
 * branch B (right).
 */
function Valve3WayGeometry({ width, height }: { width: number; height: number }) {
  const bw = width / 2;
  const bwH = height * 0.62;
  const top = height - bwH;
  const midY = top + bwH / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* left bowtie: left port -> centre */}
      <path d={`M 0 ${top} L ${bw} ${midY} L 0 ${height} Z`} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* right bowtie: centre -> right port */}
      <path
        d={`M ${width} ${top} L ${bw} ${midY} L ${width} ${height} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* third branch stem, up to the top port */}
      <line x1={bw} y1={midY} x2={bw} y2={0} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
    </svg>
  );
}

const valve3Way: SymbolDefinition = {
  kind: 'valve-3way',
  label: 'Three-Way Valve',
  category: 'Valves',
  defaultWidth: 60,
  defaultHeight: 44,
  tagPrefix: 'V',
  ports: [
    { id: 'in', label: 'Common Inlet', x: 0, y: 30, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out-a', label: 'Outlet A', x: 60, y: 30, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'branch', label: 'Branch', x: 30, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
  ],
  Geometry: Valve3WayGeometry,
  dexpi: { componentClass: 'ThreeWayValve' },
};

export default valve3Way;

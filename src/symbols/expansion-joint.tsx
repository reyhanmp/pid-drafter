import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Expansion joint / bellows — a rectangle body with a zig-zag bellows
 * section, drawn inline.
 */
function ExpansionJointGeometry({ width, height }: { width: number; height: number }) {
  const cy = height / 2;
  const bellowsW = width * 0.5;
  const bellowsX = (width - bellowsW) / 2;
  const folds = 4;
  const amp = height * 0.32;
  const pts: string[] = [];
  for (let i = 0; i <= folds * 2; i++) {
    const x = bellowsX + (bellowsW * i) / (folds * 2);
    const y = cy + (i % 2 === 0 ? -amp : amp);
    pts.push(`${x},${y}`);
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* flanges */}
      <line x1={bellowsX} y1={cy - amp - 4} x2={bellowsX} y2={cy + amp + 4} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line
        x1={bellowsX + bellowsW}
        y1={cy - amp - 4}
        x2={bellowsX + bellowsW}
        y2={cy + amp + 4}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.medium}
      />
      {/* bellows */}
      <polyline points={pts.join(' ')} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* stubs */}
      <line x1={0} y1={cy} x2={bellowsX} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={bellowsX + bellowsW} y1={cy} x2={width} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
    </svg>
  );
}

const expansionJoint: SymbolDefinition = {
  kind: 'expansion-joint',
  label: 'Expansion Joint',
  category: 'Piping Accessories',
  defaultWidth: 70,
  defaultHeight: 34,
  tagPrefix: 'EJ',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 17, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 70, y: 17, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ExpansionJointGeometry,
  dexpi: { componentClass: 'ExpansionJoint' },
};

export default expansionJoint;

import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Globe valve — bowtie with a filled circle at the centre. The centre disc
 * is itself painted ink, so a port placed mid-height near the centre would
 * still be conformant; the two ports are the standard inline ends.
 */
function ValveGlobeGeometry({ width, height }: { width: number; height: number }) {
  const midY = height / 2;
  const discR = Math.min(width * 0.14, height * 0.28);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={`M 0 0 L ${width / 2} ${midY} L 0 ${height} Z`} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <path
        d={`M ${width} 0 L ${width / 2} ${midY} L ${width} ${height} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <circle cx={width / 2} cy={midY} r={discR} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
    </svg>
  );
}

const valveGlobe: SymbolDefinition = {
  kind: 'valve-globe',
  label: 'Globe Valve',
  category: 'Valves',
  defaultWidth: 50,
  defaultHeight: 30,
  tagPrefix: 'V',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 15, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 50, y: 15, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ValveGlobeGeometry,
  dexpi: { componentClass: 'GlobeValve' },
};

export default valveGlobe;

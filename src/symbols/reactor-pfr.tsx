import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * PFR (plug-flow / tubular reactor) — horizontal elongated capsule, a
 * notably longer/thinner aspect ratio than vessel-horizontal.tsx to read
 * as a tubular reactor rather than a storage vessel.
 */
function ReactorPfrGeometry({ width, height }: { width: number; height: number }) {
  const capW = Math.min(height / 2, width * 0.06);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M ${capW} 0
            L ${width - capW} 0
            A ${capW} ${height / 2} 0 0 1 ${width - capW} ${height}
            L ${capW} ${height}
            A ${capW} ${height / 2} 0 0 1 ${capW} 0
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
    </svg>
  );
}

const reactorPfr: SymbolDefinition = {
  kind: 'reactor-pfr',
  label: 'PFR (Tubular Reactor)',
  category: 'Reactors',
  defaultWidth: 220,
  defaultHeight: 40,
  tagPrefix: 'R',
  ports: [
    { id: 'inlet', label: 'Inlet', x: 0, y: 20, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'outlet', label: 'Outlet', x: 220, y: 20, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: ReactorPfrGeometry,
  dexpi: { componentClass: 'TubularReactor' },
};

export default reactorPfr;

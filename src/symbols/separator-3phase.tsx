import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Three-phase separator — horizontal vessel with an internal weir and two
 * liquid drawoffs (oil over the weir, water under it).
 */
function Separator3PhaseGeometry({ width, height }: { width: number; height: number }) {
  const capW = Math.min(height / 2, width * 0.18);
  const weirX = width * 0.64;
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
      {/* weir plate */}
      <line x1={weirX} y1={height * 0.45} x2={weirX} y2={height} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* oil/water interface */}
      <line
        x1={capW * 0.6}
        y1={height * 0.62}
        x2={weirX}
        y2={height * 0.62}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
        strokeDasharray="6 4"
      />
    </svg>
  );
}

const separator3Phase: SymbolDefinition = {
  kind: 'separator-3phase',
  label: 'Three-Phase Separator',
  category: 'Vessels',
  defaultWidth: 170,
  defaultHeight: 90,
  tagPrefix: 'V',
  ports: [
    { id: 'inlet', label: 'Wellstream Inlet', x: 0, y: 45, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'gas', label: 'Gas Outlet', x: 85, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'oil', label: 'Oil Outlet', x: 170, y: 45, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'water', label: 'Water Outlet', x: 60, y: 90, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: Separator3PhaseGeometry,
  dexpi: { componentClass: 'ThreePhaseSeparator' },
};

export default separator3Phase;

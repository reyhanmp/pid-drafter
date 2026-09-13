import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Spectacle blind / figure-8 blind — two tangent circles (one open, one
 * blanked) on a common centreline, drawn inline so its ports land on the
 * pipe axis.
 */
function SpectacleBlindGeometry({ width, height }: { width: number; height: number }) {
  const cy = height / 2;
  const r = Math.min(height * 0.4, width * 0.3);
  const openCx = width / 2 - r;
  const closedCx = width / 2 + r;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* open (spectacle) ring */}
      <circle cx={openCx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* blank (blind) disc — filled-in centre dot marks the blank */}
      <circle cx={closedCx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <circle cx={closedCx} cy={cy} r={r * 0.28} fill={STROKE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* stubs out to the declared ports so both nozzles land on ink */}
      <line x1={0} y1={cy} x2={openCx - r} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={closedCx + r} y1={cy} x2={width} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
    </svg>
  );
}

const spectacleBlind: SymbolDefinition = {
  kind: 'spectacle-blind',
  label: 'Spectacle Blind',
  category: 'Piping Accessories',
  defaultWidth: 60,
  defaultHeight: 34,
  tagPrefix: 'SB',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 17, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 60, y: 17, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: SpectacleBlindGeometry,
  dexpi: { componentClass: 'SpectacleBlind' },
};

export default spectacleBlind;

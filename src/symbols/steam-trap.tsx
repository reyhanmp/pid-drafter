import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Steam trap — small body with a trap glyph (bowl + inverted bucket). Drawn
 * inline on the condensate line, with a second port for the motive/vent leg.
 */
function SteamTrapGeometry({ width, height }: { width: number; height: number }) {
  const cy = height / 2;
  const bodyR = Math.min(height * 0.36, width * 0.3);
  const cx = width / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* trap body */}
      <circle cx={cx} cy={cy} r={bodyR} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* inverted bucket glyph */}
      <path
        d={`M ${cx - bodyR * 0.6} ${cy + bodyR * 0.3} L ${cx - bodyR * 0.6} ${cy - bodyR * 0.3} L ${cx + bodyR * 0.6} ${cy - bodyR * 0.3} L ${cx + bodyR * 0.6} ${cy + bodyR * 0.3}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* stubs to the inline ports */}
      <line x1={0} y1={cy} x2={cx - bodyR} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={cx + bodyR} y1={cy} x2={width} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
    </svg>
  );
}

const steamTrap: SymbolDefinition = {
  kind: 'steam-trap',
  label: 'Steam Trap',
  category: 'Piping Accessories',
  defaultWidth: 60,
  defaultHeight: 40,
  tagPrefix: 'ST',
  ports: [
    { id: 'in', label: 'Condensate In', x: 0, y: 20, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Discharge', x: 60, y: 20, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: SteamTrapGeometry,
  dexpi: { componentClass: 'SteamTrap' },
};

export default steamTrap;

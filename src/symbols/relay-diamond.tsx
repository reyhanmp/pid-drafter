import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Diamond relay/solenoid-pilot symbol (XY-type) — hollow diamond with 2-letter tag, signal-only. */
function RelayDiamondGeometry({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M ${cx} 0 L ${width} ${cy} L ${cx} ${height} L 0 ${cy} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <text x={cx} y={cy + 4} fontSize={11} textAnchor="middle" fontFamily="monospace" fill={STROKE}>
        XY
      </text>
    </svg>
  );
}

const relayDiamond: SymbolDefinition = {
  kind: 'relay-diamond',
  label: 'Relay / Solenoid Pilot (XY)',
  category: 'Signal & Logic',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'XY',
  ports: [
    { id: 'signal', label: 'Signal Leader', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: RelayDiamondGeometry,
  dexpi: { componentClass: 'RelayFunction' },
};

export default relayDiamond;

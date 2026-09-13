import type { SymbolDefinition, SymbolGeometryProps } from './types';
import { IsaBubbleGlyph } from './isaBubble';

/** Diamond relay/solenoid-pilot symbol (XY-type) — hollow diamond with 2-letter tag, signal-only. */
function RelayDiamondGeometry({ width, height, label }: SymbolGeometryProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <IsaBubbleGlyph
        width={width}
        height={height}
        tag={label}
        fallbackCode="XY"
        sharedDisplay={false}
        square={true}
      />
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

import type { SymbolDefinition, SymbolGeometryProps } from './types';
import { IsaBubbleGlyph } from './isaBubble';

/** Level Transmitter (LT) — ISA-5.1 instrument bubble, field-mounted (plain circle). */
function TransmitterLevelGeometry({ width, height, label }: SymbolGeometryProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <IsaBubbleGlyph
        width={width}
        height={height}
        tag={label}
        fallbackCode="LT"
        sharedDisplay={false}
        square={false}
      />
    </svg>
  );
}
const transmitterLevel: SymbolDefinition = {
  kind: 'transmitter-level',
  label: 'Level Transmitter (LT)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'LT',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: TransmitterLevelGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default transmitterLevel;

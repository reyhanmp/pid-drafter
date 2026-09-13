import type { SymbolDefinition, SymbolGeometryProps } from './types';
import { IsaBubbleGlyph } from './isaBubble';

/** Flow Transmitter (FT) — ISA-5.1 instrument bubble, field-mounted (plain circle). */
function TransmitterFlowGeometry({ width, height, label }: SymbolGeometryProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <IsaBubbleGlyph
        width={width}
        height={height}
        tag={label}
        fallbackCode="FT"
        sharedDisplay={false}
        square={false}
      />
    </svg>
  );
}
const transmitterFlow: SymbolDefinition = {
  kind: 'transmitter-flow',
  label: 'Flow Transmitter (FT)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'FT',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: TransmitterFlowGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default transmitterFlow;

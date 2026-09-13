import type { SymbolDefinition, SymbolGeometryProps } from './types';
import { IsaBubbleGlyph } from './isaBubble';

/** Temperature Transmitter (TT) — ISA-5.1 instrument bubble, field-mounted (plain circle). */
function TransmitterTempGeometry({ width, height, label }: SymbolGeometryProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <IsaBubbleGlyph
        width={width}
        height={height}
        tag={label}
        fallbackCode="TT"
        sharedDisplay={false}
        square={false}
      />
    </svg>
  );
}
const transmitterTemp: SymbolDefinition = {
  kind: 'transmitter-temp',
  label: 'Temperature Transmitter (TT)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'TT',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: TransmitterTempGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default transmitterTemp;

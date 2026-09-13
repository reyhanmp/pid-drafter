import type { SymbolDefinition, SymbolGeometryProps } from './types';
import { IsaBubbleGlyph } from './isaBubble';

/** Pressure Transmitter (PT) — ISA-5.1 instrument bubble, field-mounted (plain circle). */
function TransmitterPressureGeometry({ width, height, label }: SymbolGeometryProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <IsaBubbleGlyph
        width={width}
        height={height}
        tag={label}
        fallbackCode="PT"
        sharedDisplay={false}
        square={false}
      />
    </svg>
  );
}
const transmitterPressure: SymbolDefinition = {
  kind: 'transmitter-pressure',
  label: 'Pressure Transmitter (PT)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'PT',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: TransmitterPressureGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default transmitterPressure;

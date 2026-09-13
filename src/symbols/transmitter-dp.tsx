import type { SymbolDefinition, SymbolGeometryProps } from './types';
import { IsaBubbleGlyph } from './isaBubble';

/** Differential-Pressure Transmitter (PDT) — ISA-5.1 instrument bubble, field-mounted (plain circle). */
function TransmitterDpGeometry({ width, height, label }: SymbolGeometryProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <IsaBubbleGlyph
        width={width}
        height={height}
        tag={label}
        fallbackCode="PDT"
        sharedDisplay={false}
        square={false}
      />
    </svg>
  );
}
const transmitterDp: SymbolDefinition = {
  kind: 'transmitter-dp',
  label: 'Differential-Pressure Transmitter (PDT)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'PDT',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: TransmitterDpGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default transmitterDp;

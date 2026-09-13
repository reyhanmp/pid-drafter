import type { SymbolDefinition, SymbolGeometryProps } from './types';
import { IsaBubbleGlyph } from './isaBubble';

/** Local Indicator (PI) — ISA-5.1 instrument bubble, field-mounted (plain circle). */
function IndicatorLocalGeometry({ width, height, label }: SymbolGeometryProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <IsaBubbleGlyph
        width={width}
        height={height}
        tag={label}
        fallbackCode="PI"
        sharedDisplay={false}
        square={false}
      />
    </svg>
  );
}
const indicatorLocal: SymbolDefinition = {
  kind: 'indicator-local',
  label: 'Local Indicator (PI)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'PI',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: IndicatorLocalGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default indicatorLocal;

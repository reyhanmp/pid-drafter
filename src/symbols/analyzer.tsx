import type { SymbolDefinition, SymbolGeometryProps } from './types';
import { IsaBubbleGlyph } from './isaBubble';

/** Process Analyzer (AT) — ISA-5.1 instrument bubble, field-mounted (plain circle). */
function AnalyzerGeometry({ width, height, label }: SymbolGeometryProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <IsaBubbleGlyph
        width={width}
        height={height}
        tag={label}
        fallbackCode="AT"
        sharedDisplay={false}
        square={false}
      />
    </svg>
  );
}
const analyzer: SymbolDefinition = {
  kind: 'analyzer',
  label: 'Process Analyzer (AT)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'AT',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: AnalyzerGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default analyzer;

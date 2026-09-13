import type { SymbolDefinition, SymbolGeometryProps } from './types';
import { IsaBubbleGlyph } from './isaBubble';

/** DCS Controller (shared display) — ISA-5.1 instrument bubble, shared-display/DCS (with divider). */
function ControllerDcsGeometry({ width, height, label }: SymbolGeometryProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <IsaBubbleGlyph
        width={width}
        height={height}
        tag={label}
        fallbackCode="FIC"
        sharedDisplay={true}
        square={false}
      />
    </svg>
  );
}
const controllerDcs: SymbolDefinition = {
  kind: 'controller-dcs',
  label: 'DCS Controller (shared display)',
  category: 'Instruments',
  defaultWidth: 56,
  defaultHeight: 56,
  tagPrefix: 'FIC',
  ports: [
    { id: 'signal', label: 'Signal', x: 28, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: ControllerDcsGeometry,
  dexpi: { componentClass: 'ProcessInstrument' },
};

export default controllerDcs;

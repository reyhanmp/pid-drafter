import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Storage tank, floating roof — cylindrical shell with the roof deck drawn
 * as a line that rides on the product, plus a rim seal gap at the shell.
 */
function StorageTankFloatingRoofGeometry({ width, height }: { width: number; height: number }) {
  const deckY = height * 0.16;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
      {/* floating roof deck */}
      <line x1={0} y1={deckY} x2={width} y2={deckY} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* rim seal, drawn as short ticks just below the deck */}
      <line x1={0} y1={deckY + 6} x2={width * 0.08} y2={deckY + 6} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line
        x1={width * 0.92}
        y1={deckY + 6}
        x2={width}
        y2={deckY + 6}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const storageTankFloatingRoof: SymbolDefinition = {
  kind: 'storage-tank-floating-roof',
  label: 'Storage Tank (Floating Roof)',
  category: 'Vessels',
  defaultWidth: 110,
  defaultHeight: 150,
  tagPrefix: 'TK',
  ports: [
    { id: 'top', label: 'Rim Vent', x: 55, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'bottom', label: 'Bottom Outlet', x: 55, y: 150, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'left', label: 'Side Nozzle (L)', x: 0, y: 100, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'right', label: 'Side Nozzle (R)', x: 110, y: 100, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: StorageTankFloatingRoofGeometry,
  dexpi: { componentClass: 'Tank' },
};

export default storageTankFloatingRoof;

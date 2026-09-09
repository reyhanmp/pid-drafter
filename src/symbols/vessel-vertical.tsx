import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Vertical process vessel — dome top/bottom, heaviest line on the canvas. */
function VesselVerticalGeometry({ width, height }: { width: number; height: number }) {
  const capH = Math.min(width / 2, height * 0.18);
  const bodyTop = capH;
  const bodyBottom = height - capH;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M 0 ${bodyTop}
            A ${width / 2} ${capH} 0 0 1 ${width} ${bodyTop}
            L ${width} ${bodyBottom}
            A ${width / 2} ${capH} 0 0 1 0 ${bodyBottom}
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
    </svg>
  );
}

const vesselVertical: SymbolDefinition = {
  kind: 'vessel-vertical',
  label: 'Vertical Vessel',
  category: 'Vessels',
  defaultWidth: 90,
  defaultHeight: 180,
  tagPrefix: 'V',
  ports: [
    { id: 'top', label: 'Top Nozzle', x: 45, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'bottom', label: 'Bottom Drain', x: 45, y: 180, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'left', label: 'Side Nozzle (L)', x: 0, y: 90, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'right', label: 'Side Nozzle (R)', x: 90, y: 90, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: VesselVerticalGeometry,
  dexpi: { componentClass: 'Column' },
};

export default vesselVertical;

import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Horizontal process vessel — long rectangle with semicircular end caps. */
function VesselHorizontalGeometry({ width, height }: { width: number; height: number }) {
  const capW = Math.min(height / 2, width * 0.18);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M ${capW} 0
            L ${width - capW} 0
            A ${capW} ${height / 2} 0 0 1 ${width - capW} ${height}
            L ${capW} ${height}
            A ${capW} ${height / 2} 0 0 1 ${capW} 0
            Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.heavy}
      />
    </svg>
  );
}

const vesselHorizontal: SymbolDefinition = {
  kind: 'vessel-horizontal',
  label: 'Horizontal Vessel',
  category: 'Vessels',
  defaultWidth: 180,
  defaultHeight: 90,
  tagPrefix: 'V',
  ports: [
    { id: 'left', label: 'Inlet', x: 0, y: 45, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'right', label: 'Outlet', x: 180, y: 45, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'top', label: 'Top Nozzle', x: 90, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'bottom', label: 'Bottom Drain', x: 90, y: 90, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  Geometry: VesselHorizontalGeometry,
  dexpi: { componentClass: 'Tank' },
};

export default vesselHorizontal;

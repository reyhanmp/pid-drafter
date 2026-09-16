import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Storage tank, cone roof — open-cone roof on a straight cylindrical shell. */
function StorageTankConeRoofGeometry({ width, height }: { width: number; height: number }) {
  const roofH = height * 0.18;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M 0 ${roofH} L ${width / 2} 0 L ${width} ${roofH}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.equipment}
      />
      <rect
        x={0}
        y={roofH}
        width={width}
        height={height - roofH}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.equipment}
      />
      {/* product level line, deliberately not an outline */}
      <line
        x1={width * 0.12}
        y1={roofH + (height - roofH) * 0.55}
        x2={width * 0.88}
        y2={roofH + (height - roofH) * 0.55}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
        strokeDasharray="6 4"
      />
    </svg>
  );
}

const storageTankConeRoof: SymbolDefinition = {
  kind: 'storage-tank-cone-roof',
  label: 'Storage Tank (Cone Roof)',
  category: 'Vessels',
  defaultWidth: 110,
  defaultHeight: 150,
  tagPrefix: 'TK',
  ports: [
    { id: 'top', label: 'Roof Vent', x: 55, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
    { id: 'bottom', label: 'Bottom Outlet', x: 55, y: 150, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'left', label: 'Side Nozzle (L)', x: 0, y: 100, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'right', label: 'Side Nozzle (R)', x: 110, y: 100, direction: { x: 1, y: 0 }, kind: 'process' },
  ],
  Geometry: StorageTankConeRoofGeometry,
  dexpi: { componentClass: 'Tank' },
};

export default storageTankConeRoof;

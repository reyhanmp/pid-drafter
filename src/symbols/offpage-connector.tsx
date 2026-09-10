import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Off-page/tie-in connector — stadium/pill shape (rounded rect), single port, ref-tag text area. */
function OffpageConnectorGeometry({ width, height }: { width: number; height: number }) {
  const inset = LINE_WEIGHT.thin;
  const r = (height - inset * 2) / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={inset}
        y={inset}
        width={width - inset * 2}
        height={height - inset * 2}
        rx={r}
        ry={r}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <text x={width / 2} y={height / 2 + 4} fontSize={9} textAnchor="middle" fontFamily="monospace" fill={STROKE}>
        REF
      </text>
    </svg>
  );
}

const offpageConnector: SymbolDefinition = {
  kind: 'offpage-connector',
  label: 'Off-Page / Tie-In Connector',
  category: 'Terminators',
  defaultWidth: 56,
  defaultHeight: 28,
  tagPrefix: 'OPC',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 14, direction: { x: -1, y: 0 }, kind: 'process' },
  ],
  Geometry: OffpageConnectorGeometry,
  dexpi: { componentClass: 'OffPageConnector' },
};

export default offpageConnector;

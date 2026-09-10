import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Solenoid-operated valve — hollow bowtie body with a small square "S"
 * actuator box above, connected by a short stem line. Distinct from the
 * pneumatic diaphragm control valve (valve-control.tsx).
 */
function ValveSolenoidGeometry({ width, height }: { width: number; height: number }) {
  const bowtieH = height * 0.4;
  const bowtieY = height - bowtieH;
  const midY = bowtieY + bowtieH / 2;
  const cx = width / 2;
  const boxSize = 15;
  const stemTopY = bowtieY * 0.55;
  const boxY = stemTopY - boxSize;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={`M 0 ${bowtieY} L ${cx} ${midY} L 0 ${bowtieY + bowtieH} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <path
        d={`M ${width} ${bowtieY} L ${cx} ${midY} L ${width} ${bowtieY + bowtieH} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* stem */}
      <line x1={cx} y1={midY} x2={cx} y2={stemTopY} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* solenoid box */}
      <rect
        x={cx - boxSize / 2}
        y={boxY}
        width={boxSize}
        height={boxSize}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <text x={cx} y={boxY + boxSize / 2 + 3} fontSize={10} textAnchor="middle" fontFamily="monospace" fill={STROKE}>
        S
      </text>
    </svg>
  );
}

const valveSolenoid: SymbolDefinition = {
  kind: 'valve-solenoid',
  label: 'Solenoid Valve',
  category: 'Valves',
  defaultWidth: 50,
  defaultHeight: 55,
  tagPrefix: 'SV',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 44, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 50, y: 44, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'signal', label: 'Electrical Signal', x: 25, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: ValveSolenoidGeometry,
  dexpi: { componentClass: 'SolenoidValve' },
};

export default valveSolenoid;

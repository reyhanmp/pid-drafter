import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Control valve — bowtie + actuator stem + actuator (diaphragm) symbol
 * on top, with a dashed signal-line port on the actuator for the
 * controlling instrument.
 */
function ValveControlGeometry({ width, height }: { width: number; height: number }) {
  const bowtieH = height * 0.4;
  const bowtieY = height - bowtieH;
  const midY = bowtieY + bowtieH / 2;
  const actuatorR = width * 0.16;
  // Actuator circle must sit fully INSIDE the 60x70 box, with its top on
  // y=0 — the `signal` port is declared at (30,0) and must land on the
  // actuator outline, not in empty space. Previously cy was negative
  // (stemTopY - actuatorR*0.6 with a short stem), so the top third of
  // the circle was drawn off-canvas and the signal nozzle floated.
  const actuatorCy = actuatorR;
  const stemTopY = actuatorCy + actuatorR;
  const cx = width / 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* bowtie body */}
      <path
        d={`M 0 ${bowtieY} L ${width / 2} ${midY} L 0 ${bowtieY + bowtieH} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <path
        d={`M ${width} ${bowtieY} L ${width / 2} ${midY} L ${width} ${bowtieY + bowtieH} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* actuator stem, from the bowtie up to the diaphragm circle */}
      <line x1={cx} y1={midY} x2={cx} y2={stemTopY} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* actuator (diaphragm) circle — top tangent to y=0 */}
      <circle
        cx={cx}
        cy={actuatorCy}
        r={actuatorR}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
    </svg>
  );
}

const valveControl: SymbolDefinition = {
  kind: 'valve-control',
  label: 'Control Valve',
  category: 'Valves',
  defaultWidth: 60,
  defaultHeight: 70,
  tagPrefix: 'FCV',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 56, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 60, y: 56, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'signal', label: 'Actuator Signal', x: 30, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: ValveControlGeometry,
  dexpi: { componentClass: 'ControlValve' },
};

export default valveControl;

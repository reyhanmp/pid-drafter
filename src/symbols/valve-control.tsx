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
  const stemTopY = bowtieH * 0.35;
  const actuatorR = width * 0.28;
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
      {/* actuator stem */}
      <line x1={cx} y1={midY} x2={cx} y2={stemTopY} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* actuator (diaphragm) circle */}
      <circle
        cx={cx}
        cy={stemTopY - actuatorR * 0.6}
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

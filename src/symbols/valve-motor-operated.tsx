import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Motor-operated valve (MOV) — bowtie with a motor block (M) on a stem,
 * plus a signal port on the block for the command/status line.
 */
function ValveMotorOperatedGeometry({ width, height }: { width: number; height: number }) {
  const bowtieH = height * 0.45;
  const bowtieY = height - bowtieH;
  const midY = bowtieY + bowtieH / 2;
  const cx = width / 2;
  const motorH = Math.min(bowtieY, height * 0.3);
  const motorW = width * 0.44;
  const motorY = bowtieY - motorH * 0.9;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={`M 0 ${bowtieY} L ${cx} ${midY} L 0 ${bowtieY + bowtieH} Z`} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <path
        d={`M ${width} ${bowtieY} L ${cx} ${midY} L ${width} ${bowtieY + bowtieH} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* stem up to the motor block */}
      <line x1={cx} y1={midY} x2={cx} y2={motorY + motorH} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* motor block, top face on y=0 so the signal port lands on ink */}
      <rect
        x={cx - motorW / 2}
        y={0}
        width={motorW}
        height={motorH}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <text x={cx} y={motorH * 0.5 + 4} fontSize={11} textAnchor="middle" fontFamily="monospace" fill={STROKE}>
        M
      </text>
    </svg>
  );
}

const valveMotorOperated: SymbolDefinition = {
  kind: 'valve-motor-operated',
  label: 'Motor-Operated Valve',
  category: 'Valves',
  defaultWidth: 60,
  defaultHeight: 70,
  tagPrefix: 'V',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 54, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'out', label: 'Outlet', x: 60, y: 54, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'signal', label: 'Command Signal', x: 30, y: 0, direction: { x: 0, y: -1 }, kind: 'signal' },
  ],
  Geometry: ValveMotorOperatedGeometry,
  dexpi: { componentClass: 'MotorOperatedValve' },
};

export default valveMotorOperated;

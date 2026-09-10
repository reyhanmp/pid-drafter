import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Pressure/relief safety valve (PSV) — vertical arrangement: branch inlet
 * at bottom -> hollow bowtie body -> small spring-bonnet rectangle (with
 * zigzag spring indication) -> open vent stub at top (no cap, discharges
 * to atmosphere/flare).
 */
function ValveReliefGeometry({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const bowtieH = height * 0.34;
  const bowtieY = height - bowtieH;
  const midX = cx;
  const bonnetH = height * 0.18;
  const bonnetW = width * 0.5;
  const bonnetY = bowtieY - bonnetH;
  const stemTopY = bonnetY * 0.15;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* bowtie body (hollow) */}
      <path
        d={`M ${cx - width / 2} ${bowtieY} L ${midX} ${bowtieY + bowtieH / 2} L ${cx - width / 2} ${bowtieY + bowtieH} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      <path
        d={`M ${cx + width / 2} ${bowtieY} L ${midX} ${bowtieY + bowtieH / 2} L ${cx + width / 2} ${bowtieY + bowtieH} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* spring-bonnet rectangle */}
      <rect
        x={cx - bonnetW / 2}
        y={bonnetY}
        width={bonnetW}
        height={bonnetH}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* zigzag spring indication inside bonnet */}
      <polyline
        points={`${cx - bonnetW / 4} ${bonnetY + bonnetH} ${cx + bonnetW / 4} ${bonnetY + bonnetH * 0.6} ${cx - bonnetW / 4} ${bonnetY + bonnetH * 0.2} ${cx + bonnetW / 4} ${bonnetY}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={1}
      />
      {/* open vent stub going up, no cap */}
      <line x1={cx} y1={bonnetY} x2={cx} y2={stemTopY} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
    </svg>
  );
}

const valveRelief: SymbolDefinition = {
  kind: 'valve-relief',
  label: 'Relief Valve (PSV)',
  category: 'Valves',
  defaultWidth: 40,
  defaultHeight: 70,
  tagPrefix: 'PSV',
  ports: [
    { id: 'in', label: 'Branch Inlet', x: 20, y: 70, direction: { x: 0, y: 1 }, kind: 'process' },
    { id: 'vent', label: 'Vent Outlet', x: 20, y: 0, direction: { x: 0, y: -1 }, kind: 'process' },
  ],
  Geometry: ValveReliefGeometry,
  dexpi: { componentClass: 'SafetyValve' },
};

export default valveRelief;

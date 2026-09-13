import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Pipe support — a DRAWING ANNOTATION, not equipment: it has ZERO ports on
 * purpose, so it can never be wired into a pipe. Its place in the palette is
 * to mark a support point on a run, the same way draw.io ships non-connectable
 * stencils. The validity engine has no isolated-node rule, so a zero-port node
 * is legal and reports no error.
 */
function PipeSupportGeometry({ width, height }: { width: number; height: number }) {
  const stemTop = height * 0.25;
  const capW = width * 0.5;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* pipe centreline being supported */}
      <line x1={0} y1={stemTop} x2={width} y2={stemTop} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      {/* support cap */}
      <path
        d={`M ${width / 2 - capW / 2} ${stemTop} L ${width / 2 - capW / 2} ${stemTop + height * 0.14} L ${width / 2 + capW / 2} ${stemTop + height * 0.14} L ${width / 2 + capW / 2} ${stemTop} Z`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={LINE_WEIGHT.thin}
      />
      {/* stem down to the structure line */}
      <line x1={width / 2} y1={stemTop + height * 0.14} x2={width / 2} y2={height * 0.8} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      {/* hatching to ground */}
      <line x1={width * 0.15} y1={height * 0.8} x2={width * 0.85} y2={height * 0.8} stroke={STROKE} strokeWidth={LINE_WEIGHT.medium} />
      <line x1={width * 0.15} y1={height * 0.8} x2={width * 0.25} y2={height} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={width * 0.4} y1={height * 0.8} x2={width * 0.5} y2={height} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      <line x1={width * 0.65} y1={height * 0.8} x2={width * 0.75} y2={height} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
    </svg>
  );
}

const pipeSupport: SymbolDefinition = {
  kind: 'pipe-support',
  label: 'Pipe Support (annotation)',
  category: 'Piping Accessories',
  defaultWidth: 50,
  defaultHeight: 50,
  tagPrefix: 'PS',
  ports: [],
  Geometry: PipeSupportGeometry,
  dexpi: { componentClass: 'PipeSupport' },
};

export default pipeSupport;

import type { SymbolDefinition } from './types';

/**
 * Tee / branch fitting — a plain elbow is not enough. The most ordinary
 * arrangement in process piping is a header with a branch off it, and before
 * this symbol the library could not draw one: every one of the other 67
 * symbols is a device that BEGINS or ENDS a run (an inline accessory with two
 * opposed ports) or equipment with distinct nozzles. A tee is the one fitting
 * whose whole purpose is to let one line become two.
 *
 * Geometry is the standard P&ID butt-weld tee: a straight run through the
 * shape plus a branch stub normal to it, all drawn at the centreline so the
 * shape's own ink carries the run through the body. The run is drawn as two
 * lines rather than one so that the branch junction is visibly a junction
 * (three strokes meeting at one point) rather than a line with a tick on it.
 *
 * Size is written as literals, not a constant, to match the other 67 modules —
 * see the note on `defaultWidth` below.
 */
function TeeBranchGeometry({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* straight run, left to right, on the horizontal centreline */}
      <line x1={0} y1={cy} x2={cx} y2={cy} stroke="#1a1a1a" strokeWidth={1.25} />
      <line x1={cx} y1={cy} x2={width} y2={cy} stroke="#1a1a1a" strokeWidth={1.25} />
      {/* branch stub, bottom centre */}
      <line x1={cx} y1={cy} x2={cx} y2={height} stroke="#1a1a1a" strokeWidth={1.25} />
      {/*
        A plain cross reads as a crossing, not a branch, so the branch is
        marked the way P&IDs mark a fitting: a small filled welding dot at the
        junction. This is the one piece of non-stroke ink in the symbol, and
        without it a reader cannot tell this shape from two pipes crossing.
      */}
      <circle cx={cx} cy={cy} r={2.5} fill="#1a1a1a" stroke="none" />
    </svg>
  );
}

const teeBranch: SymbolDefinition = {
  kind: 'tee-branch',
  label: 'Tee / Branch Fitting',
  category: 'Piping Accessories',
  /*
   * Literal numbers, NOT a shared `const SIZE = 24`. `verify-port-outline.cjs`
   * reads every symbol's default size out of its source with a regex to
   * convert screen measurements back to node-local units — a symbol that
   * computes its size defeats that reader, and the failure it produces is a
   * bogus "port floats 28px off the ink" rather than "couldn't read this
   * symbol's size". The runner now also refuses to guess (see
   * scripts/verify-port-outline.cjs), but writing the literals keeps this
   * module identical in shape to the other 67.
   */
  defaultWidth: 24,
  defaultHeight: 24,
  tagPrefix: 'TEE',
  ports: [
    { id: 'run-in', label: 'Run Inlet', x: 0, y: 12, direction: { x: -1, y: 0 }, kind: 'process' },
    { id: 'run-out', label: 'Run Outlet', x: 24, y: 12, direction: { x: 1, y: 0 }, kind: 'process' },
    { id: 'branch', label: 'Branch', x: 12, y: 24, direction: { x: 0, y: 1 }, kind: 'process' },
  ],
  /**
   * A tee is the ONLY symbol in the library that may carry more than one pipe
   * on a single port — its run-in and run-out are headers, and a header with
   * branches is the arrangement this symbol exists to make drawable (PRD §7a
   * item 2). Every other symbol's nozzles are single-connection by definition
   * (PRD §7a item 1), enforced in src/validation/connectionRules.ts.
   */
  multiBranchPorts: ['run-in', 'run-out'],
  /**
   * The branch outlet (PRD §7a item 8): the pipe leaving here exists only
   * because the run split, so it is secondary piping and draws at medium
   * weight while the run-in/run-out header pipes draw heavy. This is the one
   * declaration in the library that makes §6's tier-2 line weight real.
   */
  branchPorts: ['branch'],
  Geometry: TeeBranchGeometry,
  dexpi: { componentClass: 'Tee' },
};

export default teeBranch;

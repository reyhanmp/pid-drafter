const fs = require('fs');
const path = require('path');

/**
 * FIXTURE — proves the port-outline gate has teeth, and proves it does not
 * lie about geometry.
 *
 * Two things are loaded here that the published repo must never contain:
 *
 *   1. A symbol module whose `defaultWidth` is a COMPUTED expression rather
 *      than a literal. `verify-port-outline.cjs` reads each symbol's size out
 *      of its source with a regex; that read silently yields undefined for a
 *      computed size, which puts every port "28px off the ink" and looks like
 *      a real geometry defect. This fixture pins that behaviour so the runner
 *      can be made to FAIL LOUDLY on an unreadable size instead of blaming the
 *      drawing.
 *   2. (removed — see git history)
 *
 * Kept out of the tree by .gitignore: it exists only to be run by hand.
 */
const REPO = path.resolve(__dirname, '..');

const FIXTURE_KIND = 'zz-size-probe';

const FIXTURE_SRC = `import type { SymbolDefinition } from './types';

function ZzSizeProbeGeometry({ width, height }: { width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox={\`0 0 \${width} \${height}\`}>
      <rect x={0} y={0} width={width} height={height} fill="none" stroke="#1a1a1a" strokeWidth={2} />
    </svg>
  );
}

// Deliberately computed, not literal: the port-outline runner reads sizes by
// regex and must not silently confuse "I could not read this" with "this
// symbol's ports are wrong".
const SIZE = 40;

const zzSizeProbe: SymbolDefinition = {
  kind: 'zz-size-probe',
  label: 'Size Probe (fixture)',
  category: 'Piping Accessories',
  defaultWidth: SIZE,
  defaultHeight: SIZE,
  tagPrefix: 'ZZ',
  ports: [{ id: 'in', label: 'In', x: 0, y: SIZE / 2, direction: { x: -1, y: 0 }, kind: 'process' }],
  Geometry: ZzSizeProbeGeometry,
  dexpi: { componentClass: 'Fixture' },
};

export default zzSizeProbe;
`;

const IMP = `import zzSizeProbe from './zz-size-probe';\n`;

function withFixture() {
  fs.writeFileSync(path.join(REPO, 'src/symbols', `${FIXTURE_KIND}.tsx`), FIXTURE_SRC);
  const idxPath = path.join(REPO, 'src/symbols/index.ts');
  let src = fs.readFileSync(idxPath, 'utf8');
  if (!src.includes(IMP)) src = src.replace("import vesselVertical from './vessel-vertical';\n", `import vesselVertical from './vessel-vertical';\n${IMP}`);
  if (!src.includes('  zzSizeProbe,\n')) src = src.replace('export const allSymbols: SymbolDefinition[] = [\n', 'export const allSymbols: SymbolDefinition[] = [\n  zzSizeProbe,\n');
  fs.writeFileSync(idxPath, src);
  return { idxPath, idxBackup: src };
}

function cleanup() {
  const f = path.join(REPO, 'src/symbols', `${FIXTURE_KIND}.tsx`);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  const idxPath = path.join(REPO, 'src/symbols/index.ts');
  let src = fs.readFileSync(idxPath, 'utf8');
  src = src.replace(IMP, '').replace('  zzSizeProbe,\n', '');
  src = src.replace('  zzSizeProbe,\n', '');
  fs.writeFileSync(idxPath, src);
}

module.exports = { withFixture, cleanup, FIXTURE_KIND };

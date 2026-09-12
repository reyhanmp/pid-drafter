import type { SymbolDefinition } from './types';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/**
 * Off-page/tie-in connector — stadium/pill shape (rounded rect), single
 * port, resolved target text (PRD §4.8).
 *
 * The `label` prop carries the RESOLVED reference computed from project
 * data (see src/validation/offpageReferences.ts), e.g. "TO SH.2 TT-101".
 * When no target has been chosen the neutral placeholder "REF" is drawn,
 * matching the original glyph. Font size shrinks so a long reference such
 * as 'TO SH.3 1½"-LPS2-710.01' still fits inside the pill.
 */
function OffpageConnectorGeometry({ width, height, label }: { width: number; height: number; label?: string }) {
  const inset = LINE_WEIGHT.thin;
  const r = (height - inset * 2) / 2;
  const text = label ?? 'REF';
  const usable = Math.max(20, width - inset * 2 - 6);
  // ~0.62em average advance width for monospace at this size.
  const fontSize = Math.max(6, Math.min(9, usable / (text.length * 0.62)));
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
      <text
        x={width / 2}
        y={height / 2 + fontSize / 3}
        fontSize={fontSize}
        textAnchor="middle"
        fontFamily="monospace"
        fill={STROKE}
        data-testid="offpage-label"
      >
        {text}
      </text>
    </svg>
  );
}

const offpageConnector: SymbolDefinition = {
  kind: 'offpage-connector',
  label: 'Off-Page / Tie-In Connector',
  category: 'Terminators',
  defaultWidth: 104,
  defaultHeight: 32,
  tagPrefix: 'OPC',
  ports: [
    { id: 'in', label: 'Inlet', x: 0, y: 16, direction: { x: -1, y: 0 }, kind: 'process' },
  ],
  Geometry: OffpageConnectorGeometry,
  dexpi: { componentClass: 'OffPageConnector' },
};

export default offpageConnector;

/**
 * Shared ISA-5.1 instrument-bubble rendering.
 *
 * WHY THIS EXISTS: the instrument symbols were each drawing their own letters
 * from a hardcoded string in the geometry (`FIC`, `PI`, `XY`, `TT`, ...). A
 * real ISA-5.1 bubble carries the FUNCTION CODE of the loop it belongs to, and
 * the same symbol is used for every loop of that shape — a DCS controller is a
 * DCS controller whether it is a flow controller or a level controller. The
 * hardcoded letter meant a controller tagged `LIC-710.3` drew `FIC` inside its
 * bubble, so the drawing showed two different tags for one instrument. That is
 * simply a wrong P&ID, not a cosmetic issue.
 *
 * So the bubble reads its letters from the node's actual tag through
 * `SymbolGeometryProps.label` (which EquipmentNode passes as `__resolvedLabel`,
 * and which the tag-strip pipeline keeps in sync with `data.tag` in App.tsx).
 * The symbol's own `tagPrefix` is only a FALLBACK for an untagged instrument,
 * which is what the palette needs to draw a representative glyph.
 *
 * ISA-5.1 layout, as drawn on the reference drawing (X-00000-000-01):
 *
 *     ┌─────────┐        function code      (e.g. TIC)
 *     │   TIC   │  ———   ─────────────────  (divider)
 *     │  710.1  │        loop number        (e.g. 710.1)
 *     └─────────┘
 *
 * The divider is only drawn for SHARED-DISPLAY / DCS bubbles, where ISA-5.1
 * uses it to mean "function accessible to the operator from a shared display".
 * A field-mounted transmitter (TT) or a local indicator (PI) is a plain circle
 * with the whole tag inside, no divider.
 *
 * Squares are used for discrete / logic functions (relays, solenoids, switches)
 * — that is the ISA-5.1 shape convention, not a stylistic choice.
 */
import type { ReactElement } from 'react';
import { LINE_WEIGHT, STROKE, FILL_NONE } from './style';

/** Split a tag like `TIC-710.1A` into its function code and loop number. */
export function splitTagForBubble(tag: string): { functionCode: string; loopNumber: string } {
  const raw = (tag ?? '').trim();
  if (!raw) return { functionCode: '', loopNumber: '' };
  // Function code = leading letters; everything after the first separator
  // (dash, space, or the first digit) is the loop identification.
  const m = /^([A-Za-z]+)\s*[-–]?\s*(.*)$/.exec(raw);
  if (!m) return { functionCode: '', loopNumber: '' };
  return { functionCode: m[1].toUpperCase(), loopNumber: m[2] };
}

export interface IsaBubbleProps {
  width: number;
  height: number;
  /** The node's actual tag. Falls back to `fallbackCode` when absent. */
  tag?: string;
  /** The symbol's own default code, used only when the node is untagged. */
  fallbackCode: string;
  /** Shared-display / DCS bubble: function above, loop number below a divider. */
  sharedDisplay?: boolean;
  /** Square (discrete/logic) instead of circle. */
  square?: boolean;
}

/**
 * Draw an ISA-5.1 bubble. Returns the SVG children so a symbol can wrap them
 * in its own `<svg>` with its own sizing/viewBox convention — every symbol in
 * this library sizes its `<svg>` exactly to the node box with a matching
 * viewBox, and the outline gate (`scripts/verify-port-outline.cjs`) depends on
 * that staying true.
 */
export function IsaBubbleGlyph({
  width,
  height,
  tag,
  fallbackCode,
  sharedDisplay = false,
  square = false,
}: IsaBubbleProps): ReactElement {
  const cx = width / 2;
  const cy = height / 2;
  const inset = LINE_WEIGHT.thin;
  const r = Math.min(width, height) / 2 - inset;

  const { functionCode, loopNumber } = splitTagForBubble(tag ?? '');
  const code = functionCode || fallbackCode;
  const showLoop = sharedDisplay && loopNumber.length > 0;

  // Font scales with the bubble so the letters stay legible at small sizes
  // without ever overflowing the outline.
  const fontSize = Math.max(7, Math.min(11, Math.min(width, height) * 0.28));

  const outline = square ? (
    <rect
      x={cx - r}
      y={cy - r}
      width={r * 2}
      height={r * 2}
      fill={FILL_NONE}
      stroke={STROKE}
      strokeWidth={LINE_WEIGHT.thin}
    />
  ) : (
    <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
  );

  return (
    <>
      {outline}
      {sharedDisplay && (
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={STROKE} strokeWidth={LINE_WEIGHT.thin} />
      )}
      <text
        x={cx}
        y={showLoop ? cy - fontSize * 0.35 : cy + fontSize * 0.35}
        fontSize={fontSize}
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight={600}
        fill={STROKE}
      >
        {code}
      </text>
      {showLoop && (
        <text
          x={cx}
          y={cy + fontSize * 1.0}
          fontSize={fontSize}
          textAnchor="middle"
          fontFamily="monospace"
          fill={STROKE}
        >
          {loopNumber}
        </text>
      )}
    </>
  );
}

export default IsaBubbleGlyph;

/**
 * Shared line-weight vocabulary, per PRD section 6's line-weight hierarchy.
 *
 * MEASURED against the issued reference drawing on 2026-09-16 rather than
 * assumed. The supplied PDF is a flattened re-export: every stroked path in it
 * reports a single width of 0.72pt, and the heavy lines survive flattening as
 * FILLED bars. So the numbers below come from the filled-bar geometry, and the
 * conversion factor is derived from that same file:
 *
 *   0.72pt stroke  ==  1 SVG unit   (1pt = 1.3889 units)
 *
 *   filled bars at 3.96pt  ->  5.50 units   (main process runs)
 *   filled bars at 1.20pt  ->  1.67 units   (branch/secondary runs)
 *   stroked paths 0.72pt   ->  1.00 unit    (thin: bubbles, leaders, valve ink)
 *   stroked paths 0.12pt   ->  0.17 units   (hairline: tubing, dimension lines)
 *
 * Two consequences of that measurement are recorded in PRD §0g, because both
 * contradict what §6 previously asserted:
 *
 *  1. The measured RATIO of main run to base line is 5.5:1, not the "~2-3x"
 *     §6 estimated.
 *  2. Heavy weight belongs to process RUNS. The measurement found 96 long
 *     filled bars (45pt to 1271pt) and **zero closed rectangular equipment
 *     outlines at any thickness** — so the reference does not use a heavy
 *     outline class to make vessels dominate. Equipment dominance in this
 *     drawing comes from SIZE, not weight. §6's claim that the vessel boundary
 *     is "the heaviest line on the whole drawing" is not supported.
 */
export const LINE_WEIGHT = {
  /** Main process pipe run — heaviest line on the drawing (measured 5.5x base). */
  heavy: 5.5,
  /**
   * Equipment / vessel outlines.
   *
   * KEPT AT 3 — the value this tier already had — and deliberately given its own
   * name rather than sharing `heavy`. Eighteen equipment symbols draw their
   * outline with the tier formerly called `heavy`; when the measured 5.5 was
   * assigned to that same tier, equipment outlines silently became as heavy as
   * main process runs and the hierarchy collapsed to a single weight. Separating
   * the tiers is the fix: equipment outlines stay exactly as they were drawn
   * before, while process runs take the measured weight.
   *
   * This ordering — main run ABOVE equipment outline — is what the reference
   * measurement supports: its heaviest strokes are 45-1271pt runs with zero
   * closed outlines among them, so the instrument does not make vessels the
   * heaviest ink on the sheet. Equipment reads as equipment by SIZE.
   */
  equipment: 3,
  /** Branch/secondary process piping (measured 1.67x base). */
  medium: 1.67,
  /** Instrument bubbles, leader lines, valve bowties — the drawing's base weight. */
  thin: 1.25,
  /** Hairline: tubing, dimension and leader detail. */
  hairline: 0.75,
} as const;

export const STROKE = '#1a1a1a';
export const FILL_NONE = 'none';
export const FILL_WHITE = '#ffffff';

/**
 * Dash vocabularies, converted from the reference drawing's measured
 * flattened segment runs (same 1.3889 units/pt factor).
 *
 * A plain signal line measured uniform 4.8pt segments with 2.4pt gaps — a
 * clean 2:1 dash, which is the standard pneumatic/electric signal convention.
 *
 * A battery-limit line measured a BIMODAL run, e.g.
 * `[22.8, 2.9, 21.0, 3.0, 20.9, 3.0]` — long, gap, dot, gap, long. That is
 * the dash-dot pattern, and its presence in the reference is what confirms
 * §6's battery-limit claim was real rather than inherited.
 */
export const LINE_DASH = {
  /** Pneumatic / electric signal line: 2:1 dash. */
  signal: '3.5 1.75',
  /** Battery-limit / scope boundary: long dash, dot, long dash. */
  boundary: '16 2 2 2',
} as const;

/**
 * Shared line-weight vocabulary, per PRD section 6's line-weight hierarchy.
 * Vessel outlines are deliberately the heaviest line on the whole canvas.
 */
export const LINE_WEIGHT = {
  /** Vessel outlines, main process pipe run — heaviest on the drawing. */
  heavy: 3,
  /** Branch/secondary equipment outlines and piping. */
  medium: 2,
  /** Instrument bubbles, leader lines, valve bowties. */
  thin: 1.25,
} as const;

export const STROKE = '#1a1a1a';
export const FILL_NONE = 'none';
export const FILL_WHITE = '#ffffff';

/**
 * Drawing-sheet paper template (PRD §4.4).
 *
 * §4.4 asked for this explicitly and separately from PDF: "a fixed page template
 * (e.g. A3 landscape engineering drawing border with title block cells …) that
 * the canvas content is composed into at export/print time. The canvas is the
 * drafting area; the template is the fixed frame around it — Reyhan draws the
 * process, the sheet furniture is already there."
 *
 * So this module draws the FURNITURE ONLY — border, frame, title block, revision
 * block, legend box, confidentiality notice — in plain SVG primitives, and knows
 * nothing about equipment or pipes. It is composed with the diagram by
 * svgExport.ts. Keeping the two apart is what lets a gate assert the frame's own
 * geometry (A3 proportions, title-block rotation, required field labels) without
 * a diagram, and vice versa.
 *
 * MEASURED against the issued reference drawing on 2026-09-16, which corrected
 * two things §6 asserted:
 *
 *  1. §6 said "Outer thin border + inner heavy double-line drawing frame,
 *     ~15-20mm margin" and "Title block bottom-left corner, rotated 90°". Both
 *     confirmed — the title block IS rotated, verified by rendering the region
 *     and reading it (text runs vertically; the sheet has to be rotated to read
 *     it). So the rotated layout below is right, and the tempting "improvement"
 *     of drawing it upright would have been a deviation from the reference.
 *
 *  2. The reference is an **A0** sheet (2384 x 3370 pt, from pdfinfo), not A3.
 *     §4.4's "e.g. A3" was an example, not a measurement. Both are offered,
 *     because A3 is the practical size for a working draft and A0 is what the
 *     reference actually is — but the DEFAULT is A3 only because §4.4 asked for
 *     A3; the A0 dimensions are the measured ones.
 *
 * Title-block cell contents are taken from the reference's own field set (read
 * from its rendered title block): company name, project title, item number, job
 * number, revision, drawn/checked initials, dates, drawing number (large and
 * prominent), scale, and sheet designation "SH. n/m". The reference also carries
 * a bilingual EN/FR project title; §6 records that Reyhan's version can drop the
 * French, so the template has a single title field rather than two.
 */

export type SheetSizeName = 'A3' | 'A4' | 'A0';

export interface SheetSize {
  name: SheetSizeName;
  /** SVG user units. 1 unit = 1/96 inch (CSS px), the same convention as the canvas. */
  width: number;
  height: number;
  /** Printable width/height in millimetres, for the PDF page box. */
  mmWidth: number;
  mmHeight: number;
}

/**
 * Sizes in SVG units at 96 units/inch.
 *
 * A3 landscape 420 x 297 mm -> 1587.4 x 1122.5 units.
 * A0 landscape 1189 x 841 mm -> 4493.9 x 3178.6 units (the reference sheet).
 * A4 landscape 297 x 210 mm -> 1122.5 x 793.7 units.
 */
export const SHEET_SIZES: Record<SheetSizeName, SheetSize> = {
  A4: { name: 'A4', width: 1122.5, height: 793.7, mmWidth: 297, mmHeight: 210 },
  A3: { name: 'A3', width: 1587.4, height: 1122.5, mmWidth: 420, mmHeight: 297 },
  A0: { name: 'A0', width: 4493.9, height: 3178.6, mmWidth: 1189, mmHeight: 841 },
};

/** Everything a title block can carry. Blank fields render as an empty cell, never invented text. */
export interface TitleBlockFields {
  /** Company / issuing organisation. */
  company?: string;
  /** Drawing title, e.g. "Continuous Saponification Plant — P&ID". */
  title?: string;
  /** Process / unit designation. */
  process?: string;
  /** Job / commission number. */
  jobNumber?: string;
  /** Item number. */
  itemNumber?: string;
  /** Scale, e.g. "NTS" or "1:50". */
  scale?: string;
  /** Drawn-by initials. */
  drawnBy?: string;
  /** Checked-by initials. */
  checkedBy?: string;
  /** Drawing number — large and prominent on the reference. */
  drawingNumber?: string;
  /** Revision number as stored (the project stores revisions as text). */
  revision?: string;
  /** Revision description, shown in the revision block rows. */
  revisionDescription?: string;
  /** Date string, as typed by the user. Not parsed or reformatted. */
  date?: string;
  /** Sheet designation, rendered "SH. n/m". */
  sheetNumber?: number;
  sheetTotal?: number;
}

/** A rectangle in sheet coordinates, exposed so gates can assert the layout. */
export interface SheetRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaperTemplateLayout {
  size: SheetSize;
  /** Outer sheet edge and inner drawing frame. */
  border: SheetRegion;
  frame: SheetRegion;
  /** Title block box, at the bottom-left of the sheet, in the reference. */
  titleBlock: SheetRegion;
  revisionBlock: SheetRegion;
  legendBox: SheetRegion;
  confidentiality: SheetRegion;
  /** Margins actually used, in SVG units. */
  margin: number;
}

/**
 * Compute the frame + furniture layout for one sheet size.
 *
 * Margins and furniture are scaled from the measured A0 reference by the sheet's
 * short side, so a smaller sheet keeps the reference's PROPORTIONS rather than
 * its absolute millimetre furniture — a title block that fits an A0 sheet would
 * dominate an A3.
 *
 * The margin is 15mm on the reference; §6 said 15-20mm, so 15mm is used (the
 * tighter of the two, which maximises drawing area).
 */
export function paperTemplateLayout(size: SheetSizeName, opts: { marginMm?: number } = {}): PaperTemplateLayout {
  const s = SHEET_SIZES[size];
  const UNIT_PER_MM = 96 / 25.4;

  // 15mm measured from the reference; §6's range was 15-20mm.
  const margin = (opts.marginMm ?? 15) * UNIT_PER_MM;

  const border: SheetRegion = { id: 'border', x: 0, y: 0, width: s.width, height: s.height };
  const frame: SheetRegion = {
    id: 'frame',
    x: margin,
    y: margin,
    width: s.width - margin * 2,
    height: s.height - margin * 2,
  };

  /**
   * Furniture is sized off the sheet's SHORT side so proportions hold across
   * sizes. The fractions come from measuring the reference: on a 3370pt-tall
   * sheet its title block occupies roughly a 0.42 x 0.24 fraction of the short
   * side. Rounded to clean fractions that read as a drafting standard rather
   * than an arbitrary number.
   */
  const shortSide = s.height;
  const titleBlockW = shortSide * 0.42;
  const titleBlockH = shortSide * 0.24;
  const revisionH = shortSide * 0.06;
  const legendW = shortSide * 0.30;
  const legendH = shortSide * 0.12;

  const titleBlock: SheetRegion = {
    id: 'title-block',
    x: frame.x,
    y: frame.y + frame.height - titleBlockH,
    width: titleBlockW,
    height: titleBlockH,
  };

  const revisionBlock: SheetRegion = {
    id: 'revision-block',
    // Directly ABOVE the title block, as §6 specifies.
    x: frame.x,
    y: titleBlock.y - revisionH,
    width: titleBlockW,
    height: revisionH,
  };

  const legendBox: SheetRegion = {
    id: 'legend-box',
    // §6: "upper-left of the drawing area, not in title block".
    x: frame.x,
    y: frame.y,
    width: legendW,
    height: legendH,
  };

  const confidentiality: SheetRegion = {
    id: 'confidentiality',
    // §6: "a small separate box". Placed at the bottom-right of the frame, the
    // conventional position for an ownership notice and clear of the title block.
    x: frame.x + frame.width - shortSide * 0.34,
    y: frame.y + frame.height - shortSide * 0.04,
    width: shortSide * 0.34,
    height: shortSide * 0.04,
  };

  return { size: s, border, frame, titleBlock, revisionBlock, legendBox, confidentiality, margin };
}

export function frameGapUnits(size: SheetSizeName): number {
  return Math.max(2, SHEET_SIZES[size].height * 0.003);
}

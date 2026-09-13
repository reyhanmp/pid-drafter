/**
 * Configurable tag / line-number numbering (PRD §4.3).
 *
 * WHAT THIS REPLACES. Auto-numbering used to be a hardcoded counter: the first
 * vessel was always `V-101`, the next `V-102`, seeded by an in-code `max = 100`.
 * That is one house style frozen into the code. Real practice varies, and the
 * variation is meaningful:
 *
 *   - Numbering is usually seeded per item type, not globally. Vessels may
 *     start at 101 while exchangers start at 201, so the first digit identifies
 *     the type to anyone reading the drawing.
 *   - Sequences are often spaced (101, 110, 120) rather than consecutive, so a
 *     line or item discovered late can be inserted in its logical place instead
 *     of being bolted on at the end of a range.
 *   - Line numbers carry an area/unit, a piping class and an insulation suffix
 *     that are properties of the PROJECT, not of each individual line. On the
 *     reference drawing most numbers share area 710 and class 300; retyping
 *     those per line is the kind of manual work this tool exists to remove.
 *
 * PER-AREA, NOT PER-SERVICE (measured, not assumed). On the reference drawing
 * `710.01` appears on a `DIC2` line and `710.20` on a `JAC` line, while LPS2
 * also uses `710.01A`. So the running sequence is shared across service codes
 * within an area — it is NOT a per-service counter. Modelling it per-service
 * would have produced duplicate numbers on a real drawing.
 *
 * BACKWARD COMPATIBILITY IS THE CONSTRAINT. Every saved project predates this
 * module, so `normalizeNumbering` must turn `undefined` into defaults that
 * reproduce the old behaviour exactly (first vessel still `V-101`). Existing
 * drawings must not renumber themselves because a config field appeared.
 */
import type { ProjectSheet } from './types';
import type { EquipmentNodeData, PipeEdgeData } from '../types/diagram';
import { formatLineNumber, parseLineNumber } from '../validation/lineNumbers';

/**
 * How equipment tags are shaped. Both forms are real; the choice is a house
 * standard, not a correctness question.
 *
 *   'plain'  `V-101`, `P-102`            — item type + sequence, no area
 *   'area'   `P-710.01A`, `D-710.2.01A`  — type + area + sequence + suffix
 *
 * The reference drawing in §6 uses the AREA form for equipment
 * (`P-710.01A/B`, `D-710.2.01A`), matching the area.seq segment of its line
 * numbers. The plain form is the common international default. Supporting only
 * one of them would make the numbering feature unusable on the other, which is
 * exactly the "hardcoded to one house style" problem this feature exists to
 * solve.
 */
export type TagStyle = 'plain' | 'area';

export interface TagNumberingScheme {
  /** Shape of generated equipment tags. See TagStyle. */
  style: TagStyle;
  /**
   * Area / unit number used by the 'area' style, e.g. `710` writes
   * `P-710.01`. Ignored in 'plain' style.
   */
  area: string;
  /** Zero-pad width for the sequence, used by the 'area' style. */
  sequencePad: number;
  /**
   * Letter suffix for generated tags, e.g. `A` writes `P-710.01A`. The
   * reference drawing uses A/B to distinguish parallel identical units, so a
   * scheme that cannot express it cannot reproduce that drawing.
   */
  suffix: string;
  /**
   * First number used for a prefix with no explicit entry, in 'plain' style,
   * e.g. 101 so the first vessel is `V-101`. Deliberately not 1 — process tags
   * conventionally start at 101 so that 1–100 stays free for utility/small-bore
   * numbering.
   */
  defaultStart: number;
  /**
   * First sequence for a prefix with no explicit entry, in 'area' style,
   * e.g. 1 so the first pump in area 710 is `P-710.01`.
   *
   * Separate from `defaultStart` on purpose: the two styles number from
   * different baselines. Sharing one field would make `defaultStart: 101`
   * produce `P-710.101`, which is not a tag anyone writes.
   */
  sequenceStart: number;
  /**
   * Increment between consecutive auto-assigned numbers. 1 = consecutive;
   * 10 = spaced, leaving room to insert later without renumbering.
   */
  step: number;
  /**
   * Per-prefix first numbers, keyed WITHOUT the dash — `{ V: 101, P: 201 }`.
   * Looked up before `defaultStart`.
   */
  prefixStarts: Record<string, number>;
}

export interface LineNumberingScheme {
  /** Area / unit number written into new line numbers, e.g. `710`. */
  area: string;
  /** First running sequence within the area, e.g. 1 writes `710.01`. */
  sequenceStart: number;
  /**
   * Zero-pad width for the sequence. The reference drawing pads to 2
   * (`710.01`, `710.20`, `710.05`). Values wider than the pad are not
   * truncated — sequence 123 at pad 2 still writes `123`.
   */
  sequencePad: number;
  /** Letter suffix for a first line, e.g. `A` writes `710.01A`. */
  suffix: string;
  /** Increment between consecutive line sequences (see TagNumberingScheme.step). */
  step: number;
  /** Piping class written into new line numbers, e.g. `300`. */
  pipingClass: string;
  /** Insulation suffix, e.g. `HC`. Empty writes the bare trailing dash. */
  insulation: string;
  /** Service code used when a line has none yet. */
  defaultService: string;
  /** Nominal size used when a line has none yet, e.g. `2"`. */
  defaultSize: string;
}

export interface NumberingConfig {
  tags: TagNumberingScheme;
  lines: LineNumberingScheme;
}

/**
 * Defaults chosen to reproduce the pre-configuration behaviour exactly, with
 * one exception: the line-number defaults describe the reference drawing's own
 * conventions (area 710, class 300, heat-conserved) rather than an arbitrary
 * placeholder, because a project without a configured area cannot produce a
 * meaningful line number anyway and 710 is a real, defensible starting point.
 */
export const DEFAULT_TAG_NUMBERING: TagNumberingScheme = {
  // 'plain' so that a project with no configuration behaves EXACTLY as it did
  // before this module existed (first vessel V-101). Switching to 'area' is an
  // explicit user choice in the settings panel.
  style: 'plain',
  area: '710',
  sequencePad: 2,
  suffix: '',
  defaultStart: 101,
  sequenceStart: 1,
  step: 1,
  prefixStarts: {},
};

export const DEFAULT_LINE_NUMBERING: LineNumberingScheme = {
  area: '710',
  sequenceStart: 1,
  sequencePad: 2,
  suffix: '',
  step: 1,
  pipingClass: '300',
  insulation: 'HC',
  defaultService: 'PROC',
  defaultSize: '2"',
};

export const DEFAULT_NUMBERING: NumberingConfig = {
  tags: DEFAULT_TAG_NUMBERING,
  lines: DEFAULT_LINE_NUMBERING,
};

/** Coerce anything (including `undefined` from an older saved project) into a
 * valid config. Every field is independently defaulted, so a partially-written
 * config from a future/older version still loads rather than failing. */
export function normalizeNumbering(raw: unknown): NumberingConfig {
  const r = (raw ?? {}) as Partial<NumberingConfig>;
  const t = (r.tags ?? {}) as Partial<TagNumberingScheme>;
  const l = (r.lines ?? {}) as Partial<LineNumberingScheme>;

  const num = (v: unknown, fallback: number, min: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fallback;
  const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

  // prefixStarts arrives from JSON where it may be a non-object or hold
  // non-numeric values; keep only the entries that are usable numbers.
  const starts: Record<string, number> = {};
  if (t.prefixStarts && typeof t.prefixStarts === 'object') {
    for (const [k, v] of Object.entries(t.prefixStarts)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) starts[k] = v;
    }
  }

  return {
    tags: {
      style: t.style === 'area' ? 'area' : DEFAULT_TAG_NUMBERING.style,
      area: str(t.area, DEFAULT_TAG_NUMBERING.area),
      sequencePad: num(t.sequencePad, DEFAULT_TAG_NUMBERING.sequencePad, 1),
      suffix: str(t.suffix, DEFAULT_TAG_NUMBERING.suffix),
      defaultStart: num(t.defaultStart, DEFAULT_TAG_NUMBERING.defaultStart, 0),
      sequenceStart: num(t.sequenceStart, DEFAULT_TAG_NUMBERING.sequenceStart, 0),
      step: num(t.step, DEFAULT_TAG_NUMBERING.step, 1),
      prefixStarts: starts,
    },
    lines: {
      area: str(l.area, DEFAULT_LINE_NUMBERING.area),
      sequenceStart: num(l.sequenceStart, DEFAULT_LINE_NUMBERING.sequenceStart, 0),
      sequencePad: num(l.sequencePad, DEFAULT_LINE_NUMBERING.sequencePad, 1),
      suffix: str(l.suffix, DEFAULT_LINE_NUMBERING.suffix),
      step: num(l.step, DEFAULT_LINE_NUMBERING.step, 1),
      pipingClass: str(l.pipingClass, DEFAULT_LINE_NUMBERING.pipingClass),
      insulation: str(l.insulation, DEFAULT_LINE_NUMBERING.insulation),
      defaultService: str(l.defaultService, DEFAULT_LINE_NUMBERING.defaultService),
      defaultSize: str(l.defaultSize, DEFAULT_LINE_NUMBERING.defaultSize),
    },
  };
}

/** Every tag currently used anywhere in the project (all sheets). */
export function allTags(sheets: ProjectSheet[]): string[] {
  const out: string[] = [];
  for (const sheet of sheets) {
    for (const node of sheet.nodes) {
      const tag = ((node.data as unknown as EquipmentNodeData).tag ?? '').trim();
      if (tag) out.push(tag);
    }
  }
  return out;
}

/** Every non-empty line number currently used anywhere in the project. */
export function allLineNumbers(sheets: ProjectSheet[]): string[] {
  const out: string[] = [];
  for (const sheet of sheets) {
    for (const edge of sheet.edges) {
      const data = edge.data as unknown as PipeEdgeData | undefined;
      if (data?.freePipe) continue; // free lines are not numbered runs
      const n = (data?.lineNumber ?? '').trim();
      if (n) out.push(n);
    }
  }
  return out;
}

/**
 * Numbers already in use for one prefix, in `plain` style, e.g. 101, 102 for
 * prefix `V` from `V-101`, `V-102`.
 *
 * Suffixed forms (`V-101A`) are deliberately NOT counted: a suffixed tag is an
 * offshoot of an existing item, so counting it would let one offshoot push the
 * whole sequence forward.
 */
function usedNumbersForPrefix(prefix: string, tags: string[]): number[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}-(\\d+)$`);
  const out: number[] = [];
  for (const tag of tags) {
    const m = tag.match(pattern);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

/**
 * Sequences already in use for one prefix WITHIN AN AREA, in `area` style —
 * e.g. 1 for `P-710.01A` and 2.1 for `D-710.2.01A`.
 *
 * Area and prefix must both match: `P-710.01` and `P-711.01` are different
 * equipment ranges and must not advance each other's counter. This mirrors the
 * per-area rule for line numbers (see the note at the top of this file) — the
 * reference drawing keeps its equipment in the same area scheme as its lines.
 *
 * Returns the numbers as raw strings so a two-level sequence (`2.01`) is not
 * lost to Number() coercion; the caller decides how to advance it.
 */
function usedAreaSequences(prefix: string, area: string, tags: string[]): string[] {
  const p = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${p}-${a}\\.(\\d+(?:\\.\\d+)?)[A-Za-z]?$`);
  const out: string[] = [];
  for (const tag of tags) {
    const m = tag.match(pattern);
    if (m) out.push(m[1]);
  }
  return out;
}

/**
 * Advance a possibly two-level sequence, PRESERVING its zero-padding.
 *
 *   `2.01` -> `2.02`   (two-level: lower level advances)
 *   `01`   -> `02`     (single level, pad 2 kept — NOT `2`)
 *   `7`    -> `8`
 *
 * The padding case is the one that bites: `String(1 + 1)` is `'2'`, so a naive
 * increment silently degrades a padded scheme to unpadded after the first item
 * (`P-710.01` then `P-710.2`), which then breaks the per-area regex that reads
 * these tags back. The width is therefore taken from the input, not assumed.
 */
function advanceSequence(last: string, step: number): string {
  const parts = last.split('.');
  if (parts.length === 2) {
    const upper = Number(parts[0]);
    const lower = Number(parts[1]);
    if (Number.isFinite(upper) && Number.isFinite(lower)) {
      return `${upper}.${padSequence(lower + step, parts[1].length)}`;
    }
  }
  const n = Number(last);
  if (!Number.isFinite(n)) return last;
  return padSequence(n + step, last.length);
}

/** Zero-pad a sequence to the configured width, never truncating it. */
export function padSequence(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/**
 * Next free tag for a prefix under `scheme`.
 *
 * TWO SHAPES, because both are real house standards (see TagStyle):
 *
 *   plain  `V-101`       first of a type starts at `defaultStart`, then max+step
 *   area   `P-710.01A`   type + area + sequence(s) + optional suffix
 *
 * In BOTH shapes a collision check runs regardless of how the candidate was
 * derived. Auto-numbering must never propose a tag that already exists, since
 * tag uniqueness is a hard validity error (PRD §4.1) — the tool would
 * otherwise be generating the very error it refuses to export. The check
 * matters most when `prefixStarts` is lowered below tags already on the
 * drawing, or when tags were typed by hand.
 */
export function nextTagFor(
  prefix: string,
  sheets: ProjectSheet[],
  scheme: TagNumberingScheme,
): string {
  const tags = allTags(sheets);
  const taken = new Set(tags.map((t) => t.trim()));
  const step = Math.max(1, scheme.step);

  if (scheme.style === 'area') {
    const existing = usedAreaSequences(prefix, scheme.area, tags);
    const start = padSequence(
      scheme.prefixStarts[prefix] ?? scheme.sequenceStart,
      scheme.sequencePad,
    );

    // Compare numerically where possible so `9` and `10` order correctly
    // rather than lexically (`10` < `9` as strings).
    const highest = existing.length
      ? existing.reduce((best, cur) => {
          const b = best.split('.').map(Number);
          const c = cur.split('.').map(Number);
          for (let i = 0; i < Math.max(b.length, c.length); i += 1) {
            const bv = b[i] ?? 0;
            const cv = c[i] ?? 0;
            if (cv !== bv) return cv > bv ? cur : best;
          }
          return best;
        })
      : null;

    let seq = highest === null ? start : advanceSequence(highest, step);

    for (let i = 0; i < 10_000; i += 1) {
      const candidate = `${prefix}-${scheme.area}.${seq}${scheme.suffix}`;
      if (!taken.has(candidate)) return candidate;
      seq = advanceSequence(seq, step);
    }
    return `${prefix}-${scheme.area}.${seq}${scheme.suffix}`;
  }

  // ── plain style ──
  const used = usedNumbersForPrefix(prefix, tags);
  const start = scheme.prefixStarts[prefix] ?? scheme.defaultStart;
  let n = used.length === 0 ? start : Math.max(...used) + step;

  for (let i = 0; i < 10_000 && taken.has(`${prefix}-${n}`); i += 1) {
    n += step;
  }
  return `${prefix}-${n}`;
}

/**
 * Highest running sequence already used in a given area, across ALL service
 * codes. Returns null when the area has no numbered lines yet.
 *
 * Area matching is on the parsed `area` field, so `710.01A` and `710.20` both
 * count toward area `710` while `7210B` counts toward `7210`. This is what
 * keeps a new line in area 710 from colliding with an existing one there.
 */
export function highestSequenceInArea(
  area: string,
  lineNumbers: string[],
): number | null {
  let max: number | null = null;
  for (const raw of lineNumbers) {
    const reading = parseLineNumber(raw);
    if (!reading.parts) continue;
    if (reading.parts.area !== area) continue;
    // An EMPTY sequence is not sequence zero. The undotted area form
    // (`7210B`) parses as area=7210 with sequence='' and the letter in
    // `suffix`, so `Number('')` would coerce to 0 and silently report that
    // area 7210 already holds sequence 0 — which would then suppress the
    // first real line number in that area.
    const seqText = reading.parts.sequence.trim();
    if (!seqText) continue;
    const seq = Number(seqText);
    if (!Number.isFinite(seq)) continue;
    max = max === null ? seq : Math.max(max, seq);
  }
  return max;
}

/**
 * Build the next free line number for a new run.
 *
 * The sequence is derived from existing lines IN THE SAME AREA (see the
 * per-area note at the top of this file), and the result is validated by
 * round-tripping through the real parser — if the configured scheme produces
 * something the grammar cannot read back byte-identically, that is a bug in
 * the configuration and the caller gets a clearly empty result rather than a
 * line number the rest of the app cannot parse.
 *
 * Returns null when the scheme cannot produce a parseable number (e.g. an area
 * containing a dash, which would split into the wrong field).
 */
export function nextLineNumber(
  sheets: ProjectSheet[],
  scheme: LineNumberingScheme,
  opts: { service?: string; size?: string } = {},
): string | null {
  const existing = allLineNumbers(sheets);
  const taken = new Set(existing.map((s) => s.trim()));

  const maxSeq = highestSequenceInArea(scheme.area, existing);
  let seq = maxSeq === null ? scheme.sequenceStart : maxSeq + scheme.step;

  const service = (opts.service ?? '').trim() || scheme.defaultService;
  const size = (opts.size ?? '').trim() || scheme.defaultSize;

  const build = (s: number): string =>
    formatLineNumber({
      size,
      service,
      area: scheme.area,
      sequence: padSequence(s, scheme.sequencePad),
      suffix: scheme.suffix,
      pipingClass: scheme.pipingClass,
      insulation: scheme.insulation,
    });

  // Advance past any collision, then confirm the result round-trips. The
  // parser is the arbiter of validity here, not this function's own
  // formatting: if the configured scheme produces a string the grammar cannot
  // read back byte-identically, the configuration is unusable and the caller
  // gets null rather than a line number the rest of the app cannot parse.
  for (let i = 0; i < 10_000; i += 1) {
    const candidate = build(seq);
    if (taken.has(candidate)) {
      seq += Math.max(1, scheme.step);
      continue;
    }
    const reading = parseLineNumber(candidate);
    if (!reading.parts) return null;
    return formatLineNumber(reading.parts) === candidate ? candidate : null;
  }
  return null;
}

export interface LineNumberProposal {
  edgeId: string;
  /** Proposed number, or null when the scheme could not produce one. */
  proposal: string | null;
  /** Existing number, when the line already has one (left untouched). */
  existing: string;
}

/**
 * Plan numbers for every UNNUMBERED process/signal line on a sheet, in reading
 * order (top-to-bottom by mid-Y, then left-to-right by mid-X).
 *
 * Reading order matters: it is the order an engineer's eye travels down the
 * sheet, so sequential numbers read as a sensible progression rather than
 * following node creation order, which is arbitrary. Lines that already have a
 * number are left alone — renumbering a client's existing drawing would be
 * destructive, and this tool does not rewrite numbers it did not assign.
 *
 * Free lines are skipped: they are not numbered runs (PRD §4.1 carve-out).
 */
export function planUnnumberedLines(
  sheet: ProjectSheet,
  scheme: LineNumberingScheme,
): LineNumberProposal[] {
  const nodeById = new Map(sheet.nodes.map((n) => [n.id, n]));

  const midOf = (edge: (typeof sheet.edges)[number]): { x: number; y: number } => {
    const a = nodeById.get(edge.source);
    const b = nodeById.get(edge.target);
    const pos = (n: typeof a) => {
      const d = n?.data as unknown as EquipmentNodeData | undefined;
      const w = d?.width ?? 0;
      const h = d?.height ?? 0;
      return { x: (n?.position.x ?? 0) + w / 2, y: (n?.position.y ?? 0) + h / 2 };
    };
    const pa = pos(a);
    const pb = pos(b);
    return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
  };

  const candidates = sheet.edges
    .filter((e) => {
      const d = e.data as unknown as PipeEdgeData | undefined;
      if (d?.freePipe) return false;
      return !(d?.lineNumber ?? '').trim();
    })
    .map((e) => {
      const d = e.data as unknown as PipeEdgeData | undefined;
      return { edge: e, mid: midOf(e), data: d };
    })
    .sort((p, q) => p.mid.y - q.mid.y || p.mid.x - q.mid.x);

  // Each proposal is built against the numbers already in use PLUS the ones
  // proposed so far in this same pass, so a batch cannot assign one number
  // twice. Synthesised into a throwaway sheet rather than hitting the store on
  // every step.
  const virtualSheets: ProjectSheet[] = [{ ...sheet, edges: [...sheet.edges] }];
  const out: LineNumberProposal[] = [];

  for (const c of candidates) {
    // Service and size come from the SCHEME, not from the line: an unnumbered
    // line has no line number, and the service code is encoded *inside* the
    // line number — there is no separate field to read it from. That is
    // precisely what the settings panel is for: it declares what a new line's
    // number looks like, so a batch-numbered drawing comes out consistent.
    const proposal = nextLineNumber(virtualSheets, scheme);
    if (proposal) {
      virtualSheets[0].edges.push({
        ...c.edge,
        data: { ...(c.edge.data as object), lineNumber: proposal },
      });
    }
    out.push({
      edgeId: c.edge.id,
      proposal,
      existing: (c.data?.lineNumber ?? '').trim(),
    });
  }
  return out;
}

/** Render the scheme back into a human-readable pattern, for the settings UI. */
export function describeTagScheme(s: TagNumberingScheme): string {
  const seeded = Object.entries(s.prefixStarts)
    .map(([k, v]) => `${k}-${v}`)
    .sort();
  const seed = seeded.length ? seeded.join(', ') : `every type starts at ${s.defaultStart}`;
  return `Next number = ${seeded.length ? 'per-type seed' : 'seed'} + step (${s.step}); ${seed}`;
}

export function describeLineScheme(s: LineNumberingScheme): string {
  return `{size}"-{service}-${s.area}.${padSequence(s.sequenceStart, s.sequencePad)}${s.suffix}-${s.pipingClass}-${s.insulation}`;
}

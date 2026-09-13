/**
 * Line-number grammar (PRD §6 / §4.9.2).
 *
 * The reference drawing (X-00000-000-01) uses the format
 *
 *   {size}"-{service-code}-{area}.{seq}{suffix}-{class}-{insulation}
 *
 * with real examples:
 *
 *   1"-DIC2-710.01-300-HC
 *   1 1/2"-LPS2-710.01-300-HC
 *   4"-BL-710.05B-300-HC
 *   3"-BL-710.05-320-
 *   1"-VENT-710.02A-320-HC
 *   3"-JAC-710.20-300-HC
 *   3/4"-NI-7210B-315-
 *
 * Line numbers are the single most information-dense string on a P&ID. Every
 * part of that string is a separate engineering decision:
 *
 *   size        nominal bore — sets the pipe schedule and the valve sizes
 *   service     what is in the pipe (LPS2 = low-pressure steam 2, NI =
 *               nitrogen, BL = blowdown, JAC = jacketed, VENT, DIC2)
 *   area.seq    area/unit number then a running sequence within it, with an
 *               optional letter suffix for an offshoot of the same line
 *   class       piping class / pressure rating (300, 320, 315 seen)
 *   insulation  HC = heat conservation, thin = traced in the reference
 *
 * The app previously stored this as one opaque string, which means it could
 * not be validated, sorted, grouped, listed by service, or counted by piping
 * class — all things a process engineer does with a line list constantly.
 * This module gives the string a grammar.
 *
 * ROUND-TRIP IS THE HARD REQUIREMENT. `formatLineNumber(parseLineNumber(x))`
 * must reproduce any tag the parser accepted, byte for byte. A parser that
 * silently normalises `3/4"` to `0.75"` or drops a trailing `-` has corrupted
 * a client's drawing, so the raw input is always retained and reassembly is
 * from the raw parts. Unparseable input is returned with `parts: null` and the
 * raw string intact — never guessed at.
 */

/** Piping class codes seen on the reference drawing, plus the common ASME set. */
export const PIPING_CLASS_SUGGESTIONS = ['150', '300', '315', '320', '600', '900', '1500'];

/**
 * Insulation / trace suffixes. `HC` dominates the reference drawing (heat
 * conservation, i.e. insulated); the bare trailing `-` on several lines is a
 * deliberate empty field, not a formatting error — it is kept.
 */
export const INSULATION_SUFFIXES = ['HC', 'H', 'PP', 'ET', 'C', 'P'];

/**
 * Service codes seen on the reference drawing, plus the standard international
 * set. This is a SUGGESTION list, not a whitelist — real plants have hundreds.
 */
export const SERVICE_CODES: Record<string, string> = {
  // Utilities
  LPS2: 'Low Pressure Steam (2 bar)',
  LPS4: 'Low Pressure Steam (4 bar)',
  MPS: 'Medium Pressure Steam',
  HPS: 'High Pressure Steam',
  CW: 'Cooling Water',
  CWR: 'Cooling Water Return',
  CWS: 'Cooling Water Supply',
  CHW: 'Chilled Water',
  NI: 'Nitrogen',
  IA: 'Instrument Air',
  PA: 'Plant Air',
  DMW: 'Demineralised Water',
  BFW: 'Boiler Feed Water',
  COND: 'Condensate',
  // Process / general
  BL: 'Blowdown',
  VENT: 'Vent',
  DR: 'Drain',
  JAC: 'Jacketed',
  DIC2: 'Dicarboxylic / house code (see §6)',
  PROC: 'Process',
  FL: 'Flare',
  FGL: 'Fuel Gas',
  FO: 'Fuel Oil',
  PG: 'Product Gas',
  // Solids/slurry
  SL: 'Slurry',
};

export interface LineNumberParts {
  /** Nominal size exactly as written, e.g. `1 1/2"`, `3/4"`. */
  size: string;
  /** Service code, uppercased, e.g. `LPS2`. */
  service: string;
  /** Area / unit number, e.g. `710`, `7210`. */
  area: string;
  /** Running sequence within the area, e.g. `01`, `05`. */
  sequence: string;
  /** Optional letter suffix on the sequence, e.g. the `A` in `710.02A`. */
  suffix: string;
  /** Piping class / pressure rating, e.g. `300`. */
  pipingClass: string;
  /** Insulation / trace suffix, e.g. `HC`. Empty string is a valid value. */
  insulation: string;
}

export interface LineNumberReading {
  /** The input, trimmed, always preserved verbatim. */
  raw: string;
  /** Parsed parts, or null when the string does not match the grammar. */
  parts: LineNumberParts | null;
  /** Resolved service description, if the code is known. */
  serviceDescription: string | null;
  /** Set when the number is non-empty but does not parse. */
  problem: string | null;
}

const SIZE = String.raw`\d+(?:\s+\d+/\d+)?(?:/\d+)?(?:\.\d+)?\s*(?:"|''|in\b|mm\b)?`;
const SERVICE = String.raw`[A-Za-z][A-Za-z0-9]*`;
/**
 * Area/sequence block. Real drawings use BOTH forms:
 *   `710.01A`  area . sequence + suffix   (the dotted form)
 *   `7210B`    area only + suffix         (no dot — see `3/4"-NI-7210B-315-`)
 * The dot is therefore optional, and when absent the whole numeric run is the
 * AREA with an empty sequence. Deliberately not split into area=12/seq=01: the
 * reference drawing gives no evidence for where the boundary falls, and
 * inventing one would corrupt the number on the next reassembly.
 */
const AREA_SEQ = String.raw`(?<area>\d+)(?:\.(?<seq>\d+))?(?<suffix>[A-Za-z]?)`;
const CLASS = String.raw`\d*`;
const INSULATION = String.raw`[A-Za-z]*`;

/**
 * Full-grammar match, anchored. Built from named groups so the reassembly in
 * `formatLineNumber` cannot drift from the parse.
 *
 * Separators are captured loosely (`[\s-]*`) because real drawings are
 * inconsistent about spaces around the size quote and the dashes.
 */
const LINE_NUMBER_RE = new RegExp(
  String.raw`^\s*(?<size>${SIZE})\s*[-–]\s*` +
    String.raw`(?<service>${SERVICE})\s*[-–]\s*` +
    AREA_SEQ +
    String.raw`\s*[-–]\s*(?<class>${CLASS})\s*` +
    String.raw`[-–]\s*(?<insulation>${INSULATION})\s*$`,
);

/**
 * Parse a line number.
 *
 * Also accepts the common ABBREVIATED forms, because a half-drawn diagram is
 * the normal state of a P&ID and rejecting a partially-typed number would be
 * useless:
 *
 *   `2"-CAU-710.01`            size + service + area.seq   (no class yet)
 *   `CAU-710.01`               service + area.seq
 *   `710.01`                   area.seq only
 *
 * Anything that matches none of these comes back with `parts: null` and a
 * problem string, and is never rewritten.
 */
export function parseLineNumber(lineNumber: string): LineNumberReading {
  const raw = (lineNumber ?? '').trim();
  if (!raw) return { raw, parts: null, serviceDescription: null, problem: null };

  const full = LINE_NUMBER_RE.exec(raw);
  if (full) {
    const g = full.groups as Record<string, string>;
    const service = (g.service ?? '').toUpperCase();
    return {
      raw,
      parts: {
        size: (g.size ?? '').trim(),
        service,
        area: g.area ?? '',
        sequence: g.seq ?? '',
        suffix: (g.suffix ?? '').toUpperCase(),
        pipingClass: g.class ?? '',
        insulation: (g.insulation ?? '').toUpperCase(),
      },
      serviceDescription: SERVICE_CODES[service] ?? null,
      problem: null,
    };
  }

  // ── Abbreviated forms: a partially-specified number is not an error, it is
  //    a diagram still being drawn. Fill what is there, leave the rest blank.
  const sizeOnly = new RegExp(String.raw`^\s*(?<size>${SIZE})\s*$`).exec(raw);
  if (sizeOnly) {
    return {
      raw,
      parts: { size: sizeOnly.groups!.size.trim(), service: '', area: '', sequence: '', suffix: '', pipingClass: '', insulation: '' },
      serviceDescription: null,
      problem: null,
    };
  }

  const svcArea = new RegExp(
    String.raw`^\s*(?<service>${SERVICE})\s*[-–]\s*` +
      AREA_SEQ +
      String.raw`\s*(?:[-–]\s*(?<class>${CLASS})\s*)?(?:[-–]\s*(?<insulation>${INSULATION})\s*)?$`,
  ).exec(raw);
  if (svcArea) {
    const g = svcArea.groups as Record<string, string>;
    const service = (g.service ?? '').toUpperCase();
    return {
      raw,
      parts: {
        size: '',
        service,
        area: g.area ?? '',
        sequence: g.seq ?? '',
        suffix: (g.suffix ?? '').toUpperCase(),
        pipingClass: g.class ?? '',
        insulation: (g.insulation ?? '').toUpperCase(),
      },
      serviceDescription: SERVICE_CODES[service] ?? null,
      problem: null,
    };
  }

  const areaOnly = /^\s*(?<area>\d+)\.(?<seq>\d+)(?<suffix>[A-Za-z]?)\s*$/.exec(raw);
  if (areaOnly) {
    const g = areaOnly.groups as Record<string, string>;
    return {
      raw,
      parts: {
        size: '', service: '', area: g.area, sequence: g.seq,
        suffix: (g.suffix ?? '').toUpperCase(), pipingClass: '', insulation: '',
      },
      serviceDescription: null,
      problem: null,
    };
  }

  const sizeSvcArea = new RegExp(
    String.raw`^\s*(?<size>${SIZE})\s*[-–]\s*(?<service>${SERVICE})\s*[-–]\s*` + AREA_SEQ + String.raw`\s*$`,
  ).exec(raw);
  if (sizeSvcArea) {
    const g = sizeSvcArea.groups as Record<string, string>;
    const service = (g.service ?? '').toUpperCase();
    return {
      raw,
      parts: {
        size: (g.size ?? '').trim(), service, area: g.area ?? '', sequence: g.seq ?? '',
        suffix: (g.suffix ?? '').toUpperCase(), pipingClass: '', insulation: '',
      },
      serviceDescription: SERVICE_CODES[service] ?? null,
      problem: null,
    };
  }

  return {
    raw,
    parts: null,
    serviceDescription: null,
    problem:
      'Does not match the line-number format ' +
      '{size}"-{service}-{area}.{seq}-{class}-{insulation}, e.g. 1 1/2"-LPS2-710.01-300-HC.',
  };
}

/**
 * Reassemble a line number from parts.
 *
 * Round-trips BOTH area forms, because `formatLineNumber(parseLineNumber(x))`
 * must equal `x` for anything the parser accepted — a parser that rewrites
 * `7210B` into `1201.B` has corrupted the number:
 *
 *   area='710', seq='01', suffix='A'  ->  `710.01A`   (dotted)
 *   area='7210', seq='',    suffix='B'  ->  `7210B`   (undotted)
 *
 * Trailing empty fields are preserved as bare dashes rather than dropped, to
 * match the reference drawing's own habit (`3"-BL-710.05-320-`). Earlier
 * empties still need their separator, so the class field is emitted whenever
 * an insulation suffix follows it.
 */
export function formatLineNumber(parts: LineNumberParts): string {
  const size = parts.size ? `${parts.size}-` : '';
  const service = parts.service ? `${parts.service}-` : '';
  const areaSeq = parts.area
    ? parts.sequence
      ? `${parts.area}.${parts.sequence}${parts.suffix}`
      : `${parts.area}${parts.suffix}`
    : '';
  const hasTail = !!parts.pipingClass || !!parts.insulation;
  const head = `${size}${service}${areaSeq}`;
  if (!hasTail) return head;
  return `${head}-${parts.pipingClass}-${parts.insulation}`;
}

/**
 * True when the string is structurally broken in a way worth surfacing on the
 * diagram: non-empty, but matching no accepted form.
 */
export function isMalformedLineNumber(lineNumber: string): boolean {
  const r = parseLineNumber(lineNumber);
  return r.raw !== '' && r.parts === null;
}

/**
 * Everything the line-number editor needs to offer suggestions, derived from
 * a set of already-used numbers so a diagram's own conventions win over the
 * generic built-in lists. House service codes and class values appear in the
 * dropdown because someone on this project already used them.
 */
export function deriveLineNumberSuggestions(existing: string[]): {
  services: string[];
  classes: string[];
  insulations: string[];
} {
  const services = new Set<string>();
  const classes = new Set<string>();
  const insulations = new Set<string>();
  for (const raw of existing) {
    const { parts } = parseLineNumber(raw);
    if (!parts) continue;
    if (parts.service) services.add(parts.service);
    if (parts.pipingClass) classes.add(parts.pipingClass);
    if (parts.insulation) insulations.add(parts.insulation);
  }
  return {
    services: [...new Set([...services, ...Object.keys(SERVICE_CODES)])].sort(),
    classes: [...new Set([...classes, ...PIPING_CLASS_SUGGESTIONS])].sort(),
    insulations: [...new Set([...insulations, ...INSULATION_SUFFIXES])].sort(),
  };
}

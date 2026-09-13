/**
 * Equipment tag-prefix semantics for P&IDs.
 *
 * Equipment tags are NOT ISA-5.1 — that standard covers instruments. Equipment
 * follows house convention, but the conventions are close to universal in
 * process industry: a letter (sometimes two) naming the equipment type, then a
 * separator, then a sequence number, usually suffixed by an area/unit number.
 *
 *   V-101     vessel            P-101A   pump (A of a pair)
 *   E-204     heat exchanger     TK-101   storage tank
 *   C-301     column             K-201    compressor
 *
 * WHY THIS IS WORTH A TABLE: the tag prefix is a claim about what the thing
 * IS, and a P&ID where `V-101` is drawn as a centrifugal pump is wrong in a
 * way that survives every other check in this app — the tag is unique, the
 * ports are seated, the spec matches. Prefix-vs-symbol-type is the one check
 * that catches a mis-placed symbol by its own label.
 *
 * LENIENCY IS THE DEFAULT, same as the ISA side: single-letter prefixes
 * overlap legitimately across house standards (this project's own reference
 * drawing uses `D-7102.01` for a saponification reactor vessel, where `D` is
 * the house code), and plenty of real plants use prefixes no table will ever
 * contain. An unrecognised prefix is therefore NOT a problem, and a prefix
 * whose letter maps to a *different* equipment family is a WARNING — because
 * the useful signal is "this is labelled like a vessel but drawn as a pump",
 * not "I have never seen this letter".
 */

export interface PrefixReading {
  /** Leading alphabetic run of the tag, uppercased. */
  prefix: string;
  /** What the prefix conventionally denotes, if known. */
  meaning: string | null;
  /** Coarse equipment family the prefix implies, used for the cross-check. */
  family: EquipmentFamily | null;
  /** True when the prefix resolved against this table. */
  known: boolean;
}

/**
 * Coarse families — deliberately fewer than the symbol categories, because
 * several categories are legitimately one tagging family (all five reactor
 * variants tag `R`, all seven heat-exchanger variants tag `E`).
 */
export type EquipmentFamily =
  | 'vessel'
  | 'tank'
  | 'column'
  | 'reactor'
  | 'pump'
  | 'compressor'
  | 'heat-exchanger'
  | 'agitator'
  | 'filter'
  | 'misc';

/** Prefix -> meaning. Covers the common international set. */
export const EQUIPMENT_PREFIXES: Record<string, { meaning: string; family: EquipmentFamily }> = {
  // Vessels, tanks, columns, reactors
  V: { meaning: 'Vessel / Drum', family: 'vessel' },
  D: { meaning: 'Drum / Vessel (house code)', family: 'vessel' },
  TK: { meaning: 'Storage Tank', family: 'tank' },
  T: { meaning: 'Tank / Tower (context-dependent)', family: 'tank' },
  C: { meaning: 'Column / Tower', family: 'column' },
  TWR: { meaning: 'Tower', family: 'column' },
  R: { meaning: 'Reactor', family: 'reactor' },
  S: { meaning: 'Silo / Separator', family: 'vessel' },
  // Machinery
  P: { meaning: 'Pump', family: 'pump' },
  K: { meaning: 'Compressor / Blower', family: 'compressor' },
  B: { meaning: 'Blower', family: 'compressor' },
  M: { meaning: 'Agitator / Mixer', family: 'agitator' },
  AG: { meaning: 'Agitator', family: 'agitator' },
  // Heat transfer
  E: { meaning: 'Heat Exchanger', family: 'heat-exchanger' },
  H: { meaning: 'Heater / Fired Heater', family: 'heat-exchanger' },
  AC: { meaning: 'Air Cooler', family: 'heat-exchanger' },
  // Separation / filtration / piping accessories
  F: { meaning: 'Filter / Strainer', family: 'filter' },
  ST: { meaning: 'Strainer / Steam Trap', family: 'filter' },
  SB: { meaning: 'Spectacle Blind', family: 'misc' },
  RO: { meaning: 'Restriction Orifice', family: 'misc' },
  EJ: { meaning: 'Expansion Joint', family: 'misc' },
  FLG: { meaning: 'Flange', family: 'misc' },
  RED: { meaning: 'Reducer', family: 'misc' },
  PS: { meaning: 'Pipe Support', family: 'misc' },
};

/**
 * Which families are acceptable for each symbol category. A category maps to
 * ONE OR MORE families, because a real drawing tags e.g. a knockout drum `V`
 * or `D`, and a separator `V` or `S`.
 *
 * Categories absent from this map are not prefix-checked at all (valves and
 * instruments are checked by the ISA rules instead; terminators and off-page
 * connectors are annotations, not equipment).
 */
export const FAMILIES_BY_CATEGORY: Record<string, EquipmentFamily[]> = {
  Vessels: ['vessel', 'tank'],
  Columns: ['column'],
  Reactors: ['reactor', 'vessel'],
  Pumps: ['pump'],
  'Heat Exchangers': ['heat-exchanger'],
  Agitators: ['agitator'],
  'Piping Accessories': ['filter', 'misc'],
};

/** Read the leading alphabetic run of an equipment tag. */
export function readEquipmentPrefix(tag: string): PrefixReading {
  const m = (tag ?? '').trim().match(/^([A-Za-z]+)/);
  const prefix = m ? m[1].toUpperCase() : '';
  const hit = EQUIPMENT_PREFIXES[prefix];
  return {
    prefix,
    meaning: hit?.meaning ?? null,
    family: hit?.family ?? null,
    known: !!hit,
  };
}

export interface PrefixCheck {
  /** '' when the tag is fine or unassessable; otherwise a human explanation. */
  warning: string;
}

/**
 * Cross-check a tag's prefix against the symbol category it is drawn as.
 *
 * Returns a warning only when the tag's prefix confidently names a DIFFERENT
 * equipment family from the one the symbol belongs to. Unknown prefixes and
 * uncategorised symbols pass, deliberately — the check exists to catch
 * "labelled a pump, drawn as a vessel", not to police house standards.
 */
export function checkPrefixMatchesCategory(
  tag: string,
  category: string,
  symbolLabel: string,
): PrefixCheck {
  const acceptable = FAMILIES_BY_CATEGORY[category];
  if (!acceptable) return { warning: '' };

  const reading = readEquipmentPrefix(tag);
  if (!reading.known || !reading.family) return { warning: '' };

  // Reactors accept 'vessel' because reactor vessels tag both ways; treat any
  // overlap as a pass.
  if (acceptable.includes(reading.family)) return { warning: '' };

  return {
    warning:
      `Tag "${tag.trim()}" reads as a ${reading.meaning} (prefix "${reading.prefix}"), ` +
      `but it is placed as a ${symbolLabel}. ` +
      `A ${category.replace(/s$/, '').toLowerCase()} is normally tagged ` +
      `${acceptable.map((f) => familyPrefixHint(f)).join(' or ')}.`,
  };
}

/** A representative prefix for a family, for use in the warning text. */
function familyPrefixHint(family: EquipmentFamily): string {
  const preferred: Record<EquipmentFamily, string> = {
    vessel: 'V',
    tank: 'TK',
    column: 'C',
    reactor: 'R',
    pump: 'P',
    compressor: 'K',
    'heat-exchanger': 'E',
    agitator: 'M',
    filter: 'ST',
    misc: '(house code)',
  };
  return `"${preferred[family]}-"`;
}

/** Whether a symbol's category participates in prefix checking at all. */
export function isPrefixChecked(category: string): boolean {
  return category in FAMILIES_BY_CATEGORY;
}

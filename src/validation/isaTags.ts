/**
 * ISA-5.1 instrument tag intelligence.
 *
 * An ISA-5.1 tag is `FF...F-NNNN`, where the letters are FUNCTION codes and
 * the number is the LOOP number. The letters are not arbitrary: the FIRST
 * letter is the measured/initiating VARIABLE (T = temperature, P = pressure,
 * F = flow, L = level, A = analysis...), and the following letters are
 * function modifiers read in a defined order — typically
 * `[variable][modifier...][output function]`, where the trailing letter says
 * what the instrument does (T transmitter, C controller, I indicator,
 * S switch, V valve/damper, E element, Y relay/compute, Z position).
 *
 * So `TT` = Temperature Transmitting, `TIC` = Temperature Indicating
 * Controller, `PV` = Pressure Valve, `LSH` = Level Switch High.
 *
 * WHY THIS MATTERS FOR THE DRAFTER: the tag is the only place a P&ID records
 * what an instrument IS. The list module (§4.6) and the loop cross-reference
 * (§4.7) both already parse tags to derive structure — this module gives them
 * a real grammar to parse against, and gives the editor something to validate
 * and autocomplete instead of treating the tag as an opaque string.
 *
 * NOISE IS EXPECTED, SO LENIENCY IS THE DEFAULT. House standards legitimately
 * add codes ISA-5.1 never defined (this project's reference drawing uses
 * `ZSL`/`ZSH`/`ZI` for valve position, `HS` for hand switch, `AV` for air
 * valve). An unrecognised code is therefore a WARNING at most, never a hard
 * error, and a well-formed-but-unknown tag still yields a usable reading —
 * the first letter usually still names the variable. The tool's job is to
 * tell an engineer "I don't recognise this, is it your house code?", not to
 * refuse the drawing.
 *
 * WHAT IS A REAL ERROR: a tag with no letters before its number, or no number
 * at all. Those break every downstream consumer (loop parsing, list
 * generation, DEXPI export), so they are flagged.
 */

/** ISA-5.1 first letters — the measured or initiating variable. */
export const ISA_FIRST_LETTERS: Record<string, string> = {
  A: 'Analysis',
  B: 'Burner / Combustion',
  C: 'User Choice (conductivity)',
  D: 'User Choice (density)',
  E: 'Voltage',
  F: 'Flow',
  G: 'User Choice (gauging)',
  H: 'Hand (manual)',
  I: 'Current',
  J: 'Power',
  K: 'Time / Schedule',
  L: 'Level',
  M: 'User Choice (moisture)',
  N: 'User Choice',
  O: 'User Choice',
  P: 'Pressure / Vacuum',
  Q: 'Quantity',
  R: 'Radiation',
  S: 'Speed / Frequency',
  T: 'Temperature',
  U: 'Multivariable',
  V: 'Vibration / Mechanical',
  W: 'Weight / Force',
  X: 'Unclassified',
  Y: 'Event / State / Presence',
  Z: 'Position / Dimension',
};

/**
 * Succeeding letters. A letter can mean different things depending on
 * position (a trailing `T` is a transmitter; a leading `T` is temperature),
 * so this table is position-agnostic and the reading below notes where a
 * letter is being interpreted as an output function.
 */
/**
 * Function codes actually used in practice, ISA-5.1 and house standards
 * combined. This is the set the tool RECOGNISES.
 *
 * WHY A LIST AND NOT A LETTER TABLE: ISA-5.1 assigns a meaning to every
 * letter A-Z in both first and succeeding position, so *any* alphabetic string
 * "resolves" against the letter tables — `QQ` reads as "Quantity / Totalize"
 * and sails through. Validating per-letter therefore validates nothing; the
 * dead-code failure mode this list exists to prevent. What is actually useful
 * to an engineer is whether the CODE is one a real drawing uses, so that is
 * what gets checked.
 *
 * Warning (never rejecting) on codes outside this list is the right severity:
 * a plant with a `JX` code is not wrong, it is unusual, and the tool should say
 * "I don't recognise this — confirm it's deliberate" rather than refuse.
 */
export const RECOGNISED_FUNCTION_CODES = new Set([
  // Flow
  'FT', 'FI', 'FIC', 'FC', 'FE', 'FV', 'FR', 'FQ', 'FS', 'FSH', 'FSL', 'FAL', 'FAH', 'FQI', 'FQIC', 'FICV',
  // Pressure
  'PT', 'PI', 'PIC', 'PC', 'PCV', 'PDT', 'PDI', 'PDIC', 'PSV', 'PS', 'PG', 'PIT', 'PV', 'PAH', 'PAL', 'PSH', 'PSL', 'PSE',
  // Temperature
  'TT', 'TI', 'TIC', 'TC', 'TE', 'TV', 'TW', 'TR', 'TS', 'TSH', 'TSL', 'TAH', 'TAL', 'TIT', 'TICV',
  // Level
  'LT', 'LI', 'LIC', 'LC', 'LV', 'LG', 'LS', 'LSH', 'LSL', 'LAH', 'LAL', 'LAHH', 'LALL', 'LIT', 'LCV', 'LSHH', 'LSLL',
  // Analysis
  'AT', 'AI', 'AIC', 'AC', 'AE', 'AAH', 'AAL',
  // Hand / position / misc ISA
  'HS', 'HV', 'HC', 'ZS', 'ZT', 'ZI', 'ZIC', 'ZSO', 'ZSC', 'ZSL', 'ZSH',
  // Weight, speed, vibration, time, current
  'WT', 'WI', 'WIC', 'ST', 'SI', 'SIC', 'SE', 'VT', 'VI', 'JIC', 'JT', 'JI', 'EI', 'II', 'KI', 'KT',
  // Signal / logic blocks (reference drawing uses XV/XY/XT/XI)
  'XV', 'XY', 'XT', 'XI', 'XA', 'XSH', 'XSL', 'XV', 'AV',
  // Recording / computing
  'YR', 'YI', 'YC', 'YIC', 'YK', 'UR', 'UY', 'UV',
]);

export const ISA_SUCCEEDING_LETTERS: Record<string, string> = {
  A: 'Alarm',
  B: 'User Choice',
  C: 'Control / Controller',
  D: 'Difference / Differential',
  E: 'Element / Primary Element',
  F: 'Ratio',
  G: 'Gas / Glass',
  H: 'High',
  I: 'Indicate / Indicator',
  J: 'Scan',
  K: 'Time Rate of Change',
  L: 'Light / Low',
  M: 'Momentary / Middle',
  N: 'User Choice',
  O: 'Orifice / Restriction',
  P: 'Test Point / Point',
  Q: 'Integrate / Totalize',
  R: 'Record / Recorder',
  S: 'Switch',
  T: 'Transmit / Transmitter',
  U: 'Multifunction',
  V: 'Valve / Damper / Louver',
  W: 'Well / Probe',
  X: 'Unclassified',
  Y: 'Relay / Compute / Convert',
  Z: 'Driver / Actuator / Position',
};

/**
 * Codes this project's own reference drawing uses that ISA-5.1 does not
 * define, or defines differently in practice. Kept explicit and separate from
 * the standard tables so the tool can say "known house code" rather than
 * "unknown code", and so a reviewer can see exactly where the standard was
 * extended for real drawings on purpose.
 *
 * Sources: the issued client drawing X-00000-000-01 (see PRD §6), whose
 * loop tags include ZSL/ZSH/ZI (valve position), HS (hand switch), AV (air
 * valve) and XV/XY/XT/XI logic blocks.
 */
export const HOUSE_CODES: Record<string, string> = {
  HS: 'Hand Switch',
  XV: 'On/Off Valve (shutoff)',
  XY: 'Position Relay / Solenoid',
  XT: 'Position Transmitter',
  XI: 'Position Indicator',
  ZSL: 'Valve Position Switch — Low/Closed',
  ZSH: 'Valve Position Switch — High/Open',
  ZSO: 'Valve Position Switch — Open',
  ZSC: 'Valve Position Switch — Closed',
  ZI: 'Valve Position Indicator',
  AV: 'Air Valve',
  LV: 'Level Control Valve',
  PV: 'Pressure Control Valve',
  TV: 'Temperature Control Valve',
  FV: 'Flow Control Valve',
  PDI: 'Differential Pressure Indicator',
  LAH: 'Level Alarm High',
  LSH: 'Level Switch High',
  PIT: 'Pressure Indicating Transmitter',
};

export interface IsaTagReading {
  /** The full input tag, trimmed. */
  tag: string;
  /** Leading alphabetic run, uppercased. Empty when the tag has no letters. */
  functionCode: string;
  /** Trailing numeric run (the loop number), or '' when absent. */
  loopNumber: string;
  /** Single alphabetic suffix after the number, e.g. the 'A' in 'TT-101A'. */
  suffix: string;
  /** Variable from the first letter, resolved through ISA-5.1 or the house table. */
  variable: string | null;
  /** Per-letter glosses, in order. Position-aware for the first and last letter. */
  letters: Array<{ letter: string; meaning: string; role: 'variable' | 'function' | 'output' }>;
  /** True when every letter resolved against ISA-5.1 or the house table. */
  recognised: boolean;
  /** Letters that resolved against nothing — surfaced so a house code can be spotted. */
  unknownLetters: string[];
  /** True when the code came from HOUSE_CODES rather than plain ISA-5.1. */
  isHouseCode: boolean;
  /** Set when the tag is malformed in a way that breaks downstream consumers. */
  problem: string | null;
}

/**
 * Split a tag into function code / loop number / suffix.
 *
 * Handles the separators real drawings use: `TT-101`, `TT101`, `TT_101`,
 * `TT 101`, and the `TIC-710.1A` form seen on the reference drawing where the
 * loop number itself contains a dot (area.loop). The dot is preserved in the
 * loop number, since `710.1` and `710.11` are different loops.
 */
export function splitTag(tag: string): { functionCode: string; loopNumber: string; suffix: string } {
  const t = (tag ?? '').trim();
  if (!t) return { functionCode: '', loopNumber: '', suffix: '' };
  // Letters first, then an optional separator, then digits (with optional
  // internal dots for area.loop numbering), then an optional trailing letter.
  const m = t.match(/^([A-Za-z]+)[\s\-_.]*(\d+(?:\.\d+)*)\s*([A-Za-z])?$/);
  if (!m) {
    // Fall back to the two halves independently so a malformed tag still
    // yields whatever IS parseable, rather than nothing at all.
    const letters = t.match(/^[A-Za-z]+/);
    const digits = t.match(/\d+(?:\.\d+)*/);
    return {
      functionCode: letters ? letters[0].toUpperCase() : '',
      loopNumber: digits ? digits[0] : '',
      suffix: '',
    };
  }
  return { functionCode: m[1].toUpperCase(), loopNumber: m[2], suffix: m[3] ? m[3].toUpperCase() : '' };
}

/**
 * Read an instrument tag against ISA-5.1.
 *
 * Returns a reading even for unrecognised codes — the caller decides how
 * loudly to complain. `problem` is reserved for tags that are structurally
 * broken (no letters, or no number), because those genuinely break loop
 * parsing and list generation.
 */
export function readIsaTag(tag: string): IsaTagReading {
  const { functionCode, loopNumber, suffix } = splitTag(tag);
  const letters: IsaTagReading['letters'] = [];

  if (functionCode) {
    for (let i = 0; i < functionCode.length; i += 1) {
      const ch = functionCode[i];
      const isFirst = i === 0;
      const isLast = i === functionCode.length - 1;
      let meaning: string | null = null;
      let role: 'variable' | 'function' | 'output' = 'function';

      if (isFirst) {
        meaning = ISA_FIRST_LETTERS[ch] ?? null;
        role = 'variable';
      } else {
        meaning = ISA_SUCCEEDING_LETTERS[ch] ?? null;
        role = isLast ? 'output' : 'function';
      }

      letters.push({ letter: ch, meaning: meaning ?? ch, role });
    }
  }

  const variable = functionCode ? ISA_FIRST_LETTERS[functionCode[0]] ?? null : null;
  const isHouseCode = functionCode in HOUSE_CODES;
  /**
   * `recognised` is about the CODE, not its individual letters. ISA-5.1 gives
   * every letter a meaning in both positions, so a per-letter check would pass
   * literally any alphabetic string (`QQ` -> "Quantity / Totalize") and never
   * fire. The useful question for an engineer is whether the code is one real
   * drawings use, which is what RECOGNISED_FUNCTION_CODES answers.
   */
  const recognised = !functionCode || RECOGNISED_FUNCTION_CODES.has(functionCode) || isHouseCode;
  const unknownLetters = recognised ? [] : [functionCode];

  // Structural problems only — what actually breaks downstream consumers.
  let problem: string | null = null;
  const trimmed = (tag ?? '').trim();
  if (trimmed) {
    if (!functionCode) {
      problem = 'Tag has no function letters — loop parsing and list generation cannot read it. Expected a form like "TT-101".';
    } else if (!loopNumber) {
      problem = 'Tag has no loop number — loop cross-referencing cannot group it. Expected a form like "TT-101".';
    }
  }

  return {
    tag: trimmed,
    functionCode,
    loopNumber,
    suffix,
    variable,
    letters,
    recognised: unknownLetters.length === 0,
    unknownLetters,
    isHouseCode,
    problem,
  };
}

/** Human-readable expansion of a tag's function code, e.g. "TIC" -> "Temperature Indicating Controller". */
export function describeFunctionCode(functionCode: string): string {
  if (!functionCode) return '';
  if (HOUSE_CODES[functionCode]) return HOUSE_CODES[functionCode];
  const reading = readIsaTag(`${functionCode}-1`);
  const parts: string[] = [];
  for (const l of reading.letters) {
    parts.push(l.meaning === 'unrecognised' ? l.letter : l.meaning);
  }
  return parts.join(' ');
}

/**
 * Every function code the editor may offer, ISA-5.1 first then house codes.
 * The UI uses this for autocomplete suggestions; it is NOT a whitelist —
 * validation warns on unknown codes rather than rejecting them.
 */
export function suggestedFunctionCodes(): Array<{ code: string; meaning: string; isHouseCode: boolean }> {
  const isa = Object.keys(ISA_FIRST_LETTERS)
    .map((code) => ({ code, meaning: ISA_FIRST_LETTERS[code], isHouseCode: false }));
  const house = Object.keys(HOUSE_CODES).map((code) => ({ code, meaning: HOUSE_CODES[code], isHouseCode: true }));
  return [...isa, ...house];
}

/**
 * Tags that are legitimately not instrument loop tags and should never be
 * warned about: line-end annotations and the off-page connector marker. They
 * live in instrument-ish categories but are not field instruments.
 */
const NON_LOOP_KINDS = new Set(['offpage-connector']);

export function isInstrumentLoopTag(kind: string): boolean {
  return !NON_LOOP_KINDS.has(kind);
}

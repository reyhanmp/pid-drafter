/**
 * Verification for PRD §4.9.2 — tag and line-number semantics.
 *
 * Run: node scripts/verify-tags.cjs [url]
 * Exit 0 = all checks pass.
 *
 * The load-bearing claims here are:
 *
 *   1. Line numbers ROUND-TRIP byte-exactly. If the parser cannot reproduce
 *      the input, it has corrupted a client's drawing, which is worse than
 *      not parsing at all.
 *   2. ISA-5.1 reading is CORRECT, not merely present — TT is temperature
 *      transmitting, TIC is a temperature indicating controller.
 *   3. The checks are LENIENT where real drawings require it and STRICT where
 *      breakage is real. House codes (ZSL/ZSH/HS/AV, straight off the project's
 *      own reference drawing) must NOT warn; a missing loop number MUST error.
 *
 * Check (e) is the one that matters most and the one easiest to get wrong: it
 * asserts the checks stay QUIET on a drawing built entirely from the real
 * reference drawing's own numbering. A validator that fires on correct work is
 * worse than no validator.
 */
const { launch, freshPage, seedProject, URL: DEFAULT_URL } = require('./harness.cjs');

const URL = process.argv[2] || DEFAULT_URL;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/** Real line numbers taken verbatim from the issued reference drawing (PRD §6). */
const REAL_LINE_NUMBERS = [
  '1"-DIC2-710.01-300-HC',
  '1 1/2"-LPS2-710.01-300-HC',
  '4"-BL-710.05B-300-HC',
  '3"-BL-710.05-320-',
  '1"-VENT-710.02A-320-HC',
  '3"-JAC-710.20-300-HC',
  '3/4"-NI-7210B-315-',
];

function eq(id, kind, tag, x, y) {
  return { id, type: 'equipment', position: { x, y }, data: { kind, tag, width: 90, height: 90, rotation: 0, properties: {} } };
}

/**
 * Fixture A — a drawing built ENTIRELY from real reference-drawing conventions.
 * Nothing here should produce a single warning.
 */
const CLEAN = {
  projectName: 'Tag Test — clean',
  sheets: [
    {
      id: 'sh-1', name: 'Sheet 1', order: 0,
      nodes: [
        eq('n-v', 'vessel-horizontal', 'D-7102.01A', 60, 80),
        eq('n-p', 'pump-centrifugal', 'P-710.01A', 380, 80),
        eq('n-e', 'heat-exchanger', 'E-710.01', 700, 80),
        // ISA + house codes straight off the reference drawing.
        eq('n-tt', 'transmitter-temp', 'TT-710.1A', 60, 300),
        eq('n-tic', 'controller-dcs', 'TIC-710.1A', 260, 300),
        eq('n-lsh', 'indicator-local', 'LSH-710.1A', 460, 300),
        eq('n-zsl', 'relay-diamond', 'ZSL-710.11A', 660, 300),
        eq('n-hs', 'relay-diamond', 'HS-710.11A', 860, 300),
        eq('n-ft', 'transmitter-flow', 'FT-710.02', 60, 500),
        eq('n-lt', 'transmitter-level', 'LT-710.03', 260, 500),
        // Two branch fittings, so this fixture is a real header arrangement
        // rather than a set of lines piled onto one nozzle.
        eq('n-t1', 'tee-branch', 'TEE-101', 1000, 80),
        eq('n-t2', 'tee-branch', 'TEE-102', 1200, 80),
      ],
      /*
       * The 7 real line numbers were previously all attached to ONE vessel
       * nozzle (`n-v`.right) and ONE pump nozzle (`n-p`.suction) — seven pipes
       * on a single flange. That was never a legal drawing; it simply went
       * unreported until the validity engine grew the one-pipe-per-nozzle rule
       * (PRD §7a item 1), at which point this "clean" fixture started failing
       * its own no-false-positives check.
       *
       * The fix is to the FIXTURE, not to the rule: each line now runs between
       * its own nozzle pair, with two tees providing a header whose run ports
       * legitimately carry more than one line. The point of this fixture — that
       * correct tags and correct line numbers produce no warnings — is
       * unchanged, and the fixture is now a drawing someone could actually
       * issue.
       */
      edges: [
        ...REAL_LINE_NUMBERS.slice(0, 3).map((ln, i) => ({
          id: `e-${i}`,
          source: ['n-v', 'n-t1', 'n-v'][i],
          sourceHandle: ['right', 'run-out', 'left'][i],
          target: ['n-t1', 'n-p', 'n-t2'][i],
          targetHandle: ['run-in', 'suction', 'run-in'][i],
          type: 'pipe',
          data: { lineType: 'process', lineNumber: ln, lineSize: '', lineName: '', sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 } },
        })),
        ...REAL_LINE_NUMBERS.slice(3, 5).map((ln, i) => ({
          id: `e-${3 + i}`,
          source: ['n-v', 'n-v'][i],
          sourceHandle: ['top', 'bottom'][i],
          target: ['n-t1', 'n-t2'][i],
          targetHandle: ['run-in', 'run-in'][i],
          type: 'pipe',
          data: { lineType: 'process', lineNumber: ln, lineSize: '', lineName: '', sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 } },
        })),
        ...REAL_LINE_NUMBERS.slice(5).map((ln, i) => ({
          id: `e-${5 + i}`,
          source: ['n-t1', 'n-t2'][i],
          sourceHandle: ['run-out', 'run-out'][i],
          target: ['n-t2', 'n-p'][i],
          targetHandle: ['run-in', 'discharge'][i],
          type: 'pipe',
          data: { lineType: 'process', lineNumber: ln, lineSize: '', lineName: '', sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 } },
        })),
      ],
    },
  ],
};

/** Fixture B — deliberate mistakes, one per rule, to prove each rule fires. */
const BAD = {
  projectName: 'Tag Test — bad',
  sheets: [
    {
      id: 'sh-1', name: 'Sheet 1', order: 0,
      nodes: [
        // Prefix says vessel, drawn as a pump -> prefix-mismatch warning.
        eq('b1', 'pump-centrifugal', 'V-101', 60, 80),
        // Temperature transmitter tagged as pressure -> variable mismatch.
        eq('b2', 'transmitter-temp', 'PT-101', 380, 80),
        // Unknown ISA code -> isa-function-code-unknown warning.
        eq('b3', 'transmitter-temp', 'QQ-101', 700, 80),
        // No loop number -> HARD ERROR.
        eq('b4', 'transmitter-temp', 'TT', 60, 300),
        // No function letters -> HARD ERROR.
        eq('b5', 'transmitter-flow', '101', 380, 300),
      ],
      edges: [
        // Not the line-number grammar at all -> soft warning.
        { id: 'be1', source: 'b1', target: 'b2', sourceHandle: 'discharge', targetHandle: 'in', type: 'pipe',
          data: { lineType: 'process', lineNumber: 'SOME RANDOM TEXT', sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 } } },
      ],
    },
  ],
};

async function readPanel(page) {
  return page.evaluate(() => ({
    errors: [...document.querySelectorAll('[data-testid="validation-error"]')].map((e) => e.textContent.trim()),
    specWarnings: [...document.querySelectorAll('[data-testid="spec-warning"]')].map((e) => e.textContent.trim()),
    tagWarnings: [...document.querySelectorAll('[data-testid="tag-warning"]')].map((e) => e.textContent.trim()),
    validity: document.querySelector('.validation-badge')?.textContent.trim() ?? '',
  }));
}

(async () => {
  const { browser, page, errors } = await launch();
  try {
    // ── (a) ROUND-TRIP: every real line number survives parse->format ──
    await freshPage(page);
    const rt = await page.evaluate(async (nums) => {
      const mod = await import('/src/validation/lineNumbers.ts');
      const out = [];
      for (const n of nums) {
        const parsed = mod.parseLineNumber(n);
        if (!parsed.parts) { out.push({ n, back: null, ok: false }); continue; }
        const back = mod.formatLineNumber(parsed.parts);
        out.push({ n, back, ok: back === n, svc: parsed.parts.service, cls: parsed.parts.pipingClass });
      }
      return out;
    }, REAL_LINE_NUMBERS);
    const bad = rt.filter((r) => !r.ok);
    check(
      'a. all 7 real reference-drawing line numbers round-trip byte-exactly',
      bad.length === 0,
      bad.length
        ? bad.map((b) => `${JSON.stringify(b.n)} -> ${JSON.stringify(b.back)}`).join(' | ')
        : rt.map((r) => `${r.svc}/${r.cls || '-'}`).join(' '),
    );

    // ── (b) structured parsing actually extracts the parts ──
    const one = rt.find((r) => r.n === '1 1/2"-LPS2-710.01-300-HC');
    check(
      'b. line number parses into size/service/area.seq/class/insulation',
      !!one && one.svc === 'LPS2' && one.cls === '300',
      one ? `service=${one.svc} class=${one.cls}` : 'not parsed',
    );

    // ── (c) ISA-5.1 reading is CORRECT ──
    const isa = await page.evaluate(async () => {
      const mod = await import('/src/validation/isaTags.ts');
      const r = (t) => mod.readIsaTag(t);
      return {
        tt: mod.describeFunctionCode('TT'),
        tic: mod.describeFunctionCode('TIC'),
        pv: mod.describeFunctionCode('PV'),
        lsh: mod.describeFunctionCode('LSH'),
        ftVar: r('FT-101').variable,
        ttLoop: r('TT-101').loopNumber,
        dotLoop: r('TIC-710.1A').loopNumber,
        suffix: r('TIC-710.1A').suffix,
      };
    });
    check(
      'c. ISA-5.1 codes expand to the right engineering meaning',
      /^Temperature Transmit/.test(isa.tt) && /Controller/.test(isa.tic) &&
        /Valve/.test(isa.pv) && /Level/.test(isa.lsh) &&
        isa.ftVar === 'Flow',
      `TT="${isa.tt}" TIC="${isa.tic}" PV="${isa.pv}" LSH="${isa.lsh}"`,
    );
    check(
      'd. loop number and suffix parse, including the dotted area.loop form',
      isa.ttLoop === '101' && isa.dotLoop === '710.1' && isa.suffix === 'A',
      `TT-101 loop=${isa.ttLoop} TIC-710.1A loop=${isa.dotLoop} suffix=${isa.suffix}`,
    );

    // ── (e) THE IMPORTANT ONE: stay SILENT on a drawing built entirely from
    //        real reference-drawing conventions ──
    await seedProject(page, CLEAN);
    const clean = await readPanel(page);
    check(
      'e. no false positives on correct real-world tags (ISA + house codes + real line numbers)',
      clean.tagWarnings.length === 0 && clean.errors.length === 0,
      clean.tagWarnings.length || clean.errors.length
        ? `warnings=[${clean.tagWarnings.join(' || ')}] errors=[${clean.errors.join(' || ')}]`
        : `${CLEAN.sheets[0].nodes.length} tagged items + ${REAL_LINE_NUMBERS.length} real line numbers, zero warnings`,
    );

    // ── (f) every deliberate mistake IS caught, and at the right severity ──
    await seedProject(page, BAD);
    const bad2 = await readPanel(page);
    const has = (arr, re) => arr.some((m) => re.test(m));
    check(
      'f. prefix-vs-symbol mismatch caught (V-101 drawn as a pump)',
      has(bad2.tagWarnings, /reads as a Vessel.*placed as a Centrifugal Pump/) ||
        has(bad2.tagWarnings, /V-101.*Pump/i),
      bad2.tagWarnings.find((w) => /V-101/.test(w)) ?? 'NOT CAUGHT',
    );
    check(
      'g. instrument variable mismatch caught (temperature transmitter tagged PT-101)',
      has(bad2.tagWarnings, /PT-101.*Temperature Transmitter|PT-101.*measuring Pressure/s),
      bad2.tagWarnings.find((w) => /PT-101/.test(w)) ?? 'NOT CAUGHT',
    );
    check(
      'h. unknown ISA function code warned, not rejected (QQ-101)',
      has(bad2.tagWarnings, /QQ-101/) && has(bad2.tagWarnings, /not a standard ISA-5\.1 code/),
      bad2.tagWarnings.find((w) => /QQ-101/.test(w)) ?? 'NOT CAUGHT',
    );
    check(
      'i. malformed line number warned (soft, does not block export)',
      has(bad2.tagWarnings, /SOME RANDOM TEXT/),
      bad2.tagWarnings.find((w) => /SOME RANDOM TEXT/.test(w)) ?? 'NOT CAUGHT',
    );

    // ── (j) SEVERITY SPLIT: a tag with no loop number / no letters is a HARD
    //        error (breaks loop parsing, lists and export); everything else
    //        stays a soft warning ──
    check(
      'j. structurally broken instrument tags are HARD errors, not warnings',
      has(bad2.errors, /TT/) && has(bad2.errors, /101/) && /error/.test(bad2.validity),
      `errors=${bad2.errors.length} badge="${bad2.validity}"`,
    );
    check(
      'k. soft warnings do NOT inflate the error badge',
      // The fixture has 2 structurally-broken tags (TT with no loop, 101 with
      // no letters) AND deliberately unwired pipes, which raise their own
      // unconnected-pipe errors. Assert on the tag errors specifically rather
      // than a total that other rules also contribute to.
      bad2.errors.filter((e) => /loop number|no function letters/.test(e)).length === 2 &&
        bad2.tagWarnings.length >= 4 &&
        !/error/.test(bad2.tagWarnings.join(' ')) ,
      `${bad2.errors.length} hard errors (${bad2.errors.filter((e) => /loop number|no function letters/.test(e)).length} from tags), ${bad2.tagWarnings.length} soft warnings kept separate`,
    );

    // ── (l) the line-number EDITOR round-trips a structured edit through the
    //        store, and shows the service expansion ──
    await seedProject(page, CLEAN);
    const edited = await page.evaluate(async () => {
      const mod = await import('/src/validation/lineNumbers.ts');
      const p = mod.parseLineNumber('1 1/2"-LPS2-710.01-300-HC');
      // Change ONLY the piping class, the canonical reason to have structured parts.
      const next = mod.formatLineNumber({ ...p.parts, pipingClass: '600' });
      return { next, svcDesc: mod.SERVICE_CODES[p.parts.service] };
    });
    check(
      'l. editing one part (piping class 300 -> 600) reformats the whole number correctly',
      edited.next === '1 1/2"-LPS2-710.01-600-HC',
      `-> ${JSON.stringify(edited.next)} | service expands to "${edited.svcDesc}"`,
    );

    // ── (m) suggestions are seeded from the drawing's OWN codes ──
    const sugg = await page.evaluate(async (nums) => {
      const mod = await import('/src/validation/lineNumbers.ts');
      return mod.deriveLineNumberSuggestions(nums);
    }, REAL_LINE_NUMBERS);
    check(
      'm. suggestion lists include the drawing\'s own house codes',
      sugg.services.includes('DIC2') && sugg.services.includes('JAC') &&
        sugg.classes.includes('320') && sugg.classes.includes('315') && sugg.insulations.includes('HC'),
      `services=${sugg.services.slice(0, 6).join(',')}... classes=${sugg.classes.join(',')}`,
    );

    const pageErrs = errors.filter((e) => !/DevTools|favicon/i.test(e));
    if (pageErrs.length) console.log('\npage errors: ' + pageErrs.slice(0, 4).join(' | '));

    const failed = results.filter((x) => !x.pass);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    console.log(failed.length === 0 && pageErrs.length === 0 ? 'TAGS_PASS' : 'TAGS_FAIL');
    process.exitCode = failed.length === 0 && pageErrs.length === 0 ? 0 : 1;
  } catch (e) {
    console.error('runner error:', e.message);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();

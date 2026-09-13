/**
 * Verification for PRD §4.3 — configurable tag / line numbering.
 *
 * Run: node scripts/verify-numbering.cjs [url]
 * Exit 0 = all checks pass.
 *
 * The load-bearing claims, in order of how badly they'd hurt if wrong:
 *
 *   1. BACKWARD COMPATIBILITY. Every project saved before this feature existed
 *      has no `numbering` block. It must still load, and it must still produce
 *      `V-101` for the first vessel — the same tag the old hardcoded counter
 *      gave. A feature that silently renumbers a client's existing drawing has
 *      corrupted it, which is worse than not having the feature.
 *
 *   2. THE SEQUENCE IS PER-AREA, NOT PER-SERVICE. On the reference drawing
 *      710.01 carries DIC2 and 710.20 carries JAC while LPS2 also uses 710.01A
 *      — so the running number is shared across services within one area. If
 *      this is modelled per-service, a real drawing gets duplicate numbers.
 *
 *   3. NUMBERING NEVER DUPLICATES. Tag uniqueness is a HARD validity error
 *      (PRD §4.1). Auto-numbering must therefore never propose a tag that
 *      already exists, or the tool generates the very error it refuses to
 *      export. This is tested against a LOWERED start value, which is the case
 *      where a naive "start + count" implementation collides.
 *
 *   4. EXISTING NUMBERS ARE NEVER REWRITTEN. Bulk numbering fills blanks only.
 *      Renumbering a line that already has a number is destructive and is not
 *      something this tool does on the user's behalf.
 */
const { launch, freshPage, seedProject, URL: DEFAULT_URL } = require('./harness.cjs');

const URL = process.argv[2] || DEFAULT_URL;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const node = (id, kind, tag, x, y, w = 90, h = 90) => ({
  id, type: 'equipment', position: { x, y },
  data: { kind, tag, width: w, height: h, rotation: 0, properties: {} },
});

const edge = (id, src, tgt, srcHandle, tgtHandle, lineNumber) => ({
  id, source: src, target: tgt, sourceHandle: srcHandle, targetHandle: tgtHandle,
  type: 'pipe',
  data: {
    lineType: 'process', ...(lineNumber ? { lineNumber } : {}),
    sourceDirection: { x: 1, y: 0 }, targetDirection: { x: -1, y: 0 },
  },
});

(async () => {
  const { browser, page, errors } = await launch();
  try {
    await freshPage(page);

    // ── (a) BACKWARD COMPAT: a pre-numbering project loads and keeps its tags ──
    const legacy = await page.evaluate(async () => {
      const ser = await import('/src/project/serialize.ts');
      // A version-2 file written BEFORE the numbering block existed.
      const legacyFile = JSON.stringify({
        schema: 'pid-drafter/project',
        version: 2,
        savedAt: '2026-09-01T00:00:00.000Z',
        projectName: 'Legacy Drawing',
        sheets: [{
          id: 'sh-1', name: 'Sheet 1', order: 0,
          nodes: [
            { id: 'n1', type: 'equipment', position: { x: 0, y: 0 },
              data: { kind: 'vessel-vertical', tag: 'V-101', width: 90, height: 200, rotation: 0, properties: {} } },
            { id: 'n2', type: 'equipment', position: { x: 200, y: 0 },
              data: { kind: 'vessel-vertical', tag: 'V-102', width: 90, height: 200, rotation: 0, properties: {} } },
          ],
          edges: [],
        }],
      });
      const parsed = ser.parseProjectJson(legacyFile);
      if (!parsed.ok) return { ok: false, errors: parsed.errors };
      const num = await import('/src/project/numbering.ts');
      const cfg = num.normalizeNumbering(parsed.project.numbering);
      // The next vessel must be V-103 — the old hardcoded counter's answer.
      const next = num.nextTagFor('V', parsed.project.sheets, cfg.tags);
      return { ok: true, next, tags: parsed.project.sheets[0].nodes.map((n) => n.data.tag) };
    });
    check(
      'a. BACKWARD COMPAT: version-2 file with NO numbering block loads, and first-vessel behaviour is unchanged',
      legacy.ok && legacy.next === 'V-103' && legacy.tags.join(',') === 'V-101,V-102',
      legacy.ok
        ? `loaded with tags [${legacy.tags.join(', ')}], next vessel = ${legacy.next} (expected V-103)`
        : `FAILED TO LOAD: ${(legacy.errors || []).join(' | ')}`,
    );

    // ── (b) BACKWARD COMPAT: defaults equal the old hardcoded seed ──
    const freshTag = await page.evaluate(async () => {
      const num = await import('/src/project/numbering.ts');
      const cfg = num.normalizeNumbering(undefined);
      const sheet = { id: 's', name: 's', order: 0, nodes: [], edges: [] };
      return { first: num.nextTagFor('V', [sheet], cfg.tags), start: cfg.tags.defaultStart };
    });
    check(
      'b. an empty project still gives V-101 for the first vessel (no config = old behaviour)',
      freshTag.first === 'V-101' && freshTag.start === 101,
      `first vessel = ${freshTag.first}, defaultStart = ${freshTag.start}`,
    );

    // ── (c) THE SEQUENCE IS PER-AREA, NOT PER-SERVICE ──
    const perArea = await page.evaluate(async () => {
      const num = await import('/src/project/numbering.ts');
      const ln = await import('/src/validation/lineNumbers.ts');
      // The reference drawing's own data: 710.01 on DIC2, 710.20 on JAC, and
      // 710.01A on LPS2. Area 710's highest running number is 20.
      const existing = [
        '1"-DIC2-710.01-300-HC',
        '1 1/2"-LPS2-710.01A-300-HC',
        '3"-JAC-710.20-300-HC',
        '3"-BL-710.05-320-',
        '3/4"-NI-7210B-315-',
      ];
      const highest710 = num.highestSequenceInArea('710', existing);
      const highest7210 = num.highestSequenceInArea('7210', existing);

      // A new line in area 710 must continue from 20, ACROSS services — not
      // restart at 1 because its service code differs from every existing one.
      const sheets = [{
        id: 's', name: 's', order: 0, nodes: [],
        edges: existing.map((n, i) => ({ id: `e${i}`, source: '', target: '', data: { lineNumber: n } })),
      }];
      const scheme = { ...num.DEFAULT_LINE_NUMBERING, area: '710', defaultService: 'CW', sequencePad: 2 };
      const next = num.nextLineNumber(sheets, scheme);
      const round = next ? ln.formatLineNumber(ln.parseLineNumber(next).parts) === next : false;
      return { highest710, highest7210, next, round };
    });
    check(
      'c. sequence is PER-AREA across services (area 710 has DIC2/LPS2/JAC; next continues from 20, not 1)',
      perArea.highest710 === 20 && perArea.highest7210 === null && perArea.next === '2"-CW-710.21-300-HC' && perArea.round,
      `highest in 710 = ${perArea.highest710}, in 7210 = ${perArea.highest7210}, next = ${perArea.next} (round-trips: ${perArea.round})`,
    );

    // ── (d) NUMBERING NEVER DUPLICATES (lowered start = the collision case) ──
    const noDup = await page.evaluate(async () => {
      const num = await import('/src/project/numbering.ts');
      const sheet = {
        id: 's', name: 's', order: 0, edges: [],
        nodes: [101, 102, 103, 104].map((n) =>
          ({ id: `n${n}`, type: 'equipment', position: { x: 0, y: 0 },
             data: { kind: 'vessel-vertical', tag: `V-${n}`, width: 90, height: 200, rotation: 0, properties: {} } })),
      };
      // Start LOWERED below tags that already exist — a naive start+counter
      // would hand back V-101, which is taken.
      const lowered = { defaultStart: 101, step: 1, prefixStarts: { V: 101 } };
      const next = num.nextTagFor('V', [sheet], lowered);
      const taken = new Set(sheet.nodes.map((n) => n.data.tag));
      // And with a longer step, still must not collide.
      const spaced = num.nextTagFor('V', [sheet], { defaultStart: 101, step: 10, prefixStarts: {} });
      return { next, collided: taken.has(next), spaced, spacedCollided: taken.has(spaced) };
    });
    check(
      'd. auto-numbering never proposes an existing tag, even with a lowered start',
      !noDup.collided && !noDup.spacedCollided,
      `with start=101 over V-101..104 -> ${noDup.next} (collision: ${noDup.collided}); with step=10 -> ${noDup.spaced} (collision: ${noDup.spacedCollided})`,
    );

    // ── (e) step / per-prefix seeds / padding all take effect ──
    const configured = await page.evaluate(async () => {
      const num = await import('/src/project/numbering.ts');
      const empty = [{ id: 's', name: 's', order: 0, nodes: [], edges: [] }];
      const seeded = num.nextTagFor('P', empty, { defaultStart: 101, step: 1, prefixStarts: { P: 201 } });
      const spaced = num.nextTagFor('K', empty, { defaultStart: 101, step: 10, prefixStarts: {} });
      const padded = num.padSequence(1, 4);
      return { seeded, spaced, padded };
    });
    check(
      'e. per-type seed (P from 201) and step (10) and padding (4) are honoured',
      configured.seeded === 'P-201' && configured.spaced === 'K-101' && configured.padded === '0001',
      `P-201? ${configured.seeded}; step-10 first = ${configured.spaced}; pad(1,4) = ${configured.padded}`,
    );

    // ── (f) bulk numbering fills blanks ONLY, in reading order ──
    const bulk = await page.evaluate(async () => {
      const num = await import('/src/project/numbering.ts');
      const sheet = {
        id: 's', name: 's', order: 0,
        nodes: [
          { id: 'a', type: 'equipment', position: { x: 0, y: 400 }, data: { kind: 'vessel-vertical', tag: 'V-101', width: 90, height: 200, rotation: 0, properties: {} } },
          { id: 'b', type: 'equipment', position: { x: 300, y: 400 }, data: { kind: 'vessel-vertical', tag: 'V-102', width: 90, height: 200, rotation: 0, properties: {} } },
          { id: 'c', type: 'equipment', position: { x: 0, y: 0 }, data: { kind: 'vessel-vertical', tag: 'V-103', width: 90, height: 200, rotation: 0, properties: {} } },
          { id: 'd', type: 'equipment', position: { x: 300, y: 0 }, data: { kind: 'vessel-vertical', tag: 'V-104', width: 90, height: 200, rotation: 0, properties: {} } },
        ],
        edges: [
          // Already numbered — must be left exactly as-is.
          { id: 'keep', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left',
            data: { lineType: 'process', lineNumber: '1"-LPS2-710.01A-300-HC' } },
          // Lower pair (larger Y) — must be numbered AFTER the upper pair.
          { id: 'lower1', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left', data: { lineType: 'process' } },
          { id: 'lower2', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left', data: { lineType: 'process' } },
          // Upper pair — numbered first (reading order: top of sheet first).
          { id: 'upper1', source: 'c', target: 'd', sourceHandle: 'right', targetHandle: 'left', data: { lineType: 'process' } },
          { id: 'upper2', source: 'c', target: 'd', sourceHandle: 'right', targetHandle: 'left', data: { lineType: 'process' } },
          // A free line is not a numbered run.
          { id: 'free', source: '', target: '', data: { lineType: 'process', freePipe: true, freeStart: { x: 0, y: 0 }, freeEnd: { x: 10, y: 10 } } },
        ],
      };
      const scheme = { ...num.DEFAULT_LINE_NUMBERING, area: '710', defaultService: 'PROC', sequencePad: 2, pipingClass: '300', insulation: 'HC' };
      const plan = num.planUnnumberedLines(sheet, scheme);
      return {
        planned: plan.length,
        byEdge: plan.map((p) => [p.edgeId, p.proposal]),
        numbered: plan.filter((p) => p.proposal).length,
      };
    });
    const byEdge = new Map(bulk.byEdge);
    check(
      'f. bulk numbering fills ONLY unnumbered lines, skips free lines, and follows reading order (top first)',
      bulk.numbered === 4 &&
        !byEdge.has('keep') &&
        !byEdge.has('free') &&
        // The already-numbered line sits at area 710 sequence 01, so the
        // first free number is 02 — this doubles as proof that an existing
        // number is counted as taken rather than overwritten.
        byEdge.get('upper1') === '2"-PROC-710.02-300-HC' &&
        byEdge.get('upper2') === '2"-PROC-710.03-300-HC' &&
        byEdge.get('lower1') === '2"-PROC-710.04-300-HC' &&
        byEdge.get('lower2') === '2"-PROC-710.05-300-HC',
      `planned ${bulk.planned} (${bulk.numbered} numbered): ${bulk.byEdge.map(([id, n]) => `${id}=${n}`).join(', ')}`,
    );

    // ── (g) a scheme that cannot round-trip returns null, not a broken string ──
    const badScheme = await page.evaluate(async () => {
      const num = await import('/src/project/numbering.ts');
      const empty = [{ id: 's', name: 's', order: 0, nodes: [], edges: [] }];
      // An area containing a dash splits into the wrong grammar field.
      const broken = num.nextLineNumber(empty, { ...num.DEFAULT_LINE_NUMBERING, area: '12-6' });
      const ok = num.nextLineNumber(empty, { ...num.DEFAULT_LINE_NUMBERING, area: '710' });
      return { broken, ok };
    });
    check(
      'g. an unroundtrippable scheme yields null (not an unparseable line number)',
      badScheme.broken === null && typeof badScheme.ok === 'string',
      `area "12-6" -> ${JSON.stringify(badScheme.broken)}; area "710" -> ${badScheme.ok}`,
    );

    // ── (h) numbering survives a JSON save/load round-trip ──
    const persisted = await page.evaluate(async () => {
      const ser = await import('/src/project/serialize.ts');
      const num = await import('/src/project/numbering.ts');
      const project = {
        version: 2,
        projectName: 'Numbering Persist',
        numbering: {
          tags: { defaultStart: 501, step: 5, prefixStarts: { V: 301, P: 401 } },
          lines: { ...num.DEFAULT_LINE_NUMBERING, area: '999', pipingClass: '1500', insulation: 'ET', sequenceStart: 7, sequencePad: 3 },
        },
        sheets: [{ id: 's', name: 'Sheet 1', order: 0, nodes: [], edges: [] }],
      };
      const json = ser.projectToJson(project);
      const back = ser.parseProjectJson(json);
      if (!back.ok) return { ok: false, errors: back.errors };
      const cfg = num.normalizeNumbering(back.project.numbering);
      return {
        ok: true,
        tags: cfg.tags,
        area: cfg.lines.area,
        cls: cfg.lines.pipingClass,
        ins: cfg.lines.insulation,
        pad: cfg.lines.sequencePad,
        start: cfg.lines.sequenceStart,
      };
    });
    check(
      'h. numbering config survives JSON save/load intact',
      persisted.ok &&
        persisted.tags.defaultStart === 501 &&
        persisted.tags.step === 5 &&
        persisted.tags.prefixStarts.V === 301 &&
        persisted.tags.prefixStarts.P === 401 &&
        persisted.area === '999' && persisted.cls === '1500' &&
        persisted.ins === 'ET' && persisted.pad === 3 && persisted.start === 7,
      persisted.ok
        ? `tags=${JSON.stringify(persisted.tags)} lines={area:${persisted.area}, cls:${persisted.cls}, ins:${persisted.ins}, pad:${persisted.pad}, start:${persisted.start}}`
        : `LOAD FAILED: ${(persisted.errors || []).join(' | ')}`,
    );

    // ── (i) garbage in a numbering block is repaired, never fatal ──
    const garbage = await page.evaluate(async () => {
      const num = await import('/src/project/numbering.ts');
      const c = num.normalizeNumbering({
        tags: { defaultStart: 'nonsense', step: -3, prefixStarts: { V: 'x', P: 401, T: null, K: -5 } },
        lines: { area: 42, pipingClass: null, sequencePad: 0, step: 0 },
      });
      return c;
    });
    check(
      'i. malformed config is repaired to defaults (bad numbers/strings ignored, partial config kept)',
      garbage.tags.defaultStart === 101 && garbage.tags.step === 1 &&
        garbage.tags.prefixStarts.P === 401 && garbage.tags.prefixStarts.V === undefined &&
        garbage.tags.prefixStarts.T === undefined && garbage.tags.prefixStarts.K === undefined &&
        garbage.lines.area === '710' && garbage.lines.sequencePad === 2 && garbage.lines.step === 1,
      `tags=${JSON.stringify(garbage.tags)} lines={area:${garbage.lines.area}, pad:${garbage.lines.sequencePad}, step:${garbage.lines.step}}`,
    );

    // ── (j) the UI opens, previews, and the bulk button is wired ──
    await seedProject(page, {
      projectName: 'Numbering UI',
      sheets: [{
        id: 'sh-1', name: 'Sheet 1', order: 0,
        nodes: [node('n-v', 'vessel-vertical', 'V-101', 80, 80, 90, 200),
                node('n-p', 'pump-centrifugal', 'P-101', 420, 120, 70, 70)],
        edges: [edge('e-1', 'n-v', 'n-p', 'right', 'left', undefined)],
      }],
    });
    await page.click('[data-testid="open-numbering-btn"]');
    await page.waitForTimeout(400);
    const ui = await page.evaluate(() => {
      const txt = (sel) => document.querySelector(sel)?.textContent?.trim() ?? '';
      const tags = [...document.querySelectorAll('[data-testid="numbering-tag-preview"] code')].map((c) => c.textContent.trim());
      const lines = [...document.querySelectorAll('[data-testid="numbering-line-preview"] code')].map((c) => c.textContent.trim());
      return {
        open: !!document.querySelector('[data-testid="numbering-overlay"]'),
        pattern: txt('[data-testid="numbering-line-pattern"]'),
        tagPreviews: tags,
        linePreviews: lines,
        hasPrefixV: !!document.querySelector('[data-testid="numbering-prefix-V"]'),
        hasPrefixP: !!document.querySelector('[data-testid="numbering-prefix-P"]'),
        bulkLabel: txt('[data-testid="number-unnumbered-btn"]'),
      };
    });
    check(
      'j. settings panel opens with live previews for the tags and lines actually on the drawing',
      ui.open &&
        ui.hasPrefixV && ui.hasPrefixP &&
        ui.tagPreviews.includes('V-102') && ui.tagPreviews.includes('P-102') &&
        ui.linePreviews.length >= 2 &&
        /1 unnumbered line/.test(ui.bulkLabel),
      `tag previews [${ui.tagPreviews.join(', ')}], line previews [${ui.linePreviews.join(', ')}], bulk="${ui.bulkLabel}"`,
    );

    // ── (k) changing a setting changes the preview (proof they're wired) ──
    // STEP is asserted here, not defaultStart: the documented rule is that
    // `defaultStart` seeds a prefix with NO existing items, and this fixture
    // already has V-101 and P-101, so next = max + step = 102 regardless of
    // the start value. Step changes the answer in every case.
    await page.fill('[data-testid="numbering-tag-step"]', '5');
    await page.waitForTimeout(300);
    const afterChange = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="numbering-tag-preview"] code')].map((c) => c.textContent.trim()));
    check(
      'k. editing the scheme updates the live preview (step 1 -> 5 moves V-102 to V-106)',
      afterChange.includes('V-106') && afterChange.includes('P-106'),
      `previews after setting step=5: [${afterChange.join(', ')}]`,
    );

    // ── (l) bulk-number from the UI actually writes to the drawing ──
    await page.click('[data-testid="number-unnumbered-btn"]');
    // The autosave debounce is ~1s (AUTOSAVE_DEBOUNCE_MS), so this must outwait
    // it — reading sooner sees the previous write and reports a false failure.
    await page.waitForTimeout(1800);
    const afterBulk = await page.evaluate(async () => {
      const raw = window.localStorage.getItem('pid-drafter.project.autosave.v2');
      const parsed = raw ? JSON.parse(raw) : null;
      const sheet = parsed?.sheets?.[0];
      return {
        bulkResult: document.querySelector('[data-testid="numbering-bulk-result"]')?.textContent?.trim() ?? '',
        lineNumbers: (sheet?.edges ?? []).map((e) => e.data?.lineNumber ?? null),
      };
    });
    check(
      'l. the bulk button assigns a number to the unnumbered line and reports what it did',
      afterBulk.lineNumbers.length === 1 &&
        typeof afterBulk.lineNumbers[0] === 'string' &&
        /Numbered 1 line/.test(afterBulk.bulkResult),
      `line numbers now [${afterBulk.lineNumbers.join(', ')}]; result text "${afterBulk.bulkResult}"`,
    );

    // ── (m) AREA tag style reproduces the reference drawing's own equipment tags ──
    // The real drawing tags equipment `P-710.01A/B` and `D-710.2.01A` — an
    // area-form tag carrying the SAME area as its line numbers. A numbering
    // feature that can only produce `V-101` cannot express the house standard
    // it was measured against, so this is the difference between "configurable"
    // and "configurable for one convention".
    const areaStyle = await page.evaluate(async () => {
      const num = await import('/src/project/numbering.ts');
      const mk = (tag) => ({ id: tag, type: 'equipment', position: { x: 0, y: 0 },
        data: { kind: 'vessel-vertical', tag, width: 90, height: 200, rotation: 0, properties: {} } });

      // Real tags from X-00000-000-01: two parallel pumps, two parallel vessels.
      const sheet = {
        id: 's', name: 's', order: 0, edges: [],
        nodes: [
          mk('P-710.01A'), mk('P-710.01B'),
          mk('D-710.2.01A'), mk('D-710.2.01B'),
          mk('P-711.01A'),                       // a DIFFERENT area must not advance area 710
          mk('E-710.01'),                        // area 710, different prefix
        ],
      };
      const base = num.DEFAULT_TAG_NUMBERING;
      const scheme = { ...base, style: 'area', area: '710', sequencePad: 2, suffix: '', defaultStart: 1 };

      const nextP = num.nextTagFor('P', [sheet], scheme);         // -> P-710.02 (highest in 710 is 1)
      const nextD = num.nextTagFor('D', [sheet], scheme);         // -> D-710.2.02 (two-level)
      const nextE = num.nextTagFor('E', [sheet], scheme);         // -> E-710.02
      const nextK = num.nextTagFor('K', [sheet], scheme);         // none exist -> starts at 01
      const nextP711 = num.nextTagFor('P', [sheet], { ...scheme, area: '711' }); // must be 711.02

      // With a suffix, parallel units are expressible.
      const suffixed = num.nextTagFor('K', [sheet], { ...scheme, suffix: 'A' });

      const taken = new Set(sheet.nodes.map((n) => n.data.tag));
      return {
        nextP, nextD, nextE, nextK, nextP711, suffixed,
        collided: [nextP, nextD, nextE, nextK, nextP711].some((t) => taken.has(t)),
      };
    });
    check(
      'm. AREA tag style reproduces the drawing (P-710.01A/B -> P-710.02; D-710.2.01A -> D-710.2.02; areas independent)',
      areaStyle.nextP === 'P-710.02' &&
        areaStyle.nextD === 'D-710.2.02' &&
        areaStyle.nextE === 'E-710.02' &&
        areaStyle.nextK === 'K-710.01' &&
        areaStyle.nextP711 === 'P-711.02' &&
        areaStyle.suffixed === 'K-710.01A' &&
        !areaStyle.collided,
      `P->${areaStyle.nextP}, D->${areaStyle.nextD}, E->${areaStyle.nextE}, K(new)->${areaStyle.nextK}, P@711->${areaStyle.nextP711}, suffix->${areaStyle.suffixed}`,
    );

    // ── (n) switching style changes what a dropped node is tagged ──
    await page.click('[data-testid="numbering-close"]');
    await page.waitForTimeout(200);
    await page.click('[data-testid="open-numbering-btn"]');
    await page.waitForTimeout(300);
    await page.selectOption('[data-testid="numbering-tag-style"]', 'area');
    await page.waitForTimeout(350);
    const areaUi = await page.evaluate(() => {
      const tags = [...document.querySelectorAll('[data-testid="numbering-tag-preview"] code')].map((c) => c.textContent.trim());
      return {
        hasAreaField: !!document.querySelector('[data-testid="numbering-tag-area"]'),
        hasSuffixField: !!document.querySelector('[data-testid="numbering-tag-suffix"]'),
        tags,
      };
    });
    check(
      'n. choosing the area style reveals area/pad/suffix fields and previews area-form tags',
      areaUi.hasAreaField && areaUi.hasSuffixField &&
        areaUi.tags.length > 0 && areaUi.tags.every((t) => /-710\.\d/.test(t)),
      `fields shown: area=${areaUi.hasAreaField} suffix=${areaUi.hasSuffixField}; previews [${areaUi.tags.join(', ')}]`,
    );

    const pageErrs = errors.filter((e) => !/DevTools|favicon/i.test(e));
    if (pageErrs.length) console.log('\npage errors: ' + pageErrs.slice(0, 4).join(' | '));

    const failed = results.filter((x) => !x.pass);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    const ok = failed.length === 0 && pageErrs.length === 0;
    console.log(ok ? 'NUMBERING_PASS' : 'NUMBERING_FAIL');
    process.exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('runner error:', e.message);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();

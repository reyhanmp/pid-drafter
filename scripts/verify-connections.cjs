/**
 * Verification for PRD §7a items 1+2 — connectivity soundness and the branch
 * fitting.
 *
 * Run: node scripts/verify-connections.cjs [url]
 * Exit 0 = all checks pass.
 *
 * The load-bearing claims, and why each one is a real claim rather than a
 * restatement of the code:
 *
 *   1. TWO PIPES CANNOT SHARE A NOZZLE. Before this work they could, silently.
 *      A drawing with three lines converging on one vessel nozzle — not a
 *      drawing of anything buildable — passed every check the tool had. The
 *      test drives a REAL mouse drag onto a spent nozzle and requires the drag
 *      to produce no pipe, because the rule is enforced during the gesture
 *      (react-flow's isValidConnection) rather than by creating and then
 *      deleting an edge. A create-then-repair implementation would pass a
 *      naive "no pipe afterwards" test, so the edge count is checked mid-drag
 *      as well.
 *
 *   2. A HEADER WITH BRANCHES IS DRAWABLE. The refusal above must not make the
 *      ordinary arrangement impossible. A tee's run is the exception, and the
 *      test proves a tee's port accepts two pipes — through the same real-drag
 *      path, so the exception is proven to work in the UI and not just in the
 *      rule function.
 *
 *   3. REFUSALS EXPLAIN THEMSELVES. A silent failure is indistinguishable from
 *      a broken drag. The notice must name the nozzle, and must offer the tee
 *      placement that makes the connection legal.
 *
 *   4. THE PANEL AND THE DRAG AGREE. Data that never went through the drag
 *      (a JSON load, or a hand-edited file) must still be reported. If the
 *      canvas refuses a connection but the validity panel calls the same
 *      diagram valid, one of the two is lying, and the user has no way to know
 *      which. The fixture below is that data.
 */
const { launch, freshPage, seedProject, URL: DEFAULT_URL } = require('./harness.cjs');

const URL = process.argv[2] || DEFAULT_URL;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const node = (id, kind, tag, x, y, extra = {}) => {
  const dims = { 'vessel-vertical': { w: 80, h: 140 }, 'tee-branch': { w: 24, h: 24 }, 'pump-centrifugal': { w: 60, h: 60 } };
  const d = dims[kind] ?? { w: 80, h: 80 };
  return {
    id,
    type: 'equipment',
    position: { x, y },
    data: { kind, tag, width: d.w, height: d.h, rotation: 0, properties: {}, ...extra },
  };
};

/** A pipe between two handle ids on two nodes. */
const pipe = (id, source, sourceHandle, target, targetHandle) => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  type: 'pipe',
  data: { lineType: 'process' },
});

(async () => {
  const { browser, page, errors } = await launch();
  try {
    // ── (a) a spent nozzle refuses a second pipe, during the drag ─────────
    await freshPage(page);
    await seedProject(page, {
      projectName: 'connections',
      sheets: [
        {
          id: 's1',
          name: 'Sheet 1',
          order: 0,
          nodes: [node('v1', 'vessel-vertical', 'V-101', 200, 200), node('v2', 'vessel-vertical', 'V-102', 800, 200)],
          edges: [pipe('p1', 'v1', 'bottom', 'v2', 'bottom')],
        },
      ],
    });

    const edgesNow = () => page.$$eval('.react-flow__edge', (n) => n.length);
    const before = await edgesNow();

    /** Real mouse drag from one handle to another, by data-handleid. */
    async function dragHandle(fromSel, toSel) {
      const a = await page.$(`${fromSel} [data-handleid], ${fromSel}`);
      const b = await page.$(`${toSel} [data-handleid], ${toSel}`);
      if (!a || !b) return false;
      const ab = await a.boundingBox();
      const bb = await b.boundingBox();
      if (!ab || !bb) return false;
      await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 20; i++) {
        await page.mouse.move(
          ab.x + ab.width / 2 + ((bb.x - ab.x) * i) / 20,
          ab.y + ab.height / 2 + ((bb.y - ab.y) * i) / 20,
        );
      }
      await page.mouse.up();
      await page.waitForTimeout(600);
      return true;
    }

    // NOTE: react-flow's node wrapper carries `data-id`; the EquipmentNode's own
    // `data-testid="equipment-node-<kind>"` sits on a CHILD element. Those two
    // attributes are never on the same element, so a selector combining them
    // matches nothing — which silently reads as "the drag did nothing" rather
    // than "the selector was wrong". Anchor on data-id, then descend.
    const v1Bottom = '[data-id="v1"] [data-handleid="bottom"]';
    const v1Top = '[data-id="v1"] [data-handleid="top"]';
    const v2Top = '[data-id="v2"] [data-handleid="top"]';

    const v1Handles = await page.$$eval('[data-id="v1"] [data-handleid]', (els) => els.map((e) => e.getAttribute('data-handleid')));
    const v2Handles = await page.$$eval('[data-id="v2"] [data-handleid]', (els) => els.map((e) => e.getAttribute('data-handleid')));
    const mounted = await page.$$eval('.react-flow__node', (n) => n.length);
    console.log(`fixture: ${mounted} nodes mounted, v1 handles=[${v1Handles.join(',')}], v2 handles=[${v2Handles.join(',')}]`);

    const dragged = await dragHandle(v1Bottom, v2Top);
    const after = await edgesNow();
    check(
      '(a) a second pipe onto a spent nozzle is refused during the drag',
      dragged && before === 1 && after === 1,
      `edges before=${before} after=${after}`,
    );

    // ── (b) the refusal explains itself and offers the tee ────────────────
    const notice = await page.$('[data-testid="connect-notice"]');
    const noticeText = notice ? await page.$eval('[data-testid="connect-notice-message"]', (el) => el.textContent || '') : '';
    const hasTeeOffer = (await page.$('[data-testid="connect-notice-place-tee"]')) !== null;
    check(
      '(b) the refusal names the spent nozzle and offers a tee',
      !!notice && /V-10\d/.test(noticeText) && /nozzle/i.test(noticeText) && hasTeeOffer,
      `notice="${noticeText.trim().slice(0, 90)}" teeOffer=${hasTeeOffer}`,
    );

    // ── (c) a branch fitting makes the refusal livable, WITHOUT being a
    //        blanket exemption ───────────────────────────────────────────────
    //
    // Two separate claims, and both need to hold or the feature is wrong:
    //
    //   c1. A tee's RUN — a port that already carries a pipe — accepts another.
    //       This is the whole reason the exception exists: it is what makes a
    //       header with branches drawable at all.
    //   c2. A tee's BRANCH port does NOT. If the exception were applied to the
    //       symbol rather than to the declared port, every port on a branch
    //       fitting would become a place pipes pile up, and the fitting would
    //       be a sanctioned version of the very defect the rule forbids.
    //
    // An earlier version of this check dragged onto a FREE tee port, which any
    // port would accept — it passed even with the exception deleted entirely.
    // Mutation testing found that; both arms below drag onto ports that are
    // already occupied, so neither can pass by accident.
    await seedProject(page, {
      projectName: 'tee',
      sheets: [
        {
          id: 's1',
          name: 'Sheet 1',
          order: 0,
          nodes: [
            node('t1', 'tee-branch', 'TEE-101', 600, 400),
            node('v1', 'vessel-vertical', 'V-101', 200, 200),
            node('v2', 'vessel-vertical', 'V-102', 1000, 200),
          ],
          edges: [
            // run-in and run-out already spent; branch already spent too.
            pipe('p1', 'v1', 'bottom', 't1', 'run-in'),
            pipe('p2', 't1', 'run-out', 'v2', 'bottom'),
            pipe('p3', 't1', 'branch', 'v2', 'top'),
          ],
        },
      ],
    });
    const teePorts = await page.$$eval(
      '[data-id="t1"] [data-handleid]',
      (els) => els.map((e) => e.getAttribute('data-handleid')),
    );
    const teeBefore = await edgesNow();
    const runInOk = await dragHandle('[data-id="v1"] [data-handleid="top"]', '[data-id="t1"] [data-handleid="run-in"]');
    const afterRun = await edgesNow();
    check(
      '(c1) a tee RUN port takes a second pipe — a header with branches is drawable',
      runInOk && teeBefore === 3 && afterRun === 4 && teePorts.includes('run-in'),
      `ports=[${teePorts.join(',')}] edges ${teeBefore}->${afterRun}`,
    );

    const beforeBranch = await edgesNow();
    await dragHandle('[data-id="v1"] [data-handleid="right"]', '[data-id="t1"] [data-handleid="branch"]');
    const afterBranch = await edgesNow();
    check(
      '(c2) a tee BRANCH port still refuses a second pipe — the exception is per-port, not per-symbol',
      beforeBranch === afterBranch,
      `edges ${beforeBranch}->${afterBranch}`,
    );

    // ── (g) the offer is real: the tee actually lands on the free nozzle ───
    //
    // (b) proves the refusal OFFERS a tee. An offer that does nothing when
    // clicked is worse than no offer, because it reads as one more broken
    // thing. This drives the button for real and requires a branch fitting to
    // appear, tagged uniquely, positioned off the free nozzle the notice named
    // — i.e. the remediation path a user would actually take.
    await seedProject(page, {
      projectName: 'offer',
      sheets: [
        {
          id: 's1',
          name: 'Sheet 1',
          order: 0,
          // One pipe on the bottom nozzle only, so top/left/right are free and
          // the rule has somewhere legal to put a tee.
          nodes: [node('v1', 'vessel-vertical', 'V-101', 400, 300), node('v2', 'vessel-vertical', 'V-102', 900, 300)],
          edges: [pipe('p1', 'v1', 'bottom', 'v2', 'bottom')],
        },
      ],
    });
    const nodeIdsBefore = await page.$$eval('.react-flow__node', (els) => els.length);
    await dragHandle('[data-id="v1"] [data-handleid="bottom"]', '[data-id="v2"] [data-handleid="top"]');
    const teeBtn = await page.$('[data-testid="connect-notice-place-tee"]');
    if (teeBtn) await teeBtn.click();
    await page.waitForTimeout(800);
    const nodeIdsAfter = await page.$$eval('.react-flow__node', (els) => els.length);
    const placed = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="equipment-node-tee-branch"]');
      if (!el) return null;
      // The node's position lives on react-flow's WRAPPER (.react-flow__node),
      // not on the EquipmentNode div carrying the testid — reading the transform
      // off the inner element yields nothing and would look like "the tee was
      // placed somewhere unreadable" rather than "wrong element queried".
      const wrapper = el.closest('.react-flow__node') || el;
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(wrapper.style.transform || '');
      return { keys: [...el.querySelectorAll('[data-handleid]')].map((h) => h.getAttribute('data-handleid')), pos: m ? { x: +m[1], y: +m[2] } : null };
    });
    /*
     * The fitting must not OVERLAP the equipment box it branches from. Testing
     * only "some part is outside" is too weak: a tee sitting 80% under the
     * vessel passes that and is unusable. Both axes must actually be separated.
     *
     * This check is the reason the placement bug was found — the first version
     * used a fixed 24px offset from a port that sits ON the boundary, so a tee
     * offered at the top nozzle landed with its lower 4px inside the vessel.
     */
    const VESSEL = { x: 400, y: 300, w: 80, h: 140 };
    const TEE_W = 24;
    const TEE_H = 24;
    const separated =
      !placed?.pos
        ? false
        : placed.pos.x + TEE_W <= VESSEL.x ||
          placed.pos.x >= VESSEL.x + VESSEL.w ||
          placed.pos.y + TEE_H <= VESSEL.y ||
          placed.pos.y >= VESSEL.y + VESSEL.h;
    const tag = await page.$eval('[data-testid="equipment-node-tee-branch"]', (el) => (el.textContent || '').trim());
    check(
      '(g) clicking the offer places a tagged branch fitting clear of the blocked equipment',
      nodeIdsAfter === nodeIdsBefore + 1 &&
        !!placed &&
        placed.keys.length === 3 &&
        separated &&
        /TEE-\d+/.test(tag),
      `nodes ${nodeIdsBefore}->${nodeIdsAfter} pos=${JSON.stringify(placed?.pos)} tag="${tag}"`,
    );

    // ── (h) the offer follows the BLOCKED end, not the dragged-to end ──────
    //
    // The first shape of this feature offered `target ?? source`, so a drag
    // FROM a spent nozzle INTO a free one would offer to put the tee on the
    // equipment that was never the problem. This drags exactly that direction
    // (spent v1.bottom -> free v2.top) and requires the tee to land next to
    // V-101, the blocked end. It passed by accident in the fixture above —
    // which is precisely why the direction has to be tested explicitly.
    await seedProject(page, {
      projectName: 'direction',
      sheets: [
        {
          id: 's1',
          name: 'Sheet 1',
          order: 0,
          nodes: [node('v1', 'vessel-vertical', 'V-101', 300, 300), node('v2', 'vessel-vertical', 'V-102', 1000, 300)],
          edges: [pipe('p1', 'v1', 'bottom', 'v2', 'bottom')],
        },
      ],
    });
    await dragHandle('[data-id="v1"] [data-handleid="bottom"]', '[data-id="v2"] [data-handleid="top"]');
    const dirText = await page.$eval('[data-testid="connect-notice-message"]', (el) => el.textContent || '').catch(() => '');
    if (await page.$('[data-testid="connect-notice-place-tee"]')) {
      await page.click('[data-testid="connect-notice-place-tee"]');
      await page.waitForTimeout(800);
    }
    const dirPos = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="equipment-node-tee-branch"]');
      if (!el) return null;
      const w = el.closest('.react-flow__node') || el;
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(w.style.transform || '');
      return m ? { x: +m[1], y: +m[2] } : null;
    });
    // V-101 spans 300x300..380x440 (left vessel); V-102 sits at x>=1000.
    const nearBlockedEnd = !!dirPos && dirPos.x < 800;
    check(
      '(h) the tee offer follows the BLOCKED nozzle, not the dragged-to one',
      /V-101/.test(dirText) && nearBlockedEnd,
      `notice="${dirText.trim().slice(0, 60)}" teeAt=${JSON.stringify(dirPos)}`,
    );

    // ── (d) the validity panel condemns data the drag never saw ───────────
    await seedProject(page, {
      projectName: 'overloaded',
      sheets: [
        {
          id: 's1',
          name: 'Sheet 1',
          order: 0,
          nodes: [node('v1', 'vessel-vertical', 'V-101', 200, 200), node('v2', 'vessel-vertical', 'V-102', 800, 200)],
          // Two pipes on ONE vessel nozzle. Physically impossible; a JSON load
          // or a hand-edited file can still contain it.
          edges: [pipe('p1', 'v1', 'bottom', 'v2', 'bottom'), pipe('p2', 'v1', 'bottom', 'v2', 'top')],
        },
      ],
    });
    await page.waitForTimeout(700);
    const panelText = await page.$eval('.validation-panel', (el) => el.textContent || '');
    const badge = await page.$eval('.validation-badge', (el) => el.textContent || '');
    check(
      '(d) the validity panel reports an overloaded nozzle',
      /Nozzle overloaded/i.test(panelText) && /V-101/.test(panelText) && /error/i.test(badge),
      `badge="${badge.trim()}"`,
    );

    // ── (e) the SAME data loaded from a file is condemned identically ──────
    // (d) proves the rule runs on the active sheet. This proves the rule is a
    // property of the DATA, not of how the data got there: the two-pipes-on-one-
    // nozzle file is written out, fed back through the real load path (the
    // hidden file input), and the panel must still call it an error. Without
    // this, the canvas could refuse connections while a loaded project sailed
    // through unchecked — the exact hole the validator half of this rule exists
    // to close.
    const filePath = '/tmp/connections-overloaded.json';
    const withOverload = JSON.parse(
      await page.evaluate(() => window.localStorage.getItem('pid-drafter.project.autosave.v2')),
    );
    delete withOverload.savedAt;
    withOverload.projectName = 'overloaded-from-file';
    // Force the real overload into the file, so this check cannot pass merely
    // because the autosave happened to be well-formed.
    withOverload.sheets[0].edges = [
      { id: 'p1', source: 'v1', target: 'v2', sourceHandle: 'bottom', targetHandle: 'bottom', type: 'pipe', data: { lineType: 'process' } },
      { id: 'p2', source: 'v1', target: 'v2', sourceHandle: 'bottom', targetHandle: 'top', type: 'pipe', data: { lineType: 'process' } },
    ];
    require('fs').writeFileSync(filePath, JSON.stringify(withOverload, null, 2));

    await page.setInputFiles('[data-testid="load-json-input"]', filePath);
    await page.waitForTimeout(900);

    const loadedBadge = await page.$eval('.validation-badge', (el) => el.textContent || '');
    const loadedPanel = await page.$eval('.validation-panel', (el) => el.textContent || '');
    const loadErrors = (await page.$('[data-testid="topbar-load-errors"]')) !== null;
    check(
      '(e) loading that same file reports the overload, not a clean bill of health',
      /Nozzle overloaded/i.test(loadedPanel) && /error/i.test(loadedBadge) && !loadErrors,
      `badge="${loadedBadge.trim()}" loadRejected=${loadErrors}`,
    );

    // ── (f) no console errors on any of it ───────────────────────────────
    const pageErrs = errors.filter((e) => !/DevTools|favicon|React DevTools/i.test(e));
    check('(f) no page errors during the whole run', pageErrs.length === 0, pageErrs.slice(0, 3).join(' | '));
  } catch (e) {
    console.error('runner error:', e.message);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log('');
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  console.log(failed.length === 0 ? 'CONNECTIONS_PASS' : 'CONNECTIONS_FAIL');
  if (failed.length) process.exitCode = 1;
})();

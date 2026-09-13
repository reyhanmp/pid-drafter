/**
 * Verification for undo/redo (PRD §8's deferral, re-taken).
 *
 * Run: node scripts/verify-undo.cjs [url]
 * Exit 0 = all checks pass.
 *
 * Driven by REAL mouse input through Playwright, never synthetic DOM events:
 * React Flow's drag handling binds move listeners on `window`, so a dispatched
 * event from script does not move a node. A gate that fakes the input would
 * pass while the feature is broken in the user's hands.
 *
 * The load-bearing claims, in order of how badly they'd hurt if wrong:
 *
 *   1. A DRAG UNDOES TO WHERE IT STARTED. This is the bug the first build had:
 *      mid-drag frames are applied without history (they are not user intent on
 *      their own), so recording at drag END snapshots a project that already
 *      holds the node near its final position — and undo becomes a visible
 *      no-op. The position is therefore compared numerically, not by node count:
 *      a no-op undo leaves the node count unchanged and would pass a lax test.
 *
 *   2. ONE GESTURE = ONE UNDO STEP. 40 mousemoves must add exactly one step.
 *      Per-change recording gives one step per pixel, which makes undo useless
 *      precisely when a user needs it. Measured as a DEPTH DELTA, because the
 *      final drawing looks identical either way.
 *
 *   3. DELETING A NODE WITH PIPES IS ONE STEP AND FULLY REVERSIBLE. React Flow
 *      emits the pipe removal and the node removal as two callbacks (pipe
 *      FIRST — measured, and the opposite of the intuitive order). Recorded
 *      separately, the first undo restores the node while its pipe stays gone:
 *      a state the user never created, with no undo path back to the intact
 *      drawing. Asserted as "one undo restores BOTH".
 *
 *   4. SELECTION IS NOT AN UNDO STEP. React Flow emits a change for every click
 *      and every node measurement (including on mount). Recording those buries
 *      real edits under no-op entries, and a `dimensions` entry on a fresh sheet
 *      makes the first Ctrl+Z appear dead.
 *
 *   5. UNDO AND REDO ROUND-TRIP EXACTLY. Stepping back then forward must return
 *      the identical drawing — not merely a similar one.
 */
const { launch, freshPage, URL: DEFAULT_URL } = require('./harness.cjs');

const URL = process.argv[2] || DEFAULT_URL;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

(async () => {
  const { browser, page, errors } = await launch();
  try {
    await freshPage(page);

    // ── Helpers ──────────────────────────────────────────────────────────
    /** Undo depth as reported by the button tooltip. */
    const depth = async () => {
      const t = await page.getAttribute('[data-testid="undo-btn"]', 'title');
      const m = /(\d+) step/.exec(t || '');
      return m ? Number(m[1]) : 0;
    };
    const counts = async () => ({
      nodes: await page.$$eval('.react-flow__node', (n) => n.length),
      edges: await page.$$eval('.react-flow__edge', (n) => n.length),
    });
    /** A node's rendered position, parsed from React Flow's transform. */
    const nodePos = async (i = 0) =>
      page.evaluate((idx) => {
        const el = document.querySelectorAll('.react-flow__node')[idx];
        if (!el) return null;
        const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || '');
        return m ? { x: Math.round(+m[1]), y: Math.round(+m[2]) } : null;
      }, i);

    const pane = await page.$('.react-flow__pane');
    const box = await pane.boundingBox();

    /** Drop a palette symbol onto the canvas with a real mouse drag. */
    async function drop(kind, x, y) {
      const src = await page.$(`[data-testid="palette-item-${kind}"]`);
      const sb = await src.boundingBox();
      await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + x, box.y + y, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    /** Connect the first and last visible handle with a real drag. */
    async function connect() {
      const hs = await page.$$('.react-flow__handle');
      if (hs.length < 2) return false;
      const a = await hs[0].boundingBox();
      const z = await hs[hs.length - 1].boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 20; i++) {
        await page.mouse.move(
          a.x + a.width / 2 + ((z.x - a.x) * i) / 20,
          a.y + a.height / 2 + ((z.y - a.y) * i) / 20,
        );
      }
      await page.mouse.up();
      await page.waitForTimeout(650);
      return true;
    }

    /** Drag node `i` by (dx,dy) in `steps` discrete mousemoves. */
    async function dragNode(i, dx, dy, steps) {
      const els = await page.$$('.react-flow__node');
      const b = await els[i].boundingBox();
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let s = 1; s <= steps; s++) {
        await page.mouse.move(cx + (dx * s) / steps, cy + (dy * s) / steps);
      }
      await page.mouse.up();
      await page.waitForTimeout(800);
    }

    const clickUndo = async () => { await page.click('[data-testid="undo-btn"]'); await page.waitForTimeout(420); };
    const clickRedo = async () => { await page.click('[data-testid="redo-btn"]'); await page.waitForTimeout(420); };

    // ── (a) fresh project: both directions disabled ──────────────────────
    check(
      '(a) fresh project has nothing to undo or redo',
      (await page.isDisabled('[data-testid="undo-btn"]')) &&
        (await page.isDisabled('[data-testid="redo-btn"]')) &&
        (await depth()) === 0,
      `depth=${await depth()}`,
    );

    // ── (b) selection is not an undo step ────────────────────────────────
    await drop('vessel-vertical', 320, 320);
    await drop('vessel-vertical', 780, 320);
    const beforeClicks = await depth();
    const els2 = await page.$$('.react-flow__node');
    for (const el of els2) {
      const b = await el.boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(150);
    }
    await page.mouse.click(box.x + 80, box.y + 830); // empty pane
    await page.waitForTimeout(250);
    const afterClicks = await depth();
    check(
      '(b) clicking nodes / empty pane adds no undo steps',
      afterClicks === beforeClicks,
      `depth ${beforeClicks} -> ${afterClicks} after ${els2.length + 1} clicks`,
    );

    // ── (c) a long drag is ONE step and undoes to the exact start ────────
    const startPos = await nodePos(0);
    const beforeDrag = await depth();
    await dragNode(0, 300, 140, 50);
    const draggedPos = await nodePos(0);
    const afterDrag = await depth();
    check(
      '(c1) a 50-mousemove drag adds exactly ONE undo step',
      afterDrag - beforeDrag === 1,
      `depth ${beforeDrag} -> ${afterDrag}`,
    );
    check(
      '(c2) the drag actually moved the node',
      startPos && draggedPos && (Math.abs(draggedPos.x - startPos.x) > 40 || Math.abs(draggedPos.y - startPos.y) > 20),
      `${JSON.stringify(startPos)} -> ${JSON.stringify(draggedPos)}`,
    );
    await clickUndo();
    const undonePos = await nodePos(0);
    const residual = startPos && undonePos ? Math.abs(undonePos.x - startPos.x) + Math.abs(undonePos.y - startPos.y) : -1;
    check(
      '(c3) one undo restores the node to its PRE-DRAG position exactly',
      residual === 0,
      `residual=${residual}px (${JSON.stringify(undonePos)} vs ${JSON.stringify(startPos)})`,
    );

    // ── (d) redo re-applies the drag exactly (round-trip) ────────────────
    await clickRedo();
    const redonePos = await nodePos(0);
    check(
      '(d) redo restores the dragged position exactly (round-trip)',
      redonePos && draggedPos && redonePos.x === draggedPos.x && redonePos.y === draggedPos.y,
      `${JSON.stringify(redonePos)} vs ${JSON.stringify(draggedPos)}`,
    );

    // ── (e) a NEW action clears the redo branch ──────────────────────────
    await clickUndo();
    const beforeNewAction = await page.isDisabled('[data-testid="redo-btn"]');
    await drop('vessel-vertical', 1150, 520);
    await page.waitForTimeout(300);
    const afterNewAction = await page.isDisabled('[data-testid="redo-btn"]');
    check(
      '(e) starting a new action clears the redo branch',
      beforeNewAction === false && afterNewAction === true,
      `redo disabled before=${beforeNewAction} after=${afterNewAction}`,
    );

    // ── (f) deleting an isolated node is one step ────────────────────────
    let nodeEls = await page.$$('.react-flow__node');
    let b0 = await nodeEls[nodeEls.length - 1].boundingBox();
    await page.mouse.click(b0.x + b0.width / 2, b0.y + b0.height / 2);
    await page.waitForTimeout(250);
    const beforeDelIso = await depth();
    const isoBefore = await counts();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(700);
    const afterDelIso = await depth();
    check(
      '(f1) deleting an isolated node is exactly ONE step',
      afterDelIso - beforeDelIso === 1,
      `depth ${beforeDelIso} -> ${afterDelIso}`,
    );
    check(
      '(f2) the isolated delete removed one node',
      (await counts()).nodes === isoBefore.nodes - 1,
      `${JSON.stringify(isoBefore)} -> ${JSON.stringify(await counts())}`,
    );
    await clickUndo();
    check(
      '(f3) undo restores the isolated node',
      (await counts()).nodes === isoBefore.nodes,
      `${JSON.stringify(await counts())} (expected nodes=${isoBefore.nodes})`,
    );

    // ── (g) deleting a node WITH a pipe: one step, fully reversible ──────
    const connected = await connect();
    const withPipe = await counts();
    check(
      '(g0) setup: two nodes joined by one pipe',
      connected && withPipe.nodes >= 2 && withPipe.edges >= 1,
      JSON.stringify(withPipe),
    );
    nodeEls = await page.$$('.react-flow__node');
    b0 = await nodeEls[0].boundingBox();
    await page.mouse.click(b0.x + b0.width / 2, b0.y + b0.height / 2);
    await page.waitForTimeout(250);
    const beforeDelConn = await depth();
    const connBefore = await counts();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(800);
    const afterDelConn = await depth();
    check(
      '(g1) deleting a node with a pipe is ONE step, not two',
      afterDelConn - beforeDelConn === 1,
      `depth ${beforeDelConn} -> ${afterDelConn} (2 would mean the pipe became its own step)`,
    );
    await clickUndo();
    const restored = await counts();
    check(
      '(g2) ONE undo restores BOTH the node and its pipe',
      restored.nodes === connBefore.nodes && restored.edges === connBefore.edges,
      `after 1 undo ${JSON.stringify(restored)} (expected ${JSON.stringify(connBefore)})`,
    );

    // ── (h) a burst of typing merges into one step ───────────────────────
    const nameInput = await page.$('[data-testid="project-name-input"]');
    const beforeType = await depth();
    await nameInput.click({ clickCount: 3 });
    await page.keyboard.type('Saponification Train 2', { delay: 45 });
    await page.waitForTimeout(500); // still inside MERGE_WINDOW_MS
    const afterType = await depth();
    check(
      '(h) typing 22 characters merges into ONE undo step',
      afterType - beforeType === 1,
      `depth ${beforeType} -> ${afterType}`,
    );

    // ── (i) a later edit is a SEPARATE step (the merge window closes) ────
    await page.waitForTimeout(1200); // > MERGE_WINDOW_MS
    const beforeSecond = await depth();
    await nameInput.click({ clickCount: 3 });
    await page.keyboard.type('Renamed', { delay: 45 });
    await page.waitForTimeout(500);
    const afterSecond = await depth();
    check(
      '(i) an edit after the merge window is a separate step',
      afterSecond - beforeSecond === 1 && afterSecond > afterType,
      `depth ${beforeSecond} -> ${afterSecond}`,
    );

    // ── (j) no orphaned pipes are persisted ──────────────────────────────
    const orphans = await page.evaluate(() => {
      const raw = window.localStorage.getItem('pid-drafter.project.autosave.v2');
      if (!raw) return 'no autosave payload';
      const data = JSON.parse(raw);
      const out = [];
      for (const sheet of data.sheets || []) {
        const ids = new Set((sheet.nodes || []).map((n) => n.id));
        for (const e of sheet.edges || []) {
          if (e.data && e.data.freePipe) continue; // free lines have no endpoints
          if (!ids.has(e.source) || !ids.has(e.target)) out.push(e.id);
        }
      }
      return out;
    });
    check(
      '(j) no pipe is left referring to a deleted node',
      Array.isArray(orphans) && orphans.length === 0,
      Array.isArray(orphans) ? `${orphans.length} orphaned` : orphans,
    );

    // ── (k) the whole stack unwinds to an empty canvas, no errors ────────
    let unwound = 0;
    for (let i = 0; i < 40; i++) {
      if (await page.isDisabled('[data-testid="undo-btn"]')) break;
      await clickUndo();
      unwound++;
    }
    const finalCounts = await counts();
    check(
      '(k1) undo unwinds the whole session back to an empty canvas',
      finalCounts.nodes === 0 && finalCounts.edges === 0,
      `used ${unwound} undos, canvas=${JSON.stringify(finalCounts)}`,
    );
    check(
      '(k2) undo is disabled once the stack is empty',
      await page.isDisabled('[data-testid="undo-btn"]'),
      `depth=${await depth()}`,
    );

    // ── (l) no console or page errors throughout ─────────────────────────
    check('(l) no page/console errors', errors.length === 0, errors.slice(0, 4).join(' | ') || 'none');
  } catch (e) {
    check('(x) gate completed without throwing', false, e.message);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log('');
  if (failed.length === 0) {
    console.log(`UNDO_PASS ${results.length}/${results.length}`);
    process.exit(0);
  }
  console.log(`UNDO_FAIL ${failed.length}/${results.length} failed:`);
  for (const f of failed) console.log(`   - ${f.name}: ${f.detail}`);
  process.exit(1);
})();

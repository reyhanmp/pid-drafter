/**
 * Mutation testing for scripts/verify-nozzle-line.cjs.
 *
 * A gate that has only ever printed PASS is decoration. Each mutation below
 * reintroduces one specific defect the gate claims to catch, runs the gate,
 * and requires the matching check to turn FAIL. If a mutation leaves the gate
 * green, that check proves nothing and must be fixed or deleted.
 *
 * The mutations are chosen to be the PLAUSIBLE wrong versions of this feature,
 * not random breakage — in particular the two that this feature's whole design
 * argument turns on:
 *
 *   - treating a reducer as an ERROR rather than a notice (which would make the
 *     tool confidently wrong about a correct, common real arrangement), and
 *   - comparing sizes as STRINGS instead of numerically (which fires on `1.5"`
 *     against `1 1/2"`, the same nozzle written two ways).
 *
 * Run: node scripts/mutate-nozzle-line.cjs [url]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const URL = process.argv[2] || 'http://127.0.0.1:5199/';

const MOD = 'src/validation/nozzleReconciliation.ts';

/** Swap a line in the module, keeping a .bak for restore. */
function mutateModule(replacements) {
  return {
    apply() {
      const p = path.join(REPO, MOD);
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p + '.bak', s);
      let out = s;
      for (const [from, to] of replacements) {
        if (!out.includes(from)) throw new Error(`mutation anchor not found: ${from.slice(0, 70)}`);
        out = out.replace(from, to);
      }
      fs.writeFileSync(p, out);
    },
    restore() {
      fs.renameSync(path.join(REPO, MOD + '.bak'), path.join(REPO, MOD));
    },
  };
}

const MUTATIONS = [
  {
    name: 'the reducer case is made a hard-looking ERROR instead of a notice (condemns a legal drawing)',
    expect: 'c',
    ...mutateModule([["severity: 'notice',", "severity: 'warning',"]]),
  },
  {
    name: 'the size comparison becomes a STRING comparison (fires on `1.5"` vs `1 1/2"`)',
    expect: 'g',
    // Compare the raw strings instead of folding to NPS inches. This is the
    // obvious first implementation, and it is wrong on the same nozzle written
    // two ways — the trap the option lists set.
    ...mutateModule([
      [
        `function largerLineSize(lineNps: number | null, nozzleNps: number | null): boolean {
  if (lineNps === null || nozzleNps === null) return false;
  return lineNps > nozzleNps + NPS_TOLERANCE;
}`,
        `function largerLineSize(lineNps: number | null, nozzleNps: number | null): boolean {
  return lineNps !== null && nozzleNps !== null; void NPS_TOLERANCE;
}`,
      ],
    ]),
  },
  {
    name: 'the absent-data guard is dropped (a blank nozzle becomes a mismatch)',
    expect: 'h',
    // Let a null nozzle size still count, so an undefined nozzle "loses" to any line.
    ...mutateModule([
      [
        `  if (!port) return [];`,
        `  if (!port) return [];
  if (port.size === undefined) (port as { size?: string }).size = '1/2"';`,
      ],
    ]),
  },
  {
    name: 'the signal-LINE guard is dropped (a signal line is reconciled as if it were process piping)',
    expect: 'm',
    ...mutateModule([
      ["    if (edge.data?.lineType === 'signal') continue;", '    // signal-line guard removed'],
    ]),
  },
  {
    name: 'the signal-PORT guard is dropped (an instrument nozzle is treated as a flange)',
    expect: 'm2',
    ...mutateModule([["  if (port.kind !== 'process') return [];", '  // signal-port guard removed']]),
  },
  {
    name: 'the free-line guard is dropped (a free line is reconciled as if it had nozzles)',
    expect: 'n',
    ...mutateModule([
      [
        "    if ((edge.data as Record<string, unknown> | undefined)?.freePipe === true) continue;",
        '    // free-line guard removed',
      ],
    ]),
  },
  {
    name: 'the rating rule is inverted to fire on a RICHER nozzle (fires on every correct oversized nozzle)',
    expect: 'f',
    ...mutateModule([[`    return nozzleAsme < lineAsme`, `    return nozzleAsme > lineAsme`]]),
  },
  {
    name: 'the bare line-number class is no longer parsed (house class fields go silently unchecked)',
    expect: 'd',
    ...mutateModule([
      [
        `  const bare = /^\\s*(\\d+)\\s*$/.exec(text);`,
        `  const bare = null as RegExpExecArray | null;`,
      ],
    ]),
  },
  {
    name: 'the ASME/PN systems are cross-compared (a metric nozzle against an imperial line invents a defect)',
    expect: 'l',
    // Two guards keep the systems apart: the PN early-return in parseAsmeClass,
    // and the `<150` floor in normalizeAsmeClassSeries. Removing the early
    // return alone is NOT enough to make the defect appear — the floor catches
    // it — so the mutation has to bypass the floor too, mapping PN onto ASME
    // classes the way a plausible-but-wrong implementation would. This is why
    // the first version of this mutation was uncaught: it wasn't the defect.
    ...mutateModule([
      [`  if (/\\bPN\\s*\\d+/i.test(text)) return null;`, '  // cross-system guard removed'],
      [
        `  const marked =
    text.match(/(?:class|ansi|#)\\s*[:#]?\\s*(\\d+)/i) ?? text.match(/\\b(\\d+)\\s*#/);
  const bare = /^\\s*(\\d+)\\s*$/.exec(text);
  const n = marked ? Number(marked[1]) : bare ? Number(bare[1]) : null;
  return n === null ? null : normalizeAsmeClassSeries(n);`,
        `  const anyDigits = text.match(/(\\d+)/);
  if (!anyDigits) return null;
  const n = Number(anyDigits[1]);
  if (/\\bPN\\s*\\d+/i.test(text)) return n <= 16 ? 150 : 300;
  return normalizeAsmeClassSeries(n);`,
      ],
    ]),
  },
  {
    name: 'the house 315/320 fold is removed (a 150# flange on a class-315 line goes unreported)',
    expect: 'j2',
    ...mutateModule([
      [
        `  if (n < 300) return 150;
  if (n < 600) return 300;`,
        `  if (n < 150) return 150;
  if (n < 600) return n;`,
      ],
    ]),
  },
  {
    name: 'the reconciliation is dropped from the panel entirely (the tier always reads OK)',
    expect: 'b',
  },
];

// The last mutation is a wiring change, not a module swap — handled specially
// so it exercises the App/pane wiring rather than the pure function.
const DROP_WIRING = {
  apply() {
    const p = path.join(REPO, 'src/App.tsx');
    const s = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p + '.bak', s);
    fs.writeFileSync(
      p,
      s.replace('reconcileNozzles(diagramNodes, diagramEdges)', '[] as ReturnType<typeof reconcileNozzles>'),
    );
  },
  restore() {
    fs.renameSync(path.join(REPO, 'src/App.tsx.bak'), path.join(REPO, 'src/App.tsx'));
  },
};

function runGate() {
  try {
    const out = execFileSync('node', ['scripts/verify-nozzle-line.cjs', URL], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000,
    });
    return { pass: true, out };
  } catch (e) {
    // On a non-zero exit execFileSync throws; the gate's real output is on the
    // error object. Dump it so a harness problem is never mistaken for a code
    // verdict — the first version of this file matched a `(a)` label form the
    // gate does not emit and reported every mutation as uncaught.
    const out = `${e.stdout || ''}${e.stderr || ''}`;
    try {
      require('fs').writeFileSync('/tmp/mutate-nozzle-last.txt', out);
    } catch {
      /* diagnostic only */
    }
    return { pass: false, out };
  }
}

(async () => {
  const failures = [];
  const notRun = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Parse `PASS  b. text` / `FAIL  b. text` — the gate labels checks `b.`, `j2.`
  // etc. (NOT the `(a)` parenthesised form used by verify-connections), so the
  // expect strings are matched against the label that precedes the dot.
  const parseLines = (out) =>
    out
      .split('\n')
      .map((l) => {
        const m = /^(PASS|FAIL)\s+([a-z0-9]+)\.\s*(.*)$/.exec(l.trim());
        return m ? { status: m[1], label: m[2], text: m[3] } : null;
      })
      .filter(Boolean);

  for (const m of MUTATIONS) {
    console.log(`\n--- MUTATION: ${m.name}`);
    const impl = m.apply ? m : DROP_WIRING;
    let r;
    // try/finally is load-bearing: a mutation that throws while applying, or a
    // gate killed mid-run, must still restore the source. An earlier run of this
    // file was killed mid-mutation and left a mutated module on disk, whose
    // effect was that the NEXT build compiled the defect and the harness's own
    // verdicts became meaningless.
    try {
      impl.apply();
      await sleep(2500); // let vite re-transform
      r = runGate();
    } finally {
      impl.restore();
    }

    const lines = parseLines(r.out);
    const gateFailed = /NOZZLE_LINE_FAIL/.test(r.out) || !r.pass;
    const target = lines.find((l) => l.label === m.expect);

    console.log(`  ${m.expect}: ${target ? `${target.status}  ${target.text.slice(0, 105)}` : '(check never reported)'}`);
    const ok = !!target && target.status === 'FAIL' && gateFailed;
    if (!ok) {
      const why = !target
        ? 'check never ran again (gate did not reach it)'
        : 'check still PASSED against the defect it exists to catch';
      console.log(`  NOT CAUGHT — ${why}`);
      failures.push(m.name);
      if (!target) notRun.push(m.expect);
    } else {
      console.log('  CAUGHT');
    }

    await sleep(2000);
  }

  console.log('');
  console.log(`${MUTATIONS.length - failures.length}/${MUTATIONS.length} mutations caught`);
  console.log(failures.length === 0 ? 'NOZZLE_LINE_MUTATION_PASS' : 'NOZZLE_LINE_MUTATION_FAIL');
  if (failures.length) {
    for (const f of failures) console.log(`  uncaught: ${f}`);
    if (notRun.length) console.log(`  checks that never ran again: ${notRun.join(', ')}`);
    process.exitCode = 1;
  }
})();

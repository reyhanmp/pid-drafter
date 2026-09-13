/**
 * Mutation testing for scripts/verify-connections.cjs.
 *
 * A gate that has only ever printed PASS is decoration. Each mutation below
 * reintroduces one specific defect the gate claims to catch, runs the gate, and
 * requires the matching check to turn FAIL. If a mutation leaves the gate green,
 * that check proves nothing and must be fixed or deleted.
 *
 * Run: node scripts/mutate-connections.cjs [url]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const URL = process.argv[2] || 'http://127.0.0.1:5199/';

const MUTATIONS = [
  {
    name: 'the connect guard is bypassed (react-flow stops validating)',
    expect: '(a)',
    apply() {
      const p = path.join(REPO, 'src/App.tsx');
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p + '.bak', s);
      fs.writeFileSync(p, s.replace('                isValidConnection={isValidConnection}\n', ''));
    },
    restore() {
      fs.renameSync(path.join(REPO, 'src/App.tsx.bak'), path.join(REPO, 'src/App.tsx'));
    },
  },
  {
    name: 'the rule itself is made permissive again (every nozzle takes any number of pipes)',
    expect: '(a)',
    apply() {
      const p = path.join(REPO, 'src/validation/connectionRules.ts');
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p + '.bak', s);
      fs.writeFileSync(p, s.replace('  for (const { nodeId, handleId } of endpoints) {', '  for (const { nodeId, handleId } of []) { void nodeId; void handleId;'));
    },
    restore() {
      fs.renameSync(path.join(REPO, 'src/validation/connectionRules.ts.bak'), path.join(REPO, 'src/validation/connectionRules.ts'));
    },
  },
  {
    name: "the branch-fitting exception is removed (a tee's run behaves like a nozzle)",
    expect: '(c1)',
    apply() {
      const p = path.join(REPO, 'src/symbols/tee-branch.tsx');
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p + '.bak', s);
      fs.writeFileSync(p, s.replace("  multiBranchPorts: ['run-in', 'run-out'],\n", ''));
    },
    restore() {
      fs.renameSync(path.join(REPO, 'src/symbols/tee-branch.tsx.bak'), path.join(REPO, 'src/symbols/tee-branch.tsx'));
    },
  },
  {
    name: 'the exception is applied to the whole tee instead of its declared ports (a branch port becomes a free-for-all)',
    expect: '(c2)',
    apply() {
      const p = path.join(REPO, 'src/validation/connectionRules.ts');
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p + '.bak', s);
      // Any port on a branch-fitting symbol exempted, rather than the ports it
      // actually declares — the plausible-looking wrong version of the rule.
      fs.writeFileSync(
        p,
        s.replace(
          "  return symbolsByKind[kind]?.multiBranchPorts?.includes(handleId) ?? false;",
          "  const sym: { multiBranchPorts?: string[] } | undefined = symbolsByKind[kind];\n  return (sym?.multiBranchPorts?.length ?? 0) > 0;",
        ),
      );
    },
    restore() {
      fs.renameSync(path.join(REPO, 'src/validation/connectionRules.ts.bak'), path.join(REPO, 'src/validation/connectionRules.ts'));
    },
  },
  {
    name: 'the tee is placed at a fixed offset from the nozzle (lands under the equipment)',
    expect: '(g)',
    apply() {
      const p = path.join(REPO, 'src/App.tsx');
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p + '.bak', s);
      // The exact first-version bug: a 24px offset from a port that sits ON the
      // equipment boundary, so half the fitting extends back over the shape.
      fs.writeFileSync(p, s.replace('      const gap = teeSpan + CLEARANCE;', '      const gap = 24;'));
    },
    restore() {
      fs.renameSync(path.join(REPO, 'src/App.tsx.bak'), path.join(REPO, 'src/App.tsx'));
    },
  },
  {
    name: 'the tee offer follows the wrong end (target instead of the blocked nozzle)',
    expect: '(h)',
    apply() {
      const p = path.join(REPO, 'src/App.tsx');
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p + '.bak', s);
      fs.writeFileSync(
        p,
        s.replace('      const culprit = decision.blockedNodeId;', '      const culprit = connection.target ?? connection.source;'),
      );
    },
    restore() {
      fs.renameSync(path.join(REPO, 'src/App.tsx.bak'), path.join(REPO, 'src/App.tsx'));
    },
  },
  {
    name: 'the validator stops checking occupancy (loaded data goes uncondemned)',
    expect: '(d)',
    expectAlso: '(e)',
    apply() {
      const p = path.join(REPO, 'src/validation/validateDiagram.ts');
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p + '.bak', s);
      fs.writeFileSync(p, s.replace('      ...checkPortOccupancy(nodes, edges),\n', ''));
    },
    restore() {
      fs.renameSync(path.join(REPO, 'src/validation/validateDiagram.ts.bak'), path.join(REPO, 'src/validation/validateDiagram.ts'));
    },
  },
  {
    name: 'the refusal stops explaining itself (silent failure)',
    expect: '(b)',
    apply() {
      const p = path.join(REPO, 'src/App.tsx');
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p + '.bak', s);
      // Keep the refusal, drop the notice: exactly the "silent broken drag"
      // failure mode the notice exists to prevent.
      fs.writeFileSync(
        p,
        s.replace(
          '      const freePortId = getSuggestedPortId(data.kind, occupied, symbolsByKind[data.kind]?.multiBranchPorts);',
          '      const freePortId = null as string | null;\n      void occupied;',
        ),
      );
    },
    restore() {
      fs.renameSync(path.join(REPO, 'src/App.tsx.bak'), path.join(REPO, 'src/App.tsx'));
    },
  },
];

function runGate() {
  try {
    const out = execFileSync('node', ['scripts/verify-connections.cjs', URL], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000,
    });
    return { pass: true, out };
  } catch (e) {
    return { pass: false, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

(async () => {
  const failures = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const m of MUTATIONS) {
    console.log(`\n--- MUTATION: ${m.name}`);
    m.apply();
    await sleep(2500); // let vite re-transform
    const r = runGate();
    m.restore();

    const lines = r.out.split('\n').filter((l) => /^(PASS|FAIL)\s+\(/.test(l));
    const targetLine = lines.find((l) => l.includes(m.expect));
    const caughtTarget = !!targetLine && targetLine.startsWith('FAIL');
    const alsoOk = !m.expectAlso || (lines.find((l) => l.includes(m.expectAlso)) || '').startsWith('FAIL');
    const gateFailed = /CONNECTIONS_FAIL/.test(r.out) || !r.pass;

    console.log(`  ${m.expect}: ${targetLine ? targetLine.trim().slice(0, 110) : '(missing)'}`);
    if (m.expectAlso) console.log(`  ${m.expectAlso}: ${(lines.find((l) => l.includes(m.expectAlso)) || '(missing)').trim().slice(0, 110)}`);

    const ok = caughtTarget && alsoOk && gateFailed;
    console.log(`  ${ok ? 'CAUGHT' : 'NOT CAUGHT — this check proves nothing'}`);
    if (!ok) failures.push(m.name);

    await sleep(2000); // let vite settle back before the next mutation
  }

  console.log('');
  console.log(`${MUTATIONS.length - failures.length}/${MUTATIONS.length} mutations caught`);
  console.log(failures.length === 0 ? 'CONNECTIONS_MUTATION_PASS' : 'CONNECTIONS_MUTATION_FAIL');
  if (failures.length) {
    for (const f of failures) console.log(`  uncaught: ${f}`);
    process.exitCode = 1;
  }
})();

import { parseLineNumber, formatLineNumber, isMalformedLineNumber } from '../../src/validation/lineNumbers.ts';
const REAL = [
  '1"-DIC2-710.01-300-HC',
  '1 1/2"-LPS2-710.01-300-HC',
  '4"-BL-710.05B-300-HC',
  '3"-BL-710.05-320-',
  '1"-VENT-710.02A-320-HC',
  '3"-JAC-710.20-300-HC',
  '3/4"-NI-7210B-315-',
];
let fail = 0;
for (const r of REAL) {
  const p = parseLineNumber(r);
  if (!p.parts) { console.log('PARSE FAIL:', r, p.problem); fail++; continue; }
  const back = formatLineNumber(p.parts);
  const ok = back === r;
  if (!ok) fail++;
  console.log(ok ? 'RT OK ' : 'RT BAD', JSON.stringify(r), '->', JSON.stringify(back), '| svc:', p.parts.service, '-', p.serviceDescription);
}
console.log('--- abbreviated ---');
for (const a of ['2"-CAU-710.01','CAU-710.01','710.01','1/2"','']) {
  const p = parseLineNumber(a);
  console.log(JSON.stringify(a), 'parts=', p.parts ? 'yes' : 'null', 'malformed=', isMalformedLineNumber(a));
}
console.log(fail === 0 ? 'ALL_ROUNDTRIP_PASS' : `FAILURES=${fail}`);

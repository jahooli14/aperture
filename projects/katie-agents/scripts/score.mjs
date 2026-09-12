#!/usr/bin/env node
// Scores a detector run against eval/answer-key.md. Recall on F1-F10, precision on T1-T4.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const run = (args = []) =>
  JSON.parse(execFileSync('node', [join(here, 'detect.mjs'), '--json', ...args], { encoding: 'utf8' }));

const text = (f) => `${f.detector} ${f.title} ${f.detail} ${f.cites.join(' ')}`.toLowerCase();
const has = (fs, det, ...needles) =>
  fs.find((f) => f.detector === det && needles.every((n) => text(f).includes(n.toLowerCase())));

const EXPECTED = [
  ['F1', 'Delegated authority oversight cost', (fs) => has(fs, 'D1', 'binder oversight', '7 independent organisations')],
  ['F2', 'Cyber war attribution, slow convergence', (fs) => has(fs, 'D1', 'state-backed', 'slow')],
  ['F2b', 'Forensics capability matched to it', (fs) => has(fs, 'D5', 'teodora')],
  ['F3', 'Parametric contradiction', (fs) => has(fs, 'D2', 'parametric', 'ana-castellane')],
  ['F4', 'Klaus called casualty severity first', (fs) => has(fs, 'D3', 'klaus-beringer', 'us liability severity')],
  ['F4b', 'Hal Brennan reached it independently', (fs) => has(fs, 'D3', 'klaus-beringer', 'hal-brennan')],
  ['F5', 'June deadline stopped', (fs) => has(fs, 'D4', '30 june')],
  ['F5b', '...tied to idle regulatory capacity', (fs) => has(fs, 'D4', '30 june', 'nothing booked past october')],
  ['F6', "Saskia's diagnostic -> client demand", (fs) => has(fs, 'D5', 'saskia')],
  ['F7', 'Duraflex <-> Copperfield', (fs) => has(fs, 'D5', 'ed-maslin', 'graham-tull')],
  ['F8', 'Audit client flagged, not dropped', (fs) => has(fs, 'D5', 'audit client')],
  ['F9', 'Nobody owns Calloway', (fs) => has(fs, 'D7', 'calloway')],
  ['F10', 'Nine Elms dormant with open thread', (fs) => has(fs, 'D6', 'nine elms', 'retained advisory')],
  ['F10b', 'Unclosed debts to internal partners', (fs) => has(fs, 'D6', 'gareth-lowry')],
];

// Traps are identified by the claim ids a finding cites, not by its label — the
// ablation changes labels, and a test that moves with the thing it measures is no test.
const cites = (fs, det, ...ids) =>
  fs.find((f) => f.detector === det && ids.every((id) => f.cites.some((c) => c.startsWith(id + ' '))));
const anyOf = (...tests) => (fs) => tests.map((t) => t(fs)).find(Boolean);

const TRAPS = [
  ['T1', 'GenAI as one subject', anyOf(
    (fs) => cites(fs, 'D1', 'c009', 'c029'), (fs) => cites(fs, 'D1', 'c029', 'c032'))],
  ['T2', "One broker's migration as a market", (fs) => cites(fs, 'D1', 'c001', 'c034', 'c066')],
  ['T3', "The firm's own report echoed back", anyOf(
    (fs) => cites(fs, 'D1', 'c063', 'c071', 'c081'), (fs) => cites(fs, 'D3', 'c063', 'c081'))],
  ['T4', 'Cyber hiring below threshold', anyOf(
    (fs) => cites(fs, 'D1', 'c033', 'c054'), (fs) => cites(fs, 'D1', 'c054', 'c062'))],
];

const findings = run();
let hit = 0, missed = [];
console.log('RECALL');
for (const [id, label, test] of EXPECTED) {
  const f = test(findings);
  if (f) hit++; else missed.push(id);
  console.log(`  ${f ? 'PASS' : 'MISS'}  ${id.padEnd(5)} ${label}`);
}
let fired = 0;
console.log('\nPRECISION (must not fire)');
for (const [id, label, test] of TRAPS) {
  const f = test(findings);
  if (f) fired++;
  console.log(`  ${f ? 'FAIL' : 'ok  '}  ${id.padEnd(5)} ${label}${f ? `  <- fired as: ${f.title}` : ''}`);
}

const GUARD_NAMES = ['provenance', 'orgCount', 'strength', 'attribution', 'externalOnly', 'subjectSense'];
const allOff = GUARD_NAMES.map((g) => `--no-${g}`);
const trapsIn = (fs) => TRAPS.filter(([, , t]) => t(fs)).map(([id]) => id);

console.log('\nGUARD ABLATION');
const bare = run(allOff);
console.log(`  all guards off        traps through: ${trapsIn(bare).join(', ') || 'none'}`);
for (const g of GUARD_NAMES) {
  const only = run(allOff.filter((a) => a !== `--no-${g}`));
  const blocked = trapsIn(bare).filter((id) => !trapsIn(only).includes(id));
  console.log(`  only ${g.padEnd(14)} blocks: ${blocked.join(', ') || '-'}`);
}
for (const g of GUARD_NAMES) {
  const off = run([`--no-${g}`]);
  const leaks = trapsIn(off).filter((id) => !trapsIn(findings).includes(id));
  if (leaks.length) console.log(`  SOLE GUARD: ${g} is the only thing stopping ${leaks.join(', ')}`);
}

console.log(`\nSCORE  recall ${hit}/${EXPECTED.length}${missed.length ? ` (missed ${missed.join(', ')})` : ''}` +
  `  |  traps fired ${fired}/${TRAPS.length}  |  total findings ${findings.length}`);

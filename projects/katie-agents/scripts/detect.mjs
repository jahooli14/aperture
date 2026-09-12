#!/usr/bin/env node
// Layer 2 detectors. Reads Layer 1, emits findings. No hand-written results.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsv = (f) => {
  const [head, ...rows] = readFileSync(join(root, f), 'utf8').trim().split('\n');
  const keys = head.split('\t');
  return rows.map((r) => Object.fromEntries(r.split('\t').map((v, i) => [keys[i], v ?? ''])));
};

const claims = tsv('layer1/claims.tsv');
const subjects = Object.fromEntries(tsv('layer1/subjects.tsv').map((s) => [s.subject, s]));
const accounts = Object.fromEntries(tsv('layer1/accounts.tsv').map((a) => [a.org, a]));
const commitments = tsv('layer1/commitments.tsv');
const NOW = '2026-09-11';

// --- guards, each independently switchable so we can ablate them ---
const GUARDS = {
  orgCount: true,      // count distinct organisations, not mentions or people
  provenance: true,    // drop claims that repeat the firm's own publication
  strength: true,      // require corroboration rated "stated directly"
  subjectSense: true,  // trust the normalised subject over the surface word
  attribution: true,   // an overheard, unattributed remark is not an organisation
  externalOnly: true,  // an internal capability pitch is not market evidence
};
for (const a of process.argv.slice(2)) if (a.startsWith('--no-')) GUARDS[a.slice(5)] = false;

const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const eligible = (c) =>
  (!GUARDS.provenance || c.provenance === 'original') &&
  c.type !== 'admin';

// Convergence evidence is stricter than general eligibility: it must be attributable
// to a named person at a named external organisation, and be a problem or a view —
// an internal service description is not a market signal.
const isEvidence = (c) =>
  eligible(c) &&
  ['problem', 'opinion'].includes(c.type) &&
  (!GUARDS.attribution || (c.org !== 'unknown' && c.person !== 'unknown' && c.strength !== 'overheard')) &&
  (!GUARDS.externalOnly || c.side !== 'internal');

// If subject-sense is off, collapse subjects onto their surface keyword.
const surface = (s) => (GUARDS.subjectSense ? s : s.split('-')[0]);

const findings = [];
const add = (d, title, detail, cites) => findings.push({ detector: d, title, detail, cites });
const cite = (c) => `${c.id ? c.id + ' ' : ''}${c.date} ${c.person} (${c.org})`;

// ---------- D1 convergence ----------
function d1(from, to, label) {
  const win = claims.filter((c) => isEvidence(c) && c.date >= from && c.date <= to);
  const bySubject = {};
  for (const c of win) (bySubject[surface(c.subject)] ??= []).push(c);
  for (const [subj, cs] of Object.entries(bySubject)) {
    const units = GUARDS.orgCount ? new Set(cs.map((c) => c.org)) : new Set(cs.map((c) => c.person));
    const stated = cs.filter((c) => c.strength === 'stated').length;
    if (units.size < 3) continue;
    if (GUARDS.strength && stated < 2) continue;
    add('D1', `Convergence (${label}): ${subjects[subj]?.label ?? subj}`,
      `${units.size} independent ${GUARDS.orgCount ? 'organisations' : 'people'}, ${cs.length} claims`,
      cs.map(cite));
  }
}

// ---------- D2 contradiction ----------
function d2() {
  const bySubject = {};
  for (const c of claims.filter(isEvidence)) if (c.type === 'opinion') (bySubject[c.subject] ??= []).push(c);
  for (const [subj, cs] of Object.entries(bySubject)) {
    const f = cs.filter((c) => c.stance === 'for' && c.strength === 'stated');
    const a = cs.filter((c) => c.stance === 'against' && c.strength === 'stated');
    const orgs = new Set([...f, ...a].map((c) => c.org));
    if (f.length && a.length && orgs.size >= 2)
      add('D2', `Contradiction: ${subjects[subj]?.label ?? subj}`,
        `${[...new Set(f.map((c) => c.person))].join(', ')} for; ${[...new Set(a.map((c) => c.person))].join(', ')} against`,
        [...f, ...a].map(cite));
  }
}

// ---------- D3 first voice ----------
function d3() {
  const bySubject = {};
  for (const c of claims.filter(isEvidence)) (bySubject[c.subject] ??= []).push(c);
  for (const [subj, cs] of Object.entries(bySubject)) {
    const sorted = [...cs].sort((x, y) => x.date.localeCompare(y.date));
    const orgs = new Set(cs.map((c) => c.org));
    if (orgs.size < 3) continue;
    // A candidate first voice must have said it outright. A vague hunch mentioned in
    // passing is not calling something early, and letting it win both names the wrong
    // person and pulls the lead time down below the threshold.
    const first = sorted.find((c) => c.strength === 'stated');
    if (!first) continue;
    const next = sorted.find((c) => c.org !== first.org && c.date > first.date && c.strength === 'stated');
    if (!next || days(first.date, next.date) < 30) continue;
    const echoes = sorted.filter((c) => c.org !== first.org && c.person !== first.person && c.date > first.date);
    const later = [...new Set(echoes.map((c) => c.person))];
    // Internal colleagues who reached the same view independently corroborate the call.
    const internal = claims.filter((c) => c.side === 'internal' && c.subject === subj &&
      c.stance === first.stance && c.date > first.date);
    add('D3', `First voice: ${first.person} (${accounts[first.org]?.name ?? first.org}) on ${subjects[subj]?.label ?? subj}`,
      `Led the next speaker by ${days(first.date, next.date)} days. Since echoed by ${later.length}: ${later.join(', ')}` +
      (internal.length ? `. Reached independently inside the firm by ${[...new Set(internal.map((c) => c.person))].join(', ')}` : ''),
      [cite(first), ...echoes.map(cite), ...internal.map(cite)]);
  }
}

// ---------- D4 what stopped ----------
function d4() {
  const A = ['2026-03-16', '2026-05-31'], B = ['2026-07-01', NOW];
  const inWin = (c, w) => c.date >= w[0] && c.date <= w[1];
  const bySubject = {};
  for (const c of claims.filter(eligible)) (bySubject[c.subject] ??= []).push(c);
  for (const [subj, cs] of Object.entries(bySubject)) {
    const a = cs.filter((c) => inWin(c, A)), b = cs.filter((c) => inWin(c, B));
    const orgsA = new Set(a.map((c) => c.org));
    const bStrong = b.filter((c) => c.strength === 'stated');
    const declined = a.length >= 4 && orgsA.size >= 3 && bStrong.length === 0 &&
                     b.length <= Math.max(1, Math.floor(a.length * 0.2));
    if (declined) {
      const idle = claims.filter((c) => c.side === 'internal' && c.type === 'problem' &&
        subjects[subj]?.related === c.subject);
      add('D4', `Stopped: ${subjects[subj]?.label ?? subj}`,
        `${a.length} claims across ${orgsA.size} orgs to May, ${b.length} since July (none stated directly)` +
        (idle.length ? ` — and internally: "${idle[idle.length - 1].quote}"` : ''),
        [...a.map(cite), ...idle.map(cite)]);
    }
  }
}

// ---------- D5 problem <-> capability ----------
function d5() {
  const caps = claims.filter((c) => eligible(c) && c.type === 'capability');
  const probs = claims.filter((c) => eligible(c) && c.type === 'problem');
  const groups = [];
  for (const cap of caps) {
    const linked = [cap.subject, subjects[cap.subject]?.related].filter(Boolean);
    const seenOrg = new Set();
    const matched = [];
    for (const p of probs) {
      if (!linked.includes(p.subject) || p.org === cap.org || seenOrg.has(p.org)) continue;
      seenOrg.add(p.org);
      matched.push(p);
    }
    if (!matched.length) continue;
    groups.push({ cap, matched });
  }
  // Rank: sellable demand first, then the longest-forgotten pair.
  groups.sort((x, y) => {
    const clean = (g) => g.matched.filter((p) => accounts[p.org]?.audit_client !== 'YES').length;
    return clean(y) - clean(x) ||
      Math.max(...y.matched.map((p) => Math.abs(days(y.cap.date, p.date)))) -
      Math.max(...x.matched.map((p) => Math.abs(days(x.cap.date, p.date))));
  });
  for (const { cap, matched } of groups) {
    const viaLink = matched.some((p) => p.subject !== cap.subject);
    const lines = matched.map((p) => {
      const flag = accounts[p.org]?.audit_client === 'YES' ? ' [AUDIT CLIENT — advisory restricted]' : '';
      return `${p.person} (${accounts[p.org]?.name ?? p.org}), ${Math.abs(days(cap.date, p.date))}d${flag}`;
    });
    add('D5', `${cap.side === 'internal' ? 'Internal capability' : 'Capability'}: ${cap.person} (${accounts[cap.org]?.name ?? cap.org}) -> ${matched.length} unmet need${matched.length > 1 ? 's' : ''}`,
      lines.join('; ') + (viaLink ? ' [matched via curated subject link]' : ''),
      [cite(cap), ...matched.map(cite)]);
  }
}

// ---------- D6 open loops and dormancy ----------
function d6() {
  for (const m of commitments.filter((x) => !x.closed)) {
    add('D6', `Unclosed: owed to ${m.owed_to} (${m.org})`,
      `${days(m.opened, NOW)} days open — ${m.what}`, [`${m.opened} ${m.note}`]);
  }
  const notes = readdirSync(join(root, 'corpus'));
  const last = {};
  for (const c of claims) if (!last[c.org] || c.date > last[c.org]) last[c.org] = c.date;
  for (const [org, d] of Object.entries(last)) {
    if (org === 'firm' || org === 'unknown') continue;
    const gap = days(d, NOW);
    if (gap < 60) continue;
    const open = commitments.filter((m) => m.org === org && !m.closed);
    add('D6', `Dormant: ${accounts[org]?.name ?? org}`,
      `${gap} days since last substantive contact` +
      (open.length ? ` — left open: ${open.map((m) => m.what).join('; ')}` : ' — nothing left open'),
      [`last: ${d}`]);
  }
}

// ---------- D7 account coherence ----------
function d7() {
  const internal = claims.filter((c) => c.side === 'internal' && c.subject === 'firm-account-ownership');
  const byOrg = {};
  for (const c of internal) {
    const m = c.quote.match(/Calloway/i) ? 'calloway' : null;
    if (m) (byOrg[m] ??= []).push(c);
  }
  for (const [org, cs] of Object.entries(byOrg)) {
    const people = new Set(cs.map((c) => c.person));
    if (people.size < 2) continue;
    add('D7', `Account coherence: ${accounts[org]?.name ?? org}`,
      `${people.size} partners in unconnected internal threads (${[...people].join(', ')}); ` +
      `recorded owner: ${accounts[org]?.relationship_owner}`,
      cs.map(cite));
  }
}

d1('2026-07-17', NOW, 'fast, 8wk');
d1('2026-03-16', NOW, 'slow, full');
d2(); d3(); d4(); d5(); d6(); d7();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 0));
  process.exit(0);
}
const active = Object.entries(GUARDS).filter(([, v]) => !v).map(([k]) => k);
console.log(`# guards off: ${active.length ? active.join(', ') : 'none'}\n`);
for (const f of findings) {
  console.log(`[${f.detector}] ${f.title}`);
  console.log(`    ${f.detail}`);
  console.log(`    cites: ${f.cites.slice(0, 4).join(' | ')}${f.cites.length > 4 ? ` | +${f.cites.length - 4} more` : ''}\n`);
}
console.log(`# ${findings.length} findings`);

// R6 analysis aid (40-6AP): counts spreadsheet operations INSIDE the usage ScriptLock per start, on the mock GAS.
// Mock-only operation counts (not Apps Script timings). Usage (repo root): node experimental/usage-v4-unified/r6_lock_profile.mjs
import {loadProject, MockSpreadsheet} from './mock_gas.mjs';
import {buildCopy, standardHistory, ISOLATED_PROPS, id} from './fixture.mjs';
const {ss} = buildCopy({history: standardHistory()});
const p = loadProject({spreadsheets: new Map([['copy40', ss], ['prod', new MockSpreadsheet('prod')], ['cert', new MockSpreadsheet('cert')]]),
  props: {...ISOLATED_PROPS}, now: '2026-11-24T01:00:00Z'});
ss.trace = p.trace; p.setActive('owner@example.test'); p.rpc('hojaV4OpsSealPendingDays'); p.setActive('');
ss.hooks.onRead = (sheet) => { p.trace.push('READ:' + sheet.name); };   // display-value reads into the same trace
const req = (n, eid) => ({eventId: eid || id(9700 + n), mode: 'SOLO', repositoryKind: 'PUBLIC', cartridgeIds: ['101'], cartridgeCount: 1, teamCount: 1});
const out = [];
for (const [label, payload] of [['first', req(1)], ['second', req(2)], ['third', req(3)], ['sameEventIdRetry', req(3)]]) {
  const t0 = p.trace.length; const r = p.rpc('recordUsageStartU1', payload);
  const tr = p.trace.slice(t0), a = tr.indexOf('LOCK'), b = tr.lastIndexOf('UNLOCK');
  const inside = tr.slice(a + 1, b), count = k => inside.filter(x => x.startsWith(k)).length;
  out.push({label, ok: r.ok, duplicateIgnored: !!r.duplicateIgnored, insideLock: {ops: inside.length, find: count('FIND'), append: count('APPEND'), write: count('WRITE'), flush: count('FLUSH'), prop: count('PROP'), read: count('READ'), open: count('OPEN')}, outsideLock: tr.length - inside.length - 2, sequence: inside.join(' ')});
}
for (const o of out) console.log(JSON.stringify(o));

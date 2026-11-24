// 40-6AI-2: daily KST auto-seal — DISABLED-by-default design, tested ONLY on the mock GAS with an injected clock.
// No trigger is created anywhere; no real data is sealed. "LOCAL PASS/FAIL" evidence only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject, MockSpreadsheet} from './mock_gas.mjs';
import {buildCopy, standardHistory, ISOLATED_PROPS, id} from './fixture.mjs';

const OWNER = 'owner@example.test';
const ON = {HOJA_V4_AUTO_SEAL: 'ENABLED_ISOLATED_COPY_ONLY'};
const req = n => ({eventId: id(9800 + n), mode: 'SOLO', repositoryKind: 'PUBLIC', cartridgeIds: ['101'], cartridgeCount: 1, teamCount: 1});
function world({enabled = true} = {}) {
  const {ss} = buildCopy({history: standardHistory()});
  const p = loadProject({spreadsheets: new Map([['copy40', ss], ['prod', new MockSpreadsheet('prod')], ['cert', new MockSpreadsheet('cert')]]),
    props: {...ISOLATED_PROPS, ...(enabled ? ON : {})}, now: '2026-11-24T01:00:00Z'});
  ss.trace = p.trace; p.setActive(OWNER);
  p.rpc('hojaV4OpsSealPendingDays');                 // setup: certified history through 11-23 (empty day)
  const w = {...p, ss, ev: ss.getSheetByName('EVENT_LOG'), m: ss.getSheetByName('HOJA_V4_DAILY_MANIFEST'), b: ss.getSheetByName('HOJA_V4_DAILY_BUCKETS'),
    at(iso) { p.setNow(iso); return w; },
    rec(n) { return p.rpc('recordUsageStartU1', req(n)); },
    auto() { return p.rpc('hojaV4OpsAutoSealDaily'); },
    state() { return JSON.parse(p.props.get('HOJA_V4_AUTO_SEAL_STATE') || 'null'); },
    stats() { p.cache.clear(); return p.rpc('getPublicUsageStatisticsV4'); },
    complete() { return w.m.rows.filter(r => r[2] === 'COMPLETE').map(r => r[0]); }};
  return w;
}
const AT_0020 = '2026-11-24T15:20:00Z';            // 2026-11-25 00:20 KST — the planned daily run time

test('AS-1 disabled by default: the handler returns AUTO_SEAL_DISABLED and touches nothing', () => {
  const w = world({enabled: false});
  w.at('2026-11-24T10:00:00Z').rec(1); w.at(AT_0020);
  const trace = w.trace.length, man = JSON.stringify(w.m.rows);
  assert.deepEqual(w.auto(), {ok: true, skipped: 'AUTO_SEAL_DISABLED'});
  assert.equal(w.trace.length, trace, 'no spreadsheet open/read/write at all');
  assert.equal(JSON.stringify(w.m.rows), man); assert.equal(w.state(), null);
  assert.equal(w.rpc('hojaV4OpsStatus').autoSeal.enabled, false);
});
test('AS-2 the handler is operator-only: an anonymous web-app caller is refused', () => {
  const w = world(); w.setActive('');
  assert.throws(() => w.auto(), /HOJA_V4_OPS_DENIED/);
});
test('AS-3 daily run at 00:20 KST seals exactly the finished day; a second run (duplicate trigger) is a no-op', () => {
  const w = world();
  w.at('2026-11-24T10:00:00Z').rec(1); w.at('2026-11-24T14:59:59Z').rec(2); w.at('2026-11-24T15:00:01Z').rec(3);
  w.at(AT_0020);
  const r = w.auto();
  assert.deepEqual([r.ok, r.today, r.sealed, r.sealedThrough, r.pendingPastDays, r.staleRisk], [true, '2026-11-25', ['2026-11-24'], '2026-11-24', 0, false]);
  assert.equal(w.m.rows.filter(x => x[0] === '2026-11-24')[0][5], '2', '11-24 has its 2 starts; the 00:00:01 start stays in 11-25');
  const again = w.auto();
  assert.deepEqual([again.ok, again.sealed], [true, []]);
  assert.equal(w.m.rows.filter(x => x[0] === '2026-11-24').length, 1, 'no duplicate manifest row');
  assert.deepEqual(w.stats().provisionalDays, ['2026-11-25'], 'today is never sealed');
  assert.equal(w.rpc('hojaV4OpsStatus').autoSeal.last.sealedThrough, '2026-11-24');
});
test('AS-4 two triggers at the same moment: the one that cannot get the ScriptLock fails visibly; the seal happens exactly once', () => {
  const w = world();
  w.at('2026-11-24T10:00:00Z').rec(1); w.at(AT_0020);
  let second = null;
  w.ss.hooks.onWrite = (sheet) => {
    if (second === null && sheet.name === 'HOJA_V4_DAILY_MANIFEST') {   // first run holds the lock while writing PREPARING
      try { w.auto(); second = 'NO_ERROR'; } catch (e) { second = e.message; }
    }
  };
  const first = w.auto();
  w.ss.hooks.onWrite = null;
  assert.match(second, /HOJA_V4_AUTO_SEAL_FAILED HOJA_V4U_SEAL_LOCK_TIMEOUT/);
  assert.deepEqual(first.sealed, ['2026-11-24']);
  assert.equal(w.m.rows.filter(x => x[0] === '2026-11-24').length, 1); assert.equal(w.m.rows.filter(x => x[0] === '2026-11-24')[0][2], 'COMPLETE');
  assert.equal(w.state().ok, true, 'the successful run is the last recorded state');
});
test('AS-5 zero days and a long backlog: SEAL_STALE before, sealed in bounded runs (7 days per run), public OK after', () => {
  const w = world();
  w.at('2026-11-24T10:00:00Z').rec(1);
  w.at('2026-11-28T15:20:00Z');                     // 11-29 00:20 KST: 11-24..11-28 unsealed (5 days)
  assert.equal(w.stats().code, 'SEAL_STALE', 'public reader fails closed while > 3 days are unsealed');
  const r = w.auto();
  assert.deepEqual(r.sealed, ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']);
  assert.equal(r.pendingPastDays, 0);
  assert.deepEqual(w.m.rows.filter(x => ['2026-11-25', '2026-11-26'].includes(x[0])).map(x => x[5]), ['0', '0'], 'zero days sealed explicitly');
  assert.equal(w.stats().status, 'OK');
  // more than 7 pending days: the first run seals 7 and reports the rest as stale risk, the next run finishes
  w.at('2026-12-08T15:20:00Z');                     // 12-09: 11-29..12-08 = 10 days
  const a = w.auto();
  assert.equal(a.sealed.length, 7); assert.equal(a.pendingPastDays, 3); assert.equal(a.staleRisk, true);
  const b = w.auto();
  assert.equal(b.sealed.length, 3); assert.equal(b.pendingPastDays, 0); assert.equal(b.staleRisk, false);
});
test('AS-6 a failure mid-seal is recorded and re-thrown; the next run resumes the identical generation', () => {
  const w = world();
  w.at('2026-11-24T10:00:00Z').rec(1); w.at('2026-11-24T11:00:00Z').rec(2); w.at(AT_0020);
  const ref = w.stats();
  let crash = true;
  w.ss.hooks.onWrite = s => { if (crash && s.name === 'HOJA_V4_DAILY_BUCKETS') { crash = false; throw Error('QUOTA'); } };
  assert.throws(() => w.auto(), /HOJA_V4_AUTO_SEAL_FAILED/);
  const st = w.state();
  assert.deepEqual([st.ok, st.hold, st.consecutiveFailures], [false, false, 1]);
  assert.equal(w.locks.held, false);
  assert.deepEqual(w.stats().provisionalDays, ['2026-11-24', '2026-11-25'], 'the PREPARING day is still shown as provisional');
  const r = w.auto();
  assert.deepEqual(r.sealed, ['2026-11-24']); assert.equal(r.consecutiveFailures, 0);
  assert.equal(w.m.rows.filter(x => x[0] === '2026-11-24').length, 1);
  assert.deepEqual(w.stats().totals, ref.totals, 'converged to the same numbers');
});
test('AS-7 late / uncommitted rows: the run HOLDs (no seal, nothing repaired), failures accumulate, stale risk is flagged', () => {
  const w = world();
  w.at('2026-11-24T10:00:00Z').rec(1); w.at(AT_0020).auto();
  w.at('2026-11-25T03:00:00Z').rec(2);
  const stray = w.ev.rows[w.ev.getLastRow() - 1].slice(); stray[0] = id(9899); stray[2] = '2026-11-24';
  w.ev.appendRow(stray);                            // an 11-24 row after 11-24 was sealed
  const raw = JSON.stringify(w.ev.rows), man = JSON.stringify(w.m.rows);
  for (const [day, n] of [['2026-11-25T15:20:00Z', 1], ['2026-11-26T15:20:00Z', 2], ['2026-11-27T15:20:00Z', 3]]) {
    w.at(day);
    assert.throws(() => w.auto(), /HOJA_V4_AUTO_SEAL_FAILED HOJA_V4U_UNCOMMITTED_TAIL_HOLD \(HOLD: manual review\)/);
    const st = w.state();
    assert.deepEqual([st.ok, st.hold, st.consecutiveFailures], [false, true, n]);
  }
  assert.equal(w.state().pendingPastDays, 3); assert.equal(w.state().staleRisk, true);
  assert.equal(JSON.stringify(w.ev.rows), raw, 'raw rows untouched'); assert.equal(JSON.stringify(w.m.rows), man, 'nothing sealed');
});
test('AS-8 manual and automatic sealing coexist: whichever runs second finds nothing to do', () => {
  const w = world();
  w.at('2026-11-24T10:00:00Z').rec(1); w.at(AT_0020);
  assert.deepEqual(w.rpc('hojaV4OpsSealPendingDays').sealed.map(x => x.date), ['2026-11-24']);
  assert.deepEqual(w.auto().sealed, []);
  w.at('2026-11-25T03:00:00Z').rec(2); w.at('2026-11-25T15:20:00Z');
  assert.deepEqual(w.auto().sealed, ['2026-11-25']);
  assert.deepEqual(w.rpc('hojaV4OpsSealPendingDays').sealed, []);
  assert.deepEqual(w.complete().slice(-2), ['2026-11-24', '2026-11-25']);
});

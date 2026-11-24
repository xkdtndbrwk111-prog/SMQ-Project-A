// Q08 / R7 (2026-11-24): KST midnight boundary, daily seal, cross-midnight retry, late/partial data and
// seal-failure recovery — LOCAL clock-injection tests on the REAL gas/*.gs sources in the mock engine.
// This is "LOCAL PASS/FAIL" evidence only: it is NOT an isolated-GAS run and NOT a real-midnight observation.
// Existing behaviour is pinned as-is (no new day-attribution rule is introduced here).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext, runInContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {loadProject, MockSpreadsheet, GAS_DIR} from './mock_gas.mjs';
import {buildCopy, standardHistory, ISOLATED_PROPS, id} from './fixture.mjs';

const OWNER = 'owner@example.test';
// the five instants named in the directive (KST = UTC+9)
const T = {
  '23:59:50': '2026-11-24T14:59:50Z', '23:59:59': '2026-11-24T14:59:59Z',
  '00:00:00': '2026-11-24T15:00:00Z', '00:00:01': '2026-11-24T15:00:01Z', '00:01:00': '2026-11-24T15:01:00Z',
  '00:00:03': '2026-11-24T15:00:03Z', '00:00:05': '2026-11-24T15:00:05Z'};
// R7 ids live in 9000+ so they never collide with fixture history ids
const req = (n, mode = 'SOLO') => ({eventId: id(9000 + n), mode, repositoryKind: 'PUBLIC', cartridgeIds: ['101'], cartridgeCount: 1, teamCount: mode === 'SOLO' ? 1 : 3});

/* fixture copy: certified history sealed through 2026-11-22; we start at 2026-11-24 10:00 KST and seal the
 * (empty) 11-23 first, so 11-24 is the first day under test. */
function world() {
  const {ss, sealedPrefix} = buildCopy({history: standardHistory()});
  const map = new Map([['copy40', ss], ['prod', new MockSpreadsheet('prod')], ['cert', new MockSpreadsheet('cert')]]);
  const p = loadProject({spreadsheets: map, props: ISOLATED_PROPS, now: '2026-11-24T01:00:00Z'});
  ss.trace = p.trace; p.setActive(OWNER);
  const w = {...p, ss, sealedPrefix, ev: ss.getSheetByName('EVENT_LOG'), m: ss.getSheetByName('HOJA_V4_DAILY_MANIFEST'),
    b: ss.getSheetByName('HOJA_V4_DAILY_BUCKETS'),
    W: () => JSON.parse(p.props.get('HOJA_V4_COMMIT_WATERMARK') || 'null')?.row ?? null,
    at(k) { p.setNow(T[k] || k); return w; },
    rec(n, mode) { return p.rpc('recordUsageStartU1', req(n, mode)); },
    stats() { p.cache.clear(); return p.rpc('getPublicUsageStatisticsV4'); },
    seal() { return p.rpc('hojaV4OpsSealPendingDays'); },
    dates(k) { return w.ev.rows.slice(-k).map(r => r[2]); },
    manifest(day) { return w.m.rows.filter(r => r[0] === day); }};
  const z = w.seal();
  assert.deepEqual(z.sealed.map(x => [x.date, x.starts, x.zeroDay]), [['2026-11-23', 0, true]], 'setup: empty 11-23 sealed');
  return w;
}
const sum = a => a.reduce((n, x) => n + x, 0);
const dayCount = (s, day) => (s.daily.find(d => d.date === day) || {count: null}).count;

/* ---------------------------------------------------------------- R7-1 / R7-7 */
test('R7-1 normal rollover at the five instants: rows dated by KST, 11-24 sealed exactly, raw rows untouched, totals consistent', () => {
  const w = world();
  w.at('23:59:50').rec(1); w.at('23:59:59').rec(2);
  w.at('00:00:00').rec(3); w.at('00:00:01').rec(4); w.at('00:01:00').rec(5, 'TEAM');
  assert.deepEqual(w.dates(5), ['2026-11-24', '2026-11-24', '2026-11-25', '2026-11-25', '2026-11-25']);
  assert.equal(w.W(), w.ev.getLastRow(), 'watermark = last committed row');
  const pre = w.stats();
  assert.equal(pre.status, 'OK');
  assert.deepEqual(pre.provisionalDays, ['2026-11-24', '2026-11-25'], 'before the seal both days are provisional');
  assert.equal(pre.totals.today, 3); assert.equal(dayCount(pre, '2026-11-24'), 2); assert.equal(dayCount(pre, '2026-11-23'), 0);
  const raw = JSON.stringify(w.ev.rows);
  const r = w.seal();
  assert.deepEqual(r.sealed.map(x => [x.date, x.starts, x.sourceRowCount, x.zeroDay]), [['2026-11-24', 2, 2, false]], 'only the finished day; today never sealed');
  assert.equal(JSON.stringify(w.ev.rows), raw, 'sealing never edits raw EVENT_LOG rows');
  const mrow = w.manifest('2026-11-24');
  assert.equal(mrow.length, 1); assert.equal(mrow[0][2], 'COMPLETE'); assert.match(mrow[0][1], /^[a-f0-9]{64}$/); assert.match(mrow[0][12], /^[a-f0-9]{64}$/);
  assert.equal(Number(mrow[0][11]), w.ev.getLastRow() - 3, 'sealed prefix ends at the last 11-24 row');
  const post = w.stats();
  assert.deepEqual(post.totals, pre.totals, 'seal changes no number'); assert.deepEqual(post.daily, pre.daily);
  assert.deepEqual(post.provisionalDays, ['2026-11-25']);
  assert.equal(sum(post.daily.map(d => d.count)), post.totals.all, 'sum of days == all-time total');
  assert.equal(w.seal().sealed.length, 0, 'idempotent');
});
test('R7-7 public statistics just before and just after midnight: today / yesterday / 7 / 30 / all windows', () => {
  const w = world();
  w.at('23:59:50').rec(1); w.at('23:59:59').rec(2);
  const before = w.stats();
  const d = before.daily, last = d[d.length - 1];
  assert.equal(last.date, '2026-11-24'); assert.equal(before.totals.today, 2);
  assert.equal(d[d.length - 2].date, '2026-11-23'); assert.equal(d[d.length - 2].count, 0, 'yesterday (11-23) = 0');
  assert.equal(before.totals.days7, sum(d.slice(-7).map(x => x.count)), '7 days = today + previous 6 days');
  assert.equal(before.totals.days30, sum(d.slice(-30).map(x => x.count)));
  w.at('00:00:01').rec(3);
  const after = w.stats(), a = after.daily;
  assert.equal(a[a.length - 1].date, '2026-11-25'); assert.equal(after.totals.today, 1, 'new day starts at 1 — 11-24 starts never leak into today');
  assert.equal(a[a.length - 2].date, '2026-11-24'); assert.equal(a[a.length - 2].count, 2, 'yesterday now = 11-24');
  assert.equal(after.totals.days7, sum(a.slice(-7).map(x => x.count)), 'window moved: oldest day dropped, 11-25 added');
  assert.equal(after.totals.all, before.totals.all + 1);
  for (let i = 1; i < a.length; i++) assert.equal(a[i].date, new Date(Date.parse(a[i - 1].date) + 86400000).toISOString().slice(0, 10), 'contiguous days');
  const txt = JSON.stringify(after);
  assert.doesNotMatch(txt, new RegExp(id(9001) + '|copy40|prod|cert|@'), 'no eventIds, storage ids or e-mails in the public response');
});

/* ---------------------------------------------------------------- R7-2 */
test('R7-2 a day with zero starts: sealed as an explicit zero day, no error, totals unchanged', () => {
  const w = world();
  w.at('23:59:59').rec(1); w.at('00:00:01').rec(2);
  w.at('2026-11-26T15:00:30Z'); // 11-27 00:00:30 KST — 11-26 had no start
  const pre = w.stats();
  assert.equal(pre.status, 'OK');
  const r = w.seal();
  assert.deepEqual(r.sealed.map(x => [x.date, x.starts, x.zeroDay]), [['2026-11-24', 1, false], ['2026-11-25', 1, false], ['2026-11-26', 0, true]]);
  const z = w.manifest('2026-11-26')[0];
  assert.equal(z[2], 'COMPLETE'); assert.equal(z[5], '0'); assert.equal(z[3], '0'); assert.equal(z[4], '0');
  const post = w.stats();
  assert.equal(dayCount(post, '2026-11-26'), 0); assert.equal(post.totals.all, pre.totals.all);
  assert.equal(sum(post.daily.map(d => d.count)), post.totals.all);
});

/* ---------------------------------------------------------------- client harness (clock shared with the mock) */
const CLIENT = readFileSync(GAS_DIR + '/UsageTelemetryClient.html', 'utf8').replace(/^\s*<script id="hojaProdUsageTelemetry">/, '').replace(/<\/script>\s*$/, '');
function client(w, {storage = new Map(), gate = null, fault = () => null} = {}) {
  const calls = [];
  const env = {setTimeout: f => setImmediate(f), Promise, Math, JSON, Date: w.ctx.Date, String, Error, Set, Object, Array};
  env.window = env;
  env.localStorage = {getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => storage.set(k, String(v))};
  env.crypto = {randomUUID}; env.HOJA_B_LIVE = {sources: [{data: {cartridgeId: '101'}}]};
  const runner = (ok, fail) => ({withSuccessHandler: f => runner(f, fail), withFailureHandler: f => runner(ok, f),
    recordUsageStartU1(p) {
      const n = calls.push({eventId: p.eventId, keys: Object.keys(p).sort()});
      const go = () => { const f = fault(n, p); if (f && f.before) return fail({message: f.before});
        let r; try { r = w.rpc('recordUsageStartU1', p); } catch (e) { return fail({message: e.message}); }
        if (f && f.lostReply) return fail({message: 'NetworkError: connection reset'}); ok(r); };
      if (gate) gate(go); else setImmediate(go);
    }});
  env.google = {script: {run: runner(() => {}, () => {})}};
  runInContext(CLIENT, createContext(env));
  return {api: env.HOJA_USAGE, calls, storage};
}
const tick = async n => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

/* ---------------------------------------------------------------- R7-3 */
test('R7-3 started 23:59:59, reaches the server 00:00:03: one row, dated by SERVER receive day (existing policy; payload has no client time)', async () => {
  const w = world();
  let release;
  const c = client(w, {gate: go => { release = go; }});
  w.at('23:59:59'); c.api.track('SOLO', 1);
  await tick(5);
  assert.equal(c.calls.length, 1);
  assert.deepEqual(c.calls[0].keys, ['cartridgeCount', 'cartridgeIds', 'eventId', 'mode', 'repositoryKind', 'teamCount'], 'the client sends NO event time');
  const before = w.ev.getLastRow();
  w.at('00:00:03'); release(); await tick(20);
  assert.equal(w.ev.getLastRow(), before + 1, 'stored exactly once');
  assert.equal(w.ev.rows[before][2], '2026-11-25', 'counted on the server receive day (11-25), not the click day (11-24)');
  assert.equal(c.api.status().delivered, 1);
});

/* ---------------------------------------------------------------- R7-4 */
test('R7-4a committed at 23:59:59 but reply lost; same eventId re-sent after midnight -> duplicateIgnored (originalDate 11-24), zero extra rows', async () => {
  const w = world();
  const c = client(w, {fault: n => n === 1 ? {lostReply: true} : null});
  w.at('23:59:59'); c.api.track('SOLO', 1);
  await tick(3); w.at('00:00:05'); await tick(200);
  const s = c.api.status();
  const ids = c.calls.map(x => x.eventId);
  assert.ok(ids.length >= 2 && new Set(ids).size === 1, 'retry keeps the same eventId');
  assert.equal(s.delivered, 1); assert.equal(s.duplicateIgnored, 1); assert.ok(s.retries >= 1);
  const rows = w.ev.rows.filter(r => r[0] === ids[0]);
  assert.equal(rows.length, 1); assert.equal(rows[0][2], '2026-11-24');
  assert.equal(w.W(), w.ev.getLastRow());
});
test('R7-4b failed before commit at 23:59:59; retried after midnight -> stored once on 11-25 (server-day policy); server-only first attempt = 0 rows', async () => {
  const w = world();
  const held = [];
  const c = client(w, {gate: go => held.push(go), fault: n => n === 1 ? {before: 'Exception: USAGE_APPEND_LOCK_TIMEOUT'} : null});
  const before = w.ev.getLastRow();
  w.at('23:59:59'); c.api.track('SOLO', 1);
  await tick(3); held.shift()();              // attempt 1 reaches the server at 23:59:59 and fails before commit
  for (let i = 0; i < 200 && !held.length; i++) await tick(1);
  assert.equal(w.ev.getLastRow(), before, 'server-only result of the first attempt: nothing stored');
  assert.equal(held.length, 1, 'the client issued a retry (in-flight, same page)');
  w.at('00:00:05'); held.shift()();            // the retry reaches the server after midnight
  await tick(50);
  const id0 = c.calls[0].eventId;
  assert.ok(c.calls.length === 2 && c.calls.every(x => x.eventId === id0), 'same eventId');
  const rows = w.ev.rows.filter(r => r[0] === id0);
  assert.equal(rows.length, 1, 'client recovery: exactly one row'); assert.equal(rows[0][2], '2026-11-25');
  assert.equal(c.api.status().delivered, 1);
});
test('R7-4c after 11-24 is SEALED, a re-send of an 11-24 event is still recognised (dedupe window spans the last sealed day) -> no new row', () => {
  const w = world();
  w.at('23:59:59').rec(7);
  w.at('00:00:01').rec(8);
  w.at('2026-11-24T16:00:00Z').seal();       // 11-25 01:00 KST: 11-24 sealed
  const n = w.ev.getLastRow();
  const r = w.rec(7);
  assert.equal(r.duplicateIgnored, true); assert.equal(r.originalDate, '2026-11-24');
  assert.equal(w.ev.getLastRow(), n);
});
/* R7-4d..k — 40-6AI (teacher decision 2026-11-24, R7 alternative 3). CHANGED EXPECTATION: until 40-6AG the client
 * EXPIRED a start still queued when the KST day changed ("a past day's start can no longer be dated correctly"), which
 * lost it. Now it is re-sent with the SAME eventId and counted on the server receive day; only starts queued more than
 * one KST day ago expire (dedupe-window safety horizon, see UsageTelemetryClient.html). */
const KEY = 'hoja_usage_pending_v1';
async function queueOne(w, at, {storage = new Map(), committed = false} = {}) {
  // a start whose every in-page attempt fails (429), or — committed:true — whose FIRST attempt is stored but its reply lost
  const down = client(w, {storage, fault: n => committed && n === 1 ? {lostReply: true} : {before: 'Exception: SHEETS_HTTP_429_RATE_LIMIT_EXCEEDED'}});
  w.at(at); down.api.track('SOLO', 1);
  for (let i = 0; i < 4000 && !(down.calls.length >= 6 && JSON.parse(storage.get(KEY) || '[]').length === 1 && down.api.status().retries >= 5); i++) await tick(1);
  await tick(5);
  const q = JSON.parse(storage.get(KEY));
  assert.equal(q.length, 1, 'still queued after the in-page budget'); return {storage, eventId: q[0].payload.eventId, day: q[0].day};
}
test('R7-4d (NEW POLICY) a start queued on 11-24 is re-sent on 11-25 with the same eventId and stored once on 11-25', async () => {
  const w = world();
  const {storage, eventId, day} = await queueOne(w, '23:59:50');
  assert.equal(day, '2026-11-24'); assert.equal(w.ev.rows.filter(r => r[0] === eventId).length, 0, 'nothing stored on 11-24');
  w.at('00:01:00');
  const up = client(w, {storage});
  await up.api.flush();
  const s = up.api.status();
  assert.equal(s.expired, 0); assert.equal(s.resentFromPreviousDay, 1); assert.equal(s.delivered, 1);
  assert.deepEqual(up.calls.map(x => x.eventId), [eventId], 'same eventId');
  const rows = w.ev.rows.filter(r => r[0] === eventId);
  assert.equal(rows.length, 1); assert.equal(rows[0][2], '2026-11-25', 'counted on the server receive day');
  assert.equal(storage.get(KEY), '[]');
});
test('R7-4e stored at 23:59:59 but every reply lost -> queued; re-sent next day before AND after 11-24 is sealed -> duplicateIgnored, 0 extra rows', async () => {
  for (const sealFirst of [false, true]) {
    const w = world();
    const {storage, eventId} = await queueOne(w, '23:59:59', {committed: true});
    assert.equal(w.ev.rows.filter(r => r[0] === eventId).length, 1, 'stored once on 11-24');
    w.at('2026-11-24T15:10:00Z');                     // 11-25 00:10 KST
    if (sealFirst) assert.deepEqual(w.seal().sealed.map(x => x.date), ['2026-11-24']);
    const up = client(w, {storage});
    await up.api.flush();
    assert.equal(up.api.status().duplicateIgnored, 1, 'sealFirst=' + sealFirst);
    assert.equal(w.ev.rows.filter(r => r[0] === eventId).length, 1, 'no duplicate, sealFirst=' + sealFirst);
    assert.equal(w.ev.rows.find(r => r[0] === eventId)[2], '2026-11-24');
  }
});
test('R7-4f reopening 2 or 3 days later: the start EXPIRES (counted in status.expiredBeyondHorizon) — and why: a D+2 re-send would double-count', async () => {
  for (const later of ['2026-11-25T23:00:00Z', '2026-11-26T23:00:00Z']) {   // 11-26 08:00 / 11-27 08:00 KST
    const w = world();
    const {storage} = await queueOne(w, '23:59:50');
    w.at(later);
    const up = client(w, {storage});
    await up.api.flush();
    const s = up.api.status();
    assert.equal(s.expiredBeyondHorizon, 1); assert.equal(s.expired, 1); assert.equal(up.calls.length, 0, later);
  }
  // the hazard the horizon prevents: stored on 11-24 (reply lost), 11-24 and 11-25 sealed by 11-26, then re-sent on 11-26
  const w = world();
  w.at('23:59:59').rec(70);
  w.at('2026-11-25T15:10:00Z');                       // 11-26 00:10 KST — daily seal ran for 11-24 and 11-25
  w.seal();
  const r = w.rec(70);
  assert.ok(!r.duplicateIgnored, 'outside the dedupe window the server can no longer recognise it');
  assert.equal(w.ev.rows.filter(x => x[0] === id(9070)).length, 2, 'a D+2 re-send WOULD double-count -> the client must not do it');
});
test('R7-4g still offline / 429 on the next day: the start stays queued (not expired) and is delivered once the server answers', async () => {
  const w = world();
  const {storage, eventId} = await queueOne(w, '23:59:50');
  w.at('00:01:00');
  const still = client(w, {storage, fault: () => ({before: 'NetworkError: offline'})});
  await still.api.flush();
  assert.equal(still.api.status().expired, 0); assert.equal(JSON.parse(storage.get(KEY)).length, 1);
  w.at('2026-11-25T03:00:00Z');                       // 11-25 12:00 KST, back online
  const up = client(w, {storage});
  await up.api.flush();
  assert.equal(w.ev.rows.filter(r => r[0] === eventId).length, 1); assert.equal(storage.get(KEY), '[]');
});
test('R7-4h two tabs re-send the same queued start at once -> one row, the other tab gets duplicateIgnored', async () => {
  const w = world();
  const {storage, eventId} = await queueOne(w, '23:59:50');
  w.at('00:01:00');
  const a = client(w, {storage}), b = client(w, {storage});
  await Promise.all([a.api.flush(), b.api.flush()]);
  assert.equal(w.ev.rows.filter(r => r[0] === eventId).length, 1);
  assert.equal(a.api.status().delivered + b.api.status().delivered, 2);
  assert.equal(a.api.status().duplicateIgnored + b.api.status().duplicateIgnored, 1);
});
test('R7-4i corrupt / invalid / duplicated localStorage is counted, never crashes, and valid entries are sent once', async () => {
  const w = world();
  w.at('00:01:00');
  const corrupt = client(w, {storage: new Map([[KEY, '{not json']])});
  await corrupt.api.flush();
  assert.equal(corrupt.api.status().corruptQueue, 1); assert.equal(corrupt.calls.length, 0);
  const good = id(9500);
  const p = {eventId: good, mode: 'SOLO', repositoryKind: 'PUBLIC', cartridgeIds: ['101'], cartridgeCount: 1, teamCount: 1};
  const storage = new Map([[KEY, JSON.stringify([{day: '2026-11-24', payload: p}, {day: '2026-11-24', payload: p},
    {day: 'yesterday', payload: {...p, eventId: id(9501)}}, {day: '2026-11-24', payload: {...p, eventId: 'x'}}, null, 7])]]);
  const c = client(w, {storage});
  await c.api.flush();
  const s = c.api.status();
  assert.equal(s.invalidQueueEntries, 5, 'duplicate, bad day, bad id, null, number');
  assert.deepEqual(c.calls.map(x => x.eventId), [good]); assert.equal(w.ev.rows.filter(r => r[0] === good).length, 1);
});
test('R7-4j queue overflow beyond 200 pending starts is counted (status.overflowDropped), oldest first', async () => {
  const w = world();
  w.at('00:01:00');
  const list = Array.from({length: 205}, (_, i) => ({day: '2026-11-25', payload: {eventId: id(9600 + i), mode: 'SOLO', repositoryKind: 'PUBLIC', cartridgeIds: ['101'], cartridgeCount: 1, teamCount: 1}}));
  const storage = new Map([[KEY, JSON.stringify(list)]]);
  const c = client(w, {storage, fault: () => ({before: 'NetworkError: offline'})});
  c.api.track('SOLO', 1);
  for (let i = 0; i < 200; i++) await tick(1);
  assert.ok(c.api.status().overflowDropped >= 5, JSON.stringify(c.api.status()));
  assert.equal(JSON.parse(storage.get(KEY)).length, 200);
});

/* ---------------------------------------------------------------- R7-5 */
test('R7-5a a LATE 11-24 row written after 11-24 was sealed is never silently dropped or counted: reader, writer and seal all HOLD', () => {
  const w = world();
  w.at('23:59:59').rec(1); w.at('2026-11-24T16:00:00Z').seal(); w.rec(2);
  const good = w.stats();
  const late = w.ev.rows[w.ev.getLastRow() - 2].slice(); late[0] = id(9099); // a stray 11-24 row appended outside the writer
  w.ev.appendRow(late);
  assert.equal(w.stats().status, 'OK', 'reader still serves the committed cut (the stray row is beyond the watermark)');
  assert.deepEqual(w.stats().totals, good.totals, 'the uncommitted late row is not counted');
  assert.throws(() => w.rec(3), /UNCOMMITTED_TAIL_HOLD/, 'writer refuses to adopt an out-of-order tail');
  w.at('2026-11-25T16:00:00Z');
  assert.throws(() => w.seal(), /UNCOMMITTED_TAIL_HOLD/, 'seal refuses too');
  w.ev.rows.splice(w.ev.getLastRow() - 1, 1); // operator removes the stray row (test cleanup)
  assert.deepEqual(w.seal().sealed.map(x => x.date), ['2026-11-25']);
});
test('R7-5b appended-but-uncommitted row (crash before the watermark) is invisible, then adopted once — no loss, no duplicate', () => {
  const w = world();
  w.at('23:59:50').rec(1);
  runInContext('var __wmFail=1;var __wm=hojaV4uWriteWatermark_;hojaV4uWriteWatermark_=function(){if(__wmFail-->0)throw Error("INJECTED_AFTER_APPEND");return __wm.apply(this,arguments)};', w.ctx);
  assert.throws(() => w.at('23:59:59').rec(2), /INJECTED_AFTER_APPEND/);
  const mid = w.stats();
  assert.equal(dayCount(mid, '2026-11-24'), 1, 'row 2 is beyond the watermark: not yet public');
  const r = w.rec(2);                         // the client's same-eventId retry (still 23:59:59)
  assert.equal(r.duplicateIgnored, true, 'retry finds the adopted row');
  assert.equal(w.ev.rows.filter(x => x[0] === id(9002)).length, 1);
  assert.equal(dayCount(w.stats(), '2026-11-24'), 2); assert.equal(w.W(), w.ev.getLastRow());
});
test('R7-5c tampered sealed bucket -> public stats UNAVAILABLE (no numbers), restore -> OK; re-seal stays idempotent', () => {
  const w = world();
  w.at('23:59:59').rec(1); w.at('2026-11-24T16:00:00Z').seal();
  const ok = w.stats();
  const row = w.b.rows.findIndex(r => r[0] === '2026-11-24');
  const orig = w.b.rows[row][5]; w.b.rows[row][5] = '999';
  const bad = w.stats();
  assert.equal(bad.status, 'UNAVAILABLE'); assert.equal(bad.totals, undefined);
  w.b.rows[row][5] = orig;
  assert.deepEqual(w.stats().totals, ok.totals);
  assert.equal(w.seal().sealed.length, 0);
});

/* ---------------------------------------------------------------- R7-6 */
function failingComplete(w, {after = false} = {}) {
  let armed = true;
  const orig = w.m.getRange.bind(w.m);
  w.m.getRange = (r, c, n, wd) => { const g = orig(r, c, n, wd);
    if (c === 3) { const sv = g.setValue.bind(g); g.setValue = v => { if (v === 'COMPLETE' && armed && !after) { armed = false; throw Error('INJECTED_BEFORE_COMPLETE'); }
      const out = sv(v); if (v === 'COMPLETE' && armed && after) { armed = false; throw Error('INJECTED_AFTER_COMPLETE'); } return out; }; }
    return g; };
}
test('R7-6 seal failures at each step converge to the same COMPLETE result and never publish a partial day', () => {
  for (const where of ['buckets', 'beforeComplete', 'afterComplete', 'afterAppendBeforeWatermark']) {
    const w = world();
    w.at('23:59:50').rec(1); w.at('23:59:59').rec(2, 'TEAM'); w.at('00:00:01').rec(3);
    const ref = w.stats();
    w.at('2026-11-24T16:00:00Z');
    if (where === 'buckets') {
      let crash = true; w.ss.hooks.onWrite = s => { if (crash && s.name === 'HOJA_V4_DAILY_BUCKETS') { crash = false; throw Error('INJECTED_BUCKETS'); } };
      assert.throws(() => w.seal(), /INJECTED_BUCKETS/);
    } else if (where === 'beforeComplete') {
      failingComplete(w); assert.throws(() => w.seal(), /INJECTED_BEFORE_COMPLETE/);
    } else if (where === 'afterComplete') {
      failingComplete(w, {after: true}); assert.throws(() => w.seal(), /INJECTED_AFTER_COMPLETE/);
    } else {
      runInContext('var __wmFail=1;var __wm=hojaV4uWriteWatermark_;hojaV4uWriteWatermark_=function(){if(__wmFail-->0)throw Error("INJECTED_WM");return __wm.apply(this,arguments)};', w.ctx);
      assert.throws(() => w.rec(4), /INJECTED_WM/);
      assert.equal(w.stats().totals.all, ref.totals.all, 'uncommitted start not public');
      assert.equal(w.rec(4).duplicateIgnored, true, 'retry adopts the row once');
    }
    assert.equal(w.locks.held, false, where + ': lock released');
    const mid = w.stats();
    assert.equal(mid.status, 'OK', where);
    if (where !== 'afterComplete' && where !== 'afterAppendBeforeWatermark')
      assert.deepEqual(mid.provisionalDays, ['2026-11-24', '2026-11-25'], where + ': a PREPARING day is still provisional, never shown as sealed');
    const again = w.seal();
    assert.ok(again.sealed.length <= 1, where);
    const m = w.manifest('2026-11-24');
    assert.equal(m.length, 1, where + ': exactly one manifest row'); assert.equal(m[0][2], 'COMPLETE', where);
    assert.equal(w.b.rows.filter(r => r[0] === '2026-11-24').length, Number(m[0][8]), where + ': bucket rows match the manifest');
    const fin = w.stats();
    const extra = where === 'afterAppendBeforeWatermark' ? 1 : 0;
    assert.equal(fin.totals.all, ref.totals.all + extra, where + ': converged totals');
    assert.equal(dayCount(fin, '2026-11-24'), 2, where);
    assert.deepEqual(fin.provisionalDays, ['2026-11-25'], where);
    assert.equal(w.seal().sealed.length, 0, where + ': idempotent');
  }
});

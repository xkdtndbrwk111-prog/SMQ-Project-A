// 40-6CG: HOJA 1.5 teacher stats app — read-only aggregation over a synthetic EVENT_LOG (in-memory GAS mock).
// Run from the repo root: node --test experimental/hoja15-stats-app/hoja15_stats.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadProject, MockSpreadsheet, EVENT_HEADER as HEADERS} from '../usage-v4-unified/mock_gas.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const units = Object.keys(JSON.parse(readFileSync(DIR + '/Code.gs', 'utf8').match(/const H15S_UNITS_=Object\.freeze\(([\s\S]*?)\);\n/)[1]));

export function syntheticLog({days = 15, perDay = 12, legacy = 30, end = '2026-11-24'} = {}) {
  const rows = [HEADERS];
  const t0 = Date.parse('2026-10-01T01:00:00Z');
  for (let i = 0; i < legacy; i++) rows.push(['e' + i, new Date(t0 + i * 3600e3), '2026-10-0' + (1 + (i % 9)), 'SOLO', 'PUBLIC', '6', '사회', '', 'old', 1, 0, '123', 'PUBLIC:x', 'U3S1', '["옛 카트리지"]']);
  const endMs = Date.parse(end + 'T00:00:00+09:00');
  let k = 0;
  for (let d = days - 1; d >= 0; d--) {
    const dayMs = endMs - d * 86400e3;
    for (let j = 0; j < perDay + (d % 3); j++, k++) {
      const ts = new Date(dayMs + (9 + (j % 6)) * 3600e3 + j * 60e3);            // 09~14시 KST
      const team = k % 3 === 0, n = 1 + (k % 4 === 0 ? 1 : 0);
      const titles = Array.from({length: n}, (_, q) => units[(k + q * 5) % units.length]);
      const date = new Date(dayMs + 9 * 3600e3).toISOString().slice(0, 10);
      rows.push(['a' + k, ts, date, team ? 'TEAM' : 'SOLO', 'PUBLIC', String(5 + (k % 2)), k % 2 ? '사회' : '영어', '', titles.join(' + '), n,
        team ? 2 + (k % 3) : 0, 'ids', 'APPROVED:440cc1fe60c6', 'A1', JSON.stringify(titles)]);
    }
  }
  return rows;
}
function project(rows, {id = 'statsSheet', now = '2026-11-24T05:00:00Z'} = {}) {
  const ss = new MockSpreadsheet(id); ss.add('EVENT_LOG', rows);
  return loadProject({spreadsheets: new Map([[id, ss]]), props: {}, now, gasDir: DIR, gasFiles: ['Code.gs']});
}

test('first open asks for setup; setup accepts only a spreadsheet with an EVENT_LOG', () => {
  const p = project(syntheticLog(), {id: 'statsSheetstatsSheet0000'});
  assert.deepEqual(p.call('hoja15StatsGet(true)'), {needsSetup: true});
  assert.throws(() => p.call("hoja15StatsSetup('not a url')"), /주소/);
  const other = new MockSpreadsheet('otherSheetotherSheet0000'); other.add('Sheet1', [['a']]);
  assert.deepEqual(p.call("hoja15StatsSetup('https://docs.google.com/spreadsheets/d/statsSheetstatsSheet0000/edit#gid=0')"), {ok: true});
  assert.equal(p.props.get('HOJA15_STATS_SPREADSHEET_ID'), 'statsSheetstatsSheet0000');
  assert.equal(p.call('hoja15StatsGet(true)').periods.all.total > 0, true);
});

test('counts only HOJA 1.5 (A1) rows; periods, solo/team, units, hours are consistent', () => {
  const rows = syntheticLog();
  const p = project(rows, {id: 'statsSheetstatsSheet0000'});
  p.call("hoja15StatsSetup('statsSheetstatsSheet0000')");
  const v = p.call('hoja15StatsGet(true)');
  const a1 = rows.filter(r => r[13] === 'A1');
  assert.equal(v.periods.all.total, a1.length);
  assert.equal(v.today, '2026-11-24');
  assert.equal(v.since, a1[0][2]);
  assert.equal(v.periods.all.solo + v.periods.all.team, a1.length);
  assert.equal(v.periods.all.team, a1.filter(r => r[3] === 'TEAM').length);
  assert.equal(v.periods.today.total, a1.filter(r => r[2] === '2026-11-24').length);
  const last7 = new Set(Array.from({length: 7}, (_, i) => new Date(Date.parse('2026-11-24T00:00:00Z') - i * 86400e3).toISOString().slice(0, 10)));
  assert.equal(v.periods.d7.total, a1.filter(r => last7.has(r[2])).length);
  assert.equal(v.periods.all.hours.reduce((s, x) => s + x, 0), a1.length);
  assert.ok(v.periods.all.hours.slice(9, 15).every(x => x > 0) && v.periods.all.hours[3] === 0, 'KST hours');
  const unitTotal = a1.reduce((s, r) => s + JSON.parse(r[14]).length, 0);
  assert.equal(v.periods.all.units.reduce((s, u) => s + u.count, 0), unitTotal);
  assert.ok(v.periods.all.units.every(u => /^[0-9-]+\. /.test(u.label)), 'short approved unit names');
  assert.equal(v.daily.at(-1).date, '2026-11-24');
  assert.equal(v.daily.reduce((s, d) => s + d.count, 0), a1.length);
  assert.ok(!JSON.stringify(v).includes('옛 카트리지'), 'legacy rows excluded');
});

test('second call is served from the 5-minute cache; refresh recomputes; first A1 row is remembered', () => {
  const p = project(syntheticLog(), {id: 'statsSheetstatsSheet0000'});
  p.call("hoja15StatsSetup('statsSheetstatsSheet0000')");
  const a = p.call('hoja15StatsGet(false)'), b = p.call('hoja15StatsGet(false)'), c = p.call('hoja15StatsGet(true)');
  assert.equal(a.cached, false); assert.equal(b.cached, true); assert.equal(c.cached, false);
  assert.equal(Number(p.props.get('HOJA15_STATS_FIRST_ROW')), 32);    // header + 30 legacy rows
  assert.equal(c.rowsRead, a.rowsRead);
});

test('no HOJA 1.5 rows yet -> empty (no crash)', () => {
  const p = project(syntheticLog({days: 0, perDay: 0}), {id: 'statsSheetstatsSheet0000'});
  p.call("hoja15StatsSetup('statsSheetstatsSheet0000')");
  assert.equal(p.call('hoja15StatsGet(true)').empty, true);
});

test('read-only: no writes to the spreadsheet', () => {
  const rows = syntheticLog();
  const ss = new MockSpreadsheet('statsSheetstatsSheet0000'); ss.add('EVENT_LOG', rows);
  const p = loadProject({spreadsheets: new Map([['statsSheetstatsSheet0000', ss]]), props: {}, now: '2026-11-24T05:00:00Z', gasDir: DIR, gasFiles: ['Code.gs']});
  p.call("hoja15StatsSetup('statsSheetstatsSheet0000')"); p.call('hoja15StatsGet(true)');
  assert.ok(!ss.trace.some(t => /^(WRITE|APPEND|INSERT)/.test(t)), ss.trace.join(','));
});

test('rows deleted at the top of EVENT_LOG: the remembered start row is re-checked, nothing is skipped', () => {
  const rows = syntheticLog();
  const ss = new MockSpreadsheet('statsSheetstatsSheet0000'); const ev = ss.add('EVENT_LOG', rows);
  const p = loadProject({spreadsheets: new Map([['statsSheetstatsSheet0000', ss]]), props: {}, now: '2026-11-24T05:00:00Z', gasDir: DIR, gasFiles: ['Code.gs']});
  p.call("hoja15StatsSetup('statsSheetstatsSheet0000')");
  const before = p.call('hoja15StatsGet(true)').periods.all.total;
  assert.equal(Number(p.props.get('HOJA15_STATS_FIRST_ROW')), 32);
  ev.rows.splice(1, 30 + 20);                        // teacher deletes the 30 legacy rows and the first 20 A1 rows
  const after = p.call('hoja15StatsGet(true)');
  assert.equal(after.periods.all.total, before - 20);
  assert.equal(Number(p.props.get('HOJA15_STATS_FIRST_ROW')), 2);
});

test('the connected sheet can be changed later (copy -> original); the result names the connected file', () => {
  const a = new MockSpreadsheet('copySheetcopySheet000000'); a.getName = () => 'SMQ_USAGE_TELEMETRY의 사본'; a.add('EVENT_LOG', syntheticLog({days: 2, perDay: 3}));
  const b = new MockSpreadsheet('origSheetorigSheet000000'); b.getName = () => 'SMQ_USAGE_TELEMETRY'; b.add('EVENT_LOG', syntheticLog());
  for (const s of [a, b]) for (const sh of s.sheets.values()) sh.getParent = () => s;
  const p = loadProject({spreadsheets: new Map([[a.id, a], [b.id, b]]), props: {}, now: '2026-11-24T05:00:00Z', gasDir: DIR, gasFiles: ['Code.gs']});
  p.call(`hoja15StatsSetup('${a.id}')`); const v1 = p.call('hoja15StatsGet(false)');
  assert.equal(v1.sourceName, 'SMQ_USAGE_TELEMETRY의 사본');
  p.call(`hoja15StatsSetup('https://docs.google.com/spreadsheets/d/${b.id}/edit')`); const v2 = p.call('hoja15StatsGet(false)');
  assert.equal(v2.sourceName, 'SMQ_USAGE_TELEMETRY'); assert.equal(v2.cached, false, 'cache cleared on change');
  assert.ok(v2.periods.all.total > v1.periods.all.total);
});

// 40-6CF: single-mode join code (routing alias only). Runs the real gas/*.gs in the in-memory GAS mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject, MockSpreadsheet} from './mock_gas.mjs';
import {buildCopy, standardHistory, ISOLATED_PROPS} from './fixture.mjs';

function project() {
  const {ss} = buildCopy({history: standardHistory()});
  const p = loadProject({spreadsheets: new Map([['copy40', ss], ['prod', new MockSpreadsheet('prod')], ['cert', new MockSpreadsheet('cert')]]),
    props: {...ISOLATED_PROPS}});
  return p;
}
const err = (p, expr) => { try { p.call(expr); return 'NO_ERROR'; } catch (e) { return String(e.message); } };
const joinKeys = p => [...p.props.keys()].filter(k => k.startsWith('HOJA15_JOIN_'));

test('create -> resolve returns only mode/names/season; stores no question data or token', () => {
  const p = project();
  const names = p.call('hojaListPublicCartridges().map(r=>r.name)');
  assert.ok(names.length >= 1);
  const r = p.call(`hojaJoinCreate({mode:'arcade',names:${JSON.stringify(names.slice(0, 1))},season:'winter'})`);
  assert.match(r.code, /^\d{6}$/);
  assert.equal(r.url, '', 'no student URL configured and getUrl() is not an /exec URL -> code-only');
  const s = p.call(`hojaJoinResolve(${JSON.stringify(r.code)})`);
  assert.deepEqual({mode: s.mode, names: s.names, season: s.season}, {mode: 'arcade', names: names.slice(0, 1), season: 'winter'});
  const stored = JSON.parse(p.props.get('HOJA15_JOIN_' + r.code));
  assert.deepEqual(Object.keys(stored).sort(), ['expires', 'issued', 'mode', 'names', 'season', 'tokenHash', 'v']);
  assert.ok(!JSON.stringify(stored).includes(r.token), 'raw token never stored');
  assert.equal(stored.expires - stored.issued, 8 * 3600 * 1000);
});

test('invalid selections and unknown cartridges are refused', () => {
  const p = project();
  assert.match(err(p, `hojaJoinCreate({mode:'team',names:['x']})`), /HOJA15_JOIN_MODE_INVALID/);
  assert.match(err(p, `hojaJoinCreate({mode:'quiz',names:[]})`), /HOJA15_JOIN_SELECTION_INVALID/);
  assert.match(err(p, `hojaJoinCreate({mode:'quiz',names:['a','b','c','d','e','f']})`), /HOJA15_JOIN_SELECTION_INVALID/);
  assert.match(err(p, `hojaJoinCreate({mode:'quiz',names:['비공개-개인-문제은행']})`), /HOJA15_JOIN_NOT_APPROVED/);
  assert.equal(joinKeys(p).length, 0);
});

test('typo / expired / revoked codes give clear errors; expired entries are swept', () => {
  const p = project();
  const names = p.call('hojaListPublicCartridges().map(r=>r.name)').slice(0, 1);
  assert.match(err(p, `hojaJoinResolve('12a456')`), /HOJA15_JOIN_CODE_INVALID/);
  const a = p.call(`hojaJoinCreate({mode:'quiz',names:${JSON.stringify(names)}})`);
  const wrong = a.code === '999999' ? '999998' : '999999';
  assert.match(err(p, `hojaJoinResolve('${wrong}')`), /HOJA15_JOIN_NOT_FOUND/);
  assert.equal(p.call(`hojaJoinRevoke('${a.code}','not-the-token-123')`), false);
  assert.equal(p.call(`hojaJoinRevoke('${a.code}',${JSON.stringify(a.token)})`), true);
  assert.match(err(p, `hojaJoinResolve('${a.code}')`), /HOJA15_JOIN_NOT_FOUND/);
  const b = p.call(`hojaJoinCreate({mode:'quiz',names:${JSON.stringify(names)}})`);
  p.clock.ms += 8 * 3600 * 1000 + 1;
  assert.match(err(p, `hojaJoinResolve('${b.code}')`), /HOJA15_JOIN_EXPIRED/);
  const c = p.call(`hojaJoinCreate({mode:'arcade',names:${JSON.stringify(names)}})`);
  assert.deepEqual(joinKeys(p), ['HOJA15_JOIN_' + c.code], 'old codes swept on create');
});

test('many students resolve the same code independently; create is rate limited', () => {
  const p = project();
  const names = p.call('hojaListPublicCartridges().map(r=>r.name)').slice(0, 1);
  const a = p.call(`hojaJoinCreate({mode:'arcade',names:${JSON.stringify(names)}})`);
  for (let i = 0; i < 40; i++) assert.equal(p.call(`hojaJoinResolve('${a.code}')`).mode, 'arcade');
  let busy = '';
  for (let i = 0; i < 70 && !busy; i++) { const e = err(p, `hojaJoinCreate({mode:'arcade',names:${JSON.stringify(names)}})`); if (/BUSY/.test(e)) busy = e; }
  assert.match(busy, /HOJA15_JOIN_BUSY/);
});

test('student URL: bundle constant wins; getUrl() only if it is an /exec URL', () => {
  const p = project();
  const names = p.call('hojaListPublicCartridges().map(r=>r.name)').slice(0, 1);
  p.ctx.__serviceUrl = 'https://script.google.com/macros/s/AKfycbTESTONLY0000000000000000/dev';
  assert.equal(p.call(`hojaJoinCreate({mode:'quiz',names:${JSON.stringify(names)}})`).url, '');
  p.ctx.__serviceUrl = 'https://script.google.com/macros/s/AKfycbTESTONLY0000000000000000/exec';
  assert.match(p.call(`hojaJoinCreate({mode:'quiz',names:${JSON.stringify(names)}})`).url, /\/exec\?join=\d{6}$/);
  p.call(`HOJA15_JOIN_STUDENT_URL_='https://script.google.com/macros/s/AKfycbBUNDLEONLY000000000000000/exec'`);
  assert.match(p.call(`hojaJoinCreate({mode:'quiz',names:${JSON.stringify(names)}})`).url, /BUNDLEONLY0+\/exec\?join=\d{6}$/);
});

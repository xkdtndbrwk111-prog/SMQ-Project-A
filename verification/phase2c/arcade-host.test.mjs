import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../web/current/js/arcade-host.js', import.meta.url), 'utf8');

function host() {
  let receive;
  const posted = [], statuses = [], calls = [], timers = new Set();
  const parent = {postMessage: message => posted.push(message)};
  const window = {addEventListener: (type, fn) => { assert.equal(type, 'message'); receive = fn; }};
  vm.runInNewContext(source, {window, parent, setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn)});
  window.HOJA_CONNECT_ARCADE_HOST({
    prepare: (sources, names) => calls.push([sources, names]),
    launch: () => calls.push('launch'),
    showStatus: value => statuses.push(value)
  });
  return {posted, statuses, calls, timers, rpc:window.HOJA_STEP10_RPC,
    send: (data, source = parent) => receive({data, source})};
}

test('only the parent can start; invalid names can be retried and launch happens once', () => {
  const h = host();
  assert.equal(h.posted[0].type, 'HOJA_V058_ARCADE_READY');
  const start = {type:'HOJA_V058_ARCADE_START', sources:[{sheetName:'단원'}], names:['단원']};
  h.send(start, {});
  h.send({...start, names:['다른 단원']});
  assert.match(h.statuses.at(-1), /이름 불일치/);
  assert.equal(h.calls.length, 0);
  h.send(start);
  h.send(start);
  assert.deepEqual(h.calls, [[start.sources, start.names], 'launch']);
});

test('ranking messages correlate out of order and expired replies are ignored', async () => {
  const h = host();
  await assert.rejects(h.rpc('GET', []), /DENIED/);
  const list = h.rpc('RANK_LIST', '단원'), save = h.rpc('RANK_SAVE', {score:63});
  const reply = (i, data) => h.send({type:'HOJA_V058_ARCADE_RPC_RESULT', id:h.posted[i].id, ...data});
  reply(2, {ok:false, error:'읽기 전용'});
  reply(1, {ok:true, value:['A']});
  assert.deepEqual(await list, ['A']);
  await assert.rejects(save, /읽기 전용/);
  assert.equal(h.timers.size, 0);
  const timeout = h.rpc('RANK_LIST', '단원');
  [...h.timers][0]();
  await assert.rejects(timeout, /시간 초과/);
  reply(3, {ok:true, value:[]});
});

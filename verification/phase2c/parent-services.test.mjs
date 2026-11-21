import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = new URL('../../web/current/', import.meta.url);
const script = await readFile(new URL('js/parent-services.js', source), 'utf8');
const catalog = JSON.parse(await readFile(new URL('cartridges/catalog.json', source)));
const cartridge = catalog.cartridges[0];
const questions = JSON.parse(await readFile(new URL(cartridge.path, source)));

function service(fetch, onSources = () => {}) {
  const replies = [];
  const frame = { postMessage(message) { replies.push(message); } };
  let onMessage;
  const window = {
    HOJA_GAMEPLAY: { setServerQuestions: onSources },
    addEventListener(type, cb) { if (type === 'message') onMessage = cb; }
  };
  const document = {
    getElementById(id) { assert.equal(id, 'hqArcadeFrame'); return { contentWindow: frame }; }
  };
  vm.runInNewContext(script, { window, document, fetch });
  return {
    api: window.HOJA_B_LIVE, replies,
    message(data, sender = frame) { return onMessage({ data, source: sender }); }
  };
}

test('teacher and student load the same offline service before the cartridge selector', async () => {
  for (const page of ['index', 'play']) {
    const html = await readFile(new URL(page + '.html', source), 'utf8');
    const tags = [...html.matchAll(/<script src="js\/parent-services.js"><\/script>/g)];
    assert.equal(tags.length, 1);
    if (page === 'index') assert.ok(tags[0].index < html.indexOf('const HOJA_CATALOG='));
    else {
      assert.equal(html.includes('const HOJA_CATALOG='),false,'student has no teacher catalog');
      assert.equal(html.includes('window.HOJA_REPOSITORY=(()=>'),false,'student has no teacher repository');
      assert.equal(html.includes('window.HOJA_MODE_PREVIEW=(()=>'),false,'student has no teacher mode selector');
    }
  }
});

test('failed catalog responses can retry and simultaneous reads share a request', async () => {
  const requests = [];
  const { api } = service(async (url, opts) => {
    assert.equal(opts.cache, 'no-cache');
    requests.push(url);
    if (requests.length === 1) return { ok: false, status: 503 };
    return { ok: true, json: () => url === cartridge.path ? questions : catalog };
  });
  await assert.rejects(api.catalog(), /503/);
  const pending = api.catalog();
  assert.equal(api.catalog(), pending);
  await pending;
  const list = await api.rpc('LIST');
  assert.equal(list[0].name, cartridge.name);
  const data = await api.rpc('GET', [cartridge.name]);
  assert.equal(data[0].data, questions);
  assert.deepEqual(requests, ['cartridges/catalog.json', 'cartridges/catalog.json', cartridge.path]);
  await assert.rejects(api.rpc('GET', ['missing']), /없는 카트리지/);
});

test('iframe bridge uses selected sources and rejects ranking without a request', async () => {
  const normalized = [];
  const { api, replies, message } = service(() => { throw Error('unexpected network'); },
    values => normalized.push(values));
  const values = [{ sheetName: cartridge.name, data: questions }];
  const ready = { type: 'HOJA_V058_ARCADE_READY' };
  await message(ready, {});
  assert.equal(replies.length, 0);
  await message(ready);
  assert.equal(replies.at(-1).type, 'HOJA_V058_ARCADE_ERROR');
  api.setSources(values);
  assert.equal(normalized[0], values);
  await message(ready);
  assert.equal(replies.at(-1).sources, values);
  const rank = { type: 'HOJA_V058_ARCADE_RPC', id: 1, method: 'RANK_LIST' };
  await message({ ...rank, payload: 'missing' });
  assert.match(replies.at(-1).error, /단일 공용/);
  await message({ ...rank, payload: cartridge.name });
  assert.equal(replies.at(-1).ok, false);
  assert.match(replies.at(-1).error, /연결되지 않은/);
  api.clear();
  assert.equal(api.names.length, 0);
  assert.equal(api.sources, null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = new URL('../../web/current/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('cartridges/catalog.json', source)));
const entry = catalog.cartridges[0];
const sources = [{ sheetName: entry.name, data: JSON.parse(await readFile(new URL(entry.path, source))) }];

for (const page of ['index', 'play']) {
  test(page + ' opens and exits the arcade with no standalone quiz stage or input handlers', async () => {
    const html = await readFile(new URL(page + '.html', source), 'utf8');
    assert.doesNotMatch(html, /hqStage|hqHud|hqResult|hqBalloon|hqSfx_|hoja-test-contract/);
    const tag = /<script id=['"]hojaV051Gameplay['"]([^>]*)>([\s\S]*?)<\/script>/.exec(html);
    const file = /src="([^"]+)"/.exec(tag[1]);
    const script = file ? await readFile(new URL(file[1], source), 'utf8') : tag[2];
    const listeners = {};
    const elements = new Map();
    const alerts = [];
    const returnedTo = [];
    const document = {
      getElementById(id) {
        assert.ok(html.includes('id="' + id + '"'), 'expected parent element ' + id);
        if (!elements.has(id)) elements.set(id, {
          hidden: true, dataset: {}, contentWindow: {}, addEventListener() {},
          removeAttribute(name) { delete this[name]; }
        });
        return elements.get(id);
      }
    };
    const window = {
      addEventListener(type, cb) { listeners[type] = cb; },
      alert(msg) { alerts.push(msg); },
      HOJA_MODE_PREVIEW: { hide() {}, show(season) { returnedTo.push(season); } },
      HOJA_B_LIVE: { sources }
    };
    if (page === 'play') window.HOJA_STUDENT_BACK = () => returnedTo.push('gate');
    vm.runInNewContext(script, { window, document });
    const game = window.HOJA_GAMEPLAY;
    const frame = document.getElementById('hqArcadeFrame');
    await game.launch('quiz', 'summer');
    assert.equal(frame.src, undefined);
    assert.equal(listeners.keydown, undefined);
    await game.launch('arcade', 'summer');
    assert.equal(alerts.length, 1);
    game.setServerQuestions(sources);
    await game.launch('arcade', 'summer');
    assert.equal(frame.src, 'arcade.html?season=summer');
    assert.equal(frame.hidden, false);
    assert.equal(game.state.page, 'arcade');
    listeners.message({ source: frame.contentWindow, data: { type: 'HOJA_V051_ARCADE_EXIT' } });
    assert.equal(frame.src, undefined);
    assert.equal(frame.hidden, true);
    assert.deepEqual(returnedTo, [page === 'play' ? 'gate' : 'summer']);
    game.clearServerQuestions();
    await game.launch('arcade', 'summer');
    assert.equal(alerts.length, 2);
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
context.window = context;
for (const file of ['cave-layout','cave-variation','themes','surface-templates','surface-generator']) {
  const url = new URL('../../web/current/js/world/' + file + '.js', import.meta.url);
  vm.runInContext(readFileSync(url, 'utf8'), context, {filename: file});
}
const dims = { TILE:16, T: tiles => tiles * 16, F:880, WORLD_H:1248 };
const checksum = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const count = stage => stage.enemies.filter(e => e.type === 'BALLOONEY').length
    + stage.bricks.filter(b => b.hiddenQuiz).length + stage.secrets.length;

// Generated from the four original templates and both original cave scripts at b2d1147.
for (const [seed, surfaceHash, caveHash] of [
  [0,'2726ae0c7335ef72b49ac3ea0a0cfba91b6d77262547a7357458e452d4d5a5fb','f61e9245201db7a73f5267de38b9ac4664e650c44b3a4a62bb862a18442e9de8'],
  [41805,'1b8a3a2c591455775806f681122b4aeb9f89960c73f76bca0a190fdf6fa376ae','a8ae1a2f8c6004e538d7a58934ac87aa555a42cd5def35d41b74a902eff704fb'],
  [0xffffffff,'f72a251acd712f9c1d3252f788148ecdb795cafe1cdad1ee1bd895b328c24f5d','5edd9d6c46309fb43aa4807e37d119294ac9ccdaaa93328bc5032e93f796f964']
]) {
  test('complete surface stages and cave geometry for seed ' + seed, () => {
    const templates = context.HOJA_CREATE_SURFACE_TEMPLATES(dims);
    const generator = context.HOJA_CREATE_SURFACE_GENERATOR({
      ...dims, STAGES: templates, THEMES: context.HOJA_CREATE_THEMES(), DECOR_SCALE: 2,
      stageQuestionCount: count
    });
    const cave = context.HojaCave44.buildValidated(seed);
    templates.push(cave.map);
    const stages = generator.generateRunStages(seed);
    assert.equal(stages[4], cave.map);
    assert.equal(checksum(stages.slice(0, 4)), surfaceHash);
    assert.equal(cave.audit.ok, true);
    assert.equal(checksum(context.HojaCave44.exportStage(cave.map)), caveHash);
  });
}

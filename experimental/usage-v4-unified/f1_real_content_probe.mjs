// F1 local real-content probe (needs a QA bundle dir from build_content_packages.mjs --qa-out).
// Loads the QA catalog + content files into the mock GAS project and times each lazy load.
// Usage: node f1_real_content_probe.mjs <qaDir> <payloads.json out>
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {runInContext} from 'node:vm';
import {performance} from 'node:perf_hooks';
import {loadProject, MockSpreadsheet} from './mock_gas.mjs';
import {buildCopy, standardHistory, ISOLATED_PROPS} from './fixture.mjs';
const [qa, outFile] = process.argv.slice(2);
const {ss} = buildCopy({history: standardHistory()});
const p = loadProject({spreadsheets: new Map([['copy40', ss], ['prod', new MockSpreadsheet('prod')], ['cert', new MockSpreadsheet('cert')]]), props: ISOLATED_PROPS});
for (const f of readdirSync(qa).sort()) runInContext(readFileSync(qa + '/' + f, 'utf8'), p.ctx, {filename: f});
const list = p.rpc('hojaListApprovedCartridges');
const rows = [], payloads = [];
for (const u of list) {
  const t = performance.now();
  const [got] = p.rpc('hojaGetApprovedQuestions', [u.cartridgeId]);
  const ms = performance.now() - t, d = got.data;
  const missing = d.questions.filter(q => [q.rendererQuestion.image, ...q.rendererQuestion.choices.map(c => c.image)].filter(Boolean).some(k => !d.images[k])).length;
  rows.push({id: u.cartridgeId, q: d.questions.length, images: Object.keys(d.images).length, tags: Object.keys(d.tags).length, missingImages: missing, loadMs: Math.round(ms)});
  payloads.push({id: u.cartridgeId, payload: {questions: d.questions.map(q => q.rendererQuestion), originalQuestions: d.questions.map(q => q.originalQuestion), images: d.images, tags: d.tags, unitMeta: d.unitMeta}});
}
writeFileSync(outFile, JSON.stringify(payloads));
console.log(JSON.stringify({units: rows.length, questions: rows.reduce((n, r) => n + r.q, 0), missingImages: rows.reduce((n, r) => n + r.missingImages, 0),
  loadMsMax: Math.max(...rows.map(r => r.loadMs)), rows}));

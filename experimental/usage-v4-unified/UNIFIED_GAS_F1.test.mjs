// 40-6 F1: approved CONTENT packages (renderer-v2 data from approved presentations,
// cross-checked against approved effective content) + GAS lazy loader + QA/release split.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, mkdtempSync, rmSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runInContext} from 'node:vm';
import {buildApprovedIndex} from './approved-catalog/approved_catalog_normalizer.mjs';
import {buildContentPackages, extractConst, gameRow} from './approved-catalog/approved_content_packager.mjs';
import {qaPreviewCatalog, renderCatalogGs, renderContentGs} from './approved-catalog/qa_preview.mjs';
import {writeZip, sha256} from './approved-catalog/zip_reader.mjs';
import {loadProject, MockSpreadsheet} from './mock_gas.mjs';
import {buildCopy, standardHistory, ISOLATED_PROPS} from './fixture.mjs';

const DIR = 'experimental/usage-v4-unified';
const COMMIT = 'e'.repeat(40);
const IMG = Buffer.from('fixture-webp-bytes');
const URI = 'data:image/webp;base64,' + IMG.toString('base64');

/* ---------------- synthetic approved bank with a renderer-v2 presentation ---------------- */
function effQ(id, n, type, img = 0) {
  const base = {questionId: `${id}:q0${n}`, type, content: [{kind: 'text', text: 'Q' + n},
    ...Array.from({length: img}, (_, k) => ({kind: 'image', src: 'assets/a' + k + '.webp', alt: 'a'}))]};
  if (type === 'MCQ') return {...base, choices: ['c1', 'c2', 'c3'].map(c => ({id: c, content: [{kind: 'text', text: c}]})), answer: {choiceId: 'c2'}};
  if (type === 'OX') return {...base, answer: {value: false}};
  return {...base, answer: {text: '정답'}};
}
function presItem(id, unit, n, type, img) {
  const q = {id: `${unit}:q0${n}`, localId: 'q0' + n, questionId: `${id}:q0${n}`, unit, type, prompt: 'Q' + n,
    image: img ? `${id}/assets/a0.webp` : null, imageAlt: '', dialogue: null, explanation: 'e', accepted: [], source: 's', group: null};
  if (type === 'MCQ') return {...q, choices: ['c1', 'c2', 'c3'].map(c => ({id: c, text: c, image: null, imageAlt: ''})), answer: {choiceId: 'c2'}};
  if (type === 'OX') return {...q, choices: [], answer: {value: false}};
  return {...q, choices: [], answer: {text: '정답'}};
}
function presentationHtml(items, images, {tags, teacherC, unitMeta, legacy} = {}) {
  if (legacy) return '<script>const DATA=' + JSON.stringify(items) + ';</script>';
  return '<html><script>const DATA_CONCISE=' + JSON.stringify(items) + ';\nconst DATA_ORIGINAL=' + JSON.stringify(items) +
    ';\nconst IMAGES=' + JSON.stringify(images) + ';\n' + (unitMeta ? 'const UNIT_META=' + JSON.stringify(unitMeta) + ';\n' : '') +
    (tags ? 'const HOJA_RENDER_TAGS=' + JSON.stringify(tags) + ';\n' : '') + '</script>' +
    (teacherC ? '<script id="x-teacher">const teacherCLayoutIds=new Set(' + JSON.stringify(teacherC) + ');</script>' : '') + '</html>';
}
function unit(fs, dir, id, {types = ['MCQ', 'OX', 'SHORT'], imgs = [1, 0, 0], pres = 'ok', prefs = null, tweak = null} = {}) {
  const effective = {cartridgeId: id, title: id + ' 승인 제목', metadata: (([, g, sem, u]) => ({grade: +g, semester: +sem, unitNumber: +u, subject: '사회'}))(/^zz(\d)-s(\d)-u(\d+)$/.exec(id)),
    questions: types.map((t, i) => effQ(id, i + 1, t, imgs[i]))};
  const items = types.map((t, i) => presItem(id, 'u' + id.slice(-1), i + 1, t, imgs[i] > 0));
  if (tweak) tweak(items);
  const tags = Object.fromEntries(items.map(q => [q.id, {layout: {preferredLayout: q.image ? 'D' : 'A', rendererHint: null}}]));
  const html = presentationHtml(items, {[`${id}/assets/a0.webp`]: URI}, {tags, teacherC: prefs ? prefs.teacherCPreferred : null,
    unitMeta: {['u' + id.slice(-1)]: {label: '5학년 1단원', title: '단원', count: types.length}}, legacy: pres === 'legacy'});
  const files = {'effective/cartridge.json': JSON.stringify(effective), 'effective/assets/a0.webp': IMG, 'effective/assets/a1.webp': IMG,
    'release/approval.json': JSON.stringify({teacherApproval: 'APPROVED', cartridgeId: id})};
  if (pres !== 'none') files['presentation/p.html'] = html;
  if (prefs) files['presentation/layout-preferences.json'] = JSON.stringify(prefs);
  const table = {}; for (const [k, v] of Object.entries(files)) table[k] = {sha256: sha256(Buffer.from(v))};
  files['release/file-manifest.json'] = JSON.stringify({files: table});
  const z = writeZip(files);
  fs[`approved/${dir}/${id}.zip`] = z;
  fs[`approved/${dir}/manifest.json`] = JSON.stringify({id, teacherApproval: 'APPROVED', questions: types.length, archive: id + '.zip',
    archiveSha256: sha256(z), ...(pres !== 'none' ? {reviewedPresentation: 'presentation/p.html'} : {})});
}
function bank(units) {
  const fs = {}, paths = [];
  let q = 0;
  for (const [dir, id, opts] of units) { unit(fs, dir, id, opts); paths.push(dir + '/'); q += (opts?.types || [1, 2, 3]).length; }
  fs['approved/catalog.json'] = JSON.stringify({schemaVersion: 'approved-catalog-v1', summary: {approvedUnits: units.length, approvedQuestions: q},
    subjects: {social: {units: units.length, questions: q, paths}}});
  return fs;
}
const srcOf = fs => ({exists: p => p in fs, readBytes: p => Buffer.from(fs[p])});
const build = fs => { const s = srcOf(fs); const {index} = buildApprovedIndex(s, {sourceRepo: 'f', sourceCommit: COMMIT}); return {index, ...buildContentPackages(s, index)}; };

test('F1 packager: renderer-v2 approved presentation -> game package, cross-checked with effective content', () => {
  const {report, packages} = build(bank([['social/a/zz5-s1-u1', 'zz5-s1-u1']]));
  assert.equal(report.ready, 1);
  const pkg = JSON.parse(packages[0].json);
  assert.deepEqual(Object.keys(pkg), ['questionSchemaVersion', 'sourceSheetVersion', 'cartridgeId', 'unitId', 'questions', 'images', 'tags', 'unitMeta']);
  assert.deepEqual(pkg.questions.map(q => [q.type, q.answer, q.options.length]), [['MULTIPLE', '2', 3], ['OX', 'X', 2], ['SUBJECTIVE', '정답', 0]]);
  assert.ok(pkg.questions.every(q => q.rendererQuestion && q.originalQuestion && q.familyId));
  assert.deepEqual(Object.keys(pkg.images), ['zz5-s1-u1/assets/a0.webp']);
  assert.equal(report.entries[0].imageBytesCheckedAgainstEffective, 1);
  assert.equal(report.entries[0].imageBytesDifferFromEffective, 0);
  assert.equal(report.entries[0].packageSha256, sha256(Buffer.from(packages[0].json)));
});
for (const [name, opts, re] of [
  ['answer key disagrees with effective', {tweak: it => { it[0].answer = {choiceId: 'c1'}; }}, /ANSWER_DISAGREES|CONCISE_KEY|MCQ_ANSWER/],
  ['choice ids disagree', {tweak: it => { it[0].choices[2].id = 'c9'; }}, /CHOICE_IDS_DISAGREE/],
  ['type disagrees', {tweak: it => { it[1].type = 'SHORT'; it[1].answer = {text: 'x'}; }}, /TYPE_DISAGREES/],
  ['image dropped by presentation', {tweak: it => { it[0].image = null; }}, /IMAGE_PRESENCE_DISAGREES/],
  ['unknown layout preference schema', {prefs: {schemaVersion: 'something-else'}}, /UNKNOWN_LAYOUT_PREFERENCES_SCHEMA/],
  ['teacher C list disagrees with approved presentation', {prefs: {schemaVersion: 'hoja-math-presentation-v1', teacherCPreferred: ['u1:q02']}}, null],
]) test('F1 packager fails closed: ' + name, () => {
  const fs = bank([['social/a/zz5-s1-u1', 'zz5-s1-u1', opts]]);
  if (re) return assert.throws(() => build(fs), re);
  // teacher-C list equal in both places -> applied exactly like the approved HTML
  const ok = build(fs);
  assert.equal(ok.report.entries[0].layoutPreferences.teacherC, 1);
  assert.equal(JSON.parse(ok.packages[0].json).tags['u1:q02'].layout.preferredLayout, 'C');
  // now make the per-unit list disagree with the approved presentation's set
  const fs2 = bank([['social/a/zz5-s1-u1', 'zz5-s1-u1', {...opts, prefs: {...opts.prefs, teacherCPreferred: ['u1:q01']}}]]);
  const z = srcOf(fs2);
  const {index} = buildApprovedIndex(z, {sourceRepo: 'f', sourceCommit: COMMIT});
  assert.equal(buildContentPackages(z, index).report.entries[0].layoutPreferences.teacherC, 1);
});
test('F1 packager: unknown presentation schema or no renderer source is BLOCKED with a reason, never guessed', () => {
  const {report} = build(bank([['social/a/zz5-s1-u2', 'zz5-s1-u2', {pres: 'legacy'}], ['social/a/zz5-s1-u3', 'zz5-s1-u3', {pres: 'none'}]]));
  assert.deepEqual(report.entries.map(e => [e.cartridgeId, e.status, e.reasons[0].split(':')[0]]), [
    ['zz5-s1-u2', 'BLOCKED', 'PRESENTATION_SCHEMA_UNKNOWN'],
    ['zz5-s1-u3', 'BLOCKED', 'NO_APPROVED_RENDERER_PRESENTATION']]);
  // a renderer-v2 presentation showing ONE image where the approved effective question has TWO fails closed
  assert.throws(() => build(bank([['social/a/zz5-s1-u1', 'zz5-s1-u1', {imgs: [2, 0, 0]}]])), /IMAGE_PRESENCE_DISAGREES/);
});
test('F1 packager: a NEW approved unit is packaged with no code change', () => {
  const one = build(bank([['social/a/zz5-s1-u1', 'zz5-s1-u1']]));
  const two = build(bank([['social/a/zz5-s1-u1', 'zz5-s1-u1'], ['social/b/zz6-s2-u4', 'zz6-s2-u4', {types: ['OX', 'MCQ'], imgs: [0, 1]}]]));
  assert.equal(one.report.ready, 1);
  assert.equal(two.report.ready, 2);
  assert.equal(two.report.readyQuestions, 5);
});
test('F1 extractConst reads JSON literals safely (strings with brackets, no eval)', () => {
  assert.deepEqual(extractConst('let X = {"a":"]}[{","b":[1,{"c":"\\""}]};', 'X'), {a: ']}[{', b: [1, {c: '"'}]});
  assert.equal(extractConst('const Y = foo();', 'Y'), undefined);
  assert.throws(() => gameRow({id: 'x', type: 'MCQ', choices: [{id: 'c1', text: 'a'}], answer: {choiceId: 'c9'}}), /MCQ_ANSWER_NOT_IN_CHOICES/);
});

/* ---------------- real approved source (committed, content-free report) ---------------- */
const REPORT = DIR + '/approved-catalog/generated/approved-content-report.json';
test('F1/F1-B REAL: 23 units / 732 questions packaged by three version-identified adapters', () => {
  const r = JSON.parse(readFileSync(REPORT, 'utf8'));
  assert.equal(r.sourceCommit, '9573f91d2845a9667e2540df051f499d937dd94a');
  assert.deepEqual([r.units, r.ready, r.readyQuestions, r.blocked, r.blockedQuestions], [23, 23, 732, 0, 0]);
  const by = a => r.entries.filter(e => e.adapter === a);
  assert.deepEqual([by('renderer-v2').length, by('presentation-v3').length, by('display-overlay-v1').length], [16, 6, 1]);
  assert.equal(by('presentation-v3').reduce((n, e) => n + e.questionCount, 0), 201);
  const q21 = r.entries.find(e => e.mediaOverlay);
  assert.match(q21.mediaOverlay.questionId, /:q21$/);
  assert.deepEqual([q21.mediaOverlay.replaced, q21.mediaOverlay.labels], [2, 2]);
  assert.equal(r.entries.reduce((n, e) => n + (e.mediaQuestions || 0), 0), 6, 'q21 pair + 5 frequency charts');
  // derived layouts are never labelled as teacher-approved render tags; parity is not claimed
  for (const e of [...by('presentation-v3'), ...by('display-overlay-v1')]) {
    assert.match(e.renderTags, /^DERIVED_FROM_/); assert.equal(e.visualParity, 'NOT_VERIFIED');
  }
  assert.ok(by('display-overlay-v1')[0].adapterNotes.some(n => n.startsWith('NO_APPROVED_RENDERER_PRESENTATION')));
  const ready = r.entries.filter(e => e.status === 'READY');
  assert.ok(ready.every(e => e.imageBytesDifferFromEffective === 0));
  const math = ready.filter(e => e.layoutPreferences && e.layoutPreferences.schema === 'hoja-math-presentation-v1');
  assert.equal(math.reduce((n, e) => n + e.layoutPreferences.teacherC, 0), 19, 'teacher C layouts');
  assert.equal(math.reduce((n, e) => n + Object.keys(e.layoutPreferences.choiceWrap).length, 0), 4, 'choice wraps');
  assert.equal(math.reduce((n, e) => n + (e.layoutCounts.C || 0), 0), 67);
  assert.equal(math.reduce((n, e) => n + (e.layoutCounts.A || 0), 0), 120);
  assert.equal(ready.filter(e => e.layoutPreferences?.schema === 'hoja-layout-preferences-v1').reduce((n, e) => n + e.layoutPreferences.verifiedFixed, 0), 11);
  assert.ok(math.every(e => e.presentationScriptsNotInBridge.length === 2), 'math display scripts the bridge lacks are reported');
  const dflt = r.entries.filter(e => e.renderTags === 'DERIVED_FROM_APPROVED_PAGE_DEFAULT_LAYOUT');
  assert.equal(dflt.length, 2, 'soc5 3-1/3-2: derived from the approved page rule, not labelled approved');
  assert.ok(dflt.every(e => e.visualParity === 'NOT_VERIFIED'));
  const txt = readFileSync(REPORT, 'utf8');
  assert.ok(!/data:image|"prompt"|"choices"/.test(txt), 'report carries no question content');
});

/* ---------------- GAS runtime loader (mock engine) ---------------- */
function qaWorld({isolated = true, tamper = false} = {}) {
  const fs = bank([['social/a/zz5-s1-u1', 'zz5-s1-u1'], ['social/b/zz5-s1-u2', 'zz5-s1-u2']]);
  const {index, report, packages} = build(fs);
  const cat = qaPreviewCatalog(index, report, {schemaVersion: 'hoja-qa-preview-v1', purpose: 'TEST_ONLY_QA_NOT_DEPLOYMENT', sourceCommit: COMMIT, select: 'ALL_READY'});
  const {ss} = buildCopy({history: standardHistory()});
  const p = loadProject({spreadsheets: new Map([['copy40', ss], ['prod', new MockSpreadsheet('prod')], ['cert', new MockSpreadsheet('cert')]]),
    props: isolated ? ISOLATED_PROPS : {SMQ_USAGE_SPREADSHEET_ID: 'copy40'}});
  runInContext(renderCatalogGs(cat), p.ctx);
  for (const pk of packages) {
    let gs = renderContentGs(pk.cartridgeId, pk);
    if (tamper && pk.cartridgeId === 'zz5-s1-u2') gs = gs.replace('Q1', 'Q1 (changed)');
    runInContext(gs, p.ctx);
  }
  runInContext('var __loads=[];for(const k of Object.keys(HOJA_APPROVED_CONTENT_)){const f=HOJA_APPROVED_CONTENT_[k].load;HOJA_APPROVED_CONTENT_[k].load=function(){__loads.push(k);return f();};}', p.ctx);
  return {...p, loads: () => JSON.parse(runInContext('JSON.stringify(__loads)', p.ctx))}; // cross-realm arrays -> plain
}
test('F1 GAS: QA catalog works only in the isolated test project; content loads lazily per unit', () => {
  assert.throws(() => qaWorld({isolated: false}).rpc('hojaListApprovedCartridges'), /APPROVED_QA_CATALOG_REQUIRES_ISOLATED_TEST_PROJECT/);
  const w = qaWorld();
  const list = w.rpc('hojaListApprovedCartridges');
  assert.deepEqual(list.map(x => [x.cartridgeId, x.qaPreview]), [['zz5-s1-u1', true], ['zz5-s1-u2', true]]);
  assert.deepEqual(w.loads(), [], 'listing parses no content');
  const got = w.rpc('hojaGetApprovedQuestions', ['zz5-s1-u1']);
  assert.deepEqual(w.loads(), ['zz5-s1-u1'], 'only the selected unit is parsed');
  assert.equal(got[0].sheetName, 'zz5-s1-u1 승인 제목');
  assert.equal(got[0].data.questions.length, 3);
  assert.ok(got[0].data.questions[0].rendererQuestion.image);
  assert.throws(() => w.rpc('hojaGetApprovedQuestions', ['zz5-s1-u9']), /APPROVED_CARTRIDGE_NOT_ACTIVE/);
  assert.throws(() => w.rpc('hojaGetApprovedQuestions', ['zz5-s1-u1', 'zz5-s1-u1']), /APPROVED_SELECTION_INVALID/);
});
test('F1 GAS: a tampered content package is refused (digest pinned by the active catalog)', () => {
  const w = qaWorld({tamper: true});
  assert.equal(w.rpc('hojaGetApprovedQuestions', ['zz5-s1-u1']).length, 1);
  assert.throws(() => w.rpc('hojaGetApprovedQuestions', ['zz5-s1-u2']), /APPROVED_CONTENT_DIGEST_MISMATCH/);
});
test('F1 release build: RELEASE catalog with 0 entries, no content; QA build is a different, flagged artifact', () => {
  const rel = readFileSync(DIR + '/gas/ApprovedActiveCatalog.gs', 'utf8');
  assert.match(rel, /"buildType": "RELEASE"/);
  assert.match(rel, /"entries": \[\]/);
  const out = mkdtempSync(join(tmpdir(), 'hoja-f1-'));
  try {
    const r = JSON.parse(execFileSync('python3', [DIR + '/build_unified_gas.py', '--output', join(out, 'rel')]).toString());
    assert.equal(r.variant, 'release'); assert.equal(r.contentFiles, 0);
    assert.ok(!readdirSync(join(out, 'rel')).some(f => f.startsWith('HOJA_QB_CONTENT_')));
    assert.throws(() => execFileSync('python3', [DIR + '/build_unified_gas.py', '--output', join(out, 'x'), '--qa-dir', out], {stdio: 'pipe'}));
    const dep = JSON.parse(readFileSync(DIR + '/approved-catalog/deployment/active-deployment.json', 'utf8'));
    assert.equal(dep.entries.length, 0, 'teacher deployment approvals stay 0');
  } finally { rmSync(out, {recursive: true, force: true}); }
});

/* ---------------- F1-B adapters (synthetic) ---------------- */
import {blocksToV2} from './approved-catalog/approved_content_packager.mjs';
test('F1-B blocksToV2: one image keeps the single-image contract; two images / charts add media[] in source order', () => {
  const k = s => 'u/' + s;
  const one = blocksToV2([{kind: 'text', text: 'Q'}, {kind: 'image', src: 'a.webp', alt: 'A'}], k);
  assert.deepEqual([one.prompt, one.image, one.imageAlt, one.media], ['Q', 'u/a.webp', 'A', undefined]);
  const two = blocksToV2([{kind: 'text', text: 'Q'}, {kind: 'text', text: 'passage'}, {kind: 'image', src: 'a.webp', alt: 'A'}, {kind: 'image', src: 'b.svg', alt: 'B'}], k);
  assert.equal(two.prompt, 'Q\npassage');
  assert.equal(two.image, 'u/a.webp');
  assert.deepEqual(two.media.map(m => m.asset), ['u/a.webp', 'u/b.svg']);
  const fr = blocksToV2([{kind: 'text', text: 'Q'}, {kind: 'frequency', period: 'w', labels: ['월', '화'], marks: [true, false]}], k);
  assert.deepEqual(fr.media, [{kind: 'frequency', period: 'w', labels: ['월', '화'], marks: [true, false]}]);
  assert.equal(blocksToV2([{kind: 'table'}], k).unsupported, 'table');
  assert.equal(blocksToV2([{kind: 'dialogue', lines: []}, {kind: 'dialogue', lines: []}], k).unsupported, 'multiple-dialogue');
});
function overlayBank({reviewed = true, choiceIds = null, revision = 3} = {}) {
  const fs = {}, id = 'zz5-s2-u2-2-common', dir = 'social/a/' + id;
  const eff = {cartridgeId: id, revision: 3, title: '오버레이 단원', metadata: {grade: 5, semester: 2, unitNumber: 2},
    questions: [effQ(id, 1, 'MCQ', 1), effQ(id, 2, 'OX', 0), {...effQ(id, 3, 'SHORT', 0), acceptedAnswers: ['정 답']}]};
  const disp = {schema: 'hoja-presentation-overlay-v1', cartridgeId: id, sourceRevision: revision, entries: eff.questions.map(q => ({
    questionId: q.questionId, reviewedByTeacher: reviewed, layoutFamily: q.type === 'MCQ' ? 'C' : 'A', preferredArrangement: 'auto',
    displayContent: q.content.map(b => b.kind === 'text' ? {kind: 'text', text: 'D:' + b.text} : b),
    displayChoices: (q.choices || []).map((c, i) => ({id: choiceIds ? choiceIds[i] : c.id, content: [{kind: 'text', text: 'd' + c.id}]}))}))};
  const files = {'effective/cartridge.json': JSON.stringify(eff), 'effective/assets/a0.webp': IMG, 'display/presentation.json': JSON.stringify(disp),
    'release/approval.json': JSON.stringify({status: 'TEACHER_APPROVED_SOURCE_CONTENT__GAME_DELIVERY_HOLD', cartridgeId: id})};
  const t = {}; for (const [k2, v] of Object.entries(files)) t[k2] = sha256(Buffer.from(v));
  files['release/FILES_SHA256.json'] = JSON.stringify(t);
  const z = writeZip(files);
  fs[`approved/${dir}/${id}.zip`] = z;
  fs[`approved/${dir}/manifest.json`] = JSON.stringify({id, teacherApproval: 'APPROVED', questions: 3, archive: id + '.zip', sha256: sha256(z)});
  fs['approved/catalog.json'] = JSON.stringify({schemaVersion: 'approved-catalog-v1', summary: {approvedUnits: 1, approvedQuestions: 3},
    subjects: {social: {units: 1, questions: 3, paths: [dir + '/']}}});
  return fs;
}
test('F1-B display overlay: deterministic from effective answers + teacher-reviewed display layer, flagged as such', () => {
  const {report, packages} = build(overlayBank());
  const e = report.entries[0];
  assert.deepEqual([e.status, e.adapter, e.visualParity, e.renderTags], ['READY', 'display-overlay-v1', 'NOT_VERIFIED', 'DERIVED_FROM_APPROVED_OVERLAY_LAYOUT_FAMILY']);
  const pkg = JSON.parse(packages[0].json);
  assert.equal(pkg.questions[0].rendererQuestion.prompt, 'D:Q1', 'display text from the approved overlay');
  assert.equal(pkg.questions[0].originalQuestion.prompt, 'Q1', 'original from approved effective content');
  assert.equal(pkg.questions[0].answer, '2', 'answer key from effective');
  assert.deepEqual(pkg.questions[2].rendererQuestion.accepted, ['정 답']);
  assert.equal(pkg.tags[pkg.questions[0].rendererQuestion.id].needsHumanReview, true);
  assert.throws(() => build(overlayBank({reviewed: false})), /NOT_TEACHER_REVIEWED/);
  assert.throws(() => build(overlayBank({choiceIds: ['c1', 'c3', 'c2']})), /OVERLAY_CHOICE_IDS_DISAGREE/);
  assert.throws(() => build(overlayBank({revision: 2})), /OVERLAY_REVISION_DISAGREES/);
});
test('F1-B composed renderer: bridge file SHA-pinned and untouched; only the media extension script is appended', async () => {
  const {composeRenderer, BRIDGE_SHA256} = await import('../unified-quiz-renderer/compose_renderer.mjs');
  const bridge = readFileSync('experimental/unified-quiz-renderer/HOJA_APPROVED_RENDERER_BRIDGE.html', 'utf8');
  assert.equal(sha256(Buffer.from(bridge)), BRIDGE_SHA256);
  const r = composeRenderer();
  const at = bridge.lastIndexOf('</body>');
  assert.ok(r.html.startsWith(bridge.slice(0, at)) && r.html.endsWith(bridge.slice(at)), 'bridge bytes preserved around the insertion');
  assert.equal((r.html.match(/<script id="hoja-ext-media-v1">/g) || []).length, 1);
  assert.equal((r.html.match(/<script id="hoja-ext-math-v1">/g) || []).length, 1);
  const ext = readFileSync('experimental/unified-quiz-renderer/HOJA_RENDERER_MEDIA_EXT.js', 'utf8');
  assert.doesNotMatch(ext, /selectAnswer|setFeedback|HOJA_APPROVED_RENDERER_CAPTURE|score|rank/i, 'extension never touches answers/scoring');
});

/* ---------------- F2 math display profile ---------------- */
test('F2 math extension: generated from the approved math HTML, profile-gated, no question content', () => {
  const ext = readFileSync('experimental/unified-quiz-renderer/HOJA_RENDERER_MATH_EXT.js', 'utf8');
  assert.match(ext, /GENERATED by extract_math_display\.mjs/);
  assert.match(ext, /sha256 a85650c87ee93b6a2ed24c79f8dfa4df950c26d5ddfccbaf35f0c9ee02d669a5/, 'pinned to the math manifest reviewerSha256');
  assert.match(ext, /q\.displayProfile==='math-reviewfix1-ui4'/);
  assert.doesNotMatch(ext, /data:image|DATA_CONCISE|DATA_ORIGINAL|HOJA_RENDER_TAGS|selectAnswer/);
  const r = JSON.parse(readFileSync(REPORT, 'utf8'));
  const prof = r.entries.filter(e => e.displayProfile === 'math-reviewfix1-ui4');
  assert.equal(prof.length, 6);
  assert.ok(prof.every(e => e.cartridgeId.startsWith('math')) || prof.length === 6);
  assert.ok(r.entries.filter(e => !e.displayProfile).every(e => !(e.presentationScriptsNotInBridge || []).length),
    'no other unit depends on an approved display script the renderer lacks');
});

test('F3 QA route: in the isolated QA build the game LIST/GET RPCs serve the SAME approved catalog; release never reroutes', () => {
  const w = qaWorld();
  assert.deepEqual(w.rpc('hojaListPublicCartridges'), [{name: 'zz5-s1-u1 승인 제목', cartridgeId: 'zz5-s1-u1'}, {name: 'zz5-s1-u2 승인 제목', cartridgeId: 'zz5-s1-u2'}]);
  const got = w.rpc('hojaGetPublicQuestions', ['zz5-s1-u2 승인 제목']);
  assert.equal(got[0].data.cartridgeId, 'zz5-s1-u2');
  assert.throws(() => w.rpc('hojaGetPublicQuestions', ['없는 제목']), /PROJECT_B_CARTRIDGE_NOT_PUBLIC/);
  // release catalog (0 active): legacy Sheets path untouched (mock legacy catalog answers)
  const {ss} = buildCopy({history: standardHistory()});
  const rel = loadProject({spreadsheets: new Map([['copy40', ss], ['prod', new MockSpreadsheet('prod')], ['cert', new MockSpreadsheet('cert')]]), props: ISOLATED_PROPS});
  assert.deepEqual(rel.rpc('hojaListPublicCartridges').map(x => x.cartridgeId), ['101', '102']);
});

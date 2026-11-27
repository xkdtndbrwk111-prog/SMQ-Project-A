import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {buildApprovedIndex, activeApprovedCatalog, parseUnitIdConvention, DEPLOYMENT_SCHEMA} from './approved_catalog_normalizer.mjs';
import {writeZip, sha256} from './zip_reader.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const COMMIT = 'f'.repeat(40);
const OPTS = {sourceRepo: 'fixture/qbank', sourceCommit: COMMIT};
const PNG = Buffer.from('fake-image-bytes');

/* ---------- synthetic question bank: every supported source shape ---------- */
const q = (id, n, img) => ({questionId: `${id}:q${String(n).padStart(2, '0')}`, type: n % 3 ? 'MCQ' : 'OX',
  content: [{kind: 'text', text: 'Q' + n}, ...(img ? [{kind: 'image', src: img, alt: 'a'}] : [])],
  choices: [{id: 'c1', content: [{kind: 'text', text: 'x'}]}], answer: {choiceId: 'c1'}});
function effectiveZip(id, title, meta, n, extra = {}) {
  const cart = {schemaVersion: 'qb1', cartridgeId: id, revision: 1, title, metadata: meta,
    questions: Array.from({length: n}, (_, i) => q(id, i + 1, i === 0 ? 'assets/a.webp' : null))};
  const files = {'effective/cartridge.json': JSON.stringify(cart), 'effective/assets/a.webp': PNG,
    'release/approval.json': JSON.stringify({teacherApproval: 'APPROVED', cartridgeId: id}), ...extra};
  const table = {}; for (const [k, v] of Object.entries(files)) table[k] = {sha256: sha256(Buffer.from(v))};
  files['release/file-manifest.json'] = JSON.stringify({algorithm: 'sha256', files: table});
  return writeZip(files);
}
function unitDir(fs, dir, id, title, meta, n, extraManifest = {}) {
  const z = effectiveZip(id, title, meta, n);
  fs[`approved/${dir}/${id}.zip`] = z;
  fs[`approved/${dir}/manifest.json`] = JSON.stringify({id, teacherApproval: 'APPROVED', gameDeployment: 'NOT_DEPLOYED',
    questions: n, archive: id + '.zip', archiveSha256: sha256(z), ...extraManifest});
  return {id, questions: n, archive: `${dir.split('/').slice(1).join('/')}/${id}.zip`, sha256: sha256(z)};
}
function fixture() {
  const fs = {};
  // bundle-source-zips (nested ZIPs + media overlay)
  const nested = {};
  for (const id of ['eng3-pub-u01', 'eng3-pub-u02']) {
    const cart = {cartridgeId: id, title: 'Lesson ' + id.slice(-2), metadata: {grade: 3, semester: 1, unitNumber: Number(id.slice(-2)), subject: '영어'},
      questions: Array.from({length: 2}, (_, i) => q(id, i + 1, 'assets/s.webp'))};
    nested[id] = writeZip({'cartridge.json': JSON.stringify(cart), 'assets/s.webp': PNG});
  }
  const outer = {
    'release/approval.json': JSON.stringify({teacherApproval: 'APPROVED', units: Object.entries(nested).map(([id, z]) => ({
      cartridgeId: id, title: 'Lesson ' + id.slice(-2), questionCount: 2, archive: id + '.zip', archiveSHA256: sha256(z)}))}),
    'release/media-overlay.json': JSON.stringify({unit: 'eng3-pub-u01', questionId: 'eng3-pub-u01:q01',
      sourceCartridge: 'source-candidates/eng3-pub-u01.zip', answerId: 'c1',
      replace: [{source: 'assets/s.webp', presentation: 'presentation/fixed.svg'}]}),
    'presentation/fixed.svg': '<svg/>',
    ...Object.fromEntries(Object.entries(nested).map(([id, z]) => ['source-candidates/' + id + '.zip', z])),
  };
  const sums = {}; for (const [k, v] of Object.entries(outer)) sums[k] = sha256(Buffer.from(v));
  outer['SHA256SUMS.json'] = JSON.stringify(sums);
  const oz = writeZip(outer);
  fs['approved/english/pub-a/bundle.zip'] = oz;
  fs['approved/english/pub-a/manifest.json'] = JSON.stringify({teacherApproval: 'APPROVED', units: Object.keys(nested),
    totalQuestions: 4, archive: 'bundle.zip', archiveSha256: sha256(oz)});
  // bundle-unit-questions (approved tables + presentation UNIT_META)
  const qs = [];
  for (const [folder, id] of [['g4u01', 'eng4-pub-b-u01']])
    for (let i = 1; i <= 3; i++) qs.push({id: `${folder}:q0${i}`, questionId: `${id}:q0${i}`, unit: folder, type: 'MCQ',
      image: i === 1 ? 'g4u01/a.webp' : null, choices: [{id: 'c1', text: 't', image: null}]});
  fs['approved/english/pub-b/r1/questions.approved.json'] = JSON.stringify(qs);
  fs['approved/english/pub-b/r1/g4u01/questions.json'] = JSON.stringify(qs);
  fs['approved/english/pub-b/r1/tags.approved.json'] = JSON.stringify(Object.fromEntries(qs.map(x => [x.id, {ok: 1}])));
  fs['approved/english/pub-b/r1/images.approved.json'] = JSON.stringify({'g4u01/a.webp': 'data:image/webp;base64,AAAA'});
  fs['approved/english/pub-b/r1/review.html'] = '<script>const UNIT_META={"g4u01":{"label":"x","title":"Hello Unit","count":3}};</script>';
  fs['approved/english/pub-b/r1/manifest.json'] = JSON.stringify({teacherApproval: 'APPROVED', unitCounts: {g4u01: 3},
    totalQuestions: 3, approvedData: 'questions.approved.json', approvedTags: 'tags.approved.json',
    approvedImages: 'images.approved.json', approvedPresentation: 'review.html'});
  // subjects.*.paths (unit-effective-zip)
  unitDir(fs, 'social/g5/soc5-s1-u1-1-common', 'soc5-s1-u1-1-common', '사회 단원 하나', {grade: 5, semester: 1, unitNumber: 1, subject: '사회'}, 4,
    {publicMediaRights: 'CLEARED'});
  // subjects.*.manifest aggregate -> unit-effective-zip
  const mu = unitDir(fs, 'math/g6/math6-s1-u2', 'math6-s1-u2', '수학 단원 둘', {grade: 6, semester: 1, unitNumber: 2, subject: '수학'}, 5);
  fs['approved/math/manifest.json'] = JSON.stringify({teacherApproval: 'APPROVED', units: [mu]});
  const catalog = {schemaVersion: 'approved-catalog-v1', updatedAt: '2026-01-01',
    summary: {approvedUnits: 5, approvedQuestions: 16, english: 7, social: 4, math: 5},
    englishByPublisher: {
      a: {publisher: '가출판', author: '가저자', path: 'english/pub-a/', units: 2, questions: 4},
      b: {publisher: '나출판', author: '나저자', path: 'english/pub-b/r1/', units: 1, questions: 3}},
    subjects: {social: {units: 1, questions: 4, paths: ['social/g5/soc5-s1-u1-1-common/']},
      math: {units: 1, questions: 5, paths: ['math/g6/math6-s1-u2/'], manifest: 'math/manifest.json'}}};
  fs['approved/catalog.json'] = JSON.stringify(catalog);
  return fs;
}
const srcOf = fs => ({exists: p => p in fs, readBytes: p => Buffer.from(fs[p])});
const mutateJson = (fs, p, f) => { const j = JSON.parse(fs[p]); f(j); fs[p] = JSON.stringify(j); };

test('every supported source shape resolves; approval is never deployment', () => {
  const {index, lock} = buildApprovedIndex(srcOf(fixture()), OPTS);
  assert.equal(index.approvalUnits, 5);
  assert.equal(index.approvalQuestions, 16);
  assert.deepEqual(new Set(index.entries.map(e => e.sourceShape)),
    new Set(['bundle-source-zips', 'bundle-unit-questions', 'unit-effective-zip', 'aggregate-units/unit-effective-zip']));
  assert.ok(index.entries.every(e => e.deploymentStatus === 'NOT_DEPLOYED' && e.approvalStatus === 'APPROVED'));
  const o = index.entries.find(e => e.cartridgeId === 'eng3-pub-u01');
  assert.equal(o.mediaOverlay.applied, true);
  assert.notEqual(o.effectiveSha256, index.entries.find(e => e.cartridgeId === 'eng3-pub-u02').effectiveSha256);
  assert.equal(index.entries.find(e => e.cartridgeId === 'eng4-pub-b-u01').approvedTitle, 'Hello Unit');
  const soc = index.entries.find(e => e.cartridgeId === 'soc5-s1-u1-1-common');
  assert.deepEqual([soc.grade, soc.semester, soc.unit, soc.subunit], [5, 1, 1, 1]);
  assert.equal(soc.mediaRights.status, 'CLEARED');
  assert.equal(index.entries.find(e => e.cartridgeId === 'math6-s1-u2').mediaRights.status, 'HOLD');
  assert.equal(lock.sourceCommit, COMMIT);
  assert.match(lock.catalogSha256, /^[a-f0-9]{64}$/);
});

test('a NEW approved unit (and a NEW subject) is discovered from catalog/manifests with no code change', () => {
  const fs = fixture();
  unitDir(fs, 'social/g6/soc6-s2-u4-common', 'soc6-s2-u4-common', '새로 승인된 사회 단원', {grade: 6, semester: 2, unitNumber: 4, subject: '사회'}, 3);
  unitDir(fs, 'science/g4/sci4-s1-u3', 'sci4-s1-u3', '과학 첫 단원', {grade: 4, semester: 1, unitNumber: 3, subject: '과학'}, 2);
  mutateJson(fs, 'approved/catalog.json', c => {
    c.subjects.social.paths.push('social/g6/soc6-s2-u4-common/'); c.subjects.social.units++; c.subjects.social.questions += 3;
    c.subjects.science = {units: 1, questions: 2, paths: ['science/g4/sci4-s1-u3/']};
    c.summary.approvedUnits += 2; c.summary.approvedQuestions += 5; c.summary.social += 3;
  });
  const {index} = buildApprovedIndex(srcOf(fs), OPTS);
  assert.equal(index.approvalUnits, 7);
  const added = index.entries.find(e => e.cartridgeId === 'soc6-s2-u4-common');
  assert.equal(added.approvedTitle, '새로 승인된 사회 단원');
  assert.equal(added.deploymentStatus, 'NOT_DEPLOYED');
  assert.equal(index.entries.find(e => e.cartridgeId === 'sci4-s1-u3').subjectLabel, '과학');
});

for (const [name, mutate, code] of [
  ['unknown root section', fs => mutateJson(fs, 'approved/catalog.json', c => { c.sciencePacks = {}; }), /UNKNOWN_ROOT_SECTION/],
  ['unknown manifest shape', fs => mutateJson(fs, 'approved/social/g5/soc5-s1-u1-1-common/manifest.json', m => { delete m.archive; }), /UNKNOWN_SOURCE_SHAPE/],
  ['unapproved unit', fs => mutateJson(fs, 'approved/social/g5/soc5-s1-u1-1-common/manifest.json', m => { m.teacherApproval = 'PENDING'; }), /UNAPPROVED|UNKNOWN_SOURCE_SHAPE/],
  ['archive byte tamper', fs => { const b = Buffer.from(fs['approved/math/g6/math6-s1-u2/math6-s1-u2.zip']); b[b.length - 30] ^= 1; fs['approved/math/g6/math6-s1-u2/math6-s1-u2.zip'] = b; }, /ARCHIVE_SHA/],
  ['aggregate pin disagrees', fs => mutateJson(fs, 'approved/math/manifest.json', m => { m.units[0].sha256 = '0'.repeat(64); }), /AGGREGATE_SHA/],
  ['catalog count lie', fs => mutateJson(fs, 'approved/catalog.json', c => { c.summary.approvedQuestions++; }), /INDEX_TOTALS/],
  ['missing approved image', fs => { fs['approved/english/pub-b/r1/images.approved.json'] = '{}'; }, /IMAGE_MISSING/],
  ['presentation title missing', fs => { fs['approved/english/pub-b/r1/review.html'] = '<p>no meta</p>'; }, /UNIT_META_MISSING/],
  ['math paths disagree with aggregate', fs => mutateJson(fs, 'approved/catalog.json', c => { c.subjects.math.paths = ['math/other/']; }), /PATHS_MANIFEST_DISAGREE/],
]) test('fail-closed: ' + name, () => {
  const fs = fixture(); mutate(fs);
  assert.throws(() => buildApprovedIndex(srcOf(fs), OPTS), code);
});

test('fail-closed: nested archive / overlay / file-table problems inside a bundle', () => {
  // re-pack the bundle with a wrong overlay answer
  const fs = fixture();
  const {readZip} = awaitZip();
  const z = readZip(Buffer.from(fs['approved/english/pub-a/bundle.zip']));
  const files = Object.fromEntries(z.names().map(n => [n, z.read(n)]));
  files['release/media-overlay.json'] = JSON.stringify({...JSON.parse(files['release/media-overlay.json']), answerId: 'c9'});
  const sums = {}; for (const [k, v] of Object.entries(files)) if (k !== 'SHA256SUMS.json') sums[k] = sha256(Buffer.from(v));
  files['SHA256SUMS.json'] = JSON.stringify(sums);
  const nz = writeZip(files);
  fs['approved/english/pub-a/bundle.zip'] = nz;
  mutateJson(fs, 'approved/english/pub-a/manifest.json', m => { m.archiveSha256 = sha256(nz); });
  assert.throws(() => buildApprovedIndex(srcOf(fs), OPTS), /OVERLAY_ANSWER_DISAGREES/);
  // file table lie (SHA256SUMS no longer matches content) -> refused
  files['presentation/fixed.svg'] = '<svg>changed</svg>';
  const tz = writeZip(files);
  fs['approved/english/pub-a/bundle.zip'] = tz;
  mutateJson(fs, 'approved/english/pub-a/manifest.json', m => { m.archiveSha256 = sha256(tz); });
  assert.throws(() => buildApprovedIndex(srcOf(fs), OPTS), /FILE_TABLE_SHA/);
});
import * as zipmod from './zip_reader.mjs';
function awaitZip() { return zipmod; }

test('deployment gate: only teacher-deployment-approved, SHA-pinned, gated ids become active', () => {
  const {index} = buildApprovedIndex(srcOf(fixture()), OPTS);
  const dep = entries => ({schemaVersion: DEPLOYMENT_SCHEMA, sourceCommit: COMMIT, deploymentId: 't', entries});
  assert.throws(() => activeApprovedCatalog(index, null), /DEPLOYMENT_MANIFEST_REQUIRED/);
  assert.equal(activeApprovedCatalog(index, dep([])).entries.length, 0);
  const soc = index.entries.find(e => e.cartridgeId === 'soc5-s1-u1-1-common');
  const math = index.entries.find(e => e.cartridgeId === 'math6-s1-u2');
  const good = {cartridgeId: soc.cartridgeId, teacherDeploymentApproval: 'APPROVED', approvedOn: '2026-12-01',
    effectiveSha256: soc.effectiveSha256, rendererGate: 'PASS', questionValidationGate: 'PASS'};
  assert.throws(() => activeApprovedCatalog(index, dep([{...good, teacherDeploymentApproval: true}])), /NO_TEACHER_DEPLOYMENT_APPROVAL/);
  assert.throws(() => activeApprovedCatalog(index, dep([{...good, effectiveSha256: 'a'.repeat(64)}])), /EFFECTIVE_SHA_PIN_MISMATCH/);
  assert.throws(() => activeApprovedCatalog(index, dep([{...good, rendererGate: 'NOT_RUN'}])), /GATE_NOT_PASSED/);
  assert.throws(() => activeApprovedCatalog(index, dep([{...good, cartridgeId: 'nope-u1'}])), /PIN_NOT_IN_APPROVED_INDEX/);
  assert.throws(() => activeApprovedCatalog(index, {...dep([good]), sourceCommit: 'e'.repeat(40)}), /SOURCE_COMMIT_MISMATCH/);
  assert.throws(() => activeApprovedCatalog(index, dep([{...good, cartridgeId: math.cartridgeId, effectiveSha256: math.effectiveSha256}])), /MEDIA_RIGHTS_HOLD/);
  const active = activeApprovedCatalog(index, dep([good]));
  assert.deepEqual(active.entries.map(e => [e.cartridgeId, e.title, e.deploymentStatus]), [[soc.cartridgeId, '사회 단원 하나', 'DEPLOYED']]);
});

test('unit-id convention is only a fallback/cross-check', () => {
  assert.deepEqual(parseUnitIdConvention('soc5-s2-u3-1-common'), {subjectCode: 'soc', grade: 5, semester: 2, unit: 3, subunit: 1});
  assert.deepEqual(parseUnitIdConvention('eng5-ybm-kim-u10'), {subjectCode: 'eng', grade: 5, semester: null, unit: 10, subunit: null});
  assert.equal(parseUnitIdConvention('3-영어-천재-1단원'), null);
  const fs = fixture();
  mutateJson(fs, 'approved/catalog.json', () => {});
  // metadata grade disagreeing with the id convention is refused, not guessed
  const z = unitDir(fs, 'social/g5/soc5-s1-u1-1-common', 'soc5-s1-u1-1-common', 't', {grade: 6, semester: 1, unitNumber: 1}, 4);
  assert.ok(z);
  assert.throws(() => buildApprovedIndex(srcOf(fs), OPTS), /CLASSIFICATION_DISAGREES/);
});

/* ---------- real approved source (committed generated output) ---------- */
const realIndexPath = join(here, 'generated', 'approved-source-index.json');
test('REAL approved index: 23 units / 732 questions, all NOT_DEPLOYED, approved titles, q21 overlay', {skip: !existsSync(realIndexPath)}, () => {
  const ix = JSON.parse(readFileSync(realIndexPath, 'utf8'));
  assert.equal(ix.approvalUnits, 23);
  assert.equal(ix.approvalQuestions, 732);
  assert.deepEqual(Object.fromEntries(Object.entries(ix.subjects).map(([k, v]) => [k, [v.units, v.questions]])),
    {english: [12, 384], social: [5, 161], math: [6, 187]});
  assert.ok(ix.entries.every(e => e.deploymentStatus === 'NOT_DEPLOYED'));
  assert.ok(ix.entries.every(e => e.approvedTitle && e.titleSource !== 'FALLBACK'));
  assert.equal(new Set(ix.entries.map(e => e.cartridgeId)).size, 23);
  const overlays = ix.entries.filter(e => e.mediaOverlay);
  assert.equal(overlays.length, 1);
  assert.match(overlays[0].mediaOverlay.questionId, /:q21$/);
  assert.equal(overlays[0].grade, 5);
  assert.equal(overlays[0].unit, 10);
});

test('soft-coding: builder source embeds no real cartridge id or approved title', {skip: !existsSync(realIndexPath)}, () => {
  const ix = JSON.parse(readFileSync(realIndexPath, 'utf8'));
  const code = ['approved_catalog_normalizer.mjs', 'build_approved_index.mjs', 'zip_reader.mjs', 'build_active_catalog.mjs']
    .filter(f => existsSync(join(here, f))).map(f => readFileSync(join(here, f), 'utf8')).join('\n');
  for (const e of ix.entries) {
    assert.ok(!code.includes(e.cartridgeId), 'hardcoded id ' + e.cartridgeId);
    for (const t of [e.approvedTitle, e.unitTitle].filter(Boolean)) assert.ok(!code.includes(t), 'hardcoded title');
  }
});


test('explicit UNIT_TITLE release metadata selects only the approved short label; pins and other entries stay unchanged', () => {
  const {index} = buildApprovedIndex(srcOf(fixture()), OPTS);
  const src = index.entries.find(e => e.subject === 'social');
  const another = index.entries.find(e => e.subject === 'math');
  src.unitTitle = '짧은 단원명';
  const pin = e => ({cartridgeId:e.cartridgeId, teacherDeploymentApproval:'APPROVED', approvedOn:'2026-11-27',
    effectiveSha256:e.effectiveSha256, rendererGate:'PASS', questionValidationGate:'PASS', mediaRightsAcknowledged:true});
  const deployment = {schemaVersion:DEPLOYMENT_SCHEMA, sourceCommit:COMMIT, deploymentId:'t', entries:[pin(src),pin(another)]};
  const before = activeApprovedCatalog(index,deployment);
  const after = activeApprovedCatalog(index,{...deployment,entries:[{...pin(src),titleStyle:'UNIT_TITLE'},pin(another)]});
  assert.deepEqual(after.entries,before.entries.map(e=>e.cartridgeId===src.cartridgeId?{...e,title:src.unitTitle}:e));
  assert.throws(()=>activeApprovedCatalog(index,{...deployment,entries:[{...pin(src),titleStyle:'arbitrary'}]}),/INVALID_TITLE_STYLE/);
  src.unitTitle = '';
  assert.throws(()=>activeApprovedCatalog(index,{...deployment,entries:[{...pin(src),titleStyle:'UNIT_TITLE'}]}),/INVALID_TITLE_STYLE/);
});

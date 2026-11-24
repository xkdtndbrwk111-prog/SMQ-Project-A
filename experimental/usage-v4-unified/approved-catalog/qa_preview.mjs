/**
 * TEST-ONLY QA preview catalog — strictly separate from the release active catalog.
 * It claims NO teacher deployment approval and NO media-rights clearance; entries are
 * QA_PREVIEW_NOT_DEPLOYED and the GAS runtime refuses this catalog outside the isolated
 * 40-6U test project (see Code.gs hojaApprovedActive_).
 */
import {createHash} from 'node:crypto';

export const QA_SCHEMA = 'hoja-qa-preview-v1';
const fail = c => { throw new Error('HOJA_QA_PREVIEW_' + c); };

/* F4 (40-6AD): runtime package location inside the PUBLIC HOJA-QUESTION-BANK (fetched at a fixed commit). */
export const RUNTIME_REPO = 'xkdtndbrwk111-prog/HOJA-QUESTION-BANK';
export const approvedPackagePath = id => {
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(String(id))) fail('PACKAGE_ID:' + id);
  return 'game-runtime/approved-packages/v1/' + id + '.json';
};
export function withContentSource(cat, contentSource) {
  if (!contentSource) return cat;
  if (contentSource.repo !== RUNTIME_REPO || !/^[a-f0-9]{40}$/.test(String(contentSource.commit))) fail('CONTENT_SOURCE');
  return {...cat, contentSource: {kind: 'GITHUB_RAW_PINNED_V1', repo: contentSource.repo, commit: contentSource.commit},
    entries: cat.entries.map(e => ({...e, contentPath: approvedPackagePath(e.cartridgeId)}))};
}
export function qaPreviewCatalog(index, report, manifest, {allowedScriptIds = [], contentSource = null} = {}) {
  if (!Array.isArray(allowedScriptIds) || !allowedScriptIds.length || allowedScriptIds.some(x => !/^[A-Za-z0-9_-]{20,80}$/.test(String(x))))
    fail('ALLOWED_SCRIPT_ID_REQUIRED');
  if (!manifest || manifest.schemaVersion !== QA_SCHEMA || manifest.purpose !== 'TEST_ONLY_QA_NOT_DEPLOYMENT') fail('MANIFEST');
  if (manifest.sourceCommit !== index.sourceCommit || report.sourceCommit !== index.sourceCommit) fail('SOURCE_COMMIT_MISMATCH');
  const ready = new Map(report.entries.filter(r => r.status === 'READY').map(r => [r.cartridgeId, r]));
  let ids;
  if (manifest.select === 'ALL_READY') ids = [...ready.keys()];
  else if (Array.isArray(manifest.cartridgeIds)) ids = manifest.cartridgeIds;
  else fail('SELECT');
  const entries = ids.map(id => {
    const e = index.entries.find(x => x.cartridgeId === id), r = ready.get(id);
    if (!e) fail('NOT_IN_INDEX:' + id);
    if (!r) fail('NOT_READY:' + id);
    return {cartridgeId: id, title: e.approvedTitle, subject: e.subject, subjectLabel: e.subjectLabel, grade: e.grade,
      semester: e.semester, publisher: e.publisher, author: e.author, unit: e.unit, subunit: e.subunit,
      questionCount: e.questionCount, effectiveSha256: e.effectiveSha256, packageSha256: r.packageSha256,
      releaseId: e.releaseId, deploymentStatus: 'QA_PREVIEW_NOT_DEPLOYED', mediaRights: e.mediaRights.status};
  }).sort((a, b) => a.cartridgeId.localeCompare(b.cartridgeId));
  return withContentSource({schemaVersion: 'hoja-active-cartridge-catalog-v1', buildType: 'QA_TEST_ONLY', allowedScriptIds: allowedScriptIds.map(String),
    sourceRepo: index.sourceRepo, sourceCommit: index.sourceCommit, deploymentId: 'qa-preview-not-deployment', entries}, contentSource);
}
export function renderCatalogGs(cat) {
  return '/* GENERATED — TEST-ONLY QA PREVIEW CATALOG. NOT A DEPLOYMENT. NEVER SHIP IN A RELEASE BUILD.\n' +
    ' * No teacher deployment approval and no media-rights clearance are claimed. */\n' +
    'var HOJA_APPROVED_ACTIVE_CATALOG_=Object.freeze(' + JSON.stringify(cat, null, 1).replace(/</g, '\\u003c') + ');\n';
}
/* One lazily-parsed content package per unit (the JSON text is SHA-256 pinned). */
export function renderContentGs(id, pkg) {
  if (!pkg || createHash('sha256').update(pkg.json).digest('hex') !== pkg.sha256) fail('PACKAGE_DIGEST:' + id);
  const chunks = [];
  for (let i = 0; i < pkg.json.length; i += 50000) chunks.push(JSON.stringify(pkg.json.slice(i, i + 50000)));
  return '/* GENERATED — TEST-ONLY QA approved content (' + id.replace(/[^a-z0-9-]/g, '') + '). NOT A DEPLOYMENT. */\n' +
    'var HOJA_APPROVED_CONTENT_=typeof HOJA_APPROVED_CONTENT_==="object"&&HOJA_APPROVED_CONTENT_?HOJA_APPROVED_CONTENT_:{};\n' +
    'HOJA_APPROVED_CONTENT_[' + JSON.stringify(id) + ']={packageSha256:' + JSON.stringify(pkg.sha256) +
    ',load:function(){return [\n' + chunks.join(',\n') + '\n].join("");}};\n';
}

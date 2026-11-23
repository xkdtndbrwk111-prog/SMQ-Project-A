#!/usr/bin/env node
/**
 * F3-3 TEST ONLY: a SYNTHETIC "release with active approved entries" catalog + content files, written
 * OUTSIDE the repository, so the RELEASE code path (not the QA path) can be exercised end-to-end.
 * It is NOT a deployment: deploymentId "SYNTHETIC-TEST-ONLY-NOT-A-DEPLOYMENT", every entry
 * deploymentStatus "SYNTHETIC_TEST_ONLY_NOT_DEPLOYED"; the committed deployment/active-deployment.json
 * (0 entries) and media rights (HOLD) are untouched. build_unified_gas.py accepts it only with
 * --synthetic-release-catalog and only for an output directory outside the repo.
 *   node make_synthetic_release.mjs --qbank <checkout> --out <dir outside repo>
 */
import {readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildContentPackages} from './approved_content_packager.mjs';
import {renderContentGs} from './qa_preview.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const die = m => { console.error(m); process.exit(2); };
const qbank = resolve(opt('--qbank') || die('--qbank required'));
const out = resolve(opt('--out') || die('--out required'));
if (out.startsWith(resolve(here, '../../..') + '/')) die('REFUSE_OUTPUT_INSIDE_REPOSITORY');
mkdirSync(out, {recursive: true});
if (readdirSync(out).length) die('OUT_NOT_EMPTY');
const index = JSON.parse(readFileSync(join(here, 'generated/approved-source-index.json'), 'utf8'));
if (execFileSync('git', ['-C', qbank, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim() !== index.sourceCommit) die('QBANK_COMMIT_DRIFT');
const src = {exists: p => existsSync(join(qbank, p)) && statSync(join(qbank, p)).isFile(), readBytes: p => readFileSync(join(qbank, p))};
const {packages, report} = buildContentPackages(src, index);
const entries = report.entries.filter(r => r.status === 'READY').map(r => {
  const e = index.entries.find(x => x.cartridgeId === r.cartridgeId);
  return {cartridgeId: e.cartridgeId, title: e.approvedTitle, subject: e.subject, subjectLabel: e.subjectLabel, grade: e.grade,
    semester: e.semester, publisher: e.publisher, author: e.author, unit: e.unit, subunit: e.subunit, questionCount: e.questionCount,
    effectiveSha256: e.effectiveSha256, packageSha256: r.packageSha256, releaseId: e.releaseId,
    deploymentStatus: 'SYNTHETIC_TEST_ONLY_NOT_DEPLOYED'};
}).sort((a, b) => a.cartridgeId.localeCompare(b.cartridgeId));
const cat = {schemaVersion: 'hoja-active-cartridge-catalog-v1', sourceRepo: index.sourceRepo, sourceCommit: index.sourceCommit,
  deploymentId: 'SYNTHETIC-TEST-ONLY-NOT-A-DEPLOYMENT', entries, buildType: 'RELEASE'};
writeFileSync(join(out, 'ApprovedActiveCatalog.gs'), '/* SYNTHETIC TEST-ONLY RELEASE CATALOG — NOT A DEPLOYMENT, NEVER COMMIT, NEVER DEPLOY. */\n' +
  'var HOJA_APPROVED_ACTIVE_CATALOG_=Object.freeze(' + JSON.stringify(cat, null, 1).replace(/</g, '\\u003c') + ');\n');
const content = join(out, 'content'); mkdirSync(content);
entries.forEach((e, i) => writeFileSync(join(content, 'HOJA_QB_CONTENT_' + String(i + 1).padStart(2, '0') + '.gs'),
  renderContentGs(e.cartridgeId, packages.find(p => p.cartridgeId === e.cartridgeId))));
console.log(JSON.stringify({out, entries: entries.length, questions: entries.reduce((n, e) => n + e.questionCount, 0)}));

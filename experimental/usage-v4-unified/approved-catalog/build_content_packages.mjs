#!/usr/bin/env node
/**
 * F1: approved content packages (BUILD TIME ONLY; the GAS runtime never reads GitHub/Sheets).
 *
 *   node build_content_packages.mjs --qbank <checkout> [--check]
 *       -> generated/approved-content-report.json (NO question text / images; committed)
 *   node build_content_packages.mjs --qbank <checkout> --qa-out <dir> [--qa deployment/qa-preview.json]
 *       -> <dir>/ApprovedActiveCatalog.gs (buildType QA_TEST_ONLY) + one HOJA_QB_CONTENT_NN.gs per unit
 *   F4 (40-6AD) lightweight GAS: add  --content-commit <40-hex commit of HOJA-QUESTION-BANK that holds the packages>
 *       -> the catalog declares contentSource GITHUB_RAW_PINNED_V1 + contentPath per entry and NO content .gs is written
 *   --packages-out <dir outside the repo>  -> the exact runtime package files (<contentPath>, bytes = SHA-pinned JSON)
 *       for review/publication; publishing them to the public bank is a SEPARATE, approved step.
 *
 * Question content and images are NOT committed to this repository (media rights HOLD 23/23):
 * QA bundles are generated from the pinned HOJA-QUESTION-BANK checkout into an output dir.
 */
import {readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildContentPackages} from './approved_content_packager.mjs';
import {qaPreviewCatalog, renderCatalogGs, renderContentGs, approvedPackagePath, RUNTIME_REPO} from './qa_preview.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const die = m => { console.error(m); process.exit(2); };
const qbank = resolve(opt('--qbank') || die('--qbank required'));
const index = JSON.parse(readFileSync(join(here, 'generated/approved-source-index.json'), 'utf8'));
const commit = execFileSync('git', ['-C', qbank, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
if (commit !== index.sourceCommit) die('QBANK_COMMIT_DRIFT: checkout ' + commit + ' != pinned ' + index.sourceCommit + ' (report drift; do not auto-update the pin)');
if (execFileSync('git', ['-C', qbank, 'status', '--porcelain', '--', 'approved'], {encoding: 'utf8'}).trim()) die('QBANK_APPROVED_TREE_DIRTY');
const src = {
  exists: p => { const f = join(qbank, p); return f.startsWith(qbank + '/') && existsSync(f) && statSync(f).isFile(); },
  readBytes: p => readFileSync(join(qbank, p)),
};
const bridge = readFileSync(join(here, '../../unified-quiz-renderer/HOJA_APPROVED_RENDERER_BRIDGE.html'), 'utf8');
const bridgeScriptIds = [...bridge.matchAll(/<script id="([^"]+)"/g)].map(m => m[1]);
const t0 = Date.now();
const {packages, report} = buildContentPackages(src, index, {bridgeScriptIds});
report.buildMs = undefined; // keep the committed report deterministic
const reportText = JSON.stringify(report, null, 1) + '\n';
const reportPath = join(here, 'generated/approved-content-report.json');
if (args.includes('--check')) {
  if (!existsSync(reportPath) || readFileSync(reportPath, 'utf8') !== reportText) die('DRIFT approved-content-report.json');
} else if (!opt('--qa-out')) writeFileSync(reportPath, reportText);
const contentCommit = opt('--content-commit');
if (contentCommit && !/^[a-f0-9]{40}$/.test(contentCommit)) die('CONTENT_COMMIT_MUST_BE_40_HEX (never a branch name)');
const contentSource = contentCommit ? {repo: RUNTIME_REPO, commit: contentCommit} : null;
const repoRoot = resolve(here, '../../..');
let pkgOut = null;
if (opt('--packages-out')) {
  const out = resolve(opt('--packages-out'));
  if (out === repoRoot || out.startsWith(repoRoot + '/')) die('PACKAGES_OUT_MUST_BE_OUTSIDE_THIS_REPO');
  mkdirSync(out, {recursive: true});
  if (readdirSync(out).length) die('PACKAGES_OUT_NOT_EMPTY');
  const files = [];
  for (const pk of packages) {
    const rel = approvedPackagePath(pk.cartridgeId), f = join(out, rel);
    mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, pk.json, 'utf8');
    files.push({cartridgeId: pk.cartridgeId, path: rel, bytes: Buffer.byteLength(pk.json, 'utf8'), sha256: pk.sha256});
  }
  writeFileSync(join(out, 'game-runtime/approved-packages/v1/INDEX.json'), JSON.stringify({schemaVersion: 'hoja-game-runtime-packages-v1',
    sourceCommit: commit, packages: files}, null, 1) + '\n');
  pkgOut = {out, files: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0)};
}
const qaOut = opt('--qa-out');
let qa = null;
if (qaOut) {
  const out = resolve(qaOut);
  mkdirSync(out, {recursive: true});
  if (readdirSync(out).length) die('QA_OUT_NOT_EMPTY');
  const manifest = JSON.parse(readFileSync(opt('--qa', join(here, 'deployment/qa-preview.json')), 'utf8'));
  const sid = opt('--qa-script-id') || die('--qa-script-id <isolated test project script id> required (not committed)');
  const cat = qaPreviewCatalog(index, report, manifest, {allowedScriptIds: [sid], contentSource});
  writeFileSync(join(out, 'ApprovedActiveCatalog.gs'), renderCatalogGs(cat));
  const byId = new Map(packages.map(p => [p.cartridgeId, p]));
  if (!contentSource) cat.entries.forEach((e, i) => writeFileSync(join(out, 'HOJA_QB_CONTENT_' + String(i + 1).padStart(2, '0') + '.gs'),
    renderContentGs(e.cartridgeId, byId.get(e.cartridgeId))));
  qa = {qaEntries: cat.entries.length, qaQuestions: cat.entries.reduce((n, e) => n + e.questionCount, 0), out,
    contentSource: contentSource ? 'GITHUB_RAW_PINNED_V1' : 'EMBEDDED'};
}
console.log(JSON.stringify({sourceCommit: commit, units: report.units, ready: report.ready, readyQuestions: report.readyQuestions,
  blocked: report.blocked, blockedQuestions: report.blockedQuestions, packageBytes: packages.reduce((n, p) => n + p.json.length, 0),
  ms: Date.now() - t0, qa, packagesOut: pkgOut, mode: args.includes('--check') ? 'CHECK_PASS' : 'WRITTEN'}));

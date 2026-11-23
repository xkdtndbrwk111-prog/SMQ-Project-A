#!/usr/bin/env node
/**
 * F1: approved content packages (BUILD TIME ONLY; the GAS runtime never reads GitHub/Sheets).
 *
 *   node build_content_packages.mjs --qbank <checkout> [--check]
 *       -> generated/approved-content-report.json (NO question text / images; committed)
 *   node build_content_packages.mjs --qbank <checkout> --qa-out <dir> [--qa deployment/qa-preview.json]
 *       -> <dir>/ApprovedActiveCatalog.gs (buildType QA_TEST_ONLY) + one HOJA_QB_CONTENT_NN.gs per unit
 *
 * Question content and images are NOT committed to this repository (media rights HOLD 23/23):
 * QA bundles are generated from the pinned HOJA-QUESTION-BANK checkout into an output dir.
 */
import {readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildContentPackages} from './approved_content_packager.mjs';
import {qaPreviewCatalog, renderCatalogGs, renderContentGs} from './qa_preview.mjs';

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
const qaOut = opt('--qa-out');
let qa = null;
if (qaOut) {
  const out = resolve(qaOut);
  mkdirSync(out, {recursive: true});
  if (readdirSync(out).length) die('QA_OUT_NOT_EMPTY');
  const manifest = JSON.parse(readFileSync(opt('--qa', join(here, 'deployment/qa-preview.json')), 'utf8'));
  const sid = opt('--qa-script-id') || die('--qa-script-id <isolated test project script id> required (not committed)');
  const cat = qaPreviewCatalog(index, report, manifest, {allowedScriptIds: [sid]});
  writeFileSync(join(out, 'ApprovedActiveCatalog.gs'), renderCatalogGs(cat));
  const byId = new Map(packages.map(p => [p.cartridgeId, p]));
  cat.entries.forEach((e, i) => writeFileSync(join(out, 'HOJA_QB_CONTENT_' + String(i + 1).padStart(2, '0') + '.gs'),
    renderContentGs(e.cartridgeId, byId.get(e.cartridgeId))));
  qa = {qaEntries: cat.entries.length, qaQuestions: cat.entries.reduce((n, e) => n + e.questionCount, 0), out};
}
console.log(JSON.stringify({sourceCommit: commit, units: report.units, ready: report.ready, readyQuestions: report.readyQuestions,
  blocked: report.blocked, blockedQuestions: report.blockedQuestions, packageBytes: packages.reduce((n, p) => n + p.json.length, 0),
  ms: Date.now() - t0, qa, mode: args.includes('--check') ? 'CHECK_PASS' : 'WRITTEN'}));

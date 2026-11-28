#!/usr/bin/env node
/**
 * Build (or --check) the approved-source index + lock from a LOCAL checkout of
 * HOJA-QUESTION-BANK. Build time only; the GAS runtime never reads GitHub.
 *
 *   node build_approved_index.mjs --qbank <checkout> [--out generated] [--check]
 *
 * --check rebuilds and fails if the committed index/lock differ (drift), so CI
 * proves the committed output really derives from the pinned source commit.
 */
import {readFileSync, writeFileSync, existsSync, statSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, resolve, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildApprovedIndex} from './approved_catalog_normalizer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const qbank = resolve(opt('--qbank') || fail('--qbank required'));
const out = resolve(opt('--out') || join(here, 'generated'));
const check = args.includes('--check');
function fail(m) { console.error(m); process.exit(2); }

const commit = execFileSync('git', ['-C', qbank, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const dirty = execFileSync('git', ['-C', qbank, 'status', '--porcelain', '--', 'approved'], {encoding: 'utf8'}).trim();
if (dirty) fail('QBANK_APPROVED_TREE_DIRTY: build only from a clean, committed source');
const src = {
  exists: p => { const f = join(qbank, p); return f.startsWith(qbank + sep) && existsSync(f) && statSync(f).isFile(); },
  readBytes: p => readFileSync(join(qbank, p)),
};
const {index, lock} = buildApprovedIndex(src, {sourceRepo: 'xkdtndbrwk111-prog/HOJA-QUESTION-BANK', sourceCommit: commit});
const files = {
  'approved-source-index.json': JSON.stringify(index, null, 1) + '\n',
  'approved-source-index.lock.json': JSON.stringify(lock, null, 1) + '\n',
};
if (check) {
  let drift = 0;
  for (const [name, text] of Object.entries(files)) {
    const f = join(out, name);
    if (!existsSync(f) || readFileSync(f, 'utf8') !== text) { console.error('DRIFT ' + name); drift++; }
  }
  if (drift) process.exit(1);
} else {
  mkdirSync(out, {recursive: true});
  for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);
}
const bySubject = Object.entries(index.subjects).map(([k, v]) => `${k} ${v.units}/${v.questions}`).join(', ');
console.log(JSON.stringify({sourceCommit: commit, units: index.approvalUnits, questions: index.approvalQuestions,
  bySubject, titleSources: count(index.entries.map(e => e.titleSource)),
  classification: count(index.entries.map(e => e.classificationSource)),
  overlays: index.entries.filter(e => e.mediaOverlay).map(e => e.cartridgeId + ':' + e.mediaOverlay.questionId),
  mediaRights: count(index.entries.map(e => e.mediaRights.status)),
  deployment: count(index.entries.map(e => e.deploymentStatus)),
  diagnostics: index.diagnostics.length, indexDigest: lock.indexDigest, mode: check ? 'CHECK_PASS' : 'WRITTEN'}, null, 1));
function count(list) { const m = {}; for (const x of list) m[x] = (m[x] || 0) + 1; return m; }

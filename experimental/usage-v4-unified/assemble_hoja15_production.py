#!/usr/bin/env python3
"""40-6BP: assemble + verify the HOJA 1.5 PRODUCTION bundle (no Google access, writes only OUTSIDE the repo).
bundle = unified RELEASE build (RC-audited approved-rc game) with
  - ApprovedActiveCatalog.gs replaced by the given RELEASE catalog (from build_active_catalog.mjs --deployment <draft>
    --content-commit <QBank commit>): validated pinned remote units, NO embedded content
  - the production UsageRollupU3S.gs (repo root, unchanged: the 00:15 trigger handler) and appsscript.json (repo root)
Checks (fail closed): RC audit PASS on the release game; catalog RELEASE / not QA / GITHUB_RAW_PINNED_V1 at a 40-hex
commit; every entry's packageSha256 + contentPath equal the published runtime INDEX (--packages = QBank checkout at
that commit); rollup + manifest byte-identical to the repo root; no duplicate top-level names across .gs files.
Usage: assemble_hoja15_production.py --catalog <gs> --packages <qbank checkout> --out <dir outside repo> --expected-units <manifest size>"""
import argparse, hashlib, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog', required=True); ap.add_argument('--packages', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--student-url', help='40-6CF: the EXISTING student /exec URL for the join QR (written only into the bundle, never the repo)')
    ap.add_argument('--expected-units', type=int, required=True, help='expected approved deployment manifest size (not hardcoded)')
    a = ap.parse_args()
    out = Path(a.out).resolve()
    if out == ROOT or ROOT in out.parents: raise SystemExit('OUTPUT_MUST_BE_OUTSIDE_REPO')
    if out.exists() and any(out.iterdir()): raise SystemExit('OUTPUT_NOT_EMPTY')
    fails = []
    def ok(c, m): (None if c else fails.append(m))
    with tempfile.TemporaryDirectory() as t:
        rel = Path(t) / 'rel'
        info = json.loads(subprocess.run([sys.executable, str(HERE / 'build_unified_gas.py'), '--output', str(rel), '--game', 'approved-rc'],
                                         check=True, capture_output=True, text=True).stdout)
        (Path(t) / 'info.json').write_text(json.dumps(info))
        audit = subprocess.run([sys.executable, str(HERE / 'verify_release_candidate.py'), str(rel), str(Path(t) / 'info.json')], capture_output=True, text=True)
        ok(audit.stdout.strip().endswith('RELEASE_CANDIDATE_AUDIT_PASS'), 'RC_AUDIT_FAIL')
        out.mkdir(parents=True, exist_ok=True)
        for f in rel.iterdir(): shutil.copyfile(f, out / f.name)
    cat = Path(a.catalog).read_text(encoding='utf-8')
    c = json.loads(cat[cat.index('Object.freeze(') + 14:cat.rindex(');')])
    src = c.get('contentSource') or {}
    ok(c.get('buildType') == 'RELEASE' and 'QA_TEST_ONLY' not in cat and 'allowedScriptIds' not in cat, 'CATALOG_NOT_RELEASE_OR_QA')
    ok(str(c.get('deploymentId', '')).startswith('HOJA15-'), 'DEPLOYMENT_ID_NOT_HOJA15')
    ok(src.get('kind') == 'GITHUB_RAW_PINNED_V1' and re.fullmatch(r'[a-f0-9]{40}', str(src.get('commit'))) is not None
       and src.get('repo') == 'xkdtndbrwk111-prog/HOJA-QUESTION-BANK', 'CONTENT_SOURCE_NOT_PINNED')
    idx = json.loads((Path(a.packages) / 'game-runtime/approved-packages/v1/INDEX.json').read_text())
    pub = {p['cartridgeId']: p for p in idx['packages']}
    ents = c.get('entries', [])
    ok(0 < a.expected_units == len(ents), 'ENTRY_COUNT_' + str(len(ents)))
    ok(len({e.get('cartridgeId') for e in ents}) == len(ents), 'DUPLICATE_ACTIVE_ID')
    ok(idx.get('sourceCommit') == c.get('sourceCommit'), 'SOURCE_COMMIT_MISMATCH')
    actual_commit = subprocess.check_output(['git', '-C', a.packages, 'rev-parse', 'HEAD'], text=True).strip()
    ok(actual_commit == src.get('commit'), 'RUNTIME_CHECKOUT_MISMATCH')
    for e in ents:
        p = pub.get(e['cartridgeId'])
        ok(p is not None and p['sha256'] == e.get('packageSha256') and p['path'] == e.get('contentPath'), 'PIN_MISMATCH_' + e['cartridgeId'])
        expected_path = 'game-runtime/approved-packages/v1/' + e['cartridgeId'] + '.json'
        if p and p['path'] == expected_path and re.fullmatch(r'[a-z0-9][a-z0-9-]{2,63}', e['cartridgeId']):
            raw = subprocess.check_output(['git', '-C', a.packages, 'show', actual_commit + ':' + expected_path])
            ok(hashlib.sha256(raw).hexdigest() == p['sha256'] and len(raw) == p['bytes'], 'PACKAGE_BYTES_' + e['cartridgeId'])
            data = json.loads(raw)
            ok(data.get('cartridgeId') == e['cartridgeId'] and len(data.get('questions', [])) == e['questionCount'], 'PACKAGE_COUNT_' + e['cartridgeId'])
        else:
            ok(False, 'PACKAGE_PATH_' + e['cartridgeId'])
    (out / 'ApprovedActiveCatalog.gs').write_text(cat, encoding='utf-8')
    for f in ('UsageRollupU3S.gs', 'appsscript.json'): shutil.copyfile(ROOT / f, out / f)
    shutil.copyfile(HERE / 'gas/RemoteActiveCatalog.gs', out / 'RemoteActiveCatalog.gs')  # disabled until explicit operator enable
    if a.student_url:
        ok(re.fullmatch(r'https://script\.google\.com/(?:a/[A-Za-z0-9.-]+/)?macros/s/[A-Za-z0-9_-]{20,}/exec', a.student_url) is not None, 'STUDENT_URL_NOT_EXEC')
        (out / 'Hoja15JoinConfig.gs').write_text("/* bundle-only (40-6CF): student /exec URL for the join QR. Not in the repository. */\n"
                                                 "const HOJA15_JOIN_STUDENT_URL_=" + json.dumps(a.student_url) + ";\n", encoding='utf-8')
    ok(not [f for f in out.iterdir() if f.name.startswith('HOJA_QB_CONTENT_')], 'EMBEDDED_CONTENT_PRESENT')
    names = {}
    for f in sorted(out.glob('*.gs')):
        for m in re.finditer(r'^(?:const|let|var|function)\s+([A-Za-z0-9_$]+)', f.read_text(encoding='utf-8'), re.M):
            names.setdefault(m.group(1), []).append(f.name)
    dups = {k: v for k, v in names.items() if len(v) > 1}
    ok(not dups, 'DUPLICATE_GLOBALS ' + json.dumps(dups))
    files = {f.name: {'bytes': f.stat().st_size, 'sha8': hashlib.sha256(f.read_bytes()).hexdigest()[:8]} for f in sorted(out.iterdir())}
    summary = {'out': str(out.name), 'files': files, 'bundleBytes': sum(v['bytes'] for v in files.values()), 'activeEntries': len(ents),
               'contentSource': src, 'deploymentId': c.get('deploymentId'), 'joinStudentUrlConfigured': bool(a.student_url), 'rcAudit': 'PASS' if 'RC_AUDIT_FAIL' not in fails else 'FAIL', 'fails': fails}
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print('HOJA15_PRODUCTION_BUNDLE_' + ('PASS' if not fails else 'FAIL')); sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()

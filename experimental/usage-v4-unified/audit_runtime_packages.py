#!/usr/bin/env python3
"""40-6AQ: offline audit of the 23-unit runtime packages against the generated approved-source index.
Checks: INDEX schema/sourceCommit; every package file's byte length + SHA-256 == INDEX; package cartridgeId / question count
== approved-source-index entry; total units/questions; media overlay + media-rights status per unit; active deployment
entries. Counts/ids/hashes only. Usage: audit_runtime_packages.py --packages DIR [--json OUT]"""
import argparse, hashlib, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ap = argparse.ArgumentParser(); ap.add_argument('--packages', required=True); ap.add_argument('--json')
a = ap.parse_args()
P = Path(a.packages); idx = json.loads((P / 'game-runtime/approved-packages/v1/INDEX.json').read_text())
src = json.loads((HERE / 'approved-catalog/generated/approved-source-index.json').read_text())
dep = json.loads((HERE / 'approved-catalog/deployment/active-deployment.json').read_text())
fails, rows = [], []
def need(c, m): (None if c else fails.append(m))
need(idx.get('schemaVersion') == 'hoja-game-runtime-packages-v1', 'INDEX_SCHEMA')
need(idx.get('sourceCommit') == src['sourceCommit'] == dep['sourceCommit'], 'SOURCE_COMMIT_MISMATCH')
by = {e['cartridgeId']: e for e in src['entries']}
need(sorted(p['cartridgeId'] for p in idx['packages']) == sorted(by), 'UNIT_SET_MISMATCH')
listed = {p['path'] for p in idx['packages']} | {'game-runtime/approved-packages/v1/INDEX.json'}
extra = sorted(str(f.relative_to(P)) for f in (P / 'game-runtime/approved-packages/v1').glob('*') if str(f.relative_to(P)) not in listed)
need(not extra, 'UNLISTED_FILES:' + ','.join(extra))
qsum = 0
for p in idx['packages']:
    b = (P / p['path']).read_bytes(); d = json.loads(b); e = by.get(p['cartridgeId'], {})
    sha_ok = hashlib.sha256(b).hexdigest() == p['sha256']; len_ok = len(b) == p['bytes']
    q = len(d.get('questions', [])); qsum += q
    mr = e.get('mediaRights') or {}
    rows.append({'id': p['cartridgeId'], 'bytes': len(b), 'sha8': p['sha256'][:8], 'shaOk': sha_ok, 'bytesOk': len_ok,
                 'idOk': d.get('cartridgeId') == p['cartridgeId'], 'questions': q, 'indexQuestions': e.get('questionCount'),
                 'images': len(d.get('images') or {}), 'mediaOverlay': 'YES' if e.get('mediaOverlay') else 'NONE',
                 'mediaRights': mr.get('status') or json.dumps(mr, ensure_ascii=False)[:40], 'deployment': e.get('deploymentStatus')})
    need(sha_ok and len_ok, 'SHA_OR_BYTES:' + p['cartridgeId']); need(d.get('cartridgeId') == p['cartridgeId'], 'ID:' + p['cartridgeId'])
    need(q == e.get('questionCount'), 'QCOUNT:' + p['cartridgeId'])
need(len(rows) == src['approvalUnits'] == 23, 'UNITS'); need(qsum == src['approvalQuestions'] == 732, 'QUESTIONS')
need(dep.get('entries') == [] or dep.get('entries') == 0 or len(dep.get('entries') or []) == 0, 'ACTIVE_DEPLOYMENT_NOT_EMPTY')
out = {'sourceCommit': src['sourceCommit'], 'units': len(rows), 'questions': qsum, 'packageBytes': sum(r['bytes'] for r in rows),
       'withMediaOverlay': sum(1 for r in rows if r['mediaOverlay'] == 'YES'), 'mediaRights': sorted({r['mediaRights'] for r in rows}),
       'activeDeploymentEntries': len(dep.get('entries') or []), 'gameDeployment': src.get('gameDeployment'), 'fails': fails, 'units_detail': rows}
for r in rows: print(json.dumps(r, ensure_ascii=False))
print(json.dumps({k: v for k, v in out.items() if k != 'units_detail'}, ensure_ascii=False))
if a.json: Path(a.json).write_text(json.dumps(out, ensure_ascii=False, indent=1))
print('RUNTIME_PACKAGE_AUDIT_' + ('PASS' if not fails else 'FAIL')); sys.exit(1 if fails else 0)

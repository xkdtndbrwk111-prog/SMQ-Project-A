#!/usr/bin/env python3
"""Compare a production build with the fixed Phase 1 file manifest."""
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'verification/phase2/baseline.json').read_text())
dist = root / 'dist'
if not dist.is_dir():
    sys.exit('FAIL: dist 없음 — 먼저 node tools/build_web.mjs 실행')

actual = {}
for p in sorted(dist.rglob('*')):
    if not p.is_file():
        continue
    name = p.relative_to(dist).as_posix()
    data = p.read_bytes()
    if name == 'BUILD.json':
        obj = json.loads(data)
        obj.pop('builtAt', None)
        data = (json.dumps(obj, ensure_ascii=False, sort_keys=True,
                           separators=(',', ':')) + '\n').encode()
    actual[name] = hashlib.sha256(data).hexdigest()

expected = manifest['files']
errors = []
for name in sorted(expected.keys() | actual.keys()):
    if name not in actual:
        errors.append(f'누락: {name}')
    elif name not in expected:
        errors.append(f'추가: {name}')
    elif actual[name] != expected[name]:
        errors.append(f'변경: {name}')
if errors:
    print('\n'.join('FAIL ' + error for error in errors))
    sys.exit(1)
print(f"PASS Phase 1 기준판 {manifest['baselineCommit']}: {len(actual)}개 파일 일치 (BUILD.json 생성 시각 제외)")

#!/usr/bin/env python3
"""Assemble the 40-6-U isolated single Project A GAS folder (for a TEST project).

Output = gas/*.gs + gas/Stats.html + gas/appsscript.json + Game.html restored
from versions/2.0.0 parts with SHA-256 verification (game bytes unchanged).
Never writes into the repository root and never deploys anything.
Usage: python3 build_unified_gas.py --output <empty dir outside the repo root>
"""
import argparse, hashlib, json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAS = Path(__file__).resolve().parent / 'gas'
VER = ROOT / 'versions' / '2.0.0'
FILES = ['appsscript.json', 'Code.gs', 'UsageV4Core.gs', 'UsageV4Public.gs', 'UsageV4Unified.gs', 'Stats.html']

def game_bytes():
    m = json.loads((VER / 'SHA256_MANIFEST.json').read_text(encoding='utf-8'))
    out = []
    for p in m['parts']:
        data = (VER / 'Game.html.parts' / p['name']).read_bytes()
        if len(data) != p['bytes'] or hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() != p['gitBlobSha1']:
            raise SystemExit('PART_SHA_MISMATCH ' + p['name'])
        out.append(data)
    content = b''.join(out)
    if hashlib.sha256(content).hexdigest() != m['sha256'] or len(content) != m['bytes']:
        raise SystemExit('GAME_SHA256_MISMATCH')
    return content, m['sha256']

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--output', required=True)
    out = Path(ap.parse_args().output).resolve()
    if out == ROOT or ROOT in out.parents and out.parent == ROOT:
        raise SystemExit('REFUSE_REPO_ROOT')
    out.mkdir(parents=True, exist_ok=True)
    if any(out.iterdir()):
        raise SystemExit('OUTPUT_NOT_EMPTY')
    for f in FILES:
        shutil.copyfile(GAS / f, out / f)
    content, sha = game_bytes()
    (out / 'Game.html').write_bytes(content)
    if b'getPublicUsageStatisticsV4' in content:
        raise SystemExit('GAME_MUST_NOT_CALL_STATS')
    print(json.dumps({'output': str(out), 'files': FILES + ['Game.html'], 'gameSha256': sha}))

if __name__ == '__main__':
    main()

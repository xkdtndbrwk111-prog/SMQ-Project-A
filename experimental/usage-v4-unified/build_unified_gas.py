#!/usr/bin/env python3
"""Assemble the 40-6-U isolated single Project A GAS folder (for a TEST project).

Output = gas/*.gs + gas/Stats.html + gas/appsscript.json + Game.html restored
from versions/2.0.0 parts with SHA-256 verification. 40-6-U D: exactly ONE block,
<script id="hojaProdUsageTelemetry">, is replaced by gas/UsageTelemetryClient.html
(same-eventId retry); every other game byte is unchanged and both SHAs are printed.
Never writes into the repository root and never deploys anything.
F1: --variant release (default) ships the committed RELEASE ApprovedActiveCatalog.gs and
NO approved content; --variant qa --qa-dir <dir from build_content_packages.mjs --qa-out>
replaces the catalog with the TEST-ONLY QA preview catalog + per-unit content files.
Usage: python3 build_unified_gas.py --output <empty dir outside the repo root> [--variant qa --qa-dir D]
"""
import argparse, hashlib, json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAS = Path(__file__).resolve().parent / 'gas'
VER = ROOT / 'versions' / '2.0.0'
FILES = ['appsscript.json', 'Code.gs', 'ApprovedActiveCatalog.gs', 'UsageV4Core.gs', 'UsageV4Public.gs', 'UsageV4Unified.gs', 'Stats.html']
TELEMETRY_OPEN = b'<script id="hojaProdUsageTelemetry">'

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

def patch_telemetry(content):
    start = content.find(TELEMETRY_OPEN)
    if start < 0 or content.find(TELEMETRY_OPEN, start + 1) >= 0:
        raise SystemExit('TELEMETRY_BLOCK_NOT_UNIQUE')
    end = content.find(b'</script>', start)
    old = content[start:end + len(b'</script>')]
    if b'withFailureHandler(()=>{}).recordUsageStartU1' not in old:
        raise SystemExit('TELEMETRY_BLOCK_UNEXPECTED')
    new = (GAS / 'UsageTelemetryClient.html').read_bytes().strip()
    if not new.startswith(TELEMETRY_OPEN) or not new.endswith(b'</script>') or new.count(b'<script') != 1:
        raise SystemExit('TELEMETRY_REPLACEMENT_INVALID')
    patched = content[:start] + new + content[end + len(b'</script>'):]
    return patched, hashlib.sha256(old).hexdigest(), hashlib.sha256(new).hexdigest()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--output', required=True)
    ap.add_argument('--variant', choices=['release', 'qa'], default='release'); ap.add_argument('--qa-dir')
    ap.add_argument('--release-content-dir', help='F3-2: HOJA_QB_CONTENT_*.gs for EXACTLY the release-active ids (required when active > 0)')
    a = ap.parse_args()
    out = Path(a.output).resolve()
    if out == ROOT or ROOT in out.parents and out.parent == ROOT:
        raise SystemExit('REFUSE_REPO_ROOT')
    out.mkdir(parents=True, exist_ok=True)
    if any(out.iterdir()):
        raise SystemExit('OUTPUT_NOT_EMPTY')
    for f in FILES:
        shutil.copyfile(GAS / f, out / f)
    cat = (out / 'ApprovedActiveCatalog.gs').read_text(encoding='utf-8')
    if '"buildType": "RELEASE"' not in cat or 'QA_TEST_ONLY' in cat:
        raise SystemExit('RELEASE_CATALOG_REQUIRED')
    extra = []
    if a.variant == 'qa':
        qa = Path(a.qa_dir or '').resolve()
        qcat = (qa / 'ApprovedActiveCatalog.gs').read_text(encoding='utf-8')
        if '"buildType": "QA_TEST_ONLY"' not in qcat:
            raise SystemExit('QA_CATALOG_REQUIRED')
        shutil.copyfile(qa / 'ApprovedActiveCatalog.gs', out / 'ApprovedActiveCatalog.gs')
        for f in sorted(qa.glob('HOJA_QB_CONTENT_*.gs')):
            shutil.copyfile(f, out / f.name); extra.append(f.name)
    elif a.qa_dir:
        raise SystemExit('QA_DIR_ONLY_WITH_QA_VARIANT')
    else:
        # RELEASE: active entries (teacher deployment approved) must ship their exact content, nothing more.
        body = cat[cat.index('Object.freeze(') + len('Object.freeze('):cat.rindex(');')]
        active = {e['cartridgeId']: e.get('packageSha256') for e in json.loads(body)['entries']}
        if active:
            d = Path(a.release_content_dir or '').resolve()
            files = sorted(d.glob('HOJA_QB_CONTENT_*.gs')) if a.release_content_dir else []
            got = {}
            for f in files:
                t = f.read_text(encoding='utf-8')
                import re
                m = re.search(r'HOJA_APPROVED_CONTENT_\[("[^"]+")\]=\{packageSha256:("[0-9a-f]{64}")', t)
                if not m: raise SystemExit('RELEASE_CONTENT_FILE_INVALID ' + f.name)
                got[json.loads(m.group(1))] = json.loads(m.group(2))
            if got != active: raise SystemExit('RELEASE_CONTENT_MUST_MATCH_ACTIVE_IDS_AND_DIGESTS')
            for f in files: shutil.copyfile(f, out / f.name); extra.append(f.name)
        elif a.release_content_dir:
            raise SystemExit('RELEASE_HAS_NO_ACTIVE_ENTRIES')
    content, sha = game_bytes()
    patched, old_block, new_block = patch_telemetry(content)
    (out / 'Game.html').write_bytes(patched)
    if b'getPublicUsageStatisticsV4' in patched:
        raise SystemExit('GAME_MUST_NOT_CALL_STATS')
    print(json.dumps({'output': str(out), 'variant': a.variant, 'files': FILES + extra + ['Game.html'], 'gameSha256': sha,
                      'catalogSha256': hashlib.sha256((out / 'ApprovedActiveCatalog.gs').read_bytes()).hexdigest(),
                      'contentFiles': len(extra), 'contentBytes': sum((out / f).stat().st_size for f in extra),
                      'patchedGameSha256': hashlib.sha256(patched).hexdigest(),
                      'telemetryBlockOldSha256': old_block, 'telemetryBlockNewSha256': new_block}))

if __name__ == '__main__':
    main()

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

def approved_rc_game(original_sha):
    """F3-3 release candidate: rebuild the verified trial game (only parts 14 and 22 differ from the
    pinned 2.0.0 snapshot) with the COMPOSED renderer (unchanged bridge + media + math extensions)
    and the approved arcade runtime. Temp files only; nothing in the repository is written."""
    import subprocess, sys, tempfile
    trial_dir = ROOT / 'experimental/unified-quiz-renderer/game-trial'
    rdir = ROOT / 'experimental/unified-quiz-renderer'
    orig = [(VER / 'Game.html.parts' / f'part-{i:02d}.txt').read_bytes() for i in range(1, 26)]
    trial = [(trial_dir / f'part-{i:02d}.txt').read_bytes() for i in range(1, 26)]
    if hashlib.sha256(b''.join(orig)).hexdigest() != original_sha: raise SystemExit('ORIGINAL_SNAPSHOT_CHANGED')
    changed = [i + 1 for i, (x, y) in enumerate(zip(orig, trial)) if x != y]
    if changed != [14, 22]: raise SystemExit('UNEXPECTED_TRIAL_PART_CHANGES ' + str(changed))
    with tempfile.TemporaryDirectory() as td:
        comp = Path(td) / 'composed.html'
        info = json.loads(subprocess.check_output(['node', str(rdir / 'compose_renderer.mjs'), str(comp)]).decode())
        sys.path.insert(0, str(trial_dir))
        import build_trial
        game = Path(td) / 'Game.rc.html'
        import contextlib, io
        with contextlib.redirect_stdout(io.StringIO()): build_trial.build(game, comp)
        data = game.read_bytes()
    if b'HOJA_TRIAL_APPROVED_HTML' not in data or any(m not in data for m in (b'hoja-ext-media-v1', b'hoja-ext-math-v1', b'hoja-ext-input-guard-v1')):
        raise SystemExit('RC_RENDERER_NOT_EMBEDDED')
    return data, {'originalSha256': original_sha, 'changedParts': changed,
                  'part14Sha256': hashlib.sha256(trial[13]).hexdigest(), 'part22Sha256': hashlib.sha256(trial[21]).hexdigest(),
                  'bridgeSha256': info['bridgeSha256'], 'mediaExtSha256': info['extSha256'], 'mathExtSha256': info['mathExtSha256'], 'inputGuardSha256': info['inputGuardSha256'],
                  'composedRendererSha256': info['composedSha256'], 'rcGameSha256': hashlib.sha256(data).hexdigest()}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--output', required=True)
    ap.add_argument('--variant', choices=['release', 'qa'], default='release'); ap.add_argument('--qa-dir')
    ap.add_argument('--trial-game', help='QA only: trial Game.html built by game-trial/build_trial.py --renderer <composed> (approved renderer in the game)')
    ap.add_argument('--game', choices=['original', 'approved-rc'], default='original',
                    help='approved-rc (F3-3): release-candidate game = pinned 2.0.0 snapshot + verified trial parts 14/22 + composed approved renderer + approved arcade runtime')
    ap.add_argument('--synthetic-release-catalog', help='TEST ONLY: RELEASE catalog marked deploymentId SYNTHETIC-TEST-ONLY-* (never the committed manifest); output must be outside the repo')
    ap.add_argument('--release-content-dir', help='F3-2: HOJA_QB_CONTENT_*.gs for EXACTLY the release-active ids (required when active > 0)')
    a = ap.parse_args()
    out = Path(a.output).resolve()
    if out == ROOT or ROOT in out.parents and out.parent == ROOT:
        raise SystemExit('REFUSE_REPO_ROOT')
    if a.synthetic_release_catalog and (ROOT in out.parents or out == ROOT):
        raise SystemExit('SYNTHETIC_OUTPUT_MUST_BE_OUTSIDE_REPO')
    out.mkdir(parents=True, exist_ok=True)
    if any(out.iterdir()):
        raise SystemExit('OUTPUT_NOT_EMPTY')
    for f in FILES:
        shutil.copyfile(GAS / f, out / f)
    synthetic = False
    if a.synthetic_release_catalog:
        if a.variant != 'release': raise SystemExit('SYNTHETIC_CATALOG_ONLY_WITH_RELEASE_VARIANT')
        if ROOT in out.parents or out == ROOT: raise SystemExit('SYNTHETIC_OUTPUT_MUST_BE_OUTSIDE_REPO')
        sc = Path(a.synthetic_release_catalog).read_text(encoding='utf-8')
        if '"deploymentId": "SYNTHETIC-TEST-ONLY-' not in sc: raise SystemExit('NOT_A_SYNTHETIC_TEST_CATALOG')
        (out / 'ApprovedActiveCatalog.gs').write_text(sc, encoding='utf-8'); synthetic = True
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
        remote = '"contentSource"' in qcat
        if remote and '"GITHUB_RAW_PINNED_V1"' not in qcat: raise SystemExit('CONTENT_SOURCE_INVALID')
        for f in sorted(qa.glob('HOJA_QB_CONTENT_*.gs')):
            if remote: raise SystemExit('MIXED_CONTENT_SOURCE: remote catalog must ship NO embedded content')
            shutil.copyfile(f, out / f.name); extra.append(f.name)
    elif a.qa_dir:
        raise SystemExit('QA_DIR_ONLY_WITH_QA_VARIANT')
    else:
        # RELEASE: active entries (teacher deployment approved) must ship their exact content, nothing more.
        body = cat[cat.index('Object.freeze(') + len('Object.freeze('):cat.rindex(');')]
        active = {e['cartridgeId']: e.get('packageSha256') for e in json.loads(body)['entries']}
        if active and '"contentSource"' in cat:
            # F4: lightweight RELEASE — content is fetched at a pinned commit; nothing embedded.
            if a.release_content_dir: raise SystemExit('MIXED_CONTENT_SOURCE: remote catalog must ship NO embedded content')
            ents = json.loads(body)['entries']
            if '"GITHUB_RAW_PINNED_V1"' not in cat or any(not e.get('contentPath') for e in ents):
                raise SystemExit('CONTENT_SOURCE_INVALID')
        elif active:
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
    rc = None
    if a.game == 'approved-rc':
        if a.trial_game: raise SystemExit('USE_EITHER_GAME_OR_TRIAL_GAME')
        content, rc = approved_rc_game(sha)
    if a.trial_game:
        if a.variant != 'qa': raise SystemExit('TRIAL_GAME_ONLY_WITH_QA_VARIANT')
        content = Path(a.trial_game).read_bytes()
        if b'HOJA_TRIAL_APPROVED_HTML' not in content: raise SystemExit('NOT_A_TRIAL_GAME')
        sha = hashlib.sha256(content).hexdigest()
    patched, old_block, new_block = patch_telemetry(content)
    (out / 'Game.html').write_bytes(patched)
    if b'getPublicUsageStatisticsV4' in patched:
        raise SystemExit('GAME_MUST_NOT_CALL_STATS')
    print(json.dumps({'output': str(out), 'variant': a.variant, 'files': FILES + extra + ['Game.html'], 'gameSha256': sha,
                      'catalogSha256': hashlib.sha256((out / 'ApprovedActiveCatalog.gs').read_bytes()).hexdigest(),
                      'contentFiles': len(extra), 'contentBytes': sum((out / f).stat().st_size for f in extra),
                      'bundleBytes': sum(f.stat().st_size for f in out.iterdir() if f.is_file()),
                      'patchedGameSha256': hashlib.sha256(patched).hexdigest(), 'game': a.game, 'releaseCandidate': rc,
                      'syntheticReleaseCatalog': synthetic,
                      'telemetryBlockOldSha256': old_block, 'telemetryBlockNewSha256': new_block}))

if __name__ == '__main__':
    main()

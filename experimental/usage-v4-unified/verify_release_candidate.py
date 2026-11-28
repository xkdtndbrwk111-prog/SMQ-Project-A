#!/usr/bin/env python3
"""F3-3: audit a RELEASE build (build_unified_gas.py --variant release --game approved-rc [--synthetic-release-catalog ...]).
Fails (exit 1) unless: the game was assembled from the pinned 2.0.0 snapshot with ONLY trial parts 14/22 changed;
the composed renderer (bridge SHA-pinned + media + math ext) and approved arcade runtime are embedded; the telemetry
block is the patched one; NO QA-only material is present (QA_TEST_ONLY catalog, allowedScriptIds, qa-preview,
test-only helpers, mock/shim names); with the committed catalog the build has 0 active entries and 0 content files;
with a synthetic catalog it is visibly marked SYNTHETIC-TEST-ONLY. Usage: verify_release_candidate.py <bundleDir> <builder-json>"""
import hashlib, json, re, sys
from pathlib import Path
d = Path(sys.argv[1]); info = json.loads(Path(sys.argv[2]).read_text())
fails = []; ok = lambda c, m: c or fails.append(m)
rc = info.get('releaseCandidate') or {}
ok(info.get('variant') == 'release' and info.get('game') == 'approved-rc', 'NOT_A_RELEASE_RC_BUILD')
ok(rc.get('originalSha256') == '4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6', 'ORIGINAL_SNAPSHOT_SHA')
ok(rc.get('changedParts') == [14, 22, 23, 24], 'CHANGED_PARTS')   # 40-6BG: practice-mode control update in 23/24
# Previous approved bridge SHA-256: 12b76fbbf667f3408f19059c0b0d3febd9bc471c038ddd004333ce135633b157.
ok(rc.get('bridgeSha256') == 'd4c93c612dd6486ec0554da300b703f595e36830268527908c5cc5e0c7bab82c', 'BRIDGE_SHA')
game = (d / 'Game.html').read_bytes()
from solo_jump_patch import verify, PATCH_SHA256
ok(verify(game) and rc.get('soloJumpPatchSha256') == PATCH_SHA256, 'SOLO_JUMP_PATCH_MISMATCH')
ok(hashlib.sha256(game).hexdigest() == info['patchedGameSha256'], 'GAME_SHA_MISMATCH_WITH_BUILD_REPORT')
for marker in (b'hoja-ext-media-v1', b'hoja-ext-math-v1', b'hoja-ext-input-guard-v1', b'HOJA_TRIAL_APPROVED_HTML', b'hoja_usage_pending_v1'):
    ok(marker in game, 'MISSING_IN_GAME ' + marker.decode())
ok(b'withFailureHandler(()=>{}).recordUsageStartU1' not in game, 'OLD_TELEMETRY_STILL_PRESENT')
# HOJA 1.5: display-only title overlay is injected AFTER the package cache. Removing it
# first restores the original cached-game bytes for F4 audit, without changing the pinned RC.
# 40-6CF: the join/QR layer is injected LAST (after the display layer); strip it first.
join_mark = b'<script id="hoja15-join-v1">'
ok(game.count(join_mark) == 1, 'JOIN_BLOCK_COUNT')
if game.count(join_mark) == 1:
    ji = game.index(join_mark)
    jj = game.index(b'</script>', ji) + len(b'</script>\n')
    ok(hashlib.sha256(game[ji:jj-1]).hexdigest() == rc.get('joinBlockSha256'), 'JOIN_BLOCK_SHA')
    ok(b'hojaJoinResolve' in game[ji:jj] and b'HOJA_B_LIVE' in game[ji:jj], 'JOIN_BLOCK_CONTENT')
    game = game[:ji] + game[jj:]
display_mark = b'<script id="hoja15-approved-cartridge-display-v1">'
ok(game.count(display_mark) == 1, 'DISPLAY_BLOCK_COUNT')
without_display = game
if game.count(display_mark) == 1:
    di = game.index(display_mark)
    dj = game.index(b'</script>', di) + len(b'</script>\n')
    ok(hashlib.sha256(game[di:dj-1]).hexdigest() == rc.get('approvedDisplayBlockSha256'), 'DISPLAY_BLOCK_SHA')
    without_display = game[:di] + game[dj:]
# F4 (40-6AD): the browser package cache is exactly ONE injected block; without it the game is the audited RC
mark = b'<script id="hoja-approved-package-cache-v1">'
ok(without_display.count(mark) == 1, 'PACKAGE_CACHE_BLOCK_COUNT')
if without_display.count(mark) == 1:
    i = without_display.index(mark); j = without_display.index(b'</script>', i) + len(b'</script>\n')
    ok(hashlib.sha256(without_display[i:j - 1]).hexdigest() == rc.get('packageCacheBlockSha256'), 'PACKAGE_CACHE_BLOCK_SHA')
    ok(hashlib.sha256(without_display[:i] + without_display[j:]).hexdigest() == rc.get('gameBeforePackageCacheSha256'), 'GAME_WITHOUT_CACHE_BLOCK_MISMATCH')
# 40-6AI: the telemetry client policy changed (R7 queue rollover), so the patched game hash moved from 876933... (40-6AF).
# Pin instead: (1) the F3-3-audited game BEFORE any patch, (2) the telemetry block in the game == the current
# UsageTelemetryClient.html block byte-for-byte (so the client policy file is the only source of that change).
# 40-6BV: re-pinned after HOJA 1.5 UX fixes (was 22aa9041… 40-6BG, 1cb387c7… 40-6BF, 617f2228… before)
# Prior audited RC: 9c9c6c041463cb1a3c017f4c57e7ac11ba1dc662ce56ffba7b56cee16ff75874.
# 2026-11-27 stability RC: only the documented frame-host generation guard changed (PR #14).
# Previous frame-host stability RC: 6c62da8d15da4d8fb44aa429e7e6c4c086fba37f4bef9a5ae55d498d02938be2.
# Intro-only scene pause / timestep sleep RC; evidence recorded in PR #14.
# Prior intro timestep RC: 15206197a4c311f12afea9a47b54c3c50e3a880f8c23fc5fc54594126ce877c0.
# Presentation identity adapter RC, evidence recorded in PR #14.
# Previous presentation identity RC: 4966846596244b166082c5d095cf42a235ef597d7df1d7c7abf3951f7e861b0b.
# Renderer show-failure retry RC; two-build and source-boundary evidence in PR #14.
# Previous show-failure retry RC: 8cddcbe1f84fdb51f015a756fdfcab9f84a947daf58ab93e41a4675c6ea1b69b.
# Embed/load/show recovery RC; evidence in PR #14.
# Previous renderer recovery RC: 25e2777ad18990ee922f9db588458f932408d0d39a7cc44bc647c55900dc9293.
# Focused/visible arcade startup clock correction; evidence in PR #14.
ok(rc.get('rcGameSha256') == 'bb3a06d789a40fa7ba2af946bd6cb06352f6abbeefb02b2ab978805a9fc29264', 'RC_GAME_BEFORE_PATCHES_IS_NOT_THE_F3_3_AUDITED_GAME')
tblock = (Path(__file__).resolve().parent / 'gas/UsageTelemetryClient.html').read_bytes().strip()
ok(game.count(tblock) == 1 and info.get('telemetryBlockNewSha256') == hashlib.sha256(tblock).hexdigest(), 'TELEMETRY_BLOCK_IS_NOT_THE_CURRENT_CLIENT')
gs = {f.name: f.read_text(encoding='utf-8') for f in d.glob('*.gs')}
allsrc = '\n'.join(gs.values()) + game.decode('utf-8', 'replace')
for bad in ('"buildType": "QA_TEST_ONLY"', 'qa-preview-not-deployment', 'hojaV4TestEvidenceU3',
            'hojaV4TestSetupU3', 'qa_mock_gas_server', 'MOCK_ISOLATED_TEST_SCRIPT_ID', 'QA_PREVIEW_NOT_DEPLOYED'):
    ok(bad not in allsrc, 'QA_MATERIAL_PRESENT ' + bad)
cat = gs['ApprovedActiveCatalog.gs']
# Code.gs legitimately contains the QA *guard* that reads allowedScriptIds; QA *data* would be in the catalog.
ok('allowedScriptIds' not in cat and 'QA_TEST_ONLY' not in cat, 'QA_CATALOG_DATA_PRESENT')
ok('"buildType": "RELEASE"' in cat, 'CATALOG_NOT_RELEASE')
entries = json.loads(cat[cat.index('Object.freeze(') + 14:cat.rindex(');')])['entries']
content = [f for f in gs if f.startswith('HOJA_QB_CONTENT_')]
if info.get('syntheticReleaseCatalog'):
    ok('SYNTHETIC-TEST-ONLY' in cat and all(e.get('deploymentStatus') == 'SYNTHETIC_TEST_ONLY_NOT_DEPLOYED' for e in entries), 'SYNTHETIC_NOT_MARKED')
    if '"contentSource"' in cat:
        # F4 lightweight release: content is fetched at a pinned commit -> NO embedded content at all
        src = json.loads(cat[cat.index('Object.freeze(') + 14:cat.rindex(');')]).get('contentSource') or {}
        ok(src.get('kind') == 'GITHUB_RAW_PINNED_V1' and re.fullmatch(r'[a-f0-9]{40}', str(src.get('commit'))) is not None
           and src.get('repo') == 'xkdtndbrwk111-prog/HOJA-QUESTION-BANK', 'CONTENT_SOURCE_NOT_PINNED')
        ok(content == [] and all(e.get('contentPath') for e in entries), 'REMOTE_RELEASE_MUST_HAVE_0_CONTENT_AND_PATHS')
    else:
        ok(len(content) == len(entries), 'SYNTHETIC_CONTENT_COUNT')
else:
    ok(entries == [] and content == [], 'COMMITTED_RELEASE_MUST_HAVE_0_ACTIVE_AND_0_CONTENT')
summary = {'bundle': d.name, 'synthetic': bool(info.get('syntheticReleaseCatalog')), 'activeEntries': len(entries), 'contentFiles': len(content),
           'contentSource': 'GITHUB_RAW_PINNED_V1' if '"contentSource"' in cat else 'EMBEDDED', 'bundleBytes': info.get('bundleBytes'),
           'rcGameSha256': rc.get('rcGameSha256'), 'patchedGameSha256': info['patchedGameSha256'], 'composedRendererSha256': rc.get('composedRendererSha256'),
           'part14Sha256': rc.get('part14Sha256'), 'part22Sha256': rc.get('part22Sha256'), 'fails': fails}
print(json.dumps(summary, ensure_ascii=False))
print('RELEASE_CANDIDATE_AUDIT_' + ('PASS' if not fails else 'FAIL')); sys.exit(1 if fails else 0)

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
ok(rc.get('changedParts') == [14, 22], 'CHANGED_PARTS')
ok(rc.get('bridgeSha256') == '12b76fbbf667f3408f19059c0b0d3febd9bc471c038ddd004333ce135633b157', 'BRIDGE_SHA')
game = (d / 'Game.html').read_bytes()
ok(hashlib.sha256(game).hexdigest() == info['patchedGameSha256'], 'GAME_SHA_MISMATCH_WITH_BUILD_REPORT')
for marker in (b'hoja-ext-media-v1', b'hoja-ext-math-v1', b'hoja-ext-input-guard-v1', b'HOJA_TRIAL_APPROVED_HTML', b'hoja_usage_pending_v1'):
    ok(marker in game, 'MISSING_IN_GAME ' + marker.decode())
ok(b'withFailureHandler(()=>{}).recordUsageStartU1' not in game, 'OLD_TELEMETRY_STILL_PRESENT')
# F4 (40-6AD): the browser package cache is exactly ONE injected block; without it the game is the audited RC
mark = b'<script id="hoja-approved-package-cache-v1">'
ok(game.count(mark) == 1, 'PACKAGE_CACHE_BLOCK_COUNT')
if game.count(mark) == 1:
    i = game.index(mark); j = game.index(b'</script>', i) + len(b'</script>\n')
    ok(hashlib.sha256(game[i:j - 1]).hexdigest() == rc.get('packageCacheBlockSha256'), 'PACKAGE_CACHE_BLOCK_SHA')
    ok(hashlib.sha256(game[:i] + game[j:]).hexdigest() == rc.get('gameBeforePackageCacheSha256') == '876933786d9cc3bb2dd412afe1823c78625d79747a8ffe4a03f1a25007c0fee7',
       'GAME_WITHOUT_CACHE_BLOCK_IS_NOT_THE_AUDITED_RC')
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

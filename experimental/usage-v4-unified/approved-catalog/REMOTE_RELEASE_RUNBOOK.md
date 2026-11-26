# HOJA 1.5 remote catalog release — operator runbook

Status: candidate only. Do not enable until the protected publication PR, 29-entry approved release manifest, exact package pins, actual GAS smoke tests and browser end-to-end tests are verified.

## One-time repository configuration

1. On HOJA-QUESTION-BANK, merge the independent publication gate (PR #2) after its review. The canonical correction from PR #1 is already included in merged PR #4 (29 runtime packages); do not merge the obsolete PR #1. Science source PR #3 and runtime PR #4 are merged. Verify current runtime INDEX still matches the approved tree.
2. Protect main: require PRs, strict up-to-date mandatory status check **Verify immutable catalog publication** for catalog PRs (configure gate to run on every PR if required globally), and prohibit direct writes/force pushes by publisher. Allow merge commits only; squash/rebase must be disabled because the immutable catalog commit must remain reachable. Do not allow the publisher to bypass branch protection.
3. In private SMQ-Project-A, protect main and configure environment `hoja-catalog-publication` restricted to main. Store a least-privilege, expiring, QBank-only publishing credential in environment secret `HOJA_QBANK_PUBLISH_TOKEN` (contents write and pull requests write; reading settings if supported). Never put credentials in source, GAS, or chat. Initially leave `HOJA_QBANK_AUTO_MERGE` unset. Enable only after protected PR checks are actually exercised, including a tampered pointer rejection. A separate authorized operator must configure repository settings; the current integration cannot.
4. The private release manifest `deployment/hoja15-remote-release.json` must be explicitly approved, not PENDING/DRAFT/TEST. Record every effective SHA, genuine renderer/question gate, and actual rights clearance or explicit rights acknowledgment under the existing policy. Teacher content approval is not rights clearance. Do not silently promote QA. Do not write a release manifest before required gates complete.

## Publication

Commit the final manifest on trusted private main; the workflow rebuilds from the approved tree, checks package SHA and bytes, and proposes a metadata-only PR. Merge via a merge commit only. Confirm `game-runtime/active/v1/current.json` is available on public main, its catalogCommit reachable from main, and catalog SHA and package commit exact. A repeat with no changed catalog is a no-op. If approved content is modified, generate canonical packages and update the manifest first. Existing unchanged effective pins may be carried forward; a changed SHA requires a new explicit approval.

## GAS rollout

Keep old production deployment and script properties/Sheets unchanged. Assemble a replacement in a separate directory with `--expected-units` taken from the exact release manifest. Install and test on an isolated GAS project; verify same existing student /exec URL and configured statistics spreadsheet, 00:15 rollup and original triggers remain untouched. Only enable `HOJA_REMOTE_CATALOG_ENABLED=1` after verified public pointer exists. Check LIST, a direct download, GAS relay, solo/team, QR join, ranking, telemetry and cache. Release gate: actual browser/game and GAS tests; offline render success does not substitute for them. Retain the old deployment and embedded verified catalog for explicit emergency rollback. Disable remote only with operator approval because embedded catalog may predate a withdrawal.

## Rollback / failure

A rollback is a newly verified release with a higher generation, not a lower pointer generation or force push. Do not publish a catalog with unapproved or withdrawn content. Remote reader uses 5-minute freshness and up to 6-hour verified fallback; fails closed after that. Two compressed property slots cap catalog storage; watch actual GAS property quotas shared with joins and telemetry. Browser package cache retains original 10 MiB / 90-day policies. A previously opened browser with a valid old LIST may hold old immutable bytes; sessions already in progress must not be silently swapped. A stale relay pin is rejected. For emergency withdrawal, old public Git history is still accessible; this is not a DRM or legal takedown mechanism.

## Evidence

- 29/899 exact approved-source and canonical runtime package rebuild, GAS assembly and isolated RPC integration PASS (45773372635).
- Four-viewports renderer test 899 × 4 = 3596 states: zero blank screens, JS errors and tested media failures (45772681662).
- Full 29/899 isolated publication rehearsal, no-op, missing approval/inventory, rights hold, wrong digest and tampered pointer rejection PASS (45774954646).
- Durable head-only refresh, corrupt-slot repair and quota-failure fallback regression PASS (45774436911 mock).
- Browser tests 45774124915 and 45774418130 are not yet certified as PASS; consult actual job results.
- Actual online GAS installation and live publication NOT done.

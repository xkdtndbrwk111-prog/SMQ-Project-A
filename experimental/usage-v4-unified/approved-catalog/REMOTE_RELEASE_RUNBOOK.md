# HOJA 1.5 remote catalog release — operator runbook

Status: candidate only. The exact 29/899 browser and renderer checks passed, but content/rights approval, protected publication, a live isolated GAS test, and production validation remain open. Do not enable or deploy until every release gate passes.

## One-time repository configuration

1. On HOJA-QUESTION-BANK, the independent publication gate PR #2 is merged (41ad722). Negative test PR #5 rejected the invalid pointer and was closed unmerged (45775564861). The canonical correction from PR #1 is already included in merged PR #4 (29 runtime packages); do not merge the obsolete PR #1. Science source PR #3 and runtime PR #4 are merged. Verify current runtime INDEX still matches the approved tree.
2. QBank main now reports `protected=true` with mandatory **Verify immutable catalog publication** in the branch API; the rule is configured for PRs. Confirm actual enforcement with a fresh non-merging PR after the rule was created. Prohibit direct writes/force pushes by publisher. Allow merge commits only; squash/rebase must be disabled because the immutable catalog commit must remain reachable. Do not allow the publisher to bypass branch protection.
3. SMQ-Project-A is now public. Its main branch reports `protected=true`, but its required status checks are currently empty. PR #12 adds a pathless `pull_request` trigger for the stable **verify-and-assemble** job; after that check appears on the PR, configure it as a required check and confirm enforcement. The environment `hoja-catalog-publication` is configured for main only and contains secret `HOJA_QBANK_PUBLISH_TOKEN`; its value is never exposed to source, GAS, logs, or chat. Confirm the token can read QBank settings and create a proposal branch/PR only through the trusted main workflow. Leave `HOJA_QBANK_AUTO_MERGE` unset. Enable it only after protected PR checks are exercised, including a tampered pointer rejection. Repository settings require an authorized operator.
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
- Actual Chromium 29/899 cache PASS (45776472795): all 29 entries retained after reload; 0 new downloads, relay calls, IDB errors, timeouts; 7,120,666 bytes. The subsequent UI stage timed out, so full browser certification remains pending. Independent solo/team/QR stages run 45777465979. Branch protection and live GAS remain unverified.
- Exact-runtime candidate workflow 45831227214 and 29/899 renderer rebuild 45831227193 completed successfully. Browser game/QR/cache 45829732431 passed on the pinned runtime. These are isolated CI tests, not a live GAS installation.
- 2026-11-26 API preflight: both main branches report `protected=true`; QBank requires **Verify immutable catalog publication**, while SMQ has no required checks. Public `current.json` is still absent. Actual enforcement and credential smoke remain unverified.
- Actual online GAS installation and live publication NOT done.

- 24c5803: current 29/899 pinned runtime bytes, isolated assembly and RPC, cache, actual SOLO Space jump and mouse answer with visible correct verdict, real balloon descendant pointer hit, second keyboard answer with visible wrong verdict, score and usage, TEAM and QR E2E all PASS (45829732431). Sweep 8/8 PASS. Both verdicts frame-visible. Remote candidate workflow 45829732243 PASS, but its renderer job covered older 27/835 runtime; corrected renderer workflow to pin exact 8d80945 and require 29/899. This is not live GAS or release authorization.
- Earlier 899 renderer PASS (45772681662) used a different runtime checkout; exact current runtime four-viewport rerun required before final gate.

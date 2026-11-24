# 40-6AS — isolated GAS connection: approval / execution boundaries and rollback (2026-11-24). Plan only, nothing executed.
Common to all steps: isolated test project + isolated write copy only (server code fail-closed: isolation flag, storage id !=
production/cert/ranking, copy canary). Never: production Project A/GAS/Sheets/EVENT_LOG/ranking, `main`, `versions/2.0.0`,
merge, real seal/trigger. IDs/tokens/URLs never committed or printed. Each step needs its own explicit approval.

## Recommended order
**R6 first (needs only ③ + a minimal push), then ① -> ② -> content check, ④ any time by the teacher.**
R6 does not need the new content: the isolated project's current remote bundle (R6, 2026-11-23) records legacy public starts.

| step | exactly what is done | who | rollback / undo | not reversible / risk |
|---|---|---|---|---|
| **R6 push (minimal)** | `clasp pull` full backup -> push the SAME remote files + updated test-only file (tail returns random test eventIds). No game/content change, no size risk (≈ current 7.3 MB) | Claude (clasp) | push the backup back; `clasp pull` byte-compare | none beyond the test project |
| **③ temporary anonymous test deployment + R6** | teacher creates a web-app deployment (execute as owner, anyone) in the editor; Claude runs `verify_real_gas_r6.py` (40 server-only burst + same-eventId re-send of failures + 40 real client starts + same eventId x3, fail-fast); teacher deletes the deployment; Claude confirms URL 404 | teacher deploy/delete, Claude run | delete deployment (URL 404) | test rows (≈ 80–100 random-eventId rows) stay in the isolated COPY (append-only, test-only sheet); acceptable, not production |
| **① QBank runtime publish** | one commit in HOJA-QUESTION-BANK adding ONLY `game-runtime/approved-packages/v1/` (23 JSON + INDEX, rebuild-identical, SHA-pinned); no change to approved sources; `active-deployment` stays 0 | Claude (git) after approval | `git revert`; nothing reads it until a catalog pins that commit | **public repo: a pushed commit stays fetchable by SHA even after revert. Media rights are HOLD 23/23 (9 images in one unit etc.) -> publishing needs an explicit rights decision first** |
| **② isolated push of the new release (8.73 MB, content via pinned GitHub)** | `clasp pull` backup -> `clasp push --force` of the release built with the real content commit + QA catalog allowing only the isolated script | Claude (clasp) | push the backup back; verify by `clasp pull` | size limit unknown between 7.31 MB (works) and 14.77 MB (refused); if refused, the remote stays unchanged (seen 11-23) -> then STOP and report, no data cutting |
| **④ Nov 23 real-record read-only audit** | teacher runs `hojaV4OpsStatus`, `hojaV4TestTailU3`, `hojaV4TestEvidenceU3` in the editor and pastes counts (no IDs) | teacher | nothing written | do NOT run `hojaV4OpsSealPendingDays`; no seal/trigger |

## What counts as success (no broader regression)
- R6: per-request accounting 0 acceptedButMissing / 0 failedButStored / 0 storedNotSent; re-send makes every failed id stored once;
  client 40 -> 40 unique rows, duplicates 0, watermark = last row, public +40. Server-only 40/40 is NOT required (19/40 stays a
  recorded FAIL); any accounting violation = critical FAIL.
- ①/②: content loads with SHA match in the isolated page; permission check: an anonymous caller cannot run ops functions.

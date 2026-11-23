# HOJA V4 40-6 — Project A/B isolated Apps Script test runbook

Date: 2026-11-23 (Asia/Seoul)
Status: GitHub branch staging only. NEVER install into the active Project A/B deployment.
Historical V4 copied-sheet data is validated by Google Sheets connector reads, NOT by running this GAS code.

## 0. Isolation and non-goals

- Both GAS projects must be new, separate test-only script projects.
- Never change the existing Project B getUsageStatisticsU2 API or Manager startup.
- Do not install a daily trigger, invoke a raw-delete function, change TOP25 ranking, or modify original EVENT_LOG.
- The source and destination spreadsheet IDs must be different. The copied spreadsheet must display HOJA_RETENTION_SANDBOX_V1 in _HOJA_USAGE_TRIAL_ONLY!A1.
- Do not record tokens, event IDs, student names, school identifiers, or the original spreadsheet ID in public GitHub or test logs.
- Existing production source is not present as a separate Project B GitHub repository. The actual authorization source must come from the existing B UsageU2.gs, not a made-up mock in live GAS.

## 1. Project A COPY-ONLY sandbox writer

Load these from the development branch into an isolated A GAS trial project:
- Code.gs (contains the original recordUsageStartU1 path plus the opt-in call)
- experimental/usage-retention/HOJA_USAGE_V4_APPEND_GUARD_TRIAL.gs

Script Properties (set manually; never commit values):
- SMQ_USAGE_SPREADSHEET_ID = COPIED usage spreadsheet ID
- HOJA_USAGE_TRIAL_SPREADSHEET_ID = same COPIED ID
- HOJA_USAGE_PRODUCTION_SPREADSHEET_ID = actual ORIGINAL ID (comparison only)
- HOJA_USAGE_V4_TRIAL_APPEND_GATE = COPIED_SHEET_ONLY

Before any append: confirm all 4 properties in that isolated GAS project; read the copy canary; check today's KST date; verify the source spreadsheet is the copy and not the original.

Use one valid PUBLIC cartridge sheet ID obtained from the existing public catalog (not a fabricated ID). Run recordUsageStartU1 on the isolated project with a fresh UUID eventId, repositoryKind PUBLIC, mode SOLO, teamCount 1, cartridgeCount 1, cartridgeIds containing that public ID. Confirm one 15-column U3S1 row appears in the copy today.

Repeat the exact eventId and original gameplay payload. Confirm duplicateIgnored=true and the copy EVENT_LOG row count is unchanged. Change team count/mode while keeping the same eventId; confirm HOJA_V4_APPEND_TRIAL_EVENT_ID_CONFLICT and no new row. Repeating the event ID after midnight must still be idempotent, not a new play (node mock has this regression; live midnight test NOT RUN).

Important: this guard intentionally performs a full eventId lookup on the COPY to establish correctness. It is NOT approved for high-volume production and must be replaced by a bounded, durable event-ID index before operational activation.

## 2. Project B isolated trial reader

Load the existing Project B authorization function requireUsageStatisticsAccessU3_ and its actual required dependencies into a distinct B GAS test project, with no Manager UI changes. Load:
- HOJA_USAGE_V4_CORE.js (as GAS-compatible source)
- HOJA_USAGE_V4_TRIAL_GAS.gs
- HOJA_USAGE_V4_LIVE_TAIL.js (as GAS-compatible source)
- HOJA_USAGE_V4_LIVE_TRIAL_GAS.gs

The B test project must point to the same COPIED spreadsheet and must also have the comparison-only ORIGINAL ID property. The _HOJA_USAGE_TRIAL_ONLY marker and the historical HOJA_V4_BACKFILL_AUDIT certificate must remain present.

With an existing authorized test OWNER/GOOGLE CREATOR session, call getUsageStatisticsU4TrialShadow. Expected:
- Authentication is performed BEFORE any sheet read.
- Historical days are read from HOJA_V4_DAILY_MANIFEST / HOJA_V4_DAILY_BUCKETS, checked against both SHA-256 digest fields and contiguous source row positions.
- EVENT_LOG is read only from the final certified sourcePrefixEndRow+1 to today's observed lastRow.
- Today's provisional rows are PUBLIC / U3S1 / valid ID and same KST date; incomplete or late rows throw instead of being treated as zero.
- Result includes preview with the existing U2 display contract, productionSwitchAllowed=false and rawDeletion=HOLD.
- Run U2 separately for visual comparison; two historical duplicate replays excluded in V4 explain the possible two-play total difference.

For the 2026-11-23 snapshot, the original copy-only baseline before new trial appends was history=17,670 unique plays, asOf 2026-11-23, today=0. This is NOT the real production live usage count. The runbook must be adjusted after each date rollover by certifying the previous day before retrying the U4 shadow.

## 3. Failure and concurrency matrix

Test these on isolated Apps Script engines and preserve only non-identifying execution results:

| Trial | Expected behavior |
| --- | --- |
| OWNER / valid current GOOGLE CREATOR | authorized lazy RPC |
| EDIT_CODE only, PENDING/BLOCKED, expired/revoked | deny before spreadsheet access |
| Same ID and same gameplay resent | no duplicate row |
| Same ID but different gameplay | fail closed |
| Appended row with a previously completed date | reject/report and HOLD |
| Missing/copied-sheet canary or matching original ID | reject before append/read |
| Summary missing one zero-use day or bad bucket hash | reject U4 query |
| Partial today row during append | reject rather than count zero |
| Simultaneous A append and B read | stable bounded result or explicit HOLD, never silently partial |
| Date change without yesterday COMPLETE | HOLD rather than infer missing 0 |

A's ScriptLock is not shared with B's other Apps Script project; do NOT use B ScriptLock as an atomic read cut. The current B before/after last-row check detects some races but is not proof of full linearizability. Reliable production append commit watermark requires a separate A-owned protocol.

## 4. Release gate / criteria for a new approval

- All A/B mock CI plus actual GAS execution log evidence PASS.
- Source row count, event ID uniqueness, date monotonicity and daily COMPLETE are verified on the same isolated source.
- Explicit check of all U2 interface fields: totals today/7/30/all, daily, mode, team size, repository, grade, subject, publisher and combined-title TOP20.
- Owner/creator revocation and non-owner denials verified in actual Project B.
- Event-index performance, day sealing, backup/restore and concurrent reader consistent-cut validated.
- Separate operator approval for every migration and later for raw retention; no automatic deletion is provided here.

Release status: HOLD. Production Project A/B and original spreadsheet remain unchanged.

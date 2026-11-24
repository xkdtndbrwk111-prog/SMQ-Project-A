# 40-6AQ — 23-unit runtime packages + isolated GAS prerequisites (2026-11-24). Preparation only: NOTHING executed on GAS.
## Runtime packages (offline, `audit_runtime_packages.py`) — LOCAL PASS
- source `xkdtndbrwk111-prog/HOJA-QUESTION-BANK@9573f91`; INDEX schema `hoja-game-runtime-packages-v1`; INDEX sourceCommit =
  approved-source-index = active-deployment sourceCommit.
- 23 units / 732 questions; every package byte length + SHA-256 == INDEX; package cartridgeId and question count == index entry;
  no unlisted files. Rebuilt from the clean pinned checkout: INDEX identical (23/23 sha+bytes).
- media: 1 unit carries a media overlay; media rights **HOLD for 23/23** (deployment gate needs CLEARED or acknowledged).
- `active-deployment.json` entries **0**; gameDeployment NOT_DEPLOYED.
- NOT DONE: packages are NOT published to the QBank repo (`game-runtime/approved-packages/v1/` + a real 40-hex content commit);
  the browser/GAS pin still uses the test placeholder commit. Publishing = QBank runtime posting = **approval required**.
## Isolated GAS — prerequisites (state, not run)
| gate | state |
|---|---|
| bundle size | release 8 files 8 733 735 B (Game.html 8 631 223 B); QA lite 8 749 959 B. **F4-SIZE-GATE OPEN**: an Apps Script save of this size was never attempted; an earlier full push was refused "too large" and left the remote unchanged |
| content source | `GITHUB_RAW_PINNED_V1` needs the published packages + real content commit (above) |
| storage | isolated copy spreadsheet only (`SMQ_USAGE_SPREADSHEET_ID` != production public id is enforced by code); 61-day copy reverify PASS on 11-23 |
| R6 rerun | template tail eventIds + verifier per-request accounting prepared (40-6AP); requires pushing the test-only file |
| auto-seal | code disabled by default (`HOJA_V4_AUTO_SEAL` unset); no trigger code |
| R7 | Nov 23 real-record audit NOT RUN (operator); real midnight NOT RUN |
## Approvals needed before ANY of these (each separately)
1. QBank: publish 23 runtime packages + INDEX at a real commit (QBank runtime posting/activation).
2. Isolated GAS push of the release + test-only file (incl. the size attempt) — isolated project only, not production.
3. Anonymous test web-app deployment (time-boxed, deleted after) for R6 / UI checks.
4. Real-record audit (Nov 23) by the operator; real seal / trigger installation — still forbidden until approved.
Never: production Project A / GAS / Sheets / EVENT_LOG / ranking, `main`, `versions/2.0.0`, PR merge.

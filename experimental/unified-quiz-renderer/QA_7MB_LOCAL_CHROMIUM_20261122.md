# HOJA 7MB unified renderer — restored source / isolated local browser QA
Date: 2026-11-22 (Asia/Seoul)

## Source identity
- Prior Library file: `붙여넣은 텍스트(1)(20261120-012758).txt` (7,214,224 bytes; CRLF).
- After CRLF→LF: 7,208,766 bytes; SHA-256 `4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6`.
- Exactly matches `versions/2.0.0/README.md` snapshot. Original game was not changed.
- Local isolated HTML: approved renderer HTML + team-side adapter and canonical social6 QA data supplied **only from test harness**.
- Local test HTML SHA-256 `2a21a12954689d3940f8aa8370e876f28a8b5a9be2372a10ee6789f6dee138df`, 8,554,745 bytes, not a GAS deployment, not identical to the branch's separate `game-trial/part-22.txt` assembly.

## Observed Chromium tests (not GAS)
- PASS: team board rendered at 1280×800; team mode launched using synthetic version-2 sources constructed from the canonical social6 64-question data.
- PASS: opening a balloon presented the teacher-approved iframe. SHORT answer reveal + teacher incorrect verdict → unchanged team board → next team.
- PASS: subsequent MCQ displayed exactly three choices; one canonical alternative omitted.
- PASS: 2-team staged final screen (base → answer bonus → bingo bonus → winner), then wrong-answer review → correct review → return to final actions. Pre/post team scores and original `state.done` records equal.
- PARTIAL: 7-team staged final skips bingo bonus, winner screen presents wrong-answer review entry, and review question appears. Final review completion not verified due timeout.
- NOTE: the test intentionally called a QA-only `showFinal()` hook after initial rounds; it does **not** establish a natural full 24-turn or 21-turn completion.
- BLOCKER: external Phaser JS cannot load in this offline Chromium environment (page errors `Phaser is not defined`, `HojaSharedScene is not defined`). Team logic exercised while arcade dependency was unavailable; no solo-arcade success claim.
- NOT RUN: actual `game-trial/build_trial.py` remote-branch byte-equivalent HTML, online GAS test instance, multiplayer/classroom hardware, rank writes, full 64×3 screenshot pixels.

## Safety and next actions
- `main`, `versions/2.0.0/Game.html.parts`, and GAS production remain unchanged.
- The current production-like `Code.gs` does not return `rendererQuestion/images/tags/unitMeta`. The team trial therefore intentionally fails closed without synthetic approved sources. Prioritize a test-only embedded canonical loader with provenance and approved ZIP integrity before calling this game integrated.
- Next: verify branch trial builder produces runnable HTML and QA the exact branch output, then add approved loader and connect both solo modes; run GAS only after isolated trial is stable.

# Solo quiz teacher renderer browser QA — 2026-11-22
- Modified trial `part-14.txt` only; original `versions/2.0.0`, `main` unchanged.
- Prior part-14 blob `b229f42480c6a03888691d2826bd2c30b7275a39` → new `5533a58e849f070023e35a2a3d245775341b8469`; identical to Chromium-tested local part14 bytes.
- Normalizer preserves canonical rendererQuestion/media/tags and 4-to-3 selection source indices; solo SHORT excluded (56 MC/OX).
- O/X display normalized to approved O first/X second; original shuffle RNG calls preserved. Scores/counters remain game-owned.
- Local restored full Game HTML + previously validated team trial code in Chromium at 1280×800: first balloon -> approved 3-choice question -> choose -> answered/correct counters -> close -> second balloon -> second approved 3-choice question (PASS).
- Offline Phaser missing: `Phaser is not defined` and `HojaSharedScene is not defined`; arcade is not verified.
- This local team HTML base is not verified as bit-for-bit equal to the complete 25-part GitHub branch assembly. This is a partial browser test, NOT entire 56-question playthrough, NOT GAS deploy or production play.
- Still required: OX click correctness, replay/exit, 56 question result, team+solo smoke on exact branch assembly, single arcade bridge, GAS test project.

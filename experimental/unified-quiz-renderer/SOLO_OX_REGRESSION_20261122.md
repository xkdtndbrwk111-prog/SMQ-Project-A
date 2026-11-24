# Solo quiz OX regression — 2026-11-22

Source: GitHub staged trial part-14 blob `5533a58e849f070023e35a2a3d245775341b8469`; local team+solo full-game test copy SHA-256 `e841d31fed47e363b004397c1324326d0fe6a9653f0625853f52fb923eafb0f3`.

Local headless Chromium 1280x800 with social6 approved 64-question test bank. QA-only instrumentation rearranged the existing 56-item quiz deck to put an OX item next; **no runtime patch and no game original modifications were needed**. Both cases used the real balloon click handler, the approved iframe, and game-owned answer counters.

- PASS OX question `s6u32:q25`: true → correct; `answered` 0→1, `correct` 0→1; two approved O/X buttons in order `true, false`.
- PASS OX question `s6u31:q24`: expected false, clicked true; `answered` 1→2, `correct` remains 1; returned to balloon screen.
- Shared iframe reused between questions; trial-only parent DOM error did not recur.
- Existing offline Phaser load errors remain unrelated; arcade gameplay still NOT VERIFIED.

These two OX samples and previous two MC3 samples do **not** establish an entire 56-question run, exact rebuilt GitHub full HTML browser parity, mobile or GAS execution.

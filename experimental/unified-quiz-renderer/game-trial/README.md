# HOJA 7MB unified renderer trial copy (NOT GAS deployed)

- Original snapshot: `versions/2.0.0/Game.html.parts/part-01..25.txt` (unchanged).
- Trial snapshot: these 25 files; only part-22 is modified. Restore with `build_trial.py` so the original approved renderer HTML is injected as a JS string at the placeholder. Do not concatenate manually.
- Original A/C/D layout, image handling and fit algorithms reside exclusively in `../HOJA_APPROVED_RENDERER_BRIDGE.html`.
- Team question screens use the iframe host; legacy renderer path is unreachable under the trial runtime.
- Team missing canonical `rendererQuestion/images/tags/unitMeta` fails closed, because current `Code.gs` does not yet supply those fields.
- Winner presentation is followed by an opt-in wrong-answer review; scoring is not touched by review.
- **Not yet tested with actual GAS nor complete browser gameplay; single arcade and solo quiz still pending.**

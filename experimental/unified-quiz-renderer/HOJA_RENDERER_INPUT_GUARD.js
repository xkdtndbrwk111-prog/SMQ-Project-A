/* HOJA shared A/C/D renderer — F3-3 input guard v2 (40-6V/40-6W), appended LAST after the
 * unchanged bridge by compose_renderer.mjs. Identity-based: NO time window.
 *
 * Race found by ID-only event capture: after a `load` command the bridge draws its DEFAULT first
 * question (clickable) and ~30 ms later the game's `show` replaces it. A fast tap could therefore
 * act on a question that is not the game's, or be released on a different, freshly drawn choice.
 *
 * Rules — a disallowed tap is BLOCKED (dropped, never scored as wrong); answer/scoring code untouched:
 *   1. from a `load` command until the game's `show` has been drawn, choices are hidden and inert;
 *   2. a tap counts only if its press and its release hit the SAME button of the SAME drawn question
 *      (the screen did not change under the finger);
 *   3. a button stamped for a different question than the one currently drawn is inert.
 * (A "consume after first answer" rule was tried and REMOVED: the guard cannot see whether the host
 *  accepted a tap, so a tap the host dropped would have locked the student out of that question.
 *  Taps on a previous question while the overlay re-opens are already dropped by the host, which only
 *  accepts answers whose questionId equals the active question.)
 * Keyboard shortcuts (no pointer press) are checked by rule 1 and 3 only. Every drawn choice button
 * of the current question is usable immediately — there is no settle delay.
 * window.HOJA_RENDERER_INPUT_GUARD.blocked counts dropped taps (diagnostics). */
(function () {
  'use strict';
  if (window.HOJA_RENDERER_INPUT_GUARD) return;
  let awaitingShow = false, drawnId = null, drawGen = 0, blocked = 0;
  let press = null; // {button, gen}
  const style = document.createElement('style');
  style.id = 'hojaInputGuardStyle';
  style.textContent = 'body.hojaAwaitShow #hqChoices{visibility:hidden!important}';
  document.head.append(style);
  const setAwait = v => { awaitingShow = v; document.body.classList.toggle('hojaAwaitShow', v); };
  // Registered after the bridge's listener, so it runs after load/show have been rendered.
  window.addEventListener('message', ev => {
    const d = ev.data;
    if (ev.source !== parent || !d || d.type !== 'HOJA_UNIFIED_COMMAND') return;
    if (d.action === 'load') setAwait(true);
    else if (d.action === 'show') setAwait(false);
  });
  const baseRender = renderQuestion; // eslint-disable-line no-undef
  renderQuestion = function () { // eslint-disable-line no-global-assign
    baseRender();
    try { drawnId = current().id; } catch (e) { drawnId = null; } // eslint-disable-line no-undef
    drawGen++;
    for (const b of document.querySelectorAll('#hqChoices button')) { b.dataset.hojaQid = drawnId || ''; b.dataset.hojaGen = String(drawGen); }
  };
  const choiceButton = t => (t && t.closest ? t.closest('#hqChoices button') : null);
  const block = ev => { ev.stopImmediatePropagation(); ev.preventDefault(); blocked++; };
  window.addEventListener('pointerdown', ev => {
    const b = choiceButton(ev.target);
    press = b ? {button: b, gen: drawGen} : null;
  }, true);
  // window capture runs before the bridge's document-level capture click handler.
  window.addEventListener('click', ev => {
    if (!window.HOJA_APPROVED_RENDERER_CAPTURE) return;
    const b = choiceButton(ev.target);
    if (!b) return;
    let cur = null; try { cur = current().id; } catch (e) {} // eslint-disable-line no-undef
    if (awaitingShow) return block(ev);                                            // rule 1
    if (b.dataset.hojaQid !== undefined && b.dataset.hojaQid !== cur) return block(ev); // rule 3
    if (ev.detail > 0) {                                                            // pointer tap (not keyboard)
      const p = press; press = null;
      if (!p || p.button !== b || p.gen !== drawGen) return block(ev);              // rule 2
    }
  }, true);
  window.HOJA_RENDERER_INPUT_GUARD = Object.freeze({version: 2, get blocked() { return blocked; }, get awaitingShow() { return awaitingShow; }});
})();

/* HOJA shared A/C/D renderer — F1-B optional media[] extension (v1).
 * Appended AFTER the unchanged HOJA_APPROVED_RENDERER_BRIDGE.html script by compose_renderer.mjs.
 * Questions WITHOUT `media` are untouched: the original renderQuestion() runs alone and its
 * DOM is identical (verified per question). Questions WITH `media` (approved source order)
 * get every item shown: two or more images (e.g. an approved image overlay pair) side by
 * side with their approved captions, or a structured frequency chart. No image is merged,
 * dropped or substituted, and nothing here touches answers, scoring or capture. */
(function () {
  'use strict';
  if (window.HOJA_RENDERER_MEDIA_EXT) return;
  const style = document.createElement('style');
  style.id = 'hojaMediaExtStyle';
  // Sizing comes from the bridge's OWN classes (imageCompare for two materials, imageWide otherwise);
  // this sheet only lays out the items inside that box and gives them readable ink.
  style.textContent =
    '#hqMedia.hojaMediaSet{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:calc(12px * var(--u,1px))}' +
    '#hqMedia.hojaMediaSet>figure{margin:0;display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;box-sizing:border-box;' +
    'border:calc(2px * var(--u,1px)) solid #9fb0bf;border-radius:calc(10px * var(--u,1px));padding:calc(4px * var(--u,1px));background:#fff;color:#1f2d3a}' +
    '#hqMedia.hojaMediaSet>figure>figcaption{flex:0 0 auto;font-weight:800;font-size:calc(15px * var(--u,1px));text-align:center;' +
    'line-height:1.25;color:#1f2d3a;margin-bottom:calc(3px * var(--u,1px))}' +
    '#hqMedia.hojaMediaSet>figure>img{flex:1 1 0;min-height:0;width:100%;height:auto;object-fit:contain}' +
    '.hojaFreq{flex:1 1 0;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:calc(6px * var(--u,1px));align-content:center}' +
    '.hojaFreq>div{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(4px * var(--u,1px));' +
    'border:calc(2px * var(--u,1px)) solid #9fb0bf;border-radius:calc(8px * var(--u,1px));padding:calc(10px * var(--u,1px)) 0;' +
    'font-weight:800;font-size:calc(22px * var(--u,1px));color:#1f2d3a}.hojaFreq>div>b{font-size:1.3em;line-height:1}';
  document.head.append(style);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const original = renderQuestion; // eslint-disable-line no-undef
  renderQuestion = function () { // eslint-disable-line no-global-assign
    delete document.getElementById('hqMedia').dataset.mediaCount; // never leak into the next question
    original();
    const q = current(); // eslint-disable-line no-undef
    if (!q || !Array.isArray(q.media) || !q.media.length) return;
    const media = document.getElementById('hqMedia');
    media.replaceChildren();
    const imageCount = q.media.filter(m => m.kind === 'image').length;
    media.className = (imageCount > 1 ? 'imageCompare' : 'imageWide') + ' hojaMediaSet';
    media.hidden = false;
    media.dataset.mediaCount = String(q.media.length);
    for (const m of q.media) {
      const fig = el('figure');
      fig.dataset.kind = m.kind;
      if (m.label) fig.append(el('figcaption', '', m.label));
      if (m.kind === 'image') {
        const im = new Image();
        im.src = IMAGES[m.asset]; // eslint-disable-line no-undef
        im.alt = m.alt || '학습용 자료';
        im.onload = () => fitContent(); // eslint-disable-line no-undef
        fig.append(im);
      } else if (m.kind === 'frequency') {
        if (m.period) fig.append(el('figcaption', '', m.period));
        const grid = el('div', 'hojaFreq');
        grid.style.setProperty('--n', String(m.labels.length));
        grid.setAttribute('role', 'table');
        m.labels.forEach((label, i) => {
          const cell = el('div');
          cell.setAttribute('role', 'cell');
          cell.setAttribute('aria-label', label + (m.marks[i] ? ' 했음' : ' 안 했음'));
          cell.append(el('span', '', label), el('b', '', m.marks[i] ? '●' : '○'));
          grid.append(cell);
        });
        fig.append(grid);
      } else {
        throw new Error('RENDER_MEDIA_KIND_UNSUPPORTED');
      }
      media.append(fig);
    }
    document.getElementById('hqQuestionArea').classList.add('has-picture');
    fitContent(); // eslint-disable-line no-undef
  };
  window.HOJA_RENDERER_MEDIA_EXT = Object.freeze({version: 1});
})();

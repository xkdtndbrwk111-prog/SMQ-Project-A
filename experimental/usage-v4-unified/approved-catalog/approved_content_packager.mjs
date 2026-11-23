/**
 * F1 — approved CONTENT packages for the game (BUILD TIME ONLY).
 *
 * For every unit of the approved-source index, find the TEACHER-APPROVED renderer
 * data the shared A/C/D renderer (HOJA_APPROVED_RENDERER_BRIDGE) consumes, by the
 * source's declared fields (never by unit name):
 *   unit manifest .reviewedPresentation  (repo path "approved/..." or ZIP entry)
 *   bundle manifest .approvedPresentation (repo path next to the manifest)
 *   ZIP release/approval.json .display    (ZIP entry)
 * The presentation must carry renderer-v2 data (DATA_ORIGINAL / DATA_CONCISE /
 * IMAGES, optional UNIT_META / HOJA_RENDER_TAGS). Each unit is then cross-checked
 * against the approved effective content (ids, types, choice ids, answer keys,
 * image presence) and fails closed on any disagreement. Units whose approved
 * display cannot be represented losslessly by that renderer (e.g. two images in
 * one question) are BLOCKED with a reason — never converted by guesswork.
 *
 * Package shape = the existing embedded-trial contract (gas-test/HOJA_QB_UNIT_*.gs):
 * {questionSchemaVersion:2, sourceSheetVersion:2, cartridgeId, unitId,
 *  questions:[{familyId,question,answer,type,options,explanation,rendererQuestion,originalQuestion}],
 *  images, tags, unitMeta}
 */
import {readZip, sha256} from './zip_reader.mjs';

const fail = code => { throw new Error('HOJA_APPROVED_CONTENT_' + code); };
const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);

/* Extract `const NAME = <JSON literal>` from an HTML/JS source without eval. */
export function extractConst(text, name) {
  const re = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*');
  const m = re.exec(text);
  if (!m) return undefined;
  let i = m.index + m[0].length;
  const open = text[i];
  if (open !== '{' && open !== '[') return undefined;
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) {
      if (c !== close) fail('CONST_BRACKETS:' + name);
      try { return JSON.parse(text.slice(i, j + 1)); } catch { fail('CONST_NOT_JSON:' + name); }
    } }
  }
  fail('CONST_UNTERMINATED:' + name);
}

const RENDER_TYPE = {MCQ: 'MULTIPLE', OX: 'OX', SHORT: 'SUBJECTIVE'};
/* renderer item -> legacy game row (same mapping as gas-test/HOJA_QB_UNIT_S6U31.gs) */
export function gameRow(concise, original) {
  const type = RENDER_TYPE[concise.type];
  if (!type) fail('TYPE:' + concise.id);
  let answer, options;
  if (concise.type === 'MCQ') {
    options = concise.choices.map(c => c.text);
    const k = concise.choices.findIndex(c => c.id === concise.answer?.choiceId);
    if (k < 0) fail('MCQ_ANSWER_NOT_IN_CHOICES:' + concise.id);
    answer = String(k + 1);
  } else if (concise.type === 'OX') {
    if (typeof concise.answer?.value !== 'boolean') fail('OX_ANSWER:' + concise.id);
    options = ['O', 'X']; answer = concise.answer.value ? 'O' : 'X';
  } else {
    if (typeof concise.answer?.text !== 'string' || !concise.answer.text.trim()) fail('SHORT_ANSWER:' + concise.id);
    options = []; answer = concise.answer.text;
  }
  return {familyId: concise.group || concise.id, question: concise.prompt, answer, type, options,
    explanation: concise.explanation, rendererQuestion: concise, originalQuestion: original};
}

function effectiveFacts(q) {
  // count image blocks in the approved effective qb1 question
  let images = 0;
  const walk = v => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') {
    if (v.kind === 'image') images++; Object.values(v).forEach(walk); } };
  walk(q.content || []);
  let choiceImages = 0;
  for (const c of q.choices || []) { const n0 = images; walk(c.content || []); choiceImages += images - n0; images = n0; }
  return {type: q.type, choiceIds: (q.choices || []).map(c => c.id).sort(), answer: q.answer, images, choiceImages};
}

/* approved presentation display scripts -> shared-renderer extension profile (see unified-quiz-renderer/) */
const DISPLAY_PROFILES = {'math-reviewfix1-ui4': ['hoja-math-priority-and-notation-v1', 'hoja-math-teacher-final-wrap-v4']};
const scriptIds = text => [...text.matchAll(/<script id="([^"]+)"/g)].map(m => m[1]);
/* Teacher layout decisions shipped in the unit ZIP (presentation/layout-preferences.json),
 * interpreted by their declared schemaVersion only. Applied to / checked against the tags. */
function applyLayoutPreferences(pref, tags, conc, presText, where) {
  const byQid = new Map(conc.map(q => [q.questionId, q.id])), ids = new Set(conc.map(q => q.id));
  const out = {schema: pref.schemaVersion, teacherC: 0, verifiedFixed: 0, choiceWrap: {}};
  if (pref.schemaVersion === 'hoja-math-presentation-v1') {
    const m = /const\s+teacherCLayoutIds\s*=\s*new Set\((\[[^\]]*\])\)/.exec(presText);
    if (!m) fail('TEACHER_C_NOT_IN_PRESENTATION:' + where);
    const inHtml = new Set(JSON.parse(m[1]).filter(id => ids.has(id)));
    const listed = new Set(pref.teacherCPreferred || []);
    if (inHtml.size !== listed.size || [...listed].some(id => !inHtml.has(id))) fail('TEACHER_C_DISAGREES:' + where);
    for (const id of listed) {
      if (!tags[id] || !tags[id].layout) fail('TEACHER_C_TAG_MISSING:' + id);
      tags[id].layout.preferredLayout = 'C';                       // exactly what the approved HTML does
      tags[id].layout.selectionBasis = '2026-11-22 teacher review: C layout';
      out.teacherC++;
    }
    for (const [id, how] of Object.entries(pref.choiceWrap || {})) {
      if (!ids.has(id)) fail('CHOICE_WRAP_UNKNOWN:' + id);
      out.choiceWrap[id] = String(how);
    }
  } else if (pref.schemaVersion === 'hoja-layout-preferences-v1') {
    for (const [qid, f] of Object.entries(pref.fixed || {})) {
      const id = byQid.get(qid), t = id && tags[id] && tags[id].layout;
      if (!t || t.preferredLayout !== f.family || (f.rendererHint && t.rendererHint !== f.rendererHint))
        fail('FIXED_LAYOUT_DISAGREES:' + qid);
      out.verifiedFixed++;
    }
  } else fail('UNKNOWN_LAYOUT_PREFERENCES_SCHEMA:' + where);
  return out;
}

/* ------------------------- F1-B version-identified adapters ------------------------- */
const MIME = {webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml'};
const dataUri = (name, buf) => 'data:' + (MIME[String(name).split('.').pop().toLowerCase()] || fail('MIME:' + name)) + ';base64,' + buf.toString('base64');
/* content blocks (qb1 effective / presentation v3 / display overlay) -> renderer-v2 fields.
 * Text blocks join with "\n" (the renderer-v2 multi-line prompt convention). One image -> `image`
 * (unchanged single-image contract). Two+ images or a structured block -> additionally `media[]`
 * in source order (rendered by the shared renderer's media extension). Unknown kinds -> unsupported. */
export function blocksToV2(blocks, imgKey) {
  const texts = [], images = [], dialogues = [], extra = [];
  for (const b of blocks || []) {
    if (b.kind === 'text') texts.push(String(b.text));
    else if (b.kind === 'image') images.push({kind: 'image', asset: imgKey(b.src), alt: String(b.alt || ''), src: b.src});
    else if (b.kind === 'dialogue') dialogues.push((b.lines || []).map(l => ({speaker: String(l.speaker), text: String(l.text)})));
    else if (b.kind === 'frequency') extra.push({kind: 'frequency', period: String(b.period || ''), labels: (b.labels || []).map(String), marks: (b.marks || []).map(Boolean)});
    else return {unsupported: String(b.kind)};
  }
  if (dialogues.length > 1) return {unsupported: 'multiple-dialogue'};
  const out = {prompt: texts.join('\n'), image: images[0] ? images[0].asset : null, imageAlt: images[0] ? images[0].alt : '',
    dialogue: dialogues[0] || null};
  if (images.length > 1 || extra.length) out.media = [...images, ...extra].map(({src, ...m}) => m);
  out._imageSrcs = images.map(i => i.src);
  return out;
}
function choicesToV2(choices, imgKey, key) {
  return (choices || []).map(c => {
    const bl = c[key] || [];
    if (bl.length === 1 && bl[0].kind === 'text') return {id: c.id, text: String(bl[0].text), image: null, imageAlt: ''};
    if (bl.length === 1 && bl[0].kind === 'image') return {id: c.id, text: '', image: imgKey(bl[0].src), imageAlt: String(bl[0].alt || '')};
    return {unsupported: c.id};
  });
}
const stripPriv = q => { delete q._imageSrcs; return q; };
/* Full-shape render tag DERIVED from an approved layout field (NOT a teacher-approved render tag):
 * the shared renderer's tag consumers need images/texts/constraints/layout; values beyond the
 * approved layout decision are neutral defaults, flagged needsHumanReview. */
function derivedTag(q, preferredLayout, basis, extra = {}) {
  const imgs = q.media ? q.media.filter(m => m.kind === 'image').map(m => m.asset) : (q.image ? [q.image] : []);
  return {schemaVersion: 'hoja-derived-layout-v1', questionId: q.id, questionType: q.type,
    images: imgs.map(a => ({asset: a, position: 'question', kind: 'general', subtype: 'scene', needsFineDetail: false, priority: 'normal'}))
      .concat(q.choices.filter(c => c.image).map(c => ({asset: c.image, position: 'choice', kind: 'general', subtype: 'scene', needsFineDetail: false, priority: 'normal'}))),
    texts: ['question', ...(q.dialogue ? ['dialogue'] : []), ...(q.type === 'MCQ' ? ['choices'] : [])],
    constraints: {speakerTurnsVertical: false, preserveOriginalText: true, minimumImageDetail: 'normal',
      elementPriority: {question: 'high', reading: 'low', dialogue: q.dialogue ? 'medium' : 'low', image: imgs.length ? 'medium' : 'low', choices: 'medium'}},
    layout: {recommendedFamily: 'derived', preferredLayout: String(preferredLayout), rendererHint: null, selectionBasis: basis, ...extra},
    confidence: 'derived', needsHumanReview: true, evidence: [basis]};
}
/* approved presentation v3 (const DATA/MEDIA/NAMES) + release/media-overlay.json */
function adaptPresentationV3(p, e, outerZip, nestedZip, effAccepted) {
  const items = p.v3data.filter(q => q.unit === e.cartridgeId);
  const imgKey = s => e.cartridgeId + '/' + s;
  const images = {}, tags = {}, notes = [];
  const add = (k) => { const uri = p.v3media[k]; if (typeof uri !== 'string') fail('V3_MEDIA_MISSING:' + k); images[k] = uri; };
  const qs = items.map(it => {
    const v = blocksToV2(it.blocks, imgKey);
    if (v.unsupported) fail('V3_BLOCK_UNSUPPORTED:' + v.unsupported + ':' + it.id);
    // v3 display splits the approved text block into prompt + stimulus; the text block itself is the source.
    const joined = it.stimulus ? [it.prompt + '\n' + it.stimulus, it.prompt + '\n\n' + it.stimulus] : [it.prompt];
    if (!joined.includes(v.prompt)) fail('V3_PROMPT_BLOCK_DISAGREES:' + it.id);
    const choices = choicesToV2(it.choices, imgKey, 'blocks');
    if (choices.some(c => c.unsupported)) fail('V3_CHOICE_UNSUPPORTED:' + it.id);
    choices.forEach((c, i) => { if (c.text && c.text !== it.choices[i].text) fail('V3_CHOICE_TEXT_DISAGREES:' + it.id); });
    const q = {id: it.id, localId: it.id.split(':')[1], questionId: it.id, unit: e.cartridgeId, type: it.type, ...v, choices,
      answer: it.answer, explanation: it.answerText, accepted: effAccepted(it.id), source: '', group: null};
    for (const k of [q.image, ...(q.media || []).filter(m => m.kind === 'image').map(m => m.asset), ...choices.map(c => c.image)].filter(Boolean)) add(k);
    q._layout = it.layout;
    return q;
  });
  let overlay = null;
  if (outerZip.has('release/media-overlay.json')) {
    const raw = outerZip.json('release/media-overlay.json');
    for (const o of Array.isArray(raw.overlays) ? raw.overlays : [raw]) {
      if (o.unit !== e.cartridgeId) continue;
      const q = qs.find(x => x.questionId === o.questionId);
      if (!q) fail('OVERLAY_QUESTION_MISSING:' + o.questionId);
      if (o.answerId && q.answer?.choiceId !== o.answerId) fail('OVERLAY_ANSWER_DISAGREES:' + o.questionId);
      const imgs = q.media ? q.media.filter(m => m.kind === 'image') : [{asset: q.image}];
      (o.replace || []).forEach((r, i) => {
        const slot = q._imageSrcs.indexOf(r.source);
        if (slot < 0 || !nestedZip.has(r.source)) fail('OVERLAY_SOURCE_NOT_IN_QUESTION:' + r.source);
        if (!outerZip.has(r.presentation)) fail('OVERLAY_PRESENTATION_MISSING:' + r.presentation);
        const key = e.cartridgeId + '/overlay/' + r.presentation.split('/').pop();
        images[key] = dataUri(r.presentation, outerZip.read(r.presentation));
        const m = imgs[slot];
        if (q.image === m.asset && slot === 0) q.image = key;
        m.asset = key;
      });
      (o.displayCardLabels || []).forEach((label, i) => { if (imgs[i]) imgs[i].label = String(label); });
      // the overlay's doNotDisplay answer cues must not appear in anything shown before answering
      for (const d of o.doNotDisplay || []) {
        const cue = String(d).replace(/\s*\([^)]*\)\s*$/, '').trim();
        const shown = [q.prompt, ...imgs.map(m => m.label || ''), ...imgs.map(m => m.alt || ''), ...q.choices.map(c => c.text)];
        if (cue && shown.some(t => t.includes(cue) && !q.choices.some(c => c.text === t))) fail('OVERLAY_DO_NOT_DISPLAY_VISIBLE:' + o.questionId);
      }
      overlay = {questionId: o.questionId, replaced: (o.replace || []).length, labels: (o.displayCardLabels || []).length,
        doNotDisplay: o.doNotDisplay || [], overlaySha256: sha256(outerZip.read('release/media-overlay.json'))};
      notes.push('OVERLAY_APPLIED_FROM_RELEASE_MEDIA_OVERLAY_JSON');
    }
  }
  for (const k of Object.keys(images)) if (!qs.some(q => [q.image, ...(q.media || []).map(m => m.asset), ...q.choices.map(c => c.image)].includes(k))) delete images[k];
  qs.forEach(stripPriv);
  for (const q of qs) { tags[q.id] = derivedTag(q, q._layout, 'approved presentation v3 layout field'); delete q._layout; }
  const name = p.v3names && p.v3names[e.cartridgeId];
  if (typeof name !== 'string' || !name.includes(' · ')) fail('V3_UNIT_NAME_MISSING:' + e.cartridgeId);
  const [label, ...rest] = name.split(' · ');
  return {original: qs, concise: JSON.parse(JSON.stringify(qs)), images, tags,
    unitMeta: {[e.cartridgeId]: {label, title: rest.join(' · '), count: qs.length}}, overlay, notes,
    adapter: 'presentation-v3', renderTagsSource: 'DERIVED_FROM_APPROVED_V3_LAYOUT', unitMetaSource: 'APPROVED_PRESENTATION_V3_NAMES'};
}
/* approved display overlay (display/presentation.json, hoja-presentation-overlay-v1) over effective qb1 */
function adaptDisplayOverlay(e, zip) {
  const ov = zip.json('display/presentation.json');
  if (ov.schema !== 'hoja-presentation-overlay-v1' || ov.cartridgeId !== e.cartridgeId) fail('OVERLAY_SCHEMA:' + e.cartridgeId);
  const cart = zip.json('effective/cartridge.json');
  if (ov.sourceRevision != null && Number(ov.sourceRevision) !== Number(cart.revision)) fail('OVERLAY_REVISION_DISAGREES:' + e.cartridgeId);
  const byQ = new Map(ov.entries.map(x => [x.questionId, x]));
  if (byQ.size !== cart.questions.length || cart.questions.some(q => !byQ.has(q.questionId))) fail('OVERLAY_COVERAGE:' + e.cartridgeId);
  const unitId = e.cartridgeId, imgKey = s => e.cartridgeId + '/' + s;
  const images = {}, tags = {}, notes = [];
  let fromDisplay = 0;
  const addImg = src => {
    const k = imgKey(src);
    const d = 'display/' + src, f = 'effective/' + src;
    const path = zip.has(d) ? d : zip.has(f) ? f : fail('OVERLAY_IMAGE_MISSING:' + src);
    if (path === d) fromDisplay++;
    images[k] = dataUri(src, zip.read(path));
  };
  const mk = (q, blocks, choices, ck) => {
    const v = blocksToV2(blocks, imgKey);
    if (v.unsupported) fail('OVERLAY_BLOCK_UNSUPPORTED:' + v.unsupported + ':' + q.questionId);
    const ch = q.type === 'MCQ' ? choicesToV2(choices, imgKey, ck) : [];
    if (ch.some(c => c.unsupported)) fail('OVERLAY_CHOICE_UNSUPPORTED:' + q.questionId);
    const lid = q.questionId.split(':')[1];
    return stripPriv({id: unitId + ':' + lid, localId: lid, questionId: q.questionId, unit: unitId, type: q.type, ...v, choices: ch,
      answer: q.answer, explanation: q.explanation || '', accepted: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.map(String) : [],
      source: '', group: q.groupId || null});
  };
  const original = [], concise = [];
  for (const q of cart.questions) {
    const d = byQ.get(q.questionId);
    if (d.reviewedByTeacher !== true) fail('OVERLAY_ENTRY_NOT_TEACHER_REVIEWED:' + q.questionId);
    const o = mk(q, q.content, q.choices, 'content'), c = mk(q, d.displayContent, d.displayChoices, 'content');
    if (JSON.stringify(o.choices.map(x => x.id)) !== JSON.stringify(c.choices.map(x => x.id))) fail('OVERLAY_CHOICE_IDS_DISAGREE:' + q.questionId);
    for (const b of [...(d.displayContent || []), ...(q.content || [])]) if (b.kind === 'image') addImg(b.src);
    tags[c.id] = derivedTag(c, d.layoutFamily, 'approved display overlay layoutFamily', {arrangement: String(d.preferredArrangement || '')});
    original.push(o); concise.push(c);
  }
  notes.push('NO_APPROVED_RENDERER_PRESENTATION__GENERATED_FROM_EFFECTIVE_PLUS_TEACHER_REVIEWED_DISPLAY_OVERLAY');
  if (fromDisplay) notes.push('IMAGES_FROM_DISPLAY_ASSETS:' + fromDisplay);
  return {original, concise, images, tags, unitMeta: null, overlay: null, notes, adapter: 'display-overlay-v1',
    renderTagsSource: 'DERIVED_FROM_APPROVED_OVERLAY_LAYOUT_FAMILY', unitMetaSource: 'APPROVED_INDEX_TITLE'};
}

export function buildContentPackages(src, index, {bridgeScriptIds = null} = {}) {
  const files = new Map();
  const bytes = p => { if (!src.exists(p)) fail('MISSING_FILE:' + p); const b = src.readBytes(p); files.set(p, sha256(b)); return b; };
  const json = p => JSON.parse(bytes(p).toString('utf8'));
  const zips = new Map();
  const zipOf = p => { if (!zips.has(p)) zips.set(p, readZip(bytes(p))); return zips.get(p); };
  const presCache = new Map();
  const packages = [], report = [];

  function presentationFor(e) {
    const m = json(e.sourceManifest);
    let where = null, text = null, claimedSha = null;
    if (e.sourceShape === 'bundle-unit-questions' && m.approvedPresentation) {
      where = dirOf(e.sourceManifest) + m.approvedPresentation;
    } else if (e.sourceShape === 'bundle-source-zips') {
      const ap = zipOf(e.archivePath).json('release/approval.json');
      if (ap.display) where = e.archivePath + '!' + ap.display;
      claimedSha = ap.htmlSHA256 || null;
    } else if (m.reviewedPresentation) {
      where = m.reviewedPresentation.startsWith('approved/') ? m.reviewedPresentation : e.archivePath + '!' + m.reviewedPresentation;
      claimedSha = m.reviewedPresentationSha256 || null;
    }
    if (!where) return {where: null};
    if (!presCache.has(where)) {
      const [path, entry] = where.split('!');
      const buf = entry ? zipOf(path).read(entry) : bytes(path);
      const sha = sha256(buf);
      if (claimedSha && claimedSha !== sha) fail('PRESENTATION_SHA:' + where);
      text = buf.toString('utf8');
      presCache.set(where, {where, sha, shaVerified: !!claimedSha,
        original: extractConst(text, 'DATA_ORIGINAL'), concise: extractConst(text, 'DATA_CONCISE'),
        images: extractConst(text, 'IMAGES'), unitMeta: extractConst(text, 'UNIT_META'),
        tags: extractConst(text, 'HOJA_RENDER_TAGS'), text, scripts: scriptIds(text),
        v3data: extractConst(text, 'DATA'), v3media: extractConst(text, 'MEDIA'), v3names: extractConst(text, 'NAMES')});
    }
    return presCache.get(where);
  }
  function effectiveQuestions(e) {
    if (e.sourceShape === 'bundle-unit-questions') return null; // approved tables ARE the source (checked below)
    if (e.sourceShape === 'bundle-source-zips') {
      const nz = readZip(zipOf(e.archivePath).read(e.nestedArchive));
      return nz.json('cartridge.json').questions;
    }
    return zipOf(e.archivePath).json('effective/cartridge.json').questions;
  }

  for (const e of index.entries) {
    const r = {cartridgeId: e.cartridgeId, questionCount: e.questionCount, status: 'READY', reasons: []};
    const block = why => { r.status = 'BLOCKED'; r.reasons.push(why); };
    const raw = presentationFor(e);
    r.presentation = raw.where ? raw.where.replace(/^approved\//, '') : null;
    const eff = effectiveQuestions(e);
    const effById = eff ? new Map(eff.map(q => [q.questionId, effectiveFacts(q)])) : null;
    const effAccepted = id => { const q = eff && eff.find(x => x.questionId === id);
      return q && Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.map(String) : []; };
    let p, adapted = null;
    if (raw.where && Array.isArray(raw.original) && Array.isArray(raw.concise) && raw.images) {
      p = raw; r.adapter = 'renderer-v2';
    } else if (raw.where && Array.isArray(raw.v3data) && raw.v3media && raw.v3names && e.sourceShape === 'bundle-source-zips') {
      adapted = adaptPresentationV3(raw, e, zipOf(e.archivePath), readZip(zipOf(e.archivePath).read(e.nestedArchive)), effAccepted);
    } else if (!raw.where && e.archivePath && zipOf(e.archivePath).has('display/presentation.json')) {
      adapted = adaptDisplayOverlay(e, zipOf(e.archivePath));
    } else block(raw.where ? 'PRESENTATION_SCHEMA_UNKNOWN' : 'NO_APPROVED_RENDERER_PRESENTATION');
    if (adapted) {
      p = {where: raw.where || null, sha: raw.sha || null, shaVerified: !!raw.shaVerified, text: raw.text || '', scripts: raw.scripts || [],
        original: adapted.original, concise: adapted.concise, images: adapted.images, tags: adapted.tags, unitMeta: adapted.unitMeta};
      Object.assign(r, {adapter: adapted.adapter, adapterNotes: adapted.notes, mediaOverlay: adapted.overlay,
        renderTagsSourceDetail: adapted.renderTagsSource, unitMetaSourceDetail: adapted.unitMetaSource});
    }
    if (r.status === 'BLOCKED') { report.push(r); continue; }
    const mine = q => String(q.questionId || '').startsWith(e.cartridgeId + ':');
    const orig = p.original.filter(mine), conc = p.concise.filter(mine);
    if (orig.length !== e.questionCount || conc.length !== e.questionCount) fail('PRESENTATION_COUNT:' + e.cartridgeId);
    const origById = new Map(orig.map(q => [q.id, q]));
    const unitIds = new Set(conc.map(q => q.unit));
    if (unitIds.size !== 1) fail('PRESENTATION_UNIT_AMBIGUOUS:' + e.cartridgeId);
    const unitId = [...unitIds][0];
    let textDiffs = 0, imageBytesChecked = 0, imageBytesDiffer = 0;
    for (const q of conc) {
      const o = origById.get(q.id);
      if (!o || o.questionId !== q.questionId || o.type !== q.type) fail('CONCISE_ORIGINAL_MISMATCH:' + q.id);
      if (JSON.stringify(o.answer) !== JSON.stringify(q.answer) ||
          JSON.stringify(o.choices.map(c => c.id)) !== JSON.stringify(q.choices.map(c => c.id))) fail('CONCISE_KEY_MISMATCH:' + q.id);
      if (effById) {
        const f = effById.get(q.questionId);
        if (!f) fail('NOT_IN_EFFECTIVE:' + q.questionId);
        if (f.type !== q.type) fail('TYPE_DISAGREES:' + q.questionId);
        if (JSON.stringify(f.choiceIds) !== JSON.stringify(q.choices.map(c => c.id).sort())) fail('CHOICE_IDS_DISAGREE:' + q.questionId);
        if (JSON.stringify(f.answer) !== JSON.stringify(q.answer) &&
            !(q.type === 'SHORT' && f.answer && q.answer && f.answer.text === q.answer.text)) fail('ANSWER_DISAGREES:' + q.questionId);
        const shown = q.media ? q.media.filter(m => m.kind === 'image').length : (q.image ? 1 : 0);
        if (f.images !== shown) fail('IMAGE_PRESENCE_DISAGREES:' + q.questionId);
        if (f.choiceImages !== q.choices.filter(c => c.image).length) fail('CHOICE_IMAGE_DISAGREES:' + q.questionId);
      }
      for (const img of [q.image, ...(q.media || []).filter(m => m.kind === 'image').map(m => m.asset), ...q.choices.map(c => c.image)].filter(Boolean)) {
        const uri = p.images[img];
        if (typeof uri !== 'string' || !/^data:image\/(webp|png|jpeg|svg\+xml);base64,/.test(uri)) fail('IMAGE_MISSING:' + q.questionId);
        if (img.includes('/overlay/')) continue; // approved overlay replacement: not an effective asset by design
        if (e.archivePath) {
          const z = e.sourceShape === 'bundle-source-zips' ? readZip(zipOf(e.archivePath).read(e.nestedArchive)) : zipOf(e.archivePath);
          const cand = (e.sourceShape === 'bundle-source-zips' ? 'assets/' : 'effective/assets/') + img.split('/').pop();
          if (z.has(cand)) { imageBytesChecked++;
            if (sha256(Buffer.from(uri.split(',')[1], 'base64')) !== sha256(z.read(cand))) imageBytesDiffer++; }
        }
      }
      if (o.prompt !== q.prompt) textDiffs++;
    }
    if (eff && eff.length !== e.questionCount) fail('EFFECTIVE_COUNT:' + e.cartridgeId);
    if (e.sourceShape === 'bundle-unit-questions') {
      // YBM: the approved tables are authoritative; the presentation must equal them.
      const m = json(e.sourceManifest), base = dirOf(e.sourceManifest);
      const approved = json(base + m.approvedData).filter(mine);
      const aTags = json(base + m.approvedTags), aImgs = json(base + m.approvedImages);
      for (const a of approved) {
        const o = orig.find(x => x.questionId === a.questionId);
        if (!o || JSON.stringify({...a, unit: undefined, id: undefined}) !== JSON.stringify({...o, unit: undefined, id: undefined}))
          fail('APPROVED_TABLE_DISAGREES:' + a.questionId);
        if (p.tags && JSON.stringify(p.tags[o.id]) !== JSON.stringify(aTags[a.id])) fail('APPROVED_TAGS_DISAGREE:' + a.questionId);
        for (const img of [a.image, ...(a.choices || []).map(c => c.image)].filter(Boolean))
          if (aImgs[img] !== p.images[img]) fail('APPROVED_IMAGE_DISAGREES:' + a.questionId);
      }
    }
    const used = [...new Set(conc.flatMap(q => [q.image, ...(q.media || []).filter(m => m.kind === 'image').map(m => m.asset), ...q.choices.map(c => c.image)]).filter(Boolean))].sort();
    const tags = {};
    if (p.tags) for (const q of conc) if (p.tags[q.id]) tags[q.id] = JSON.parse(JSON.stringify(p.tags[q.id]));
    let layoutPrefs = null;
    if (e.archivePath && e.sourceShape !== 'bundle-source-zips' && zipOf(e.archivePath).has('presentation/layout-preferences.json'))
      layoutPrefs = applyLayoutPreferences(zipOf(e.archivePath).json('presentation/layout-preferences.json'), tags, conc, p.text, e.cartridgeId);
    const layoutCounts = {};
    for (const q of conc) { const l = tags[q.id]?.layout?.preferredLayout || (q.image ? 'C' : 'A'); layoutCounts[l] = (layoutCounts[l] || 0) + 1; }
    const scriptsNotInBridge = bridgeScriptIds ? p.scripts.filter(x => !bridgeScriptIds.includes(x)) : null;
    // F2: approved display scripts the shared renderer reproduces through a profile-gated extension.
    let displayProfile = null;
    for (const [profile, ids] of Object.entries(DISPLAY_PROFILES))
      if (ids.every(id => p.scripts.includes(id))) displayProfile = profile;
    if (displayProfile) for (const q of [...conc, ...orig]) q.displayProfile = displayProfile;
    const unitMeta = {[unitId]: p.unitMeta && p.unitMeta[unitId] ?
      p.unitMeta[unitId] : {label: e.grade + '학년 ' + (e.unit != null ? e.unit + (e.subunit ? '-' + e.subunit : '') + '단원' : ''), title: e.unitTitle || e.approvedTitle, count: e.questionCount}};
    const pkg = {questionSchemaVersion: 2, sourceSheetVersion: 2, cartridgeId: e.cartridgeId, unitId,
      questions: conc.map(q => gameRow(q, origById.get(q.id))),
      images: Object.fromEntries(used.map(k => [k, p.images[k]])), tags, unitMeta};
    const text = JSON.stringify(pkg);
    Object.assign(r, {unitId, presentationSha256: p.sha, presentationShaVerified: p.shaVerified,
      types: Object.fromEntries(Object.entries(pkg.questions.reduce((a, q) => (a[q.type] = (a[q.type] || 0) + 1, a), {})).sort()),
      images: used.length, tags: Object.keys(tags).length,
      renderTags: adapted ? r.renderTagsSourceDetail : p.tags ? 'APPROVED' : 'NONE_IN_APPROVED_SOURCE',
      mediaQuestions: conc.filter(q => q.media).length,
      layoutPreferences: layoutPrefs, layoutCounts: Object.fromEntries(Object.entries(layoutCounts).sort()),
      presentationScriptsNotInBridge: scriptsNotInBridge, displayProfile,
      unitMetaSource: adapted ? r.unitMetaSourceDetail : p.unitMeta && p.unitMeta[unitId] ? 'APPROVED_PRESENTATION' : 'APPROVED_INDEX_TITLE',
      visualParity: adapted || !p.tags ? 'NOT_VERIFIED' : 'SOURCE_RENDERER_DATA',
      crossCheck: effById ? 'EFFECTIVE_CONTENT' : 'APPROVED_TABLES', promptsShortenedForDisplay: textDiffs,
      imageBytesCheckedAgainstEffective: imageBytesChecked, imageBytesDifferFromEffective: imageBytesDiffer,
      packageBytes: Buffer.byteLength(text), packageSha256: sha256(Buffer.from(text)), effectiveSha256: e.effectiveSha256});
    packages.push({cartridgeId: e.cartridgeId, json: text, sha256: r.packageSha256});
    report.push(r);
  }
  const ready = report.filter(x => x.status === 'READY');
  return {packages, report: {schemaVersion: 'hoja-approved-content-report-v1', sourceCommit: index.sourceCommit,
    indexDigestSource: index.schemaVersion, units: report.length,
    ready: ready.length, readyQuestions: ready.reduce((n, x) => n + x.questionCount, 0),
    blocked: report.length - ready.length, blockedQuestions: report.filter(x => x.status === 'BLOCKED').reduce((n, x) => n + x.questionCount, 0),
    entries: report}, files: Object.fromEntries([...files].sort())};
}

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
        tags: extractConst(text, 'HOJA_RENDER_TAGS'), text, scripts: scriptIds(text)});
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
    const p = presentationFor(e);
    r.presentation = p.where ? p.where.replace(/^approved\//, '') : null;
    if (!p.where) block('NO_APPROVED_RENDERER_PRESENTATION');
    else if (!Array.isArray(p.original) || !Array.isArray(p.concise) || !p.images) block('PRESENTATION_NOT_RENDERER_V2');
    const eff = effectiveQuestions(e);
    const effById = eff ? new Map(eff.map(q => [q.questionId, effectiveFacts(q)])) : null;
    if (effById) {
      const multi = [...effById.entries()].filter(([, f]) => f.images > 1).map(([id]) => id);
      if (multi.length) block('MULTI_IMAGE_QUESTIONS_NOT_REPRESENTABLE:' + multi.length);
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
        if ((f.images > 0) !== !!q.image) fail('IMAGE_PRESENCE_DISAGREES:' + q.questionId);
        if (f.choiceImages !== q.choices.filter(c => c.image).length) fail('CHOICE_IMAGE_DISAGREES:' + q.questionId);
      }
      for (const img of [q.image, ...q.choices.map(c => c.image)].filter(Boolean)) {
        const uri = p.images[img];
        if (typeof uri !== 'string' || !/^data:image\/(webp|png|jpeg|svg\+xml);base64,/.test(uri)) fail('IMAGE_MISSING:' + q.questionId);
        if (e.archivePath && e.sourceShape !== 'bundle-source-zips') {
          const z = zipOf(e.archivePath), cand = 'effective/assets/' + img.split('/').pop();
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
    const used = [...new Set(conc.flatMap(q => [q.image, ...q.choices.map(c => c.image)]).filter(Boolean))].sort();
    const tags = {};
    if (p.tags) for (const q of conc) if (p.tags[q.id]) tags[q.id] = JSON.parse(JSON.stringify(p.tags[q.id]));
    let layoutPrefs = null;
    if (e.archivePath && e.sourceShape !== 'bundle-source-zips' && zipOf(e.archivePath).has('presentation/layout-preferences.json'))
      layoutPrefs = applyLayoutPreferences(zipOf(e.archivePath).json('presentation/layout-preferences.json'), tags, conc, p.text, e.cartridgeId);
    const layoutCounts = {};
    for (const q of conc) { const l = tags[q.id]?.layout?.preferredLayout || (q.image ? 'C' : 'A'); layoutCounts[l] = (layoutCounts[l] || 0) + 1; }
    const scriptsNotInBridge = bridgeScriptIds ? p.scripts.filter(x => !bridgeScriptIds.includes(x)) : null;
    const unitMeta = {[unitId]: p.unitMeta && p.unitMeta[unitId] ?
      p.unitMeta[unitId] : {label: e.grade + '학년 ' + (e.unit != null ? e.unit + (e.subunit ? '-' + e.subunit : '') + '단원' : ''), title: e.unitTitle || e.approvedTitle, count: e.questionCount}};
    const pkg = {questionSchemaVersion: 2, sourceSheetVersion: 2, cartridgeId: e.cartridgeId, unitId,
      questions: conc.map(q => gameRow(q, origById.get(q.id))),
      images: Object.fromEntries(used.map(k => [k, p.images[k]])), tags, unitMeta};
    const text = JSON.stringify(pkg);
    Object.assign(r, {unitId, presentationSha256: p.sha, presentationShaVerified: p.shaVerified,
      types: Object.fromEntries(Object.entries(pkg.questions.reduce((a, q) => (a[q.type] = (a[q.type] || 0) + 1, a), {})).sort()),
      images: used.length, tags: Object.keys(tags).length, renderTags: p.tags ? 'APPROVED' : 'NONE_IN_APPROVED_SOURCE',
      layoutPreferences: layoutPrefs, layoutCounts: Object.fromEntries(Object.entries(layoutCounts).sort()),
      presentationScriptsNotInBridge: scriptsNotInBridge,
      unitMetaSource: p.unitMeta && p.unitMeta[unitId] ? 'APPROVED_PRESENTATION' : 'APPROVED_INDEX_TITLE',
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

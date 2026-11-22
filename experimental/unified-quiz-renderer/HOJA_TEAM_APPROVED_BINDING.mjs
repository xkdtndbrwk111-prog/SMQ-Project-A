/**
 * Bind a team question to the teacher-approved renderer; no CSS/scoring/fallback.
 */
const TYPES = Object.freeze({MC3:'MCQ', OX:'OX', SUBJECTIVE:'SHORT'});
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a,b) => String(a ?? '').replace(/\s+/g,' ').trim() === String(b ?? '').replace(/\s+/g,' ').trim();

export function bindTeamApprovedQuestion(q) {
  if (!object(q) || !TYPES[q.type]) throw Error('TEAM_RENDER_UNSUPPORTED_TYPE');
  const source=q.approvedSource, row=source?.row, bank=source?.bank;
  const canonical=row?.rendererQuestion ?? row?.approvedQuestion;
  if (!object(canonical) || !canonical.id || canonical.type !== TYPES[q.type])
    throw Error('TEAM_RENDER_APPROVED_QUESTION_REQUIRED');
  if (source.questionId && ![canonical.id,canonical.questionId].includes(source.questionId))
    throw Error('TEAM_RENDER_QUESTION_ID_MISMATCH');
  const images=bank?.images ?? bank?.rendererImages;
  const tags=bank?.tags ?? bank?.rendererTags;
  const unitMeta=bank?.unitMeta;
  if (!object(images) || !object(tags) || !object(unitMeta))
    throw Error('TEAM_RENDER_APPROVED_ASSETS_REQUIRED');
  if (canonical.image && !Object.hasOwn(images,canonical.image)) throw Error('TEAM_RENDER_MISSING_IMAGE');
  for (const c of canonical.choices ?? []) {
    if (c.image && !Object.hasOwn(images,c.image)) throw Error('TEAM_RENDER_MISSING_CHOICE_IMAGE');
  }
  if (!canonical.renderTags && !tags[canonical.id]) throw Error('TEAM_RENDER_APPROVED_TAGS_REQUIRED');
  if (q.type === 'MC3') {
    if (!Array.isArray(canonical.choices) || ![3,4].includes(canonical.choices.length) ||
        !Array.isArray(q.sourceChoiceIndices) || q.sourceChoiceIndices.length !== 3)
      throw Error('TEAM_RENDER_CHOICE_MAPPING_REQUIRED');
    const selected=q.sourceChoiceIndices.map(i=>canonical.choices[i]);
    if (selected.some(c=>!c)) throw Error('TEAM_RENDER_CHOICE_INDEX_INVALID');
    if (!selected.every((c,i)=>same(c.text,q.choices[i]) ||
        (c.image && same(c.imageAlt,q.choices[i])))) throw Error('TEAM_RENDER_CHOICE_TEXT_MISMATCH');
    const ids=new Set(selected.map(c=>c.id));
    if (ids.size !== 3 || !ids.has(canonical.answer?.choiceId))
      throw Error('TEAM_RENDER_CHOICE_ANSWER_MISMATCH');
    const omitted=canonical.choices.filter(c=>!ids.has(c.id));
    if (omitted.length>1 || omitted.some(c=>c.id===canonical.answer.choiceId))
      throw Error('TEAM_RENDER_CHOICE_MAPPING_INVALID');
    return Object.freeze({questionId:canonical.id,rendererQuestion:canonical,
      omitChoiceId:omitted[0]?.id ?? null,
      choiceIdToIndex:Object.freeze(Object.fromEntries(selected.map((c,i)=>[c.id,i]))),
      images,tags,unitMeta,teamQuestionNumber:q.num});
  }
  if (q.type === 'OX') {
    if (typeof canonical.answer?.value !== 'boolean' ||
        (canonical.answer.value ? 0 : 1) !== q.answer) throw Error('TEAM_RENDER_OX_ANSWER_MISMATCH');
    return Object.freeze({questionId:canonical.id,rendererQuestion:canonical,
      omitChoiceId:null,choiceIdToIndex:Object.freeze({'true':0,'false':1}),images,tags,unitMeta,teamQuestionNumber:q.num});
  }
  if (!same(canonical.answer?.text,q.answerText)) throw Error('TEAM_RENDER_SHORT_ANSWER_MISMATCH');
  return Object.freeze({questionId:canonical.id,rendererQuestion:canonical,
    omitChoiceId:null,choiceIdToIndex:Object.freeze({}),images,tags,unitMeta,teamQuestionNumber:q.num});
}
export function teamRendererAnswerIndex(binding, choiceId) {
  if (!object(binding?.choiceIdToIndex) || typeof choiceId!=='string' ||
      !Object.hasOwn(binding.choiceIdToIndex,choiceId)) throw Error('TEAM_RENDER_UNKNOWN_CHOICE_ID');
  return binding.choiceIdToIndex[choiceId];
}
export function teamApprovedPayload(bindings) {
  if (!Array.isArray(bindings) || !bindings.length) throw Error('TEAM_RENDER_BINDINGS_REQUIRED');
  const ids=new Set(),questions=[],images={},tags={},unitMeta={};
  for (const b of bindings) {
    if (!b?.questionId || ids.has(b.questionId)) throw Error('TEAM_RENDER_DUPLICATE_QUESTION');
    ids.add(b.questionId);questions.push(b.rendererQuestion);
    Object.assign(images,b.images);Object.assign(tags,b.tags);Object.assign(unitMeta,b.unitMeta);
  }
  return {questions,images,tags,unitMeta,mode:'team'};
}

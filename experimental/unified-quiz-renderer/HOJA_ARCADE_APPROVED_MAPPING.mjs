/* Trial-only pure mapping: original compressed arcade scorer <-> approved A/C/D renderer.
 * Never compute scores here. Invalid/ambiguous choices fail closed.
 */
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>String(a??'').replace(/\s+/g,' ').trim()===String(b??'').replace(/\s+/g,' ').trim();
const deny=reason=>{throw Error('ARCADE_APPROVED_'+reason)};

export function createApprovedArcadeCatalog(sources,core) {
 if(!Array.isArray(sources)||!sources.length||sources.length>5||typeof core?.bindTeamApprovedQuestion!=='function')deny('SOURCES_REQUIRED');
 const index=new Map(),bindings=[];
 for(const entry of sources) {
  const sheet=String(entry?.sheetName||'').trim(),bank=entry?.data;
  if(!sheet||!Array.isArray(bank?.questions)||!isObj(bank.images)||!isObj(bank.tags)||!isObj(bank.unitMeta))deny('BANK_METADATA_REQUIRED');
  for(const row of bank.questions) {
   if(row?.isNull===true||row?.type==='SUBJECTIVE')continue;
   const type=row?.type==='MULTIPLE'?'MC':row?.type==='OX'?'OX':null;
   if(!type)deny('UNSUPPORTED_TYPE');
   const canonical=row?.rendererQuestion;
   const familyId=String(row?.familyId||'').trim();
   if(!familyId||!isObj(canonical)||!canonical.id)deny('CANONICAL_REQUIRED');
   const key=sheet+'\u0000'+familyId+'\u0000'+type;
   if(index.has(key))deny('DUPLICATE_VARIANT');
   const approvedSource={row,bank,questionId:canonical.id};
   let q;
   if(type==='MC') {
    if(!Array.isArray(canonical.choices)||canonical.choices.length!==4)deny('MC_CANONICAL_CHOICES');
    const answer=canonical.choices.findIndex(c=>c.id===canonical.answer?.choiceId);
    if(answer<0)deny('MC_CANONICAL_ANSWER');
    const selected=[answer,...canonical.choices.map((_,i)=>i).filter(i=>i!==answer).slice(0,2)].sort((a,b)=>a-b);
    q={type:'MC3',choices:selected.map(i=>canonical.choices[i].text),sourceChoiceIndices:selected,approvedSource};
   } else {
    if(typeof canonical.answer?.value!=='boolean')deny('OX_CANONICAL_ANSWER');
    q={type:'OX',answer:canonical.answer.value?0:1,choices:['O','X'],approvedSource};
   }
   const binding=core.bindTeamApprovedQuestion(q);
   index.set(key,{type,approvedSource,canonical});
   bindings.push(binding);
  }
 }
 if(bindings.length<25)deny('TOO_FEW_APPROVED_QUESTIONS');
 return Object.freeze({index,payload:core.teamApprovedPayload(bindings),count:bindings.length});
}

export function resolveApprovedArcadeChoice(catalog,q,core) {
 if(!catalog?.index||!isObj(q)||!Array.isArray(q.choices)||!Number.isInteger(q.answer))deny('SCORER_QUESTION_REQUIRED');
 if(q.type!=='MC'&&q.type!=='OX')deny('SCORER_TYPE_INVALID');
 const hit=catalog.index.get(String(q.familyKey||'')+'\u0000'+q.type);
 if(!hit)deny('UNAPPROVED_QUESTION');
 const canonical=hit.canonical;
 if(q.type==='MC'){
  if(q.choices.length!==3)deny('MC_THREE_CHOICE_REQUIRED');
  const selected=q.choices.map(label=>{
   const found=canonical.choices.map((c,i)=>same(c.text,label)||c.image&&same(c.imageAlt,label)?i:-1).filter(i=>i>=0);
   if(found.length!==1)deny('MC_TEXT_AMBIGUOUS');
   return found[0];
  });
  if(new Set(selected).size!==3)deny('MC_DUPLICATE_CHOICE');
  const binding=core.bindTeamApprovedQuestion({type:'MC3',choices:q.choices,sourceChoiceIndices:selected,approvedSource:hit.approvedSource});
  const expected=selected.findIndex(i=>canonical.choices[i].id===canonical.answer.choiceId);
  if(q.answer!==expected)deny('MC_SCORER_ANSWER_MISMATCH');
  return Object.freeze({binding,choiceIdToArcadeIndex:binding.choiceIdToIndex});
 }
 if(q.choices.length!==2)deny('OX_TWO_CHOICES_REQUIRED');
 const labels=q.choices.map(x=>String(x).trim().toUpperCase());
 const oi=labels.indexOf('O'),xi=labels.indexOf('X');
 if(oi<0||xi<0||oi===xi||q.answer!==(canonical.answer?.value?oi:xi))deny('OX_SCORER_ANSWER_MISMATCH');
 const binding=core.bindTeamApprovedQuestion({type:'OX',choices:['O','X'],answer:canonical.answer.value?0:1,approvedSource:hit.approvedSource});
 return Object.freeze({binding,choiceIdToArcadeIndex:Object.freeze({true:oi,false:xi})});
}

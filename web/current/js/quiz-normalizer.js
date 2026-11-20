// Cartridge conversion and question normalization, isolated from Scene and RUN.
(()=>{
'use strict';
function hojaStep09Shuffle_(values, rng=Math.random) {
  const out=values.slice();
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(rng()*(i+1));
    if(j<0||j>i)throw new Error('무작위 선택 오류');
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
function hojaStep09Normalize_(response, rng=Math.random) {
  const sources=Array.isArray(response)?response:[{sheetName:'single',data:response}];
  if(!sources.length||sources.length>5)throw new Error('카트리지는 1~5개여야 합니다.');
  const seenSheets=new Set(), families=new Map();
  let unsupported=0, totalRows=0;
  sources.forEach((entry,sidx)=>{
    if(!entry||!entry.data||entry.data.questionSchemaVersion!==2||
       ![1,2].includes(entry.data.sourceSheetVersion)||!Array.isArray(entry.data.questions))
      throw new Error('Project B 문제 응답 형식 오류');
    const sheetName=String(entry.sheetName||'').trim();
    if(!sheetName||seenSheets.has(sheetName))throw new Error('카트리지 이름 누락·중복');
    seenSheets.add(sheetName);
    const seenVariants=new Set();
    entry.data.questions.forEach((row,i)=>{
      totalRows++;
      if(!row||row.isNull===true)throw new Error('빈 서버 문제 응답: '+sheetName+' '+(i+1));
      const type=String(row.type||'').trim().toUpperCase();
      const familyId=String(row.familyId||'').trim();
      const question=String(row.question||'').trim();
      if(!familyId||!question)throw new Error('문제 묶음 ID/내용 누락: '+sheetName+' '+(i+1));
      if(!['OX','MULTIPLE','SUBJECTIVE'].includes(type))
        throw new Error('알 수 없는 문제 유형: '+sheetName+' '+(i+1));
      const key=sheetName+'\u0000'+familyId;
      const variantKey=key+'\u0000'+type;
      if(seenVariants.has(variantKey))throw new Error('중복 문제 유형: '+sheetName+' '+familyId);
      seenVariants.add(variantKey);
      if(type==='SUBJECTIVE'){unsupported++;return;}
      let choices,answer;
      if(type==='OX'){
        const a=String(row.answer||'').trim().toUpperCase();
        if(a!=='O'&&a!=='X')throw new Error('OX 정답 오류: '+sheetName+' '+familyId);
        if(row.options!=null&&(!Array.isArray(row.options)||row.options.length!==2||
          row.options.map(x=>String(x).trim().toUpperCase()).sort().join(',')!=='O,X'))
          throw new Error('OX 보기 오류: '+sheetName+' '+familyId);
        choices=['O','X'];answer=a==='O'?0:1;
      }else{
        if(!Array.isArray(row.options)||row.options.length!==4)
          throw new Error('객관식 원본 보기는 4개여야 합니다: '+sheetName+' '+familyId);
        choices=row.options.map(x=>String(x??'').trim());
        if(choices.some(x=>!x)||new Set(choices).size!==4)
          throw new Error('객관식 보기 누락·중복: '+sheetName+' '+familyId);
        const a=String(row.answer??'').trim();
        if(!/^[1-4]$/.test(a))throw new Error('객관식 정답 번호 오류: '+sheetName+' '+familyId);
        answer=Number(a)-1;
      }
      if(!families.has(key))families.set(key,[]);
      families.get(key).push({type:type==='OX'?'OX':'MC',q:question,choices,answer,
        familyKey:key,source:sheetName});
    });
  });
  if(families.size<25)throw new Error('출제 가능한 고유 문제 묶음이 '+families.size+'개입니다. 25개 이상 필요합니다.');
  const chosen=hojaStep09Shuffle_(Array.from(families.values()),rng).slice(0,25);
  const questions=chosen.map(variants=>{
    const variant=variants[Math.floor(rng()*variants.length)];
    if(!variant)throw new Error('문제 변형 선택 오류');
    let indexed;
    if(variant.type==='MC'){
      const wrong=hojaStep09Shuffle_(variant.choices.map((text,i)=>({text,i}))
        .filter(item=>item.i!==variant.answer),rng).slice(0,2);
      indexed=hojaStep09Shuffle_([{text:variant.choices[variant.answer],i:variant.answer},...wrong],rng);
    }else indexed=hojaStep09Shuffle_(variant.choices.map((text,i)=>({text,i})),rng);
    return {type:variant.type,q:variant.q,choices:indexed.map(x=>x.text),
      answer:indexed.findIndex(x=>x.i===variant.answer),familyKey:variant.familyKey,
      source:variant.source};
  });
  if(questions.length!==25||new Set(questions.map(q=>q.familyKey)).size!==25||
     questions.some(q=>q.answer<0||q.answer>=q.choices.length||
       q.choices.length!==(q.type==='OX'?2:3)))
    throw new Error('25문제 구성 검증 실패');
  return {questions,metrics:{sourceCount:sources.length,sourceRows:totalRows,
    eligibleFamilies:families.size,selected:25,unsupported}};
}
window.HOJA_QUIZ_NORMALIZER=Object.freeze({hojaStep09Normalize_});
})();

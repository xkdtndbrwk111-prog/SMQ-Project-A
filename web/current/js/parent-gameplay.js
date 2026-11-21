"use strict";
window.HOJA_GAMEPLAY=(()=>{
 const host=()=>document.getElementById('hojaGamePlay');
 const frame=()=>document.getElementById('hqArcadeFrame');
 const img=id=>document.getElementById(id);
 const seasons=['spring','summer','autumn','winter'];
 let questions=[];
 function setServerQuestions(sources){
  const familyMap=new Map(), sourceNames=new Set();
  if(!Array.isArray(sources)||sources.length<1||sources.length>5)throw new Error('서버 카트리지 개수 오류');
  for(const entry of sources){
   if(!entry||!entry.data||entry.data.questionSchemaVersion!==2||![1,2].includes(entry.data.sourceSheetVersion)||!Array.isArray(entry.data.questions))throw new Error('서버 문제 스키마 오류');
   if(sourceNames.has(entry.sheetName))throw new Error('중복 카트리지');sourceNames.add(entry.sheetName);
   for(const r of entry.data.questions){
    if(r?.isNull===true||!String(r?.familyId||'').trim()||!String(r?.question||'').trim())throw new Error('문제 묶음 ID/내용 오류');
    if(!['OX','MULTIPLE','SUBJECTIVE'].includes(r.type))throw new Error('알 수 없는 유형');
    if(r.type==='SUBJECTIVE')continue;
    const key=entry.sheetName+'::'+String(r.familyId);
    let family=familyMap.get(key);
    if(!family){family={key,variants:[]};familyMap.set(key,family);}
    if(family.variants.some(x=>x.sourceType===r.type))throw new Error('중복 문제 유형');
    let choices;
    if(r.type==='OX'){
     if(!['O','X'].includes(r.answer))throw new Error('OX 정답 오류');
     choices=[{text:'O',correct:r.answer==='O'},{text:'X',correct:r.answer==='X'}];
    }else{
     if(!Array.isArray(r.options)||r.options.length!==4||!['1','2','3','4'].includes(String(r.answer)))throw new Error('객관식 데이터 오류');
     const ix=Number(r.answer)-1;
     if(r.options.some(v=>!String(v||'').trim())||new Set(r.options.map(v=>String(v).trim())).size!==4)throw new Error('객관식 보기 오류');
     const wrong=r.options.map((text,i)=>({text:String(text).trim(),correct:false,i})).filter(x=>x.i!==ix);
     for(let i=wrong.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[wrong[i],wrong[j]]=[wrong[j],wrong[i]];}
     choices=[{text:String(r.options[ix]).trim(),correct:true},...wrong.slice(0,2)];
    }
    for(let i=choices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
    family.variants.push({sourceType:r.type,type:r.type==='OX'?'OX':'MC',q:r.question,choices:choices.map(x=>x.text),answer:choices.findIndex(x=>x.correct)});
   }
  }
  if(!familyMap.size)throw new Error('이 카트리지에는 객관식 또는 OX 문제가 없습니다.');
  // Project B may give BOTH OX and MULTIPLE rows for a family. The older
  // first-row-wins logic discarded every later MULTIPLE variant when OX came first.
  // Retain one question per family, while choosing a balanced available type.
  const families=[...familyMap.values()];
  const fixedOX=families.filter(x=>x.variants.length===1&&x.variants[0].type==='OX');
  const fixedMC=families.filter(x=>x.variants.length===1&&x.variants[0].type==='MC');
  const flexible=families.filter(x=>x.variants.length>1);
  for(let i=flexible.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[flexible[i],flexible[j]]=[flexible[j],flexible[i]];}
  const wantMC=Math.max(0,Math.min(flexible.length,Math.round(families.length/2)-fixedMC.length));
  const picked=[...fixedOX,...fixedMC].map(f=>f.variants[0]);
  flexible.forEach((f,i)=>{
   const type=i<wantMC?'MC':'OX';
   const option=f.variants.find(q=>q.type===type)||f.variants[0];
   picked.push(option);
  });
  for(let i=picked.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[picked[i],picked[j]]=[picked[j],picked[i]];}
  questions=picked;
 }

 function clearServerQuestions(){questions=[];}
 let page='',season='spring',loadId=0;
 async function launch(which,requested){
  if(which!=='arcade')return;
  if(!window.HOJA_B_LIVE?.sources||!questions.length){window.alert('Project B 문제를 먼저 선택하고 불러와야 합니다.');return;}
  stop();const own=++loadId;page=which;season=seasons.includes(requested)?requested:window.HOJA_SEASON_SESSION?.current?.()||'spring';
  window.HOJA_MODE_PREVIEW?.hide?.();host().hidden=false;
  host().dataset.mode=which;frame().hidden=false;
  img('hqArcadeInfo').hidden=true;img('hqModeLabel').textContent='아케이드 모드 · 호자 모험';
  if(new Set(window.HOJA_B_LIVE.sources.flatMap(e=>e.data.questions.filter(q=>q.type==='OX'||q.type==='MULTIPLE').map(q=>e.sheetName+'::'+q.familyId))).size<25){img('hqArcadeInfo').hidden=false;img('hqArcadeInfo').textContent='아케이드는 고유 문제 묶음 25개 이상이 필요합니다. 다른 단원을 추가로 선택해 주세요.';return;}
  window.HOJA_AUDIO_CONTROL?.syncArcade?.();
  try{
   if(own!==loadId)return;const f=frame();f.src='arcade.html?season='+encodeURIComponent(season)+(window.HOJA_BUILD?.gameVersion?'&gv='+encodeURIComponent(window.HOJA_BUILD.gameVersion):'')+(window.HOJA_ARCADE_QUERY||'');window.HOJA_V055_WATCH_ARCADE?.(f);window.HOJA_USAGE?.track?.('SOLO',1);f.addEventListener('load',()=>{window.HOJA_AUDIO_CONTROL?.syncArcade?.();window.HOJA_V055_BIND_ARCADE?.(f)},{once:true});
  }catch(err){if(own!==loadId)return;img('hqArcadeInfo').hidden=false;img('hqArcadeInfo').textContent='아케이드 실행 준비 실패: '+err.message;}
 }
 function stop(){
  loadId++;
  frame().removeAttribute('srcdoc');frame().removeAttribute('src');frame().hidden=true;
 }
 function back(){if(typeof window.HOJA_STUDENT_BACK==='function'){stop();page='';host().hidden=true;window.HOJA_STUDENT_BACK();window.HOJA_AUDIO_CONTROL?.render?.();return;}stop();page='';host().hidden=true;window.HOJA_MODE_PREVIEW.show(season);window.HOJA_AUDIO_CONTROL?.render?.();}
 img('hqPlayBack').addEventListener('click',back);
 window.addEventListener('message',e=>{if(e.source===frame().contentWindow&&e.data?.type==='HOJA_V051_ARCADE_EXIT'&&page==='arcade')back();});
 // The arcade parent exposes progress inside its iframe; retain the parent state shape for callers.
 return {launch,back,stop,setServerQuestions,clearServerQuestions,
  get state(){return {page,season,answered:0,correct:0,activeQuiz:false,jumping:false}}};
})();

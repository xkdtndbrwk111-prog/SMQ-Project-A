/* Trial-only parent/inner arcade transport. No score computation, no fallback renderer. */
import {createApprovedArcadeCatalog,resolveApprovedArcadeChoice} from './HOJA_ARCADE_APPROVED_MAPPING.mjs';

function substituteOnce(s,oldText,newText) {
 const n=s.split(oldText).length-1;
 if(n!==1)throw Error('ARCADE_INNER_ANCHOR_COUNT_'+n+': '+oldText.slice(0,32));
 return s.replace(oldText,newText);
}
const CHILD_SCRIPT=[
 '<script id="hojaArcadeApprovedChildTrial">',
 "(()=>{'use strict';",
 ' let active=null,serial=0,review=null;',
 " const send=data=>parent.postMessage(data,'*');",
 ' window.HOJA_ARCADE_APPROVED_BRIDGE=Object.freeze({',
 '  open(question,finish){',
 "   if(window===parent||!question?.familyKey||!Array.isArray(question.choices)||typeof finish!=='function')throw Error('ARCADE_CHILD_NOT_READY');",
 "   if(active)throw Error('ARCADE_CHILD_ALREADY_OPEN');",
 "   const id='ha-'+(++serial);",
 '   active={id,finish,responded:false};',
 "   send({type:'HOJA_ARCADE_APPROVED_OPEN',id,question:{familyKey:question.familyKey,type:question.type,choices:question.choices.slice(),answer:question.answer}});",
 '   return true;',
 '  },',
 "  verdict(correct){if(active)send({type:'HOJA_ARCADE_APPROVED_VERDICT',id:active.id,correct:!!correct})},",
 '  close(){if(!active)return;const id=active.id;active=null;send({type:\'HOJA_ARCADE_APPROVED_CLOSE\',id})},',
 '  startReview(rows,onDone){',
 "   if(active||review||typeof onDone!=='function'||!Array.isArray(rows))throw Error('ARCADE_REVIEW_BAD_STATE');",
 "   const wrong=rows.filter(x=>x&&x.correct===false&&(x.type==='MC'||x.type==='OX')&&typeof x.key==='string');",
   '   if(!wrong.length)return false;',
 "   const id='hr-'+(++serial);review={id,onDone};",
 "   send({type:'HOJA_ARCADE_APPROVED_REVIEW_START',id,wrong:wrong.map(x=>({key:x.key,type:x.type}))});",
   '   return true;',
   '  }',
 ' });',
 " window.addEventListener('message',ev=>{",
 "  if(ev.source!==parent)return;",
 "  const d=ev.data;",
 "  if(d?.type==='HOJA_ARCADE_APPROVED_REVIEW_DONE'){",
 "   if(!review||review.id!==d.id)return;",
 "   const done=review.onDone;review=null;done(d.allCorrect===true);return;",
 '  }',
 "  if(d?.type!=='HOJA_ARCADE_APPROVED_SELECT')return;",
 '  if(!active||active.id!==d.id||active.responded||!Number.isInteger(d.index))return;',
 '  active.responded=true;active.finish(d.index);',
 ' });',
 '})();',
 '</scr'+'ipt>'
].join('\n');

const HELP_SCRIPT='<script id="hojaTrialControlsHelpScript">' + "(()=>{'use strict';\n let panel=null,pausedScene=null,hide=()=>{};\n const init=()=>{\n const root=document.getElementById('gameBox')||document.body;\n panel=document.createElement('section');panel.id='hojaTrialControlsHelp';\n panel.setAttribute('role','dialog');panel.setAttribute('aria-label','HOJA 조작 도움말');\n panel.style.cssText='position:absolute;inset:0;z-index:92;display:none;place-items:center;background:#071421e8;color:white;font:700 20px/1.8 system-ui;padding:20px;text-align:center';\n panel.innerHTML='<div style=\"max-width:560px;background:#18304b;border:3px solid #ffdc75;padding:25px;border-radius:16px\"><div style=\"font-size:28px;margin-bottom:12px\">조작 도움말</div><div><b>A / D</b> 좌우 이동　<b>W</b> 문 진입</div><div><b>S</b> 앉기·파이프　<b>,</b> 또는 <b>Shift</b> 달리기　<b>.</b> 또는 <b>Space</b> 점프</div><div><b>Enter</b> 확인　<b>H</b> 도움말 닫기</div><div style=\"font-size:15px;margin-top:10px\">사망했을 때는 W A S D , . Enter Space 중 아무 키나 누르세요.</div><button type=\"button\" id=\"hojaTrialHelpClose\" style=\"font:700 18px system-ui;margin-top:18px;padding:12px 26px;cursor:pointer\">닫기 (H)</button></div>';\n root.append(panel);\n hide=()=>{panel.style.display='none';const s=pausedScene;pausedScene=null;if(s&&s.scene?.isActive?.()){s.manualPaused=false;s.physics.resume();}};\n panel.querySelector('#hojaTrialHelpClose').onclick=hide;\n };\n if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();\n window.addEventListener('keydown',ev=>{\n  if(!panel)return;\n  if(ev.code!=='KeyH'||ev.repeat||ev.isComposing||ev.altKey||ev.ctrlKey||ev.metaKey||ev.keyCode===229)return;\n  const target=ev.target;\n  if(['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)||target?.isContentEditable)return;\n  if(panel.style.display==='grid'){ev.preventDefault();ev.stopImmediatePropagation();hide();return;}\n  const s=window.HOJA_PHASER_APP?.scene?.();\n  if(!s||s.dying||s.clear||s.timeUp||s.transitioning||s.quizActive||s.manualPaused||\n     document.getElementById('hojaRankOverlay')?.classList.contains('is-open'))return;\n  ev.preventDefault();ev.stopImmediatePropagation();\n  pausedScene=s;s.manualPaused=true;s.physics.pause();panel.style.display='grid';\n },true);\n})();" + '</scr'+'ipt>';

export function patchApprovedArcadeInnerHTML(html){
 if(typeof html!=='string'||html.length<400000||!html.includes('hojaV058ServerGate'))throw Error('ARCADE_APPROVED_INNER_HTML_REQUIRED');
 if(html.includes('hojaArcadeApprovedChildTrial'))throw Error('ARCADE_APPROVED_ALREADY_PATCHED');
 let s=html;
 s=substituteOnce(s,
 '  closeQuizOverlay(){\n    this.quizToken=(this.quizToken||0)+1;',
 '  closeQuizOverlay(){\n    this.quizToken=(this.quizToken||0)+1;\n    window.HOJA_ARCADE_APPROVED_BRIDGE?.close();');
 s=substituteOnce(s,
 '      const correct=index===q.answer;\n      const btn=choices.children[index];',
 '      const correct=index===q.answer;\n      window.HOJA_ARCADE_APPROVED_BRIDGE?.verdict(correct);\n      const btn=choices.children[index];');
 s=substituteOnce(s,
 "        overlay.classList.remove('active','hojaQuizSuccess');\n        this.quizActive=false;",
 "        overlay.classList.remove('active','hojaQuizSuccess');\n        window.HOJA_ARCADE_APPROVED_BRIDGE?.close();\n        this.quizActive=false;");
 s=substituteOnce(s,
 '      },650);\n    };\n\n    q.choices.forEach((label,index)=>{',
 '      },1100);\n    };\n\n    q.choices.forEach((label,index)=>{');
 s=substituteOnce(s,
 '    q.choices.forEach((label,index)=>{',
 "    // Approved parent renderer owns display only. The original finish(index) below owns score.\n"+
 "    window.HOJA_ARCADE_APPROVED_BRIDGE.open({familyKey:q.familyKey,type:q.type,choices:q.choices,answer:q.answer},finish);\n"+
 "    overlay.classList.add('active');\n"+
 "    this.scene.pause();\n"+
 "    return;\n"+
 "    // Original buttons preserved but not reached during the trial.\n"+
 '    q.choices.forEach((label,index)=>{');
 // 40-6BF: the production ranking patch (Game part-14 rankingPatch) is applied FIRST and owns the whole
 // ranking UI/name policy; this patcher only adds the approved 25-question FINISH requirement to its failures list.
 s=substituteOnce(s,
 "  const eligible=failures.length===0;",
 "  if(!(m.found===25&&m.answered===25&&m.usedFamilies===25))failures.push('승인 25문항 미완료');\n  if(window.HOJA15_REVIEW_ALL_CORRECT_!==true)failures.push('오답 복습 미완료');\n  const eligible=failures.length===0;");
 s=substituteOnce(s,
 '  hojaStep09_3RenderProgress_();\n  hojaRankShow_(scene,reason);\n}',
 '  hojaStep09_3RenderProgress_();\n  window.HOJA15_REVIEW_ALL_CORRECT_=null;\n  if(!window.HOJA_ARCADE_APPROVED_BRIDGE?.startReview?.(RUN.step09History||[],allCorrect=>{\n    window.HOJA15_REVIEW_ALL_CORRECT_=allCorrect===true;\n    if(allCorrect===true)hojaRankShow_(scene,reason);\n    else hojaStep09_3SetStatus_(\'오답 복습에서 모두 맞히지 못해 이번 기록은 랭킹에 등록할 수 없습니다.\');}))\n  {window.HOJA15_REVIEW_ALL_CORRECT_=true;hojaRankShow_(scene,reason);}\n}');
 // 40-6BF: ranking name/input substitutions removed (owned by the production rankingPatch applied before this).
 // 40-6BG: keep the trial's display-side safety on top of the production list filters: never show a forbidden name.
 for(const head of ['HOJA_RANK_ROWS_=reply.rows.filter(r=>r&&','HOJA_RANK_ROWS_=rows.filter(r=>r&&']){
  const anchor=head+'/^[가-힣A-Z0-9]{2,6}$/.test(hojaRankNormalize_(r.name))&&';
  s=substituteOnce(s,anchor,anchor+'!HOJA_RANK_FORBIDDEN_.has(hojaRankNormalize_(r.name))&&');
 }
 s=patchArcadeQuestionSpots(s);
 s=patchArcadeControls(s);
 // HOJA 1.5: the approved parent renderer shows the question below the HUD. The original in-game quiz overlay
 // stays active (pause/input) but transparent, so the HUD (score, questions, time) is never covered.
 s=substituteOnce(s,'</head>','<style id="hoja15ArcadeQuizUnderlay">#quizOverlay.active{background:transparent!important}#quizOverlay.active #quizCard{visibility:hidden!important}</style>\n</head>');
 return substituteOnce(s,'</body>',CHILD_SCRIPT+'\n</body>');
}

/* 40-6CB (teacher): 6 question balloons per map (5 maps = 30 spots) while the run still ends at 25 questions.
 * Surface maps: after the random assembly, ONE extra balloon is placed on the floor spot FARTHEST from every existing
 * question point (balloons, hidden-quiz stones, secrets), away from start/goal/water/caves/springs/walkers, and only
 * accepted if the stage's own reachability audit (checkStage) reports nothing new. Cave: the generator picks 6 question
 * rooms (distinct rooms, >= 8 tiles apart) and the fixed fallback cave gets a 6th balloon (moved by its own safe-spot pass).
 * TOTAL_QUESTIONS, the 25-question deck guard and the approved 25/25/25 ranking condition stay 25. */
const SIXTH_BALLOON_FN=`function hoja15AddSixthBalloon(st){
  const pts=[...st.enemies.filter(e=>e.type==='BALLOONEY').map(e=>({x:e.x,y:e.y-25})),
    ...st.bricks.filter(b=>b.hiddenQuiz).map(b=>({x:b.x+16,y:b.y+16})),
    ...(st.secrets||[]).map(b=>({x:b.x+16,y:b.y+16}))];
  const grounds=st.solids.filter(s=>s.kind==='ground');
  const top=x=>{let b=null;for(const s of grounds)if(x>=s.x&&x<s.x+s.w)b=b===null?s.y:Math.min(b,s.y);return b;};
  const near=(ranges,x,m)=>(ranges||[]).some(([a,b])=>x>T(a)-m&&x<T(b)+m);
  const boxes=[...st.solids,...(st.crumbles||[]),...(st.rafts||[]).map(r=>({x:r.x,y:r.y,w:r.w,h:TILE})),
    ...st.bricks.map(b=>({x:b.x,y:b.y,w:32,h:32})),...(st.secrets||[]).map(b=>({x:b.x,y:b.y,w:32,h:32}))];
  const before=checkStage(st).length;
  // strict pass first; later passes only shrink the safety margins (never the reachability audit)
  // far enough from every existing ? first (>= 12 tiles); only if no such safe spot exists, take the farthest safe one
  for(const [sg,wc,en,far] of [[10,3,3,12],[6,2,1,12],[4,1,-1,12],[6,2,1,0],[4,1,-1,0]]){
    const cands=[];
    for(const s of grounds)for(let x=s.x+TILE;x<=s.x+s.w-TILE;x+=TILE){
      if(top(x)!==s.y)continue;
      const y=s.y-2*TILE;
      if(Math.abs(x-T(st.start))<sg*TILE||Math.abs(x-T(st.goal))<sg*TILE)continue;
      if(near(st.water,x,wc*TILE)||near(st.caves,x,wc*TILE))continue;
      if((st.springs||[]).some(p=>Math.abs(p.x+16-x)<2*TILE))continue;
      if((st.moving||[]).some(m=>{const l=m.axis==='x'?m.min:m.x,r=m.axis==='x'?m.max+m.w:m.x+m.w;return x+2*TILE>l&&x-2*TILE<r;}))continue;
      if(en>=0&&st.enemies.some(e=>e.type!=='BALLOONEY'&&x+en*TILE>e.min&&x-en*TILE<e.max&&Math.abs(e.y-s.y)<5*TILE))continue;
      if(boxes.some(o=>o!==s&&x+24>o.x&&x-24<o.x+o.w&&o.y<s.y&&o.y+(o.h||TILE)>y-96))continue;
      cands.push({x,y,d:Math.min(...pts.map(p=>Math.hypot(p.x-x,p.y-(y-25))))});
    }
    cands.sort((a,b)=>b.d-a.d);
    for(const c of cands){
      if(c.d<far*TILE)break;
      st.enemies.push({type:'BALLOONEY',x:c.x,y:c.y,min:c.x-2*TILE,max:c.x+2*TILE,hoja15Sixth:true});
      if(checkStage(st).length<=before){st.hoja15SixthBalloon={x:Math.round(c.x/TILE),nearestTiles:Math.round(c.d/TILE),pass:sg*100+far};return st;}
      st.enemies.pop();
    }
  }
  throw new Error('HOJA15_SIXTH_BALLOON_NO_SAFE_SPOT_'+st.id);
}
`;
export function patchArcadeQuestionSpots(html){
 let s=html;
 s=substituteOnce(s,"pick('question',5)","pick('question',6)");
 s=substituteOnce(s,"if(map.questions.length!==5)errors.push('QUESTION_COUNT');","if(map.questions.length!==6)errors.push('QUESTION_COUNT');");
 s=substituteOnce(s,"model.questionPoints.length!==5","model.questionPoints.length!==6");
 s=substituteOnce(s,"if(questionCount!==5)throw new Error('CAVE_QUESTION_COUNT_MISMATCH');","if(questionCount!==6)throw new Error('CAVE_QUESTION_COUNT_MISMATCH');");
 s=substituteOnce(s,"    caveBalloon(101,110),    // deep end chamber\n","    caveBalloon(101,110),    // deep end chamber\n    caveBalloon(44,74),      // HOJA 1.5: 6th question (moved by the safe-spot pass if blocked)\n");
 s=substituteOnce(s,"function capSurfaceQuestions(st){",SIXTH_BALLOON_FN+"function capSurfaceQuestions(st){\n  st.enemies=st.enemies.filter(e=>!e.hoja15Sixth);   // a reused template never keeps an old 6th");
 // keep the original 5 (same trimming as before), then add the far-away 6th
 s=substituteOnce(s,"  if(count!==5)throw new Error(`Surface level ${st.id} has ${count} ? pickups, expected 5`);",
  "  if(count!==5)throw new Error(`Surface level ${st.id} has ${count} ? pickups, expected 5`);\n  hoja15AddSixthBalloon(st);\n  if(stageQuestionCount(st)!==6)throw new Error(`Surface level ${st.id} expected 6 ? pickups`);");
 s=substituteOnce(s,"const TOTAL_QUESTIONS=5*STAGES.length;","const TOTAL_QUESTIONS=25;");
 return s;
}

/* 40-6BG: the HOJA control contract (A/D move, W door, S down/pipe, ',' run, '.' jump, Enter confirm, H help) as ONE
 * patch shared by the arcade and the practice outdoor stage (R17S stage 0), so practice teaches the real keys. */
export function patchArcadeControls(html){
 if(typeof html!=='string'||html.includes('hojaTrialControlsHelpScript'))throw Error('ARCADE_CONTROLS_ALREADY_PATCHED');
 let s=html;
 // Trial-only Phaser 2.0 input contract and death continue; original archive stays immutable.
 s=substituteOnce(s,"↑ 한 번 더: 끝내기","W 한 번 더: 끝내기");
 s=substituteOnce(s,"Enter / Space ▶ 스테이지 ","Enter ▶ 스테이지 ");

 s=substituteOnce(s,"    const acting=this.keys.left.isDown||this.keys.right.isDown||\n      this.keys.a.isDown||this.keys.d.isDown||\n      this.keys.up.isDown||this.keys.w.isDown||\n      this.keys.down.isDown||this.keys.s.isDown||\n      this.keys.jump.isDown||this.keys.z.isDown;","    const acting=this.keys.a.isDown||this.keys.d.isDown||\n      this.keys.w.isDown||this.keys.s.isDown||this.keys.jump.isDown||this.keys.jump2.isDown;");

 s=substituteOnce(s,"      jump:this.input.keyboard.addKey(K.SPACE),z:this.input.keyboard.addKey(K.Z),\n      run:this.input.keyboard.addKey(K.SHIFT),x:this.input.keyboard.addKey(K.X),","      jump:this.input.keyboard.addKey(K.PERIOD),z:this.input.keyboard.addKey(K.Z),\n      run:this.input.keyboard.addKey(K.COMMA),x:this.input.keyboard.addKey(K.X),\n      jump2:this.input.keyboard.addKey(K.SPACE),run2:this.input.keyboard.addKey(K.SHIFT),");
 s=substituteOnce(s,"    // STEP 10-A FIX: Phaser receives the Space key BEFORE cancelling the\n    // browser scroll action. Cancelling during window capture prevented\n    // some keyboard runtimes from ever registering the jump key.\n    this.input.keyboard.on('keydown-SPACE',ev=>{\n      if(!document.getElementById('hojaRankOverlay')?.classList.contains('is-open')\n         && !this.quizActive && !this.manualPaused)ev.preventDefault();\n    });","    // Period/Space jump, comma/Shift run (40-6CJ: Space+Shift are spare keys for keyboards that drop D+,+.).\n    // Space must not scroll the page or click a focused button.\n    this.input.keyboard.on('keydown-SPACE',ev=>{\n      if(!document.getElementById('hojaRankOverlay')?.classList.contains('is-open')\n         && !this.quizActive && !this.manualPaused)ev.preventDefault();\n    });");
 s=substituteOnce(s,"    const left=this.keys.left.isDown||this.keys.a.isDown;\n    const right=this.keys.right.isDown||this.keys.d.isDown;\n    const doubleTapRun=hojaDoubleTapRun(this.hojaDoubleTap,time,left,right);\n    const run=this.keys.run.isDown||this.keys.x.isDown||doubleTapRun;","    const left=this.keys.a.isDown;\n    const right=this.keys.d.isDown;\n    const run=this.keys.run.isDown||this.keys.run2.isDown;");
 s=substituteOnce(s,"    const downHeld=this.keys.down.isDown||this.keys.s.isDown;","    const downHeld=this.keys.s.isDown;");
 s=substituteOnce(s,"    const cameraMotion=!!(dir||this.keys.jump.isDown||this.keys.z.isDown||\n      this.keys.up.isDown||this.keys.w.isDown||\n      this.keys.down.isDown||this.keys.s.isDown||!grounded||","    const cameraMotion=!!(dir||this.keys.jump.isDown||this.keys.jump2.isDown||this.keys.w.isDown||\n      this.keys.s.isDown||!grounded||");
 s=substituteOnce(s,"    const enter=near.orientation==='up'?downPressed:\n      near.orientation==='down'?(this.keys.up.isDown||this.keys.w.isDown):\n      near.orientation==='left'?(this.keys.right.isDown||this.keys.d.isDown):\n      (this.keys.left.isDown||this.keys.a.isDown);","    const enter=near.orientation==='up'?downPressed:\n      near.orientation==='down'?this.keys.w.isDown:\n      near.orientation==='left'?this.keys.d.isDown:this.keys.a.isDown;");
 s=substituteOnce(s,"    const upArrowPressed=Phaser.Input.Keyboard.JustDown(this.keys.up);\n    const upWPressed=Phaser.Input.Keyboard.JustDown(this.keys.w);\n    const upPressed=upArrowPressed||upWPressed;\n    const usedDoor=this.updateDoors(time,upPressed,grounded);\n    const downArrowPressed=Phaser.Input.Keyboard.JustDown(this.keys.down);\n    const downSPressed=Phaser.Input.Keyboard.JustDown(this.keys.s);\n    const downPressed=downArrowPressed||downSPressed;","    const upPressed=Phaser.Input.Keyboard.JustDown(this.keys.w);\n    this.updateDoors(time,upPressed,grounded);\n    const downPressed=Phaser.Input.Keyboard.JustDown(this.keys.s);");
 s=substituteOnce(s,"    const spacePressed=Phaser.Input.Keyboard.JustDown(this.keys.jump);\n    const zPressed=Phaser.Input.Keyboard.JustDown(this.keys.z);\n    const jumpPressed=spacePressed||zPressed||(upPressed&&!usedDoor);","    const jumpPressed=Phaser.Input.Keyboard.JustDown(this.keys.jump)|Phaser.Input.Keyboard.JustDown(this.keys.jump2);");
 s=substituteOnce(s,"    const jumpHeld=this.keys.jump.isDown||this.keys.z.isDown||\n      this.keys.up.isDown||this.keys.w.isDown;","    const jumpHeld=this.keys.jump.isDown||this.keys.jump2.isDown;");
 s=substituteOnce(s,"      const pressed=Phaser.Input.Keyboard.JustDown(this.keys.enter)||\n        Phaser.Input.Keyboard.JustDown(this.keys.jump)||\n        Phaser.Input.Keyboard.JustDown(this.keys.z);","      const pressed=Phaser.Input.Keyboard.JustDown(this.keys.enter);");
 s=substituteOnce(s,"      if(ev.code!=='Enter'&&ev.code!=='Space')return;","      if(!['KeyW','KeyA','KeyS','KeyD','Comma','Period','Enter','Space','ShiftLeft','ShiftRight'].includes(ev.code))return;");
 // The death overlay must focus a real control inside the nested arcade iframe.
 // Otherwise keydown can remain on the parent frame after stage transitions.
 s=substituteOnce(s,"    window.addEventListener('keydown',this._hojaDeathKey,true);",
 "    window.addEventListener('keydown',this._hojaDeathKey,true);\n    document.getElementById('hojaDeathContinue')?.focus({preventScroll:true});");

 s=substituteOnce(s,"<button id=\"hojaDeathContinue\" type=\"button\">계속하기 ▶</button>","<button id=\"hojaDeathContinue\" type=\"button\">조작키 아무거나 눌러 계속 ▶</button>");
 s=substituteOnce(s,'</head>',HELP_SCRIPT+'\n</head>');
 // 40-6BG: in-game control legend follows the same contract.
 s=substituteOnce(s,'이동 <kbd>←→</kbd> / <kbd>A D</kbd> · 달리기 <kbd>Shift</kbd> 또는 방향 두 번 누르고 유지 · 점프 <kbd>↑</kbd>/<kbd>W</kbd>/<kbd>Space</kbd> · 강 STOMP <kbd>↓</kbd>/<kbd>S</kbd>',
  '이동 <kbd>A</kbd> <kbd>D</kbd> · 달리기 <kbd>,</kbd>/<kbd>Shift</kbd> · 점프 <kbd>.</kbd>/<kbd>Space</kbd> · 문 <kbd>W</kbd> · 공중 STOMP·토관 <kbd>S</kbd> · 도움말 <kbd>H</kbd>');
 return s;
}


export function createApprovedArcadeRuntime({core,getApprovedHTML,getArcadeFrame,getContainer}){
 // HOJA 1.5: reveal only after the question's choices are painted (no text-only flash).
 // HOJA 1.5 (40-6CI): Chrome pauses requestAnimationFrame in a hidden/minimized window, so the renderer cannot answer
 // (HOJA_RENDERER_TIMEOUT). That is not a failure: wait until the page is visible again and retry (no alert).
 const hojaIsTimeout_=e=>/HOJA_RENDERER_TIMEOUT/.test(String(e&&e.message||e));
 const hojaWhenVisible_=()=>document.visibilityState==='visible'?Promise.resolve():new Promise(r=>{const f=()=>{if(document.visibilityState==='visible'){document.removeEventListener('visibilitychange',f);r();}};document.addEventListener('visibilitychange',f);});
 async function hojaRetryRender_(fn){for(let i=0;;i++){try{return await fn();}catch(e){if(!hojaIsTimeout_(e)||i>=3)throw e;await hojaWhenVisible_();await new Promise(r=>setTimeout(r,400));}}}
 function hojaWhenDrawn_(f,qid){return new Promise(res=>{const t0=performance.now();const tick=()=>{let ok=false;try{const d=f.contentDocument,w=f.contentWindow;const cur=w.current&&w.current();const bs=[...d.querySelectorAll('#hqChoices button.hqChoice')];ok=!d.body.classList.contains('hojaAwaitShow')&&bs.length>0&&(!qid||(cur&&cur.id===qid))&&bs.every(b=>!b.dataset.hojaQid||b.dataset.hojaQid===(cur&&cur.id));}catch(_e){ok=true}if(ok||performance.now()-t0>1500){requestAnimationFrame(()=>res());return;}requestAnimationFrame(tick)};tick();});}
 if(!core?.createApprovedFrameHost||!core?.teamApprovedPayload)throw Error('ARCADE_APPROVED_CORE_REQUIRED');
 let catalog=null,active=null,overlay=null,frame=null,host=null,loading=null,epoch=0,focus=-1,review=null,reviewBar=null,reviewLabel=null,reviewNext=null;
 const wrong=new Map();
 function ensureUI(){
  if(overlay)return;
  const root=getContainer();if(!root)throw Error('ARCADE_APPROVED_CONTAINER_REQUIRED');
  overlay=document.createElement('div');overlay.id='hojaArcadeApprovedParentOverlay';
  overlay.style.cssText='position:absolute;left:0;right:0;top:62px;bottom:0;z-index:5000;background:#071421;display:none;';
  frame=document.createElement('iframe');frame.id='hojaArcadeApprovedParentFrame';frame.title='교사 승인 HOJA 아케이드 문제';
  frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;background:#071421';
  overlay.append(frame);
  reviewBar=document.createElement('div');reviewBar.id='hojaArcadeReviewBar';
  reviewBar.style.cssText='position:absolute;left:0;right:0;top:0;z-index:12;min-height:65px;max-height:32%;overflow:auto;display:none;align-items:center;gap:12px;padding:9px 14px;background:#12293e;color:#fff3cc;font:800 16px/1.5 system-ui';
  reviewLabel=document.createElement('span');reviewLabel.id='hojaArcadeReviewLabel';reviewLabel.style.cssText='flex:1;min-width:0;white-space:normal';
  reviewNext=document.createElement('button');reviewNext.id='hojaArcadeReviewNext';reviewNext.type='button';
  reviewNext.style.cssText='flex:none;min-width:120px;padding:7px 12px;border:2px solid #83c9be;border-radius:8px;background:#23555a;color:#fff;font-weight:bold;cursor:pointer';
  reviewNext.onclick=()=>{
    if(!review||review.loading||!review.answered)return;   // 40-6CF: each wrong question must be answered again first
    ++review.index;
    if(review.index>=review.items.length)finishReview();
    else showReviewItem();
  };
  reviewBar.append(reviewLabel,reviewNext);overlay.append(reviewBar);root.append(overlay);
 }
 // 40-6CF (teacher): the review is a real re-try. One answer per question; the ranking opens only if ALL are right.
 function reviewAnswer(d){
  const current=review;
  if(!current||current.waiting||current.loading||current.answered)return;
  const item=current.items[current.index],q=item.mapping.binding.rendererQuestion;
  if(d.questionId!==item.mapping.binding.questionId)return;
  const correctId=q.type==='OX'?String(!!q.answer.value):q.answer?.choiceId;
  const ok=typeof d.choiceId==='string'&&d.choiceId===correctId;
  current.answered=true;current.results[current.index]=ok;
  const answerText=q.type==='OX'?(q.answer.value?'O':'X'):(q.choices?.find(x=>x.id===q.answer?.choiceId)?.text||'');
  const mark=document.createElement('div');mark.id='hojaArcadeApprovedJudgment';
  mark.setAttribute('role','status');mark.setAttribute('aria-live','assertive');
  mark.style.cssText='position:absolute;inset:0;z-index:10;display:grid;place-items:center;pointer-events:none;background:rgba(5,12,21,.48)';
  const card=document.createElement('div');
  card.style.cssText='border-radius:20px;box-shadow:0 12px 55px #000a;padding:22px 45px;max-width:90%;font:900 clamp(28px,4.5vw,54px)/1.2 system-ui,sans-serif;text-align:center;color:#fff;border:4px solid rgba(255,255,255,.75);background:'+(ok?'#176c4b':'#a3263a');
  card.textContent=ok?'✓ 정답!':'✕ 오답'+(answerText?' · 정답: '+answerText:'');
  mark.append(card);overlay?.querySelector('#hojaArcadeApprovedJudgment')?.remove();overlay?.append(mark);
  const last=current.index===current.items.length-1;
  reviewLabel.textContent='오답 복습 '+(current.index+1)+'/'+current.items.length+' · '+(ok?'정답':'오답')+
    (last?(current.results.every(Boolean)&&current.results.length===current.items.length?' · 모두 맞혔어요! 랭킹 등록이 열립니다.':' · 모두 맞히지 못해 이번 기록은 랭킹에 등록되지 않아요.'):'');
  reviewNext.textContent=last?'복습 마치기':'다음 오답';reviewNext.style.display='';
  try{reviewNext.focus();}catch(_e){}
 }
 function answer(d){
  if(review&&!active){reviewAnswer(d);return;}
  const a=active;if(!a||a.responded||d.questionId!==a.mapping.binding.questionId)return;
  const ix=a.mapping.choiceIdToArcadeIndex[d.choiceId];
  if(!Number.isInteger(ix))return;
  a.responded=true;
  getArcadeFrame()?.contentWindow?.postMessage({type:'HOJA_ARCADE_APPROVED_SELECT',id:a.id,index:ix},'*');
 }
 function ensureHost(){
  if(loading)return loading;
  ensureUI();
  loading=new Promise((resolve,reject)=>{
   frame.addEventListener('load',async()=>{
    try{
     // HOJA 1.5: hide the renderer's unused top strip (HOJA · 혼자 놀기 / ROUND / TEAM / QUESTION).
     try{const d=frame.contentDocument;if(d&&!d.getElementById('hoja15NoTopStrip')){const st=d.createElement('style');st.id='hoja15NoTopStrip';st.textContent='body.hoja-embedded #hqTop{display:none!important}body.hoja-embedded #hqType,body.hoja-embedded #hqHint,body.hoja-embedded #hqStemLabel{display:none!important}body.hoja-embedded #hqStage{height:100%!important}';(d.head||d.documentElement).append(st);const sc=d.createElement('script');sc.textContent='(function(){if(window.__hoja15Fit)return;window.__hoja15Fit=1;fitScreen=function(){var a=state.res.split("x").map(Number),host=document.getElementById("screenWrap"),scr=document.getElementById("screen");var s=Math.min((host.clientWidth-4)/a[0],(host.clientHeight-4)/a[1]);scr.style.transform="scale("+s+") translate(-50%,-50%)";requestAnimationFrame(fitContent);};function fit(){try{var W=innerWidth,H=innerHeight;if(!W||!H)return;var h=1000,w=Math.max(1280,Math.min(2560,Math.round(h*W/H))),r=w+"x"+h;if(state.res!==r){state.res=r;updateStage();}fitScreen();}catch(e){}}addEventListener("resize",fit);fit();})();';(d.head||d.documentElement).append(sc);frame.contentWindow.dispatchEvent(new Event('resize'));}}catch(_e){}
     frame.contentWindow?.addEventListener('keydown',shortcut,true);
     host=core.createApprovedFrameHost({frame,onAnswer:answer,timeoutMs:15000});
     await hojaRetryRender_(()=>host.initialize());
     await hojaRetryRender_(()=>host.load(catalog.payload));
     resolve(host);
    }catch(err){reject(err)}
   },{once:true});
   frame.addEventListener('error',()=>reject(Error('ARCADE_APPROVED_FRAME_LOAD_FAILED')),{once:true});
   const html=getApprovedHTML();
   if(typeof html!=='string'||!html.includes('HOJA_APPROVED_RENDERER')){reject(Error('ARCADE_APPROVED_RENDERER_REQUIRED'));return}
   frame.srcdoc=html;
  });
  return loading;
 }
 function showLoading(){
  overlay.querySelector('#hojaArcadeApprovedLoading')?.remove();
  const label=document.createElement('div');
  label.id='hojaArcadeApprovedLoading';label.setAttribute('role','status');
  label.style.cssText='position:absolute;inset:0;z-index:9;display:grid;place-items:center;background:#071421;color:#e7f5ff;font:800 clamp(22px,3vw,34px) system-ui';
  label.textContent='승인 문제를 준비하는 중…';
  overlay.append(label);
 }
 function error(err){
  console.error('[HOJA arcade approved]',err);
  ensureUI();frame.style.visibility='hidden';overlay.style.display='block';
  overlay.querySelector('#hojaArcadeApprovedLoading')?.remove();
  const label=document.createElement('div');label.id='hojaArcadeApprovedError';label.setAttribute('role','alert');
  label.style.cssText='position:absolute;inset:20%;z-index:11;padding:30px;display:grid;place-items:center;text-align:center;color:#ffcccc;background:#501a26;border:3px solid #f9b1b1;border-radius:18px;font:bold 23px system-ui';
  label.textContent='승인 문제 연결 오류: '+String(err?.message||err)+' · 뒤로 가기로 종료하세요.';
  overlay.querySelector('#hojaArcadeApprovedError')?.remove();overlay.append(label);
 }
 async function open(msg){
  if(!catalog||typeof msg.id!=='string'||active){error(Error('ARCADE_APPROVED_REQUEST_INVALID'));return}
  let mapping;
  try{mapping=resolveApprovedArcadeChoice(catalog,msg.question,core)}
  catch(e){error(e);return}
  const local=++epoch;focus=-1;active={id:msg.id,mapping,responded:false,familyKey:msg.question.familyKey,kind:msg.question.type};
  ensureUI();frame.style.top='0';frame.style.height='100%';frame.style.visibility='hidden';overlay.style.display='block';showLoading();
  try{
   const h=await ensureHost();
   if(local!==epoch||active?.id!==msg.id)return;
   await hojaRetryRender_(()=>h.show({questionId:mapping.binding.questionId,mode:'solo',omitChoiceId:mapping.binding.omitChoiceId}));
   if(local!==epoch||active?.id!==msg.id)return;
   await hojaWhenDrawn_(frame,mapping.binding.questionId);
   if(local!==epoch||active?.id!==msg.id)return;
   overlay.querySelector('#hojaArcadeApprovedLoading')?.remove();frame.style.visibility='visible';
   // HOJA 1.5: keyboard focus was inside the Phaser frame; move it to the question so 1-3 / O·X work at once.
   try{frame.focus();frame.contentWindow?.focus();}catch(_e){}
  }catch(e){if(local===epoch)error(e)}
 }
 function verdict(msg){
  if(!active||active.id!==msg.id||!active.responded)return;
  if(msg.correct===false)wrong.set(active.familyKey+'\u0000'+active.kind,active.mapping);
  const mark=document.createElement('div');mark.id='hojaArcadeApprovedJudgment';
  mark.setAttribute('role','status');mark.setAttribute('aria-live','assertive');
  mark.style.cssText='position:absolute;inset:0;z-index:10;display:grid;place-items:center;pointer-events:none;background:rgba(5,12,21,.48)';
  // HOJA 1.5: same clear verdict card as the solo quiz mode (green = correct, red = wrong).
  const card=document.createElement('div');
  card.style.cssText='border-radius:20px;box-shadow:0 12px 55px #000a;padding:22px 45px;max-width:90%;font:900 clamp(28px,4.5vw,54px)/1.2 system-ui,sans-serif;text-align:center;color:#fff;border:4px solid rgba(255,255,255,.75);background:'+(msg.correct?'#176c4b':'#a3263a');
  card.textContent=msg.correct?'✓ 정답! +10점':'✕ 오답 · 0점';
  mark.append(card);
  overlay?.querySelector('#hojaArcadeApprovedJudgment')?.remove();overlay?.append(mark);
 }
 function close(msg){
  if(msg&&active?.id!==msg.id)return;
  ++epoch;active=null;host?.suspend();
  overlay?.querySelector('#hojaArcadeApprovedJudgment')?.remove();
  overlay?.querySelector('#hojaArcadeApprovedError')?.remove();
  overlay?.querySelector('#hojaArcadeApprovedLoading')?.remove();
  if(frame){frame.style.visibility='hidden';frame.style.top='0';frame.style.height='100%';}
  if(reviewBar)reviewBar.style.display='none';
  if(overlay)overlay.style.display='none';
  // HOJA 1.5: give the keyboard back to the game so the player can move without clicking.
  try{if(frame&&document.activeElement===frame)frame.blur();const g=getArcadeFrame();g?.focus();g?.contentWindow?.focus();}catch(_e){}
 }

 function finishReview(){
  const current=review;
  if(!current)return;
  review=null;
  close();
  const allCorrect=current.results.length===current.items.length&&current.results.every(x=>x===true);
  if(!allCorrect)reviewNotice(current.results.filter(x=>x===true).length,current.items.length);
  getArcadeFrame()?.contentWindow?.postMessage({type:'HOJA_ARCADE_APPROVED_REVIEW_DONE',id:current.id,allCorrect},'*');
 }
 function reviewNotice(right,total){
  const root=getContainer();if(!root)return;
  root.querySelector('#hojaArcadeReviewNotice')?.remove();
  const box=document.createElement('div');box.id='hojaArcadeReviewNotice';box.setAttribute('role','alert');
  box.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5002;max-width:min(88%,640px);padding:26px 30px;border-radius:18px;border:4px solid #ffdb67;background:#20304a;color:#fff;text-align:center;font:800 clamp(18px,2.2vw,26px)/1.5 system-ui,sans-serif;box-shadow:0 12px 50px #000b';
  const t=document.createElement('div');t.textContent='오답 복습 '+right+'/'+total+' 정답';t.style.cssText='font-size:1.35em;color:#ffdb67;margin-bottom:8px';
  const m=document.createElement('div');m.textContent='오답을 모두 맞혀야 랭킹에 등록할 수 있어요. 다시 도전해 보세요!';
  const b=document.createElement('button');b.type='button';b.id='hojaArcadeReviewNoticeOk';b.textContent='확인';
  b.style.cssText='margin-top:16px;padding:10px 34px;border-radius:12px;border:3px solid #ffdb67;background:#a3263a;color:#fff;font:900 1em system-ui;cursor:pointer';
  b.onclick=()=>{box.remove();try{const g=getArcadeFrame();g?.focus();g?.contentWindow?.focus();}catch(_e){}};
  box.append(t,m,b);root.append(box);setTimeout(()=>{try{b.focus();}catch(_e){}},50);
 }
 async function showReviewItem(){
  const current=review;
  if(!current||current.index>=current.items.length)return;
  const item=current.items[current.index],token=++epoch;
  current.loading=true;
  ensureUI();overlay.style.display='block';frame.style.visibility='hidden';showLoading();
  const binding=item.mapping.binding,q=binding.rendererQuestion;
  const answerText=q.type==='OX'?(q.answer.value?'O':'X'):
    (q.choices?.find(x=>x.id===q.answer?.choiceId)?.text||'정답 정보를 확인하세요');
  void answerText;   // 40-6CF: the answer is NOT shown before the re-try
  current.answered=false;overlay.querySelector('#hojaArcadeApprovedJudgment')?.remove();
  reviewLabel.textContent='오답 복습 '+(current.index+1)+'/'+current.items.length+' · 다시 풀어 보세요 (모두 맞히면 랭킹 등록)';
  reviewNext.textContent=current.index===current.items.length-1?'복습 마치기':'다음 오답';reviewNext.style.display='none';
  reviewBar.style.display='flex';
  const barHeight=Math.ceil(reviewBar.getBoundingClientRect().height);
  // HOJA 1.5: an iframe does not stretch between top/bottom (height:auto = 150px -> the tiny review); size it explicitly.
  frame.style.top=barHeight+'px';frame.style.bottom='';frame.style.height='calc(100% - '+barHeight+'px)';
  try{
   const h=await ensureHost();
   if(token!==epoch||review!==current)return;
   await hojaRetryRender_(()=>h.show({questionId:binding.questionId,mode:'review',omitChoiceId:binding.omitChoiceId}));
   if(token!==epoch||review!==current)return;
   await hojaWhenDrawn_(frame,binding.questionId);
   if(token!==epoch||review!==current)return;
   overlay.querySelector('#hojaArcadeApprovedLoading')?.remove();
   frame.style.visibility='visible';
   current.loading=false;
  }catch(e){if(token===epoch)error(e)}
 }
 function startReview(msg){
  if(active||review||!catalog||typeof msg.id!=='string'||!Array.isArray(msg.wrong)){
   error(Error('ARCADE_REVIEW_BAD_REQUEST'));return;
  }
  let items;
  try{
   const keys=new Set();
   items=msg.wrong.map(x=>{
    if(!x||typeof x.key!=='string'||(x.type!=='MC'&&x.type!=='OX'))throw Error('ARCADE_REVIEW_INVALID_ROW');
    const key=x.key+'\u0000'+x.type,mapping=wrong.get(key);
    if(!mapping||keys.has(key))throw Error('ARCADE_REVIEW_WRONG_MAPPING_MISSING_OR_DUPLICATE');
    keys.add(key);return {key,mapping};
   });
   if(!items.length)throw Error('ARCADE_REVIEW_EMPTY_REQUEST');
  }catch(e){error(e);return}
  review={id:msg.id,items,index:0,loading:false,waiting:true,answered:false,results:[]};
  // HOJA 1.5: leave the results screen up; the player starts the review with a button (no auto jump).
  const root=getContainer();
  root?.querySelector('#hojaArcadeReviewStart')?.remove();
  const go=document.createElement('button');go.id='hojaArcadeReviewStart';go.type='button';
  go.textContent='오답 풀기 ('+items.length+'문항) ▶';
  go.style.cssText='position:absolute;left:50%;bottom:6%;transform:translateX(-50%);z-index:5001;padding:14px 30px;border-radius:14px;border:3px solid #ffdb67;background:#a3263a;color:#fff;font:900 clamp(18px,2.4vw,28px) system-ui,sans-serif;box-shadow:0 8px 28px #000a;cursor:pointer';
  go.onclick=()=>{go.remove();if(review===null||!review.waiting)return;review.waiting=false;showReviewItem();};
  root?.append(go);
 }
 function shortcut(ev){
  if(frame?.style.visibility!=='visible')return;
  const cur=review?(review.waiting||review.loading||review.answered?null:{mapping:review.items[review.index].mapping,responded:false}):active;
  if(!cur||cur.responded||ev.repeat||ev.isComposing||ev.ctrlKey||ev.altKey||ev.metaKey)return;
  if(['INPUT','TEXTAREA','SELECT'].includes(ev.target?.tagName)||ev.target?.isContentEditable)return;
  const buttons=[...(frame?.contentDocument?.querySelectorAll('#hqChoices button.hqChoice')||[])];
  if(!buttons.length)return;
  const code=ev.code,arrows=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  let index=-1;
  if(/^Digit[123]$/.test(code)||/^Numpad[123]$/.test(code))index=Number(code.at(-1))-1;
  else if(cur.mapping.binding.rendererQuestion.type==='OX'&&(code==='KeyO'||code==='KeyX'))
   index=buttons.findIndex(b=>b.dataset.choice===(code==='KeyO'?'true':'false'));
  else if(!arrows.includes(code)&&code!=='Enter'&&code!=='NumpadEnter'&&code!=='Space')return;
  ev.preventDefault();ev.stopImmediatePropagation();
  if(arrows.includes(code)){
   focus=(focus+(code==='ArrowLeft'||code==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
   buttons[focus].focus();
   buttons.forEach((b,i)=>b.style.outline=i===focus?'4px solid #ffdb67':'');
   return;
  }
  if(index<0)index=focus>=0?focus:0;
  buttons[index]?.click();
 }
 function onMessage(ev){
  if(!getArcadeFrame()?.contentWindow||ev.source!==getArcadeFrame().contentWindow||!ev.data||typeof ev.data!=='object')return;
  if(ev.data.type==='HOJA_ARCADE_APPROVED_OPEN')open(ev.data);
  else if(ev.data.type==='HOJA_ARCADE_APPROVED_VERDICT')verdict(ev.data);
  else if(ev.data.type==='HOJA_ARCADE_APPROVED_CLOSE')close(ev.data);
  else if(ev.data.type==='HOJA_ARCADE_APPROVED_REVIEW_START')startReview(ev.data);
 }
 window.addEventListener('message',onMessage);
 window.addEventListener('keydown',shortcut,true);
 return Object.freeze({
  configure(sources){getContainer()?.querySelector('#hojaArcadeReviewStart')?.remove();getContainer()?.querySelector('#hojaArcadeReviewNotice')?.remove();review=null;wrong.clear();close();catalog=createApprovedArcadeCatalog(sources,core);
   // HOJA 1.5: prepare the question renderer while the arcade is still starting, not at the first question.
   // Its one-time load (renderer document, unit payload, images) otherwise ran into the first resume and the
   // arcade (dt clamped at 35 ms) played in slow motion for a few seconds.
   setTimeout(()=>{if(catalog)ensureHost().catch(()=>{})},0);
   return catalog.count},
  patchHTML(html){if(!catalog)throw Error('ARCADE_APPROVED_NOT_CONFIGURED');return patchApprovedArcadeInnerHTML(html)},
  patchControls(html){return patchArcadeControls(html)},
  reset(){getContainer()?.querySelector('#hojaArcadeReviewStart')?.remove();getContainer()?.querySelector('#hojaArcadeReviewNotice')?.remove();review=null;wrong.clear();close();catalog=null;host?.close();frame?.remove();overlay?.remove();host=null;frame=null;overlay=null;reviewBar=null;reviewLabel=null;reviewNext=null;loading=null},
  get state(){return {configured:!!catalog,count:catalog?.count||0,activeId:active?.id||null,reviewIndex:review?.index??null,reviewCount:review?.items.length??0}}
 });
}

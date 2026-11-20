// Diagnostic code is inserted only in the instrumented test build.
export const benchmarkSource = `// V0.53: Compare backing-buffer pixel cost on an identical frozen scene.
// The renderer keeps painting, but Arcade physics/game time are paused.
// This measures browser frame pacing, NOT GPU-only render timings.
const HOJA_V053_BENCH={
  active:false,scene:null,raf:0,phase:0,phaseStart:0,lastFrame:0,
  samples:[],results:[],saved:null,
  modes:[0,1,1,0],warmMs:1700,collectMs:4000,
  panel(){return document.getElementById('hojaV053Panel');},
  show(t){const p=this.panel();if(p){p.style.display='block';p.textContent=t;}},
  quick(scene){
    if(this.active)return;
    if(!scene||scene!==ACTIVE_SCENE)return;
    const mode=QUALITY_MODE===1?0:1;
    changeQualityMode(mode,true);
    scene.fpsSamples.length=0;
    this.show(\`수동 배율: \${mode===1?'1.0배':'최대 1.5배'}\\n\`+
      '동일 위치에서 FPS를 비교하세요.\\nK: 정지 장면 자동 교차 측정');
  },
  toggle(scene){if(this.active){this.finish(true,'사용자가 측정을 취소했습니다.');return;}this.start(scene);},
  start(scene){
    if(!scene||scene!==ACTIVE_SCENE||scene.manualPaused||scene.quizActive||
       scene.dying||scene.clear||scene.timeUp||scene.transitioning){
      this.show('게임 플레이 중에만 측정할 수 있습니다.\\n일시정지·퀴즈·종료 중에는 실행할 수 없습니다.');return;
    }
    const maxRS=Math.max(1,Math.min(1.5,(window.devicePixelRatio||1)*
      document.getElementById('gameViewport').getBoundingClientRect().width/Math.max(1,VIEW_W)));
    if(maxRS<1.42){
      this.show(\`현재 화면은 최대 \${maxRS.toFixed(2)}배만 지원합니다.\\n창/화면 배율을 조정하여 1.5배가 가능할 때 측정하세요.\`);return;
    }
    this.scene=scene;this.saved={mode:QUALITY_MODE,manual:QUALITY_MANUAL,scale:RS};
    this.results=[];this.active=true;this.phase=-1;this.samples=[];
    scene.toggleManualPause(); // freezes game timer and Arcade physics
    if(scene.pauseText)scene.pauseText.setText(''); // do not obscure scene
    const btn=document.getElementById('scaleBenchBtn');
    if(btn)btn.textContent='측정 중단 (K)';
    const q=document.getElementById('qualityBtn');if(q)q.disabled=true;
    const quick=document.getElementById('scaleQuickBtn');if(quick)quick.disabled=true;
    this.nextPhase();
  },
  nextPhase(){
    this.phase++;
    if(this.phase>=this.modes.length){this.finish(false);return;}
    const mode=this.modes[this.phase];
    changeQualityMode(mode===0?0:1,true);
    this.phaseStart=0;this.lastFrame=0;this.samples=[];
    this.show(\`V0.53 고정 화면 성능 비교 (K: 취소)\\n\`+
      \`진행 \${this.phase+1}/4 · \${mode===0?'1.5배':'1.0배'} 렌더링\\n\`+
      '같은 위치 · 같은 시간대 · 게임 시간 정지\\n'+
      '배율 변경 직후 대기 중…');
    this.raf=requestAnimationFrame(t=>this.tick(t));
  },
  tick(t){
    if(!this.active)return;
    if(document.hidden||this.scene!==ACTIVE_SCENE){this.finish(true,'창이 숨겨지거나 맵이 변경되어 측정을 중단했습니다.');return;}
    if(!this.phaseStart){this.phaseStart=t;this.lastFrame=t;}
    const elapsed=t-this.phaseStart;
    const dt=t-this.lastFrame;this.lastFrame=t;
    if(dt>400){this.finish(true,'브라우저 프레임이 장시간 중단되어 측정이 무효화됐습니다.');return;}
    if(elapsed>=this.warmMs&&dt>0&&dt<400)this.samples.push(dt);
    const duration=this.warmMs+this.collectMs;
    if(elapsed>=duration){
      const a=this.samples.slice().sort((x,y)=>x-y);
      if(a.length<45){this.finish(true,'표본 프레임이 부족해 측정을 중단했습니다.');return;}
      const total=a.reduce((v,x)=>v+x,0);
      const low=a.slice(Math.floor(a.length*.9));
      const avg=1000*a.length/Math.max(1,total);
      const lowFps=1000/Math.max(1,low.reduce((v,x)=>v+x,0)/low.length);
      const p95=a[Math.floor((a.length-1)*.95)];
      const expected=this.modes[this.phase]===0?1.5:1.0;
      this.results.push({mode:expected,scale:RS,avg,lowFps,p95,n:a.length});
      this.nextPhase();return;
    }
    if(elapsed%1000<35){
      this.show(\`V0.53 고정 화면 성능 비교 (K: 취소)\\n\`+
      \`진행 \${this.phase+1}/4 · \${this.modes[this.phase]===0?'1.5배':'1.0배'} (실제 \${RS.toFixed(2)}배)\\n\`+
      \`\${elapsed<this.warmMs?'워밍업':'측정 중'} \${Math.round(elapsed/1000)} / \${Math.round(duration/1000)}초\\n\`+
      '※ 동일한 정지 화면에서 렌더링 프레임 시간만 비교');
    }
    this.raf=requestAnimationFrame(v=>this.tick(v));
  },
  finish(cancelled=false,reason=''){
    cancelAnimationFrame(this.raf);this.raf=0;
    const wasActive=this.active;this.active=false;
    if(wasActive&&this.scene===ACTIVE_SCENE&&this.scene?.manualPaused){
      this.scene.toggleManualPause();
    }
    const saved=this.saved;
    if(saved){changeQualityMode(saved.mode,true);QUALITY_MANUAL=saved.manual;}
    const btn=document.getElementById('scaleBenchBtn');
    if(btn)btn.textContent='배율 자동 측정 (K)';
    const q=document.getElementById('qualityBtn');if(q)q.disabled=false;
    const quick=document.getElementById('scaleQuickBtn');if(quick)quick.disabled=false;
    if(cancelled){this.show('렌더링 비교 중단\\n'+reason);return;}
    const g15=this.results.filter(x=>x.mode===1.5);
    const g10=this.results.filter(x=>x.mode===1.0);
    const avg=g=>g.reduce((v,x)=>v+x.avg,0)/Math.max(1,g.length);
    const low=g=>g.reduce((v,x)=>v+x.lowFps,0)/Math.max(1,g.length);
    const m15=avg(g15),m10=avg(g10);
    let verdict='정지 장면에서도 두 배율이 모두 낮습니다. 추가 렌더링 분석 필요.';
    if(m10>=57&&m15<=53)verdict='픽셀 처리량 병목 가능성이 큽니다. 렌더링 배율 차이에 민감합니다.';
    else if(m10-m15<3&&m10<55)verdict='배율의 영향이 작습니다. 드로우콜·합성·브라우저 병목을 더 조사하세요.';
    else if(m10>=57&&m15>=57)verdict='정지 화면에서는 두 배율 모두 양호합니다. 플레이 중 부하를 따로 확인하세요.';
    else if(m10-m15>=4)verdict='배율에 따른 차이가 있습니다. 실제 플레이에서도 재검증하세요.';
    const rows=this.results.map((r,i)=>\`\${i+1}회 \${r.mode.toFixed(1)}배 → \${r.scale.toFixed(2)}배 · 평균 \${r.avg.toFixed(1)} FPS · 하위10% \${r.lowFps.toFixed(1)} · p95 \${r.p95.toFixed(1)}ms\`).join('\\n');
    this.show(\`V0.53 측정 완료 — 정지 화면 렌더링 비교\\n\`+
      \`\${rows}\\n\\n\`+
      \`1.5배 평균 \${m15.toFixed(1)} / 하위10% \${low(g15).toFixed(1)} FPS\\n\`+
      \`1.0배 평균 \${m10.toFixed(1)} / 하위10% \${low(g10).toFixed(1)} FPS\\n\`+
      \`차이 \${(+ (m10-m15)).toFixed(1)} FPS (1배−1.5배)\\n\`+
      \`\${verdict}\\n\`+
      '※ 브라우저 RAF 간격 측정. GPU 시간 직접 측정 아님. 원래 배율·게임 시간 복구.');
    this.saved=null;this.scene=null;
  }
};
window.HOJA_V053_BENCH=HOJA_V053_BENCH;

// V0.54: fixed-camera, rendering-only ablation. Does not destroy geometry,
// physics bodies, enemy state, or question/flower progression.
// rAF interval is a browser frame-pacing metric, not a GPU timer query.
// V0.55 steady scene benchmark: A(original) / B(chunk) / B / A, same camera,
// same simulation state, same 1.5x render scale and restored on completion.
const HOJA_V055_BENCH={
  active:false,scene:null,raf:0,phase:-1,stamp:0,last:0,samples:[],results:[],
  modes:[false,true,true,false],warmMs:900,measureMs:3600,
  panel(){return document.getElementById('hojaV053Panel');},
  show(s){const p=this.panel();if(p){p.style.display='block';p.textContent=s;}},
  toggle(scene){if(this.active)this.finish(true,'사용자가 취소했습니다.');else this.start(scene);},
  start(scene){
    if(STAGE.theme==='cave'||!scene?.v055Chunks?.length||scene!==ACTIVE_SCENE||
       scene.manualPaused||scene.quizActive||scene.dying||scene.clear||scene.timeUp||
       HOJA_V053_BENCH.active||HOJA_V054_RENDER_AB.active){
      this.show('지상 1~4맵의 정상 플레이 중에만 I 청크 비교가 가능합니다.');return;
    }
    this.scene=scene;this.saved=scene.surfaceChunkMode;
    this.active=true;this.phase=-1;this.results=[];
    scene.toggleManualPause();if(scene.pauseText)scene.pauseText.setText('');
    const btn=document.getElementById('v055BenchBtn');
    if(btn)btn.textContent='청크 비교 중단 (I)';
    for(const id of ['renderBenchBtn','scaleBenchBtn','qualityBtn','cullPerfBtn']){
      const b=document.getElementById(id);if(b)b.disabled=true;
    }
    this.next();
  },
  next(){
    this.phase++;
    if(this.phase===this.modes.length){this.finish(false);return;}
    this.scene.toggleSurfaceChunks(this.modes[this.phase]);
    this.stamp=0;this.last=0;this.samples=[];
    this.show(\`V0.56 지상 \${STAGE_INDEX+1}맵(\${STAGE.theme}) 청크 A/B · I 취소\\n\`+
      \`\${this.phase+1}/4 · \${this.modes[this.phase]?'청크':'원본'} 렌더링, 배율 \${RS.toFixed(2)}배\\n\`+
      \`월드/물리 정지, 초기 안정화 중…\`);
    this.raf=requestAnimationFrame(t=>this.tick(t));
  },
  tick(t){
    if(!this.active)return;
    if(this.scene!==ACTIVE_SCENE||document.hidden){this.finish(true,'창/맵 변경으로 중단');return;}
    if(!this.stamp){this.stamp=t;this.last=t;}
    const dt=t-this.last;this.last=t;
    if(dt>500){this.finish(true,'프레임 장시간 중단으로 측정 무효');return;}
    const elapsed=t-this.stamp;
    if(elapsed>=this.warmMs&&dt>0&&dt<500)this.samples.push(dt);
    if(elapsed>=this.warmMs+this.measureMs){
      const a=this.samples.slice().sort((x,y)=>x-y);
      if(a.length<70){this.finish(true,'유효 표본 부족');return;}
      const avg=a.reduce((sum,x)=>sum+x,0)/a.length;
      const slow=a.slice(Math.floor(a.length*.9));
      this.results.push({chunk:this.modes[this.phase],fps:1000/avg,
        low:1000/(slow.reduce((sum,x)=>sum+x,0)/slow.length),
        p95:a[Math.floor((a.length-1)*.95)],
        objs:this.scene.v056RenderObjectCount?.()??0});
      this.next();return;
    }
    if(Math.floor(elapsed/900)!==Math.floor((elapsed-dt)/900)){
      this.show(\`V0.56 청크 A/B · I 취소\\n\${this.phase+1}/4 \${this.modes[this.phase]?'청크':'원본'} \`+
        \`(\${(elapsed/1000).toFixed(1)}초)\\n월드/물리 정지 · 배율 \${RS.toFixed(2)}배\`);
    }
    this.raf=requestAnimationFrame(t2=>this.tick(t2));
  },
  finish(cancelled=false,why=''){
    if(this.raf)cancelAnimationFrame(this.raf);
    const scene=this.scene,was=this.active;
    this.active=false;this.raf=0;
    if(was&&scene===ACTIVE_SCENE&&scene?.v055Chunks?.length){
      scene.toggleSurfaceChunks(this.saved);
      if(scene.manualPaused)scene.toggleManualPause();
    }
    for(const id of ['renderBenchBtn','scaleBenchBtn','qualityBtn','cullPerfBtn']){
      const b=document.getElementById(id);if(b)b.disabled=false;
    }
    const btn=document.getElementById('v055BenchBtn');if(btn)btn.textContent='지형 청크 자동 비교 (I)';
    if(cancelled){this.show('청크 성능 비교 취소: '+why);return;}
    const a=this.results.filter(x=>!x.chunk),b=this.results.filter(x=>x.chunk);
    const mean=(arr,k)=>arr.reduce((s,x)=>s+x[k],0)/arr.length;
    const st=scene?.v056ChunkStats||{};
    const report={version:'V0.56',stage:STAGE_INDEX+1,theme:STAGE.theme,
      band:hojaPaletteBand(scene?.remainingMs??RUN.remainingMs,STAGE.theme),
      renderScale:RS,results:this.results,
      chunkAvgFps:mean(b,'fps'),originalAvgFps:mean(a,'fps'),
      chunkLow10:mean(b,'low'),originalLow10:mean(a,'low'),
      chunkP95:mean(b,'p95'),originalP95:mean(a,'p95'),chunkStats:st};
    (window.HOJA_V056_BENCH_LOG=window.HOJA_V056_BENCH_LOG||[]).push(report);
    this.show(\`V0.56 지상 \${STAGE_INDEX+1}맵(\${STAGE.theme}) 정적 지형 렌더링 비교 완료\\n\`+
      this.results.map((x,i)=>\`\${i+1}회 \${x.chunk?'청크':'원본'}: \${x.fps.toFixed(1)} FPS · 하위10% \${x.low.toFixed(1)} · p95 \${x.p95.toFixed(1)}ms · 렌더 객체 \${x.objs}\`).join('\\n')+
      \`\\n\\n원본 평균 \${mean(a,'fps').toFixed(1)} FPS / 청크 평균 \${mean(b,'fps').toFixed(1)} FPS\`+
      \`\\n원본 하위10% \${mean(a,'low').toFixed(1)} / 청크 하위10% \${mean(b,'low').toFixed(1)} · p95 \${mean(a,'p95').toFixed(1)}→\${mean(b,'p95').toFixed(1)}ms\`+
      \`\\n차이 \${(mean(b,'fps')-mean(a,'fps')).toFixed(1)} FPS\`+
      \`\\n청크 \${st.groups??0}구역 × 3시간대 = 텍스처 \${st.textures??0}장 · 원본 소스 \${st.sources??0}개\`+
      \`\\n청크 생성 \${(st.bakeMs??0).toFixed(0)}ms · 캐시 메모리 추정 \${(st.memMB??0).toFixed(1)}MB\`+
      \`\\n※ 실제 모니터 프레임 간격. GPU 직접 측정 아님. 화면 안정 시 원본과 같은 모양인지도 비교하세요.\`);
  }
};

const HOJA_V054_RENDER_AB={
  active:false,scene:null,raf:0,step:-1,startedAt:0,lastAt:0,
  objects:[],samples:[],results:[],savedPanel:'',
  order:['A','B','C','D','E','D','C','B','A'],
  warmMs:650,collectMs:2450,
  names:{A:'전체 렌더링',B:'배경 레이어 제외',C:'정적 타일·장식 제외',
         D:'적·이동발판·기타 월드 요소 제외',E:'호자만 남기는 최소 렌더링'},
  panel(){return document.getElementById('hojaV053Panel');},
  show(message){const el=this.panel();if(el){el.style.display='block';el.textContent=message;}},
  start(scene){
    if(this.active)return;
    if(!scene||scene!==ACTIVE_SCENE||STAGE.theme==='cave'||scene.manualPaused||
       scene.quizActive||scene.dying||scene.clear||scene.timeUp||scene.transitioning||
       HOJA_V053_BENCH.active||HOJA_V055_BENCH.active){
      this.show('지상 맵의 정상 플레이 중에만 T 렌더링 비교를 시작할 수 있습니다.\\n기존 K 배율 테스트와 동시 실행할 수 없습니다.');return;
    }
    const fixed=new Set((scene.fixedHUD||[]).map(x=>x.obj));
    [scene.hoja,scene.playerBody,scene.pauseText,scene.clearText,
     scene.nextText,scene.stageBanner,scene.comboText].forEach(o=>{if(o)fixed.add(o);});
    const back=new Set((scene.bgLayers||[]).map(x=>x.sprite));
    if(scene.caveBackground)back.add(scene.caveBackground);
    const staticSet=new Set((scene.staticScenery||[]).map(x=>x.o));
    const objects=[];
    for(const o of scene.children.list){
      if(!o||typeof o.setVisible!=='function'||fixed.has(o))continue;
      // Captured once before freezing updates. Invisible colliders stay invisible.
      const group=back.has(o)?'background':staticSet.has(o)?'terrain':'other';
      objects.push({o,group,wasVisible:!!o.visible});
    }
    const counts={background:0,terrain:0,other:0};
    for(const x of objects)if(x.wasVisible)counts[x.group]++;
    if(!counts.background||!counts.terrain){
      this.show('배경 또는 지형 렌더 대상이 없는 장면입니다. 다른 지상 위치에서 다시 시도하세요.');return;
    }
    this.scene=scene;this.objects=objects;this.counts=counts;
    this.results=[];this.samples=[];this.step=-1;this.active=true;
    const old=this.panel();this.savedPanel=old?.style.display==='block'?old.textContent:'';
    scene.toggleManualPause();
    if(scene.pauseText)scene.pauseText.setText('');
    const button=document.getElementById('renderBenchBtn');
    if(button)button.textContent='렌더 비교 중단 (T)';
    for(const id of ['scaleBenchBtn','scaleQuickBtn','qualityBtn','bgPerfBtn','cullPerfBtn','lampPerfBtn']){
      const btn=document.getElementById(id);if(btn)btn.disabled=true;
    }
    this.next();
  },
  switchVisibility(code){
    for(const item of this.objects){
      let visible=item.wasVisible;
      if(code==='B'&&item.group==='background')visible=false;
      if(code==='C'&&item.group==='terrain')visible=false;
      if(code==='D'&&item.group==='other')visible=false;
      if(code==='E')visible=false;
      // Rendering-only: bodies remain enabled, physics state unchanged.
      if(item.o.visible!==visible)item.o.setVisible(visible);
    }
  },
  next(){
    if(!this.active)return;
    this.step++;
    if(this.step>=this.order.length){this.finish(false);return;}
    const key=this.order[this.step];
    this.switchVisibility(key);
    this.samples=[];this.startedAt=0;this.lastAt=0;
    this.show(\`HOJA V0.54 · 지상 렌더링 A/B (T 취소)\\n\`+
      \`단계 \${this.step+1}/\${this.order.length}: \${key} \${this.names[key]}\\n\`+
      \`지형 충돌 유지 · 시간 정지 · 배율 \${RS.toFixed(2)}배\\n\`+
      \`검사 대상(현재 표시): 배경 \${this.counts.background} / 지형 \${this.counts.terrain} / 기타 \${this.counts.other}\\n\`+
      \`초기 안정화 중…\`);
    this.raf=requestAnimationFrame(t=>this.tick(t));
  },
  tick(t){
    if(!this.active)return;
    if(document.hidden||this.scene!==ACTIVE_SCENE){this.finish(true,'탭이 숨겨지거나 맵이 바뀌어 중단했습니다.');return;}
    if(!this.startedAt){this.startedAt=t;this.lastAt=t;}
    const elapsed=t-this.startedAt;
    const dt=t-this.lastAt;this.lastAt=t;
    if(dt>500){this.finish(true,'브라우저 렌더링이 0.5초 이상 멈춰 결과를 폐기했습니다.');return;}
    if(elapsed>=this.warmMs&&dt>0&&dt<500)this.samples.push(dt);
    if(elapsed>=this.warmMs+this.collectMs){
      const a=[...this.samples].sort((x,y)=>x-y);
      if(a.length<35){this.finish(true,'프레임 표본이 부족하여 측정을 취소했습니다.');return;}
      const avgDt=a.reduce((v,x)=>v+x,0)/a.length;
      const slow=a.slice(Math.floor(a.length*.9));
      const slowDt=slow.reduce((v,x)=>v+x,0)/Math.max(1,slow.length);
      this.results.push({mode:this.order[this.step],fps:1000/avgDt,low:1000/slowDt,
        p95:a[Math.floor((a.length-1)*.95)],frames:a.length});
      this.next();return;
    }
    if(elapsed%800<34){
      const mode=this.order[this.step];
      this.show(\`HOJA V0.54 · 지상 렌더링 A/B (T 취소)\\n\`+
        \`단계 \${this.step+1}/\${this.order.length}: \${mode} \${this.names[mode]}\\n\`+
        \`배율 \${RS.toFixed(2)}배 · \${elapsed<this.warmMs?'워밍업':'측정'} · \`+
        \`\${(elapsed/1000).toFixed(1)}/\${((this.warmMs+this.collectMs)/1000).toFixed(1)}초\\n\`+
        \`동일한 정지 장면 · 배경 \${this.counts.background}, 지형 \${this.counts.terrain}, 기타 \${this.counts.other}개\\n\`+
        \`※ 화면이 일부 사라지는 것은 정상적인 성능 측정 과정입니다.\`);
    }
    this.raf=requestAnimationFrame(v=>this.tick(v));
  },
  finish(cancelled=false,reason=''){
    if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;
    const scene=this.scene,wasActive=this.active;
    this.active=false;
    // Restore original visibility *before* unfreezing gameplay/culling.
    for(const item of this.objects){
      try{if(item.o.active!==false&&item.o.visible!==item.wasVisible)item.o.setVisible(item.wasVisible);}catch(_e){}
    }
    if(wasActive&&scene===ACTIVE_SCENE&&scene?.manualPaused)scene.toggleManualPause();
    const button=document.getElementById('renderBenchBtn');
    if(button)button.textContent='지상 렌더 비교 (T)';
    for(const id of ['scaleBenchBtn','scaleQuickBtn','qualityBtn','bgPerfBtn','cullPerfBtn','lampPerfBtn']){
      const btn=document.getElementById(id);if(btn)btn.disabled=false;
    }
    if(cancelled){this.show('V0.54 비교 중단\\n'+reason);this.scene=null;this.objects=[];return;}
    const groups={};
    for(const r of this.results)(groups[r.mode]||= []).push(r);
    const stats=(code,k)=>{
      const v=groups[code]||[];
      return v.reduce((sum,r)=>sum+r[k],0)/Math.max(1,v.length);
    };
    const base=stats('A','fps');
    const deltas=['B','C','D','E'].map(code=>({code,fps:stats(code,'fps'),
      gain:stats(code,'fps')-base,low:stats(code,'low')}));
    const max=deltas.filter(x=>x.code!=='E').sort((a,b)=>b.gain-a.gain)[0];
    const rows=['A','B','C','D','E'].map(code=>
      \`\${code} \${this.names[code]}\\n    평균 \${stats(code,'fps').toFixed(1)} FPS · 하위10% \${stats(code,'low').toFixed(1)}\`+
      (code==='A'?'':\` · A 대비 \${(stats(code,'fps')-base)>=0?'+':''}\${(stats(code,'fps')-base).toFixed(1)}\`)).join('\\n');
    this.show(\`V0.54 측정 완료 · 원래 게임 화면 복구됨\\n\\n\${rows}\\n\\n\`+
      \`최대 단독 개선 후보: \${max.code} (\${this.names[max.code]})\\n\`+
      \`참고: \${max.gain<3?'단독 항목을 제외해도 개선이 작습니다. JS·합성·브라우저 전체 프로파일이 필요합니다.':
      '항목 제거 시 개선이 있습니다. 실제 플레이 및 반복 측정으로 재확인해야 합니다.'}\\n\`+
      \`※ 정지 장면 RAF 프레임 간격입니다. GPU 사용 시간 직접 측정이 아니며, 표시 항목 숨기기는 진단용입니다.\`);
    window.HOJA_V054_LAST_RESULT={records:this.results,averages:Object.fromEntries(['A','B','C','D','E'].map(c=>[c,{fps:stats(c,'fps'),low:stats(c,'low')}])),counts:this.counts};
    this.objects=[];this.scene=null;
  },
  toggle(scene){if(this.active)this.finish(true,'사용자가 취소했습니다.');else this.start(scene);}
};
window.HOJA_V054_RENDER_AB=HOJA_V054_RENDER_AB;`;

export const benchmarkHandlers = `    document.getElementById('v055BenchBtn').onclick=()=>HOJA_V055_BENCH.toggle(this);
    document.getElementById('scaleBenchBtn').onclick=()=>HOJA_V053_BENCH.toggle(this);
    document.getElementById('scaleQuickBtn').onclick=()=>HOJA_V053_BENCH.quick(this);
    document.getElementById('renderBenchBtn').onclick=()=>HOJA_V054_RENDER_AB.toggle(this);
`;

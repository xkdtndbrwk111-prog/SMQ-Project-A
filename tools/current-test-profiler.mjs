// Profiler source is inserted only in the instrumented test build.
export const profilerSource = `// V0.50 opt-in profiler: timings represent JavaScript CPU costs only.
// A slow GPU frame can have very short JS times; do not infer FPS gain from these alone.
const HOJA_V050_PROFILE={
  enabled:false,methods:Object.create(null),frames:[],lastTick:0,reportHandle:null,
  setEnabled(on){
    this.enabled=!!on;this.methods=Object.create(null);this.frames=[];
    const el=document.getElementById('hojaPerfPanel');
    if(el){el.style.display=this.enabled?'block':'none';el.textContent=this.enabled?'성능 분석 시작 · 5초 동안 이동해 보세요.':'';}
    if(this.reportHandle){clearInterval(this.reportHandle);this.reportHandle=null;}
    if(this.enabled)this.reportHandle=setInterval(()=>this.draw(),1200);
  },
  sample(name,ms){
    if(!this.enabled)return;
    const rec=this.methods[name]||(this.methods[name]={n:0,total:0,max:0});
    rec.n++;rec.total+=ms;rec.max=Math.max(rec.max,ms);
  },
  snapshot(){
    const fps=ACTIVE_GAME?.loop?.actualFps??0;
    const parts=Object.keys(this.methods).map(name=>{
      const p=this.methods[name];return {name,avgMs:+(p.total/Math.max(1,p.n)).toFixed(3),maxMs:+p.max.toFixed(2),calls:p.n};
    });
    return {fps:+fps.toFixed(1),stage:STAGE_INDEX+1,active:this.enabled,
      visionMode:ACTIVE_SCENE?.caveVisionMode,renderScale:RS,
      chunksVisible:ACTIVE_SCENE?.caveTerrainChunks?.filter(it=>it.visible).length??0,
      chunksTotal:ACTIVE_SCENE?.caveTerrainChunks?.length??0,
      methods:parts.sort((a,b)=>b.avgMs-a.avgMs)};
  },
  draw(){
    if(!this.enabled)return;
    const el=document.getElementById('hojaPerfPanel');if(!el)return;
    const s=this.snapshot();
    const rows=s.methods.slice(0,9).map(p=>\`\${p.name.padEnd(25)} \${String(p.avgMs).padStart(7)}ms 평균 · 최대 \${p.maxMs}ms (\${p.calls}회)\`);
    el.textContent=\`V0.54 · CPU 프로파일 (J 종료) | 맵 \${s.stage} | 실제 FPS \${s.fps} | 렌더 \${s.renderScale.toFixed(2)}×\\n\`+
      \`동굴 청크 \${s.chunksVisible}/\${s.chunksTotal}, 시야 \${s.visionMode||'-'}\\n\`+
      (rows.length?rows.join('\\n'):'처리 중…')+'\\n※ 숫자는 해당 함수의 JS 실행시간입니다. GPU 렌더링 시간은 포함되지 않습니다.';
  }
};
for(const method of ['update','updateCaveVisibility','updateCaveLanternLight','updateStaticCulling',
    'updateCamera','updateWorldPalette','updateEnemies','updateWeather','updateMovingPlatforms']){
  const original=HojaScene.prototype[method];if(typeof original!=='function')continue;
  HojaScene.prototype[method]=function(...args){
    if(!HOJA_V050_PROFILE.enabled)return original.apply(this,args);
    const t=performance.now();
    try{return original.apply(this,args);}
    finally{HOJA_V050_PROFILE.sample(method,performance.now()-t);}
  };
}


`;

export const profilerHandler = `    const profileBtn=document.getElementById('hojaCpuProfileBtn');
    profileBtn.onclick=()=>{
      const enabled=!HOJA_V050_PROFILE.enabled;
      HOJA_V050_PROFILE.setEnabled(enabled);
      profileBtn.textContent='CPU 성능 진단: '+(enabled?'켬':'끔');
      profileBtn.setAttribute('aria-pressed',String(enabled));
    };
`;

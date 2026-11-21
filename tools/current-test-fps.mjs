// Test-only FPS display and wall-clock measurements.
export const fpsInit = `    // V0.51: draw performance text in a real DOM overlay above the FOV,
    // never as a Phaser object that could be covered by cave darkness.
    this.fpsDisplay=document.getElementById('hojaFpsDisplay');
    if(this.fpsDisplay)this.fpsDisplay.style.display=FPS_VISIBLE?'block':'none';
    // F9 diagnostics keep a true five-second window separately from the
    // legacy 60-frame HUD sample.  The legacy array is intentionally left
    // unchanged because quality fallback and older QA modules depend on it.
    this.hojaFps5sSamples=[];
    this.hojaPerfLastNow=performance.now();
    this.hojaPerfLastPlayerX=this.playerBody?.x??null;
    this.hojaPerfLastPlayerY=this.playerBody?.y??null;
    this.hojaDiagStartedAt=this.time?.now??0;
    this.hojaDiagMinFps=null;
    // STEP13-1: per-map minimum based on stable half-second sample windows.
    this.hojaStep131MinFps=null;

`;

export const fpsWall = `    // Phaser Arcade runs with fixedStep=true, so \`delta\` can remain 16.7ms
    // even when rendering is far below 60 FPS.  Measure wall-clock intervals
    // between real Scene.update calls for the F9 diagnostic instead.
    const wallNow=performance.now();
    const wallDelta=wallNow-(this.hojaPerfLastNow??wallNow);
    this.hojaPerfLastNow=wallNow;
    if(Number.isFinite(wallDelta)&&wallDelta>0&&wallDelta<=1000){
      this.hojaFps5sSamples=this.hojaFps5sSamples||[];
      const body=this.playerBody?.body;
      const px=this.playerBody?.x,py=this.playerBody?.y;
      const positionMoved=Number.isFinite(px)&&Number.isFinite(py)&&
        Number.isFinite(this.hojaPerfLastPlayerX)&&Number.isFinite(this.hojaPerfLastPlayerY)&&
        (Math.abs(px-this.hojaPerfLastPlayerX)>.05||Math.abs(py-this.hojaPerfLastPlayerY)>.05);
      const moving=!!(positionMoved||(body&&
        (Math.abs(body.velocity?.x||0)>5||Math.abs(body.velocity?.y||0)>5)));
      this.hojaPerfLastPlayerX=Number.isFinite(px)?px:this.hojaPerfLastPlayerX;
      this.hojaPerfLastPlayerY=Number.isFinite(py)?py:this.hojaPerfLastPlayerY;
      this.hojaFps5sSamples.push({time:wallNow,delta:wallDelta,moving});
      const cutoff=wallNow-5000;
      while(this.hojaFps5sSamples.length&&this.hojaFps5sSamples[0].time<cutoff){
        this.hojaFps5sSamples.shift();
      }
      const instant=1000/wallDelta;
      this.hojaDiagMinFps=this.hojaDiagMinFps===null?instant:
        Math.min(this.hojaDiagMinFps,instant);
    }
`;

export const fpsWorst = `    const worst=Math.round(1000/Math.max(...this.fpsSamples));
`;

export const fpsUi = `    if(this.fpsDisplay){
      this.fpsDisplay.textContent=\`\${fps} FPS  (최저 \${worst})  ×\${RS.toFixed(2)}  \${Math.round(VIEW_W*RS)}×\${Math.round(VIEW_H*RS)}px  정적 \${this.staticVisibleCount||0}/\${this.staticScenery?.length||0}\${LIGHT_BACKGROUND?"  배경:경량":""}\${STAGE.theme!=="cave"?"  광원:"+["원본","경량","끔"][HOJA_SURFACE_LAMP_MODE]:""}\`;
      this.fpsDisplay.style.color=fps>=55?'#9ff7b4':fps>=40?'#ffe58a':'#ff9a8a';
    }
    // STEP13-1: update the always-visible TEST badge at 2Hz, using the
    // existing game-loop deltas. No extra animation frame, timer or GPU read.
    const diagFps=document.getElementById('hojaStep131FpsNumbers');
    const diagInfo=document.getElementById('hojaStep131FpsDetails');
    if(diagFps&&diagInfo){
      if(this.fpsSamples.length>=30&&time>2500&&Number.isFinite(fps)){
        this.hojaStep131MinFps=this.hojaStep131MinFps===null?fps:
          Math.min(this.hojaStep131MinFps,fps);
      }
      const low=this.hojaStep131MinFps===null?'--':String(this.hojaStep131MinFps);
      diagFps.textContent=\`FPS \${fps} · 최저 \${low}\`;
      diagFps.dataset.fpsState=fps>=55?'ok':fps>=40?'warning':'slow';
      diagInfo.textContent=\`\${avg.toFixed(1)}ms/프레임 · \${STAGE.theme==='cave'?'지하':'지상'} · ×\${RS.toFixed(2)}\`;
    }
    // STEP13-3: no additional timers/RAF loops. Reflect the actual cave
    // vision state in the existing 500-ms FPS update, not a second observer.
    const fovTools=document.getElementById('hojaStep133CaveCompare');
    if(fovTools){
      const inCave=STAGE.theme==='cave';
      fovTools.style.display=inCave?'flex':'none';
      if(inCave){
        const fovButton=document.getElementById('hojaStep133FovButton');
        const fovStatus=document.getElementById('hojaStep133FovStatus');
        if(fovButton){
          fovButton.textContent=this.caveVisionEnabled?'시야 잠시 끄기 · 비교':'시야 다시 켜기 · 복원';
          fovButton.setAttribute('aria-pressed',String(!this.caveVisionEnabled));
        }
        if(fovStatus)fovStatus.textContent=this.caveVisionEnabled?
          '시야 ON (기본) · 정지 상태 FPS 기록':'시야 OFF (진단용) · 다시 켜서 복원';
      }
    }

    // STEP13-4: read counters at the existing 2Hz FPS cadence. No extra RAF.
    const comparison=document.getElementById('hojaStep134Panel');
    if(comparison){
      const inCave=STAGE.theme==='cave';
      comparison.style.display=inCave?'flex':'none';
      if(inCave){
        const m=HOJA_STEP134_DIAG.metrics();
        const stats=document.getElementById('hojaStep134Stats');
        if(m&&stats)stats.textContent=
          \`카메라 \${m.zoom}× · 화면에 보이는 월드 \${m.visibleWorld}
\`+
          \`출력 \${m.buffer}px (\${m.megapixels} MP) · 배율 \${m.scale}×
\`+
          \`동굴 지형 이미지 \${m.caveChunks} · FPS \${fps}\`;
      }
    }
    // STEP13-5: metrics piggyback on the existing ~2Hz FPS refresh.
    const step135=document.getElementById('hojaStep135Panel');
    if(step135){
      const inCave=STAGE.theme==='cave';
      step135.style.display=inCave?'flex':'none';
      if(inCave){
        const metrics=HOJA_STEP135_DIAG.metrics();
        const target=document.getElementById('hojaStep135Stats');
        if(target&&metrics)target.textContent=metrics;
      }
    }
    const panel136=document.getElementById('hojaStep136Panel');
    if(panel136){
      const inCave=STAGE.theme==='cave';
      panel136.style.display=inCave?'flex':'none';
      if(inCave){
        const target=document.getElementById('hojaStep136Stats');
        if(target)target.textContent=HOJA_STEP136_DIAG.metrics();
      }
    }`;

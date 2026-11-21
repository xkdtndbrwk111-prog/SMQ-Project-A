// Test-only camera, culling and seam measurement helpers.
export const controlMethods = `  toggleLightBackground(){
    LIGHT_BACKGROUND=!LIGHT_BACKGROUND;
    const btn=document.getElementById('bgPerfBtn');
    if(btn)btn.textContent=LIGHT_BACKGROUND?'배경: 경량':'배경: 원본';
    this.applyLightBackground();
  }

  toggleStaticCulling(){
    this.staticCullEnabled=!this.staticCullEnabled;
    const btn=document.getElementById('cullPerfBtn');
    if(btn)btn.textContent=this.staticCullEnabled?'화면 밖 컬링: 켬':'화면 밖 컬링: 끔';
    this.sceneryCullClock=0;
    if(!this.staticCullEnabled&&this.staticScenery){
      for(const item of this.staticScenery){
        const splitOriginal=(this.hojaTerrainSplitMode&&item.o.__v055TerrainPart)||
        (this.hojaDecorSplitMode&&item.o.__v055StaticOriginal&&!item.o.__v055TerrainPart);
      const splitChunk=(this.hojaTerrainSplitMode&&item.o.__v055TerrainChunk)||
        (this.hojaDecorSplitMode&&item.o.__v055ChunkSprite&&!item.o.__v055TerrainChunk);
      const allowed=!!((!item.o.__v055StaticOriginal||!this.surfaceChunkMode||splitOriginal)&&
        (!item.o.__v055ChunkSprite||(this.surfaceChunkMode&&item.o.alpha>0.001&&!splitChunk)));
        if(item.visible!==allowed){item.o.setVisible(allowed);item.visible=allowed;}
      }
      this.staticVisibleCount=this.staticScenery.length;
    }
  }

  toggleSurfaceChunks(force){
    if(!this.v055Chunks?.length){return false;}
    this.surfaceChunkMode=typeof force==='boolean'?force:!this.surfaceChunkMode;
    if(!this.surfaceChunkMode){
      // Hidden originals were not recolored during the last fade. Restore
      // the EXACT current phase before exposing them for an A/B comparison.
      const band=hojaPaletteBand(this.remainingMs??RUN.remainingMs,STAGE.theme);
      for(const item of this.v055ChunkSources){
        const texture=band===0?item.base:hojaGetPaletteTexture(this,item.base,band);
        item.obj.__hojaPaletteBase=item.base;
        item.obj.setTexture(texture,item.frame);
      }
    }
    this.applySurfaceChunkVisibility();
    // V0.56: re-cull immediately. The I benchmark skips updateCamera(), so
    // without this the original (A) mode was measured with EVERY off-screen
    // tile visible (~1500 objects) instead of the culled gameplay state.
    if(this.staticCullEnabled)this.updateStaticCulling(this.time.now);
    const btn=document.getElementById('v055ChunkBtn');
    if(btn)btn.textContent='지상 지형: '+(this.surfaceChunkMode?'안전 청크':'원본')+' (Y)';
    this.hojaUpdateTerrainSplitButton();
    this.fpsSamples.length=0;
    return true;
  }

  hojaToggleTerrainSplit(){
    if(STAGE.theme==='cave'||!this.v055Chunks?.length)return false;
    if(!this.surfaceChunkMode)this.toggleSurfaceChunks(true);
    // One button; cycle A -> B -> C -> A with mutually exclusive overrides.
    if(!this.hojaTerrainSplitMode&&!this.hojaDecorSplitMode){
      this.hojaTerrainSplitMode=true;
    }else if(this.hojaTerrainSplitMode){
      this.hojaTerrainSplitMode=false;
      this.hojaDecorSplitMode=true;
    }else{
      this.hojaDecorSplitMode=false;
    }
    this.applySurfaceChunkVisibility();
    if(this.staticCullEnabled)this.updateStaticCulling(this.time.now);
    this.hojaUpdateTerrainSplitButton();
    this.fpsSamples.length=0;
    return true;
  }

  hojaUpdateTerrainSplitButton(){
    const btn=document.getElementById('hojaTerrainSplitBtn');
    if(!btn)return;
    const active=STAGE.theme!=='cave'&&!!this.v055Chunks?.length;
    btn.disabled=!active;
    const mode=this.hojaTerrainSplitMode?'B — 발판 개별':
      (this.hojaDecorSplitMode?'C — 나무·장식 개별':'A — 모두 청크');
    btn.textContent=!active?'청크 원인 비교: 동굴 제외':'청크 원인 비교: '+mode;
  }

  hojaUpdateSeamButtons(){
    const diag=document.getElementById('hojaSeamDiagBtn');
    const zoom=document.getElementById('hojaZoomProbeBtn');
    const label={auto:'자동',normal:'1× 고정',idle:'2× 고정',compare20:'3× 고정'};
    if(diag)diag.textContent='경계 진단: '+(this.hojaSeamDiagEnabled?'켬':'끔');
    if(zoom)zoom.textContent='줌 비교: '+label[this.hojaZoomProbeMode||'auto'];
    const canvas=document.getElementById('hojaSeamMeasureCanvas');
    const panel=document.getElementById('hojaSeamMeasurePanel');
    if(canvas)canvas.style.display=this.hojaSeamDiagEnabled?'block':'none';
    if(panel)panel.style.display=this.hojaSeamDiagEnabled?'block':'none';
  }

  hojaToggleSeamDiagnostic(){
    this.hojaSeamDiagEnabled=!this.hojaSeamDiagEnabled;
    this.hojaUpdateSeamButtons();
    if(this.hojaSeamDiagEnabled)this.hojaMeasureChunkSeams();
  }

  hojaCycleZoomProbe(){
    // Hidden diagnostics may cycle through auto and the three fixed zoom levels.
    const seq=['auto','normal','idle','compare20'];
    const ix=seq.indexOf(this.hojaZoomProbeMode);
    this.hojaZoomProbeMode=seq[(ix+1)%seq.length];
    this.hojaUpdateSeamButtons();
    this.hojaUpdateManualZoomButtons();
  }

  hojaUpdateManualZoomButtons(){
    const modes={hojaZoomAutoBtn:'auto',hojaZoom10Btn:'normal',hojaZoom13Btn:'compare13',hojaZoom15Btn:'idle',hojaZoom20Btn:'compare20'};
    for(const [id,mode] of Object.entries(modes)){
      const btn=document.getElementById(id);
      if(btn)btn.setAttribute('aria-pressed',String(this.hojaZoomProbeMode===mode));
    }
  }

  hojaSetManualZoom(mode){
    if(!['auto','normal','idle','compare20'].includes(mode))return;
    this.hojaZoomProbeMode=mode;
    // Switching back to auto should not inherit an old idle timer.
    if(mode==='auto'){this.lastMoveInputAt=this.time.now;this.idleZoomActive=false;}
    this.hojaUpdateManualZoomButtons();
    this.hojaUpdateSeamButtons();
  }

  hojaMeasureChunkSeams(){
    if(!this.hojaSeamDiagEnabled||ACTIVE_SCENE!==this)return;
    const overlay=document.getElementById('hojaSeamMeasureCanvas');
    const panel=document.getElementById('hojaSeamMeasurePanel');
    const viewCanvas=this.game?.canvas;
    const camera=this.cameras?.main;
    if(!overlay||!panel||!viewCanvas||!camera)return;
    const rw=Math.max(1,viewCanvas.width),rh=Math.max(1,viewCanvas.height);
    if(overlay.width!==rw)overlay.width=rw;
    if(overlay.height!==rh)overlay.height=rh;
    const ctx=overlay.getContext('2d');
    if(!ctx)return;
    ctx.clearRect(0,0,rw,rh);
    if(STAGE.theme==='cave'||!this.surfaceChunkMode||!this.v055Chunks?.length){
      panel.textContent='청크 진단: 지상 1~4스테이지에서 청크 모드를 켜세요 (Y).';
      return;
    }
    // Use the camera's *rendered transform* including the actual zoom/scroll,
    // not a guessed CSS or worldView formula. Matrix values are Float32.
    const mx=camera.getViewMatrix();
    if(!mx){panel.textContent='카메라 화면 변환 행렬을 기다리는 중…';return;}
    const t=mx.matrix;
    const pos=(x,y)=>({x:t[0]*x+t[2]*y+t[4],y:t[1]*x+t[3]*y+t[5]});
    const chunks=this.v055Chunks;
    const look=new Map(chunks.map(g=>[g.depth+':'+g.cx+':'+g.cy,g]));
    const visible=[];
    let hCount=0,vCount=0,maxGapX=0,maxGapY=0;
    const candidates=[];
    for(const g of chunks){
      const right=look.get(g.depth+':'+(g.cx+1)+':'+g.cy);
      const below=look.get(g.depth+':'+g.cx+':'+(g.cy+1));
      // Chunk frames have origin=(0,0) and a 256x256 unscaled world extent.
      // Use the same palette phase on both sides. During transitions,
      // the phase sprites differ in alpha but NEVER in their geometry.
      for(const [dir,other] of [['vertical',right],['horizontal',below]]){
        if(!other)continue;
        const a=g.images[0],b=other.images[0];
        if(!a||!b)continue;
        let p1,p2,at,spanFrom,spanTo,gap;
        if(dir==='vertical'){
          p1=pos(a.x+a.displayWidth,a.y);
          p2=pos(b.x,b.y);
          at=(p1.x+p2.x)/2;
          spanFrom=pos(a.x+a.displayWidth,a.y).y;
          spanTo=pos(a.x+a.displayWidth,a.y+a.displayHeight).y;
          gap=Math.abs(p2.x-p1.x);maxGapX=Math.max(maxGapX,gap);vCount++;
        }else{
          p1=pos(a.x,a.y+a.displayHeight);
          p2=pos(b.x,b.y);
          at=(p1.y+p2.y)/2;
          spanFrom=pos(a.x,a.y+a.displayHeight).x;
          spanTo=pos(a.x+a.displayWidth,a.y+a.displayHeight).x;
          gap=Math.abs(p2.y-p1.y);maxGapY=Math.max(maxGapY,gap);hCount++;
        }
        const isX=dir==='vertical';
        const lo=Math.min(spanFrom,spanTo),hi=Math.max(spanFrom,spanTo);
        if((isX?at>=0&&at<=rw:at>=0&&at<=rh)&&hi>=0&&lo<=(isX?rh:rw)){
          const phase=((at%1)+1)%1;
          visible.push({dir,at,lo,hi,gap,phase});
          candidates.push({axis:isX?'세로':'가로',pixel:at,phase,gap});
        }
      }
    }
    // Overlay markers are *diagnostic annotations*, not terrain geometry.
    // Thin cyan marks = vertical chunk boundary; yellow = horizontal.
    ctx.save();
    ctx.lineWidth=1;
    ctx.setLineDash([5,4]);
    for(const edge of visible){
      ctx.beginPath();
      if(edge.dir==='vertical'){
        ctx.strokeStyle='rgba(5,240,250,0.82)';
        const xx=Math.round(edge.at)+.5;
        ctx.moveTo(xx,Math.max(0,edge.lo));ctx.lineTo(xx,Math.min(rh,edge.hi));
      }else{
        ctx.strokeStyle='rgba(255,241,0,0.82)';
        const yy=Math.round(edge.at)+.5;
        ctx.moveTo(Math.max(0,edge.lo),yy);ctx.lineTo(Math.min(rw,edge.hi),yy);
      }
      ctx.stroke();
    }
    ctx.restore();
    const canvasRect=viewCanvas.getBoundingClientRect();
    const drawnScale=(canvasRect.width||0)/rw;
    const closestX=candidates.filter(x=>x.axis==='세로').sort((a,b)=>Math.abs(a.phase-.5)-Math.abs(b.phase-.5))[0];
    const closestY=candidates.filter(x=>x.axis==='가로').sort((a,b)=>Math.abs(a.phase-.5)-Math.abs(b.phase-.5))[0];
    const pct=(x)=>x?x.pixel.toFixed(2)+'px · 소수 '+x.phase.toFixed(3):'표시 경계 없음';
    const zoomTarget=({auto:'자동',normal:'1× 고정',idle:'2× 고정',compare20:'3× 고정'})[this.hojaZoomProbeMode];
    panel.textContent=
      '청크 경계 실측(Phaser 카메라 변환 행렬) · B형 전체 256px 텍스처\\n'+
      '줌 목표 '+zoomTarget+' | 실제 게임 줌 '+this.gameZoom.toFixed(4)+
        ' | 내부 카메라 줌 '+camera.zoom.toFixed(4)+' | 렌더 배율 '+RS.toFixed(2)+'×\\n'+
      '프레임버퍼 '+rw+'×'+rh+' | CSS 변환 '+drawnScale.toFixed(3)+
        '× | 경계쌍 세로 '+vCount+' · 가로 '+hCount+' (화면 안 '+visible.length+')\\n'+
      '기하 간격 최대: X '+maxGapX.toFixed(5)+'px / Y '+maxGapY.toFixed(5)+'px'+
        '  ※ 0이어도 GPU 샘플링 문제는 남을 수 있음\\n'+
      '세로 경계 예: '+pct(closestX)+' | 가로 경계 예: '+pct(closestY)+'\\n'+
      '청록 점선=세로 청크 경계 / 노랑 점선=가로 청크 경계 · 실제 오류선과 겹치는지 비교';
  }

  cycleSurfaceLampMode(){
    if(STAGE.theme==='cave')return;
    HOJA_SURFACE_LAMP_MODE=(HOJA_SURFACE_LAMP_MODE+1)%3;
    this.lampSurfaceMode=-1; // A mode change must override cached palette band.
    this.updateSurfaceStreetLamps();
    if(this.fpsSamples)this.fpsSamples.length=0;
    const names=['원본 300px','경량 200px','광원 끔'];
    const btn=document.getElementById('lampPerfBtn');
    if(btn)btn.textContent=\`지상 광원: \${names[HOJA_SURFACE_LAMP_MODE]} (N)\`;
  }

  hojaUpdatePixelExperimentStatus(force=false){
    const now=this.time?.now||0;
    if(!force&&now-(this._hojaR36StatusLastAt||0)<250)return;
    this._hojaR36StatusLastAt=now;
    const el=document.getElementById('hojaPixelExperimentStatus');
    if(!el)return;
    const cameraProduct=Number(this.cameras.main.zoom)||2;
    const integer=Math.abs(cameraProduct-Math.round(cameraProduct))<1e-6;
    const vp=document.getElementById('gameViewport');
    const canvas=this.game?.canvas;
    const cssScale=canvas&&vp?vp.getBoundingClientRect().width/Math.max(1,canvas.width):1;
    const cssPerfect=Math.abs(cssScale-1)<.015;
    const shown=cameraProduct.toFixed(integer?0:2);
    el.textContent=\`카메라 \${shown}× · 이동 2× / 정지·수면 3×\`+
      (integer?' · 정수 픽셀':' · 부드러운 전환 중')+
      (cssPerfect?'':' · 화면 출력 축척 주의');
  }
`;

export const c1ButtonUpdate = `function hojaC1CameraButtonUpdate(){
  const btn=document.getElementById('c1CameraBtn');
  if(btn){
    btn.textContent=HOJA_C1_MANUAL_CAMERA?'카메라: C1 직접 추적':'카메라: 부드러운 추적';
    btn.style.borderColor=HOJA_C1_MANUAL_CAMERA?'#e8c880':'';
    btn.style.color=HOJA_C1_MANUAL_CAMERA?'#ffe2a3':'';
  }
}
`;

export const seamTimer = `    // Read only. Runs after Phaser's camera preRender in a later UI tick;
    // never modifies world transforms, jump logic or texture pixels.
    this._hojaSeamTimer=window.setInterval(()=>this.hojaMeasureChunkSeams(),300);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      window.clearInterval(this._hojaSeamTimer);
      const overlay=document.getElementById('hojaSeamMeasureCanvas');
      if(overlay)overlay.style.display='none';
    });
`;

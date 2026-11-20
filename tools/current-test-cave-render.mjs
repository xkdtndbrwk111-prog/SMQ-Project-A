// Test-build cave comparison controls.
export const caveRenderTestSource = `/* STEP13-4: test-only controlled A/B comparisons. This module lives in the
   main game closure so it can access the existing protected camera and render
   settings; no external GAS endpoints or production data are involved. */
const HOJA_STEP134_DIAG=(()=>{
  let saved=null;
  let renderTest='restore';
  let activeZoom='auto';
  const zoomModes=new Set(['auto','normal','idle','compare20']);
  const isCave=()=>ACTIVE_SCENE && STAGE.theme==='cave' && !ACTIVE_SCENE.dying &&
    !ACTIVE_SCENE.timeUp && !ACTIVE_SCENE.quizActive && !ACTIVE_SCENE.manualPaused;
  const updateButtons=()=>{
    document.querySelectorAll('[data-step134-zoom]').forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.step134Zoom===activeZoom));
    });
    document.querySelectorAll('[data-step134-render]').forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.step134Render===renderTest));
    });
  };
  const resetMeasurements=()=>{
    const sc=ACTIVE_SCENE;
    if(!sc)return;
    sc.fpsSamples=[];
    sc.hojaStep131MinFps=null;
    sc.fpsShownAt=0;
    const value=document.getElementById('hojaStep131FpsNumbers');
    if(value)value.textContent='FPS 다시 측정 중…';
  };
  const keepBaseline=()=>{
    if(saved)return;
    const sc=ACTIVE_SCENE;
    saved={mag:HOJA_WORLD_PIXEL_MAG,quality:QUALITY_MODE,manual:QUALITY_MANUAL,
      zoom:sc?.hojaZoomProbeMode||'auto'};
  };
  function restoreOriginal(){
    if(!saved)return true;
    HOJA_WORLD_PIXEL_MAG=saved.mag;
    changeQualityMode(saved.quality,true);
    QUALITY_MANUAL=saved.manual;
    if(ACTIVE_SCENE&&typeof ACTIVE_SCENE.hojaSetManualZoom==='function'){
      ACTIVE_SCENE.hojaSetManualZoom(saved.zoom);
    }
    saved=null;renderTest='restore';activeZoom=ACTIVE_SCENE?.hojaZoomProbeMode||'auto';
    resetMeasurements();updateButtons();
    return true;
  }
  function setZoom(mode){
    if(!isCave()||!zoomModes.has(mode))return false;
    keepBaseline();
    // A camera test must not inherit a reduced-resolution render test.
    if(renderTest!=='restore'){
      HOJA_WORLD_PIXEL_MAG=saved.mag;
      changeQualityMode(saved.quality,true);
      QUALITY_MANUAL=saved.manual;
      renderTest='restore';
    }
    ACTIVE_SCENE.hojaSetManualZoom(mode);
    activeZoom=mode;
    resetMeasurements();updateButtons();
    return true;
  }
  function setRender(mode){
    if(!isCave()||!['low','high','restore'].includes(mode))return false;
    if(mode==='restore')return restoreOriginal();
    keepBaseline();
    // IMPORTANT: renderer A/B is performed within a SINGLE world-size mode.
    // Strict 2x (default) forces canvas backing to CSS pixel dimensions. 1x
    // enables the existing cap to vary the actual backing buffer without
    // changing the zoom/visible world BETWEEN low and high samples.
    HOJA_WORLD_PIXEL_MAG=1;
    ACTIVE_SCENE.hojaSetManualZoom('normal');
    activeZoom='normal';
    renderTest=mode;
    changeQualityMode(mode==='low'?1:0,true); // 1.0x vs up-to-1.5x cap
    resetMeasurements();updateButtons();
    return true;
  }
  function resetOnStageChange(){
    HOJA_STEP135_DIAG.resetIfStageChanged();
    if(saved){
      HOJA_WORLD_PIXEL_MAG=saved.mag;
      QUALITY_MODE=saved.quality;
      RENDER_SCALE_CAP=QUALITY_MODES[saved.quality].cap;
      QUALITY_MANUAL=saved.manual;
      saved=null;
      // Deferred; the restarted scene has not finished creating its camera.
      scheduleResponsiveViewport();
    }
    renderTest='restore';activeZoom='auto';updateButtons();
  }
  function metrics(){
    const sc=ACTIVE_SCENE;
    const canvas=sc?.game?.canvas;
    const cam=sc?.cameras?.main;
    if(!sc||!canvas||!cam)return null;
    const width=canvas.width||0,height=canvas.height||0;
    const chunks=sc.caveTerrainChunks||[];
    let chunksVisible=0;
    for(const c of chunks){if(c.o?.visible!==false&&c.o?.alpha!==0)chunksVisible++;}
    return {buffer:\`\${width}×\${height}\`,megapixels:(width*height/1e6).toFixed(2),
      zoom:Number(sc.gameZoom||1).toFixed(2),scale:RS.toFixed(2),
      visibleWorld:\`\${Math.round(cam.width/Math.max(.01,cam.zoom))}×\${Math.round(cam.height/Math.max(.01,cam.zoom))}\`,
      caveChunks:\`\${chunksVisible}/\${chunks.length}\`,render:renderTest,zoomMode:activeZoom};
  }
  return {setZoom,setRender,restoreOriginal,resetOnStageChange,metrics,
    mode:()=>({zoom:activeZoom,render:renderTest})};
})();

const HOJA_STEP135_DIAG=(()=>{
  // All changes are visual (GameObject.visible). No SOLIDS/physics modifications.
  let scene=null, mode='base', savedExtras=[], savedBg=null;
  const current=()=>ACTIVE_SCENE&&STAGE.theme==='cave'&&ACTIVE_SCENE===scene;
  function isTerrainHidden(sc){return sc===scene&&mode==='terrain';}
  function extraKind(sc,o){
    if(!sc?.hojaStep135ExtraSet?.has(o))return '';
    if((sc.caveLanterns||[]).some(l=>l.glow===o))return 'glow';
    if(o?.texture?.key==='caveScaffold')return 'scaffold';
    return 'other';
  }
  function isExtraHidden(sc,o){return sc===scene&&(
    (mode==='extras'&&!!sc.hojaStep135ExtraSet?.has(o))||
    (['glow','scaffold','other'].includes(mode)&&extraKind(sc,o)===mode));}
  function restoreVisuals(){
    if(!scene)return;
    for(const e of savedExtras){if(e.o?.active)e.o.setVisible(e.visible);}
    if(savedBg?.o?.active)savedBg.o.setVisible(savedBg.visible);
    if(scene.staticScenery){
      // Re-sync cache bookkeeping so culler can show hidden V2 objects again.
      for(const it of scene.staticScenery){it.visible=!!it.o.visible;}
      scene.sceneryCullClock=0;
      if(scene.staticCullEnabled)scene.updateStaticCulling(scene.time.now);
    }
  }
  function setMode(next){
    if(!['base','terrain','extras','background','glow','scaffold','other'].includes(next))return false;
    const sc=ACTIVE_SCENE;
    if(!sc||STAGE.theme!=='cave'||sc.dying||sc.timeUp||sc.quizActive||sc.manualPaused||!sc.staticCullEnabled)return false;
    if(scene&&scene!==sc){scene=null;mode='base';savedExtras=[];savedBg=null;}
    if(!scene){
      // Make camera and render conditions fixed for all measurements.
      if(!HOJA_STEP134_DIAG.setZoom('normal'))return false;
      scene=sc;
      savedExtras=(sc.hojaStep135Extras||[]).map(o=>({o,visible:!!o.visible}));
      savedBg=sc.caveBackground?{o:sc.caveBackground,visible:!!sc.caveBackground.visible}:null;
    }
    // First restore the previous test, then hide only the selected category.
    restoreVisuals();
    mode=next;
    if(['extras','glow','scaffold','other'].includes(next)){
      for(const e of savedExtras)if(e.o?.active&&isExtraHidden(sc,e.o))e.o.setVisible(false);
    }
    if(next==='background'&&savedBg?.o?.active)savedBg.o.setVisible(false);
    if(sc.staticScenery){
      sc.sceneryCullClock=0;
      if(sc.staticCullEnabled)sc.updateStaticCulling(sc.time.now);
    }
    sc.fpsSamples=[];sc.hojaStep131MinFps=null;sc.fpsShownAt=0;
    const numbers=document.getElementById('hojaStep131FpsNumbers');
    if(numbers)numbers.textContent='FPS 다시 측정 중…';
    document.querySelectorAll('[data-step135-mode]').forEach(b=>
      b.setAttribute('aria-pressed',String(b.dataset.step135Mode===next)));
    return true;
  }
  function resetIfStageChanged(){
    if(scene&&(!ACTIVE_SCENE||ACTIVE_SCENE!==scene||STAGE.theme!=='cave')){
      // Prior scene has normally already been destroyed. Don't touch new stage.
      scene=null;mode='base';savedExtras=[];savedBg=null;
      document.querySelectorAll('[data-step135-mode]').forEach(b=>
        b.setAttribute('aria-pressed',String(b.dataset.step135Mode==='base')));
    }
  }
  function metrics(){
    resetIfStageChanged();
    const sc=ACTIVE_SCENE;if(!sc||STAGE.theme!=='cave')return null;
    const all=sc.caveTerrainChunks||[];
    const shown=all.filter(x=>x.o?.visible).length;
    const extras=sc.hojaStep135Extras||[];
    const extrasShown=extras.filter(o=>o?.visible&&o.alpha>0).length;
    const allVisible=sc.children.list.reduce((n,o)=>n+((o?.visible&&o.alpha>0)?1:0),0);
    const px=all.reduce((n,x)=>{const tex=x.o?.texture?.getSourceImage?.();return n+(tex?.width||0)*(tex?.height||0);},0);
    return \`비교 \${mode} · 지형 \${shown}/\${all.length} · 추가 장식 \${extrasShown}/\${extras.length} · 보이는 전체 객체 \${allVisible} · 지형 원본 약 \${(px*4/1048576).toFixed(1)}MiB(RGBA 추정)\`;
  }
  return {isTerrainHidden,isExtraHidden,setMode,metrics,resetIfStageChanged,mode:()=>mode};
})();

const HOJA_STEP136_DIAG=(()=>{
  let scene=null, optimized=false, culled=0, collisionHidden=0;
  const valid=sc=>!!sc&&sc===ACTIVE_SCENE&&STAGE.theme==='cave';
  function isOptimized(sc){return valid(sc); /* STEP13-7: verified cave renderer is the default */}
  function applyVisibility(sc,view){
    if(!valid(sc))return;
    const on=isOptimized(sc);
    collisionHidden=0;culled=0;
    for(const o of sc.hojaStep136CollisionOnly||[]){
      if(!o?.active)continue;
      // Visual-only. Never setActive, body.enable, group, or collision callbacks.
      if(o.visible!==!on)o.setVisible(!on);
      if(on)collisionHidden++;
    }
    for(const o of sc.hojaStep136Cullables||[]){
      if(!o?.active)continue;
      const b=o.getBounds();
      const within=b.right>=view.L&&b.left<=view.R&&b.bottom>=view.T&&b.top<=view.B;
      const visuallySuppressed=HOJA_STEP135_DIAG.isExtraHidden(sc,o);
      const show=!visuallySuppressed&&(!on||within);
      if(o.visible!==show)o.setVisible(show);
      if(on&&!within)culled++;
    }
  }
  function setMode(next){
    if(next!=='base'&&next!=='optimized')return false;
    const sc=ACTIVE_SCENE;
    if(!valid(sc)||sc.dying||sc.quizActive||sc.manualPaused||sc.transitioning||!sc.staticCullEnabled)return false;
    if(scene!==sc){scene=sc;optimized=false;}
    // Keep STEP13-5 diagnostic in full-graphics mode when measuring optimization.
    if(HOJA_STEP135_DIAG.mode()!=='base'){
      if(!HOJA_STEP135_DIAG.setMode('base'))return false;
    }
    optimized=next==='optimized';
    sc.sceneryCullClock=0;sc.sceneryCullX=-Infinity;sc.sceneryCullY=-Infinity;
    sc.updateStaticCulling(sc.time.now);
    sc.fpsSamples=[];sc.hojaStep131MinFps=null;sc.fpsShownAt=0;
    const numbers=document.getElementById('hojaStep131FpsNumbers');
    if(numbers)numbers.textContent='FPS 다시 측정 중…';
    document.querySelectorAll('[data-step136-mode]').forEach(b=>
      b.setAttribute('aria-pressed',String(b.dataset.step136Mode===next)));
    return true;
  }
  function resetIfStageChanged(){
    if(scene&&!valid(scene)){
      scene=null;optimized=false;culled=0;collisionHidden=0;
      document.querySelectorAll('[data-step136-mode]').forEach(b=>
        b.setAttribute('aria-pressed',String(b.dataset.step136Mode==='base')));
    }
  }
  function metrics(){
    resetIfStageChanged();
    const sc=ACTIVE_SCENE;
    if(!sc||STAGE.theme!=='cave')return '';
    return \`\${isOptimized(sc)?'최적화 ON':'원본'} · 충돌 전용 투명 도형 \${collisionHidden}/\${sc.hojaStep136CollisionOnly?.length||0} 렌더 제외 · 정적 광원/수정 \${culled}/\${sc.hojaStep136Cullables?.length||0} 컬링\`;
  }
  return {isOptimized,applyVisibility,setMode,metrics,resetIfStageChanged};
})();

`;

export const caveRenderProductionSource = `/* HOJA_CAVE_RENDER_BASELINE */
const HOJA_STEP134_DIAG={resetOnStageChange(){},metrics(){return null;}};
const HOJA_STEP135_DIAG={isTerrainHidden(){return false;},isExtraHidden(){return false;},metrics(){return null;}};
const HOJA_STEP136_DIAG=(()=>{
  const valid=sc=>!!sc&&sc===ACTIVE_SCENE&&STAGE.theme==='cave';
  function isOptimized(sc){return valid(sc); /* STEP13-7: verified cave renderer is the default */}
  function applyVisibility(sc,view){
    if(!valid(sc))return;
    const on=isOptimized(sc);
    for(const o of sc.hojaStep136CollisionOnly||[]){
      if(!o?.active)continue;
      // Visual-only. Never setActive, body.enable, group, or collision callbacks.
      if(o.visible!==!on)o.setVisible(!on);
    }
    for(const o of sc.hojaStep136Cullables||[]){
      if(!o?.active)continue;
      const b=o.getBounds();
      const within=b.right>=view.L&&b.left<=view.R&&b.bottom>=view.T&&b.top<=view.B;
      const visuallySuppressed=HOJA_STEP135_DIAG.isExtraHidden(sc,o);
      const show=!visuallySuppressed&&(!on||within);
      if(o.visible!==show)o.setVisible(show);
    }
  }
  return {applyVisibility,metrics(){return '';}};
})();
/* END_HOJA_CAVE_RENDER_BASELINE */

`;

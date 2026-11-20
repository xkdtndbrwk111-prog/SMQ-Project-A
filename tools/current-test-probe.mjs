import {profilerSource,profilerHandler} from './current-test-profiler.mjs';
import {caveRenderTestSource,caveRenderProductionSource} from './current-test-cave-render.mjs';
import {benchmarkSource,benchmarkHandlers} from './current-test-benchmarks.mjs';
// Test-only instrumentation for the materialized Phase 2B source. Never emitted to a production build.
export function instrumentArcade(input, {keepProductionCave=false}={}) {
  let arcade = input;
  const A = {
    edit(before, after) {
      const i=arcade.indexOf(before);
      if(i<0 || arcade.indexOf(before,i+before.length)>=0)throw new Error('Test probe anchor must occur exactly once: '+before.slice(0,80));
      arcade=arcade.slice(0,i)+after+arcade.slice(i+before.length);
    },
    beforeBodyEnd(html) {const i=arcade.lastIndexOf('</body>');if(i<0)throw new Error('arcade body missing');arcade=arcade.slice(0,i)+html+'\n'+arcade.slice(i);}
  };
  A.edit('  if(!HOJA_MAKER_MODE)return false;\n  const next=', '  const next=');
  A.edit('window.HOJA_V2_NEXT_STAGE=function(...args){if(HOJA_MAKER_MODE)HOJA_RANK_TEST_MODE_=true;return original.apply(this,args);};',
    'window.HOJA_V2_NEXT_STAGE=function(...args){HOJA_RANK_TEST_MODE_=true;return original.apply(this,args);};');

  A.edit('let PENDING_SEED=null;', "let PENDING_SEED=Number(sessionStorage.getItem('HOJA_TEST_SEED'))||null;");
  A.edit('    this.showStageBanner();\n    this.updateHUD();\n    syncBgm();', '    this.showStageBanner();\n    this.updateHUD();\n    syncBgm();\n    if(sessionStorage.getItem(\'HOJA_TEST_PAUSE_START\')===\'1\')this.scene.pause();');
  A.edit('const arcadeHud=window.HOJA_CREATE_HUD({', benchmarkSource+'\nconst arcadeHud=window.HOJA_CREATE_HUD({');
  A.edit("    document.getElementById('v055ChunkBtn').onclick=", benchmarkHandlers+profilerHandler+"    document.getElementById('v055ChunkBtn').onclick=");
  A.edit('async function boot(){',profilerSource+'async function boot(){');
  A.edit('// V0.32 PALETTE SHIFTS', `window.HOJA_V2_TOGGLE_CAVE_VISIBILITY=function(){
    if(STAGE.theme!=='cave'||!ACTIVE_SCENE)return;
    const scene=ACTIVE_SCENE;
    scene.caveVisionEnabled=!scene.caveVisionEnabled;
    document.getElementById('gameViewport')?.classList.toggle('caveVisionOff',!scene.caveVisionEnabled);
    if(scene.caveVisionEnabled)scene.updateCaveVisibility(true);
  };
  // V0.32 PALETTE SHIFTS`);
  A.edit('window.HOJA_CONNECT_ARCADE_HOST({', 'window.HOJA_STEP134_DIAG=HOJA_STEP134_DIAG;window.HOJA_STEP135_DIAG=HOJA_STEP135_DIAG;window.HOJA_STEP136_DIAG=HOJA_STEP136_DIAG;\nwindow.HOJA_CONNECT_ARCADE_HOST({');
  if(!keepProductionCave)A.edit(caveRenderProductionSource,caveRenderTestSource);
  A.edit('let ACTIVE_SCENE=null;', 'let ACTIVE_SCENE=null;window.HOJA_TEST_PROBE=Object.freeze({' +
    'stopLoop(){ACTIVE_SCENE.game.loop.stop();},step(){ACTIVE_SCENE.game.step(performance.now(),16);},' +
    'coverSites(){return CAVES.map(([a,b])=>({a,b,floor:F,stage:STAGE_INDEX,solids:SOLIDS.filter(o=>o.x<b&&o.x+o.w>a).map(o=>({x:o.x,y:o.y,w:o.w,h:o.h,slab:o.slab,cave:o.cave,kind:o.kind}))}));},' +
    'moveForCover(x,y){const s=ACTIVE_SCENE;clearInterval(window.__coverHold);window.__coverHold=setInterval(()=>s.playerBody.body.reset(x,y),16);},' +
    'freezeCover(){clearInterval(window.__coverHold);ACTIVE_SCENE.scene.pause();},' +
    'caveVision(){return !!ACTIVE_SCENE?.caveVisionEnabled;},' +
    'caveRenderState(){const s=ACTIVE_SCENE;return {stage:STAGE_INDEX,collision:(s.hojaStep136CollisionOnly||[]).filter(o=>o?.active).map(o=>!!o.visible),culled:(s.hojaStep136Cullables||[]).filter(o=>o?.active).length};},' +

    'cameraInfo(){const c=ACTIVE_SCENE.cameras.main;return {scrollX:c.scrollX,scrollY:c.scrollY,zoom:c.zoom,width:c.width,height:c.height};},' +
    'bankInfo(){return (ACTIVE_SCENE.waterBankForeground||[]).map(o=>({x:o.x,y:o.y,w:o.width,h:o.height,depth:o.depth,visible:o.visible}));},' +
    'coverInfo(){return (ACTIVE_SCENE.caveCovers||[]).map(({cover})=>{const source=cover.texture.getSourceImage();const ctx=source.getContext("2d");const pixels=ctx.getImageData(0,0,source.width,source.height).data;let transparent=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)transparent++;return {x:cover.x,y:cover.y,w:source.width,h:source.height,alpha:cover.alpha,transparent};});},' +
    'state(){const s=ACTIVE_SCENE;if(!s||!s.playerBody)return null;const b=s.playerBody.body;return {x:Math.round(s.playerBody.x),y:Math.round(s.playerBody.y),vx:Math.round(b.velocity.x),vy:Math.round(b.velocity.y),' +
    'grounded:!!(b.blocked.down||b.touching.down),sitting:!!s.hojaIsSitting,quiz:!!s.quizActive,paused:!!s.manualPaused,timeUp:!!s.timeUp,clear:!!s.clear,sec:Math.ceil(s.remainingMs/1000),found:RUN.found,stage:STAGE_INDEX};},' +
    'quiz(){const s=ACTIVE_SCENE;const e=(s.enemies||[]).find(x=>x&&x.type===\'BALLOONEY\'&&!x.dead&&x.bodyObj&&x.bodyObj.active!==false);if(!e)return false;s.showQuiz(e);return true;},' +
    'setTime(sec){const s=ACTIVE_SCENE;s.remainingMs=sec*1000;RUN.remainingMs=s.remainingMs;},' +
    'death(){ACTIVE_SCENE.startDeath(\'pit\');},' +
    'quizNext(){const s=ACTIVE_SCENE;const e=(s.enemies||[]).find(x=>x.type===\'BALLOONEY\'&&x.alive&&!x.consumed&&x.bodyObj?.active);if(!e)return false;s.showQuiz(e);return true;},' +
    'collectFruit(){const s=ACTIVE_SCENE,f=s.flowerObjs.find(x=>!x.got);if(!f)return false;const p=s.playerBody,b=p.body,x=p.x,y=p.y;b.reset(f.x,f.img.y);s.updateFlowers(s.time.now);b.reset(x,y);return f.got;},' +
    'stage(i){startStage(i,false);},' +
    'finish(){const s=ACTIVE_SCENE,d=s.doors.find(x=>x.kind===\'finish\');if(!d)return false;const b=s.playerBody.body;b.reset(d.x,d.y-b.height/2);const a=s.updateDoors(s.time.now,true,true);const c=s.updateDoors(s.time.now,true,true);return a&&c;},' +
    'repeatSettlement(){const s=ACTIVE_SCENE;s.startClear();s.startTimeUp();s.finalizeFlowerBonus();return hojaStep09_3Metrics_(s);},' +
    'metrics(){return {...hojaStep09_3Metrics_()};},resume(){ACTIVE_SCENE.scene.resume();},' +
    'snapshot(){const s=ACTIVE_SCENE;if(!s?.playerBody?.body)return null;const b=s.playerBody.body;return {' +
    'seed:RUN.seed,stage:STAGE_INDEX,remainingMs:s.remainingMs,score:s.score,found:RUN.found,deaths:RUN.deaths,' +
    'player:{x:s.playerBody.x,y:s.playerBody.y,vx:b.velocity.x,vy:b.velocity.y,blocked:{...b.blocked},touching:{...b.touching}},' +
    'enemies:(s.enemies||[]).map(e=>({type:e.type,key:e.memKey,state:e.state,alive:e.alive,consumed:e.consumed,x:e.bodyObj?.x,y:e.bodyObj?.y,vx:e.bodyObj?.body?.velocity.x,vy:e.bodyObj?.body?.velocity.y})),' +
    'quiz:!!s.quizActive,dying:!!s.dying,clear:!!s.clear,timeUp:!!s.timeUp,records:window.HOJA_RUN_RECORD(),metrics:hojaStep09_3Metrics_()};}});');
  // Separate, visibly marked controls for focused manual regression tests.
  // These call actual game paths; they do not establish that a natural route is reachable.
  A.beforeBodyEnd(`<div id="hojaTestControls" style="position:fixed;left:0;bottom:0;z-index:2147483647;background:#fff;color:#000;padding:8px">
    TEST ONLY · <button id="hojaTestDeath">쓰러짐 유도</button>
    <button id="hojaCpuProfileBtn" type="button" aria-pressed="false">CPU 성능 진단: 끔</button>
    <div id="hojaPerfPanel" style="display:none" aria-label="상세 성능 분석"></div>
    <style>#hojaPerfPanel[style*="block"]{display:block!important;white-space:pre-wrap;color:#000;background:#fff}</style>
    <button id="v055BenchBtn" type="button">지형 청크 자동 비교</button>
    <button id="scaleBenchBtn" type="button">배율 자동 측정</button>
    <button id="scaleQuickBtn" type="button">배율 수동 비교</button>
    <button id="renderBenchBtn" type="button">지상 렌더 비교</button>
    <div id="hojaV053Panel" style="display:none" role="status" aria-live="polite"></div>
    <style>#hojaV053Panel[style*="block"]{display:block!important;white-space:pre-wrap;color:#000;background:#fff}</style>
    <button id="hojaTestCaveVision">동굴 시야 전환</button>
    <button id="hojaTestNextStage">시험 맵 전환</button>
    <button id="hojaTestQuiz">문제 열기</button>
    <button id="hojaTestTimeout">2초 후 종료</button>
  </div><script>
  document.getElementById('hojaTestDeath').onclick=()=>window.HOJA_TEST_PROBE.death();
  document.getElementById('hojaTestCaveVision').onclick=()=>window.HOJA_V2_TOGGLE_CAVE_VISIBILITY();
  document.getElementById('hojaTestNextStage').onclick=()=>window.HOJA_V2_NEXT_STAGE();
  document.getElementById('hojaTestQuiz').onclick=()=>window.HOJA_TEST_PROBE.quiz();
  document.getElementById('hojaTestTimeout').onclick=()=>window.HOJA_TEST_PROBE.setTime(2);
  </script>`);
  return arcade;
}

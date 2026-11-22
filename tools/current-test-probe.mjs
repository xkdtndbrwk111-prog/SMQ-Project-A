import {fpsInit,fpsWall,fpsWorst,fpsUi} from './current-test-fps.mjs';
import {visionMetricsMethods,visionMetricsInit} from './current-test-vision-metrics.mjs';
import {controlMethods,c1ButtonUpdate,seamTimer} from './current-test-control-methods.mjs';
import {dialogueButtons,dialoguePreviewBindings} from './current-test-dialogue.mjs';
import {controlsBeforeSound,controlsAfterSound,controlButtons} from './current-test-controls.mjs';
import {actionHandlers,emergencyReturnMethod} from './current-test-actions.mjs';
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

  if(!keepProductionCave){
    A.edit("this.caveVisionMode='terrain';","this.caveVisionMode=window.HOJA_V046_PREFERRED_VISION||'terrain';");
    A.edit('this.caveFovSoft=true;','this.caveFovSoft=window.HOJA_V047_FOV_SOFT!==false;');
  }
  // Legacy reference is selected only inside the instrumented test build.
  A.edit("    const isGround=!HOJA_MAKER_MODE&&!isCave&&s.kind==='ground'&&!s.cave;","    const isGround=!HOJA_MAKER_MODE&&!isCave&&s.kind==='ground'&&!s.cave&&sessionStorage.getItem('HOJA_TEST_OLD_GROUND')!=='1';");
  A.edit("function startStage(index,fresh,spawn='start',durationSeconds=900){", "function startStage(index,fresh,spawn='start',durationSeconds=sessionStorage.getItem('HOJA_TEST_LEGACY_TIME')==='1'?600:900){");
  A.edit('RUN_TIME_SETTINGS=hojaCreateTimeSettings(durationSeconds);', "RUN_TIME_SETTINGS=sessionStorage.getItem('HOJA_TEST_LEGACY_TIME')==='1'?Object.freeze({durationSeconds:600,sunsetSeconds:100,nightSeconds:50,guideSeconds:50}):hojaCreateTimeSettings(durationSeconds);");
  A.edit('    RUN.deaths=(RUN.deaths||0)+1;', '    this.__phase4cDeathReason=reason;RUN.deaths=(RUN.deaths||0)+1;');
  A.edit('let PENDING_SEED=null;', "let PENDING_SEED=sessionStorage.getItem('HOJA_TEST_SEED')===null?null:Number(sessionStorage.getItem('HOJA_TEST_SEED'));");
  A.edit('    this.showStageBanner();\n    this.updateHUD();\n    syncBgm();', '    this.showStageBanner();\n    this.updateHUD();\n    syncBgm();\n    this.__phase4cReadyStage=STAGE_INDEX;this.__phase4cReadySeed=RUN.seed;\n    if(sessionStorage.getItem(\'HOJA_TEST_PAUSE_START\')===\'1\')this.scene.pause();');
  A.edit('const arcadeHud=window.HOJA_CREATE_HUD({', benchmarkSource+'\nconst arcadeHud=window.HOJA_CREATE_HUD({');
  A.edit('    this.hojaDoubleTap=hojaNewDoubleTapState();','    this.hojaDoubleTap=hojaNewDoubleTapState();\n'+benchmarkHandlers+profilerHandler+actionHandlers+controlsBeforeSound);
  A.edit("    document.getElementById('soundBtn').onclick=()=>this.toggleSound();", "    document.getElementById('soundBtn').onclick=()=>this.toggleSound();"+controlsAfterSound);
  A.edit('async function boot(){',profilerSource+'async function boot(){');
  A.edit('  respawnNow(){',emergencyReturnMethod+'  respawnNow(){');
  A.edit('  prepareStaticCulling(){',controlMethods+'\n  prepareStaticCulling(){');
  A.edit('  applyUrgencyState(){',visionMetricsMethods+'\n  applyUrgencyState(){');
  A.edit('  initCaveFov(){','  initCaveFov(){\n'+visionMetricsInit);
  A.edit('    this.updateFps(time,delta);','    this.updateFps(time,delta);\n    this.updateVisionBenchmark(time,delta);');

  A.edit('class HojaScene extends Phaser.Scene{',c1ButtonUpdate+'\nclass HojaScene extends Phaser.Scene{');
  A.edit('    this.createQuestionRadar();',seamTimer+'    this.createQuestionRadar();');
  A.edit('    this.createHUD();','    this.createHUD();\n'+fpsInit);
  A.edit('    if(!FPS_VISIBLE||time<this.fpsShownAt)return;',fpsWall+'    if(!FPS_VISIBLE||time<this.fpsShownAt)return;');
  A.edit('    const fps=Math.round(1000/Math.max(1,avg));','    const fps=Math.round(1000/Math.max(1,avg));\n'+fpsWorst);
  A.edit('  }\n\n  applyTextResolution(){',fpsUi+'\n  }\n\n  applyTextResolution(){');

  A.edit('    cam.setZoom(current);\n    this.applyC1ManualCamera();','    cam.setZoom(current);\n    this.hojaUpdatePixelExperimentStatus();\n    this.applyC1ManualCamera();');
  A.edit('    <div id="phaserRoot"></div>','    <div id="phaserRoot"></div>\n    <canvas id="hojaSeamMeasureCanvas" aria-hidden="true"></canvas>');

  A.edit('<main>',dialogueButtons+'\n<main>');
  A.edit("  nextEl.addEventListener('click',advance);",dialoguePreviewBindings+"  nextEl.addEventListener('click',advance);");

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
    'timePolicy(n){return hojaCreateTimeSettings(n);},timeSettings(){return {...RUN_TIME_SETTINGS};},setDuration(n){startStage(0,true,"start",n);},palette(ms){return hojaPaletteBand(ms,STAGE.theme);},' +
    'clockStep(ms,kind){const s=ACTIVE_SCENE,old=[s.manualPaused,s.quizActive,s.dying];s.manualPaused=kind==="pause";s.quizActive=kind==="quiz";s.dying=kind==="death";try{s.update(s.time.now,ms);return {ms:s.remainingMs,timeUp:s.timeUp,reason:RUN.endReason||null};}finally{[s.manualPaused,s.quizActive,s.dying]=old;}},' +
    'clockVisual(sec){const s=ACTIVE_SCENE;s.remainingMs=sec*1000;RUN.remainingMs=s.remainingMs;s.radarLastDrawAt=-1e9;s.updateQuestionRadar(s.time.now);s.updateSurfaceStreetLamps();return {radar:s.questionRadarRoot?.style.display,lamps:(s.surfaceStreetLamps||[]).map(x=>({key:x.art.texture.key,visible:x.glow.visible}))};},' +
    'stopLoop(){ACTIVE_SCENE.game.loop.stop();},step(){ACTIVE_SCENE.game.step(performance.now(),16);},' +
    'coverSites(){return CAVES.map(([a,b])=>({a,b,floor:F,stage:STAGE_INDEX,solids:SOLIDS.filter(o=>o.x<b&&o.x+o.w>a).map(o=>({x:o.x,y:o.y,w:o.w,h:o.h,slab:o.slab,cave:o.cave,kind:o.kind}))}));},' +
    'moveForCover(x,y){const s=ACTIVE_SCENE;clearInterval(window.__coverHold);window.__coverHold=setInterval(()=>s.playerBody.body.reset(x,y),16);},' +
    'freezeCover(){clearInterval(window.__coverHold);ACTIVE_SCENE.scene.pause();},' +
    'inHiddenCave(){return ACTIVE_SCENE.inCave();},' +
    'goalInfo(){const d=ACTIVE_SCENE?.doors?.find(d=>d.kind!=="entry");if(!d)return null;return {x:d.x,y:d.y,kind:d.kind,goal:GOAL_X,worldWidth:WORLD_W,frame:d.house?.frame?.name,houseHasBody:!!d.house?.body,flipped:!!d.house?.flipX,bubble:!!d.bubble,text:d.comeIn?.text,textVisible:d.comeIn?.visible,bubbleAlpha:d.bubble?.alpha};},' +
    'caveVision(){return !!ACTIVE_SCENE?.caveVisionEnabled;},' +
    'visionSamples(){return ACTIVE_SCENE?.visionFrameStats?.terrain?.length||0;},' +
    'fpsDiagnostic(){return {count:ACTIVE_SCENE?.hojaFps5sSamples?.length||0,display:!!ACTIVE_SCENE?.fpsDisplay};},' +
    'caveSettings(){return {mode:ACTIVE_SCENE?.caveVisionMode,soft:ACTIVE_SCENE?.caveFovSoft};},' +
    'caveRandom(){return CAVE_EXPERIMENT_ENABLED;},' +
    'caveRenderState(){const s=ACTIVE_SCENE;return {stage:STAGE_INDEX,collision:(s.hojaStep136CollisionOnly||[]).filter(o=>o?.active).map(o=>!!o.visible),culled:(s.hojaStep136Cullables||[]).filter(o=>o?.active).length};},' +

    'cloudStart(){return ACTIVE_SCENE.hojaCloudStartAt;},rebuildBackground(){ACTIVE_SCENE.createBackground();},cameraSafe(o){return hojaCameraSafeView(o);},visualAt(ms){const s=ACTIVE_SCENE,mode=s.hojaZoomProbeMode;s.hojaZoomProbeMode="idle";s.updateCamera(s.hojaCloudStartAt+ms);s.hojaZoomProbeMode=mode;return (s.bgLayers||[]).map(l=>({key:l.key,x:l.sprite.tilePositionX,y:l.sprite.y,tileY:l.sprite.tilePositionY,texture:l.sprite.texture.key,sourceHeight:l.sprite.texture.getSourceImage().height,drift:l.cloudDrift,visible:l.sprite.visible,displayWidth:l.sprite.displayWidth,displayHeight:l.sprite.displayHeight}));},' +
    'moveVisual(x,y){ACTIVE_SCENE.playerBody.body.reset(x,y);ACTIVE_SCENE.updateCamera(ACTIVE_SCENE.time.now);},' +
    'wallDiagnostic(){const s=ACTIVE_SCENE,b=s.playerBody.body;return {stage:STAGE_INDEX,position:{x:s.playerBody.x,y:s.playerBody.y},body:{x:b.x,y:b.y,left:b.left,right:b.right,top:b.top,bottom:b.bottom,vx:b.velocity.x,vy:b.velocity.y,blocked:{...b.blocked},touching:{...b.touching},enabled:b.enable},input:window.HOJA_P1C_INPUT.state(),paused:s.manualPaused,scenePaused:s.scene.isPaused(),dying:s.dying,quiz:s.quizActive,clear:s.clear,timeUp:s.timeUp,transitioning:s.transitioning,focus:document.hasFocus(),activeElement:document.activeElement?.tagName,overlaps:SOLIDS.filter(o=>b.right>o.x&&b.left<o.x+o.w&&b.bottom>o.y&&b.top<o.y+o.h).map(o=>({x:o.x,y:o.y,w:o.w,h:o.h,kind:o.kind})),seed:RUN?.seed??null,lastDeathReason:s.__phase4cDeathReason||null,enemies:(s.enemies||[]).filter(e=>e.alive&&e.bodyObj&&Math.abs(e.bodyObj.x-s.playerBody.x)<200).map(e=>({type:e.type,x:e.bodyObj.x,y:e.bodyObj.y,vx:e.bodyObj.body?.velocity.x,vy:e.bodyObj.body?.velocity.y}))};},' +
    'cameraInfo(){const c=ACTIVE_SCENE.cameras.main;return {scrollX:c.scrollX,scrollY:c.scrollY,zoom:c.zoom,width:c.width,height:c.height};},' +
    'bankInfo(){return (ACTIVE_SCENE.waterBankForeground||[]).map(o=>({x:o.x,y:o.y,w:o.width,h:o.height,depth:o.depth,visible:o.visible}));},' +
    'waterInfo(){return {visuals:(ACTIVE_SCENE.waterVisuals||[]).map(x=>({...x})),zones:(ACTIVE_SCENE.waterZones||[]).map(x=>({...x}))};},' +
    'raftInfo(){const s=ACTIVE_SCENE;if(!s?.playerBody?.body)return null;const b=s.playerBody.body;return {stage:STAGE_INDEX,dying:s.dying,player:{x:s.playerBody.x,y:s.playerBody.y,bottom:b.bottom,vx:b.velocity.x,vy:b.velocity.y,down:b.blocked.down||b.touching.down},rafts:(s.rafts||[]).map(r=>({x:r.bodyObj.x,top:r.bodyObj.body.top,vy:r.bodyObj.body.velocity.y,left:r.bodyObj.body.left,right:r.bodyObj.body.right,occupied:!!r.occupied,sunk:!!r.sunk,waterY:r.waterY??null,enabled:!r.bodyObj.body.checkCollision.none,artY:r.tiles[0]?.y,floatArt:r.floatArt?{x:r.floatArt.x,y:r.floatArt.y,body:!!r.floatArt.body,depth:r.floatArt.depth}:null}))};},' +
    'terrainInfo(){const s=ACTIVE_SCENE;return {theme:STAGE.theme,solids:SOLIDS.map(o=>({x:o.x,y:o.y,w:o.w,h:o.h,kind:o.kind,cave:!!o.cave,slab:!!o.slab})),physics:s.solidGroup.getChildren().map(o=>({x:o.x-o.width/2,y:o.y-o.height/2,w:o.width,h:o.height})),art:(s._v055TerrainArt||[]).filter(o=>o.__hojaV2Solid).map(o=>({x:o.x,y:o.y,w:o.width,h:o.height,kind:o.__hojaTerrainKind,ground:!!o.__hojaGroundRenderer}))};},' +
    'coverInfo(){return (ACTIVE_SCENE.caveCovers||[]).map(({cover})=>{const source=cover.texture.getSourceImage();const ctx=source.getContext("2d");const pixels=ctx.getImageData(0,0,source.width,source.height).data;let transparent=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)transparent++;return {x:cover.x,y:cover.y,w:source.width,h:source.height,alpha:cover.alpha,transparent};});},' +
    'state(){const s=ACTIVE_SCENE;if(!s?.playerBody?.body)return null;const b=s.playerBody.body;return {x:Math.round(s.playerBody.x),y:Math.round(s.playerBody.y),vx:Math.round(b.velocity.x),vy:Math.round(b.velocity.y),' +
    'grounded:!!(b.blocked.down||b.touching.down),sitting:!!s.hojaIsSitting,quiz:!!s.quizActive,paused:!!s.manualPaused,timeUp:!!s.timeUp,clear:!!s.clear,sec:Math.ceil(s.remainingMs/1000),found:RUN.found,stage:STAGE_INDEX};},' +
    'primeAnswers(n){const s=ACTIVE_SCENE;for(let i=0;i<n;i++){const q=drawQuestion();if(!q||!hojaStep09_3Open_(q))throw Error("prime question failed");const wrong=(q.answer+1)%q.choices.length;hojaStep09_3Answer_(q,false,0,wrong);RUN.found++;s.quizAnswered++;}return hojaStep09_3Metrics_();},' +
    'endReason(){return RUN.endReason||null;},raceEnd(){ACTIVE_SCENE.startTimeUp();ACTIVE_SCENE.startClear();},' +
    'quiz(){const s=ACTIVE_SCENE;const e=(s.enemies||[]).find(x=>x&&x.type===\'BALLOONEY\'&&!x.dead&&x.bodyObj&&x.bodyObj.active!==false);if(!e)return false;s.showQuiz(e);return true;},' +
    'setTime(sec){const s=ACTIVE_SCENE;s.remainingMs=sec*1000;RUN.remainingMs=s.remainingMs;},' +
    'death(){ACTIVE_SCENE.startDeath(\'pit\');},' +
    'quizNext(){const s=ACTIVE_SCENE;const e=(s.enemies||[]).find(x=>x.type===\'BALLOONEY\'&&x.alive&&!x.consumed&&x.bodyObj?.active);if(!e)return false;s.showQuiz(e);return true;},' +
    'collectFruit(){const s=ACTIVE_SCENE,f=s.flowerObjs.find(x=>!x.got);if(!f)return false;const p=s.playerBody,b=p.body,x=p.x,y=p.y;b.reset(f.x,f.img.y);s.updateFlowers(s.time.now);b.reset(x,y);return f.got;},' +
    'phase4dInfo(){const s=ACTIVE_SCENE,r=s?.hojaGimmicks,b=s?.playerBody?.body;if(!r||!b)return null;return {elapsed:r.elapsed,states:r.snapshot(),dying:!!s.dying,player:{x:s.playerBody.x,y:s.playerBody.y,vx:b.velocity.x,vy:b.velocity.y,enable:b.enable}};},' +
    'phase4b(){const s=ACTIVE_SCENE,c=s?.hojaCheckpoint;return c?{spawn:s.spawnKind,stage:c.stage,start:c.start,mid:c.mid,line:c.line,midY:c.midY,end:c.end,active:c.active,machineBody:!!c.machine.body,machineAngle:c.machine.angle,lightAlpha:c.light.alpha,props:(s.hojaPhase4bProps||[]).map(p=>({...p}))}:null;},' +
    'phase4bConflicts(){const s=ACTIVE_SCENE,c=s?.hojaCheckpoint;if(!c)return null;return {machineBlocked:hojaRectsHit(c.mid-34,c.midY-68,c.mid+34,c.midY),machineDepth:c.machine.depth,lamps:(s.surfaceStreetLamps||[]).map(l=>({x:l.x,depth:l.art.depth,blocked:hojaRectsHit(l.x-18,groundTopAt(l.x)-136,l.x+18,groundTopAt(l.x)),overlapMachine:Math.abs(l.x-c.mid)<66}))};},' +
    'phase4bMove(x){const s=ACTIVE_SCENE,c=s.hojaCheckpoint;s.playerBody.body.reset(x,groundTopAt(x)-21);s.updateCheckpointAndHazards();return c.active;},' +
    'phase4cStage(i){ACTIVE_SCENE.__phase4cReadyStage=-1;startStage(i,false,i===4?"fromSurface:0":"start");},' +
    'phase4cAudit(){const s=ACTIVE_SCENE;if(!s||s.__phase4cReadyStage!==STAGE_INDEX||s.__phase4cReadySeed!==RUN.seed)return null;const sc=s.hojaCheckpoint,cc=s.hojaCaveCheckpoint;return {seed:RUN.seed,stage:STAGE_INDEX,theme:STAGE.theme,lastDeathReason:s.__phase4cDeathReason||null,start:START_X,goal:GOAL_X,segmentOrder:STAGE.segmentOrder||null,caveStatus:CAVE_EXPERIMENT_RESULT.status,solids:SOLIDS.map(x=>({...x})),water:WATER_SPANS.map(x=>[...x]),caves:CAVES.map(x=>[...x]),moving:MOVING_PLATFORMS.map(x=>({...x})),crumbles:CRUMBLES.map(x=>({...x})),rafts:RAFTS.map(x=>({...x})),springs:SPRINGS.map(x=>({...x})),flowers:FLOWERS.map(x=>({...x})),secrets:SECRETS.map(x=>({...x})),bricks:BREAKABLE_BLOCKS.map(x=>({...x})),enemies:(s.enemies||[]).map(e=>({type:e.type,x:e.spawnX,y:e.spawnY,min:e.min,max:e.max,body:{...window.HOJA_ENEMIES.types[e.type].body}})),surfaceCheckpoint:sc?{start:sc.start,line:sc.line,mid:sc.mid,midY:sc.midY,end:sc.end,active:sc.active}:null,caveCheckpoints:cc?{portals:cc.portals.map(p=>({x:p.x,groundY:p.groundY,anchor:{...p.anchor}})),machines:cc.machines.map(m=>({x:m.x,groundY:m.groundY,room:m.room}))}:null,pipes:(s.pipes||[]).map(p=>({x:p.x,groundY:p.groundY,target:p.target}))};},' +
    'caveFixedStart(){USE_FIXED_MAPS=true;PENDING_SEED=314159;startStage(4,true,"fromSurface:0");},' +
    'caveCheckpoints(){const s=ACTIVE_SCENE,c=s?.hojaCaveCheckpoint;if(!c)return null;return {spawn:s.spawnKind,stage:STAGE_INDEX,active:c.active,machines:c.machines.map(m=>({id:m.id,x:m.x,groundY:m.groundY,room:m.room,support:m.support,scale:m.scale,machineBody:!!m.machine.body,lightAlpha:m.light.alpha,glowAlpha:m.glow.alpha,glowKey:m.glow.texture.key})),portals:c.portals.map(p=>({...p,anchor:{...p.anchor}})),anchor:{...s.caveRespawnAnchor},vision:!!s.caveVisionEnabled,solids:SOLIDS.map(o=>({x:o.x,y:o.y,w:o.w,h:o.h,kind:o.kind})),flowers:FLOWERS.map(o=>({...o})),enemies:ENEMY_SPAWNS.map(o=>({...o}))};},' +
    'caveCheckpointMove(x,feet){const s=ACTIVE_SCENE;s.playerBody.body.reset(x,feet-21);s.updateCaveCheckpoint();return {active:s.hojaCaveCheckpoint.active,anchor:{...s.caveRespawnAnchor}};},' +
    'caveCheckpointRespawn(){const s=ACTIVE_SCENE;s.respawnNow();return {x:s.playerBody.x,y:s.playerBody.y,enabled:s.playerBody.body.enable,dying:!!s.dying,transitioning:!!s.transitioning};},' +
    'phase4bPipes(){const s=ACTIVE_SCENE;return {stage:STAGE_INDEX,spawn:s?.spawnKind,pipes:(s?.pipes||[]).map(p=>({x:p.x,top:p.top,target:p.target,orientation:p.orientation}))};},' +
    'phase4bWater(){const s=ACTIVE_SCENE,z=s.waterZones[0];if(!z)throw Error("no water zone");const x=z.x+z.width/2,b=s.playerBody.body,view=s.cameraWorldView().bottom;b.reset(x,z.y-b.height/2);s.updateCheckpointAndHazards();const atSurface=!!s.dying;b.reset(x,view+66-b.height/2);s.updateCheckpointAndHazards();return {atSurface,belowScreen:!!s.dying,surface:z.y,screenBottom:view};},' +
    'phase4bRespawn(){const s=ACTIVE_SCENE;s.respawnNow();return {x:s.playerBody.x,y:s.playerBody.y};},' +
    'phase4bCamera(x){const s=ACTIVE_SCENE;s.playerBody.body.reset(x,groundTopAt(x)-21);s.updateCamera(s.time.now);},' +
    'phase4bStage(i,spawn){startStage(i,false,spawn);},' +
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
    <div id="hojaFpsDisplay" role="status" aria-live="off"></div>
    <style>#hojaFpsDisplay[style*="block"]{display:block!important;pointer-events:none}</style>
    <span id="visionMetric">시야 A/B</span>
    <div id="hojaSeamMeasurePanel" style="display:none" role="status"></div>
    <style>#hojaSeamMeasurePanel[style*="block"]{display:block!important;pointer-events:none}</style>
    ${controlButtons}
    <button id="resetBtn" type="button">처음부터</button>
    <button id="escapeCaveBtn" type="button">동굴 비상 복귀</button>
    <button id="caveRandomBtn" type="button">동굴: 랜덤 실험</button>
    <button id="hojaCpuProfileBtn" type="button" aria-pressed="false">CPU 성능 진단: 끔</button>
    <div id="hojaPerfPanel" style="display:none" aria-label="상세 성능 분석"></div>
    <style>#hojaPerfPanel[style*="block"]{display:block!important;white-space:pre-wrap;color:#000;background:#fff;pointer-events:none}</style>
    <button id="v055BenchBtn" type="button">지형 청크 자동 비교</button>
    <button id="scaleBenchBtn" type="button">배율 자동 측정</button>
    <button id="scaleQuickBtn" type="button">배율 수동 비교</button>
    <button id="renderBenchBtn" type="button">지상 렌더 비교</button>
    <div id="hojaV053Panel" style="display:none" role="status" aria-live="polite"></div>
    <style>#hojaV053Panel[style*="block"]{display:block!important;white-space:pre-wrap;color:#000;background:#fff;pointer-events:none}</style>
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

'use strict';
window.HOJA_CREATE_HUD=function(state){
  function syncDomHudScale(){
    const widthLogical=state.width;
    const vp=document.getElementById('gameViewport');
    const dom=document.getElementById('scoreHud');
    if(!vp||!dom)return;
    const width=vp.getBoundingClientRect().width||widthLogical;
    const scale=width/Math.max(1,widthLogical);
    dom.style.setProperty('--hud-scale',String(scale));
    vp.style.setProperty('--hud-scale',String(scale));
    // Do not use window.innerWidth: the game may be embedded in a smaller panel.
    vp.dataset.hudLayout=width<500?'mini':width<740?'compact':width<900?'slim':'wide';
    vp.style.setProperty('--hud-current-height',Math.ceil(dom.getBoundingClientRect().height)+'px');
  }
  function createHUD(scene){
    const barH=44;
    scene.hudBar=scene.add.rectangle(0,0,state.width,barH,0x102737,.92)
      .setOrigin(0,0).setScrollFactor(0).setDepth(190);

    scene.hudRule=scene.add.rectangle(0,barH-2,state.width,2,0xcce7ef,.34)
      .setOrigin(0,0).setScrollFactor(0).setDepth(191);

    const labelStyle={
      fontFamily:'monospace',
      fontSize:'9px',
      fontStyle:'bold',
      color:'#93b9c8'
    };
    const valueStyle={
      fontFamily:'monospace',
      fontSize:'16px',
      fontStyle:'bold',
      color:'#ffffff'
    };

    scene.hudScoreLabel=scene.add.text(24,5,'점수',labelStyle)
      .setScrollFactor(0).setDepth(200);
    scene.hudScoreValue=scene.add.text(24,18,'000000',valueStyle)
      .setScrollFactor(0).setDepth(200);

    scene.hudStageLabel=scene.add.text(state.width*0.28,5,'현재 맵',labelStyle)
      .setOrigin(.5,0).setScrollFactor(0).setDepth(200);
    scene.hudStageValue=scene.add.text(state.width*0.28,18,`${state.stageIndex+1}/${state.stageCount}`,valueStyle)
      .setOrigin(.5,0).setScrollFactor(0).setDepth(200);

    scene.hudQuizLabel=scene.add.text(state.width/2,5,'전체 문제',labelStyle)
      .setOrigin(.5,0).setScrollFactor(0).setDepth(200);
    scene.hudQuizValue=scene.add.text(state.width/2,18,'00',valueStyle)
      .setOrigin(.5,0).setScrollFactor(0).setDepth(200);

    scene.hudFlowerLabel=scene.add.text(state.width*0.72,5,'과일',labelStyle)
      .setOrigin(.5,0).setScrollFactor(0).setDepth(200);
    scene.hudFlowerValue=scene.add.text(state.width*0.72,18,'0/3',valueStyle)
      .setOrigin(.5,0).setScrollFactor(0).setDepth(200);

    scene.hudTimeLabel=scene.add.text(state.width-24,5,'남은 시간',labelStyle)
      .setOrigin(1,0).setScrollFactor(0).setDepth(200);
    scene.hudTimeValue=scene.add.text(state.width-24,18,String(Math.ceil(state.run.remainingMs/1000)),valueStyle)
      .setOrigin(1,0).setScrollFactor(0).setDepth(200);

    scene.comboText=scene.add.text(state.width/2,barH+3,'',{
      fontFamily:'monospace',fontSize:'11px',fontStyle:'bold',
      color:'#fff3a8',stroke:'#2d2412',strokeThickness:3
    }).setOrigin(.5,0).setScrollFactor(0).setDepth(201).setVisible(false);

    scene.pauseText=scene.add.text(state.width/2,74,'',{
      fontFamily:'monospace',fontStyle:'bold',fontSize:'26px',color:'#ffffff',
      stroke:'#263340',strokeThickness:6
    }).setOrigin(.5).setScrollFactor(0).setDepth(201);

    scene.clearText=scene.add.text(state.width/2,state.height*0.42,'',{
      fontFamily:'monospace',fontStyle:'bold',fontSize:'28px',color:'#ffffff',
      align:'center',stroke:'#263340',strokeThickness:7
    }).setOrigin(.5).setScrollFactor(0).setDepth(201);

    // V0.51: draw performance text in a real DOM overlay above the FOV,
    // never as a Phaser object that could be covered by cave darkness.
    scene.fpsDisplay=document.getElementById('hojaFpsDisplay');
    if(scene.fpsDisplay)scene.fpsDisplay.style.display=state.fpsVisible?'block':'none';
    scene.fpsSamples=[];scene.fpsShownAt=0;scene.lowFpsWindows=0;
    // F9 diagnostics keep a true five-second window separately from the
    // legacy 60-frame HUD sample.  The legacy array is intentionally left
    // unchanged because quality fallback and older QA modules depend on it.
    scene.hojaFps5sSamples=[];
    scene.hojaPerfLastNow=performance.now();
    scene.hojaPerfLastPlayerX=scene.playerBody?.x??null;
    scene.hojaPerfLastPlayerY=scene.playerBody?.y??null;
    scene.hojaDiagStartedAt=scene.time?.now??0;
    scene.hojaDiagMinFps=null;
    // STEP13-1: per-map minimum based on stable half-second sample windows.
    scene.hojaStep131MinFps=null;

    scene.stageBanner=scene.add.text(state.width/2,state.height*0.36,'',{
      fontFamily:'monospace',fontStyle:'bold',fontSize:'30px',color:'#ffffff',
      align:'center',stroke:'#263340',strokeThickness:7
    }).setOrigin(.5).setScrollFactor(0).setDepth(202);

    scene.nextText=scene.add.text(state.width/2,state.height*0.68,'',{
      fontFamily:'monospace',fontStyle:'bold',fontSize:'14px',color:'#fff3a8',
      align:'center',stroke:'#263340',strokeThickness:5
    }).setOrigin(.5).setScrollFactor(0).setDepth(201);

    scene.layoutHUD();
    for(const obj of [
      scene.hudBar,scene.hudRule,scene.hudScoreLabel,scene.hudScoreValue,
      scene.hudStageLabel,scene.hudStageValue,scene.hudQuizLabel,scene.hudQuizValue,
      scene.hudFlowerLabel,scene.hudFlowerValue,scene.hudTimeLabel,scene.hudTimeValue
    ])obj.setVisible(false);
    syncDomHudScale();
  }
  function layoutHUD(scene){
    const barH=44;

    scene.hudBar
      .setPosition(0,0)
      .setDisplaySize(state.width,barH);

    scene.hudRule
      .setPosition(0,barH-2)
      .setDisplaySize(state.width,2);

    scene.hudScoreLabel.setPosition(24,5);
    scene.hudScoreValue.setPosition(24,18);

    scene.hudStageLabel.setPosition(state.width*0.28,5);
    scene.hudStageValue.setPosition(state.width*0.28,18);

    scene.hudQuizLabel.setPosition(state.width/2,5);
    scene.hudQuizValue.setPosition(state.width/2,18);

    scene.hudFlowerLabel.setPosition(state.width*0.72,5);
    scene.hudFlowerValue.setPosition(state.width*0.72,18);

    scene.hudTimeLabel.setPosition(state.width-24,5);
    scene.hudTimeValue.setPosition(state.width-24,18);

    scene.comboText.setPosition(state.width/2,barH+3);
    scene.pauseText.setPosition(state.width/2,Math.max(74,state.height*0.14));
    scene.clearText.setPosition(state.width/2,state.height*0.42);
    scene.stageBanner.setPosition(state.width/2,state.height*0.36);
    scene.nextText.setPosition(state.width/2,state.height*0.68);

    scene.fixedHUD=[
      scene.hudBar,scene.hudRule,
      scene.hudScoreLabel,scene.hudScoreValue,
      scene.hudStageLabel,scene.hudStageValue,
      scene.hudQuizLabel,scene.hudQuizValue,
      scene.hudFlowerLabel,scene.hudFlowerValue,
      scene.hudTimeLabel,scene.hudTimeValue,
      scene.comboText,scene.pauseText,scene.clearText,
      scene.stageBanner,scene.nextText
    ].filter(obj=>obj.visible).map(obj=>({
      obj,
      x:obj.x,y:obj.y,
      scaleX:obj.scaleX,scaleY:obj.scaleY
    }));

    scene.updateFixedHUD(scene.cameras.main);
  }
  function updateFixedHUD(scene,cam){
    if(!scene.fixedHUD)return;

    const zoom=Math.max(.01,cam.zoom);
    const inv=state.renderScale/zoom;
    const cx=cam.width/2,cy=cam.height/2;

    for(const item of scene.fixedHUD){
      // Camera zoom is centered on the gameplay viewport.
      // Counter both size and position so HUD remains true screen-space UI.
      item.obj
        .setPosition(
          cx+(item.x*state.renderScale-cx)/zoom,
          cy+(item.y*state.renderScale-cy)/zoom
        )
        .setScale(item.scaleX*inv,item.scaleY*inv);
    }
  }
  function updateHUD(scene){
    state.run.score=scene.score;
    state.run.correctQuiz=scene.correctQuizCount;
    state.run.quizAnswered=scene.quizAnswered;
    state.run.remainingMs=scene.remainingMs; // shared across all 5 maps
    const sec=Math.max(0,Math.ceil(scene.remainingMs/1000));
    // The old Phaser top HUD is hidden; avoid needless text texture uploads
    // on every frame. The visible fixed DOM HUD is updated below.
    const combo=scene.stompCombo>1?`STOMP COMBO  x${scene.stompCombo}`:'';
    if(scene.comboText.text!==combo)scene.comboText.setText(combo);
    // DOM HUD: unaffected by camera shake. Only touch DOM when values change.
    const setDom=(id,value)=>{
      const el=document.getElementById(id);
      if(el&&el.textContent!==value)el.textContent=value;
    };
    setDom('domScore',String(scene.score));
    // STEP13-0: progress for THIS stage, preserved by stageMem when changing maps.
    // Do not use state.run.found here: that is the all-map 25-question total.
    const stageFound=Number(scene.mem?.found||0);
    const stageTotal=Number(scene.stageQuestions??state.stageQuestions);
    setDom('domStageMap',`${stageFound}/${stageTotal}`);

    setDom('domQuiz',state.makerMode?'MAKER':`${String(state.run.found).padStart(2,'0')}/${state.totalQuestions}`);
    setDom('domFlower',`${scene.flowersGot||0}/${state.flowerCount}`);
    setDom('domTime',String(sec).padStart(3,'0'));
    document.getElementById('scoreHud')?.classList.toggle('timeLow',sec<=30);
  }
  return {createHUD,layoutHUD,updateFixedHUD,updateHUD,syncDomHudScale};
};

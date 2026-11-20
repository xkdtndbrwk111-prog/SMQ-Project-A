import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../../web/current/js/hud.js',import.meta.url),'utf8');

test('DOM HUD tracks current stage, round state and resized viewport',()=>{
  const elements={};
  for(const id of ['gameViewport','scoreHud','domScore','domStageMap','domQuiz','domFlower','domTime']){
    const style={setProperty(name,value){this[name]=value;}};
    elements[id]={style,dataset:{},textContent:'',getBoundingClientRect:()=>({width:480,height:31.2}),
      classList:{toggle(name,present){this[name]=present;}}};
  }
  const window={};
  vm.runInNewContext(source,{window,document:{getElementById:id=>elements[id]}});
  const state={run:{found:7},totalQuestions:25,width:960,stageQuestions:4,flowerCount:3};
  const hud=window.HOJA_CREATE_HUD(state);
  const scene={score:63,correctQuizCount:1,quizAnswered:2,remainingMs:29001,mem:{found:2},flowersGot:1,
    stompCombo:2,comboText:{setText(value){this.text=value;}}};
  hud.updateHUD(scene);
  assert.deepEqual([elements.domScore.textContent,elements.domStageMap.textContent,elements.domQuiz.textContent,
    elements.domFlower.textContent,elements.domTime.textContent],['63','2/4','07/25','1/3','030']);
  assert.equal(scene.comboText.text,'STOMP COMBO  x2');
  assert.equal(state.run.remainingMs,29001);
  assert.equal(elements.scoreHud.classList.timeLow,true);
  state.makerMode=true;
  scene.remainingMs=30001;
  hud.updateHUD(scene);
  assert.equal(elements.domQuiz.textContent,'MAKER');
  assert.equal(elements.scoreHud.classList.timeLow,false);
  hud.syncDomHudScale();
  assert.equal(elements.scoreHud.style['--hud-scale'],'0.5');
  assert.equal(elements.gameViewport.style['--hud-current-height'],'32px');
  assert.equal(elements.gameViewport.dataset.hudLayout,'mini');
});

test('fixed objects retain screen position and scale as the camera zooms',()=>{
  const window={};
  vm.runInNewContext(source,{window});
  const hud=window.HOJA_CREATE_HUD({renderScale:2});
  const object={setPosition(x,y){this.x=x;this.y=y;return this;},setScale(x,y){this.sx=x;this.sy=y;}};
  hud.updateFixedHUD({fixedHUD:[{obj:object,x:40,y:20,scaleX:1.5,scaleY:1}]},{width:600,height:400,zoom:4});
  assert.deepEqual([object.x,object.y,object.sx,object.sy],[245,160,.75,.5]);
});

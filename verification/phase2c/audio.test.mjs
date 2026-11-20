import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../../web/current/js/audio.js',import.meta.url),'utf8');

test('parent mute, rate variation, sample gate and student volume',()=>{
  const handlers={},played=[];
  const music={volume:1,pause(){this.paused=true;}};
  const button={};
  const document={getElementById(id){
    if(id==='hojaBgm')return music;
    if(id==='soundBtn')return button;
    return {cloneNode(){return {play(){played.push({id,rate:this.playbackRate,volume:this.volume});},addEventListener(){}};}};
  }};
  let randomCalls=0,now=100;
  const math=Object.create(Math);
  math.random=()=>{randomCalls++;return .75;};
  const window={addEventListener(type,handler){handlers[type]=handler;}};
  vm.runInNewContext(source,{window,document,performance:{now:()=>now},Math:math});
  const audio=window.HOJA_CREATE_AUDIO({activeScene:()=>null,remainingMs:()=>600000});

  audio.SFX.step('grass',true);
  assert.equal(randomCalls,2);
  assert.deepEqual(played,[]);
  handlers.message({data:{type:'HOJA_PARENT_AUDIO_STATE_V053',sfxOn:true}});
  assert.equal(audio.muted,false);
  assert.equal(music.muted,true);
  assert.equal(music.paused,true);
  audio.setVolume(.5);
  assert.equal(music.volume,.125);
  audio.SFX.step('grass',true);
  audio.SFX.step('grass',true);
  assert.equal(randomCalls,6);
  assert.deepEqual(played,[{id:'sfx_step_grass2',rate:1.03,volume:.15}]);
  now+=60;
  audio.SFX.step('grass',false);
  assert.equal(played[1].volume,.08);
  audio.toggleSound();
  assert.equal(button.textContent,'소리 끔');
  assert.equal(audio.muted,true);
  assert.equal(audio.loadedSamples(),0);
});

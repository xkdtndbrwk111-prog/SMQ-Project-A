import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../../web/current/js/settlement.js',import.meta.url),'utf8');

test('finish and repeated settlement keep the original 63-point breakdown and records',()=>{
  const run={
    score:10,found:2,remainingMs:0,step09Families:new Set(['a','b']),
    stages:[{flowers:new Set(['fruit'])}],step09History:[{correct:true,points:10},{correct:false,points:0}]
  };
  const scene={score:10,remainingMs:599999,playerBody:{x:32,body:{top:17}},awardScore(n){this.score+=n;}};
  const elements=new Map(),opened=[];
  const document={getElementById(id){
    if(!elements.has(id))elements.set(id,{dataset:{},style:{}});
    return elements.get(id);
  }};
  const window={};
  vm.runInNewContext(source,{window,document});
  const settle=window.HOJA_CREATE_SETTLEMENT({
    run,activeScene:()=>scene,hasQuestions:()=>true,pointsPerFlower:5,totalQuestions:25,
    showRanking:(...args)=>opened.push(args),closeRanking(){}
  });
  settle.finalizeFinish(scene);
  settle.finalizeFinish(scene);
  settle.finalizeFlowerBonus(scene);
  assert.equal(scene.score,63);
  assert.equal(run.score,63);
  settle.hojaStep09_3ShowResult_(scene,'전체 스테이지 완료');
  const metrics=settle.hojaStep09_3Metrics_();
  assert.deepEqual([metrics.quizPoints,metrics.flowerBonus,metrics.timeBonus,metrics.otherPoints],[10,5,48,0]);
  assert.equal(metrics.answered,2);
  assert.equal(metrics.wrong,1);
  assert.equal(elements.get('step09RunResult').dataset.verified,'true');
  assert.deepEqual(opened,[[scene,'전체 스테이지 완료']]);
  assert.deepEqual(run.step09History,[{correct:true,points:10},{correct:false,points:0}]);
});

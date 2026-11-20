import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../../web/current/arcade.html',import.meta.url),'utf8');
const start=html.indexOf('window.HOJA_V2_NEXT_STAGE=function(){');
const end=html.indexOf('\n};',start)+3;
const wrapStart=html.indexOf("if(typeof window.HOJA_V2_NEXT_STAGE==='function'){");
const wrapEnd=html.indexOf('\n}',wrapStart)+2;
assert.ok(start>=0&&end>start&&wrapStart>=0&&wrapEnd>wrapStart);
const definitions=html.slice(start,end)+'\n'+html.slice(wrapStart,wrapEnd);

test('normal arcade cannot force a stage, Maker retains next-map path',()=>{
 const calls=[];
 const context=vm.createContext({window:{},HOJA_MAKER_MODE:false,HOJA_RANK_TEST_MODE_:false,STAGE_INDEX:1,RUN_STAGES:[1,2,3],startStage:(...args)=>calls.push(args)});
 vm.runInContext(definitions,context);
 assert.equal(context.window.HOJA_V2_NEXT_STAGE(),false);
 assert.deepEqual(calls,[]);
 assert.equal(context.HOJA_RANK_TEST_MODE_,false);
 context.HOJA_MAKER_MODE=true;
 context.window.HOJA_V2_NEXT_STAGE();
 assert.deepEqual(calls,[[2,false,'start']]);
 assert.equal(context.HOJA_RANK_TEST_MODE_,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const source=fs.readFileSync(fileURLToPath(new URL('../../web/current/js/keyboard.js',import.meta.url)),'utf8');
function setup(){
 const listeners={};const domListeners={};let now=0;
 const overlays={};const document={hidden:false,getElementById:id=>overlays[id]||null,addEventListener:(n,f)=>(domListeners[n]??=[]).push(f)};
 const window={addEventListener:(n,f)=>(listeners[n]??=[]).push(f)};
 const context=vm.createContext({window,document,performance:{now:()=>++now},Object});
 vm.runInContext(source,context,{filename:'keyboard.js'});
 const input=window.HOJA_CREATE_INPUT();
 const fire=(type,props={})=>{const event={code:'',key:'',prevented:false,preventDefault(){this.prevented=true},...props};for(const f of listeners[type]||[])f(event);return event};
 return {input,window,document,overlays,fire,domListeners};
}
test('physical key down/up including Korean fallback and short tap',()=>{
 const {input,fire}=setup();const e=fire('keydown',{code:'KeyD',key:'ㅇ'});assert.equal(e.prevented,true);assert.equal(input.keys.right.isDown,true);fire('keyup',{code:'KeyD'});assert.equal(input.keys.right.isDown,false);assert.equal(input.keys.right._justDown,true);
 fire('keydown',{code:'',key:'ㅁ'});assert.equal(input.keys.left.isDown,true);fire('keyup',{key:'ㅁ'});assert.equal(input.keys.left.isDown,false);
});
test('quiz, help and blur release keys; legacy keys do not move',()=>{
 const {input,window,overlays,fire}=setup();fire('keydown',{code:'KeyD'});assert.equal(input.keys.right.isDown,true);window.HOJA_HELP={open:true};fire('keydown',{code:'KeyA'});assert.equal(input.keys.right.isDown,false);assert.equal(input.keys.left.isDown,false);window.HOJA_HELP.open=false;
 overlays.quizOverlay={classList:{contains:n=>n==='active'}};fire('keydown',{code:'Period'});assert.equal(input.keys.jump.isDown,false);delete overlays.quizOverlay;
 fire('keydown',{code:'KeyD'});fire('blur');assert.equal(input.keys.right.isDown,false);fire('keydown',{code:'ArrowRight'});fire('keydown',{code:'Space'});assert.equal(input.keys.right.isDown,false);assert.equal(input.keys.jump.isDown,false);
});

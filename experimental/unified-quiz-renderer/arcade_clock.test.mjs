import test from 'node:test';
import assert from 'node:assert/strict';
import {hojaArcadeClockDelta} from './HOJA_ARCADE_APPROVED_RUNTIME.mjs';

test('visible focused startup uses elapsed frame time at low and normal FPS',()=>{
 const loop={inFocus:true,_coolDown:80,rawDelta:116.7};
 assert.equal(hojaArcadeClockDelta(16.67,loop,'visible'),116.7);
 assert.equal(hojaArcadeClockDelta(16.67,{...loop,rawDelta:16.7},'visible'),16.7);
});
test('preserves original delta outside cooldown and while hidden or unfocused',()=>{
 const loop={inFocus:true,_coolDown:1,rawDelta:110};
 assert.equal(hojaArcadeClockDelta(17,{...loop,_coolDown:0},'visible'),17);
 assert.equal(hojaArcadeClockDelta(17,{...loop,inFocus:false},'visible'),17);
 assert.equal(hojaArcadeClockDelta(17,loop,'hidden'),17);
 assert.equal(hojaArcadeClockDelta(17,null,'visible'),17);
});
test('bounds a large suspension gap and ignores invalid raw deltas',()=>{
 const loop={inFocus:true,_coolDown:1,rawDelta:5000};
 assert.equal(hojaArcadeClockDelta(17,loop,'visible'),250);
 for(const rawDelta of [NaN,Infinity,-1,0])assert.equal(hojaArcadeClockDelta(17,{...loop,rawDelta},'visible'),17);
});

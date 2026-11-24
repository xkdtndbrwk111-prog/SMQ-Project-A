#!/usr/bin/env node
/** HOJA 1.5 approved 23 display names: tiny DOM-free regression test.
 * Requires no browser and does not run the game or contact Google.
 * node experimental/usage-v4-unified/verify_approved_display_client.mjs
 */
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';

const dir=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(dir,'gas/ApprovedCartridgeDisplayClient.html'),'utf8');
const body=source.replace(/^<script[^>]+>\s*/, '').replace(/\s*<\/script>\s*$/, '');
assert(!body.includes('<script'), 'unexpected nested script');
const match=body.match(/Object\.freeze\((\{[\s\S]*?\})\);\nconst active/);
assert(match,'approved title map absent');
const mapping=JSON.parse(match[1]);
const index=JSON.parse(readFileSync(join(dir,'approved-catalog/generated/approved-source-index.json'),'utf8'));
assert.equal(index.entries.length,23);
assert.equal(Object.keys(mapping).length,23);
for(const e of index.entries){
 const d=mapping[e.cartridgeId];
 assert(d,'missing '+e.cartridgeId);
 assert.equal(d.sourceTitle,e.approvedTitle);
 assert.equal(d.number,String(e.unit)+(e.subunit==null?'':'-'+e.subunit));
 assert(d.title.trim()&&!/초등학교|출판사 공통|Lesson\s+\d+/i.test(d.title),e.cartridgeId);
}

const keys=Object.keys(mapping);
const approved=keys.map(id=>({name:`6-사회-${mapping[id].sourceTitle}`,pkg:{id},cartridgeId:id}));
const legacy={name:'5-수학-기존 카트리지',cartridgeId:123};
const response=[...approved,legacy];
const cards=keys.map(id=>makeCard(mapping[id].sourceTitle));
cards.push(makeCard('기존 카트리지'));
const rail={querySelectorAll:()=>cards.map(c=>c.button)};
const selected={textContent:mapping[keys[0]].sourceTitle};
const styles=[];const callbacks=[];
const document={
 readyState:'complete',
 getElementById:id=>id==='hcRail'?rail:id==='hcNextSelected'?selected:null,
 head:{appendChild:v=>styles.push(v)},
 createElement:tag=>({className:'',textContent:'',dataset:{},style:{},tagName:tag})
};
class MutationObserver{constructor(cb){callbacks.push(cb)} observe(){}}
const calls=[];
const window={HOJA_B_LIVE:{rpc:(method,payload)=>{
 calls.push({method,payload});
 return Promise.resolve(method==='LIST'?response:{ok:true});
}}};
runInNewContext(body,{window,document,MutationObserver,Promise,Object,Array,String});
const listed=await window.HOJA_B_LIVE.rpc('LIST');
for(const cb of callbacks)cb();
assert.equal(listed,response,'LIST changed');
assert.equal(window.HOJA15_APPROVED_DISPLAY.activeUnits,23);
cards.slice(0,23).forEach((c,i)=>{
 const d=mapping[keys[i]];
 assert.equal(c.title.textContent,d.title);
 assert.equal(c.face.children[0].textContent,d.number);
 assert.equal(c.button.title,d.number+'. '+d.title);
 assert.equal(c.badge.hidden,true);
});
assert.equal(cards[23].title.textContent,'기존 카트리지','legacy title changed');
assert.equal(cards[23].badge.hidden,false,'legacy PAK changed');
assert.equal(selected.textContent,mapping[keys[0]].number+'. '+mapping[keys[0]].title);
await window.HOJA_B_LIVE.rpc('GET',[approved[0].name]);
await window.HOJA_B_LIVE.rpc('RANK_SAVE',{cartridge:approved[0].name});
assert.equal(calls[1].payload[0],approved[0].name,'GET renamed');
assert.equal(calls[2].payload.cartridge,approved[0].name,'rank key renamed');
assert.equal(styles.length,1);
console.log('HOJA15_APPROVED_DISPLAY_PASS 23/23; GET and RANK_SAVE identities unchanged; legacy unaffected');

function makeCard(original){
 const title={textContent:original,dataset:{fullLabel:original}};
 const badge={textContent:'PAK 01',hidden:false};
 const face={children:[],insertBefore(el){this.children.unshift(el)},querySelector:q=>q==='strong.hcUnitName'?title:q==='small'?badge:null};
 const button={
  title:original,dataset:{},classList:{toggle(){},add(){}},setAttribute(){},
  querySelector:q=>q==='.hcFace'?face:null
 };
 return {title,badge,face,button};
}

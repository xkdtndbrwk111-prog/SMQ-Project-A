import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const game=fs.readFileSync(process.argv[2],'utf8');
const start=game.indexOf(' function collide(){const p=player().getBoundingClientRect()');
const end=game.indexOf(' function closeQuestion(){',start);
assert(start>=0&&end>start,'SOLO_JUMP_SOURCE_NOT_FOUND');
const source=game.slice(start,end);
assert(source.includes('const jumpHeight=t=>4*amplitude*t*(1-t)'),'SWEEP_PATCH_MISSING');
function run(frames,{bx=576,by=351,active=false}={}){
 const context=vm.createContext({bx,by,active,frames});
 return JSON.parse(vm.runInContext("(()=>{\n let page='quiz',activeQuiz=active,jumping=false,finished=false,opened=0,anim=0,now=0,queue=[];\n const idle='idle',jump='jump',window={};const performance={now:()=>now};\n const host=()=>({hidden:false}),stage=()=>({clientHeight:734});\n const playerObj={style:{transform:'translateX(-50%) translateY(0px)'},getBoundingClientRect(){\n   const h=Number(this.style.transform.match(/translateY\\((-?[\\d.]+)px\\)/)[1]);\n   return {left:576,right:704,top:521.6875+h,bottom:649.6875+h};\n }};\n const player=()=>playerObj,img=()=>({getBoundingClientRect:()=>({left:bx,right:bx+128,top:by,bottom:by+128})});\n const requestAnimationFrame=f=>(queue.push(f),queue.length);\n const openQuestion=()=>{opened++;activeQuiz=true;};\n"+source+"\n triggerJump();triggerJump();\n for(const f of frames){now=f;const cb=queue.shift();if(cb)cb(f);}\n return JSON.stringify({opened,jumping,remaining:queue.length});\n })()",context));
}
for(const frames of [[16,32,48,64,80,96,112,128,800],[7,23,39,58,1323,1325,9100],[1300],[400,800]])
 assert.deepEqual(run(frames),{opened:1,jumping:false,remaining:0});
for(const opt of [{bx:1000},{by:100},{by:700},{active:true}])
 assert.deepEqual(run([16,1300],opt),{opened:0,jumping:false,remaining:0});
console.log('SOLO_SWEEP_PASS 8 cases (exact assembled runtime, observed stall, no false hits, duplicate guard)');

import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassModel,settings,isolatedEnvironment,DEMO_PROJECT,ProductClockModel,applyRevision} from './model.mjs';
const join=(s,uid='s1',name='fox',team='red')=>s.join({sessionId:'session-demo',uid,name,team,gameVersion:'game-a',cartridgeVersion:'cart-a'});
const setup=()=>{const s=new ClassModel();s.open('teacher');const p=join(s);s.start('teacher');return {s,p:s.snapshot.participants.find(x=>x.id===p.id)}};
const result={reason:'FINISH',found:25,answered:2,correct:1,flowers:1,remainingSeconds:48,otherPoints:0,score:63};
const req=(p,over={})=>({sessionId:'session-demo',uid:p.uid,pid:p.id,runId:p.runId,epoch:p.epoch,requestId:'req1',result,...over});
const denied=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('900 seconds, 10 minute rounding and proposed range boundaries',()=>{
 assert.deepEqual(settings(),{durationSeconds:900,sunsetThresholdSeconds:200,nightThresholdSeconds:100,questionGuideThresholdSeconds:100,settingsRevision:1});
 assert.equal(settings(600).sunsetThresholdSeconds,133);assert.equal(settings(600).nightThresholdSeconds,67);
 assert.equal(settings(300).durationSeconds,300);assert.equal(settings(1800).durationSeconds,1800);
 for(const n of [0,299,301,899,1801,NaN,'900'])denied(()=>settings(n),'INVALID_DURATION');
});
test('only teacher changes duration before start and start freezes all players settings',()=>{
 const s=new ClassModel();s.open('teacher');denied(()=>s.changeDuration('student',600),'FORBIDDEN');
 assert.equal(s.changeDuration('teacher',600).settingsRevision,2);join(s);s.start('teacher');
 denied(()=>s.changeDuration('teacher',900),'INVALID_STATE');assert.equal(s.snapshot.settings.durationSeconds,600);
});
test('same UID repeat is idempotent, same name with different UID never merges',()=>{
 const s=new ClassModel();s.open('teacher');const p=join(s);assert.equal(join(s).id,p.id);
 denied(()=>join(s,'s2','fox'),'NAME_COLLISION');assert.equal(s.snapshot.participants.length,1);
});
test('join and freeze both serial orders give inclusion or rejection',()=>{
 for(const order of ['join-first','start-first']){const s=new ClassModel();s.open('teacher');join(s);
  if(order==='join-first'){join(s,'s2','owl');s.start('teacher');assert.equal(s.snapshot.participants.length,2)}
  else{s.start('teacher');denied(()=>join(s,'s2','owl'),'INVALID_STATE');assert.equal(s.snapshot.participants.length,1)}
 }
});
test('wrong game or cartridge version rejects new and returning participants',()=>{
 const s=new ClassModel();s.open('teacher');join(s);
 for(const x of [{gameVersion:'old',cartridgeVersion:'cart-a'},{gameVersion:'game-a',cartridgeVersion:'old'}])denied(()=>s.join({sessionId:'session-demo',uid:'s1',name:'fox',team:'red',...x}),'VERSION_MISMATCH');
});
test('old epoch is denied for new submissions, exact accepted receipt survives epoch and closure',()=>{
 const {s,p}=setup();const r=s.submit(req(p));const newer=s.reconnect(p.uid,p.id);
 denied(()=>s.submit(req(p,{requestId:'different'})),'STALE_EPOCH');s.close('teacher');s.finalize('teacher');
 assert.deepEqual(s.submit(req(p)),{...r,replayed:true});
 assert.deepEqual(s.submit(req(newer)),{...r,replayed:true});
});
test('same request result returns receipt, changed payload conflicts and new ID cannot double count',()=>{
 const {s,p}=setup();const first=s.submit(req(p));assert.equal(s.submit(req(p)).receiptId,first.receiptId);
 denied(()=>s.submit(req(p,{result:{...result,score:64}})),'REQUEST_CONFLICT');
 denied(()=>s.submit(req(p,{requestId:'req2'})),'INVALID_RUN');assert.equal(s.teams()[0].sum,63);
});
test('closing and new result in both serial orders and no late backdating',()=>{
 for(const order of ['submit-first','close-first']){const {s,p}=setup();
  if(order==='submit-first'){s.submit(req(p));s.close('teacher');assert.equal(s.finalize('teacher')[0].sum,63)}
  else{s.close('teacher');denied(()=>s.submit(req(p)),'INVALID_STATE');assert.equal(s.finalize('teacher')[0].sum,0)}
 }
});
test('receipt retrieval is bound to the participant, even after close',()=>{
 const {s,p}=setup();s.submit(req(p));s.close('teacher');
 denied(()=>s.submit(req(p,{uid:'intruder'})),'FORBIDDEN');
 denied(()=>s.submit(req(p,{result:{...result,score:999}})),'REQUEST_CONFLICT');
});
test('only owner controls state and sixty second notice does not stop game',()=>{
 const {s}=setup();denied(()=>s.notice('student'),'FORBIDDEN');denied(()=>s.close('student'),'FORBIDDEN');
 assert.equal(s.notice('teacher').noticeSeconds,60);assert.equal(s.snapshot.state,'RUNNING');
 s.close('teacher');denied(()=>s.close('teacher'),'INVALID_STATE');s.finalize('teacher');
});
test('teacher-authorized rerun voids previous aggregate, changes epoch and audits',()=>{
 const {s,p}=setup();const oldReceipt=s.submit(req(p));denied(()=>s.rerun('student',p.id),'FORBIDDEN');
 const next=s.rerun('teacher',p.id);assert.notEqual(next.runId,p.runId);assert.ok(next.epoch>p.epoch);assert.equal(s.teams()[0].sum,0);
 assert.equal(s.submit(req(p)).receiptId,oldReceipt.receiptId); // Historical acceptance, not a current team contribution.
 denied(()=>s.submit(req(p,{requestId:'new-old-run'})),'STALE_EPOCH');
 s.submit(req(next,{requestId:'new-run'}));assert.equal(s.teams()[0].sum,63);
 assert.equal(s.snapshot.audit[0].oldRunId,p.runId);
});
test('team average uses frozen team size and ties share rank',()=>{
 const s=new ClassModel();s.open('teacher');join(s);join(s,'s2','owl','red');join(s,'s3','cat','blue');s.start('teacher');
 const ps=s.snapshot.participants;s.submit(req(ps[0],{result:{...result,score:20,remainingSeconds:5}}));
 s.submit(req(ps[2],{result:{...result,score:10,correct:1,flowers:0,remainingSeconds:0}}));
 const [blue,red]=s.teams();assert.deepEqual([blue.average,red.average,blue.rank,red.rank],[10,10,1,1]);
 assert.equal(red.unsubmitted,1);
});
test('bad score, invalid timer, fake quiz and invented 25-answer settlement are rejected',()=>{
 const {s,p}=setup();
 for(const bad of [{...result,score:999},{...result,remainingSeconds:901},{...result,correct:3},{...result,reason:'TIME_UP'}])denied(()=>s.submit(req(p,{result:bad})),bad.score===999?'INVALID_SCORE':'INVALID_RESULT');
 denied(()=>s.submit(req(p,{result:{...result,reason:'QUIZ_25',found:25,answered:25}})),'SCORING_POLICY_UNRESOLVED');
});
test('demo-only, both emulators alive, loopback allowlist; single does not initialize Firebase',()=>{
 const env={projectId:DEMO_PROJECT,authHost:'127.0.0.1:19099',firestoreHost:'127.0.0.1:18080',authAlive:true,firestoreAlive:true,actualTarget:'127.0.0.1:18080',mode:'class'};
 assert.equal(isolatedEnvironment(env).network,'local-demo-only');assert.equal(isolatedEnvironment({mode:'single'}).network,false);
 for(const bad of [{projectId:'prod'},{authAlive:false},{firestoreAlive:false},{authHost:'localhost:19099'},{actualTarget:'firestore.googleapis.com:443'},{mode:'other'}])denied(()=>isolatedEnvironment({...env,...bad}),'ISOLATION_DENIED');
});
test('teacher exclusion invalidates score while frozen team denominator remains auditable',()=>{
 const {s,p}=setup();s.submit(req(p));denied(()=>s.exclude('student',p.id),'FORBIDDEN');s.exclude('teacher',p.id);
 assert.equal(s.teams()[0].members,1);assert.equal(s.teams()[0].excluded,1);assert.equal(s.teams()[0].sum,0);
 denied(()=>s.reconnect(p.uid,p.id),'INVALID_PARTICIPANT');assert.equal(s.snapshot.audit.at(-1).action,'EXCLUDE');
});
test('product 900-second clock transitions at 200 and 100 remaining and freezes under pause',()=>{
 const c=new ProductClockModel();assert.equal(c.state.remainingMs,900000);assert.equal(c.state.sunset,false);
 for(const flag of ['quiz','paused','dying']){c.tick(10000,{[flag]:true});assert.equal(c.state.remainingMs,900000)}
 c.tick(699999);assert.equal(c.state.sunset,false);c.tick(1);assert.equal(c.state.sunset,true);assert.equal(c.state.night,false);
 c.tick(100000);assert.deepEqual([c.state.night,c.state.lamp,c.state.guide],[true,true,true]);
 c.tick(100000);assert.equal(c.state.ended,'TIME_UP');c.tick(10);assert.equal(c.state.remainingMs,0);
});
test('product model ends after the 25th response without inventing settlement score',()=>{
 const c=new ProductClockModel();for(let i=0;i<24;i++)c.answer();assert.equal(c.state.ended,null);
 const after=c.answer();assert.equal(after.answered,25);assert.equal(after.ended,'QUIZ_25');assert.equal(after.remainingMs,900000);
 denied(()=>c.answer(),'ALREADY_ENDED');
});
test('session ID and monotonic revisions prevent cross-session or stale event acceptance',()=>{
 const {s,p}=setup();denied(()=>s.submit(req(p,{sessionId:'other-session'})),'SESSION_MISMATCH');
 assert.equal(applyRevision(10,8),10);assert.equal(applyRevision(10,10),10);assert.equal(applyRevision(10,11),11);
 denied(()=>applyRevision(10,-1),'INVALID_REVISION');
});

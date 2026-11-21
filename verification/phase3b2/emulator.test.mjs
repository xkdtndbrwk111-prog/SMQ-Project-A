import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc} from 'firebase/firestore';
import {createLocalService} from './service.mjs';
import {assertIsolation,assertReady,PROJECT} from './isolation.mjs';
let app,auth,db,service,teacher,otherTeacher,student,student2,student3;
const endpoint='http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:';
async function signin(email,password){const r=await fetch(endpoint+'signInWithPassword?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.ok(r.ok,await r.clone().text());return (await r.json()).idToken;}
async function fakeUser(role){const suffix=randomUUID(),email=`fake-${suffix}@example.test`,password='fake-password-123';const u=await auth.createUser({email,password});if(role==='teacher')await auth.setCustomUserClaims(u.uid,{teacher:true});return {uid:u.uid,token:await signin(email,password)};}
const throwsCode=(promise,code)=>assert.rejects(promise,e=>e.code===code);
const room=async()=>{const x=await service.createRoom(teacher.token,{gameVersion:'game-1',cartridgeVersion:'cart-1'});await service.publish(teacher.token,x.sessionId);return x;};
const rawJoin=(x,user,name)=>service.join(user.token,x.sessionId,{inviteToken:x.inviteToken,name,gameVersion:'game-1',cartridgeVersion:'cart-1'});
const join=async(x,user,name,team='red')=>{const p=await rawJoin(x,user,name);await service.assignTeam(teacher.token,x.sessionId,p.participantId,team);return p;};
const result={reason:'FINISH',found:25,answered:2,correct:1,flowers:1,remainingSeconds:48,otherPoints:0,score:63};
async function running(){const x=await room(),p=await join(x,student,'fox');await service.start(teacher.token,x.sessionId);const state=await service.participant(student.token,x.sessionId,p.participantId);return {x,p,state};}
const request=(p,state,over={})=>({participantId:p.participantId,runId:state.runId,connectionEpoch:state.connectionEpoch,requestId:'request-1',gameVersion:'game-1',cartridgeVersion:'cart-1',result,...over});
before(async()=>{await assertReady();app=initializeApp({projectId:PROJECT},'phase3b2-seed-'+randomUUID());auth=getAuth(app);db=getFirestore(app);service=await createLocalService();[teacher,otherTeacher,student,student2,student3]=await Promise.all([fakeUser('teacher'),fakeUser('teacher'),fakeUser('student'),fakeUser('student'),fakeUser('student')]);});
after(async()=>{if(service)await service.dispose();if(app)await deleteApp(app);});
test('isolation rejects live project, host, missing emulator and credentials',async()=>{
 const e={GCLOUD_PROJECT:PROJECT,GOOGLE_CLOUD_PROJECT:PROJECT,FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099'};assert.equal(assertIsolation(e).projectId,PROJECT);
 for(const bad of [{GCLOUD_PROJECT:'real-project'},{GOOGLE_CLOUD_PROJECT:'real-project'},{FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com:443'},{FIREBASE_AUTH_EMULATOR_HOST:'localhost:19099'},{FIRESTORE_EMULATOR_HOST:''},{GOOGLE_APPLICATION_CREDENTIALS:'/secret'}])assert.throws(()=>assertIsolation({...e,...bad}),x=>x.code==='EMULATOR_ISOLATION_REQUIRED');
});
test('auth and session ownership enforced by trusted service',async()=>{
 await throwsCode(service.createRoom('',{gameVersion:'g',cartridgeVersion:'c'}),'UNAUTHENTICATED');
 await throwsCode(service.createRoom('forged-token',{gameVersion:'g',cartridgeVersion:'c'}),'UNAUTHENTICATED');
 await throwsCode(service.createRoom(student.token,{gameVersion:'g',cartridgeVersion:'c'}),'FORBIDDEN');
 const x=await room();await throwsCode(service.start(otherTeacher.token,x.sessionId),'FORBIDDEN');await throwsCode(service.close(student.token,x.sessionId),'FORBIDDEN');
});
test('settings and versions are validated and freeze on start',async()=>{
 const x=await room();assert.deepEqual([x.settings.durationSeconds,x.settings.sunsetThresholdSeconds,x.settings.nightThresholdSeconds,x.settings.questionGuideThresholdSeconds],[900,200,100,100]);await throwsCode(service.setDuration(student.token,x.sessionId,600),'FORBIDDEN');await throwsCode(service.setDuration(teacher.token,x.sessionId,601),'INVALID_DURATION');
 const cfg=await service.setDuration(teacher.token,x.sessionId,600);assert.deepEqual([cfg.durationSeconds,cfg.sunsetThresholdSeconds,cfg.nightThresholdSeconds],[600,133,67]);
 await throwsCode(service.join(student.token,x.sessionId,{inviteToken:x.inviteToken,name:'fox',gameVersion:'wrong',cartridgeVersion:'cart-1'}),'VERSION_MISMATCH');
 await join(x,student,'fox');await service.start(teacher.token,x.sessionId);await throwsCode(service.setDuration(teacher.token,x.sessionId,900),'INVALID_STATE');
});
test('concurrent duplicate join, duplicate names, invite and participant privacy',async()=>{
 const x=await room();const both=await Promise.all([rawJoin(x,student,'fox'),rawJoin(x,student,'fox')]);assert.equal(both[0].participantId,both[1].participantId);await service.assignTeam(teacher.token,x.sessionId,both[0].participantId,'red');assert.equal((await db.collection('sessions').doc(x.sessionId).collection('participants').get()).size,1);
 await throwsCode(join(x,student2,'fox'),'NAME_COLLISION');const p2=await join(x,student2,'owl','blue');
 await throwsCode(service.participant(student.token,x.sessionId,p2.participantId),'FORBIDDEN');assert.equal((await service.participant(teacher.token,x.sessionId,p2.participantId)).name,'owl');
 await throwsCode(service.join(student3.token,x.sessionId,{inviteToken:'bad',name:'cat',gameVersion:'game-1',cartridgeVersion:'cart-1'}),'INVALID_INVITE');
});
test('actual deny-all rules block other student responses and direct score/team writes',async()=>{
 const x=await room(),p=await join(x,student,'fox'),p2=await join(x,student2,'owl');const ref=db.collection('sessions').doc(x.sessionId);await ref.collection('privateResponses').doc(p2.participantId).set({answer:'fake'});
 const env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:18080}});
 try{const other=env.authenticatedContext(student.uid).firestore(),anon=env.unauthenticatedContext().firestore(),teach=env.authenticatedContext(teacher.uid,{teacher:true}).firestore();
  await assertFails(getDoc(doc(other,`sessions/${x.sessionId}/privateResponses/${p2.participantId}`)));
  await assertFails(setDoc(doc(other,`sessions/${x.sessionId}/runs/forged`),{score:999}));
  await assertFails(setDoc(doc(other,`sessions/${x.sessionId}/teams/red`),{sum:999}));
  await assertFails(getDoc(doc(anon,`sessions/${x.sessionId}`)));
  await assertFails(getDoc(doc(teach,`sessions/${x.sessionId}`)));
 }finally{await env.cleanup();}
});
test('stale epoch, idempotency, version, spoofed result and post-close receipt',async()=>{
 const {x,p,state}=await running(),newConn=await service.reconnect(student.token,x.sessionId,p.participantId);
 await throwsCode(service.submit(student.token,x.sessionId,request(p,state)),'STALE_EPOCH');const valid=request(p,{...state,connectionEpoch:newConn.connectionEpoch});
 await throwsCode(service.submit(student2.token,x.sessionId,valid),'FORBIDDEN');await throwsCode(service.submit(student.token,x.sessionId,{...valid,gameVersion:'old'}),'VERSION_MISMATCH');
 await throwsCode(service.submit(student.token,x.sessionId,{...valid,result:{...result,score:999}}),'INVALID_SCORE');
 await throwsCode(service.submit(student.token,x.sessionId,{...valid,result:{...result,reason:'QUIZ_25'}}),'SCORING_POLICY_UNRESOLVED');
 const first=await service.submit(student.token,x.sessionId,valid);assert.equal(first.score,63);assert.equal(first.verification,'client_reported');
 const same=await service.submit(student.token,x.sessionId,valid);assert.equal(same.replayed,true);assert.equal(same.runId,first.runId);
 await throwsCode(service.submit(student.token,x.sessionId,{...valid,result:{...result,score:64}}),'REQUEST_CONFLICT');
 await throwsCode(service.submit(student.token,x.sessionId,{...valid,requestId:'other'}),'INVALID_RUN');await service.close(teacher.token,x.sessionId);
 assert.equal((await service.submit(student.token,x.sessionId,valid)).replayed,true);assert.equal((await service.receipt(student.token,x.sessionId,valid)).score,63);
 await throwsCode(service.receipt(student2.token,x.sessionId,valid),'FORBIDDEN');const teams=await service.finalize(teacher.token,x.sessionId);assert.equal(teams[0].sum,63);assert.equal(teams[0].members,1);assert.equal((await service.submit(student.token,x.sessionId,valid)).replayed,true);assert.equal((await service.receipt(student.token,x.sessionId,valid)).score,63);
});
test('teacher rerun invalidates previous contribution and preserves audit receipt',async()=>{
 const {x,p,state}=await running(),old=request(p,state);await service.submit(student.token,x.sessionId,old);await throwsCode(service.rerun(student.token,x.sessionId,p.participantId),'FORBIDDEN');
 const rerun=await service.rerun(teacher.token,x.sessionId,p.participantId);assert.notEqual(rerun.runId,state.runId);assert.ok(rerun.connectionEpoch>state.connectionEpoch);
 assert.equal((await service.receipt(student.token,x.sessionId,old)).score,63);
 await throwsCode(service.submit(student.token,x.sessionId,{...old,requestId:'old-new'}),'STALE_EPOCH');
 await service.submit(student.token,x.sessionId,request(p,{...state,...rerun},{requestId:'new-run'}));await service.close(teacher.token,x.sessionId);
 const teams=await service.finalize(teacher.token,x.sessionId);assert.equal(teams[0].sum,63);assert.equal((await db.collection('sessions').doc(x.sessionId).collection('audit').get()).size,1);
});
test('real concurrent submission and close produce one serialized result',async()=>{
 for(let i=0;i<4;i++){const {x,p,state}=await running(),requestData=request(p,state),both=await Promise.allSettled([service.submit(student.token,x.sessionId,requestData),service.close(teacher.token,x.sessionId)]);
  const ref=db.collection('sessions').doc(x.sessionId);
  if(both[1].status==='rejected'){
   assert.equal(both[1].reason.code,'RETRYABLE_CONFLICT');const current=(await ref.get()).data().state;if(current==='RUNNING')await service.close(teacher.token,x.sessionId);else assert.equal(current,'CLOSING');
  }
  if(both[0].status==='rejected')assert.ok(['INVALID_STATE','RETRYABLE_CONFLICT'].includes(both[0].reason.code));
  const receipts=await ref.collection('receipts').get();assert.ok(receipts.size<=1);
  if(receipts.size===1)assert.equal((await service.submit(student.token,x.sessionId,requestData)).replayed,true);
  else await throwsCode(service.submit(student.token,x.sessionId,requestData),'INVALID_STATE');
  const rows=await service.finalize(teacher.token,x.sessionId);assert.equal(rows[0].sum,receipts.size?63:0);
 }
});
test('Firestore transaction callback retries an injected ABORTED once and commits once',async()=>{
 const ref=db.collection('retryChecks').doc(randomUUID());await ref.set({value:0});let calls=0;
 await db.runTransaction(async tx=>{calls++;const s=await tx.get(ref);if(calls===1){const e=new Error('injected retry');e.code=10;throw e;}tx.update(ref,{value:s.data().value+1});});
 assert.equal(calls,2);assert.equal((await ref.get()).data().value,1);
});
test('new result submitted after closing cannot be backdated',async()=>{
 const {x,p,state}=await running();await service.close(teacher.token,x.sessionId);
 await throwsCode(service.submit(student.token,x.sessionId,request(p,state)),'INVALID_STATE');
 assert.equal((await service.finalize(teacher.token,x.sessionId))[0].sum,0);
});
test('join and start race either freezes an assigned roster or needs a safe retry',async()=>{
 for(let i=0;i<3;i++){
  const x=await room();await join(x,student,'fox');
  const both=await Promise.allSettled([rawJoin(x,student2,'owl'),service.start(teacher.token,x.sessionId)]);
  const ref=db.collection('sessions').doc(x.sessionId),current=(await ref.get()).data().state;
  if(both[1].status==='rejected')assert.ok(['UNASSIGNED_TEAM','RETRYABLE_CONFLICT'].includes(both[1].reason.code),`start failure: ${String(both[1].reason?.code)} ${String(both[1].reason?.message)}`);
  if(both[0].status==='rejected')assert.ok(['INVALID_STATE','RETRYABLE_CONFLICT'].includes(both[0].reason.code));
  const people=await ref.collection('participants').get();const owl=people.docs.find(d=>d.data().uid===student2.uid);
  if(current==='RUNNING'){
   assert.ok(people.docs.every(d=>d.data().team&&d.data().runId));
   if(owl)assert.ok(owl.data().runId);
  }else{
   assert.equal(current,'LOBBY');if(owl)await service.assignTeam(teacher.token,x.sessionId,owl.id,'blue');
   await service.start(teacher.token,x.sessionId);
   if(owl)assert.ok((await service.participant(student2.token,x.sessionId,owl.id)).runId);
  }
 }
});
test('students cannot choose or change teams and teacher assignment freezes at start',async()=>{
 const x=await room();await throwsCode(service.join(student.token,x.sessionId,{inviteToken:x.inviteToken,name:'fox',team:'red',gameVersion:'game-1',cartridgeVersion:'cart-1'}),'INVALID_JOIN');
 const p=await rawJoin(x,student,'fox');await throwsCode(service.assignTeam(student.token,x.sessionId,p.participantId,'red'),'FORBIDDEN');
 await throwsCode(service.start(teacher.token,x.sessionId),'UNASSIGNED_TEAM');await service.assignTeam(teacher.token,x.sessionId,p.participantId,'red');await service.start(teacher.token,x.sessionId);
 await throwsCode(service.assignTeam(teacher.token,x.sessionId,p.participantId,'blue'),'INVALID_STATE');
});
test('self-consistent fabricated other points remain client-reported, never verified',async()=>{
 const {x,p,state}=await running();const fake={...result,otherPoints:1000,score:1063};const receipt=await service.submit(student.token,x.sessionId,request(p,state,{result:fake}));
 assert.equal(receipt.verification,'client_reported');assert.equal(receipt.score,1063);
});
test('teacher can cancel but another user cannot modify a room',async()=>{
 const x=await room();await throwsCode(service.cancel(student.token,x.sessionId),'FORBIDDEN');
 await throwsCode(service.cancel(otherTeacher.token,x.sessionId),'FORBIDDEN');assert.equal(await service.cancel(teacher.token,x.sessionId),'CANCELLED');
 await throwsCode(rawJoin(x,student,'fox'),'INVALID_STATE');
});
test('team labels resembling object properties remain isolated and rank ties correctly',async()=>{
 const x=await room(),p1=await join(x,student,'fox','__proto__'),p2=await join(x,student2,'owl','constructor');await service.start(teacher.token,x.sessionId);
 const a=await service.participant(student.token,x.sessionId,p1.participantId),b=await service.participant(student2.token,x.sessionId,p2.participantId);
 await service.submit(student.token,x.sessionId,request(p1,a));await service.submit(student2.token,x.sessionId,request(p2,b));await service.close(teacher.token,x.sessionId);
 const rows=await service.finalize(teacher.token,x.sessionId);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.sum===63&&r.rank===1));
});
test('simultaneous identical submissions result in one accepted run and one receipt',async()=>{
 const {x,p,state}=await running(),payload=request(p,state);const both=await Promise.allSettled([service.submit(student.token,x.sessionId,payload),service.submit(student.token,x.sessionId,payload)]);
 for(const item of both)if(item.status==='rejected')assert.equal(item.reason.code,'RETRYABLE_CONFLICT');
 const ref=db.collection('sessions').doc(x.sessionId),before=(await ref.collection('receipts').get()).size;assert.ok(before<=1);
 const retry=await service.submit(student.token,x.sessionId,payload);assert.equal(retry.replayed,before===1);assert.equal(retry.score,63);
 assert.equal((await ref.collection('receipts').get()).size,1);
 await service.close(teacher.token,x.sessionId);assert.equal((await service.finalize(teacher.token,x.sessionId))[0].sum,63);
});
test('expired invite is rejected without creating membership',async()=>{
 const x=await room();await db.collection('sessions').doc(x.sessionId).update({inviteExpiresAt:Date.now()-1});
 await throwsCode(rawJoin(x,student,'fox'),'INVALID_INVITE');
 assert.equal((await db.collection('sessions').doc(x.sessionId).collection('participants').get()).size,0);
});
test('an already initialized service refuses a changed non-emulator endpoint',async()=>{
 const saved=process.env.FIRESTORE_EMULATOR_HOST;
 try{process.env.FIRESTORE_EMULATOR_HOST='firestore.googleapis.com:443';await throwsCode(service.createRoom(teacher.token,{gameVersion:'g',cartridgeVersion:'c'}),'EMULATOR_ISOLATION_REQUIRED');}
 finally{process.env.FIRESTORE_EMULATOR_HOST=saved;}
});
test('disabled teacher cannot reuse a previously issued token',async()=>{
 const disabled=await fakeUser('teacher');await auth.updateUser(disabled.uid,{disabled:true});
 await throwsCode(service.createRoom(disabled.token,{gameVersion:'g',cartridgeVersion:'c'}),'UNAUTHENTICATED');
});

// Isolated trusted-service prototype. Not imported by the game or exposed as a server.
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {assertReady} from './isolation.mjs';
import {timeSettings} from './time-policy.mjs';
const err=code=>{throw Object.assign(new Error(code),{code});};
const h=x=>createHash('sha256').update(x).digest('hex');
const id=x=>{if(typeof x!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(x))err('INVALID_ID');return x;};
const version=x=>{if(typeof x!=='string'||!x||x.length>100)err('INVALID_VERSION');return x;};
const nonneg=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
function resultHash(result){
 if(!result||typeof result!=='object'||Array.isArray(result))err('INVALID_RESULT');
 const fields=['reason','found','answered','correct','flowers','remainingSeconds','otherPoints','score'];
 if(Object.keys(result).sort().join(',')!==fields.slice().sort().join(','))err('INVALID_RESULT');
 return h(JSON.stringify(fields.map(k=>result[k])));
}
function validateResult(r,duration){
 if(r.reason==='QUIZ_25')err('SCORING_POLICY_UNRESOLVED');
 if(!['FINISH','TIME_UP'].includes(r.reason)||!nonneg(r.found,25)||!nonneg(r.answered,r.found)||!nonneg(r.correct,r.answered)||!nonneg(r.flowers,10000)||!nonneg(r.remainingSeconds,duration)||!nonneg(r.otherPoints,10000000)||!nonneg(r.score,10000000))err('INVALID_RESULT');
 if(r.reason==='TIME_UP'&&r.remainingSeconds!==0)err('INVALID_RESULT');
 const bonus=r.reason==='FINISH'?Math.round(r.remainingSeconds*r.found/25):0;
 if(r.score!==r.correct*10+r.flowers*5+r.otherPoints+bonus)err('INVALID_SCORE');
}
export async function createLocalService(){
 const config=await assertReady();
 const app=initializeApp({projectId:config.projectId},'hoja-local-'+randomUUID());
 const auth=getAuth(app),db=getFirestore(app);
 const actor=async token=>{if(typeof token!=='string'||!token)err('UNAUTHENTICATED');try{return await auth.verifyIdToken(token,true);}catch{err('UNAUTHENTICATED');}};
 const teacher=a=>{if(a.teacher!==true)err('FORBIDDEN');};
 const session=sid=>db.collection('sessions').doc(id(sid));
 const owned=(doc,a)=>{if(!doc.exists)err('NOT_FOUND');if(doc.data().ownerUid!==a.uid)err('FORBIDDEN');return doc.data();};
 const safeState=(x,allowed)=>{if(!allowed.includes(x.state))err('INVALID_STATE');};
 const methods={
 async createRoom(token,{gameVersion,cartridgeVersion,durationSeconds=900}){
  const a=await actor(token);teacher(a);version(gameVersion);version(cartridgeVersion);const settings=timeSettings(durationSeconds);
  const sid=randomUUID(),invite=randomBytes(32).toString('base64url');
  await session(sid).create({ownerUid:a.uid,state:'DRAFT',revision:1,settings,gameVersion,cartridgeVersion,inviteHash:h(invite),inviteExpiresAt:Date.now()+600000,createdAt:FieldValue.serverTimestamp()});
  return {sessionId:sid,inviteToken:invite,settings};
 },
 async setDuration(token,sid,seconds){const a=await actor(token);teacher(a);const ref=session(sid);
  return db.runTransaction(async tx=>{const snap=await tx.get(ref),s=owned(snap,a);safeState(s,['DRAFT','LOBBY']);const settings=timeSettings(seconds,s.settings.settingsRevision+1);tx.update(ref,{settings,revision:s.revision+1});return settings;});
 },
 async publish(token,sid){const a=await actor(token);teacher(a);const ref=session(sid);return db.runTransaction(async tx=>{const s=owned(await tx.get(ref),a);safeState(s,['DRAFT']);tx.update(ref,{state:'LOBBY',revision:s.revision+1});return 'LOBBY';});},
 async join(token,sid,{inviteToken,name,gameVersion,cartridgeVersion,...extra}){
  const a=await actor(token),ref=session(sid);version(gameVersion);version(cartridgeVersion);
  if(typeof inviteToken!=='string'||inviteToken.length>100||typeof name!=='string'||name.trim().length<1||name.length>40||Object.keys(extra).length)err('INVALID_JOIN');
  const normalized=name.normalize('NFKC').trim().toLocaleLowerCase('ko-KR'),identity=ref.collection('identities').doc(h(a.uid)),nameRef=ref.collection('names').doc(h(normalized));
  return db.runTransaction(async tx=>{
   const [snap,own,named]=await tx.getAll(ref,identity,nameRef);if(!snap.exists)err('NOT_FOUND');const s=snap.data();
   if(s.gameVersion!==gameVersion||s.cartridgeVersion!==cartridgeVersion)err('VERSION_MISMATCH');
   const expected=Buffer.from(s.inviteHash,'hex'),actual=Buffer.from(h(inviteToken),'hex');if(!timingSafeEqual(expected,actual)||Date.now()>s.inviteExpiresAt)err('INVALID_INVITE');
   if(own.exists)return {participantId:own.data().participantId,replayed:true};
   safeState(s,['LOBBY']);if(named.exists)err('NAME_COLLISION');
   const participant=ref.collection('participants').doc(randomUUID());
   tx.create(participant,{uid:a.uid,name:name.trim(),team:null,connectionEpoch:1,status:'JOINED',runId:null});tx.create(identity,{participantId:participant.id});tx.create(nameRef,{participantId:participant.id});tx.update(ref,{revision:s.revision+1});
   return {participantId:participant.id,replayed:false};
  });
 },
 async assignTeam(token,sid,pid,team){const a=await actor(token);teacher(a);if(typeof team!=='string'||!team.trim()||team.length>40)err('INVALID_TEAM');const ref=session(sid),p=ref.collection('participants').doc(id(pid));
  return db.runTransaction(async tx=>{const [ss,ps]=await tx.getAll(ref,p);const s=owned(ss,a);if(!ps.exists)err('NOT_FOUND');safeState(s,['LOBBY']);tx.update(p,{team:team.trim()});tx.update(ref,{revision:s.revision+1});return {participantId:pid,team:team.trim()};});
 },
 async start(token,sid){const a=await actor(token);teacher(a);const ref=session(sid);
  return db.runTransaction(async tx=>{const snap=await tx.get(ref),s=owned(snap,a);safeState(s,['LOBBY']);const people=await tx.get(ref.collection('participants'));if(people.empty)err('EMPTY');if(people.size>50)err('CAPACITY');if(people.docs.some(p=>!p.data().team))err('UNASSIGNED_TEAM');
   for(const p of people.docs){const run=ref.collection('runs').doc(randomUUID());tx.create(run,{participantId:p.id,uid:p.data().uid,status:'RUNNING',accepted:null,counted:false});tx.update(p.ref,{runId:run.id,status:'RUNNING'});}
   tx.update(ref,{state:'RUNNING',revision:s.revision+1,startedAt:FieldValue.serverTimestamp()});return 'RUNNING';});
 },
 async participant(token,sid,pid){const a=await actor(token),ref=session(sid);const [s,p]=await Promise.all([ref.get(),ref.collection('participants').doc(id(pid)).get()]);if(!s.exists||!p.exists)err('NOT_FOUND');if(p.data().uid!==a.uid&&!(a.teacher===true&&s.data().ownerUid===a.uid))err('FORBIDDEN');return {participantId:pid,...p.data(),settings:s.data().settings};},
 async reconnect(token,sid,pid){const a=await actor(token),ref=session(sid),p=ref.collection('participants').doc(id(pid));return db.runTransaction(async tx=>{const [s,ps]=await tx.getAll(ref,p);if(!s.exists||!ps.exists)err('NOT_FOUND');if(ps.data().uid!==a.uid)err('FORBIDDEN');safeState(s.data(),['RUNNING']);const epoch=ps.data().connectionEpoch+1;tx.update(p,{connectionEpoch:epoch});tx.update(ref,{revision:s.data().revision+1});return {connectionEpoch:epoch,runId:ps.data().runId,settings:s.data().settings};});},
 async rerun(token,sid,pid){const a=await actor(token);teacher(a);const ref=session(sid),p=ref.collection('participants').doc(id(pid));return db.runTransaction(async tx=>{
  const [ss,ps]=await tx.getAll(ref,p);const s=owned(ss,a);if(!ps.exists)err('NOT_FOUND');safeState(s,['RUNNING']);const old=ref.collection('runs').doc(ps.data().runId),oldSnap=await tx.get(old);if(!oldSnap.exists)err('NOT_FOUND');const fresh=ref.collection('runs').doc(randomUUID());
  tx.update(old,{status:'INVALIDATED',counted:false});tx.create(fresh,{participantId:pid,uid:ps.data().uid,status:'RUNNING',accepted:null,counted:false});tx.update(p,{runId:fresh.id,connectionEpoch:ps.data().connectionEpoch+1,status:'RUNNING'});tx.create(ref.collection('audit').doc(randomUUID()),{type:'RERUN',participantId:pid,oldRunId:old.id,newRunId:fresh.id,actor:a.uid,at:FieldValue.serverTimestamp()});tx.update(ref,{revision:s.revision+1});return {runId:fresh.id,connectionEpoch:ps.data().connectionEpoch+1};});},
 async close(token,sid){const a=await actor(token);teacher(a);const ref=session(sid);return db.runTransaction(async tx=>{const s=owned(await tx.get(ref),a);safeState(s,['RUNNING']);tx.update(ref,{state:'CLOSING',revision:s.revision+1,closedAt:FieldValue.serverTimestamp()});return 'CLOSING';});},
 async cancel(token,sid){const a=await actor(token);teacher(a);const ref=session(sid);return db.runTransaction(async tx=>{const s=owned(await tx.get(ref),a);safeState(s,['DRAFT','LOBBY','RUNNING','CLOSING']);tx.update(ref,{state:'CANCELLED',revision:s.revision+1,cancelledAt:FieldValue.serverTimestamp()});return 'CANCELLED';});},
 async submit(token,sid,{participantId,runId,connectionEpoch,requestId,gameVersion,cartridgeVersion,result}){
  const a=await actor(token),ref=session(sid),p=ref.collection('participants').doc(id(participantId)),run=ref.collection('runs').doc(id(runId));id(requestId);const digest=resultHash(result),receipt=ref.collection('receipts').doc(h(participantId+'\0'+runId+'\0'+requestId));
  return db.runTransaction(async tx=>{const [ss,ps,rs,prev]=await tx.getAll(ref,p,run,receipt);if(!ss.exists||!ps.exists||!rs.exists)err('NOT_FOUND');const s=ss.data(),person=ps.data(),r=rs.data();
   if(person.uid!==a.uid||r.uid!==a.uid||r.participantId!==participantId)err('FORBIDDEN');
   if(s.gameVersion!==gameVersion||s.cartridgeVersion!==cartridgeVersion)err('VERSION_MISMATCH');
   if(prev.exists){if(prev.data().digest!==digest)err('REQUEST_CONFLICT');return {...prev.data().receipt,replayed:true};}
   safeState(s,['RUNNING']);if(person.connectionEpoch!==connectionEpoch)err('STALE_EPOCH');if(person.runId!==runId||r.status!=='RUNNING')err('INVALID_RUN');validateResult(result,s.settings.durationSeconds);
   const value={sessionId:sid,participantId,runId,requestId,score:result.score,verification:'client_reported'};
   tx.create(receipt,{digest,receipt:value,createdAt:FieldValue.serverTimestamp()});tx.update(run,{status:'ACCEPTED',accepted:value,counted:true});tx.update(p,{status:'SUBMITTED'});tx.update(ref,{revision:s.revision+1});return {...value,replayed:false};
  });
 },
 async receipt(token,sid,{participantId,runId,requestId}){const a=await actor(token),ref=session(sid),p=ref.collection('participants').doc(id(participantId));id(runId);id(requestId);const [ss,ps,rs]=await Promise.all([ref.get(),p.get(),ref.collection('receipts').doc(h(participantId+'\0'+runId+'\0'+requestId)).get()]);if(!ss.exists||!ps.exists||!rs.exists)err('NOT_FOUND');if(ps.data().uid!==a.uid&&!(a.teacher===true&&ss.data().ownerUid===a.uid))err('FORBIDDEN');return rs.data().receipt;},
 async finalize(token,sid){const a=await actor(token);teacher(a);const ref=session(sid);return db.runTransaction(async tx=>{const s=owned(await tx.get(ref),a);safeState(s,['CLOSING']);const people=await tx.get(ref.collection('participants'));const runs=people.docs.map(p=>ref.collection('runs').doc(p.data().runId));const snaps=runs.length?await tx.getAll(...runs):[];const teams=new Map();people.docs.forEach((p,i)=>{const t=p.data().team;if(!teams.has(t))teams.set(t,{members:0,submitted:0,sum:0});const team=teams.get(t);team.members++;if(snaps[i].exists&&snaps[i].data().counted){team.submitted++;team.sum+=snaps[i].data().accepted.score;}});const rows=[...teams].map(([team,v])=>({team,...v,average:v.sum/v.members,verification:'client_reported'})).sort((a,b)=>a.team.localeCompare(b.team));for(const row of rows)row.rank=1+rows.filter(x=>x.average>row.average).length;tx.update(ref,{state:'FINALIZED',revision:s.revision+1,teams:rows,finalizedAt:FieldValue.serverTimestamp()});return rows;});},
 async dispose(){await deleteApp(app);}
 };
 // Check environment and local emulator health before every operation; dispose must work after shutdown.
 return Object.freeze(Object.fromEntries(Object.entries(methods).map(([name,fn])=>[name,name==='dispose'?fn:async(...args)=>{await assertReady();try{return await fn(...args);}catch(e){if(e?.code===10||(e?.code===3&&/Transaction is invalid or closed/i.test(e.message||'')))err('RETRYABLE_CONFLICT');throw e;}}])));
}

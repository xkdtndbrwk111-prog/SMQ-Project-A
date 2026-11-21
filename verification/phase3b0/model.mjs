// Local deterministic specification model only. No network, Firebase, UI or game integration.
import {createHash} from 'node:crypto';
export const DEMO_PROJECT='demo-hoja-phase3a';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const copy=x=>structuredClone(x);
const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
export function settings(seconds=900,revision=1){
 // 5–30 minutes and nearest-second rounding are proposals, not final policy.
 if(!integer(seconds,300,1800)||seconds%60!==0)fail('INVALID_DURATION');
 return Object.freeze({durationSeconds:seconds,sunsetThresholdSeconds:Math.round(seconds*2/9),nightThresholdSeconds:Math.round(seconds/9),questionGuideThresholdSeconds:Math.round(seconds/9),settingsRevision:revision});
}
export function isolatedEnvironment({projectId,authHost,firestoreHost,authAlive,firestoreAlive,actualTarget,mode}){
 if(mode==='single')return {network:false};
 if(mode!=='class'||projectId!==DEMO_PROJECT||authHost!=='127.0.0.1:19099'||firestoreHost!=='127.0.0.1:18080'||!authAlive||!firestoreAlive||!['127.0.0.1:19099','127.0.0.1:18080'].includes(actualTarget))fail('ISOLATION_DENIED');
 return {network:'local-demo-only'};
}
const canonical=x=>{
 if(x===null||typeof x==='boolean'||typeof x==='string')return JSON.stringify(x);
 if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
 if(typeof x!=='object')fail('INVALID_RESULT');
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
};
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
export class ClassModel{
 #s; #participants=new Map(); #byUid=new Map(); #receipts=new Map(); #runs=new Map(); #audit=[]; #next=0;
 constructor({sessionId='session-demo',owner='teacher',gameVersion='game-a',cartridgeVersion='cart-a'}={}){this.#s={sessionId,owner,gameVersion,cartridgeVersion,state:'DRAFT',revision:1,settings:settings(),closingNotice:false};}
 #teacher(uid){if(uid!==this.#s.owner)fail('FORBIDDEN');}
 #state(...states){if(!states.includes(this.#s.state))fail('INVALID_STATE');}
 #advance(state){this.#s.state=state;this.#s.revision++;}
 #participant(uid,id){const p=this.#participants.get(id);if(!p||p.uid!==uid)fail('FORBIDDEN');return p;}
 get snapshot(){return copy({...this.#s,participants:[...this.#participants.values()],runs:[...this.#runs.values()],audit:this.#audit});}
 changeDuration(uid,seconds){this.#teacher(uid);this.#state('DRAFT','LOBBY');this.#s.settings=settings(seconds,this.#s.settings.settingsRevision+1);this.#s.revision++;return copy(this.#s.settings);}
 open(uid){this.#teacher(uid);this.#state('DRAFT');this.#advance('LOBBY');}
 join({sessionId,uid,name,team,gameVersion,cartridgeVersion}){
  if(sessionId!==this.#s.sessionId)fail('SESSION_MISMATCH');
  // Known UID replay remains idempotent even when enrollment has closed; it cannot create a new participant.
  if(gameVersion!==this.#s.gameVersion||cartridgeVersion!==this.#s.cartridgeVersion)fail('VERSION_MISMATCH');
  const existing=this.#byUid.get(uid);if(existing)return copy(this.#participants.get(existing));
  this.#state('LOBBY');
  if([...this.#participants.values()].some(p=>p.name===name))fail('NAME_COLLISION');
  const p={id:'p'+(++this.#next),uid,name,team,epoch:1,runId:null,status:'JOINED'};
  this.#participants.set(p.id,p);this.#byUid.set(uid,p.id);this.#s.revision++;return copy(p);
 }
 start(uid){this.#teacher(uid);this.#state('LOBBY');if(!this.#participants.size)fail('EMPTY');
  for(const p of this.#participants.values()){const id='run-'+p.id+'-1';p.runId=id;p.status='RUNNING';this.#runs.set(id,{id,participantId:p.id,status:'RUNNING',accepted:null,counted:false});}
  this.#advance('RUNNING');return this.snapshot;
 }
 reconnect(uid,pid){this.#state('RUNNING');const p=this.#participant(uid,pid);if(p.status==='EXCLUDED')fail('INVALID_PARTICIPANT');p.epoch++;this.#s.revision++;return copy(p);}
 notice(uid){this.#teacher(uid);this.#state('RUNNING');this.#s.closingNotice=true;this.#s.revision++;return {noticeSeconds:60,revision:this.#s.revision};}
 close(uid){this.#teacher(uid);this.#state('RUNNING');this.#advance('CLOSING');}
 finalize(uid){this.#teacher(uid);this.#state('CLOSING');this.#advance('FINALIZED');return this.teams();}
 cancel(uid){this.#teacher(uid);this.#state('DRAFT','LOBBY','RUNNING','CLOSING');this.#advance('CANCELLED');}
 rerun(teacher,pid){this.#teacher(teacher);this.#state('RUNNING');const p=this.#participants.get(pid);if(!p)fail('NO_PARTICIPANT');if(p.status==='EXCLUDED')fail('INVALID_PARTICIPANT');
  const old=this.#runs.get(p.runId);old.status='INVALIDATED';old.counted=false;
  const id='run-'+pid+'-'+(++this.#next);this.#runs.set(id,{id,participantId:pid,status:'RUNNING',accepted:null,counted:false});p.runId=id;p.epoch++;p.status='RUNNING';
  this.#audit.push({action:'RERUN',participantId:pid,oldRunId:old.id,newRunId:id});this.#s.revision++;return copy(p);
 }
 exclude(teacher,pid){this.#teacher(teacher);this.#state('RUNNING');const p=this.#participants.get(pid);if(!p)fail('NO_PARTICIPANT');if(p.status==='EXCLUDED')fail('INVALID_PARTICIPANT');
  const old=this.#runs.get(p.runId);old.status='INVALIDATED';old.counted=false;p.status='EXCLUDED';p.epoch++;
  this.#audit.push({action:'EXCLUDE',participantId:pid,oldRunId:old.id});this.#s.revision++;return copy(p);
 }
 submit({sessionId,uid,pid,runId,epoch,requestId,gameVersion,cartridgeVersion,result}){
  if(sessionId!==this.#s.sessionId)fail('SESSION_MISMATCH');
  if(gameVersion!==this.#s.gameVersion||cartridgeVersion!==this.#s.cartridgeVersion)fail('VERSION_MISMATCH');
  const p=this.#participant(uid,pid),run=this.#runs.get(runId);if(!run||run.participantId!==pid)fail('FORBIDDEN');
  if(typeof requestId!=='string'||!requestId)fail('INVALID_REQUEST');
  const key=pid+'\0'+runId+'\0'+requestId, payload=hash(result),old=this.#receipts.get(key);
  // Authentication and ownership precede replay; identical receipts remain retrievable after close or reconnect.
  if(old){if(old.payload!==payload)fail('REQUEST_CONFLICT');return {...copy(old.receipt),replayed:true};}
  this.#state('RUNNING');if(epoch!==p.epoch)fail('STALE_EPOCH');if(runId!==p.runId||run.status!=='RUNNING')fail('INVALID_RUN');
  if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).some(k=>!['reason','found','answered','correct','flowers','remainingSeconds','otherPoints','score'].includes(k)))fail('INVALID_RESULT');
  if(!['FINISH','TIME_UP','QUIZ_25'].includes(result.reason)||!integer(result.found,0,25)||!integer(result.answered,0,result.found)||!integer(result.correct,0,result.answered)||!integer(result.flowers,0,10000)||!integer(result.remainingSeconds,0,this.#s.settings.durationSeconds)||!integer(result.otherPoints,0,10000000)||!integer(result.score,0,10000000))fail('INVALID_RESULT');
  if(result.reason==='TIME_UP'&&result.remainingSeconds!==0)fail('INVALID_RESULT');
  if(result.reason==='QUIZ_25'&&result.answered!==25)fail('INVALID_RESULT');
  // User-approved policy: QUIZ_25 uses the existing FINISH bonus.
  if(result.reason==='QUIZ_25'&&result.found!==25)fail('INVALID_RESULT');
  const bonus=result.reason!=='TIME_UP'?Math.round(result.remainingSeconds*result.found/25):0;
  if(result.score!==result.correct*10+result.flowers*5+result.otherPoints+bonus)fail('INVALID_SCORE');
  const receipt={receiptId:'receipt-'+(this.#receipts.size+1),pid,runId,requestId,score:result.score,verification:'client_reported',replayed:false};
  this.#receipts.set(key,{payload,receipt});run.accepted=copy(receipt);run.status='ACCEPTED';run.counted=true;p.status='SUBMITTED';this.#s.revision++;
  return copy(receipt);
 }
 teams(){const all=[...this.#participants.values()];const teams=[...new Set(all.map(p=>p.team))].sort().map(team=>{
  const players=all.filter(p=>p.team===team),sum=players.reduce((n,p)=>{const r=this.#runs.get(p.runId);return n+(r?.counted?r.accepted.score:0)},0),submitted=players.filter(p=>this.#runs.get(p.runId)?.counted).length;
  const excluded=players.filter(p=>p.status==='EXCLUDED').length;
  return {team,members:players.length,submitted,unsubmitted:players.length-submitted-excluded,excluded,sum,average:sum/players.length};
 });return teams.map(x=>({...x,rank:1+teams.filter(y=>y.average>x.average).length}));}
}
// Product timing requirement model only: it is not the current Phaser implementation.
export class ProductClockModel{
 #config;#remaining;#answers=0;#ended=null;
 constructor(seconds=900){this.#config=settings(seconds);this.#remaining=seconds*1000;}
 tick(ms,{quiz=false,paused=false,dying=false}={}){
  if(!Number.isFinite(ms)||ms<0)fail('INVALID_DELTA');
  if(!this.#ended&&!quiz&&!paused&&!dying){this.#remaining=Math.max(0,this.#remaining-ms);if(this.#remaining===0)this.#ended='TIME_UP';}
  return this.state;
 }
 answer(){if(this.#ended)fail('ALREADY_ENDED');this.#answers++;if(this.#answers===25)this.#ended='QUIZ_25';return this.state;}
 get state(){return {remainingMs:this.#remaining,answered:this.#answers,ended:this.#ended,
  sunset:this.#remaining<=this.#config.sunsetThresholdSeconds*1000,
  night:this.#remaining<=this.#config.nightThresholdSeconds*1000,
  lamp:this.#remaining<=this.#config.nightThresholdSeconds*1000,
  guide:this.#remaining<=this.#config.questionGuideThresholdSeconds*1000};}
}

export function applyRevision(current,incoming){if(!integer(current,0,Number.MAX_SAFE_INTEGER)||!integer(incoming,0,Number.MAX_SAFE_INTEGER))fail('INVALID_REVISION');return incoming>current?incoming:current;}

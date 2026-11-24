/* HOJA 1.5 single-mode join code (40-6CF, teacher spec HOJA15_SINGLE_QR_INVITE_SPEC_20261124).
 * A join code is ONLY a short public alias: "open the public HOJA game in <mode> with these approved units".
 * It grants nothing new: no login, no private bank, no question text, no personal data, no user token.
 * Storage: Script Properties HOJA15_JOIN_<6 digits> = {v,mode,names,season,issued,expires,tokenHash}.
 * Only names that the current approved LIST returns can be stored; GET re-validates them on every student load.
 * The student URL used for the QR comes from the optional bundle-only constant HOJA15_JOIN_STUDENT_URL_
 * (written by assemble_hoja15_production.py, never committed); getUrl() is only a fallback when it ends in /exec. */
const HOJA15_JOIN_PREFIX_='HOJA15_JOIN_';
const HOJA15_JOIN_TTL_MS_=6*60*60*1000;
const HOJA15_JOIN_MAX_ACTIVE_=400;
const HOJA15_JOIN_MODES_=['arcade','quiz'];
const HOJA15_JOIN_SEASONS_=['spring','summer','autumn','winter'];

function hoja15JoinStudentUrl_(){
  const ok=u=>typeof u==='string'&&/^https:\/\/script\.google\.com\/(?:a\/[A-Za-z0-9.-]+\/)?macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/.test(u);
  try{if(typeof HOJA15_JOIN_STUDENT_URL_!=='undefined'&&ok(HOJA15_JOIN_STUDENT_URL_))return HOJA15_JOIN_STUDENT_URL_;}catch(e){}
  try{const u=ScriptApp.getService().getUrl();if(ok(u))return u;}catch(e){}
  return '';
}
function hoja15JoinRate_(kind,limit){
  const cache=CacheService.getScriptCache(),key='HOJA15_JOIN_RATE_'+kind+'_'+Math.floor(Date.now()/60000);
  const n=Number(cache.get(key)||0)+1;
  if(n>limit)throw new Error('HOJA15_JOIN_BUSY');
  cache.put(key,String(n),120);
}
function hoja15JoinHash_(s){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8)
    .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function hoja15JoinSweep_(props,now){
  const all=props.getProperties();let active=0;
  for(const k of Object.keys(all)){
    if(k.indexOf(HOJA15_JOIN_PREFIX_)!==0)continue;
    let rec=null;try{rec=JSON.parse(all[k]);}catch(e){}
    if(!rec||!(rec.expires>now))props.deleteProperty(k);else active++;
  }
  return {all,active};
}
/** Teacher device: create a join code for the current single-mode selection. */
function hojaJoinCreate(req){
  const mode=req&&req.mode,season=req&&req.season;
  const names=req&&Array.isArray(req.names)?req.names.map(n=>typeof n==='string'?n.trim():''):null;
  if(HOJA15_JOIN_MODES_.indexOf(mode)<0)throw new Error('HOJA15_JOIN_MODE_INVALID');
  if(!names||!names.length||names.length>5||names.some(n=>!n||n.length>180)||new Set(names).size!==names.length)
    throw new Error('HOJA15_JOIN_SELECTION_INVALID');
  const listed=new Set(hojaListPublicCartridges().map(r=>r&&r.name));
  if(names.some(n=>!listed.has(n)))throw new Error('HOJA15_JOIN_NOT_APPROVED');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(8000))throw new Error('HOJA15_JOIN_BUSY');
  try{
    hoja15JoinRate_('C',60);
    const props=PropertiesService.getScriptProperties(),now=Date.now();
    const swept=hoja15JoinSweep_(props,now);
    if(swept.active>=HOJA15_JOIN_MAX_ACTIVE_)throw new Error('HOJA15_JOIN_BUSY');
    let code='';
    for(let i=0;i<40&&!code;i++){
      const c=String(100000+Math.floor(Math.random()*900000));
      if(!(HOJA15_JOIN_PREFIX_+c in swept.all))code=c;
    }
    if(!code)throw new Error('HOJA15_JOIN_BUSY');
    const token=Utilities.getUuid();
    const rec={v:1,mode,names,season:HOJA15_JOIN_SEASONS_.indexOf(season)>=0?season:'',issued:now,
      expires:now+HOJA15_JOIN_TTL_MS_,tokenHash:hoja15JoinHash_(token)};
    props.setProperty(HOJA15_JOIN_PREFIX_+code,JSON.stringify(rec));
    const base=hoja15JoinStudentUrl_();
    return {code,mode,names,expiresAt:rec.expires,expiresInMs:rec.expires-now,url:base?base+'?join='+code:'',token};
  }finally{lock.releaseLock();}
}
/** Any device: resolve a code to {mode,names,season}. Public routing only. */
function hojaJoinResolve(code){
  code=String(code==null?'':code).replace(/\s+/g,'');
  if(!/^\d{6}$/.test(code))throw new Error('HOJA15_JOIN_CODE_INVALID');
  hoja15JoinRate_('R',3000);
  const props=PropertiesService.getScriptProperties();
  const raw=props.getProperty(HOJA15_JOIN_PREFIX_+code);
  if(!raw)throw new Error('HOJA15_JOIN_NOT_FOUND');
  let rec=null;try{rec=JSON.parse(raw);}catch(e){}
  if(!rec||!(rec.expires>Date.now())){props.deleteProperty(HOJA15_JOIN_PREFIX_+code);throw new Error('HOJA15_JOIN_EXPIRED');}
  return {code,mode:rec.mode,names:rec.names.slice(),season:rec.season||'',expiresAt:rec.expires};
}
/** Teacher device: end a code early (reissue / close). Needs the token returned at create. */
function hojaJoinRevoke(code,token){
  code=String(code==null?'':code);
  if(!/^\d{6}$/.test(code)||typeof token!=='string'||token.length<10)return false;
  const props=PropertiesService.getScriptProperties();
  const raw=props.getProperty(HOJA15_JOIN_PREFIX_+code);
  let rec=null;try{rec=JSON.parse(raw);}catch(e){}
  if(!rec||rec.tokenHash!==hoja15JoinHash_(token))return false;
  props.deleteProperty(HOJA15_JOIN_PREFIX_+code);
  return true;
}

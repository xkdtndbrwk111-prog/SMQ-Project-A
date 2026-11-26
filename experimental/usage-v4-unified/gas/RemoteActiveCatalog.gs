/* Candidate only: not installed in production. Fixed repo/paths, no client-controlled URL.
 * Trust root is the protected QBank release pointer; pin both catalog and package bytes.
 * Cache is an optimisation; no mutation of the embedded fallback or existing game/usage data.
 */
const HOJA_REMOTE_CATALOG_REPO_='xkdtndbrwk111-prog/HOJA-QUESTION-BANK';
const HOJA_REMOTE_CATALOG_ROOT_='https://raw.githubusercontent.com/'+HOJA_REMOTE_CATALOG_REPO_+'/';
const HOJA_REMOTE_CATALOG_DIR_='game-runtime/active/v1/';
const HOJA_REMOTE_CATALOG_CACHE_KEY_='HOJA_REMOTE_CATALOG_V1';
const HOJA_REMOTE_CATALOG_FRESH_MS_=300000;
const HOJA_REMOTE_CATALOG_LAST_GOOD_MS_=21600000;
const HOJA_REMOTE_CATALOG_MAX_BYTES_=350000;
const HOJA_REMOTE_CATALOG_CHUNK_=7000;
const HOJA_REMOTE_CATALOG_MAX_CHUNKS_=12;
const HOJA_REMOTE_CATALOG_HEAD_='HOJA_REMOTE_CATALOG_ACCEPTED_HEAD_V1';
const HOJA_REMOTE_CATALOG_STORE_='HOJA_REMOTE_CATALOG_STORE_V1_';
let hojaRemoteCatalogMemo_;

function hojaRemoteCatalogSha_(s){
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8)
   .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function hojaRemoteCatalogReadJson_(url){
 const res=UrlFetchApp.fetch(url,{method:'get',muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
 if(res.getResponseCode()!==200)throw Error('REMOTE_CATALOG_HTTP');
 const text=res.getContentText('UTF-8');
 if(Utilities.newBlob(text).getBytes().length>HOJA_REMOTE_CATALOG_MAX_BYTES_)throw Error('REMOTE_CATALOG_SIZE');
 return {text,data:JSON.parse(text)};
}
function hojaRemoteCatalogPointer_(p){
 if(!p||p.schemaVersion!=='hoja-active-catalog-pointer-v1'||
   !Number.isSafeInteger(p.generation)||p.generation<1||
   !/^[a-f0-9]{40}$/.test(String(p.catalogCommit))||
   !/^[a-f0-9]{64}$/.test(String(p.catalogSha256)))throw Error('REMOTE_CATALOG_POINTER');
 return p;
}
function hojaRemoteCatalogValidate_(c){
 const repo=HOJA_REMOTE_CATALOG_REPO_,hex=/^[a-f0-9]{64}$/,commit=/^[a-f0-9]{40}$/;
 if(!c||c.schemaVersion!=='hoja-active-cartridge-catalog-v1'||c.buildType!=='RELEASE'||
  c.sourceRepo!==repo||!commit.test(String(c.sourceCommit))||
  typeof c.deploymentId!=='string'||!c.deploymentId||!Array.isArray(c.entries)||!c.entries.length||
  c.entries.length>1000||!c.contentSource||c.contentSource.repo!==repo||
  c.contentSource.kind!=='GITHUB_RAW_PINNED_V1'||!commit.test(String(c.contentSource.commit)))
    throw Error('REMOTE_CATALOG_INVALID');
 const ids=new Set(),names=new Set();
 const label=(v,max)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[<>\x00-\x1f\x7f]/.test(v);
 for(const e of c.entries){
  if(!e||!HOJA_APPROVED_ID_RE_.test(String(e.cartridgeId))||/^\d+$/.test(e.cartridgeId)||ids.has(e.cartridgeId)||
    e.deploymentStatus!=='DEPLOYED'||!hex.test(String(e.effectiveSha256))||!hex.test(String(e.packageSha256))||
    e.contentPath!=='game-runtime/approved-packages/v1/'+e.cartridgeId+'.json'||
    !label(e.title,200)||!label(e.subject,40)||!label(e.subjectLabel,40)||!label(e.releaseId,180)||
    !Number.isInteger(e.grade)||e.grade<1||e.grade>6||![null,1,2].includes(e.semester)||
    !Number.isInteger(e.unit)||e.unit<1||e.unit>99||
    !(e.subunit===null||(Number.isInteger(e.subunit)&&e.subunit>=1&&e.subunit<=99))||
    !Number.isInteger(e.questionCount)||e.questionCount<1||e.questionCount>3000||
    !(e.publisher===null||label(e.publisher,100))||!(e.author===null||label(e.author,100)))
      throw Error('REMOTE_CATALOG_ENTRY');
  const name=hojaApprovedGameName_(e);
  if(name.length>180||names.has(name))throw Error('REMOTE_CATALOG_NAME');
  ids.add(e.cartridgeId);names.add(name);
 }
 return c;
}
function hojaRemoteCatalogFetch_(){
 const p=hojaRemoteCatalogPointer_(hojaRemoteCatalogReadJson_(HOJA_REMOTE_CATALOG_ROOT_+'main/'+HOJA_REMOTE_CATALOG_DIR_+'current.json').data);
 const r=hojaRemoteCatalogReadJson_(HOJA_REMOTE_CATALOG_ROOT_+p.catalogCommit+'/'+HOJA_REMOTE_CATALOG_DIR_+'catalog.json');
 if(hojaRemoteCatalogSha_(r.text)!==p.catalogSha256)throw Error('REMOTE_CATALOG_DIGEST');
 return {generation:p.generation,sha256:p.catalogSha256,catalogCommit:p.catalogCommit,checkedAt:Date.now(),text:r.text,catalog:hojaRemoteCatalogValidate_(r.data)};
}
/* Two compressed property slots; the accepted head is the only commit marker.
 * Under the script lock, write/verify the inactive slot before changing the head.
 * Failed quota/write never invalidates the previous slot. Cache is optional.
 * At most 2 x 84 KB property payload, plus metadata; 6h stale bound.
 */
function hojaRemoteCatalogHead_(props){
 const raw=props.getProperty(HOJA_REMOTE_CATALOG_HEAD_);
 if(raw===null)return null;
 const h=hojaRemoteCatalogPointer_(JSON.parse(raw));
 if(!['A','B'].includes(h.slot)||!Number.isSafeInteger(h.chunks)||h.chunks<1||
  h.chunks>HOJA_REMOTE_CATALOG_MAX_CHUNKS_||!Number.isSafeInteger(h.checkedAt))
   throw Error('REMOTE_CATALOG_HEAD_INVALID');
 return h;
}
function hojaRemoteCatalogRecord_(h,text,now){
 if(h.checkedAt>now||now-h.checkedAt>=HOJA_REMOTE_CATALOG_LAST_GOOD_MS_||
   hojaRemoteCatalogSha_(text)!==h.catalogSha256)throw Error('REMOTE_CATALOG_STALE_OR_CORRUPT');
 return {generation:h.generation,sha256:h.catalogSha256,checkedAt:h.checkedAt,text,catalog:hojaRemoteCatalogValidate_(JSON.parse(text))};
}
function hojaRemoteCatalogReadSlot_(props,h){
 let packed='';
 for(let i=0;i<h.chunks;i++){
  const part=props.getProperty(HOJA_REMOTE_CATALOG_STORE_+h.slot+'_'+i);
  if(typeof part!=='string'||!part.length||part.length>HOJA_REMOTE_CATALOG_CHUNK_)throw Error('REMOTE_CATALOG_SLOT');
  packed+=part;
 }
 const text=Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(packed),'application/gzip')).getDataAsString('UTF-8');
 if(Utilities.newBlob(text).getBytes().length>HOJA_REMOTE_CATALOG_MAX_BYTES_)throw Error('REMOTE_CATALOG_SIZE');
 return text;
}
function hojaRemoteCatalogWriteSlot_(props,next,latest){
 const slot=latest&&latest.slot==='A'?'B':'A';
 const packed=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(next.text,'application/json')).getBytes());
 const chunks=Math.ceil(packed.length/HOJA_REMOTE_CATALOG_CHUNK_);
 if(chunks<1||chunks>HOJA_REMOTE_CATALOG_MAX_CHUNKS_)throw Error('REMOTE_CATALOG_STORE_SIZE');
 const h={schemaVersion:'hoja-active-catalog-pointer-v1',generation:next.generation,catalogSha256:next.sha256,
  catalogCommit:next.catalogCommit,checkedAt:next.checkedAt,slot,chunks};
 for(let i=0;i<chunks;i++)props.setProperty(HOJA_REMOTE_CATALOG_STORE_+slot+'_'+i,
   packed.slice(i*HOJA_REMOTE_CATALOG_CHUNK_,(i+1)*HOJA_REMOTE_CATALOG_CHUNK_));
 // Clear surplus inactive slot chunks to bound shared property use.
 for(let i=chunks;i<HOJA_REMOTE_CATALOG_MAX_CHUNKS_;i++)props.deleteProperty(HOJA_REMOTE_CATALOG_STORE_+slot+'_'+i);
 hojaRemoteCatalogRecord_(h,hojaRemoteCatalogReadSlot_(props,h),Date.now());
 props.setProperty(HOJA_REMOTE_CATALOG_HEAD_,JSON.stringify(h));
 return h;
}
function hojaRemoteCatalogPrior_(props,cache,h,now){
 if(!h)return null;
 try{
  const raw=cache.get(HOJA_REMOTE_CATALOG_CACHE_KEY_);
  if(raw){const v=JSON.parse(raw);
   if(v.generation===h.generation&&v.sha256===h.catalogSha256&&v.checkedAt===h.checkedAt)
    return hojaRemoteCatalogRecord_(h,v.text,now);
  }
 }catch(_){}
 try{return hojaRemoteCatalogRecord_(h,hojaRemoteCatalogReadSlot_(props,h),now)}catch(_){return null}
}
function hojaRemoteCatalogGet_(embedded){
 if(PropertiesService.getScriptProperties().getProperty('HOJA_REMOTE_CATALOG_ENABLED')!=='1')return embedded;
 if(!embedded||embedded.buildType==='QA_TEST_ONLY'||!embedded.entries||!embedded.entries.length)return embedded;
 if(hojaRemoteCatalogMemo_)return hojaRemoteCatalogMemo_;
 const props=PropertiesService.getScriptProperties(),cache=CacheService.getScriptCache(),now=Date.now();
 const head=hojaRemoteCatalogHead_(props),prior=hojaRemoteCatalogPrior_(props,cache,head,now);
 if(prior&&now-prior.checkedAt<HOJA_REMOTE_CATALOG_FRESH_MS_)return hojaRemoteCatalogMemo_=prior.catalog;
 try{
  const next=hojaRemoteCatalogFetch_();
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error('REMOTE_CATALOG_BUSY');
  try{
   const latest=hojaRemoteCatalogHead_(props);
   if(latest&&(next.generation<latest.generation||
     (next.generation===latest.generation&&(next.sha256!==latest.catalogSha256||next.catalogCommit!==latest.catalogCommit))))
      throw Error('REMOTE_CATALOG_ROLLBACK');
   if(latest&&next.generation===latest.generation&&next.checkedAt<latest.checkedAt)
      throw Error('REMOTE_CATALOG_CONCURRENT');
   // A verified unchanged revision only needs a fresh timestamp. Do not rewrite
   // chunks every five minutes. If the durable slot is damaged, rebuild the
   // inactive slot from the newly fetched and validated immutable bytes.
   let reused=false;
   if(latest&&next.generation===latest.generation){
    try{
     const text=hojaRemoteCatalogReadSlot_(props,latest);
     reused=hojaRemoteCatalogSha_(text)===next.sha256;
    }catch(_){}
   }
   if(reused)props.setProperty(HOJA_REMOTE_CATALOG_HEAD_,JSON.stringify({...latest,checkedAt:next.checkedAt}));
   else hojaRemoteCatalogWriteSlot_(props,next,latest);
   try{
    const serialized=JSON.stringify({generation:next.generation,sha256:next.sha256,checkedAt:next.checkedAt,text:next.text});
    if(Utilities.newBlob(serialized).getBytes().length<=100000)cache.put(HOJA_REMOTE_CATALOG_CACHE_KEY_,serialized,21600);
   }catch(_){}
   return hojaRemoteCatalogMemo_=next.catalog;
  }finally{lock.releaseLock()}
 }catch(e){
  // Re-read the accepted head and exact slot; never resurrect a superseded release.
  const latest=hojaRemoteCatalogHead_(props);
  const fallback=hojaRemoteCatalogPrior_(props,cache,latest,Date.now());
  if(fallback)return hojaRemoteCatalogMemo_=fallback.catalog;
  if(!latest)return hojaRemoteCatalogMemo_=embedded;
  throw Error('REMOTE_CATALOG_UNAVAILABLE');
 }
}

/**
 * HOJA source catalog normalizer. BUILD-TIME ONLY.
 * No actual cartridge name or ID is embedded in this program.
 * An approved source index is NOT a deployed/playable catalog.
 */
const SUBJECTS={english:{code:'eng',label:'영어'},social:{code:'soc',label:'사회'},
  math:{code:'math',label:'수학'},science:{code:'sci',label:'과학'}};
const fatal=(code)=>{throw new Error('HOJA_APPROVED_INDEX_'+code);};
function pathOf(base,extra){return 'approved/'+base.replace(/^approved\//,'').replace(/\/+$/,'')+'/'+extra;}
function assertApproved(manifest,which){
  if(!manifest||manifest.teacherApproval!=='APPROVED')fatal('UNAPPROVED:'+which);
}
function metaFor(id,subject){
  const re=/^([a-z]+)([1-6])-(?:[a-z0-9-]+-)?u([0-9]+)(?:-([0-9]+))?(?:-common)?$/;
  const m=re.exec(id);
  if(!m||!SUBJECTS[subject]||m[1]!==SUBJECTS[subject].code)fatal('UNSUPPORTED_UNIT_ID:'+id);
  const term=/-s([12])-/.exec(id);
  return {grade:Number(m[2]),semester:term?Number(term[1]):null,
    unit:Number(m[3]),subunit:m[4]?Number(m[4]):null};
}
const naturalTitle=(subject,m)=>String(m.grade)+'학년 '+SUBJECTS[subject].label+' '+
  String(m.unit)+(m.subunit?'-'+m.subunit:'')+'단원';
const cleanTitle=s=>{
  const t=String(s||'').normalize('NFC').trim();
  return t&&t.length<=160&&!/[<>\u0000-\u001f]/.test(t)?t:null;
};
export function normalizeApprovedIndex(rootCatalog,read,approvedEffectiveMetadata={}){
  if(!rootCatalog||rootCatalog.schemaVersion!=='approved-catalog-v1')fatal('SCHEMA');
  if(typeof read!=='function')fatal('READ_FN_REQUIRED');
  const units=[],idSet=new Set();let totalQuestions=0;
  function add(id,subject,source,m,more={}){
    assertApproved(m,source);
    if(typeof id!=='string'||idSet.has(id))fatal('DUPLICATE_OR_BAD_ID:'+id);
    idSet.add(id);
    const meta=metaFor(id,subject),effective=approvedEffectiveMetadata[id]||{};
    const title=cleanTitle(effective.unitTitle||effective.title||effective.name);
    units.push({id,subject,grade:meta.grade,semester:meta.semester,
      unit:meta.unit,subunit:meta.subunit,
      publisher:more.publisher||null,author:more.author||null,
      title:title||naturalTitle(subject,meta),
      approvedContentTitle:Boolean(title),
      sourceManifest:source,releaseId:m.releaseId||null,
      teacherApproval:'APPROVED',
      gameDeployment:'NOT_DEPLOYED',
      questionCount:Number.isInteger(more.questions)?more.questions:null,
      archiveSha256:more.archiveSha256||m.archiveSha256||m.sha256||null});
  }
  for(const family of Object.values(rootCatalog.englishByPublisher||{})){
    const base='approved/'+family.path.replace(/^approved\//,'').replace(/\/+$/,'');
    const manifestPath=base+'/manifest.json',m=read(manifestPath);
    assertApproved(m,manifestPath);
    if(Array.isArray(m.units)){
      for(const id of m.units)add(id,'english',manifestPath,m,{
        publisher:family.publisher,author:family.author});
    }else if(m.unitCounts&&typeof m.unitCounts==='object'){
      for(const [folder,count] of Object.entries(m.unitCounts)){
        const records=read(base+'/'+folder+'/questions.json');
        if(!Array.isArray(records)||records.length!==count)fatal('QUESTION_LIST:'+folder);
        const ids=new Set(records.map(q=>String(q.questionId||'').split(':')[0]));
        if(ids.size!==1||![...ids][0])fatal('QUESTION_UNIT_ID:'+folder);
        add([...ids][0],'english',manifestPath,m,{
          publisher:family.publisher,author:family.author,questions:count});
      }
    }else fatal('ENGLISH_MANIFEST_SHAPE');
    const questions=Number(m.totalQuestions||
      Object.values(m.unitCounts||{}).reduce((a,n)=>a+Number(n),0));
    if(!Number.isInteger(questions)||questions!==family.questions)fatal('ENGLISH_COUNTS');
    totalQuestions+=questions;
  }
  for(const [subject,subjectSource] of Object.entries(rootCatalog.subjects||{})){
    let count=0,questions=0;
    if(Array.isArray(subjectSource.paths)){
      for(const path of subjectSource.paths){
        const mp=pathOf(path,'manifest.json'),m=read(mp);
        assertApproved(m,mp);
        if(!Number.isInteger(m.questions))fatal('SUBJECT_QUESTIONS:'+mp);
        add(m.id,subject,mp,m,{questions:m.questions});
        count++;questions+=m.questions;
      }
    }else if(subjectSource.manifest){
      const mp=pathOf('',subjectSource.manifest).replace('approved//','approved/');
      const m=read(mp);
      assertApproved(m,mp);
      if(!Array.isArray(m.units))fatal('SUBJECT_UNIT_LIST:'+subject);
      const parent=mp.slice(0,mp.lastIndexOf('/')+1);
      for(const u of m.units){
        const dir=u.archive.slice(0,u.archive.lastIndexOf('/'));
        const unitMp=parent+dir+'/manifest.json';
        const unit=read(unitMp);assertApproved(unit,unitMp);
        if(unit.id!==u.id||unit.questions!==u.questions)fatal('UNIT_MISMATCH:'+u.id);
        add(u.id,subject,unitMp,unit,{questions:u.questions,archiveSha256:u.sha256});
        count++;questions+=u.questions;
      }
    }else fatal('SUBJECT_SOURCE_UNSUPPORTED:'+subject);
    if(count!==subjectSource.units||questions!==subjectSource.questions)
      fatal('SUBJECT_COUNTS:'+subject);
    totalQuestions+=questions;
  }
  if(units.length!==rootCatalog.summary.approvedUnits||
     totalQuestions!==rootCatalog.summary.approvedQuestions)fatal('INDEX_TOTALS');
  units.sort((a,b)=>a.grade-b.grade||a.subject.localeCompare(b.subject)||
    String(a.publisher||'').localeCompare(String(b.publisher||''))||
    a.unit-b.unit||(a.subunit||0)-(b.subunit||0)||a.id.localeCompare(b.id));
  return {schemaVersion:'hoja-approved-source-index-v1',
    approvalUnits:units.length,approvalQuestions:totalQuestions,
    gameDeployment:'NOT_DEPLOYED',entries:units};
}
export function activeApprovedCatalog(index,deployment){
  if(!deployment||deployment.schemaVersion!=='hoja-approved-deployment-v1')
    fatal('DEPLOYMENT_MANIFEST_REQUIRED');
  const refs=new Map(index.entries.map(e=>[e.id,e])),seen=new Set(),out=[];
  for(const pin of deployment.entries||[]){
    if(!pin||seen.has(pin.id))fatal('DUPLICATE_PIN');
    seen.add(pin.id);
    const entry=refs.get(pin.id);
    if(!entry||pin.teacherDeploymentApproval!==true||
       !/^[a-f0-9]{64}$/i.test(String(pin.effectiveContentSha256||'')))
      fatal('UNAPPROVED_OR_UNPINNED:'+String(pin.id));
    if(!entry.approvedContentTitle)fatal('UNVERIFIED_PUBLIC_TITLE:'+pin.id);
    out.push({...entry,effectiveContentSha256:pin.effectiveContentSha256,
      gameDeployment:'DEPLOYED'});
  }
  return {schemaVersion:'hoja-active-cartridge-catalog-v1',entries:out};
}

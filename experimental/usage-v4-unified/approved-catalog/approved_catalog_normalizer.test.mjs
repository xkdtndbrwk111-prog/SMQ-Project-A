import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeApprovedIndex,activeApprovedCatalog} from './approved_catalog_normalizer.mjs';

const catalog={
  schemaVersion:'approved-catalog-v1',summary:{approvedUnits:3,approvedQuestions:7},
  englishByPublisher:{one:{publisher:'동적출판사',author:'동적저자',
    path:'english/one',units:1,questions:3}},
  subjects:{social:{units:1,questions:2,paths:['social/example']},
    math:{units:1,questions:2,manifest:'math/manifest.json'}}
};
const source={
  'approved/english/one/manifest.json':{teacherApproval:'APPROVED',
    units:['eng5-xyz-u10'],totalQuestions:3},
  'approved/social/example/manifest.json':{teacherApproval:'APPROVED',
    id:'soc6-s2-u3-1-common',questions:2},
  'approved/math/manifest.json':{teacherApproval:'APPROVED',
    units:[{id:'math5-s2-u4',archive:'grade5/math5-s2-u4/test.zip',questions:2}]},
  'approved/math/grade5/math5-s2-u4/manifest.json':{teacherApproval:'APPROVED',
    id:'math5-s2-u4',questions:2}
};
const read=path=>{if(!(path in source))throw Error('fixture missing '+path);return source[path];};
test('no cartridge name hardcoding; approved source structure resolves all subjects',()=>{
  const ix=normalizeApprovedIndex(catalog,read);
  assert.equal(ix.approvalUnits,3);assert.equal(ix.approvalQuestions,7);
  assert.equal(ix.entries.find(x=>x.id==='eng5-xyz-u10').publisher,'동적출판사');
  assert.equal(ix.entries.find(x=>x.id==='soc6-s2-u3-1-common').semester,2);
  assert.equal(ix.entries.filter(x=>x.gameDeployment==='DEPLOYED').length,0);
  assert.throws(()=>activeApprovedCatalog(ix,null),/DEPLOYMENT_MANIFEST_REQUIRED/);
});
test('future approved unit discovered by manifest, without editing the normalizer',()=>{
  const next=structuredClone(catalog);
  next.summary.approvedUnits++;next.summary.approvedQuestions+=2;
  next.subjects.social.units++;next.subjects.social.questions+=2;
  next.subjects.social.paths.push('social/extra');
  const src={...source,'approved/social/extra/manifest.json':{teacherApproval:'APPROVED',
    id:'soc5-s2-u2-2-common',questions:2}};
  const ix=normalizeApprovedIndex(next,p=>src[p]);
  assert.equal(ix.approvalUnits,4);
});
test('not-approved units and fabricated source labels are refused',()=>{
  const src=structuredClone(source);
  src['approved/social/example/manifest.json'].teacherApproval='PENDING';
  assert.throws(()=>normalizeApprovedIndex(catalog,p=>src[p]),/UNAPPROVED/);
});
test('approval is not deployment; deployed title must come from approved effective content',()=>{
  const ix=normalizeApprovedIndex(catalog,read);
  assert.throws(()=>activeApprovedCatalog(ix,{schemaVersion:'hoja-approved-deployment-v1',
    entries:[{id:'math5-s2-u4',teacherDeploymentApproval:true,
      effectiveContentSha256:'a'.repeat(64)}]}),/UNVERIFIED_PUBLIC_TITLE/);
  const withNames=normalizeApprovedIndex(catalog,read,{
    'math5-s2-u4':{title:'승인 effective에 존재하는 단원명'}
  });
  const deployed=activeApprovedCatalog(withNames,{schemaVersion:'hoja-approved-deployment-v1',
    entries:[{id:'math5-s2-u4',teacherDeploymentApproval:true,
      effectiveContentSha256:'a'.repeat(64)}]});
  assert.equal(deployed.entries.length,1);
  assert.equal(deployed.entries[0].gameDeployment,'DEPLOYED');
});

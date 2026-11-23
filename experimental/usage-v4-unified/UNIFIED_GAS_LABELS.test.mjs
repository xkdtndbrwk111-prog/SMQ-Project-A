// Isolated label normalization tests; no access to private or operating Sheets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const s=readFileSync('experimental/usage-v4-unified/gas/UsageV4Public.gs','utf8');
const ctx=vm.createContext({});
vm.runInContext(s,ctx);
const {safeCartridgeLabel,publicView}=ctx.HOJA_USAGE_V4_PUBLIC;

test('curriculum and miscellaneous publicly named cartridges normalize',()=>{
 const fixtures=[
  ['3학년-사회-교통의 변화로 달라진 생활 모습','3학년 · 사회 · 교통의 변화로 달라진 생활 모습'],
  ['5-사회-고대 사람들의 생활 모습','5학년 · 사회 · 고대 사람들의 생활 모습'],
  ["6-영어-천재(함)-8단원 It's Taller Than the Tree","6학년 · 영어 · 천재(함) · 8단원 It's Taller Than the Tree"],
  ['기타-kpop-aespa','기타 · K-POP · aespa'],
  ['4학년-사회-학교생활 속 민주주의','4학년 · 사회 · 학교생활 속 민주주의']
 ];
 for(const [input,expected] of fixtures)assert.equal(safeCartridgeLabel(input),expected);
});
test('unordered selection variants get identical canonical labels',()=>{
 const a='5-사회-고대 사람들의 생활 모습';
 const b='5-사회-선사 시대와 고조선 사람들의 생활 모습';
 assert.equal(safeCartridgeLabel(a+' | '+b),safeCartridgeLabel(b+' | '+a));
});
test('contact, HTML and explicit school identifiers are not exposed',()=>{
 const OTHER='기타 공개 카트리지';
 for(const input of ['5-사회-홍길동초등학교 소개','5-사회-010-1234-5678',
  '기타-kpop-http://example.com','5-사회-<img src=x onerror=alert(1)>',
  '5-사회-name@example.com'])assert.equal(safeCartridgeLabel(input),OTHER);
});
test('aggregation merges order variants, does not rewrite original maps',()=>{
 const a='5-사회-고대 사람들의 생활 모습',b='5-사회-선사 시대와 고조선 사람들의 생활 모습';
 const combo=new Map([[a+' | '+b,3],[b+' | '+a,4],['기타-kpop-aespa',8]]);
 const entries=[...combo];
 const view=publicView({asOf:'2026-11-23',historyStart:'2026-11-23',
  provisionalDays:['2026-11-23'],totals:{today:15,days7:15,days30:15,all:15},
  daily:[{date:'2026-11-23',count:15}],maps:new Map([['CARTRIDGE_COMBINATION',combo]])});
 assert.equal(view.topCartridges.length,2);
 assert.ok(view.topCartridges.some(r=>r.count===7));
 assert.ok(view.topCartridges.some(r=>r.label==='기타 · K-POP · aespa'&&r.count===8));
 assert.deepEqual([...combo],entries);
});

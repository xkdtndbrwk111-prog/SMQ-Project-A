/* HOJA 1.5 통계 (교사 전용 · 휴대폰용) — 별도 Apps Script 프로젝트 (40-6CG)
 * 읽기 전용: 이용 기록 스프레드시트의 EVENT_LOG 중 HOJA 1.5 승인 카트리지 기록(usageSchemaVersion 'A1')만 집계한다.
 * 쓰기 없음(설정용 스크립트 속성 2개 제외), 학생·학교·기기 정보 없음, 게임 운영 프로젝트와 완전히 분리.
 * 배포: 웹 앱 · 실행 사용자 = 나 · 액세스 = 나만(Only myself). 처음 열면 이용 기록 스프레드시트 주소를 한 번 입력한다.
 * 스프레드시트 ID는 코드·GitHub에 넣지 않고 이 프로젝트의 스크립트 속성에만 저장한다. */
const H15S_PROP_ID_='HOJA15_STATS_SPREADSHEET_ID';
const H15S_PROP_FIRST_='HOJA15_STATS_FIRST_ROW';   // 처음 HOJA 1.5 기록이 있는 행(재계산 속도용, 자동 저장)
const H15S_SHEET_='EVENT_LOG';
const H15S_SCHEMA_='A1';
const H15S_CACHE_KEY_='HOJA15_STATS_V1';
const H15S_CACHE_SECONDS_=300;
const H15S_COLS_={timestamp:1,date:2,mode:3,grade:5,subject:6,publisher:7,count:9,teams:10,schema:13,titles:14}; // 0-based
/* 23개 승인 단원 표시 이름(게임의 HOJA 1.5 표시명과 같음). 키 = 원본 승인 제목 */
const H15S_UNITS_=Object.freeze({
 "초등학교 영어 5 (천재·함순애) Lesson 10 What Time Do You Get Up?": {
  "id": "eng5-ham-u10",
  "number": "10",
  "title": "What Time Do You Get Up?"
 },
 "초등학교 영어 5 (천재·함순애) Lesson 11 My Favorite Subject Is Math": {
  "id": "eng5-ham-u11",
  "number": "11",
  "title": "My Favorite Subject Is Math"
 },
 "초등학교 영어 5 (천재·함순애) Lesson 12 What Do You Want to Be?": {
  "id": "eng5-ham-u12",
  "number": "12",
  "title": "What Do You Want to Be?"
 },
 "What’s Wrong?": {
  "id": "eng5-ybm-kim-u10",
  "number": "10",
  "title": "What’s Wrong?"
 },
 "Where Is the Library?": {
  "id": "eng5-ybm-kim-u11",
  "number": "11",
  "title": "Where Is the Library?"
 },
 "What Will You Do This Winter?": {
  "id": "eng5-ybm-kim-u12",
  "number": "12",
  "title": "What Will You Do This Winter?"
 },
 "초등학교 영어 6 (천재·함순애) Lesson 10 How Often Do You Eat Vegetables?": {
  "id": "eng6-ham-u10",
  "number": "10",
  "title": "How Often Do You Eat Vegetables?"
 },
 "초등학교 영어 6 (천재·함순애) Lesson 11 Do You Know Anything About Tuho?": {
  "id": "eng6-ham-u11",
  "number": "11",
  "title": "Do You Know Anything About Tuho?"
 },
 "초등학교 영어 6 (천재·함순애) Lesson 12 We Made a Class Album": {
  "id": "eng6-ham-u12",
  "number": "12",
  "title": "We Made a Class Album"
 },
 "What Season Do You Like?": {
  "id": "eng6-ybm-kim-u10",
  "number": "10",
  "title": "What Season Do You Like?"
 },
 "I Think It Looks Bright": {
  "id": "eng6-ybm-kim-u11",
  "number": "11",
  "title": "I Think It Looks Bright"
 },
 "Do You Know Anything About Jige?": {
  "id": "eng6-ybm-kim-u12",
  "number": "12",
  "title": "Do You Know Anything About Jige?"
 },
 "초등 수학 5-2 4단원. 소수의 곱셈": {
  "id": "math5-s2-u4",
  "number": "4",
  "title": "소수의 곱셈"
 },
 "초등 수학 5-2 5단원. 직육면체": {
  "id": "math5-s2-u5",
  "number": "5",
  "title": "직육면체"
 },
 "초등 수학 5-2 6단원. 평균과 가능성": {
  "id": "math5-s2-u6",
  "number": "6",
  "title": "평균과 가능성"
 },
 "초등 수학 6-2 4단원. 비례식과 비례배분": {
  "id": "math6-s2-u4",
  "number": "4",
  "title": "비례식과 비례배분"
 },
 "초등 수학 6-2 5단원. 원의 둘레와 넓이": {
  "id": "math6-s2-u5",
  "number": "5",
  "title": "원의 둘레와 넓이"
 },
 "초등 수학 6-2 6단원. 원기둥, 원뿔, 구": {
  "id": "math6-s2-u6",
  "number": "6",
  "title": "원기둥, 원뿔, 구"
 },
 "초등학교 사회 5-2 (출판사 공통) 2. 달라지는 시대, 변화하는 생활 모습 - 조선 후기 사회 변화와 개항기 생활 모습": {
  "id": "soc5-s2-u2-2-common",
  "number": "2-2",
  "title": "조선 후기 사회 변화와 개항기 생활"
 },
 "초등 사회 5-2 3-1. 일제 식민 통치와 우리 민족의 저항 (3종 공통)": {
  "id": "soc5-s2-u3-1-common",
  "number": "3-1",
  "title": "일제 식민 통치와 우리 민족의 저항"
 },
 "초등 사회 5-2 3-2. 8·15 광복과 6·25 전쟁 (3종 공통)": {
  "id": "soc5-s2-u3-2-common",
  "number": "3-2",
  "title": "8·15 광복과 6·25 전쟁"
 },
 "초등 사회 6-2 3-1. 세계의 인구 분포 (3종 공통)": {
  "id": "soc6-s2-u3-1-common",
  "number": "3-1",
  "title": "세계의 인구 분포"
 },
 "초등 사회 6-2 3-2. 지속가능한 지구촌 (3종 공통)": {
  "id": "soc6-s2-u3-2-common",
  "number": "3-2",
  "title": "지속가능한 지구촌"
 }
});

function doGet(){
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('HOJA 1.5 통계')
    .addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
function h15sKst_(ms){return new Date(ms+9*3600000);}
function h15sDay_(ms){return h15sKst_(ms).toISOString().slice(0,10);}
function h15sDateOf_(v,tsMs){
  if(v instanceof Date&&!isNaN(v))return h15sDay_(v.getTime());
  const s=String(v==null?'':v).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){const t=Date.parse(s);if(!isNaN(t))return h15sDay_(t);}
  return isFinite(tsMs)?h15sDay_(tsMs):'';
}
function h15sMs_(v){if(v instanceof Date)return v.getTime();const t=Date.parse(String(v||''));return isNaN(t)?NaN:t;}
function h15sOpen_(){
  const id=String(PropertiesService.getScriptProperties().getProperty(H15S_PROP_ID_)||'').trim();
  if(!id)return null;
  const sh=SpreadsheetApp.openById(id).getSheetByName(H15S_SHEET_);
  if(!sh)throw new Error('EVENT_LOG 시트를 찾을 수 없습니다.');
  return sh;
}
function h15sCheckHeader_(sh){
  const h=sh.getRange(1,1,1,15).getDisplayValues()[0];
  if(h[0]!=='eventId'||h[1]!=='timestamp'||h[2]!=='date'||h[3]!=='mode'||h[13]!=='usageSchemaVersion'||h[14]!=='cartridgeTitlesJson')
    throw new Error('이용 기록(EVENT_LOG) 형식이 아닙니다. 게임 이용 기록 스프레드시트 주소인지 확인해 주세요.');
}
/** 처음 한 번: 이용 기록 스프레드시트 주소(또는 ID)를 저장한다. 웹 앱이 '나만' 접근이므로 교사만 호출할 수 있다. */
function hoja15StatsSetup(urlOrId){
  const raw=String(urlOrId||'').trim();
  const m=raw.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/)||raw.match(/^([A-Za-z0-9_-]{20,})$/);
  if(!m)throw new Error('스프레드시트 주소를 확인해 주세요.');
  const sh=SpreadsheetApp.openById(m[1]).getSheetByName(H15S_SHEET_);
  if(!sh)throw new Error('이 스프레드시트에는 EVENT_LOG 시트가 없습니다.');
  h15sCheckHeader_(sh);
  const p=PropertiesService.getScriptProperties();
  p.setProperty(H15S_PROP_ID_,m[1]);p.deleteProperty(H15S_PROP_FIRST_);
  CacheService.getScriptCache().remove(H15S_CACHE_KEY_);
  return {ok:true};
}
function h15sUnitLabel_(title){
  const u=H15S_UNITS_[title];
  return u?{key:u.id,label:u.number+'. '+u.title,full:title}:{key:'T:'+title,label:title,full:title};
}
function h15sTop_(map,limit){
  return Object.keys(map).map(k=>map[k]).sort((a,b)=>b.count-a.count||String(a.label).localeCompare(String(b.label))).slice(0,limit||50);
}
function h15sAggregate_(rows,fromDay,toDay){
  const a={total:0,solo:0,team:0,teams:{},grade:{},subject:{},units:{},hours:new Array(24).fill(0),weekdays:new Array(7).fill(0),unitsPerGame:{}};
  for(const r of rows){
    if(r.day<fromDay||r.day>toDay)continue;
    a.total++;
    if(r.mode==='TEAM'){a.team++;if(r.teams>=2)a.teams[r.teams]=(a.teams[r.teams]||0)+1;}else a.solo++;
    const g=r.grade||'기타';(a.grade[g]=a.grade[g]||{label:g,count:0}).count++;
    const s=r.subject||'기타';(a.subject[s]=a.subject[s]||{label:s,count:0}).count++;
    for(const t of r.titles){const u=h15sUnitLabel_(t);(a.units[u.key]=a.units[u.key]||{label:u.label,full:u.full,count:0}).count++;}
    if(r.hour>=0)a.hours[r.hour]++;
    if(r.wd>=0)a.weekdays[r.wd]++;
    const n=Math.min(5,Math.max(1,r.titles.length||r.count||1));a.unitsPerGame[n]=(a.unitsPerGame[n]||0)+1;
  }
  return {total:a.total,solo:a.solo,team:a.team,teams:a.teams,grade:h15sTop_(a.grade),subject:h15sTop_(a.subject),
    units:h15sTop_(a.units,23),hours:a.hours,weekdays:a.weekdays,unitsPerGame:a.unitsPerGame};
}
function h15sCompute_(sh){
  const props=PropertiesService.getScriptProperties();
  const last=sh.getLastRow();
  const now=Date.now(),today=h15sDay_(now);
  const out={generatedAt:new Date(now).toISOString(),today,rowsRead:0};
  if(last<2)return Object.assign(out,{empty:true});
  let first=Number(props.getProperty(H15S_PROP_FIRST_)||0);
  // the remembered start row is only a speed-up: if rows were deleted/inserted it must still point at the FIRST A1 row
  if(first>=2&&first<=last){
    const at=String(sh.getRange(first,H15S_COLS_.schema+1).getDisplayValue()).trim();
    const before=first>2?String(sh.getRange(first-1,H15S_COLS_.schema+1).getDisplayValue()).trim():'';
    if(at!==H15S_SCHEMA_||before===H15S_SCHEMA_)first=0;
  }
  if(!(first>=2&&first<=last)){
    // 처음 한 번만: 버전 열(1열)만 읽어 HOJA 1.5 첫 기록 위치를 찾는다
    const col=sh.getRange(2,H15S_COLS_.schema+1,last-1,1).getDisplayValues();
    const k=col.findIndex(c=>String(c[0]).trim()===H15S_SCHEMA_);
    if(k<0)return Object.assign(out,{empty:true});
    first=k+2;props.setProperty(H15S_PROP_FIRST_,String(first));
  }
  const vals=sh.getRange(first,1,last-first+1,15).getValues();
  out.rowsRead=vals.length;
  const rows=[];
  for(const v of vals){
    if(String(v[H15S_COLS_.schema]).trim()!==H15S_SCHEMA_)continue;
    const ms=h15sMs_(v[H15S_COLS_.timestamp]);const day=h15sDateOf_(v[H15S_COLS_.date],ms);
    if(!day)continue;
    let titles=[];try{const t=JSON.parse(String(v[H15S_COLS_.titles]||'[]'));if(Array.isArray(t))titles=t.map(String);}catch(e){}
    const k=isFinite(ms)?h15sKst_(ms):null;
    rows.push({day,mode:String(v[H15S_COLS_.mode]).trim().toUpperCase(),teams:Number(v[H15S_COLS_.teams])||0,
      grade:String(v[H15S_COLS_.grade]||'').trim(),subject:String(v[H15S_COLS_.subject]||'').trim(),
      count:Number(v[H15S_COLS_.count])||0,titles,hour:k?k.getUTCHours():-1,wd:k?k.getUTCDay():-1});
  }
  if(!rows.length)return Object.assign(out,{empty:true});
  const since=rows.reduce((m,r)=>r.day<m?r.day:m,rows[0].day);
  const back=n=>h15sDay_(Date.parse(today+'T00:00:00+09:00')-(n-1)*86400000);
  const daily=[];const byDay={};
  for(const r of rows){const d=byDay[r.day]||(byDay[r.day]={solo:0,team:0});if(r.mode==='TEAM')d.team++;else d.solo++;}
  const start=back(60)<since?since:back(60);
  for(let t=Date.parse(start+'T00:00:00+09:00');;t+=86400000){
    const d=h15sDay_(t);if(d>today)break;const x=byDay[d]||{solo:0,team:0};daily.push({date:d,solo:x.solo,team:x.team,count:x.solo+x.team});
  }
  return Object.assign(out,{since,daily,
    periods:{today:h15sAggregate_(rows,today,today),d7:h15sAggregate_(rows,back(7),today),
      d30:h15sAggregate_(rows,back(30),today),all:h15sAggregate_(rows,since,today)}});
}
/** 통계 조회(읽기 전용). refresh=true면 5분 캐시를 건너뛴다. */
function hoja15StatsGet(refresh){
  const cache=CacheService.getScriptCache();
  if(!refresh){const c=cache.get(H15S_CACHE_KEY_);if(c){const v=JSON.parse(c);v.cached=true;return v;}}
  const sh=h15sOpen_();
  if(!sh)return {needsSetup:true};
  h15sCheckHeader_(sh);
  const v=h15sCompute_(sh);
  try{cache.put(H15S_CACHE_KEY_,JSON.stringify(v),H15S_CACHE_SECONDS_);}catch(e){}
  v.cached=false;return v;
}

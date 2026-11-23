#!/usr/bin/env node
/**
 * F3-2: ISOLATED teacher visual-review preview (local file only — never committed, never published;
 * media rights HOLD). For every unit whose visual parity with an approved page is NOT verified
 * (report.visualParity === 'NOT_VERIFIED' and no DOM-parity run covers it), show each question:
 *   left  = the APPROVED original display (the approved presentation page itself, driven to the
 *           same question), or — when no approved renderer page exists — the teacher-reviewed
 *           display data as plain text/images, clearly labelled;
 *   right = the game's composed shared renderer (bridge + media + math extensions).
 * The teacher records 같음 / 다름 / 보류 + a note per question (localStorage) and exports JSON.
 * This is a VISUAL review of the new screen only — not content approval, not publication.
 *   node build_visual_review_preview.mjs --qbank <checkout> --out <file.html> [--units a,b]
 */
import {readFileSync, writeFileSync, existsSync, statSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildContentPackages} from './approved_content_packager.mjs';
import {readZip} from './zip_reader.mjs';
import {composeRenderer} from '../../unified-quiz-renderer/compose_renderer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const qbank = resolve(opt('--qbank') || (console.error('--qbank required'), process.exit(2)));
const out = resolve(opt('--out') || (console.error('--out required'), process.exit(2)));
if (out.startsWith(resolve(here, '../../..') + '/')) { console.error('REFUSE_OUTPUT_INSIDE_REPOSITORY'); process.exit(2); }
const index = JSON.parse(readFileSync(join(here, 'generated/approved-source-index.json'), 'utf8'));
if (execFileSync('git', ['-C', qbank, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim() !== index.sourceCommit) { console.error('QBANK_COMMIT_DRIFT'); process.exit(2); }
const src = {exists: p => existsSync(join(qbank, p)) && statSync(join(qbank, p)).isFile(), readBytes: p => readFileSync(join(qbank, p))};
const {packages, report} = buildContentPackages(src, index);
const want = opt('--units') ? opt('--units').split(',') :
  report.entries.filter(e => e.adapter === 'presentation-v3' || e.adapter === 'display-overlay-v1').map(e => e.cartridgeId);
const units = want.map(id => {
  const r = report.entries.find(e => e.cartridgeId === id), e = index.entries.find(x => x.cartridgeId === id);
  if (!r || r.status !== 'READY') throw new Error('NOT_READY ' + id);
  const pkg = JSON.parse(packages.find(p => p.cartridgeId === id).json);
  let left = {kind: 'none'};
  if (r.adapter === 'presentation-v3') left = {kind: 'approved-page', page: r.presentation};
  else if (r.adapter === 'display-overlay-v1') left = {kind: 'display-data'};
  return {id, title: e.approvedTitle, adapter: r.adapter, left, payload: {questions: pkg.questions.map(q => q.rendererQuestion),
    originalQuestions: pkg.questions.map(q => q.originalQuestion), images: pkg.images, tags: pkg.tags, unitMeta: pkg.unitMeta}};
});
// approved presentation pages referenced by the selected units (each embedded once)
const pages = {};
for (const u of units) if (u.left.kind === 'approved-page' && !pages[u.left.page]) {
  const [zipPath, entry] = ('approved/' + u.left.page).split('!');
  pages[u.left.page] = readZip(readFileSync(join(qbank, zipPath))).read(entry).toString('utf8');
}
const renderer = composeRenderer().html;
const esc = s => JSON.stringify(s).replace(/</g, '\\u003c');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>HOJA 승인 정본 새 화면 시각 검토 (QA 미리보기 · 비공개)</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#0f1720;color:#e8eef4}header{padding:10px 14px;background:#172331;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header b{color:#ffd779}select,button,input{font:inherit}main{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;height:calc(100vh - 150px)}
section{display:flex;flex-direction:column;min-height:0}section h2{margin:0 0 6px;font-size:14px;color:#aecbe6}iframe,#leftData{flex:1;border:1px solid #33475b;border-radius:8px;background:#fff;min-height:0}
#leftData{overflow:auto;color:#1f2d3a;padding:12px}#leftData img{max-width:45%;margin:4px;border:1px solid #ccc}footer{padding:6px 14px;display:flex;gap:10px;align-items:center;background:#172331}
.warn{color:#ffb4a8;font-size:13px}</style></head><body>
<header><b>새 화면 시각 검토 · 격리 QA 미리보기</b><span class="warn">콘텐츠 승인·공개 배포 허가가 아닙니다. 외부 공유 금지(미디어 권리 확인 전).</span>
<select id="unit"></select><select id="q"></select><button id="prev">◀</button><button id="next">▶</button><span id="pos"></span></header>
<main><section><h2 id="leftTitle">승인 원본 화면</h2><iframe id="left"></iframe><div id="leftData" hidden></div></section>
<section><h2>게임 공용 렌더러(새 화면)</h2><iframe id="right"></iframe></section></main>
<footer>검토: <label><input type="radio" name="v" value="같음">같음</label><label><input type="radio" name="v" value="다름">다름</label><label><input type="radio" name="v" value="보류">보류</label>
<input id="note" placeholder="메모 (예: 보기 줄바꿈 다름)" style="flex:1"><button id="export">검토 JSON 내보내기</button><span id="done"></span></footer>
<script>
const UNITS=${esc(units)};const PAGES=${esc(pages)};const RENDERER=${esc(renderer)};
const KEY='hoja_f3_visual_review_v1';const store=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}};
const $=id=>document.getElementById(id);let unit=null,list=[],ix=0,leftPage=null;
const right=$('right');right.srcdoc=RENDERER;const rightReady=new Promise(r=>right.onload=()=>{right.contentWindow.HOJA_APPROVED_RENDERER.embed();r()});
function fillUnits(){$('unit').replaceChildren(...UNITS.map((u,i)=>{const o=document.createElement('option');o.value=i;o.textContent=u.title+' ('+u.payload.questions.length+'문항)';return o}))}
async function openUnit(i){unit=UNITS[i];list=unit.payload.questions;ix=0;
 $('q').replaceChildren(...list.map((q,k)=>{const o=document.createElement('option');o.value=k;o.textContent=q.localId.toUpperCase()+' · '+q.type+' · '+q.prompt.slice(0,30);return o}));
 await rightReady;right.contentWindow.HOJA_APPROVED_RENDERER.load(unit.payload);
 if(unit.left.kind==='approved-page'){$('left').hidden=false;$('leftData').hidden=true;$('leftTitle').textContent='승인 원본 화면 (교사 승인 presentation)';
  if(leftPage!==unit.left.page){leftPage=unit.left.page;await new Promise(r=>{$('left').onload=r;$('left').srcdoc=PAGES[unit.left.page]})}}
 else{$('left').hidden=true;$('leftData').hidden=false;$('leftTitle').textContent='승인 렌더러 화면 없음 — 교사 검토 표시 데이터(display overlay)'}
 show();}
function show(){const q=list[ix];$('q').value=ix;$('pos').textContent=(ix+1)+' / '+list.length;
 right.contentWindow.HOJA_APPROVED_RENDERER.show({questionId:q.id,mode:'team'}); // team mode: all original choices visible for comparison
 if(unit.left.kind==='approved-page'){const w=$('left').contentWindow;try{w.setQuestion?w.setQuestion(q.questionId):null}catch(e){}}
 else{const d=$('leftData');d.replaceChildren();const h=document.createElement('h3');h.textContent=q.prompt;d.append(h);
  for(const k of [q.image,...(q.media||[]).map(m=>m.asset)].filter(Boolean)){const im=new Image();im.src=unit.payload.images[k];d.append(im)}
  if(q.dialogue){for(const l of q.dialogue){const p=document.createElement('p');p.textContent=l.speaker+': '+l.text;d.append(p)}}
  const ol=document.createElement('ol');for(const c of q.choices||[]){const li=document.createElement('li');li.textContent=c.text||c.imageAlt;ol.append(li)}d.append(ol);
  const t=document.createElement('p');t.textContent='배치(layoutFamily): '+(unit.payload.tags[q.id]?.layout?.preferredLayout||'-')+' · 정답: '+JSON.stringify(q.answer);d.append(t)}
 const rec=store()[q.questionId]||{};document.querySelectorAll('input[name=v]').forEach(r=>r.checked=r.value===rec.verdict);$('note').value=rec.note||'';
 const s=store();$('done').textContent='기록 '+Object.keys(s).length+'건';}
function save(){const q=list[ix];const s=store();const v=[...document.querySelectorAll('input[name=v]')].find(r=>r.checked)?.value||'';
 s[q.questionId]={unit:unit.id,verdict:v,note:$('note').value,at:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify(s));show()}
document.querySelectorAll('input[name=v]').forEach(r=>r.onchange=save);$('note').onchange=save;
$('unit').onchange=e=>openUnit(+e.target.value);$('q').onchange=e=>{ix=+e.target.value;show()};
$('prev').onclick=()=>{if(ix>0){ix--;show()}};$('next').onclick=()=>{if(ix<list.length-1){ix++;show()}};
$('export').onclick=()=>{const b=new Blob([JSON.stringify({schema:'hoja-f3-visual-review-v1',sourceCommit:${esc(index.sourceCommit)},records:store()},null,1)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='HOJA_F3_visual_review.json';a.click()};
fillUnits();openUnit(0);
</script></body></html>`;
writeFileSync(out, html);
console.log(JSON.stringify({out, units: units.map(u => u.id), questions: units.reduce((n, u) => n + u.payload.questions.length, 0), bytes: Buffer.byteLength(html)}));

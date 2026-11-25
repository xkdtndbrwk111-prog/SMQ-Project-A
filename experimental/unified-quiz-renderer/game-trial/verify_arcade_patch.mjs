import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {patchApprovedArcadeInnerHTML} from '../HOJA_ARCADE_APPROVED_RUNTIME.mjs';
const path=process.argv[2];
assert(path,'Pass the exact rebuilt Game.TEST.html path');
const game=readFileSync(path,'utf8');
const compressed=game.match(/const HOJA_V051_ARCADE_GZIP='([^']+)'/);
assert(compressed,'Original compressed arcade source not found');
const decoded=gunzipSync(Buffer.from(compressed[1],'base64')).toString('utf8');
assert(decoded.length>1_200_000,'Arcade source truncated');
// 40-6BF: exactly like the game (part-14 expandArcade): production ranking patch FIRST, then the approved patch.
const rp=game.match(/const HOJA_RANKING_PATCH_=(\[.*?\]\]);\n/s);
assert(rp,'production ranking patch (HOJA_RANKING_PATCH_) not found in the game');
const RANKING=JSON.parse(rp[1]);
assert(RANKING.length===30,'production ranking patch must have 30 entries');
let ranked=decoded;
for(const [before,after] of RANKING){const first=ranked.indexOf(before);
 assert(first>=0&&ranked.indexOf(before,first+before.length)<0,'production ranking patch anchor mismatch: '+before.slice(0,40));
 ranked=ranked.slice(0,first)+after+ranked.slice(first+before.length);}
assert(!game.includes('for(const [before,after] of rankingPatch)'),'launch() must not re-apply the ranking patch on the approved-patched arcade');
const patched=patchApprovedArcadeInnerHTML(ranked);
assert(patched.includes('hojaArcadeApprovedChildTrial'));
// 40-6CB: 6 question spots per map (30) while the run still ends at 25
assert(patched.includes("pick('question',6)")&&patched.includes('model.questionPoints.length!==6')&&patched.includes("if(questionCount!==6)"),'cave must place 6 question balloons');
assert(patched.includes('function hoja15AddSixthBalloon(st){')&&patched.includes('hoja15AddSixthBalloon(st);\n  if(stageQuestionCount(st)!==6)'),'surface maps must add a 6th balloon');
assert(patched.includes('const TOTAL_QUESTIONS=25;')&&!patched.includes('const TOTAL_QUESTIONS=5*STAGES.length;'),'the run must still end at 25 questions');
assert(patched.includes("m.found===25&&m.answered===25&&m.usedFamilies===25"),'approved ranking still requires 25/25/25');
console.log('ARCADE_30_SPOTS_25_QUESTIONS_STATIC_PASS');
assert(patched.includes('hojaTrialControlsHelpScript'),'H help panel must be injected');
assert(patched.includes('jump:this.input.keyboard.addKey(K.PERIOD)'),'Period must be jump');
assert(patched.includes('run:this.input.keyboard.addKey(K.COMMA)'),'Comma must be run');
assert(patched.includes('const left=this.keys.a.isDown;')&&patched.includes('const right=this.keys.d.isDown;'),'Movement must use A/D only');
assert(patched.includes('const upPressed=Phaser.Input.Keyboard.JustDown(this.keys.w);'),'W must be the sole door key');
// 40-6CJ (teacher): Space is a spare jump and Shift a spare run for keyboards that drop D + , + . ; W/Z/arrows never jump
assert(patched.includes('const jumpPressed=Phaser.Input.Keyboard.JustDown(this.keys.jump)|Phaser.Input.Keyboard.JustDown(this.keys.jump2);')&&patched.includes('jump2:this.input.keyboard.addKey(K.SPACE)'),'Jump = period or Space only');
assert(patched.includes('const jumpHeld=this.keys.jump.isDown||this.keys.jump2.isDown;'),'Variable jump height = period or Space');
assert(patched.includes("const run=this.keys.run.isDown||this.keys.run2.isDown;")&&patched.includes('run2:this.input.keyboard.addKey(K.SHIFT)'),'Run = comma or Shift only (no double tap / X)');
assert(!patched.includes('const doubleTapRun='),'Double tap running must be disabled');
for(const oldInput of ['this.keys.left.isDown','this.keys.right.isDown','this.keys.up.isDown','this.keys.down.isDown','this.keys.z.isDown','this.keys.x.isDown'])
 assert(!patched.includes(oldInput),'Old gameplay key is still active: '+oldInput);
assert(patched.includes("['KeyW','KeyA','KeyS','KeyD','Comma','Period','Enter','Space','ShiftLeft','ShiftRight'].includes(ev.code)"),'Death confirm accepts the official keys + spare Space/Shift');
assert(!patched.includes("if(ev.code!=='Enter'&&ev.code!=='Space')return"),'Old Space death shortcut must be replaced');
assert(patched.includes('this.continueHojaAfterDeath()'),'Original checkpoint respawn must remain');
assert(patched.includes("document.getElementById('hojaDeathContinue')?.focus({preventScroll:true});"),'Death dialog must focus the child frame CTA');
const help=patched.match(/<script id="hojaTrialControlsHelpScript">([\s\S]*?)<\/script>/);
assert(help&&help[1],'H help script missing');
assert(help[1].trim().startsWith('(()=>'),'H help source must be executable, not a quoted string');
new Function(help[1]);
console.log('ARCADE_TRIAL_INPUT_WASD_COMMA_PERIOD_HELP_DEATH_STATIC_PASS');

assert(patched.includes('HOJA_ARCADE_APPROVED_BRIDGE.open'));
assert(patched.includes('this.awardScore(10'));
assert(patched.includes('hojaStep09_3Answer_(q,false,0)'));
assert(patched.includes('this.consumeQuizBalloon(e)'));
assert(patched.includes('this.scene.resume()'));
assert(patched.includes('m.found===25&&m.answered===25&&m.usedFamilies===25'),'FINISH rank gate must require 25 completed');
assert(patched.includes('HOJA_ARCADE_APPROVED_REVIEW_START'));
assert(patched.includes('HOJA_ARCADE_APPROVED_REVIEW_DONE'));
assert(patched.includes('startReview?.(RUN.step09History||[]'));
assert(!patched.includes('maxlength="3"'),'3-character limit must be gone (production ranking patch)');
assert(!patched.includes('aria-label="영문 또는 숫자 세 글자"'));
assert(patched.includes('HOJA_RANK_COMPOSING_')&&patched.includes('compositionstart')&&patched.includes('compositionend'),'production IME handling');
assert(!patched.includes("dataset.rankComposing"),'no second (approved) composition handler');
assert(patched.includes('/^[가-힣A-Z0-9]{2,6}$/'),'2-6 Hangul/Latin/digit name policy');
assert(patched.includes("failures.push('승인 25문항 미완료')"),'approved 25-question FINISH requirement added to the production failures list');
assert.equal(patched.split('!HOJA_RANK_FORBIDDEN_.has(hojaRankNormalize_(r.name))&&').length-1,2,'forbidden names filtered in both rank lists');
const approvedBackend=readFileSync('versions/2.0.0/Code.gs','utf8');
assert(approvedBackend.includes('/^[가-힣A-Z0-9]{2,6}$/.test(v)'),'Name policy must remain identical to the source GAS');
assert(approvedBackend.includes("HOJA_RANK_FORBIDDEN_ = ['SEX','XES','EXS','SXE']"),'Forbidden-name rule must remain original');
console.log('ARCADE_RANK_NAME_POLICY_2_TO_6_HANGUL_LATIN_NUMERIC_PASS');

const child=patched.match(/<script id="hojaArcadeApprovedChildTrial">([\s\S]*?)<\/script>/);
assert(child&&child[1],'Child bridge script missing');
new Function(child[1]);
assert.throws(()=>patchApprovedArcadeInnerHTML(patched),/ALREADY_PATCHED/);
console.log('ARCADE_PATCH_STATIC_PASS original='+decoded.length+' patched='+patched.length+' childSyntax=PASS');

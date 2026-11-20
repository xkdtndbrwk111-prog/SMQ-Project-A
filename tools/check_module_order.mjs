const arcadeBeforeMain = [
 'js/world/cave-layout.js','js/world/cave-variation.js','js/world/themes.js',
 'js/world/surface-templates.js','js/world/surface-generator.js','js/arcade-host.js',
 'js/audio.js','js/physics.js','js/springs.js','js/moving-platforms.js','js/rafts.js','js/crumbles.js',
 'js/enemies/system.js','js/enemies/jumpy.js','js/enemies/owl.js','js/enemies/hermie.js',
 'js/enemies/roach.js','js/enemies/blankey.js','js/enemies/ballooney.js','js/enemies/martian.js',
 'js/enemies/robot.js','js/enemies/circuit.js','js/keyboard.js','js/quiz-normalizer.js',
 'js/hud.js','js/run-record.js','js/settlement.js'
];

export function checkModuleOrder(pages) {
 const errors=[];
 function ordered(page, names, main) {
  const html=pages[page];
  const tags=[...html.matchAll(/<script\b([^>]*)>/g)];
  let previous=-1;
  for(const src of names) {
   const matches=tags.filter(m=>new RegExp('\\bsrc=["\']'+src.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'["\']').test(m[1]));
   if(matches.length!==1) {errors.push(page+': '+src+' 태그가 정확히 하나여야 합니다');continue;}
   const tag=matches[0];
   if(/\b(async|defer)\b/i.test(tag[1]))errors.push(page+': '+src+' 동기 로드 필요');
   if(tag.index<=previous)errors.push(page+': '+src+' 로드 순서 오류');
   previous=tag.index;
   if(main!==undefined && tag.index>=main)errors.push(page+': '+src+' 게임 초기화 이전에 필요');
  }
 }
 const main=pages['arcade.html'].indexOf("(() => {\n'use strict';");
 if(main<0)errors.push('arcade.html: 게임 초기화 위치를 찾을 수 없습니다');
 ordered('arcade.html',arcadeBeforeMain,main);
 for(const page of ['index.html','play.html'])
  ordered(page,['js/parent-services.js','js/parent-gameplay.js',page==='index.html'?'js/teacher_qr.js':'js/student.js']);
 const review=pages['arcade.html'].indexOf('src="js/review.js"');
 if(review<main)errors.push('arcade.html: 오답 복습 로드 위치 오류');
 return errors;
}

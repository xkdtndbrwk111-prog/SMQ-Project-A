
/* R17S: one canonical arcade HTML, one native Phaser scene definition.
   Stage 0 is reconstructed from a small audited delta on demand. */
window.HOJA_R17S_NATIVE_SOURCE=(function(){
 let cache=null;
 const EXPECT_LINES=12793;
 const EXPECT_BYTES=1968845;
 function getOps(){
  const raw=atob(document.getElementById('hojaR17STutorialArcadeDelta').textContent.trim());
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0))));
 }
 async function build(){
  if(cache)return cache;
  const canonical=await window.HOJA_GAMEPLAY.getCanonicalArcade();
  const lines=canonical.split('\n');
  if(lines.length!==EXPECT_LINES)throw new Error('R17S 원본 아케이드 줄 수 변경 · 자동 병합 차단');
  const patches=getOps();
  for(let n=patches.length-1;n>=0;n--){
   const [a,b,oldLines,newLines]=patches[n];
   // The eye-rendering stability update inserted 85 audited lines at source line 4272.
   // Original R17S positions before that point are unchanged; later positions move +85.
   const shift=a>=4272?85:0,from=a+shift,to=b+shift;
   if(lines.slice(from,to).join('\n')!==oldLines.join('\n'))
    throw new Error('R17S 원본 아케이드 버전 불일치: patch '+n);
   lines.splice(from,to-from,...newLines);
  }
  const html=lines.join('\n');
  if(new TextEncoder().encode(html).length!==EXPECT_BYTES ||
     !html.includes('window.HOJA_TUTORIAL_NATIVE=true;') ||
     !html.includes('HOJA_TUTORIAL_NATIVE_STAGE'))
    throw new Error('R17S 스테이지0 조립 검증 실패');
  if(!html.includes('let ACTIVE_SCENE=null;'))throw new Error('연습 터치 장면 앵커 누락');
  const touch=window.HOJA_TT_ARCADE_BRIDGE_SOURCE.replace("const m=e.data;","const m=e.data;if(m.action==='down')window.focus();");
  cache=html.replace('let ACTIVE_SCENE=null;','let ACTIVE_SCENE=null;'+touch);
  return cache;
 }
 return {build,get info(){return {cached:!!cache,deltaBytes:15572,expectedBytes:EXPECT_BYTES}}};
})();

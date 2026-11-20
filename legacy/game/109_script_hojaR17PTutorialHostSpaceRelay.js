
/* Only for the in-progress Stage 0 tutorial dialogue when focus is on the host HUD. */
(function(){
 let nativeDialogueOpen=false;
 window.addEventListener('message',function(e){
  const o=document.getElementById('hojaTutOverlay'),f=document.getElementById('hojaTutApp');
  if(!o||o.hidden||e.source!==f?.contentWindow)return;
  if(e.data?.kind==='HOJA_TUT_DIALOGUE_STATE'&&e.data.zone==='native')nativeDialogueOpen=!!e.data.open;
 });
 window.addEventListener('keydown',function(e){
  const o=document.getElementById('hojaTutOverlay'),f=document.getElementById('hojaTutApp');
  if(!nativeDialogueOpen||!o||o.hidden||!f?.contentWindow)return;
  const k=e.code||(e.key===' '?'Space':e.key);
  if(k!=='Space'&&k!=='Enter')return;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.repeat)return;
  f.contentWindow.postMessage({kind:'HOJA_TUT_REMOTE_DIALOG_NEXT'},'*');
 },true);
})();

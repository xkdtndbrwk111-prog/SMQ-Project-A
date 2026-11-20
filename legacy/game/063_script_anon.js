
/* V0.4.5 authoritative intro gate. Every "처음부터" goes through this.
   Starting screen is ALWAYS the 35-second HOJA Phaser attract, not repository. */
window.HOJA_FLOW=(()=>{
  function enterIntro({newRun=true}={}){
    if(newRun){window.HOJA_SEASON_SESSION.begin();window.HOJA_AUDIO_CONTROL?.chooseNewRun?.();}
    else window.HOJA_SEASON_SESSION.current();
    window.HOJA_INTRO_SHORTCUT_LOGO=false;
    window.HOJA_INTRO_PENDING_PHASE2=false;
    window.HOJA_GAMEPLAY?.stop?.();
    document.getElementById('hojaGamePlay').hidden=true;
    window.HOJA_REPOSITORY?.hide?.();
    window.HOJA_LOADING?.hide?.();
    window.HOJA_CATALOG?.hide?.();
    window.HOJA_MODE_PREVIEW?.hide?.();
    for(const id of ['hojaRepoChoice','hojaCatalog','hojaNextMode','loadingOverlay','hojaSharedBack']){
      const el=document.getElementById(id);if(el)el.hidden=true;
    }
    const logo=document.getElementById('hojaLogo');if(logo){logo.style.opacity='0';logo.style.transform='translate(-50%,-530px)';}
    const cut=document.getElementById('blackCut');if(cut)cut.style.opacity='0';
    const error=document.getElementById('hojaIntroError');error?.classList.remove('visible');
    window.HOJA_CATALOG?.syncBack?.();
  }
  function current(){
    if(!document.getElementById('hojaNextMode').hidden)return 'mode';
    if(!document.getElementById('hojaCatalog').hidden)return 'catalog';
    if(!document.getElementById('loadingOverlay').hidden)return 'loading';
    if(!document.getElementById('hojaRepoChoice').hidden)return 'repository';
    return 'intro';
  }
  return {enterIntro,current};
})();
window.addEventListener('DOMContentLoaded',()=>window.HOJA_FLOW.enterIntro());

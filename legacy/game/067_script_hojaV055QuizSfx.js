
window.HOJA_V055_SFX=(name)=>{
 if(!window.HOJA_AUDIO_CONTROL?.sfxOn)return;
 const source=document.getElementById('hqSfx_'+name);if(!source)return;
 const sound=source.cloneNode(true);sound.volume=.65;
 sound.play().catch(()=>{});sound.addEventListener('ended',()=>sound.remove(),{once:true});
};

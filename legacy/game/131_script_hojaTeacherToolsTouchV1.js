
/* Teacher Tools local dashboard -> HtmlService game -> actual Phaser scene. TEST ONLY. */
(function(){
  'use strict';
  const channel='HOJA_TT_TOUCH_V1';
  const allowed=/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/;
  const codes=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','KeyF']);
  let accepted=false;
  function notify(kind,other={}){
    try{window.top.postMessage({kind,channel,...other},'*')}catch(_){ }
  }
  function ready(){notify('HOJA_TT_READY')}
  window.addEventListener('message',event=>{
    // Inner Phaser is a separate srcdoc iframe: its ACK must be forwarded upward.
    const inner=document.getElementById('hqArcadeFrame');
    const practice=document.getElementById('hojaTutApp');
    if((event.source===inner?.contentWindow||event.source===practice?.contentWindow) && event.data?.kind==='HOJA_TT_ARCADE_APPLIED'){
      notify('HOJA_TT_PHASER_APPLIED',{
        seq:event.data.seq,code:event.data.code,action:event.data.action,applied:!!event.data.applied,stage:event.data.stage
      });
      return;
    }
    if(event.source!==window.top||!allowed.test(event.origin))return;
    const m=event.data;
    if(!m||m.channel!==channel)return;
    if(m.kind==='HOJA_TT_ACK'){accepted=true;notify('HOJA_TT_ACKNOWLEDGED');return;}
    if(m.kind!=='HOJA_TT_INPUT')return;
    if(!Number.isSafeInteger(m.seq)||m.seq<0)return;
    if(!['down','up','releaseAll'].includes(m.action))return;
    if(m.action!=='releaseAll'&&!codes.has(m.code))return;
    const state=window.HOJA_GAMEPLAY?.state;
    let delivered='inactive';
    if(window.HOJA_TUTORIAL_GATE?.state?.running&&practice?.contentWindow){
      practice.contentWindow.postMessage({...m,kind:'HOJA_TT_PRACTICE_INPUT'},'*');
      delivered='practice';
    }else if(state?.page==='arcade'){
      if(inner?.contentWindow&&!inner.hidden){
        inner.contentWindow.postMessage({kind:'HOJA_TT_ARCADE_INPUT',action:m.action,code:m.code,seq:m.seq},'*');
        delivered='arcade';
      }
    }else if(state?.page==='quiz'&&m.action==='down'){
      const keyNames={ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',Space:' ',ShiftLeft:'Shift',KeyF:'f'};
      window.dispatchEvent(new KeyboardEvent('keydown',{code:m.code,key:keyNames[m.code],bubbles:true}));
      delivered='quiz';
    }
    notify('HOJA_TT_INPUT_ACK',{seq:m.seq,delivered});
  });
  // Never stop announcing before the dashboard has actually connected. The
  // game often loads invisibly long before its dialog is first opened.
  const poll=setInterval(()=>{if(accepted){clearInterval(poll);return;}ready()},1500);
  window.addEventListener('load',ready);ready();
})();

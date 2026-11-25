/* HOJA 1.5: compact single-image stimulus column. No question or answer changes. */
(function(){
 'use strict';
 if(window.HOJA_RENDERER_IMAGE_WIDTH_EXT)return;
 const style=document.createElement('style');
 style.id='hojaImageWidthExtStyle';
 style.textContent='#screen #hqCard[data-compact-stimulus-image="yes"][data-composition="dialogue-image"],#screen #hqCard[data-compact-stimulus-image="yes"][data-composition="picture-stimulus"]{grid-template-columns:minmax(0,1fr) minmax(0,var(--hoja-stimulus-image-width))!important}';
 document.head.append(style);
 const baseMeasure=measureAndFit;
 function clear(card){delete card.dataset.compactStimulusImage;card.style.removeProperty('--hoja-stimulus-image-width');}
 function target(card,media,img,cap){
   const s=getComputedStyle(media),n=k=>parseFloat(s[k])||0;
   const horizontal=n('borderLeftWidth')+n('borderRightWidth')+n('paddingLeft')+n('paddingRight');
   const vertical=n('borderTopWidth')+n('borderBottomWidth')+n('paddingTop')+n('paddingBottom');
   const h=media.offsetHeight;
   if(!h||!img.naturalHeight)return 0;
   return Math.max(1,Math.min(cap,Math.ceil(Math.max(0,h-vertical)*img.naturalWidth/img.naturalHeight+horizontal)));
 }
 measureAndFit=function(){
   const card=document.getElementById('hqCard'),media=document.getElementById('hqMedia');
   clear(card);
   const applicable=['dialogue-image','picture-stimulus'].includes(card.dataset.composition)&&!media.hidden&&!media.classList.contains('hojaMediaSet')&&media.querySelectorAll('img').length===1;
   const img=applicable?media.querySelector('img'):null;
   if(!img||!img.complete||!img.naturalWidth||!img.naturalHeight)return baseMeasure();
   const cap=media.offsetWidth;
   let width=target(card,media,img,cap);
   if(!width||width>=cap-1)return baseMeasure();
   card.dataset.compactStimulusImage='yes';
   for(let i=0;i<3;i++){
      card.style.setProperty('--hoja-stimulus-image-width',width+'px');
      baseMeasure();
      const next=target(card,media,img,cap);
      if(!next||Math.abs(next-width)<=1)break;
      if(i<2)width=next;
   }
 };
 window.HOJA_RENDERER_IMAGE_WIDTH_EXT=Object.freeze({version:1});
})();

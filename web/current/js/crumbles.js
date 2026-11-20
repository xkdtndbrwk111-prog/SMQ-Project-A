'use strict';
window.HOJA_CREATE_CRUMBLES = function ({TILE,HOJA_V2_SURFACE_START,HOJA_V2_ATLAS_COLS,SFX}) {
  function createCrumbles(scene, {CRUMBLES,STAGE,THEME,HOJA_V2_RENDER}){
    scene.crumbles=[];
    scene.crumbleGroup=scene.physics.add.staticGroup();
    for(const c of CRUMBLES){
      const r=scene.add.rectangle(c.x+c.w/2,c.y+c.h/2,c.w,c.h,0x000000,0);
      scene.physics.add.existing(r,true);
      scene.crumbleGroup.add(r);
      const cols=Math.round(c.w/TILE);
      const tiles=[];
      for(let tx=0;tx<cols;tx++){
        const fr=cols===1?66:(tx===0?60:(tx===cols-1?64:61));
        const v2fr=(HOJA_V2_SURFACE_START[STAGE.theme]??0)*HOJA_V2_ATLAS_COLS
          +6+(tx===0?0:tx===cols-1?2:1);
        const img=scene.add.image(c.x+tx*TILE+8,c.y+8,
          HOJA_V2_RENDER?'paV2Terrain':THEME.terrain,HOJA_V2_RENDER?v2fr:fr)
          .setDepth(1).setTint(0xf2b27a);
        tiles.push({img,bx:c.x+tx*TILE+8,by:c.y+8});
      }
      scene.crumbles.push({cfg:c,body:r,tiles,state:'idle',t:0,fxWarning:false});
    }
  }

  function updateCrumbles(scene, delta){
    const pb=scene.playerBody.body;
    const grounded=pb.blocked.down||pb.touching.down;
    for(const cr of scene.crumbles){
      const c=cr.cfg;
      const onTop=grounded&&Math.abs(pb.bottom-c.y)<=3&&pb.right>c.x+2&&pb.left<c.x+c.w-2;
      if(cr.state==='idle'){
        if(onTop){cr.state='shake';cr.t=520;cr.fxWarning=false;SFX.crumble();}
      }else if(cr.state==='shake'){
        cr.t-=delta;
        if(cr.t<=200&&!cr.fxWarning){
          cr.fxWarning=true;
          cr.tiles.forEach(t=>t.img.setTint(0xffb668));
          scene.emitLeaf(c.x+c.w/2,c.y+3);
          SFX.crumbleWarning();
        }
        const amp=cr.t<220?1.6:0.8;
        cr.tiles.forEach((t,i)=>t.img.setPosition(t.bx+Math.sin((cr.t+i*40)*.09)*amp,t.by));
        if(cr.t<=0){
          cr.state='gone';cr.t=3200;
          cr.body.body.enable=false;
          cr.tiles.forEach((t,i)=>{
            scene.tweens.add({targets:t.img,y:t.by+70+i*6,angle:(i%2?1:-1)*25,alpha:0,
              duration:460,ease:'Quad.In'});
          });
          for(let i=0;i<6;i++)scene.emitLeaf(c.x+Math.random()*c.w,c.y+4);
        }
      }else if(cr.state==='gone'){
        cr.t-=delta;
        const inside=pb.right>c.x&&pb.left<c.x+c.w&&pb.bottom>c.y-4&&pb.top<c.y+c.h+4;
        if(cr.t<=0&&!inside){
          cr.state='idle';cr.fxWarning=false;
          cr.body.body.enable=true;
          cr.tiles.forEach(t=>{
            t.img.setPosition(t.bx,t.by).setAngle(0).setAlpha(0).setTint(0xf2b27a);
            scene.tweens.add({targets:t.img,alpha:1,duration:260});
          });
        }
      }
    }
  }

  return {createCrumbles,updateCrumbles};
};

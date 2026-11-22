'use strict';
window.HOJA_CREATE_RAFTS = function ({TILE,waterAtX,SFX}) {
  function createRafts(scene, RAFTS){
    scene.rafts=[];
    for(const rcfg of RAFTS){
      const H=6;
      const bodyObj=scene.add.rectangle(rcfg.x+rcfg.w/2,rcfg.y+H/2,rcfg.w,H,0xffffff,0);
      scene.physics.add.existing(bodyObj,false);
      scene.movingPlatformGroup.add(bodyObj);
      bodyObj.body.setAllowGravity(false);
      bodyObj.body.setImmovable(true);
      bodyObj.body.pushable=false;
      const cols=Math.round(rcfg.w/TILE);
      const tiles=[];
      for(let tx=0;tx<cols;tx++){
        tiles.push(scene.add.image(rcfg.x+tx*TILE+8,rcfg.y+8,'thTroEntities',tx%2?48:46).setDepth(4));
      }
      // A shallow wooden float closes only the 1–16px visual gap created by
      // the lowered water artwork. Higher platforms keep their intended height.
      // It has no body and follows the existing raft, behind the water layer.
      const surface=waterAtX(rcfg.x+rcfg.w/2);
      const gap=surface===null?null:surface-(rcfg.y+TILE);
      let floatArt=null;
      if(gap>0&&gap<=TILE){
        floatArt=scene.add.graphics().setDepth(3.9);
        const top=4,height=TILE+gap-top;
        floatArt.fillStyle(0x603820).fillRect(2,top,rcfg.w-4,height);
        floatArt.fillStyle(0x9c5b30).fillRect(4,top+1,rcfg.w-8,height-3);
        floatArt.fillStyle(0xc58547);
        for(let x=8;x<rcfg.w-8;x+=TILE)floatArt.fillRect(x,top+3,2,height-6);
        floatArt.setPosition(rcfg.x,rcfg.y);
      }
      const raft={cfg:rcfg,bodyObj,tiles,floatArt,splashAt:0,touchAt:-1e9,fxWarning:false};
      bodyObj.__raft=raft;
      scene.rafts.push(raft);
    }
  }

  // V0.24: a raft dips fast to the waterline, then keeps sinking slowly while
  // Hoja stays on it; ~1–1.5s later it slips under and Hoja falls in.
  function updateRafts(scene){
    const pb=scene.playerBody.body;
    const grounded=pb.blocked.down||pb.touching.down;
    const dt=1/60;
    for(const r of scene.rafts){
      const b=r.bodyObj.body,c=r.cfg;
      const top=b.top;
      if(r.waterY===undefined)r.waterY=waterAtX(c.x+c.w/2)??(c.y+c.sink);
      const over=pb.right>b.left+2&&pb.left<b.right-2;
      const occupied=!r.sunk&&over&&pb.velocity.y>-40&&(
        scene.time.now-r.touchAt<140||
        (grounded&&Math.abs(pb.bottom-top)<=4)||
        (r.occupied&&pb.bottom>=top-16&&pb.bottom<=top+8));
      if(occupied&&!r.occupied){
        scene.emitBurst(b.center.x,top+4,6,0xd6f6ff,-.4);
        scene.cameras.main.shake(40,.002);
      }
      r.occupied=occupied;
      // Warn shortly before sinking; the original y thresholds and timing stay.
      if(occupied&&!r.sunk&&!r.fxWarning&&top>=r.waterY+9){
        r.fxWarning=true;
        r.tiles.forEach(img=>img.setTint(0xffc2ab));
        scene.emitBurst(b.center.x,top,3,0xffedb7,-.2);
        SFX.raftWarning();
      }
      if(!occupied&&r.fxWarning){
        r.fxWarning=false;
        r.tiles.forEach(img=>img.clearTint());
      }

      let vy=0;
      if(occupied){
        if(top<c.y+c.sink)vy=top<c.y+6?150:105;   // quick dip
        else vy=34;                               // keeps going down
        if(top>r.waterY+26){                      // slipped under
          r.sunk=true;
          b.checkCollision.none=true;
          b.checkCollision.up=b.checkCollision.down=b.checkCollision.left=b.checkCollision.right=false;
          scene.emitBurst(b.center.x,r.waterY,8,0xd6f6ff,-.6);
          SFX.land();
        }
      }else if(r.sunk){
        vy=top>r.waterY+48?0:20;
        if(!r.sinkWait)r.sinkWait=scene.time.now+900;
        if(scene.time.now>r.sinkWait)vy=-55;
        const clear=!(over&&pb.bottom>top-60&&pb.top<top+20);
        if(vy<0&&top<=r.waterY-2&&clear){
          r.sunk=false;r.sinkWait=0;
          b.checkCollision.none=false;
          b.checkCollision.up=b.checkCollision.down=b.checkCollision.left=b.checkCollision.right=true;
        }
      }else if(top>c.y)vy=-60;
      if(!r.sunk&&!occupied&&(top<c.y-.5||(vy<0&&top+vy*dt<=c.y))){vy=0;b.reset(r.bodyObj.x,c.y+b.height/2);}
      b.setVelocity(0,vy);
      if(occupied&&vy>0&&pb.velocity.y<vy)pb.setVelocityY(vy);
      const left=b.left;
      r.tiles.forEach((img,i)=>img.setPosition(left+i*TILE+8,b.top+8));
      if(r.floatArt)r.floatArt.setPosition(left,b.top);
    }
  }

  return {createRafts,updateRafts};
};

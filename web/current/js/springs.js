'use strict';
window.HOJA_CREATE_SPRING_SYSTEM = function (SFX) {
  function createSprings(scene, springs){
    const original=!!scene.textures?.exists('hojaMakerSpringIdle')&&!!scene.textures?.exists('hojaMakerSpringJump');
    if(original&&!scene.anims.exists('hojaMakerSpringBounce'))scene.anims.create({key:'hojaMakerSpringBounce',frames:scene.anims.generateFrameNumbers('hojaMakerSpringJump',{start:0,end:7}),frameRate:20,repeat:0});
    scene.springs=springs.map(p=>({
      x:p.x+16,y:p.y,until:0,original,
      img:(original?scene.add.sprite(p.x+16,p.y,'hojaMakerSpringIdle'):scene.add.image(p.x+16,p.y,'spring',0)).setOrigin(.5,1).setScale(2).setDepth(6)
    }));
  }

  function updateSprings(scene, time){
    const pb=scene.playerBody.body;
    for(const sp of scene.springs){
      if(sp.until&&time>sp.until){sp.until=0;if(sp.original){sp.img.stop();sp.img.setTexture('hojaMakerSpringIdle');}else sp.img.setFrame(0);}
      if(pb.velocity.y<0)continue;
      if(pb.right<=sp.x-14||pb.left>=sp.x+14)continue;
      if(pb.bottom<sp.y-34||pb.bottom>sp.y-6)continue;
      scene.strongStomp=false;
      scene.bounce(560,'spring');
      scene.coyoteMs=0;
      if(sp.original){sp.img.play('hojaMakerSpringBounce',true);sp.until=time+400;}else{sp.img.setFrame(1);sp.until=time+150;}
      scene.squash(.76,1.28,220);
      scene.emitDust(sp.x,sp.y-2,6,30);
      scene.emitBurst(sp.x,sp.y-28,6,0xffd2c2,-.6);
      // Spring launch must not alter camera zoom (manual zoom stays fixed).
      SFX.spring();
    }
  }

  return {createSprings, updateSprings};
};

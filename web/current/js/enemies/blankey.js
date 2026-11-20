'use strict';
window.HOJA_ENEMIES.types.BLANKEY = {
  body: { w: 30, h: 28 },
  texture: 'blankeyFloat',
  assets: [['blankeyFloat', 'enBlankeyFloat', 32, 32]],
  update(scene, e, frame, dx, dy) {
    const b = e.bodyObj.body;
    const { time, SFX } = frame;
    b.setAllowGravity(false);b.setAcceleration(0,0);
    const previousState=e.state;
    const toward=dx<0?-1:1;e.faceDir=toward;
    const ghostRight=dx<0,ghostLeft=dx>0;
    const hojaFaces=(ghostRight&&scene.facing>0)||(ghostLeft&&scene.facing<0);
    const active=Math.abs(dx)<420;
    e.state=active?(hojaFaces?'WATCHED':'CHASE'):'FLOAT';
    // Turning to face Blankey and away again toggles WATCHED/CHASE often;
    // the cue only replays after a cooldown so it never stacks.
    if(e.state==='CHASE'&&previousState!=='CHASE'&&time>=(e.alertCooldownUntil||0)){
      SFX.ghostAlert();e.alertCooldownUntil=time+2400;
      scene.telegraphEnemy(e,0xd8bbff);
    }

    if(e.state==='WATCHED')b.setVelocity(0,0);
    else if(e.state==='CHASE')b.setVelocity(Math.sign(dx)*46,Math.sign(dy)*26);
    else{
      const target=e.dir>0?e.max:e.min;
      b.setVelocityX(Math.sign(target-e.bodyObj.x)*17);
      const want=e.baseY+Math.sin(e.step*.05+e.phase)*15;
      b.setVelocityY((want-b.bottom)*3.2);
      if(e.bodyObj.x<=e.min+1)e.dir=1;if(e.bodyObj.x>=e.max-1)e.dir=-1;
    }
    e.sprite.setTexture('blankeyFloat',Math.floor(e.step/10)%4);
  }
};

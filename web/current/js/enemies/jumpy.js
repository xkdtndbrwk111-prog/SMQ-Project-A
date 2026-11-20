'use strict';
window.HOJA_ENEMIES.types.JUMPY = {
  body: { w: 30, h: 28 },
  texture: 'jumpyIdle',
  assets: [['jumpyIdle', 'enJumpyIdle', 32, 32], ['jumpyLeap', 'enJumpyLeap', 32, 32]],
  update(scene, e, frame, dx, dy) {
    const b = e.bodyObj.body;
    const { delta, SFX } = frame;
    b.setAccelerationY(900);
    if((b.blocked.down||b.touching.down)&&e.state==='AIR'){e.state='IDLE';e.timer=50;b.setVelocityX(0);}
    if(e.state!=='AIR'){
      e.timer-=delta;
      if(e.timer<=0&&(b.blocked.down||b.touching.down)){
        if(Math.abs(dx)<170)e.dir=dx<0?-1:1;
        e.state='AIR';b.setVelocity(e.dir*87,-312);e.timer=950;SFX.enemyJump();
      }
    }
    if(b.blocked.left||b.blocked.right){e.dir*=-1;b.setVelocityX(e.dir*Math.abs(b.velocity.x));}
    const fr=e.state==='AIR'?(b.velocity.y<-120?0:b.velocity.y<0?1:b.velocity.y<150?2:3):Math.floor(e.step/18)%2;
    e.sprite.setTexture(e.state==='AIR'?'jumpyLeap':'jumpyIdle',fr);
    e.faceDir=e.dir;
  }
};

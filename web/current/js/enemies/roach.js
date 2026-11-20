'use strict';
window.HOJA_ENEMIES.types.ROACH = {
  body: { w: 28, h: 36 },
  texture: 'roachRun',
  assets: [['roachRun', 'enRoachRun', 32, 32]],
  update(scene, e, frame, dx, dy) {
    const b = e.bodyObj.body;
    const { time, SFX } = frame;
    b.setAccelerationY(900);
    const previousState=e.state;
    const near=Math.abs(dx)<125&&Math.abs(dy)<70;
    if(e.state==='FLEE'&&Math.abs(dx)>190)e.state='PATROL';
    else if(near)e.state='FLEE';
    else if(e.state!=='FLEE')e.state='PATROL';
    if(e.state==='FLEE'&&previousState!=='FLEE'&&time>=(e.alertCooldownUntil||0)){
      SFX.roachAlert();e.alertCooldownUntil=time+1200;
    }
    if(e.state==='FLEE'){
      const away=dx<0?1:-1;e.faceDir=dx<0?-1:1;
      // Flee, but never run off a ledge into water.
      b.setVelocityX(scene.ledgeAhead(e,away)?0:away*47);
    }else{
      if(scene.shouldTurnAround(e))e.dir*=-1;
      e.faceDir=e.dir;b.setVelocityX(e.dir*123);
    }
    e.sprite.setTexture('roachRun',Math.floor(e.step/6)%2);
  }
};

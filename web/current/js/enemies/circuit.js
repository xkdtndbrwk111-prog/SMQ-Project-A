'use strict';
// Mirror player motion in range, stopping at ledges and walls.
window.HOJA_ENEMIES.types.CIRCUIT = {
  body: { w: 28, h: 40 },
  texture: 'circuitIdle',
  assets: [['circuitIdle', 'enCircuitIdle', 32, 32], ['circuitRun', 'enCircuitRun', 32, 32]],
  update(scene, e, frame, dx, dy) {
    const b = e.bodyObj.body;
    const { time, SFX } = frame;
    b.setAccelerationY(900);
    const pvx=scene.playerBody.body.velocity.x;
    const prev=e.state;
    e.state=(Math.abs(dx)<320&&Math.abs(dy)<110)?'MIRROR':'PATROL';
    if(e.state==='MIRROR'&&prev!=='MIRROR'&&time>=(e.alertCooldownUntil||0)){
      SFX.circuitAlert();e.alertCooldownUntil=time+2000;
      scene.telegraphEnemy(e,0x8cddff);
    }
    let vx=0;
    if(e.state==='MIRROR'){
      if(Math.abs(pvx)>25){
        e.dir=Math.sign(pvx);
        vx=e.dir*Math.min(Math.abs(pvx)*0.8,230);
        const stop=(e.dir<0&&(b.blocked.left||e.bodyObj.x<=e.min))||
          (e.dir>0&&(b.blocked.right||e.bodyObj.x>=e.max))||
          scene.ledgeAhead(e,e.dir);
        if(stop)vx=0;
      }
      e.faceDir=vx!==0?e.dir:(dx<0?-1:1);
    }else{
      if(scene.shouldTurnAround(e))e.dir*=-1;
      vx=e.dir*28;e.faceDir=e.dir;
    }
    b.setVelocityX(vx);
    if(Math.abs(vx)>1)e.sprite.setTexture('circuitRun',Math.floor(e.step/(Math.abs(vx)>120?4:7))%3);
    else e.sprite.setTexture('circuitIdle',Math.floor(e.step/16)%2);
  }
};

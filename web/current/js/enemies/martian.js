'use strict';
// Patrol, telegraph, charge and rest.
window.HOJA_ENEMIES.types.MARTIAN = {
  body: { w: 28, h: 34 },
  texture: 'martianIdle',
  assets: [['martianIdle', 'enMartianIdle', 32, 32], ['martianRun', 'enMartianRun', 32, 32]],
  update(scene, e, frame, dx, dy) {
    const b = e.bodyObj.body;
    const { time, delta, SFX } = frame;
    b.setAccelerationY(900);
    const grounded=b.blocked.down||b.touching.down;
    if(e.state==='IDLE')e.state='PATROL';
    if(e.state==='PATROL'){
      if(scene.shouldTurnAround(e))e.dir*=-1;
      b.setVelocityX(e.dir*40);
      e.faceDir=e.dir;
      if(grounded&&Math.abs(dy)<40&&Math.abs(dx)<190&&time>=(e.chargeReadyAt||0)){
        e.state='ALERT';e.timer=480;
        e.dir=dx<0?-1:1;e.faceDir=e.dir;
        b.setVelocity(0,-150);
        SFX.martianAlert();
        scene.telegraphEnemy(e,0xff8c70);
      }
    }else if(e.state==='ALERT'){
      b.setVelocityX(0);e.timer-=delta;
      if(e.timer<=0&&grounded){e.state='CHARGE';e.timer=1100;SFX.martianCharge();}
    }else if(e.state==='CHARGE'){
      e.timer-=delta;
      if(scene.shouldTurnAround(e)||e.timer<=0){e.state='REST';e.timer=650;b.setVelocityX(0);}
      else b.setVelocityX(e.dir*215);
    }else if(e.state==='REST'){
      b.setVelocityX(0);e.timer-=delta;
      if(e.timer<=0){e.state='PATROL';e.chargeReadyAt=time+900;}
    }
    if(e.state==='CHARGE')e.sprite.setTexture('martianRun',Math.floor(e.step/3)%4);
    else if(e.state==='PATROL')e.sprite.setTexture('martianRun',Math.floor(e.step/9)%4);
    else e.sprite.setTexture('martianIdle',Math.floor(e.step/14)%2);
  }
};

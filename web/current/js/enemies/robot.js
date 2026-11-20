'use strict';
// Patrol and stun cycles. A moving shell can defeat a stunned robot.
window.HOJA_ENEMIES.types.ROBOT = {
  body: { w: 30, h: 32 },
  texture: 'robotIdle',
  assets: [['robotIdle', 'enRobotIdle', 32, 32], ['robotMove', 'enRobotMove', 32, 32], ['robotHurt', 'enRobotHurt', 32, 32]],
  update(scene, e, frame, dx, dy) {
    const b = e.bodyObj.body;
    const { delta, SFX } = frame;
    b.setAccelerationY(900);
    if(e.state==='STUN'){
      b.setVelocityX(0);e.timer-=delta;
      e.sprite.setTexture('robotHurt',0);
      e.sprite.setAlpha(e.timer<700&&Math.floor(e.step/4)%2?0.5:1);
      if(e.timer<=0){e.state='PATROL';e.timer=1400;e.sprite.setAlpha(1);SFX.robotReboot();}
    }else{
      if(e.state!=='PATROL'&&e.state!=='PAUSE'){e.state='PATROL';e.timer=1400;}
      e.timer-=delta;
      if(e.state==='PATROL'){
        if(scene.shouldTurnAround(e))e.dir*=-1;
        b.setVelocityX(e.dir*32);
        if(e.timer<=0){e.state='PAUSE';e.timer=520;}
      }else{
        b.setVelocityX(0);
        if(e.timer<=0){e.state='PATROL';e.timer=1300+((e.step*37)%600);}
      }
      e.faceDir=e.dir;
      if(e.state==='PATROL')e.sprite.setTexture('robotMove',Math.floor(e.step/8)%4);
      else e.sprite.setTexture('robotIdle',Math.floor(e.step/16)%2);
    }
  }
};

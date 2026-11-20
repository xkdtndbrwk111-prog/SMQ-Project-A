'use strict';
window.HOJA_ENEMIES.types.HERMIE = {
  body: { w: 34, h: 22 },
  texture: 'hermieCrawl',
  assets: [['hermieCrawl', 'enHermieCrawl', 32, 32], ['hermieShell', 'enHermieShell']],
  update(scene, e, frame, dx, dy) {
    const b = e.bodyObj.body;
    const { time, delta } = frame;
    b.setAccelerationY(900);
    if(e.state==='SHELL'||e.state==='SHELL_MOVE'){
      // R3.12: moving shells NEVER wake. Only a stopped shell
      // consumes recovery time. stopHermieShell resets it to 5 seconds.
      if(e.state==='SHELL')e.shellTimer-=delta;
      if(e.state==='SHELL_MOVE'){
        b.setVelocityX(e.dir*288);
        if(b.blocked.left||b.blocked.right){e.dir*=-1;b.setVelocityX(e.dir*288);}
      }else b.setVelocityX(0);
      if(e.state==='SHELL'&&e.shellTimer<=0)scene.hermieWake(e);
      // A wake switches the texture in the walking branch on the next tick.
      else e.sprite.setTexture('hermieShell').setFrame(0);
    }else{
      if(e.state!=='GO'&&e.state!=='STOP'){e.state='GO';e.timer=850;}
      e.timer-=delta;
      if(e.state==='GO'){
        if(scene.shouldTurnAround(e))e.dir*=-1;
        b.setVelocityX(e.dir*35);
        if(e.timer<=0){e.state='STOP';e.timer=520;}
      }else{
        b.setVelocityX(0);
        if(e.timer<=0){e.state='GO';e.timer=850;}
      }
      e.faceDir=e.dir;e.sprite.setTexture('hermieCrawl',Math.floor(e.step/13)%2);
    }
  }
};

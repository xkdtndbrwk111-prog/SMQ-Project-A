'use strict';
window.HOJA_ENEMIES.types.OWL = {
  body: { w: 36, h: 30 },
  texture: 'owlIdle',
  assets: [['owlIdle', 'enOwlIdle', 32, 32], ['owlFly', 'enOwlFly', 32, 32]],
  update(scene, e, frame, dx, dy) {
    const b = e.bodyObj.body;
    const { py, SFX } = frame;
    b.setAllowGravity(false);b.setAcceleration(0,0);

    if(e.state==='PERCH'){
      // PERCH is always physically attached to a real terrain top.
      // No sinusoidal hover and no authored floating Y is allowed.
      const perchCenterY=e.baseY-this.body.h/2;
      if(Math.abs(e.bodyObj.y-perchCenterY)>.25){
        b.reset(e.bodyObj.x,perchCenterY);
      }
      b.setVelocity(0,0);
      e.faceDir=dx<0?-1:1;

      if(Math.abs(dx)<150&&Math.abs(py-e.baseY)<170){
        e.state='RISE';
        e.riseTarget=e.baseY-72;
        e.dir=dx<0?-1:1;
        e.faceDir=e.dir;
        SFX.owlWake();
        scene.telegraphEnemy(e,0xffd789);
      }
    }else if(e.state==='RISE'){
      b.setVelocity(0,-144);
      if(b.bottom<=e.riseTarget){
        e.state='DASH';
        e.dashStart=e.bodyObj.x;
        b.setVelocity(e.dir*348,0);
        SFX.owlDash();
      }
    }else if(e.state==='DASH'){
      b.setVelocity(e.dir*348,0);

      // Never disappear in open air because of a fixed travel distance.
      // Despawn only after the entire owl has actually flown off camera.
      const view=scene.cameraWorldView();
      const margin=24;
      const fullyOutside=e.dir>0
        ? b.left>view.right+margin
        : b.right<view.left-margin;

      if(fullyOutside)scene.despawnEnemy(e);
    }

    e.sprite.setTexture(
      e.state==='PERCH'?'owlIdle':'owlFly',
      e.state==='PERCH'?Math.floor(e.step/18)%2:Math.floor(e.step/5)%3
    );
  }
};

'use strict';
window.HOJA_ENEMIES.types.BALLOONEY = {
  body: { w: 24, h: 50 },
  texture: 'balloonFly',
  assets: [['balloonFly', 'enBallooneyFly', 32, 32]],
  stationaryAsset: ['balloonStatic', 'enBalloonStatic'],
  update(scene, e, frame, dx, dy) {
    const b = e.bodyObj.body;
    b.setAllowGravity(false);b.setAcceleration(0,0);
    e.state='QUESTION';e.faceDir=1;
    if(e.stationary){
      b.setVelocity(0,0);
      e.sprite.setTexture('balloonStatic');
    }else{
      b.setVelocityX(e.dir*12);
      if(e.bodyObj.x<e.min)e.dir=1;if(e.bodyObj.x>e.max)e.dir=-1;
      const want=e.baseY+Math.sin(e.step*.05+e.phase)*22;
      b.setVelocityY((want-b.bottom)*3.0);
      e.sprite.setTexture('balloonFly',Math.floor(e.step/10)%2);
    }
  }
};
